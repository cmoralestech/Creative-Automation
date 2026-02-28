import OpenAI from "openai";

export type GenerationSource = "live" | "mock" | "fallback";

export type GeneratedCopyDto = {
  text: string;
  source: GenerationSource;
  reason: string | null;
};

export type GeneratedImageDto = {
  image: Buffer;
  source: GenerationSource;
  reason: string | null;
};

export type GeneratedRunSummaryDto = {
  text: string;
  source: GenerationSource;
  reason: string | null;
};

export class OpenAIClient {
  private readonly client: OpenAI | null;
  private readonly mockMode: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.mockMode = process.env.MOCK_MODE === "true" || !apiKey;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
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
      const errorMessage = this.getErrorMessage(error, "copy generation");
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
        image: await this.generatePlaceholderImage(prompt),
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
      const errorMessage = this.getErrorMessage(error, "image generation");
      console.error(`OpenAI image generation failed: ${errorMessage}`, error);
      return {
        image: await this.generatePlaceholderImage(prompt),
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
      const errorMessage = this.getErrorMessage(error, "run summary generation");
      console.error(`OpenAI run summary generation failed: ${errorMessage}`, error);
      return {
        text: fallbackText,
        source: "fallback",
        reason: errorMessage,
      };
    }
  }

  private getErrorMessage(error: unknown, operation: string): string {
    const details = this.asErrorDetails(error);
    const message = (details.message ?? "").toLowerCase();
    const code = (details.code ?? "").toUpperCase();

    if (details.status === 429) {
      if (details.code === "rate_limit_exceeded") {
        return `OpenAI rate limit exceeded. Please wait a moment and try again.`;
      }
      if (message.includes("quota")) {
        return `OpenAI quota exceeded. Please check your account billing.`;
      }
      return `OpenAI rate limit reached for ${operation}. Retrying may help.`;
    }
    if (
      code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
      message.includes("unable to get local issuer certificate")
    ) {
      return "TLS certificate error (local issuer not trusted). Run `npm run dev:trusted` or configure NODE_EXTRA_CA_CERTS.";
    }
    if (message.includes("timeout") || message.includes("etimedout")) {
      return `Network timeout during ${operation}. Check your connection.`;
    }
    if (message.includes("fetch failed")) {
      return `Network error during ${operation}. Check your internet connection.`;
    }
    return details.message || `Unknown error during ${operation}`;
  }

  private asErrorDetails(error: unknown): {
    status?: number;
    code?: string;
    message?: string;
  } {
    if (!error || typeof error !== "object") {
      return {};
    }

    const record = this.flattenErrorRecord(error as Record<string, unknown>);
    return {
      status: typeof record.status === "number" ? record.status : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }

  private flattenErrorRecord(errorRecord: Record<string, unknown>): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...errorRecord };
    let cursor: unknown = errorRecord;
    let depth = 0;

    while (cursor && typeof cursor === "object" && depth < 4) {
      const current = cursor as Record<string, unknown>;
      if (typeof current.code === "string" && typeof merged.code !== "string") {
        merged.code = current.code;
      }
      if (typeof current.message === "string" && typeof merged.message !== "string") {
        merged.message = current.message;
      }
      if (typeof current.status === "number" && typeof merged.status !== "number") {
        merged.status = current.status;
      }
      cursor = current.cause;
      depth += 1;
    }

    return merged;
  }

  private async generatePlaceholderImage(label: string): Promise<Buffer> {
    const safeLabel = label.slice(0, 100).replace(/[<>&]/g, "");
    const svg = `
      <svg width="1536" height="1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#000" />
        <ellipse cx="768" cy="512" rx="600" ry="400" fill="#CEFF00" opacity="0.08" />
        <path d="M400 800 Q800 900 1200 400" stroke="#CEFF00" stroke-width="32" fill="none" opacity="0.7" />
        <text x="80" y="200" font-size="120" fill="#CEFF00" font-family="Arial Black, Arial, sans-serif" font-weight="900" letter-spacing="-8">
          NIKE
        </text>
        <text x="80" y="320" font-size="48" fill="#fff" font-family="Arial, sans-serif" font-weight="700">
          MOCK IMAGE
        </text>
        <text x="80" y="400" font-size="36" fill="#e2e8f0" font-family="Arial, sans-serif">
          ${safeLabel}
        </text>
        <!-- Swoosh motif -->
        <path d="M300 900 Q700 1000 1300 600" stroke="#fff" stroke-width="24" fill="none" opacity="0.9" />
      </svg>
    `;

    return Buffer.from(svg);
  }
}
