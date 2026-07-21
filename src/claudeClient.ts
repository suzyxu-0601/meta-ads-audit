import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8192;

/**
 * Claude occasionally writes a raw newline/tab inside a JSON string value
 * instead of the escaped \n/\t — invalid JSON, but an easy, common slip when
 * a model is asked to emit multi-sentence prose inside a string literal.
 * This walks the text tracking in-string state (respecting backslash
 * escapes) and escapes any literal control character it finds there.
 */
function sanitizeJsonControlChars(raw: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const code = raw.charCodeAt(i);

    if (inString && escapeNext) {
      result += ch;
      escapeNext = false;
      continue;
    }

    if (inString && ch === "\\") {
      result += ch;
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && code < 0x20) {
      switch (ch) {
        case "\n":
          result += "\\n";
          break;
        case "\r":
          result += "\\r";
          break;
        case "\t":
          result += "\\t";
          break;
        default:
          result += `\\u${code.toString(16).padStart(4, "0")}`;
      }
      continue;
    }

    result += ch;
  }

  return result;
}

function extractJson(finalText: string): any {
  const jsonMatch = finalText.match(/```json\s*([\s\S]*?)```/i);
  if (!jsonMatch) {
    throw new Error("Claude response did not include a ```json code block");
  }
  return JSON.parse(sanitizeJsonControlChars(jsonMatch[1]));
}

async function runOnce(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  onText: (chunk: string) => void;
}): Promise<any> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userPrompt }],
    },
    { signal: params.signal }
  );

  stream.on("text", (delta) => params.onText(delta));

  const finalText = await stream.finalText();
  return extractJson(finalText);
}

export async function generateSlideJson(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  onText: (chunk: string) => void;
}): Promise<any> {
  try {
    return await runOnce(params);
  } catch (err) {
    if (params.signal.aborted) throw err; // cancellation, not a parse failure — don't retry
    params.onText(
      `\n[Response wasn't valid JSON (${
        err instanceof Error ? err.message : String(err)
      }) — retrying this slide once...]\n`
    );
    return await runOnce(params);
  }
}
