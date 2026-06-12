import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_BYTES = 5 * 1024 * 1024;

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
    if (res.status === 429) throw new Error("Rate limit exceeded. Try again later.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    throw new Error(`AI error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").toString().trim();
}

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese (Simplified)",
  hi: "Hindi",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  tr: "Turkish",
  it: "Italian",
  ur: "Urdu",
  fa: "Persian",
};

export const summarizeArabic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(1).max(20000),
      minChars: z.number().int().min(20).max(5000),
      maxChars: z.number().int().min(40).max(5000),
      outputLang: z.string().min(2).max(8),
    }).refine((v) => v.maxChars > v.minChars, { message: "maxChars must be greater than minChars" }),
  )
  .handler(async ({ data }) => {
    const langName = LANG_NAMES[data.outputLang] ?? data.outputLang;
    const system =
      `You are a text paraphrasing and summarization tool. Output ONLY in ${langName}, with no preamble or commentary. ` +
      `Strictly produce a result between ${data.minChars} and ${data.maxChars} characters (inclusive). Never exceed ${data.maxChars} characters.`;
    const user =
      `Paraphrase/summarize the following text in ${langName}, between ${data.minChars} and ${data.maxChars} characters.\n\nText:\n${data.text}`;
    const content = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const trimmed = content.length > data.maxChars ? content.slice(0, data.maxChars) : content;
    return { result: trimmed };
  });

function buildExtractMessage(mime: string, dataUrl: string) {
  const isPdf = mime === "application/pdf";
  const block = isPdf
    ? { type: "file", file: { filename: "document.pdf", file_data: dataUrl } }
    : { type: "image_url", image_url: { url: dataUrl } };
  return {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an OCR/text extraction tool. Extract all text from the provided file as-is, preserving the original language. Return only the extracted text with no commentary. If no text, return an empty string.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all text from this file." },
          block,
        ],
      },
    ],
  };
}

export const extractTextFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      dataUrl: z.string().startsWith("data:"),
      mime: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const content = await callGateway(buildExtractMessage(data.mime, data.dataUrl));
    return { text: content };
  });

export const extractTextFromUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data }) => {
    const res = await fetch(data.url);
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
    const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!mime.startsWith("image/") && mime !== "application/pdf") {
      throw new Error("URL must point to an image or PDF");
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("File exceeds 5MB limit");
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;
    const content = await callGateway(buildExtractMessage(mime, dataUrl));
    return { text: content };
  });
