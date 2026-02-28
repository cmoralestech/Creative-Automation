import path from "node:path";
import { performance } from "node:perf_hooks";

import { GenerationSource, OpenAIClient } from "@/adapters/openaiClient";
import { ASPECT_RATIO_DIMENSIONS, CampaignBrief } from "@/domain/campaignBrief";
import { buildRagIndex } from "@/rag/indexer";
import { retrieveContextWithOptions } from "@/rag/retriever";
import {
  buildVisualContextForProduct,
  buildDefaultLogoAsset,
  findLogoAsset,
  findProductAsset,
  UploadedAssetDto,
} from "@/services/assetService";
import {
  evaluateCopyCompliance,
  evaluateColorCompliance,
  evaluateLogoCompliance,
} from "@/services/brandCompliance";
import { composeCreative } from "@/services/creativeComposer";
import { writeCreative, writeRunReport } from "@/services/outputWriter";
import { buildCopyPrompt, buildImagePrompt } from "@/services/promptBuilder";

export type ProductRunDto = {
  productId: string;
  productName: string;
  usedExistingAsset: boolean;
  generatedCopy: string;
  generation: {
    copy: {
      source: GenerationSource;
      reason: string | null;
    };
    image: {
      source: GenerationSource | "uploaded";
      reason: string | null;
    };
  };
  retrievedContext: {
    source: string;
    score: number;
    text: string;
    signals?: {
      mode: "lexical" | "semantic" | "hybrid";
      lexical: number;
      semantic: number;
      phrase: number;
      density: number;
      intent: number;
    };
  }[];
  retrievedContextFilters?: {
    sourceTypes?: Array<"brand" | "market" | "other">;
    metadata?: {
      region?: string;
      country?: string;
      language?: string;
      productId?: string;
      productName?: string;
      terms?: string[];
    };
  };
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
};

export type PipelineResultDto = {
  campaignId: string;
  mode: "mock" | "live";
  reportPath: string;
  outputRoot: string;
  durationMs: number;
  runSummary: {
    text: string;
    source: GenerationSource;
    reason: string | null;
  };
  productRuns: ProductRunDto[];
};

export async function runPipeline({
  brief,
  uploadedAssets,
  workspaceRoot,
  textModel = "gpt-4.1-mini",
}: {
  brief: CampaignBrief;
  uploadedAssets: UploadedAssetDto[];
  workspaceRoot: string;
  textModel?: string;
}): Promise<PipelineResultDto> {
  const startedAt = performance.now();
  const client = new OpenAIClient();

  const ragIndex = await buildRagIndex([
    path.join(workspaceRoot, "context", "brand"),
    path.join(workspaceRoot, "context", "market"),
  ]);

  const logoAsset =
    findLogoAsset(uploadedAssets) ??
    (brief.brand.logoRequired ? buildDefaultLogoAsset(brief.brand.primaryColors?.[0]) : null);

  // Process all products in parallel for 2-3x speed improvement
  const runs = await Promise.all(
    brief.products.map(async (product) => {
      const productAsset = findProductAsset(product, uploadedAssets);
      const query = [
        brief.market.region,
        brief.market.country,
        brief.market.language,
        brief.targetAudience,
        product.name,
        ...product.keyBenefits,
        brief.campaignMessage,
        brief.brand.voice ?? "",
        ...(brief.brand.primaryColors ?? []),
      ]
        .filter(Boolean)
        .join(" ");

      const retrievalFilters: ProductRunDto["retrievedContextFilters"] = {
        metadata: {
          region: brief.market.region,
          country: brief.market.country,
          language: brief.market.language,
          productId: product.id,
          productName: product.name,
          terms: product.keyBenefits.slice(0, 3),
        },
      };

      const ragMatches = retrieveContextWithOptions(ragIndex, query, {
        topK: 4,
        sourceTypes: retrievalFilters.sourceTypes,
        metadata: retrievalFilters.metadata,
      });
      const visualContext = buildVisualContextForProduct(product, uploadedAssets);

      const copyPrompt = buildCopyPrompt(brief, product, ragMatches, visualContext);
      const copyResult = await client.generateCopy(copyPrompt, textModel);
      const generatedCopy = copyResult.text;
      const copyCompliance = evaluateCopyCompliance(generatedCopy, brief.brand.forbiddenWords);

      let baseImage = productAsset?.buffer;
      let imageSource: ProductRunDto["generation"]["image"]["source"] = "uploaded";
      let imageReason: string | null = null;

      if (!baseImage) {
        const imageResult = await client.generateImage(
          buildImagePrompt(brief, product, ragMatches, visualContext),
        );
        baseImage = imageResult.image;
        imageSource = imageResult.source;
        imageReason = imageResult.reason;
      }

      const outputs: ProductRunDto["outputs"] = [];
      const productBlockedReasons = new Set<string>();

      if (!copyCompliance.passed) {
        productBlockedReasons.add("copy-compliance-failed");
      }

      for (const ratio of brief.requiredAspectRatios) {
        let composed = await composeCreative({
          baseImage,
          aspectRatio: ratio,
          campaignText: generatedCopy || brief.campaignMessage,
          logoImage: logoAsset?.buffer ?? null,
          brandTintColor: brief.brand.primaryColors?.[0] ?? null,
          brandTintOpacity: 0.16,
        });

        let colorCompliance = await evaluateColorCompliance(
          composed.image,
          brief.brand.primaryColors,
        );

        if (
          !colorCompliance.passed &&
          !productAsset &&
          (brief.brand.primaryColors?.length ?? 0) > 0
        ) {
          composed = await composeCreative({
            baseImage,
            aspectRatio: ratio,
            campaignText: generatedCopy || brief.campaignMessage,
            logoImage: logoAsset?.buffer ?? null,
            brandTintColor: brief.brand.primaryColors?.[0] ?? null,
            brandTintOpacity: 0.28,
          });
          colorCompliance = await evaluateColorCompliance(composed.image, brief.brand.primaryColors);
        }

        const logoPassed = evaluateLogoCompliance(brief.brand.logoRequired, composed.logoPlaced);

        const outputBlockedReasons: string[] = [];
        if (!copyCompliance.passed) {
          outputBlockedReasons.push("copy-compliance-failed");
        }
        if (!logoPassed) {
          outputBlockedReasons.push("logo-missing");
        }
        if (!colorCompliance.passed) {
          outputBlockedReasons.push("brand-color-distance");
        }

        for (const blockedReason of outputBlockedReasons) {
          productBlockedReasons.add(blockedReason);
        }

        const writtenPath = await writeCreative({
          rootDir: workspaceRoot,
          campaignId: brief.campaignId,
          productId: product.id,
          aspectRatio: ratio,
          image: composed.image,
        });

        outputs.push({
          aspectRatio: ratio,
          width: ASPECT_RATIO_DIMENSIONS[ratio].width,
          height: ASPECT_RATIO_DIMENSIONS[ratio].height,
          filePath: writtenPath,
          previewBase64: composed.image.toString("base64"),
          compliance: {
            logoPassed,
            colorPassed: colorCompliance.passed,
            closestColor: colorCompliance.closestColor,
            colorDistance: colorCompliance.minDistance,
            publishReady: outputBlockedReasons.length === 0,
            blockedReasons: outputBlockedReasons,
          },
        });
      }

      return {
        productId: product.id,
        productName: product.name,
        usedExistingAsset: Boolean(productAsset),
        generatedCopy,
        generation: {
          copy: {
            source: copyResult.source,
            reason: copyResult.reason,
          },
          image: {
            source: imageSource,
            reason: imageReason,
          },
        },
        legal: {
          copyPassed: copyCompliance.passed,
          flaggedWords: copyCompliance.flaggedWords,
        },
        governance: {
          publishReady: productBlockedReasons.size === 0,
          blockedReasons: Array.from(productBlockedReasons),
        },
        retrievedContext: ragMatches.map((match) => ({
          source: match.source,
          score: match.score,
          text: match.text,
          signals: match.signals,
        })),
        retrievedContextFilters: retrievalFilters,
        outputs,
      };
    }),
  );

  const durationMs = Math.round(performance.now() - startedAt);
  const totalOutputs = runs.reduce((sum, run) => sum + run.outputs.length, 0);
  const publishReadyOutputCount = runs.reduce(
    (sum, run) => sum + run.outputs.filter((output) => output.compliance.publishReady).length,
    0,
  );
  const productReviewRequiredCount = runs.filter((run) => !run.governance.publishReady).length;

  const fallbackSummary =
    publishReadyOutputCount === totalOutputs
      ? `Generated ${totalOutputs} outputs across ${runs.length} products for ${brief.campaignId}; all outputs are publish-ready.`
      : `Generated ${totalOutputs} outputs across ${runs.length} products for ${brief.campaignId}; ${publishReadyOutputCount} are publish-ready and ${productReviewRequiredCount} product runs need review.`;

  const runSummaryPrompt = [
    "Summarize this campaign generation run for a human reviewer.",
    `Campaign ID: ${brief.campaignId}`,
    `Market: ${brief.market.region}${brief.market.country ? `/${brief.market.country}` : ""}`,
    `Target audience: ${brief.targetAudience}`,
    `Products: ${runs.map((run) => run.productName).join(", ")}`,
    `Outputs total: ${totalOutputs}`,
    `Publish-ready outputs: ${publishReadyOutputCount}/${totalOutputs}`,
    `Product runs needing review: ${productReviewRequiredCount}`,
    `Duration ms: ${durationMs}`,
    `Blocked reasons: ${Array.from(new Set(runs.flatMap((run) => run.governance.blockedReasons))).join(", ") || "none"}`,
    "Write 2-3 sentences. Mention one positive outcome and one next action if review is needed.",
  ].join("\n");

  const runSummary = await client.generateRunSummary(runSummaryPrompt, fallbackSummary, textModel);

  const report = {
    campaignId: brief.campaignId,
    mode: client.isMockMode() ? "mock" : "live",
    market: brief.market,
    targetAudience: brief.targetAudience,
    stats: {
      productCount: brief.products.length,
      outputCount: totalOutputs,
      publishReadyOutputCount,
      durationMs,
    },
    runSummary,
    productRuns: runs,
  };

  const reportPath = await writeRunReport(workspaceRoot, brief.campaignId, report);

  return {
    campaignId: brief.campaignId,
    mode: client.isMockMode() ? "mock" : "live",
    reportPath,
    outputRoot: path.join(workspaceRoot, "outputs", brief.campaignId),
    durationMs,
    runSummary,
    productRuns: runs,
  };
}
