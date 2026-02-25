import path from "node:path";

import { parseCampaignBrief } from "@/domain/campaignBrief";
import { runPipeline } from "@/pipeline/orchestrator";
import { UploadedAsset } from "@/services/assetService";

export const runtime = "nodejs";

const MAX_BRIEF_BYTES = 150_000;
const MAX_ASSET_FILES = 10;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isAllowedImageType(file: File): boolean {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return true;
  }

  const normalized = file.name.toLowerCase();
  return normalized.endsWith(".png") || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".webp");
}

async function toUploadedAsset(file: File): Promise<UploadedAsset> {
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
  return {
    name: file.name,
    mimeType: file.type,
    buffer: Buffer.from(arrayBuffer),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const briefRaw = formData.get("brief");

    let briefText: string | null = null;

    if (typeof briefRaw === "string") {
      briefText = briefRaw;
    } else if (briefRaw instanceof File) {
      briefText = await briefRaw.text();
    } else {
      const briefFile = formData.get("briefFile");
      if (briefFile instanceof File) {
        briefText = await briefFile.text();
      }
    }

    if (!briefText || !briefText.trim()) {
      return Response.json(
        {
          error:
            "Missing campaign brief. Provide a JSON brief in the editor or upload a brief file.",
        },
        { status: 400 },
      );
    }

    if (Buffer.byteLength(briefText, "utf-8") > MAX_BRIEF_BYTES) {
      return Response.json(
        { error: `Brief is too large. Maximum size is ${MAX_BRIEF_BYTES} bytes.` },
        { status: 400 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(briefText);
    } catch {
      return Response.json({ error: "Brief must be valid JSON." }, { status: 400 });
    }

    const brief = parseCampaignBrief(parsedJson);
    const files = formData.getAll("assets");
    const uploadCandidates = files.filter((item): item is File => item instanceof File);

    if (uploadCandidates.length > MAX_ASSET_FILES) {
      return Response.json(
        {
          error: `Too many assets uploaded. Maximum allowed is ${MAX_ASSET_FILES} files per run.`,
        },
        { status: 400 },
      );
    }

    const uploadedAssets = await Promise.all(uploadCandidates.map(toUploadedAsset));
    const workspaceRoot = process.cwd();

    const result = await runPipeline({
      brief,
      uploadedAssets,
      workspaceRoot: path.resolve(workspaceRoot),
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pipeline execution failed unexpectedly.";
    return Response.json({ error: message }, { status: 500 });
  }
}
