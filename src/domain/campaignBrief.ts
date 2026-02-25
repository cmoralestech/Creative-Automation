import { z } from "zod";

export const ASPECT_RATIO_DIMENSIONS = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1600, height: 900 },
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIO_DIMENSIONS;

const productSchema = z.object({
  id: z
    .string()
    .min(1, "Product id is required")
    .regex(/^[a-z0-9-]+$/, "Product id must be kebab-case"),
  name: z.string().min(1, "Product name is required"),
  keyBenefits: z.array(z.string().min(1)).default([]),
});

export const campaignBriefSchema = z.object({
  campaignId: z.string().min(1).default("campaign-run"),
  market: z.object({
    region: z.string().min(1, "Market region is required"),
    country: z.string().optional(),
    language: z.string().optional(),
  }),
  targetAudience: z.string().min(1, "Target audience is required"),
  campaignMessage: z.string().min(1, "Campaign message is required"),
  products: z.array(productSchema).min(2, "At least two products are required"),
  channels: z.array(z.string()).default(["instagram", "facebook"]),
  requiredAspectRatios: z
    .array(z.enum(["1:1", "9:16", "16:9"]))
    .default(["1:1", "9:16", "16:9"]),
  brand: z
    .object({
      primaryColors: z.array(z.string()).default([]),
      logoRequired: z.boolean().default(true),
      voice: z.string().optional(),
      forbiddenWords: z.array(z.string()).default([]),
    })
    .default({ primaryColors: [], logoRequired: true, forbiddenWords: [] }),
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;

export function parseCampaignBrief(input: unknown): CampaignBrief {
  return campaignBriefSchema.parse(input);
}
