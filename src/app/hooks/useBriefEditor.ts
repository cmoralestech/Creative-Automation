import { useMemo, useState } from "react";

import { defaultBrief, defaultSimpleForm } from "@/app/page.constants";
import { buildBriefFromSimpleForm, summarizeRequest } from "@/app/page.helpers";
import type { InputMode, SimpleBriefForm, SimpleProductForm } from "@/app/page.types";

export function useBriefEditor() {
  const [inputMode, setInputMode] = useState<InputMode>("simple");
  const [briefText, setBriefText] = useState(defaultBrief);
  const [briefFileName, setBriefFileName] = useState<string | null>(null);
  const [simpleForm, setSimpleForm] = useState<SimpleBriefForm>(defaultSimpleForm);
  const [error, setError] = useState<string | null>(null);

  const simplePreviewJson = useMemo(
    () => JSON.stringify(buildBriefFromSimpleForm(simpleForm), null, 2),
    [simpleForm],
  );

  const activeBriefPayload = inputMode === "simple" ? simplePreviewJson : briefText;
  const currentRequestSummary = useMemo(
    () => summarizeRequest(activeBriefPayload),
    [activeBriefPayload],
  );

  const productIdOptions = useMemo(() => {
    try {
      const parsed = JSON.parse(activeBriefPayload) as {
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
  }, [activeBriefPayload]);

  async function loadBriefFile(file: File | null) {
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

  function applyGeneratedBrief(nextBriefText: string, nextSimpleForm: SimpleBriefForm) {
    setBriefText(nextBriefText);
    setInputMode("json");
    setBriefFileName("Generated from workspace chat");
    setSimpleForm(nextSimpleForm);
  }

  function clearError() {
    setError(null);
  }

  return {
    inputMode,
    setInputMode,
    briefText,
    setBriefText,
    briefFileName,
    simpleForm,
    simplePreviewJson,
    activeBriefPayload,
    currentRequestSummary,
    productIdOptions,
    error,
    clearError,
    loadBriefFile,
    updateSimpleField,
    updateSimpleProduct,
    applyGeneratedBrief,
  };
}
