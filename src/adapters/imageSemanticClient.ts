import OpenAI from "openai";

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

type LiveVisionPayload = {
  inferredRole?: unknown;
  roleConfidence?: unknown;
  semanticSummary?: unknown;
  tags?: unknown;
  detectedText?: unknown;
  dominantColors?: unknown;
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function coerceRole(value: unknown, fallback: AssetRoleDto): AssetRoleDto {
  if (value === "logo" || value === "product" || value === "reference" || value === "unknown") {
    return value;
  }
  return fallback;
}

function toStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, maxLength));

  return Array.from(new Set(normalized)).slice(0, maxItems);
}

function toHexColors(value: unknown, fallback: string[]): string[] {
  const colors = toStringList(value, 4, 7)
    .map((item) => item.toUpperCase())
    .filter((item) => /^#[0-9A-F]{6}$/.test(item));

  return colors.length > 0 ? colors : fallback;
}

function sanitizeSummary(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const summary = value.replace(/\s+/g, " ").trim();
  return summary ? summary.slice(0, 240) : fallback;
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
}

function parseLiveVisionPayload(input: string): LiveVisionPayload | null {
  const sanitized = stripCodeFences(input);
  try {
    const parsed = JSON.parse(sanitized) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as LiveVisionPayload;
  } catch {
    return null;
  }
}

export class ImageSemanticClient {
  private readonly client: OpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  private buildHeuristicAnalysis(tokens: string[], reason: string): ImageSemanticAnalysisDto {
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
      reason,
    };
  }

  private async analyzeWithLiveVision(
    input: { name: string; mimeType: string; buffer: Buffer },
    heuristic: ImageSemanticAnalysisDto,
  ): Promise<ImageSemanticAnalysisDto> {
    if (!this.client) {
      throw new Error("missing-openai-api-key");
    }

    const imageDataUrl = `data:${input.mimeType || "image/png"};base64,${input.buffer.toString("base64")}`;
    const model = process.env.IMAGE_SEMANTIC_MODEL?.trim() || "gpt-4.1-mini";

    const response = await this.client.responses.create({
      model,
      temperature: 0,
      max_output_tokens: 350,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Analyze one uploaded marketing image. Return only valid JSON with keys: inferredRole, roleConfidence, semanticSummary, tags, detectedText, dominantColors. inferredRole must be logo|product|reference|unknown. roleConfidence must be 0..1. tags and detectedText are arrays of short strings. dominantColors must be hex colors like #RRGGBB.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `File name: ${input.name}`,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const payload = parseLiveVisionPayload(response.output_text ?? "");
    if (!payload) {
      throw new Error("invalid-live-vision-json");
    }

    const inferredRole = coerceRole(payload.inferredRole, heuristic.inferredRole);
    const roleConfidence =
      typeof payload.roleConfidence === "number"
        ? clampConfidence(payload.roleConfidence)
        : heuristic.roleConfidence;
    const tags = toStringList(payload.tags, 10, 30);
    const detectedText = toStringList(payload.detectedText, 10, 64);
    const dominantColors = toHexColors(payload.dominantColors, heuristic.dominantColors);
    const semanticSummary = sanitizeSummary(payload.semanticSummary, heuristic.semanticSummary);

    return {
      inferredRole,
      roleConfidence,
      semanticSummary,
      tags: tags.length > 0 ? tags : heuristic.tags,
      detectedText,
      dominantColors,
      source: "live",
      reason: null,
    };
  }

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
    const heuristicResult = this.buildHeuristicAnalysis(tokens, "deterministic-filename-heuristic");

    const liveVisionEnabled = process.env.ENABLE_LIVE_IMAGE_VISION === "true";
    if (!liveVisionEnabled) {
      return heuristicResult;
    }

    if (!this.client) {
      return {
        ...heuristicResult,
        reason: "live-vision-missing-openai-api-key",
      };
    }

    try {
      return await this.analyzeWithLiveVision(input, heuristicResult);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "live-vision-request-failed";
      return {
        ...heuristicResult,
        reason: `live-vision-failed:${reason}`,
      };
    }
  }
}
