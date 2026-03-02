import { trustBadgeClass } from "@/app/page.helpers";
import type { ApiResult } from "@/app/page.types";

type RunSummaryCardProps = {
  result: ApiResult;
  downloadingZip: boolean;
  downloadError: string | null;
  onDownloadOutputs: () => void;
};

export function RunSummaryCard({
  result,
  downloadingZip,
  downloadError,
  onDownloadOutputs,
}: RunSummaryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          A
        </span>
        <div className="w-full">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run summary</p>
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
              onClick={onDownloadOutputs}
              disabled={downloadingZip}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingZip ? "Preparing ZIP..." : "Download all outputs (.zip)"}
            </button>
            {downloadError ? <p className="text-xs text-red-600">{downloadError}</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
