import { SUPPORTED_AI_MODELS, type AiModel } from "@/app/api/_shared/models";

export const SUPPORTED_GENERATE_MODELS = SUPPORTED_AI_MODELS;

export type GenerateModel = AiModel;

export type GenerateRequestFormDto = {
  brief: FormDataEntryValue | null;
  briefFile: FormDataEntryValue | null;
  model: FormDataEntryValue | null;
  assetMetadata: FormDataEntryValue | null;
  assets: FormDataEntryValue[];
};

export type AssetMetadataDto = {
  role?: "logo" | "product" | "reference" | "unknown";
  productId?: string;
  semanticHint?: string;
};
