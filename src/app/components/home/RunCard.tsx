import Image from "next/image";

import { trustBadgeClass } from "@/app/page.helpers";
import type { ApiResult } from "@/app/page.types";

type RunCardProps = {
  run: ApiResult["productRuns"][number];
};

export function RunCard({ run }: RunCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          A
        </span>
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{run.productName}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                run.governance.publishReady
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              {run.governance.publishReady ? "publish-ready" : "review required"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full border px-2 py-1 ${trustBadgeClass(run.generation.copy.source)}`}
            >
              Copy: {run.generation.copy.source}
            </span>
            <span
              className={`rounded-full border px-2 py-1 ${trustBadgeClass(run.generation.image.source)}`}
            >
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
                    output.compliance.publishReady ? "text-emerald-700" : "text-amber-700"
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
  );
}
