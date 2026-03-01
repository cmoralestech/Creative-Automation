"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BriefChatModel,
  BriefChatResponseDto,
} from "@/app/api/brief-chat/types";
import { ChatComposer } from "@/app/components/home/ChatComposer";
import { ChatTimeline } from "@/app/components/home/ChatTimeline";
import { SidebarPanel } from "@/app/components/home/SidebarPanel";
import {
  DEFAULT_ASSET_METADATA,
  defaultBrief,
  defaultSimpleForm,
  initialBriefChatMessage,
  MAX_CHAT_ASSETS,
} from "@/app/page.constants";
import {
  buildBriefFromSimpleForm,
  getFileFingerprint,
  summarizeRequest,
} from "@/app/page.helpers";
import type {
  ApiResult,
  AssetMetadata,
  BriefChatMessage,
  InputMode,
  SimpleBriefForm,
  SimpleProductForm,
} from "@/app/page.types";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("simple");
  const [briefText, setBriefText] = useState(defaultBrief);
  const [briefFileName, setBriefFileName] = useState<string | null>(null);
  const [simpleForm, setSimpleForm] = useState<SimpleBriefForm>(defaultSimpleForm);
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

  const simplePreviewJson = JSON.stringify(buildBriefFromSimpleForm(simpleForm), null, 2);
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
          if (current === "Validating brief...") return "Checking web search context (if enabled)...";
          if (current === "Checking web search context (if enabled)...") return "Retrieving context (RAG-lite)...";
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

      const body = (await response.json()) as BriefChatResponseDto & { error?: string };
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

  function handleClearChat() {
    setBriefChatMessages([{ ...initialBriefChatMessage, id: `assistant-intro-${Date.now()}` }]);
    setBriefChatInput("");
    setPendingGeneratedBrief(null);
    setBriefChatLoading(false);
    setResult(null);
    setError(null);
    setDownloadError(null);
    setProgressStep(null);
  }

  return (
    <main className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <SidebarPanel
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          simpleForm={simpleForm}
          onSimpleFieldChange={updateSimpleField}
          onSimpleProductChange={updateSimpleProduct}
          simplePreviewJson={simplePreviewJson}
          briefText={briefText}
          onBriefTextChange={setBriefText}
          briefFileName={briefFileName}
          onBriefFileChange={handleBriefFileChange}
          files={files}
          fileNames={fileNames}
          onAssetsSelected={appendSelectedAssets}
          error={error}
          submitting={submitting}
          progressStep={progressStep}
          onGenerate={() => void handleGenerate()}
        />

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
                {result ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                    Web search: {result.webSearch.enabled ? `${result.webSearch.resultCount} hits` : "off"}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear chat
                </button>
              </div>
            </div>
          </header>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatTimeline
              briefChatMessages={briefChatMessages}
              briefChatLoading={briefChatLoading}
              submitting={submitting}
              currentRequestSummary={currentRequestSummary}
              progressStep={progressStep}
              result={result}
              downloadingZip={downloadingZip}
              downloadError={downloadError}
              onDownloadOutputs={handleDownloadOutputs}
            />

            <ChatComposer
              briefChatModel={briefChatModel}
              onBriefChatModelChange={setBriefChatModel}
              briefChatLoading={briefChatLoading}
              briefChatInput={briefChatInput}
              onBriefChatInputChange={setBriefChatInput}
              onBriefChatSubmit={() => void handleBriefChatSubmit()}
              onAssetsSelected={appendSelectedAssets}
              pendingGeneratedBrief={pendingGeneratedBrief}
              submitting={submitting}
              onGenerateFromLatestDraft={() => {
                if (pendingGeneratedBrief) {
                  void handleGenerate(pendingGeneratedBrief);
                }
              }}
              files={files}
              assetPreviewUrls={assetPreviewUrls}
              assetMetadataByKey={assetMetadataByKey}
              productIdOptions={productIdOptions}
              onRemoveAsset={removeAssetAt}
              onClearAssets={() => {
                setFiles([]);
                setAssetMetadataByKey({});
                setAssetNotice(null);
              }}
              onUpdateAssetMetadata={updateAssetMetadata}
              assetNotice={assetNotice}
            />
          </section>
        </div>
        </div>
      </main>
  );
}
