export type SlideId =
  | "performance-overview"
  | "challenges-solutions"
  | "three-month-outlook"
  | "campaign-architecture"
  | "creative-testing-roadmap"
  | "channel-expansion-roadmap";

export interface SlideDefinition {
  id: SlideId;
  title: string;
  /** Slide-specific instructions, adapted from prompts/slide-prompt.txt */
  instructions: string;
  /** Describes the exact JSON shape Claude must return in its trailing ```json block */
  responseSchema: string;
}

export interface PerformanceOverviewContent {
  insights: string[];
  recommendations: string[];
}

export interface ChallengesSolutionsColumn {
  theme: string;
  challenge: string;
  solution: string;
}
export interface ChallengesSolutionsContent {
  columns: ChallengesSolutionsColumn[];
}

export interface ThreeMonthOutlookMonth {
  title: string;
  campaignChanges: string;
  creativeTesting: string;
  channelExpansion: string;
  kpiTargets: string;
}
export interface ThreeMonthOutlookContent {
  northStar: string;
  months: ThreeMonthOutlookMonth[];
}

export interface CampaignArchitectureStage {
  stage: string;
  budgetSplitPct: number;
  campaignNames: string[];
  targeting: string;
  creativeTypes: string;
  cpaTarget: string;
  roasTarget: string;
}
export interface CampaignArchitectureContent {
  stages: CampaignArchitectureStage[];
}

export interface CreativeRoadmapPersona {
  name: string;
  hooks: string[];
  angle: string;
  format: string;
  creator: string;
  targetCpa: string;
  targetThumbstop: string;
}
export interface CreativeRoadmapContent {
  personas: CreativeRoadmapPersona[];
}

export interface ChannelRoadmapMonth {
  status: "active" | "planning" | "launch";
  actions: string;
}
export interface ChannelRoadmapChannel {
  name: string;
  month1: ChannelRoadmapMonth;
  month2: ChannelRoadmapMonth;
  month3: ChannelRoadmapMonth;
  budgetRange: string;
  creativeFormats: string;
  targetingApproach: string;
  campaignType: string;
}
export interface ChannelRoadmapContent {
  channels: ChannelRoadmapChannel[];
}

export type SlideContent =
  | PerformanceOverviewContent
  | ChallengesSolutionsContent
  | ThreeMonthOutlookContent
  | CampaignArchitectureContent
  | CreativeRoadmapContent
  | ChannelRoadmapContent;

export interface GeneratedSlide {
  id: SlideId;
  title: string;
  content: SlideContent;
  chartPaths?: { spend: string; roasCpa: string; cpmFreq: string };
}

/** Same as GeneratedSlide but with chart images inlined as data URIs for the browser preview. */
export interface PublicGeneratedSlide {
  id: SlideId;
  title: string;
  content: SlideContent;
  chartDataUrls?: { spend: string; roasCpa: string; cpmFreq: string };
}

export interface DeckJobRequest {
  insights: import("./types.js").AuditResponse;
}
