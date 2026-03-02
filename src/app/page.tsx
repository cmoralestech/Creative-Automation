"use client";

import { ChatComposer } from "@/app/components/home/ChatComposer";
import { ChatTimeline } from "@/app/components/home/ChatTimeline";
import { useAssetComposer } from "@/app/hooks/useAssetComposer";
import { useBriefChat } from "@/app/hooks/useBriefChat";
import { useBriefEditor } from "@/app/hooks/useBriefEditor";
import { useGenerationRun } from "@/app/hooks/useGenerationRun";
import { SidebarPanel } from "@/app/components/home/SidebarPanel";
import { useContextLibrary } from "@/app/hooks/useContextLibrary";
import type { ChatComposerViewModel } from "@/app/page.types";

export default function Home() {
  const assetComposer = useAssetComposer();
  const briefEditor = useBriefEditor();
  const contextLibrary = useContextLibrary();
  const generationRun = useGenerationRun();
  const briefChat = useBriefChat({
    onGenerated: ({ briefText: nextBriefText, simpleForm: nextSimpleForm }) => {
      briefEditor.applyGeneratedBrief(nextBriefText, nextSimpleForm);
    },
  });

  const totalOutputs = generationRun.result
    ? generationRun.result.productRuns.reduce((sum, run) => sum + run.outputs.length, 0)
    : 0;
  const publishReadyOutputs = generationRun.result
    ? generationRun.result.productRuns.reduce(
        (sum, run) => sum + run.outputs.filter((output) => output.compliance.publishReady).length,
        0,
      )
    : 0;

  function handleGenerate(briefOverride?: string) {
    briefEditor.clearError();
    generationRun.generate({
      briefPayload: briefOverride ?? briefEditor.activeBriefPayload,
      model: briefChat.briefChatModel,
      files: assetComposer.files,
      assetMetadataByKey: assetComposer.assetMetadataByKey,
    });
  }

  function handleClearChat() {
    briefChat.clearBriefChat();
    generationRun.reset();
    briefEditor.clearError();
  }

  const chatComposerModel: ChatComposerViewModel = {
    briefChatModel: briefChat.briefChatModel,
    setBriefChatModel: briefChat.setBriefChatModel,
    briefChatLoading: briefChat.briefChatLoading,
    briefChatInput: briefChat.briefChatInput,
    setBriefChatInput: briefChat.setBriefChatInput,
    submitBriefChat: briefChat.submitBriefChat,
    pendingGeneratedBrief: briefChat.pendingGeneratedBrief,
    submitting: generationRun.submitting,
    generateFromLatestDraft: () => {
      if (briefChat.pendingGeneratedBrief) {
        handleGenerate(briefChat.pendingGeneratedBrief);
      }
    },
    files: assetComposer.files,
    assetPreviewUrls: assetComposer.assetPreviewUrls,
    assetMetadataByKey: assetComposer.assetMetadataByKey,
    productIdOptions: briefEditor.productIdOptions,
    removeAsset: assetComposer.removeAssetAt,
    clearAssets: assetComposer.clearAssets,
    updateAssetMetadata: assetComposer.updateAssetMetadata,
    appendAssets: assetComposer.appendSelectedAssets,
    assetNotice: assetComposer.assetNotice,
  };

  return (
    <main className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <SidebarPanel
          inputMode={briefEditor.inputMode}
          onInputModeChange={briefEditor.setInputMode}
          simpleForm={briefEditor.simpleForm}
          onSimpleFieldChange={briefEditor.updateSimpleField}
          onSimpleProductChange={briefEditor.updateSimpleProduct}
          simplePreviewJson={briefEditor.simplePreviewJson}
          briefText={briefEditor.briefText}
          onBriefTextChange={briefEditor.setBriefText}
          briefFileName={briefEditor.briefFileName}
          onBriefFileChange={briefEditor.loadBriefFile}
          files={assetComposer.files}
          fileNames={assetComposer.fileNames}
          onAssetsSelected={assetComposer.appendSelectedAssets}
          contextLibrary={contextLibrary}
          error={briefEditor.error ?? generationRun.error}
          submitting={generationRun.submitting}
          progressStep={generationRun.progressStep}
          onGenerate={() => handleGenerate()}
        />

        <div className="flex min-w-0 flex-1 flex-col h-full">
          <header className="h-16 shrink-0 border-b border-slate-200 bg-white/95 px-6">
            <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Workspace</span>
                <span className={`rounded-full border px-2.5 py-1 font-medium ${generationRun.submitting ? "border-indigo-300 bg-indigo-50 text-indigo-700" : generationRun.result ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                  {generationRun.submitting ? "Processing" : generationRun.result ? "Last run complete" : "Ready"}
                </span>
                <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Model: {briefChat.briefChatModel}
                </span>
                {generationRun.result ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                    Publish-ready: {publishReadyOutputs}/{totalOutputs}
                  </span>
                ) : null}
                {generationRun.result ? (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700">
                    Web search: {generationRun.result.webSearch.enabled ? `${generationRun.result.webSearch.resultCount} hits` : "off"}
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
              briefChatMessages={briefChat.briefChatMessages}
              briefChatLoading={briefChat.briefChatLoading}
              submitting={generationRun.submitting}
              currentRequestSummary={briefEditor.currentRequestSummary}
              progressStep={generationRun.progressStep}
              result={generationRun.result}
              downloadingZip={generationRun.downloadingZip}
              downloadError={generationRun.downloadError}
              onDownloadOutputs={generationRun.downloadOutputs}
            />

            <ChatComposer composer={chatComposerModel} />
          </section>
        </div>
        </div>
      </main>
  );
}
