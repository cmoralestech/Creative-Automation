import {
  AssetRoleDto,
  ImageSemanticAnalysisDto,
  LiveVisionPayload,
} from "./adapterTypes";

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

const COLOR_MAP: Record<string, string> = {
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

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokenizeImageName(input: string): string[] {
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
  const colors = tokens
    .map((token) => COLOR_MAP[token])
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

export function buildImageSemanticHeuristic(
  tokens: string[],
  reason: string,
): ImageSemanticAnalysisDto {
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

export function parseImageSemanticLiveVisionPayload(
  input: string,
): LiveVisionPayload | null {
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

export function mergeImageSemanticLiveVisionResult(
  payload: LiveVisionPayload,
  heuristic: ImageSemanticAnalysisDto,
): ImageSemanticAnalysisDto {
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