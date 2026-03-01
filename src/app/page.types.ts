import type { PipelineResultDto } from "@/pipeline/types";

export type ApiResult = PipelineResultDto;

export type BriefChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type AssetRole = "logo" | "product" | "reference" | "unknown";

export type AssetMetadata = {
  role: AssetRole;
  productId: string;
  semanticHint: string;
};

export type InputMode = "simple" | "json";

export type SimpleProductForm = {
  id: string;
  name: string;
  benefitsCsv: string;
};

export type SimpleBriefForm = {
  campaignId: string;
  region: string;
  country: string;
  language: string;
  targetAudience: string;
  campaignMessage: string;
  brandVoice: string;
  primaryColorsCsv: string;
  forbiddenWordsCsv: string;
  products: [SimpleProductForm, SimpleProductForm];
};
