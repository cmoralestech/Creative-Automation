import type { ApiResult, BriefChatMessage } from "@/app/page.types";
import { RunCard } from "@/app/components/home/RunCard";
import { RunSummaryCard } from "@/app/components/home/RunSummaryCard";

type ChatTimelineProps = {
  briefChatMessages: BriefChatMessage[];
  briefChatLoading: boolean;
  submitting: boolean;
  currentRequestSummary: string;
  progressStep: string | null;
  result: ApiResult | null;
  downloadingZip: boolean;
  downloadError: string | null;
  onDownloadOutputs: () => void;
};

export function ChatTimeline({
  briefChatMessages,
  briefChatLoading,
  submitting,
  currentRequestSummary,
  progressStep,
  result,
  downloadingZip,
  downloadError,
  onDownloadOutputs,
}: ChatTimelineProps) {
  return (
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
            <RunCard key={run.productId} run={run} />
          ))}
          <RunSummaryCard
            result={result}
            downloadingZip={downloadingZip}
            downloadError={downloadError}
            onDownloadOutputs={onDownloadOutputs}
          />
        </>
      ) : null}
    </div>
  );
}
