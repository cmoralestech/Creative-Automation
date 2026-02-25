import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type WriteCreativeParams = {
  rootDir: string;
  campaignId: string;
  productId: string;
  aspectRatio: string;
  image: Buffer;
};

function sanitizePathSegment(input: string, fallback: string): string {
  const value = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || fallback;
}

export async function writeCreative(params: WriteCreativeParams): Promise<string> {
  const safeCampaignId = sanitizePathSegment(params.campaignId, "campaign");
  const safeProductId = sanitizePathSegment(params.productId, "product");
  const outputDir = path.join(
    params.rootDir,
    "outputs",
    safeCampaignId,
    safeProductId,
    params.aspectRatio.replace(":", "x"),
  );
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "creative.png");
  await writeFile(outputPath, params.image);
  return outputPath;
}

export async function writeRunReport(
  rootDir: string,
  campaignId: string,
  report: unknown,
): Promise<string> {
  const safeCampaignId = sanitizePathSegment(campaignId, "campaign");
  const outputDir = path.join(rootDir, "outputs", safeCampaignId);
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "run-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  return reportPath;
}
