export const SUPPORTED_AI_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o"] as const;

export type AiModel = (typeof SUPPORTED_AI_MODELS)[number];
