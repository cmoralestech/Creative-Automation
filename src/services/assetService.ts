import { CampaignBrief } from "@/domain/campaignBrief";

export type UploadedAssetDto = {
  name: string;
  mimeType: string;
  buffer: Buffer;
  role?: "logo" | "product" | "reference" | "unknown";
  productId?: string;
  semanticHint?: string;
  semanticSummary?: string;
  tags?: string[];
  detectedText?: string[];
  dominantColors?: string[];
  roleConfidence?: number;
  analysisSource?: "live" | "mock" | "fallback";
  analysisReason?: string | null;
};

export function buildDefaultLogoAsset(primaryColor?: string): UploadedAssetDto {
  const normalizedColor = /^#?[0-9a-fA-F]{6}$/.test(primaryColor ?? "")
    ? `#${(primaryColor ?? "").replace("#", "")}`
    : "#4F46E5";

  const svg = `
    <svg width="220" height="220" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="220" height="220" rx="44" fill="${normalizedColor}" />
      <text x="110" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#FFFFFF">AI</text>
    </svg>
  `;

  return {
    name: "default-logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findProductAsset(
  product: CampaignBrief["products"][number],
  assets: UploadedAssetDto[],
): UploadedAssetDto | null {
  const productId = normalize(product.id);
  const productName = normalize(product.name);

  const explicitMatch = assets.find((asset) => {
    if (asset.role !== "product") {
      return false;
    }

    const linkedProductId = normalize(asset.productId ?? "");
    return linkedProductId.length > 0 && linkedProductId === productId;
  });

  if (explicitMatch) {
    return explicitMatch;
  }

  const match = assets.find((asset) => {
    const name = normalize(asset.name);
    return name.includes(productId) || name.includes(productName);
  });

  return match ?? null;
}

export function findLogoAsset(assets: UploadedAssetDto[]): UploadedAssetDto | null {
  const explicitLogo = assets.find((asset) => asset.role === "logo");
  if (explicitLogo) {
    return explicitLogo;
  }

  const logo = assets.find((asset) => /logo/i.test(asset.name));
  return logo ?? null;
}

function normalizeHint(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function buildVisualContextForProduct(
  product: CampaignBrief["products"][number],
  assets: UploadedAssetDto[],
): string[] {
  const productId = normalize(product.id);

  const references = assets
    .filter((asset) => asset.role === "reference")
    .map((asset) => {
      const hint = normalizeHint(asset.semanticHint ?? asset.semanticSummary ?? "");
      return hint
        ? `Reference image (${asset.name}): ${hint}`
        : `Reference image provided: ${asset.name}`;
    });

  const productAssets = assets
    .filter((asset) => asset.role === "product" || (!asset.role && asset.productId))
    .filter((asset) => normalize(asset.productId ?? "") === productId)
    .map((asset) => {
      const hint = normalizeHint(asset.semanticHint ?? asset.semanticSummary ?? "");
      return hint
        ? `Product image (${asset.name}): ${hint}`
        : `Product image provided: ${asset.name}`;
    });

  const logoAsset = findLogoAsset(assets);
  const logoContext = logoAsset
    ? [
        logoAsset.semanticHint || logoAsset.semanticSummary
          ? `Logo guidance (${logoAsset.name}): ${normalizeHint(
              logoAsset.semanticHint ?? logoAsset.semanticSummary ?? "",
            )}`
          : `Brand logo provided: ${logoAsset.name}`,
      ]
    : [];

  return [...logoContext, ...productAssets, ...references].slice(0, 8);
}
