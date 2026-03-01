import { GeneratedCopyDto, GeneratedImageDto, GeneratedRunSummaryDto } from "./adapterTypes";
import { sharedOpenAIClient } from "./openaiClientFactory";
import {
  buildOpenAIPlaceholderImage,
  formatOpenAIErrorMessage,
} from "./openaiUtils";

export class OpenAIClient {
  private readonly client: typeof sharedOpenAIClient;
  private readonly mockMode: boolean;

  constructor() {
    this.client = sharedOpenAIClient;
    this.mockMode = process.env.MOCK_MODE === "true" || !this.client;
  }

  isMockMode(): boolean {
    return this.mockMode;
  }

  async generateCopy(prompt: string, model: string = "gpt-4.1-mini"): Promise<GeneratedCopyDto> {
    if (this.mockMode || !this.client) {
      return {
        text: "Unleash your potential. Move with purpose. Nike empowers every step.",
        source: "mock",
        reason: process.env.MOCK_MODE === "true" ? "mock-mode-enabled" : "missing-openai-api-key",
      };
    }

    try {
      const response = await this.client.responses.create({
        model,
        input: prompt,
        max_output_tokens: 80,
        temperature: 0.7,
      });

      return {
        text: response.output_text.trim(),
        source: "live",
        reason: null,
      };
    } catch (error: unknown) {
      const errorMessage = formatOpenAIErrorMessage(error, "copy generation");
      console.error(`OpenAI copy generation failed: ${errorMessage}`, error);
      return {
        text: "Power your day with smarter choices, made for your routine.",
        source: "fallback",
        reason: errorMessage,
      };
    }
  }

  async generateImage(prompt: string): Promise<GeneratedImageDto> {
    if (this.mockMode || !this.client) {
      return {
        image: await buildOpenAIPlaceholderImage(prompt),
        source: "mock",
        reason: process.env.MOCK_MODE === "true" ? "mock-mode-enabled" : "missing-openai-api-key",
      };
    }

    try {
      const imageResult = await this.client.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "standard",
      });

      const imageUrl = imageResult.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Image generation failed: missing image URL");
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      return {
        image: Buffer.from(arrayBuffer),
        source: "live",
        reason: null,
      };
    } catch (error: unknown) {
      const errorMessage = formatOpenAIErrorMessage(error, "image generation");
      console.error(`OpenAI image generation failed: ${errorMessage}`, error);
      return {
        image: await buildOpenAIPlaceholderImage(prompt),
        source: "fallback",
        reason: errorMessage,
      };
    }
  }

  async generateRunSummary(
    prompt: string,
    fallbackText: string,
    model: string = "gpt-4.1-mini",
  ): Promise<GeneratedRunSummaryDto> {
    if (this.mockMode || !this.client) {
      return {
        text: fallbackText,
        source: "mock",
        reason: process.env.MOCK_MODE === "true" ? "mock-mode-enabled" : "missing-openai-api-key",
      };
    }

    try {
      const response = await this.client.responses.create({
        model,
        input: [
          {
            role: "system",
            content:
              "You are a concise campaign operations assistant. Return a 2-3 sentence run summary with outcomes and next action. No markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_output_tokens: 180,
        temperature: 0.2,
      });

      const text = response.output_text.trim();
      if (!text) {
        throw new Error("Missing run summary text.");
      }

      return {
        text,
        source: "live",
        reason: null,
      };
    } catch (error: unknown) {
      const errorMessage = formatOpenAIErrorMessage(error, "run summary generation");
      console.error(`OpenAI run summary generation failed: ${errorMessage}`, error);
      return {
        text: fallbackText,
        source: "fallback",
        reason: errorMessage,
      };
    }
  }
}
