import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8192;

export async function generateSlideJson(params: {
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

  const jsonMatch = finalText.match(/```json\s*([\s\S]*?)```/i);
  if (!jsonMatch) {
    throw new Error("Claude response did not include a ```json code block");
  }

  return JSON.parse(jsonMatch[1]);
}
