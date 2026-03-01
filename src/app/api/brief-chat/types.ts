import { CampaignBrief } from "@/domain/campaignBrief";
import { SUPPORTED_AI_MODELS, type AiModel } from "@/app/api/_shared/models";

export const SUPPORTED_BRIEF_CHAT_MODELS = SUPPORTED_AI_MODELS;

export type BriefChatModel = AiModel;

export type BriefChatResponseDto = {
  brief: CampaignBrief;
  source: "live" | "mock" | "fallback";
  model: BriefChatModel;
  repaired: boolean;
  reason: string | null;
};

export type BriefChatRequestDto = {
  request?: unknown;
  model?: unknown;
};
