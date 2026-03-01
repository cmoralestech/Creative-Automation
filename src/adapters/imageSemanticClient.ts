import {
  ImageSemanticAnalysisDto,
  ImageSemanticInputDto,
} from "./adapterTypes";
import { sharedOpenAIClient } from "./openaiClientFactory";
import {
  buildImageSemanticHeuristic,
  mergeImageSemanticLiveVisionResult,
  parseImageSemanticLiveVisionPayload,
  tokenizeImageName,
} from "./imageSemanticUtils";

export class ImageSemanticClient {
  private readonly client: typeof sharedOpenAIClient;

  constructor() {
    this.client = sharedOpenAIClient;
  }

  private async analyzeWithLiveVision(
    input: ImageSemanticInputDto,
    heuristic: ImageSemanticAnalysisDto,
  ): Promise<ImageSemanticAnalysisDto> {
    if (!this.client) {
      throw new Error("missing-openai-api-key");
    }

    const imageDataUrl = `data:${input.mimeType || "image/png"};base64,${input.buffer.toString("base64")}`;
    const model = process.env.IMAGE_SEMANTIC_MODEL?.trim() || "gpt-4.1-mini";

    const response = await this.client.responses.create({
      model,
      temperature: 0,
      max_output_tokens: 350,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Analyze one uploaded marketing image. Return only valid JSON with keys: inferredRole, roleConfidence, semanticSummary, tags, detectedText, dominantColors. inferredRole must be logo|product|reference|unknown. roleConfidence must be 0..1. tags and detectedText are arrays of short strings. dominantColors must be hex colors like #RRGGBB.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `File name: ${input.name}`,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const payload = parseImageSemanticLiveVisionPayload(response.output_text ?? "");
    if (!payload) {
      throw new Error("invalid-live-vision-json");
    }

    return mergeImageSemanticLiveVisionResult(payload, heuristic);
  }

  async analyzeImage(input: ImageSemanticInputDto): Promise<ImageSemanticAnalysisDto> {
    const enabled = process.env.ENABLE_IMAGE_SEMANTIC_EXTRACTION === "true";

    if (!enabled) {
      return {
        inferredRole: "unknown",
        roleConfidence: 0,
        semanticSummary: "Image semantic extraction disabled.",
        tags: [],
        detectedText: [],
        dominantColors: [],
        source: "fallback",
        reason: "image-semantic-extraction-disabled",
      };
    }

    const tokens = tokenizeImageName(input.name);
    const heuristicResult = buildImageSemanticHeuristic(tokens, "deterministic-filename-heuristic");

    const liveVisionEnabled = process.env.ENABLE_LIVE_IMAGE_VISION === "true";
    if (!liveVisionEnabled) {
      return heuristicResult;
    }

    if (!this.client) {
      return {
        ...heuristicResult,
        reason: "live-vision-missing-openai-api-key",
      };
    }

    try {
      return await this.analyzeWithLiveVision(input, heuristicResult);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "live-vision-request-failed";
      return {
        ...heuristicResult,
        reason: `live-vision-failed:${reason}`,
      };
    }
  }
}
