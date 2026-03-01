import OpenAI from "openai";

import { CampaignBrief, parseCampaignBrief } from "@/domain/campaignBrief";
import { ApiErrorResponseDto } from "@/app/api/_shared/dtos";
import {
  BriefChatModel,
  BriefChatRequestDto,
  BriefChatResponseDto,
  SUPPORTED_BRIEF_CHAT_MODELS,
} from "@/app/api/brief-chat/types";

export const runtime = "nodejs";

// Input guardrail for workspace brief chat prompt.
const MAX_REQUEST_CHARS = 1200;

const CAMPAIGN_BRIEF_JSON_SCHEMA = {
  name: "campaign_brief",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "campaignId",
      "market",
      "targetAudience",
      "products",
      "campaignMessage",
      "channels",
      "requiredAspectRatios",
      "brand",
    ],
    properties: {
      campaignId: { type: "string" },
      market: {
        type: "object",
        additionalProperties: false,
        required: ["region", "country", "language"],
        properties: {
          region: { type: "string" },
          country: { type: "string" },
          language: { type: "string" },
        },
      },
      targetAudience: { type: "string" },
      products: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "keyBenefits"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            keyBenefits: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      campaignMessage: { type: "string" },
      channels: {
        type: "array",
        items: {
          type: "string",
          enum: ["instagram", "facebook"],
        },
      },
      requiredAspectRatios: {
        type: "array",
        items: {
          type: "string",
          enum: ["1:1", "9:16", "16:9"],
        },
      },
      brand: {
        type: "object",
        additionalProperties: false,
        required: ["primaryColors", "logoRequired", "voice", "forbiddenWords"],
        properties: {
          primaryColors: {
            type: "array",
            items: { type: "string" },
          },
          logoRequired: { type: "boolean" },
          voice: { type: "string" },
          forbiddenWords: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
} as const;

function sanitizePrompt(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function coerceModel(input: unknown): BriefChatModel {
  if (typeof input !== "string") {
    return "gpt-4.1-mini";
  }
  return (SUPPORTED_BRIEF_CHAT_MODELS as readonly string[]).includes(input)
    ? (input as BriefChatModel)
    : "gpt-4.1-mini";
}

function buildMockBriefFromRequest(userRequest: string): CampaignBrief {
  const hint = sanitizePrompt(userRequest).toLowerCase();
  const isSportswear = /(sport|run|shoe|fitness|training|tennis|athletic)/.test(hint);

  if (isSportswear) {
    return parseCampaignBrief({
      campaignId: "custom-sportswear-2026",
      market: {
        region: "NA",
        country: "US",
        language: "en-US",
      },
      targetAudience: "Active adults 20-40 who run or train regularly",
      products: [
        {
          id: "running-socks",
          name: "Running Socks",
          keyBenefits: ["Moisture-wicking", "Arch support", "All-day comfort"],
        },
        {
          id: "tennis-shoes",
          name: "Tennis Shoes",
          keyBenefits: ["Responsive cushioning", "Lightweight feel", "Durable outsole"],
        },
      ],
      campaignMessage: "Train stronger with lightweight sportswear built for everyday performance.",
      channels: ["instagram", "facebook"],
      requiredAspectRatios: ["1:1", "9:16", "16:9"],
      brand: {
        primaryColors: ["#0057B8", "#00A3E0"],
        logoRequired: true,
        voice: "Bold, optimistic, and practical",
        forbiddenWords: ["cure", "guaranteed"],
      },
    });
  }

  return parseCampaignBrief({
    campaignId: "custom-campaign-2026",
    market: {
      region: "NA",
      country: "US",
      language: "en-US",
    },
    targetAudience: "Young professionals looking for practical daily upgrades",
    products: [
      {
        id: "product-alpha",
        name: "Product Alpha",
        keyBenefits: ["Everyday convenience", "Premium quality"],
      },
      {
        id: "product-beta",
        name: "Product Beta",
        keyBenefits: ["Great value", "Fast results"],
      },
    ],
    campaignMessage: "Upgrade your routine with products designed to perform every day.",
    channels: ["instagram", "facebook"],
    requiredAspectRatios: ["1:1", "9:16", "16:9"],
    brand: {
      primaryColors: ["#0057B8", "#00A3E0"],
      logoRequired: true,
      voice: "Confident, clear, and practical",
      forbiddenWords: ["cure", "guaranteed"],
    },
  });
}

async function generateBriefWithModel(
  client: OpenAI,
  userRequest: string,
  model: BriefChatModel,
): Promise<BriefChatResponseDto> {
  // Stage helper: structured JSON generation with schema-constrained output.
  const systemPrompt = [
    "You generate only campaign brief JSON for a social creative pipeline.",
    "Return only valid JSON matching the response schema.",
    "Rules:",
    "- products must contain at least 2 items",
    "- product.id must be kebab-case",
    "- requiredAspectRatios must be subset of [\"1:1\",\"9:16\",\"16:9\"]",
    "- keep channels to [\"instagram\",\"facebook\"] unless user asks otherwise",
    "- include conservative forbiddenWords list",
  ].join("\n");

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Create a campaign brief JSON for this request: ${userRequest}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        ...CAMPAIGN_BRIEF_JSON_SCHEMA,
      },
    },
    max_output_tokens: 900,
    temperature: 0.2,
  });

  if (!response.output_text) {
    throw new Error("Model did not return JSON output.");
  }

  const parsed = JSON.parse(response.output_text) as unknown;
  const brief = parseCampaignBrief(parsed);

  return {
    brief,
    source: "live",
    model,
    repaired: false,
    reason: null,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Stage 1: Parse payload and validate prompt/model inputs.
    const payload = (await request.json()) as BriefChatRequestDto;
    const userRequest = typeof payload.request === "string" ? sanitizePrompt(payload.request) : "";
    const selectedModel = coerceModel(payload.model);

    if (!userRequest) {
      return Response.json(
        { error: "Provide a campaign request in natural language." } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    if (userRequest.length > MAX_REQUEST_CHARS) {
      return Response.json(
        { error: `Request is too long. Maximum is ${MAX_REQUEST_CHARS} characters.` } satisfies ApiErrorResponseDto,
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const mockMode = process.env.MOCK_MODE === "true" || !apiKey;

    // Stage 2: Serve mock brief when OpenAI is unavailable or mock mode is enabled.
    if (mockMode || !apiKey) {
      return Response.json({
        brief: buildMockBriefFromRequest(userRequest),
        source: "mock",
        model: selectedModel,
        repaired: false,
        reason: process.env.MOCK_MODE === "true" ? "mock-mode-enabled" : "missing-openai-api-key",
      } satisfies BriefChatResponseDto);
    }

    const client = new OpenAI({ apiKey });

    try {
      // Stage 3: Generate live schema-valid brief JSON.
      const result = await generateBriefWithModel(client, userRequest, selectedModel);
      return Response.json(result satisfies BriefChatResponseDto);
    } catch (error) {
      // Stage 4: Fallback to deterministic mock brief if live generation fails.
      const reason = error instanceof Error ? error.message : "Model generation failed.";
      return Response.json({
        brief: buildMockBriefFromRequest(userRequest),
        source: "fallback",
        model: selectedModel,
        repaired: false,
        reason,
      } satisfies BriefChatResponseDto);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected brief generation error.";
    return Response.json({ error: message } satisfies ApiErrorResponseDto, { status: 500 });
  }
}
