export type AssetRoleDto = "logo" | "product" | "reference" | "unknown";

export type ImageSemanticAnalysisDto = {
  inferredRole: AssetRoleDto;
  roleConfidence: number;
  semanticSummary: string;
  tags: string[];
  detectedText: string[];
  dominantColors: string[];
  source: "live" | "mock" | "fallback";
  reason: string | null;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "image",
  "img",
  "photo",
  "asset",
  "final",
  "copy",
  "draft",
  "new",
  "v1",
  "v2",
  "v3",
]);

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toTokens(input: string): string[] {
  return normalize(input)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function inferRole(tokens: string[]): { role: AssetRoleDto; confidence: number } {
  const joined = ` ${tokens.join(" ")} `;

  if (/\s(logo|logotype|wordmark|swoosh|icon)\s/.test(joined)) {
    return { role: "logo", confidence: 0.95 };
  }

  if (/\s(reference|mood|style|inspiration|scene)\s/.test(joined)) {
    return { role: "reference", confidence: 0.86 };
  }

  if (/\s(product|shoe|shoes|sock|socks|jersey|bottle|bar|webcam|headset|pack)\s/.test(joined)) {
    return { role: "product", confidence: 0.8 };
  }

  return { role: "unknown", confidence: 0.45 };
}

function inferDominantColors(tokens: string[]): string[] {
  const colorMap: Record<string, string> = {
    black: "#000000",
    white: "#FFFFFF",
    blue: "#0057B8",
    red: "#CD1041",
    green: "#00A86B",
    orange: "#FF6600",
    volt: "#CEFF00",
    yellow: "#FFD60A",
    purple: "#7C3AED",
  };

  const colors = tokens
    .map((token) => colorMap[token])
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(colors)).slice(0, 4);
}

function summarize(role: AssetRoleDto, tags: string[]): string {
  const headline =
    role === "logo"
      ? "Likely brand logo asset"
      : role === "product"
        ? "Likely product-focused asset"
        : role === "reference"
          ? "Likely reference style asset"
          : "Generic uploaded visual";

  if (tags.length === 0) {
    return headline;
  }

  return `${headline}; key cues: ${tags.slice(0, 6).join(", ")}.`;
}

export class ImageSemanticClient {
  async analyzeImage(input: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<ImageSemanticAnalysisDto> {
    const enabled = process.env.ENABLE_IMAGE_SEMANTIC_EXTRACTION === "true";

    if (!enabled) {
      return {
        inferredRole: "unknown",
        roleConfidence: 0,
        semanticSummary: "Image semantic extraction disabled.",
        tags: [],
        detectedText: [],
        dominantColors: [],
        source: "fallback",
        reason: "image-semantic-extraction-disabled",
      };
    }

    const tokens = toTokens(input.name);
    const roleResult = inferRole(tokens);
    const tags = Array.from(new Set(tokens)).slice(0, 10);
    const dominantColors = inferDominantColors(tokens);

    return {
      inferredRole: roleResult.role,
      roleConfidence: roleResult.confidence,
      semanticSummary: summarize(roleResult.role, tags),
      tags,
      detectedText: [],
      dominantColors,
      source: "mock",
      reason: "deterministic-filename-heuristic",
    };
  }
}
