import type { ChangeEvent } from "react";
import Image from "next/image";

import {
  briefChatModelOptions,
  DEFAULT_ASSET_METADATA,
  MAX_CHAT_ASSETS,
} from "@/app/page.constants";
import { getFileFingerprint } from "@/app/page.helpers";
import type { AssetMetadata, AssetRole } from "@/app/page.types";
import type { BriefChatModel } from "@/app/api/brief-chat/types";

type ProductIdOption = {
  id: string;
  name: string;
};

type ChatComposerProps = {
  briefChatModel: BriefChatModel;
  onBriefChatModelChange: (model: BriefChatModel) => void;
  briefChatLoading: boolean;
  briefChatInput: string;
  onBriefChatInputChange: (value: string) => void;
  onBriefChatSubmit: () => void;
  onAssetsSelected: (incomingFiles: File[]) => void;
  pendingGeneratedBrief: string | null;
  submitting: boolean;
  onGenerateFromLatestDraft: () => void;
  files: File[];
  assetPreviewUrls: { key: string; name: string; url: string }[];
  assetMetadataByKey: Record<string, AssetMetadata>;
  productIdOptions: ProductIdOption[];
  onRemoveAsset: (index: number) => void;
  onClearAssets: () => void;
  onUpdateAssetMetadata: (index: number, next: Partial<AssetMetadata>) => void;
  assetNotice: string | null;
};

export function ChatComposer({
  briefChatModel,
  onBriefChatModelChange,
  briefChatLoading,
  briefChatInput,
  onBriefChatInputChange,
  onBriefChatSubmit,
  onAssetsSelected,
  pendingGeneratedBrief,
  submitting,
  onGenerateFromLatestDraft,
  files,
  assetPreviewUrls,
  assetMetadataByKey,
  productIdOptions,
  onRemoveAsset,
  onClearAssets,
  onUpdateAssetMetadata,
  assetNotice,
}: ChatComposerProps) {
  function handleAssetUpload(event: ChangeEvent<HTMLInputElement>) {
    onAssetsSelected(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  return (
    <div className="px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-2 flex items-center justify-end gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Model
          </label>
          <select
            value={briefChatModel}
            onChange={(event) => onBriefChatModelChange(event.target.value as BriefChatModel)}
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
            onChange={(event) => onBriefChatInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onBriefChatSubmit();
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
            onChange={handleAssetUpload}
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
              onClick={onBriefChatSubmit}
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
              onClick={onGenerateFromLatestDraft}
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
                onClick={onClearAssets}
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
                      {assetPreviewUrls[index]?.url ? (
                        <Image
                          src={assetPreviewUrls[index].url}
                          alt={file.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                      <p className="text-[11px] text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAsset(index)}
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
                            onUpdateAssetMetadata(index, {
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
                            onUpdateAssetMetadata(index, {
                              productId: event.target.value,
                            })
                          }
                          disabled={
                            (assetMetadataByKey[getFileFingerprint(file)] ?? DEFAULT_ASSET_METADATA).role !==
                            "product"
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
                          onUpdateAssetMetadata(index, {
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
  );
}
