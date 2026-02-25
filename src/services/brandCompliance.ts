import sharp from "sharp";

function normalizePolicyText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactPolicyText(input: string): string {
  return normalizePolicyText(input).replace(/\s+/g, "");
}

function parseHexColor(hex: string): [number, number, number] | null {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function evaluateColorCompliance(
  image: Buffer,
  palette: string[],
): Promise<{ passed: boolean; closestColor: string | null; minDistance: number | null }> {
  if (palette.length === 0) {
    return { passed: true, closestColor: null, minDistance: null };
  }

  const sampled = await sharp(image)
    .resize(64, 64)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = sampled;
  const channels = info.channels;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }

  const average: [number, number, number] = [
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count),
  ];

  let closestColor: string | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const hex of palette) {
    const parsed = parseHexColor(hex);
    if (!parsed) {
      continue;
    }
    const distance = colorDistance(average, parsed);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = `#${hex.replace("#", "").toUpperCase()}`;
    }
  }

  if (!Number.isFinite(minDistance)) {
    return { passed: true, closestColor: null, minDistance: null };
  }

  return {
    passed: minDistance <= 120,
    closestColor,
    minDistance: Number(minDistance.toFixed(2)),
  };
}

export function evaluateLogoCompliance(logoRequired: boolean, logoPlaced: boolean): boolean {
  if (!logoRequired) {
    return true;
  }
  return logoPlaced;
}

export function evaluateCopyCompliance(copy: string, forbiddenWords: string[]): {
  passed: boolean;
  flaggedWords: string[];
} {
  if (forbiddenWords.length === 0) {
    return { passed: true, flaggedWords: [] };
  }

  const normalizedCopy = normalizePolicyText(copy);
  const compactCopy = compactPolicyText(copy);
  const flaggedWords = forbiddenWords.filter((word) => {
    const original = word.trim();
    if (!original) {
      return false;
    }

    const normalizedWord = normalizePolicyText(original);
    const compactWord = compactPolicyText(original);
    if (!normalizedWord || !compactWord) {
      return false;
    }

    return normalizedCopy.includes(normalizedWord) || compactCopy.includes(compactWord);
  });

  const uniqueFlagged = Array.from(new Set(flaggedWords.map((word) => word.trim()).filter(Boolean)));

  return {
    passed: uniqueFlagged.length === 0,
    flaggedWords: uniqueFlagged,
  };
}
