import { GenerationSource } from "@/adapters/adapterTypes";

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
  webSearch: {
    enabled: boolean;
    resultCount: number;
  };
  runSummary: {
    text: string;
    source: GenerationSource;
    reason: string | null;
  };
  productRuns: ProductRunDto[];
};
