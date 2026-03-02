import { useState } from "react";

import { DEFAULT_ASSET_METADATA } from "@/app/page.constants";
import { getFileFingerprint } from "@/app/page.helpers";
import type { BriefChatModel } from "@/app/api/brief-chat/types";
import type { ApiResult, AssetMetadata } from "@/app/page.types";

type GenerateParams = {
  briefPayload: string;
  model: BriefChatModel;
  files: File[];
  assetMetadataByKey: Record<string, AssetMetadata>;
};

export function useGenerationRun() {
  const [submitting, setSubmitting] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function generate({ briefPayload, model, files, assetMetadataByKey }: GenerateParams) {
    setError(null);
    setSubmitting(true);
    setResult(null);
    setProgressStep("Validating brief...");
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const payload = new FormData();
      payload.set("brief", briefPayload);
      payload.set("model", model);
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
      }, 2000);

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

  async function downloadOutputs() {
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

  function reset() {
    setSubmitting(false);
    setProgressStep(null);
    setError(null);
    setDownloadError(null);
    setResult(null);
  }

  return {
    submitting,
    downloadingZip,
    progressStep,
    error,
    downloadError,
    result,
    generate: (params: GenerateParams) => {
      void generate(params);
    },
    downloadOutputs: () => {
      void downloadOutputs();
    },
    reset,
  };
}
