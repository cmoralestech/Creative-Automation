import OpenAI from "openai";

export type WebSearchSnippet = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

function toDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function sanitize(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export class WebSearchClient {
  private readonly client: OpenAI | null;
  private readonly enabled: boolean;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.enabled = process.env.ENABLE_WEB_SEARCH === "true";
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = process.env.WEB_SEARCH_MODEL?.trim() || "gpt-4.1-mini";
  }

  async search(query: string, maxResults: number = 3): Promise<WebSearchSnippet[]> {
    const cleanedQuery = sanitize(query);
    if (!this.enabled || !this.client || !cleanedQuery) {
      return [];
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        tools: [{ type: "web_search_preview" }] as never,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Find reliable, recent public information for: ${cleanedQuery}`,
                  `Return a concise JSON object with shape {\"results\":[{\"title\":string,\"url\":string,\"snippet\":string}]}.`,
                  `Maximum results: ${Math.max(1, Math.min(maxResults, 5))}.`,
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "web_search_results",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["results"],
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "url", "snippet"],
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      snippet: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        max_output_tokens: 500,
        temperature: 0,
      });

      if (!response.output_text) {
        return [];
      }

      const parsed = JSON.parse(response.output_text) as {
        results?: Array<{ title?: string; url?: string; snippet?: string }>;
      };

      return (parsed.results ?? [])
        .map((result) => {
          const title = typeof result.title === "string" ? sanitize(result.title) : "";
          const url = typeof result.url === "string" ? sanitize(result.url) : "";
          const snippet = typeof result.snippet === "string" ? sanitize(result.snippet) : "";
          return {
            title,
            url,
            snippet,
            domain: toDomain(url),
          };
        })
        .filter((result) => result.title && result.url && result.snippet)
        .slice(0, Math.max(1, Math.min(maxResults, 5)));
    } catch {
      return [];
    }
  }
}
