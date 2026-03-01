import { access } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import archiver from "archiver";
import { ApiErrorResponseDto } from "@/app/api/_shared/dtos";

export const runtime = "nodejs";

// Route params contract.
type DownloadRouteParamsDto = {
  campaignId: string;
};

function isSafeCampaignId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<DownloadRouteParamsDto> },
): Promise<Response> {
  // Stage 1: Resolve and validate campaign identifier.
  const { campaignId } = await context.params;

  if (!isSafeCampaignId(campaignId)) {
    return Response.json(
      { error: "Invalid campaignId. Use only letters, numbers, dash, or underscore." } satisfies ApiErrorResponseDto,
      { status: 400 },
    );
  }

  const outputDir = path.join(process.cwd(), "outputs", campaignId);

  // Stage 2: Verify campaign output directory exists.
  try {
    await access(outputDir);
  } catch {
    return Response.json(
      { error: "Campaign output folder not found." } satisfies ApiErrorResponseDto,
      { status: 404 },
    );
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();

  archive.on("error", (error) => {
    stream.destroy(error);
  });

  archive.pipe(stream);
  archive.directory(outputDir, campaignId);
  void archive.finalize();

  // Stage 3: Stream ZIP archive back to client.
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${campaignId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
