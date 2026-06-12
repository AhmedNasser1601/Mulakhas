import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callGateway(body: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("تم تجاوز حد الطلبات. حاول لاحقاً.");
    if (res.status === 402) throw new Error("نفدت الأرصدة. يرجى إضافة رصيد.");
    throw new Error(`AI error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").toString().trim();
}

export const summarizeArabic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(1).max(20000),
      mode: z.enum(["short", "long"]),
    }),
  )
  .handler(async ({ data }) => {
    const constraint =
      data.mode === "short"
        ? "أعد صياغة النص بإيجاز شديد بحيث لا يتجاوز 200 حرف."
        : "أعد صياغة النص بشكل مفصّل بين 300 و500 حرف.";
    const system =
      "أنت أداة إعادة صياغة وتلخيص للنصوص العربية. أعد الإخراج باللغة العربية الفصحى فقط، بدون أي مقدمات أو تعليقات. التزم بعدد الأحرف المطلوب بدقة.";
    const content = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${constraint}\n\nالنص:\n${data.text}` },
      ],
    });
    // Enforce char limit (best-effort trim)
    const limit = data.mode === "short" ? 200 : 500;
    return { result: content.length > limit ? content.slice(0, limit) : content };
  });

export const extractTextFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageDataUrl: z.string().startsWith("data:image/"),
    }),
  )
  .handler(async ({ data }) => {
    const content = await callGateway({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "أنت أداة استخراج نصوص (OCR). استخرج النص العربي من الصورة وأعده كما هو بدون أي شرح أو تعليق. إذا لم يكن هناك نص، أعد سلسلة فارغة.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "استخرج كل النص الموجود في هذه الصورة." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    });
    return { text: content };
  });
