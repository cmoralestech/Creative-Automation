import { CampaignBrief } from "@/domain/campaignBrief";

export type UploadedAsset = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

export function buildDefaultLogoAsset(primaryColor?: string): UploadedAsset {
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
  assets: UploadedAsset[],
): UploadedAsset | null {
  const productId = normalize(product.id);
  const productName = normalize(product.name);

  const match = assets.find((asset) => {
    const name = normalize(asset.name);
    return name.includes(productId) || name.includes(productName);
  });

  return match ?? null;
}

export function findLogoAsset(assets: UploadedAsset[]): UploadedAsset | null {
  const logo = assets.find((asset) => /logo/i.test(asset.name));
  return logo ?? null;
}
