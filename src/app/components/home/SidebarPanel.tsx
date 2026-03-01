import type { ChangeEvent } from "react";

import type { InputMode, SimpleBriefForm, SimpleProductForm } from "@/app/page.types";

type SidebarPanelProps = {
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  simpleForm: SimpleBriefForm;
  onSimpleFieldChange: <K extends keyof SimpleBriefForm>(
    key: K,
    value: SimpleBriefForm[K],
  ) => void;
  onSimpleProductChange: (
    index: 0 | 1,
    key: keyof SimpleProductForm,
    value: string,
  ) => void;
  simplePreviewJson: string;
  briefText: string;
  onBriefTextChange: (value: string) => void;
  briefFileName: string | null;
  onBriefFileChange: (file: File | null) => Promise<void>;
  files: File[];
  fileNames: string;
  onAssetsSelected: (incomingFiles: File[]) => void;
  error: string | null;
  submitting: boolean;
  progressStep: string | null;
  onGenerate: () => void;
};

export function SidebarPanel({
  inputMode,
  onInputModeChange,
  simpleForm,
  onSimpleFieldChange,
  onSimpleProductChange,
  simplePreviewJson,
  briefText,
  onBriefTextChange,
  briefFileName,
  onBriefFileChange,
  files,
  fileNames,
  onAssetsSelected,
  error,
  submitting,
  progressStep,
  onGenerate,
}: SidebarPanelProps) {
  function handleAssetUpload(event: ChangeEvent<HTMLInputElement>) {
    onAssetsSelected(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  return (
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
              onClick={() => onInputModeChange("simple")}
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
              onClick={() => onInputModeChange("json")}
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
                onChange={(event) => onSimpleFieldChange("campaignId", event.target.value)}
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
                  onChange={(event) => onSimpleFieldChange("region", event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Country
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                  value={simpleForm.country}
                  onChange={(event) => onSimpleFieldChange("country", event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Language
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                  value={simpleForm.language}
                  onChange={(event) => onSimpleFieldChange("language", event.target.value)}
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
                onChange={(event) => onSimpleFieldChange("targetAudience", event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Campaign Message
              </label>
              <textarea
                className="h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={simpleForm.campaignMessage}
                onChange={(event) => onSimpleFieldChange("campaignMessage", event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Brand Voice
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={simpleForm.brandVoice}
                onChange={(event) => onSimpleFieldChange("brandVoice", event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Primary Colors (CSV)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={simpleForm.primaryColorsCsv}
                onChange={(event) => onSimpleFieldChange("primaryColorsCsv", event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Forbidden Words (CSV)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={simpleForm.forbiddenWordsCsv}
                onChange={(event) => onSimpleFieldChange("forbiddenWordsCsv", event.target.value)}
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
                  onChange={(event) => onSimpleProductChange(index, "name", event.target.value)}
                />
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Product ID (optional)
                </label>
                <input
                  className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={simpleForm.products[index].id}
                  onChange={(event) => onSimpleProductChange(index, "id", event.target.value)}
                />
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Benefits (CSV)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={simpleForm.products[index].benefitsCsv}
                  onChange={(event) => onSimpleProductChange(index, "benefitsCsv", event.target.value)}
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
                onChange={(event) => onBriefTextChange(event.target.value)}
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
                onChange={(event) => void onBriefFileChange(event.target.files?.[0] ?? null)}
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
            onChange={handleAssetUpload}
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
          onClick={onGenerate}
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
  );
}
