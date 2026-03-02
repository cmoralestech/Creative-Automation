import { useState } from "react";

import type { BriefChatModel, BriefChatResponseDto } from "@/app/api/brief-chat/types";
import { defaultSimpleForm, initialBriefChatMessage } from "@/app/page.constants";
import type { BriefChatMessage, SimpleBriefForm } from "@/app/page.types";

type UseBriefChatOptions = {
  onGenerated: (payload: { briefText: string; simpleForm: SimpleBriefForm }) => void;
};

function toSimpleFormFromBrief(brief: BriefChatResponseDto["brief"]): SimpleBriefForm {
  const parsed = brief as {
    campaignId?: string;
    market?: { region?: string; country?: string; language?: string };
    targetAudience?: string;
    campaignMessage?: string;
    brand?: { voice?: string; primaryColors?: string[]; forbiddenWords?: string[] };
    products?: { id?: string; name?: string; keyBenefits?: string[] }[];
  };

  return {
    ...defaultSimpleForm,
    campaignId: parsed.campaignId || "",
    region: parsed.market?.region || "",
    country: parsed.market?.country || "",
    language: parsed.market?.language || "",
    targetAudience: parsed.targetAudience || "",
    campaignMessage: parsed.campaignMessage || "",
    brandVoice: parsed.brand?.voice || "",
    primaryColorsCsv: parsed.brand?.primaryColors?.join(", ") || "",
    forbiddenWordsCsv: parsed.brand?.forbiddenWords?.join(", ") || "",
    products: [
      {
        id: parsed.products?.[0]?.id || "",
        name: parsed.products?.[0]?.name || "",
        benefitsCsv: parsed.products?.[0]?.keyBenefits?.join(", ") || "",
      },
      {
        id: parsed.products?.[1]?.id || "",
        name: parsed.products?.[1]?.name || "",
        benefitsCsv: parsed.products?.[1]?.keyBenefits?.join(", ") || "",
      },
    ],
  };
}

export function useBriefChat({ onGenerated }: UseBriefChatOptions) {
  const [briefChatInput, setBriefChatInput] = useState("");
  const [briefChatModel, setBriefChatModel] = useState<BriefChatModel>("gpt-4.1-mini");
  const [briefChatLoading, setBriefChatLoading] = useState(false);
  const [pendingGeneratedBrief, setPendingGeneratedBrief] = useState<string | null>(null);
  const [briefChatMessages, setBriefChatMessages] = useState<BriefChatMessage[]>([
    initialBriefChatMessage,
  ]);

  async function submitBriefChat() {
    const trimmed = briefChatInput.trim();
    if (!trimmed || briefChatLoading) {
      return;
    }

    const userMessage: BriefChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setBriefChatMessages((prev) => [...prev, userMessage]);
    setBriefChatLoading(true);
    setBriefChatInput("");

    try {
      const response = await fetch("/api/brief-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request: trimmed, model: briefChatModel }),
      });

      const body = (await response.json()) as BriefChatResponseDto & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to generate campaign brief JSON.");
      }

      const nextBriefText = JSON.stringify(body.brief, null, 2);
      onGenerated({
        briefText: nextBriefText,
        simpleForm: toSimpleFormFromBrief(body.brief),
      });

      const parsed = body.brief as { campaignId?: string; products?: unknown[] };
      const summary = `Generated valid JSON via ${body.source} (${body.model}) for ${parsed.campaignId ?? "campaign-run"} with ${parsed.products?.length ?? 0} products.`;

      setBriefChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: body.reason
            ? `${summary} Note: ${body.reason} Review the JSON, then click Generate from latest draft.`
            : `${summary} Review the JSON, then click Generate from latest draft.`,
        },
      ]);

      setPendingGeneratedBrief(nextBriefText);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown chat generation error.";
      setBriefChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: `I couldn't generate a valid brief JSON: ${message}`,
        },
      ]);
    } finally {
      setBriefChatLoading(false);
    }
  }

  function clearBriefChat() {
    setBriefChatMessages([{ ...initialBriefChatMessage, id: `assistant-intro-${Date.now()}` }]);
    setBriefChatInput("");
    setPendingGeneratedBrief(null);
    setBriefChatLoading(false);
  }

  return {
    briefChatInput,
    setBriefChatInput,
    briefChatModel,
    setBriefChatModel,
    briefChatLoading,
    pendingGeneratedBrief,
    briefChatMessages,
    submitBriefChat: () => {
      void submitBriefChat();
    },
    clearBriefChat,
  };
}
