import { ASPECT_RATIO_DIMENSIONS, AspectRatio } from "@/domain/campaignBrief";
import sharp from "sharp";

export type ComposeResult = {
  image: Buffer;
  logoPlaced: boolean;
};

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildTextOverlaySvg(text: string, width: number, height: number): Buffer {
  const safeText = text.replace(/[<>&]/g, "");
  const marginX = 42;
  const fontSize = Math.max(28, Math.floor(width * 0.035));
  // Approximate chars per line: available width / (fontSize * 0.6 average char width)
  const availableWidth = width - marginX * 2;
  const maxCharsPerLine = Math.max(20, Math.floor(availableWidth / (fontSize * 0.58)));
  const lines = wrapText(safeText, maxCharsPerLine);
  const lineHeight = fontSize + 10;
  const paddingY = 36;
  const boxHeight = Math.max(100, lines.length * lineHeight + paddingY * 2);
  const boxY = height - boxHeight;

  const textElements = lines.map((line, i) => {
    const ty = boxY + paddingY + fontSize + i * lineHeight;
    const weight = i === 0 ? ' font-weight="700"' : "";
    const fill = i === 0 ? "#ffffff" : "#f1f5f9";
    const size = i === 0 ? fontSize : Math.max(22, fontSize - 4);
    // Escape XML entities properly
    const escapedLine = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
    return `<text x="${marginX}" y="${ty}" font-size="${size}" fill="${fill}" font-family="Arial, Helvetica, sans-serif"${weight}>${escapedLine}</text>`;
  }).join("\n    ");

  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${boxY}" width="${width}" height="${boxHeight}" fill="#000000" opacity="0.55"/>
    ${textElements}
  </svg>`;

  return Buffer.from(svg);
}

export async function composeCreative({
  baseImage,
  aspectRatio,
  campaignText,
  logoImage,
  brandTintColor,
  brandTintOpacity = 0.16,
}: {
  baseImage: Buffer;
  aspectRatio: AspectRatio;
  campaignText: string;
  logoImage: Buffer | null;
  brandTintColor?: string | null;
  brandTintOpacity?: number;
}): Promise<ComposeResult> {
  const size = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  const resized = await sharp(baseImage)
    .resize(size.width, size.height, { fit: "cover" })
    .toBuffer();

  const composites: sharp.OverlayOptions[] = [];

  if (brandTintColor && /^#?[0-9a-fA-F]{6}$/.test(brandTintColor)) {
    const normalized = `#${brandTintColor.replace("#", "")}`;
    const safeOpacity = Math.max(0, Math.min(0.45, brandTintOpacity));
    const tintSvg = `
      <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${normalized}" opacity="${safeOpacity}" />
      </svg>
    `;
    composites.push({
      input: Buffer.from(tintSvg),
      top: 0,
      left: 0,
    });
  }

  composites.push({
    input: buildTextOverlaySvg(campaignText, size.width, size.height),
    top: 0,
    left: 0,
  });

  if (logoImage) {
    const targetWidth = Math.max(90, Math.floor(size.width * 0.14));
    const normalizedLogo = await sharp(logoImage)
      .resize({ width: targetWidth })
      .png()
      .toBuffer();
    composites.push({
      input: normalizedLogo,
      top: 24,
      left: 24,
    });
  }

  const finalImage = await sharp(resized).composite(composites).png().toBuffer();

  return {
    image: finalImage,
    logoPlaced: Boolean(logoImage),
  };
}
