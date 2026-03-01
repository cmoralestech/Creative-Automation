import type { SimpleBriefForm } from "@/app/page.types";

export function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitCsv(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function trustBadgeClass(source: "live" | "mock" | "fallback" | "uploaded"): string {
  if (source === "live" || source === "uploaded") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (source === "fallback") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function summarizeRequest(briefText: string): string {
  try {
    const parsed = JSON.parse(briefText) as {
      campaignId?: string;
      products?: { name?: string }[];
      targetAudience?: string;
    };
    const campaignId = parsed.campaignId ?? "campaign-run";
    const productCount = parsed.products?.length ?? 0;
    const audience = parsed.targetAudience ?? "General audience";
    return `Generate ${productCount || 2} product creatives for ${campaignId} targeting ${audience}.`;
  } catch {
    return "Generate campaign creatives from the current brief and assets.";
  }
}

export function getFileFingerprint(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function buildBriefFromSimpleForm(simpleForm: SimpleBriefForm) {
  const products = simpleForm.products.map((product) => {
    const normalizedName = product.name.trim();
    const computedId = product.id.trim() || toKebabCase(normalizedName);
    return {
      id: computedId || "product",
      name: normalizedName || "Untitled Product",
      keyBenefits: splitCsv(product.benefitsCsv),
    };
  });

  return {
    campaignId: simpleForm.campaignId.trim() || "campaign-run",
    market: {
      region: simpleForm.region.trim() || "LATAM",
      country: simpleForm.country.trim() || undefined,
      language: simpleForm.language.trim() || undefined,
    },
    targetAudience: simpleForm.targetAudience.trim() || "General audience",
    products,
    campaignMessage: simpleForm.campaignMessage.trim() || "Launch campaign creative.",
    channels: ["instagram", "facebook"],
    requiredAspectRatios: ["1:1", "9:16", "16:9"],
    brand: {
      primaryColors: splitCsv(simpleForm.primaryColorsCsv),
      logoRequired: true,
      voice: simpleForm.brandVoice.trim() || undefined,
      forbiddenWords: splitCsv(simpleForm.forbiddenWordsCsv),
    },
  };
}
