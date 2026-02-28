"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ApiResult = {
  campaignId: string;
  mode: "mock" | "live";
  reportPath: string;
  outputRoot: string;
  durationMs: number;
  runSummary: {
    text: string;
    source: "live" | "mock" | "fallback";
    reason: string | null;
  };
  productRuns: {
    productId: string;
    productName: string;
    usedExistingAsset: boolean;
    generatedCopy: string;
    generation: {
      copy: {
        source: "live" | "mock" | "fallback";
        reason: string | null;
      };
      image: {
        source: "live" | "mock" | "fallback" | "uploaded";
        reason: string | null;
      };
    };
    retrievedContext: { source: string; score: number; text: string }[];
    legal: {
      copyPassed: boolean;
      flaggedWords: string[];
    };
    governance: {
      publishReady: boolean;
      blockedReasons: string[];
    };
    outputs: {
      aspectRatio: string;
      width: number;
      height: number;
      filePath: string;
      previewBase64: string;
      compliance: {
        logoPassed: boolean;
        colorPassed: boolean;
        closestColor: string | null;
        colorDistance: number | null;
        publishReady: boolean;
        blockedReasons: string[];
      };
    }[];
  }[];
};

type BriefChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type BriefChatResponse = {
  brief: unknown;
  source: "live" | "mock" | "fallback";
  model: "gpt-4.1-mini" | "gpt-4.1" | "gpt-4o";
  repaired: boolean;
  reason: string | null;
};

type AssetRole = "logo" | "product" | "reference" | "unknown";

type AssetMetadata = {
  role: AssetRole;
  productId: string;
  semanticHint: string;
};

const briefChatModelOptions = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
] as const;

const initialBriefChatMessage: BriefChatMessage = {
  id: "assistant-intro",
  role: "assistant",
  text: "Describe the campaign you want, and I will draft valid campaign brief JSON for this workspace.",
};

type BriefChatModel = (typeof briefChatModelOptions)[number]["value"];

const MAX_CHAT_ASSETS = 2;

const defaultBrief = `{
  "campaignId": "spring-sportswear-2026",
  "market": {
    "region": "NA",
    "country": "US",
    "language": "en-US"
  },
  "targetAudience": "Active adults 20-40 who run or train regularly",
  "products": [
    {
      "id": "running-socks",
      "name": "Running Socks",
      "keyBenefits": ["Moisture-wicking", "Arch support", "All-day comfort"]
    },
    {
      "id": "tennis-shoes",
      "name": "Tennis Shoes",
      "keyBenefits": ["Responsive cushioning", "Lightweight feel", "Durable outsole"]
    }
  ],
  "campaignMessage": "Train stronger with lightweight sportswear built for everyday performance.",
  "channels": ["instagram", "facebook"],
  "requiredAspectRatios": ["1:1", "9:16", "16:9"],
  "brand": {
    "primaryColors": ["#0057B8", "#00A3E0"],
    "logoRequired": true,
    "voice": "Bold, optimistic, and practical",
    "forbiddenWords": ["cure", "guaranteed"]
  }
}`;

type InputMode = "simple" | "json";

type SimpleProductForm = {
  id: string;
  name: string;
  benefitsCsv: string;
};

type SimpleBriefForm = {
  campaignId: string;
  region: string;
  country: string;
  language: string;
  targetAudience: string;
  campaignMessage: string;
  brandVoice: string;
  primaryColorsCsv: string;
  forbiddenWordsCsv: string;
  products: [SimpleProductForm, SimpleProductForm];
};

function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitCsv(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function trustBadgeClass(source: "live" | "mock" | "fallback" | "uploaded"): string {
  if (source === "live" || source === "uploaded") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (source === "fallback") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function summarizeRequest(briefText: string): string {
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

function getFileFingerprint(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const DEFAULT_ASSET_METADATA: AssetMetadata = {
  role: "unknown",
  productId: "",
  semanticHint: "",
};

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("simple");
  const [briefText, setBriefText] = useState(defaultBrief);
  const [briefFileName, setBriefFileName] = useState<string | null>(null);
  const [simpleForm, setSimpleForm] = useState<SimpleBriefForm>({
    campaignId: "spring-sportswear-2026",
    region: "NA",
    country: "US",
    language: "en-US",
    targetAudience: "Active adults 20-40 who run or train regularly",
    campaignMessage: "Train stronger with lightweight sportswear built for everyday performance.",
    brandVoice: "Bold, optimistic, and practical",
    primaryColorsCsv: "#0057B8, #00A3E0",
    forbiddenWordsCsv: "cure, guaranteed",
    products: [
      {
        id: "running-socks",
        name: "Running Socks",
        benefitsCsv: "Moisture-wicking, Arch support, All-day comfort",
      },
      {
        id: "tennis-shoes",
        name: "Tennis Shoes",
        benefitsCsv: "Responsive cushioning, Lightweight feel, Durable outsole",
      },
    ],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [assetMetadataByKey, setAssetMetadataByKey] = useState<Record<string, AssetMetadata>>({});
  const [submitting, setSubmitting] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetNotice, setAssetNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [briefChatInput, setBriefChatInput] = useState("");
  const [briefChatModel, setBriefChatModel] = useState<BriefChatModel>("gpt-4.1-mini");
  const [briefChatLoading, setBriefChatLoading] = useState(false);
  const [pendingGeneratedBrief, setPendingGeneratedBrief] = useState<string | null>(null);
  const [briefChatMessages, setBriefChatMessages] = useState<BriefChatMessage[]>([
    initialBriefChatMessage,
  ]);
  const [result, setResult] = useState<ApiResult | null>(null);

  const fileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);
  const assetPreviewUrls = useMemo(
    () => files.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
    })),
    [files],
  );

  useEffect(() => {
    return () => {
      assetPreviewUrls.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [assetPreviewUrls]);

  function buildBriefFromSimpleForm() {
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

  const simplePreviewJson = JSON.stringify(buildBriefFromSimpleForm(), null, 2);
  const productIdOptions = useMemo(() => {
    try {
      const parsed = JSON.parse(inputMode === "simple" ? simplePreviewJson : briefText) as {
        products?: { id?: string; name?: string }[];
      };

      return (parsed.products ?? [])
        .map((product) => ({
          id: (product.id ?? "").trim(),
          name: (product.name ?? "").trim(),
        }))
        .filter((product) => product.id.length > 0);
    } catch {
      return [];
    }
  }, [inputMode, simplePreviewJson, briefText]);
  const currentRequestSummary = summarizeRequest(inputMode === "simple" ? simplePreviewJson : briefText);
  const totalOutputs = result
    ? result.productRuns.reduce((sum, run) => sum + run.outputs.length, 0)
    : 0;
  const publishReadyOutputs = result
    ? result.productRuns.reduce(
        (sum, run) => sum + run.outputs.filter((output) => output.compliance.publishReady).length,
        0,
      )
    : 0;

  async function handleGenerate(briefOverride?: string) {
    setError(null);
    setSubmitting(true);
    setResult(null);
    setProgressStep("Validating brief...");
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const payload = new FormData();
      const briefPayload = briefOverride ?? (inputMode === "simple" ? simplePreviewJson : briefText);
      payload.set("brief", briefPayload);
      payload.set("model", briefChatModel);
      payload.set(
        "assetMetadata",
        JSON.stringify(
          files.map((file) => {
            const key = getFileFingerprint(file);
            const metadata = assetMetadataByKey[key] ?? DEFAULT_ASSET_METADATA;
            return {
              role: metadata.role,
              productId: metadata.productId.trim(),
              semanticHint: metadata.semanticHint.trim(),
            };
          }),
        ),
      );
      files.forEach((file) => payload.append("assets", file));
      // Simulate progress updates (since API is synchronous, we estimate based on time)
      progressInterval = setInterval(() => {
        setProgressStep((current) => {
          if (!current) return "Validating brief...";
          if (current === "Validating brief...") return "Retrieving context (RAG-lite)...";
          if (current === "Retrieving context (RAG-lite)...") return "Generating copy with AI...";
          if (current === "Generating copy with AI...") return "Generating images with DALL-E 3...";
          if (current === "Generating images with DALL-E 3...") return "Composing creatives...";
          if (current === "Composing creatives...") return "Running compliance checks...";
          return "Finalizing...";
        });
      }, 2000); // Update every 2 seconds for smoother progress

      const response = await fetch("/api/generate", {
        method: "POST",
        body: payload,
      });

      setProgressStep("Processing results...");

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Generation failed");
      }

      setResult(body as ApiResult);
      setProgressStep(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      setProgressStep(null);
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setSubmitting(false);
    }
  }

  async function handleDownloadOutputs() {
    if (!result) {
      return;
    }

    setDownloadError(null);
    setDownloadingZip(true);

    try {
      const response = await fetch(`/api/download/${encodeURIComponent(result.campaignId)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to download campaign outputs.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.campaignId}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Download failed.";
      setDownloadError(message);
    } finally {
      setDownloadingZip(false);
    }
  }

  async function handleBriefChatSubmit() {
    const trimmed = briefChatInput.trim();
    if (!trimmed || briefChatLoading) {
      return;
    }

    const userMessage: BriefChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setBriefChatMessages((prev) => [...prev, userMessage]);
    setBriefChatLoading(true);
    setBriefChatInput("");

    try {
      const response = await fetch("/api/brief-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request: trimmed, model: briefChatModel }),
      });

      const body = (await response.json()) as BriefChatResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to generate campaign brief JSON.");
      }

      const nextBriefText = JSON.stringify(body.brief, null, 2);
      setBriefText(nextBriefText);
      setInputMode("json");
      setBriefFileName("Generated from workspace chat");

      const parsed = body.brief as { 
        campaignId?: string; 
        market?: { region?: string; country?: string; language?: string };
        targetAudience?: string;
        campaignMessage?: string;
        brand?: { voice?: string; primaryColors?: string[]; forbiddenWords?: string[] };
        products?: { id?: string; name?: string; keyBenefits?: string[] }[];
      };

      setSimpleForm({
        campaignId: parsed.campaignId || "",
        region: parsed.market?.region || "",
        country: parsed.market?.country || "",
        language: parsed.market?.language || "",
        targetAudience: parsed.targetAudience || "",
        campaignMessage: parsed.campaignMessage || "",
        brandVoice: parsed.brand?.voice || "",
        primaryColorsCsv: parsed.brand?.primaryColors?.join(", ") || "",
        forbiddenWordsCsv: parsed.brand?.forbiddenWords?.join(", ") || "",
        products: [
          {
            id: parsed.products?.[0]?.id || "",
            name: parsed.products?.[0]?.name || "",
            benefitsCsv: parsed.products?.[0]?.keyBenefits?.join(", ") || "",
          },
          {
            id: parsed.products?.[1]?.id || "",
            name: parsed.products?.[1]?.name || "",
            benefitsCsv: parsed.products?.[1]?.keyBenefits?.join(", ") || "",
          },
        ],
      });

      const summary = `Generated valid JSON via ${body.source} (${body.model}) for ${parsed.campaignId ?? "campaign-run"} with ${parsed.products?.length ?? 0} products.`;

      setBriefChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: body.reason
            ? `${summary} Note: ${body.reason} Review the JSON, then click Generate from latest draft.`
            : `${summary} Review the JSON, then click Generate from latest draft.`,
        },
      ]);

      setPendingGeneratedBrief(nextBriefText);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown chat generation error.";
      setBriefChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: `I couldn't generate a valid brief JSON: ${message}`,
        },
      ]);
    } finally {
      setBriefChatLoading(false);
    }
  }

  async function handleBriefFileChange(file: File | null) {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      JSON.parse(text);
      setBriefText(text);
      setInputMode("json");
      setBriefFileName(file.name);
      setError(null);
    } catch {
      setError("Uploaded brief file must be valid JSON.");
    }
  }

  function updateSimpleField<K extends keyof SimpleBriefForm>(
    key: K,
    value: SimpleBriefForm[K],
  ) {
    setSimpleForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSimpleProduct(
    index: 0 | 1,
    key: keyof SimpleProductForm,
    value: string,
  ) {
    setSimpleForm((prev) => {
      const nextProducts = [...prev.products] as [SimpleProductForm, SimpleProductForm];
      nextProducts[index] = { ...nextProducts[index], [key]: value };
      return { ...prev, products: nextProducts };
    });
  }

  function removeAssetAt(indexToRemove: number) {
    setFiles((prev) => {
      const removed = prev[indexToRemove];
      const next = prev.filter((_, index) => index !== indexToRemove);
      if (removed) {
        const removedKey = getFileFingerprint(removed);
        setAssetMetadataByKey((metadata) => {
          const clone = { ...metadata };
          delete clone[removedKey];
          return clone;
        });
      }
      return next;
    });
    setAssetNotice(null);
  }

  function updateAssetMetadata(index: number, next: Partial<AssetMetadata>) {
    const file = files[index];
    if (!file) {
      return;
    }

    const key = getFileFingerprint(file);
    setAssetMetadataByKey((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? DEFAULT_ASSET_METADATA),
        ...next,
      },
    }));
  }

  function appendSelectedAssets(incomingFiles: File[]) {
    if (incomingFiles.length === 0) {
      return;
    }

    setFiles((previousFiles) => {
      const combined = [...previousFiles, ...incomingFiles];
      const uniqueFiles: File[] = [];
      const seen = new Set<string>();

      for (const file of combined) {
        const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          uniqueFiles.push(file);
        }
      }

      const limited = uniqueFiles.slice(0, MAX_CHAT_ASSETS);
      setAssetMetadataByKey((prev) => {
        const next: Record<string, AssetMetadata> = {};
        for (const file of limited) {
          const key = getFileFingerprint(file);
          next[key] = prev[key] ?? { ...DEFAULT_ASSET_METADATA };
        }
        return next;
      });
      if (uniqueFiles.length > MAX_CHAT_ASSETS) {
        setAssetNotice(`You can attach up to ${MAX_CHAT_ASSETS} images.`);
      } else {
        setAssetNotice(null);
      }

      return limited;
    });
  }

  return (
    <main className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <aside className="hidden h-full w-[320px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm">
                AI
              </span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">Creative Assistant</h1>
              </div>
            </div>
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("simple")}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium ${
                    inputMode === "simple"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Simple mode
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("json")}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium ${
                    inputMode === "json"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  JSON mode
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto p-4">

            {inputMode === "simple" ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Campaign ID
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.campaignId}
                    onChange={(event) => updateSimpleField("campaignId", event.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Region
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                      value={simpleForm.region}
                      onChange={(event) => updateSimpleField("region", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Country
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                      value={simpleForm.country}
                      onChange={(event) => updateSimpleField("country", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Language
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                      value={simpleForm.language}
                      onChange={(event) => updateSimpleField("language", event.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Target Audience
                  </label>
                  <textarea
                    className="h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.targetAudience}
                    onChange={(event) => updateSimpleField("targetAudience", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Campaign Message
                  </label>
                  <textarea
                    className="h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.campaignMessage}
                    onChange={(event) => updateSimpleField("campaignMessage", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Brand Voice
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.brandVoice}
                    onChange={(event) => updateSimpleField("brandVoice", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Primary Colors (CSV)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.primaryColorsCsv}
                    onChange={(event) => updateSimpleField("primaryColorsCsv", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                    Forbidden Words (CSV)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={simpleForm.forbiddenWordsCsv}
                    onChange={(event) => updateSimpleField("forbiddenWordsCsv", event.target.value)}
                  />
                </div>

                {([0, 1] as const).map((index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="mb-2 text-xs font-medium text-slate-600">Product {index + 1}</p>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Product Name
                    </label>
                    <input
                      className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={simpleForm.products[index].name}
                      onChange={(event) =>
                        updateSimpleProduct(index, "name", event.target.value)
                      }
                    />
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Product ID (optional)
                    </label>
                    <input
                      className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={simpleForm.products[index].id}
                      onChange={(event) => updateSimpleProduct(index, "id", event.target.value)}
                    />
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Benefits (CSV)
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={simpleForm.products[index].benefitsCsv}
                      onChange={(event) =>
                        updateSimpleProduct(index, "benefitsCsv", event.target.value)
                      }
                    />
                  </div>
                ))}

                <details className="rounded-lg border border-slate-200 bg-white p-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">
                    JSON preview (auto-generated)
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                    {simplePreviewJson}
                  </pre>
                </details>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Campaign brief (JSON)
                  </label>
                  <textarea
                    className="mt-2 h-52 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 outline-none ring-indigo-400/50 focus:ring-2"
                    value={briefText}
                    onChange={(event) => setBriefText(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Load JSON file
                  </label>
                  <input
                    id="brief-json-upload"
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => handleBriefFileChange(event.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="brief-json-upload"
                    className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Choose JSON file
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {briefFileName ? `Loaded: ${briefFileName}` : "No file loaded"}
                  </p>
                </div>
              </>
            )}

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                Assets (images/logo)
              </label>
              <input
                id="assets-upload"
                className="sr-only"
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => {
                  appendSelectedAssets(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <label
                htmlFor="assets-upload"
                className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-indigo-400 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
              >
                Choose image assets
              </label>
              <p className="mt-2 text-xs text-slate-500">
                {files.length > 0 ? `${files.length} files: ${fileNames}` : "No files selected"}
              </p>
            </div>

          </div>

          <div className="mt-auto border-t border-slate-200 p-4">
            {error ? (
              <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {submitting && progressStep ? (
              <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                <div className="flex items-center">
                  <p className="text-xs font-medium text-indigo-700">{progressStep}</p>
                </div>
              </div>
            ) : null}
            <button
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handleGenerate()}
              disabled={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col h-full">
          <header className="h-16 shrink-0 border-b border-slate-200 bg-white/95 px-6">
            <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Workspace</span>
                <span className={`rounded-full border px-2.5 py-1 font-medium ${submitting ? "border-indigo-300 bg-indigo-50 text-indigo-700" : result ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                  {submitting ? "Processing" : result ? "Last run complete" : "Ready"}
                </span>
                <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Model: {briefChatModel}
                </span>
                {result ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                    Publish-ready: {publishReadyOutputs}/{totalOutputs}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBriefChatMessages([{ ...initialBriefChatMessage, id: `assistant-intro-${Date.now()}` }]);
                    setBriefChatInput("");
                    setPendingGeneratedBrief(null);
                  }}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear chat
                </button>
              </div>
            </div>
          </header>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mx-auto w-full max-w-5xl flex-1 space-y-3 overflow-y-auto px-6 py-6">
              {briefChatMessages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-3xl rounded-2xl border p-3 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto border-indigo-200 bg-indigo-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      message.role === "user" ? "text-indigo-700" : "text-slate-500"
                    }`}
                  >
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{message.text}</p>
                </article>
              ))}

              {briefChatLoading ? (
                <article className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistant</p>
                  <p className="mt-1">Drafting valid campaign brief JSON...</p>
                </article>
              ) : null}

              {submitting ? (
                <>
                  <article className="ml-auto max-w-3xl rounded-2xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">You</p>
                    <p className="mt-1 text-sm text-slate-700">{currentRequestSummary}</p>
                  </article>

                  <article className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        A
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Working on it...</p>
                        <p className="mt-1 text-xs text-slate-600">{progressStep || "Processing request..."}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
                        </div>
                      </div>
                    </div>
                  </article>
                </>
              ) : null}

              {result ? (
                <>
                  <article className="ml-auto max-w-3xl rounded-2xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">You</p>
                    <p className="mt-1 text-sm text-slate-700">{currentRequestSummary}</p>
                  </article>

                  {result.productRuns.map((run) => (
                    <article
                      key={run.productId}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                          A
                        </span>
                        <div className="w-full">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">{run.productName}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${run.governance.publishReady ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                              {run.governance.publishReady ? "publish-ready" : "review required"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className={`rounded-full border px-2 py-1 ${trustBadgeClass(run.generation.copy.source)}`}>
                              Copy: {run.generation.copy.source}
                            </span>
                            <span className={`rounded-full border px-2 py-1 ${trustBadgeClass(run.generation.image.source)}`}>
                              Image: {run.generation.image.source}
                            </span>
                            {run.generation.copy.reason ? (
                              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-slate-600">
                                Copy reason: {run.generation.copy.reason}
                              </span>
                            ) : null}
                            {run.generation.image.reason ? (
                              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-slate-600">
                                Image reason: {run.generation.image.reason}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {run.generatedCopy}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span
                              className={`rounded-full border px-2 py-1 ${
                                run.legal.copyPassed
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-amber-300 bg-amber-50 text-amber-700"
                              }`}
                            >
                              Legal: {run.legal.copyPassed ? "pass" : "flagged"}
                            </span>
                            {!run.legal.copyPassed ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                                Blocked words: {run.legal.flaggedWords.join(", ")}
                              </span>
                            ) : null}
                            {!run.governance.publishReady ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                                Blocked by: {run.governance.blockedReasons.join(", ")}
                              </span>
                            ) : null}
                          </div>

                          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Retrieved context (RAG-lite)
                            </summary>
                            <div className="mt-2 space-y-2">
                              {run.retrievedContext.map((context, index) => (
                                <div
                                  key={`${run.productId}-${index}`}
                                  className="rounded-lg border border-slate-200 bg-white p-3"
                                >
                                  <p className="text-xs font-medium text-indigo-700">
                                    Score {context.score} - {context.source}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">{context.text}</p>
                                </div>
                              ))}
                            </div>
                          </details>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                            {run.outputs.map((output) => (
                              <div
                                key={`${run.productId}-${output.aspectRatio}`}
                                className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-2"
                              >
                                <div className="mb-2 flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-700">{output.aspectRatio}</span>
                                  <span className="text-slate-500">
                                    {output.width}x{output.height}
                                  </span>
                                </div>
                                <Image
                                  src={`data:image/png;base64,${output.previewBase64}`}
                                  alt={`${run.productName} ${output.aspectRatio}`}
                                  width={output.width}
                                  height={output.height}
                                  unoptimized
                                  className="h-40 w-full rounded-md object-cover"
                                />
                                <p className="mt-2 text-[11px] text-slate-600">
                                  logo: {output.compliance.logoPassed ? "pass" : "fail"} | color:{" "}
                                  {output.compliance.colorPassed ? "pass" : "fail"}
                                </p>
                                <p
                                  className={`mt-1 text-[11px] ${
                                    output.compliance.publishReady
                                      ? "text-emerald-700"
                                      : "text-amber-700"
                                  }`}
                                >
                                  {output.compliance.publishReady
                                    ? "publish-ready"
                                    : `blocked: ${output.compliance.blockedReasons.join(", ")}`}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}

                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        A
                      </span>
                      <div className="w-full">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Run summary
                        </p>
                        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {result.runSummary.text}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className={`rounded-full border px-2 py-0.5 ${trustBadgeClass(result.runSummary.source)}`}>
                            Summary source: {result.runSummary.source}
                          </span>
                          {result.runSummary.reason ? (
                            <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-600">
                              Note: {result.runSummary.reason}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                            Campaign: {result.campaignId}
                          </span>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 uppercase text-slate-700">
                            Mode: {result.mode}
                          </span>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                            Duration: {result.durationMs} ms
                          </span>
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                            Publish-ready: {result.productRuns.reduce(
                              (sum, run) =>
                                sum + run.outputs.filter((output) => output.compliance.publishReady).length,
                              0,
                            )}
                            /{result.productRuns.reduce((sum, run) => sum + run.outputs.length, 0)}
                          </span>
                        </div>

                        <p className="mt-3 break-all text-xs text-slate-500">
                          Output root: <span className="text-slate-700">{result.outputRoot}</span>
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleDownloadOutputs}
                            disabled={downloadingZip}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingZip ? "Preparing ZIP..." : "Download all outputs (.zip)"}
                          </button>
                          {downloadError ? (
                            <p className="text-xs text-red-600">{downloadError}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                </>
              ) : null}
            </div>

            <div className="px-6 py-4">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-2 flex items-center justify-end gap-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Model
                  </label>
                  <select
                    value={briefChatModel}
                    onChange={(event) => setBriefChatModel(event.target.value as BriefChatModel)}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                    disabled={briefChatLoading}
                  >
                    {briefChatModelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative flex items-end rounded-2xl border border-slate-200 bg-white shadow-md transition-colors focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300">
                  <textarea
                    className="max-h-32 min-h-[52px] w-full resize-none bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-500"
                    placeholder="Describe the campaign brief you want (products, market, audience, message)..."
                    value={briefChatInput}
                    onChange={(event) => setBriefChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleBriefChatSubmit();
                      }
                    }}
                    rows={1}
                  />
                  <input
                    id="assets-upload-chat-inline"
                    className="sr-only"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(event) => {
                      appendSelectedAssets(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                  />
                  <div className="flex items-center gap-2 p-2">
                    <label
                      htmlFor="assets-upload-chat-inline"
                      title="Add photos or logo"
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21.44 11.05l-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.48-8.48" />
                      </svg>
                    </label>
                    <button
                      type="button"
                      onClick={handleBriefChatSubmit}
                      disabled={briefChatLoading || !briefChatInput.trim()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 active:scale-[0.95] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                    >
                      {briefChatLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5"></line>
                          <polyline points="5 12 12 5 19 12"></polyline>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {pendingGeneratedBrief ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <p className="text-[11px] text-indigo-700">
                      Draft JSON ready. Review it in JSON mode, then generate when ready.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGenerate(pendingGeneratedBrief)}
                      disabled={submitting || briefChatLoading}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Generating..." : "Generate from latest draft"}
                    </button>
                  </div>
                ) : null}
                {files.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Attached assets ({files.length}/{MAX_CHAT_ASSETS})
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          setAssetMetadataByKey({});
                          setAssetNotice(null);
                        }}
                        className="cursor-pointer text-[11px] font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                              <img
                                src={assetPreviewUrls[index]?.url}
                                alt={file.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                              <p className="text-[11px] text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAssetAt(index)}
                              className="cursor-pointer rounded-full px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                              aria-label={`Remove ${file.name}`}
                            >
                              ×
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-1 gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[11px] text-slate-500">
                                Role
                                <select
                                  value={(assetMetadataByKey[getFileFingerprint(file)] ?? DEFAULT_ASSET_METADATA).role}
                                  onChange={(event) =>
                                    updateAssetMetadata(index, {
                                      role: event.target.value as AssetRole,
                                      productId:
                                        event.target.value === "product"
                                          ? (assetMetadataByKey[getFileFingerprint(file)]?.productId ?? "")
                                          : "",
                                    })
                                  }
                                  className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                                >
                                  <option value="unknown">Unknown (fallback)</option>
                                  <option value="logo">Logo</option>
                                  <option value="product">Product</option>
                                  <option value="reference">Reference</option>
                                </select>
                              </label>
                              <label className="text-[11px] text-slate-500">
                                Product link
                                <select
                                  value={(assetMetadataByKey[getFileFingerprint(file)] ?? DEFAULT_ASSET_METADATA).productId}
                                  onChange={(event) =>
                                    updateAssetMetadata(index, {
                                      productId: event.target.value,
                                    })
                                  }
                                  disabled={
                                    (assetMetadataByKey[getFileFingerprint(file)] ?? DEFAULT_ASSET_METADATA)
                                      .role !== "product"
                                  }
                                  className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 disabled:opacity-50"
                                >
                                  <option value="">Select product</option>
                                  {productIdOptions.map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.name ? `${product.name} (${product.id})` : product.id}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <label className="text-[11px] text-slate-500">
                              Semantic hint
                              <input
                                value={
                                  (assetMetadataByKey[getFileFingerprint(file)] ?? DEFAULT_ASSET_METADATA)
                                    .semanticHint
                                }
                                onChange={(event) =>
                                  updateAssetMetadata(index, {
                                    semanticHint: event.target.value,
                                  })
                                }
                                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                                placeholder="e.g. athlete sprinting at sunrise, city track"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {assetNotice ? (
                  <p className="mt-2 text-center text-[11px] text-amber-700">{assetNotice}</p>
                ) : null}
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Brief mode: draft JSON with chat, then click Generate from latest draft to run creatives.
                </p>
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>
  );
}
