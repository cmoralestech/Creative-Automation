import {
  SUPPORTED_BRIEF_CHAT_MODELS,
  type BriefChatModel,
} from "@/app/api/brief-chat/types";
import type { AssetMetadata, BriefChatMessage, SimpleBriefForm } from "@/app/page.types";

export const briefChatModelOptions: { value: BriefChatModel; label: string }[] = [
  { value: SUPPORTED_BRIEF_CHAT_MODELS[0], label: "GPT-4.1 mini" },
  { value: SUPPORTED_BRIEF_CHAT_MODELS[1], label: "GPT-4.1" },
  { value: SUPPORTED_BRIEF_CHAT_MODELS[2], label: "GPT-4o" },
];

export const initialBriefChatMessage: BriefChatMessage = {
  id: "assistant-intro",
  role: "assistant",
  text: "Describe the campaign you want, and I will draft valid campaign brief JSON for this workspace.",
};

export const MAX_CHAT_ASSETS = 2;

export const defaultBrief = `{
  "campaignId": "spring-sportswear-2026",
  "market": {
    "region": "NA",
    "country": "US",
    "language": "en-US"
  },
  "targetAudience": "Active adults 20-40 who run or train regularly",
  "products": [
    {
      "id": "running-socks",
      "name": "Running Socks",
      "keyBenefits": ["Moisture-wicking", "Arch support", "All-day comfort"]
    },
    {
      "id": "tennis-shoes",
      "name": "Tennis Shoes",
      "keyBenefits": ["Responsive cushioning", "Lightweight feel", "Durable outsole"]
    }
  ],
  "campaignMessage": "Train stronger with lightweight sportswear built for everyday performance.",
  "channels": ["instagram", "facebook"],
  "requiredAspectRatios": ["1:1", "9:16", "16:9"],
  "brand": {
    "primaryColors": ["#0057B8", "#00A3E0"],
    "logoRequired": true,
    "voice": "Bold, optimistic, and practical",
    "forbiddenWords": ["cure", "guaranteed"]
  }
}`;

export const defaultSimpleForm: SimpleBriefForm = {
  campaignId: "spring-sportswear-2026",
  region: "NA",
  country: "US",
  language: "en-US",
  targetAudience: "Active adults 20-40 who run or train regularly",
  campaignMessage: "Train stronger with lightweight sportswear built for everyday performance.",
  brandVoice: "Bold, optimistic, and practical",
  primaryColorsCsv: "#0057B8, #00A3E0",
  forbiddenWordsCsv: "cure, guaranteed",
  products: [
    {
      id: "running-socks",
      name: "Running Socks",
      benefitsCsv: "Moisture-wicking, Arch support, All-day comfort",
    },
    {
      id: "tennis-shoes",
      name: "Tennis Shoes",
      benefitsCsv: "Responsive cushioning, Lightweight feel, Durable outsole",
    },
  ],
};

export const DEFAULT_ASSET_METADATA: AssetMetadata = {
  role: "unknown",
  productId: "",
  semanticHint: "",
};
