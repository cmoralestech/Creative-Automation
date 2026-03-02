import type { PipelineResultDto } from "@/pipeline/types";
import type { BriefChatModel } from "@/app/api/brief-chat/types";

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

export type ContextLibraryGroup = "brand" | "market";

export type ContextLibraryFile = {
  path: string;
  name: string;
  group: ContextLibraryGroup;
};

export type ContextLibraryViewModel = {
  files: ContextLibraryFile[];
  panelOpen: boolean;
  selectedPath: string | null;
  content: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  status: string | null;
  lastSavedAt: string | null;
  togglePanel: () => void;
  selectPath: (path: string) => void;
  updateContent: (value: string) => void;
  save: () => void;
};

export type ChatComposerViewModel = {
  briefChatModel: BriefChatModel;
  setBriefChatModel: (model: BriefChatModel) => void;
  briefChatLoading: boolean;
  briefChatInput: string;
  setBriefChatInput: (value: string) => void;
  submitBriefChat: () => void;
  pendingGeneratedBrief: string | null;
  submitting: boolean;
  generateFromLatestDraft: () => void;
  files: File[];
  assetPreviewUrls: { key: string; name: string; url: string }[];
  assetMetadataByKey: Record<string, AssetMetadata>;
  productIdOptions: Array<{ id: string; name: string }>;
  removeAsset: (index: number) => void;
  clearAssets: () => void;
  updateAssetMetadata: (index: number, next: Partial<AssetMetadata>) => void;
  appendAssets: (incomingFiles: File[]) => void;
  assetNotice: string | null;
};
