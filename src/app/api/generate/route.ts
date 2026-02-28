import path from "node:path";

import { ImageSemanticClient } from "@/adapters/imageSemanticClient";
import { ApiErrorResponseDto } from "@/app/api/_shared/dtos";
import { parseCampaignBrief } from "@/domain/campaignBrief";
import { PipelineResultDto, runPipeline } from "@/pipeline/orchestrator";
import { UploadedAssetDto } from "@/services/assetService";

export const runtime = "nodejs";

const MAX_BRIEF_BYTES = 150_000;
const MAX_ASSET_FILES = 10;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SUPPORTED_GENERATE_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o"] as const;

type GenerateModel = (typeof SUPPORTED_GENERATE_MODELS)[number];

type GenerateRequestFormDto = {
  brief: FormDataEntryValue | null;
  briefFile: FormDataEntryValue | null;
  model: FormDataEntryValue | null;
  assetMetadata: FormDataEntryValue | null;
  assets: FormDataEntryValue[];
};

type AssetMetadataDto = {
  role?: "logo" | "product" | "reference" | "unknown";
  productId?: string;
  semanticHint?: string;
};

function resolveRole(
  manualRole: AssetMetadataDto["role"],
  inferredRole: UploadedAssetDto["role"],
): UploadedAssetDto["role"] {
  if (manualRole && manualRole !== "unknown") {
    return manualRole;
  }

  if (inferredRole && inferredRole !== "unknown") {
    return inferredRole;
  }

  return "unknown";
}

function coerceGenerateModel(input: FormDataEntryValue | null): GenerateModel {
  if (typeof input !== "string") {
    return "gpt-4.1-mini";
  }

  return (SUPPORTED_GENERATE_MODELS as readonly string[]).includes(input)
    ? (input as GenerateModel)
    : "gpt-4.1-mini";
}

function isAllowedImageType(file: File): boolean {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return true;
  }

  const normalized = file.name.toLowerCase();
  return normalized.endsWith(".png") || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".webp");
}

function parseAssetMetadata(input: FormDataEntryValue | null): AssetMetadataDto[] {
  if (typeof input !== "string" || !input.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry) => {
      const record = typeof entry === "object" && entry ? (entry as Record<string, unknown>) : {};
      const roleRaw = typeof record.role === "string" ? record.role : "unknown";
      const role = ["logo", "product", "reference", "unknown"].includes(roleRaw)
        ? (roleRaw as AssetMetadataDto["role"])
        : "unknown";

      return {
        role,
        productId: typeof record.productId === "string" ? record.productId.trim() : undefined,
        semanticHint:
          typeof record.semanticHint === "string" ? record.semanticHint.trim() : undefined,
      };
    });
  } catch {
    return [];
  }
}

async function toUploadedAsset(
  file: File,
  metadata: AssetMetadataDto | undefined,
  semanticClient: ImageSemanticClient,
): Promise<UploadedAssetDto> {
  if (!isAllowedImageType(file)) {
    throw new Error(
      `Unsupported asset type for ${file.name}. Allowed formats: PNG, JPG, JPEG, WEBP.`,
    );
  }

  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(
      `Asset ${file.name} exceeds the ${Math.round(MAX_ASSET_BYTES / (1024 * 1024))}MB limit.`,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const analysis = await semanticClient.analyzeImage({
    name: file.name,
    mimeType: file.type,
    buffer,
  });

  return {
    name: file.name,
    mimeType: file.type,
    buffer,
    role: resolveRole(metadata?.role, analysis.inferredRole),
    productId: metadata?.productId,
    semanticHint: metadata?.semanticHint,
    semanticSummary: analysis.semanticSummary,
    tags: analysis.tags,
    detectedText: analysis.detectedText,
    dominantColors: analysis.dominantColors,
    roleConfidence: analysis.roleConfidence,
    analysisSource: analysis.source,
    analysisReason: analysis.reason,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const payload: GenerateRequestFormDto = {
      brief: formData.get("brief"),
      briefFile: formData.get("briefFile"),
      model: formData.get("model"),
      assetMetadata: formData.get("assetMetadata"),
      assets: formData.getAll("assets"),
    };
    const selectedModel = coerceGenerateModel(payload.model);
    const assetMetadata = parseAssetMetadata(payload.assetMetadata);

    const briefRaw = payload.brief;

    let briefText: string | null = null;

    if (typeof briefRaw === "string") {
      briefText = briefRaw;
    } else if (briefRaw instanceof File) {
      briefText = await briefRaw.text();
    } else {
      const briefFile = payload.briefFile;
      if (briefFile instanceof File) {
        briefText = await briefFile.text();
      }
    }

    if (!briefText || !briefText.trim()) {
      return Response.json(
        {
          error:
            "Missing campaign brief. Provide a JSON brief in the editor or upload a brief file.",
        } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    if (Buffer.byteLength(briefText, "utf-8") > MAX_BRIEF_BYTES) {
      return Response.json(
        { error: `Brief is too large. Maximum size is ${MAX_BRIEF_BYTES} bytes.` } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(briefText);
    } catch {
      return Response.json(
        { error: "Brief must be valid JSON." } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    const brief = parseCampaignBrief(parsedJson);
    const files = payload.assets;
    const uploadCandidates = files.filter((item): item is File => item instanceof File);
    const semanticClient = new ImageSemanticClient();

    if (uploadCandidates.length > MAX_ASSET_FILES) {
      return Response.json(
        {
          error: `Too many assets uploaded. Maximum allowed is ${MAX_ASSET_FILES} files per run.`,
        } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    const uploadedAssets = await Promise.all(
      uploadCandidates.map((file, index) =>
        toUploadedAsset(file, assetMetadata[index], semanticClient),
      ),
    );
    const workspaceRoot = process.cwd();

    const result: PipelineResultDto = await runPipeline({
      brief,
      uploadedAssets,
      workspaceRoot: path.resolve(workspaceRoot),
      textModel: selectedModel,
    });

    return Response.json(result satisfies PipelineResultDto);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pipeline execution failed unexpectedly.";
    return Response.json({ error: message } satisfies ApiErrorResponseDto, { status: 500 });
  }
}
