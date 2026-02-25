import { access } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import archiver from "archiver";

export const runtime = "nodejs";

function isSafeCampaignId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  const { campaignId } = await context.params;

  if (!isSafeCampaignId(campaignId)) {
    return Response.json(
      { error: "Invalid campaignId. Use only letters, numbers, dash, or underscore." },
      { status: 400 },
    );
  }

  const outputDir = path.join(process.cwd(), "outputs", campaignId);

  try {
    await access(outputDir);
  } catch {
    return Response.json({ error: "Campaign output folder not found." }, { status: 404 });
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();

  archive.on("error", (error) => {
    stream.destroy(error);
  });

  archive.pipe(stream);
  archive.directory(outputDir, campaignId);
  void archive.finalize();

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
