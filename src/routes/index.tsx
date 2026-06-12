import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Volume2, Square, Copy, Sparkles, FileText, Languages } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { summarizeArabic, extractTextFromImage } from "@/lib/api/arabic.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ملخّص — Arabic & English Text Summarizer" },
      {
        name: "description",
        content:
          "Smart tool to summarize and paraphrase Arabic & English text, with read-aloud and image OCR.",
      },
    ],
  }),
  component: Index,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-destructive font-semibold mb-3">{error.message}</p>
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  },
});

function Index() {
  const summarize = useServerFn(summarizeArabic);
  const ocr = useServerFn(extractTextFromImage);
  const { t, lang, toggle, dir } = useI18n();

  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<"short" | "long" | null>(null);
  const [loading, setLoading] = useState<null | "short" | "long" | "ocr">(null);
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSummarize = async (m: "short" | "long") => {
    if (!text.trim()) {
      toast.error(t.enterTextFirst);
      return;
    }
    setLoading(m);
    setMode(m);
    try {
      const { result } = await summarize({ data: { text, mode: m, lang } });
      setResult(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.unknownError);
    } finally {
      setLoading(null);
    }
  };

  const handleImage = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t.imageTooLarge);
      return;
    }
    setLoading("ocr");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const { text: extracted } = await ocr({ data: { imageDataUrl: dataUrl } });
      if (!extracted.trim()) {
        toast.error(t.noTextFound);
      } else {
        setText((prev) => (prev ? prev + "\n" + extracted : extracted));
        toast.success(t.extracted);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.extractFailed);
    } finally {
      setLoading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const speak = (content: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error(t.noSpeech);
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!content.trim()) return;
    const u = new SpeechSynthesisUtterance(content);
    const speechLang = lang === "ar" ? "ar-SA" : "en-US";
    u.lang = speechLang;
    u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang.startsWith(lang === "ar" ? "ar" : "en"));
    if (v) u.voice = v;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const copy = async (s: string) => {
    await navigator.clipboard.writeText(s);
    toast.success(t.copied);
  };

  const space = lang === "ar" ? "mr-1" : "ml-1";
  const spaceLg = lang === "ar" ? "mr-2" : "ml-2";

  return (
    <div dir={dir} className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <Toaster position="top-center" dir={dir} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={toggle} aria-label="Toggle language">
            <Languages className="w-4 h-4" />
            <span className={space}>{t.langToggle}</span>
          </Button>
        </div>

        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t.appTitle}</h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">{t.tagline}</p>
        </header>

        <Card className="p-5 sm:p-6 shadow-[var(--shadow-soft)] border-border/60">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <label className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t.originalText}
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImage(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={loading === "ocr"}
              >
                {loading === "ocr" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className={space}>{t.uploadImage}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => speak(text)}
                disabled={!text.trim()}
              >
                {speaking ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span className={space}>{speaking ? t.stop : t.read}</span>
              </Button>
            </div>
          </div>
          <Textarea
            dir={dir}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
            className="min-h-[180px] text-base leading-relaxed resize-y font-[family-name:var(--font-arabic)]"
          />
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{text.length} {t.chars}</span>
            {text && (
              <button
                onClick={() => {
                  setText("");
                  setResult("");
                }}
                className="hover:text-foreground transition-colors"
              >
                {t.clear}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <Button
              size="lg"
              onClick={() => handleSummarize("short")}
              disabled={loading !== null || !text.trim()}
              className="bg-[image:var(--gradient-hero)] hover:opacity-90 text-primary-foreground shadow-[var(--shadow-soft)]"
            >
              {loading === "short" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className={spaceLg}>{t.short}</span>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => handleSummarize("long")}
              disabled={loading !== null || !text.trim()}
            >
              {loading === "long" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className={spaceLg}>{t.long}</span>
            </Button>
          </div>
        </Card>

        {result && (
          <Card className="p-5 sm:p-6 shadow-[var(--shadow-soft)] border-primary/30 bg-card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {mode === "short" ? t.resultShort : t.resultLong}
              </h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => speak(result)}>
                  {speaking ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span className={space}>{speaking ? t.stop : t.read}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copy(result)}>
                  <Copy className="w-4 h-4" />
                  <span className={space}>{t.copy}</span>
                </Button>
              </div>
            </div>
            <p className="text-base sm:text-lg leading-loose whitespace-pre-wrap">{result}</p>
            <div className="text-xs text-muted-foreground mt-3">{result.length} {t.chars}</div>
          </Card>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-4">{t.footer}</footer>
      </div>
    </div>
  );
}
