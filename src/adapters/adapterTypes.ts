export type GenerationSource = "live" | "mock" | "fallback";

// OpenAI adapter types
export type GeneratedCopyDto = {
  text: string;
  source: GenerationSource;
  reason: string | null;
};

export type GeneratedImageDto = {
  image: Buffer;
  source: GenerationSource;
  reason: string | null;
};

export type GeneratedRunSummaryDto = {
  text: string;
  source: GenerationSource;
  reason: string | null;
};

// Image semantic adapter types
export type AssetRoleDto = "logo" | "product" | "reference" | "unknown";

export type ImageSemanticInputDto = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

export type ImageSemanticAnalysisDto = {
  inferredRole: AssetRoleDto;
  roleConfidence: number;
  semanticSummary: string;
  tags: string[];
  detectedText: string[];
  dominantColors: string[];
  source: GenerationSource;
  reason: string | null;
};

export type LiveVisionPayload = {
  inferredRole?: unknown;
  roleConfidence?: unknown;
  semanticSummary?: unknown;
  tags?: unknown;
  detectedText?: unknown;
  dominantColors?: unknown;
};

// Web search adapter types
export type WebSearchSnippet = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

export type WebSearchResultItem = {
  title?: string;
  url?: string;
  snippet?: string;
};

export type WebSearchResponsePayload = {
  results?: WebSearchResultItem[];
};