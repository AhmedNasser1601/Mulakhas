import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Upload, Volume2, Square, Copy, Sparkles, FileText, Languages,
  Share2, FileDown, Link as LinkIcon, History, Trash2, RotateCcw, X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import {
  summarizeArabic,
  extractTextFromImage,
  extractTextFromUrl,
} from "@/lib/api/arabic.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ملخّص — Arabic & English Text Summarizer" },
      {
        name: "description",
        content:
          "Smart tool to summarize and paraphrase Arabic & English text, with read-aloud, image/PDF OCR, and history.",
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

type HistoryItem = {
  id: string;
  ts: number;
  mode: "short" | "long";
  lang: "ar" | "en";
  source: string;
  result: string;
};

const HISTORY_KEY = "mulakhas:history";
const MAX_BYTES = 5 * 1024 * 1024;

function Index() {
  const summarize = useServerFn(summarizeArabic);
  const ocr = useServerFn(extractTextFromImage);
  const ocrUrl = useServerFn(extractTextFromUrl);
  const { t, lang, toggle, dir } = useI18n();

  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<"short" | "long" | null>(null);
  const [loading, setLoading] = useState<null | "short" | "long" | "ocr" | "url">(null);
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persistHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  };

  const addHistory = (item: HistoryItem) => {
    persistHistory([item, ...history].slice(0, 50));
  };

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
      addHistory({
        id: crypto.randomUUID(),
        ts: Date.now(),
        mode: m,
        lang,
        source: text,
        result,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.unknownError);
    } finally {
      setLoading(null);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(t.fileTooLarge);
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error(t.extractFailed);
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
      const { text: extracted } = await ocr({ data: { dataUrl, mime: file.type } });
      if (!extracted.trim()) toast.error(t.noTextFound);
      else {
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

  const handleUrl = async () => {
    const url = window.prompt(t.urlPrompt);
    if (!url) return;
    try { new URL(url); } catch { toast.error(t.invalidUrl); return; }
    setLoading("url");
    try {
      const { text: extracted } = await ocrUrl({ data: { url } });
      if (!extracted.trim()) toast.error(t.noTextFound);
      else {
        setText((prev) => (prev ? prev + "\n" + extracted : extracted));
        toast.success(t.extracted);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.extractFailed);
    } finally {
      setLoading(null);
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
    u.lang = lang === "ar" ? "ar-SA" : "en-US";
    u.rate = 0.95;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang === "ar" ? "ar" : "en"));
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

  const share = async (s: string) => {
    if (!s.trim()) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: t.appTitle, text: s });
      } else {
        await navigator.clipboard.writeText(s);
        toast.success(t.copied);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error(t.shareFailed);
    }
  };

  const exportPdf = (s: string) => {
    if (!s.trim()) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    doc.setFontSize(12);
    // jsPDF default fonts don't render Arabic glyphs well, but text is selectable/copyable.
    const lines = doc.splitTextToSize(s, width);
    let y = margin;
    const lineHeight = 18;
    const pageH = doc.internal.pageSize.getHeight();
    const isAr = lang === "ar";
    for (const line of lines) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, isAr ? doc.internal.pageSize.getWidth() - margin : margin, y, {
        align: isAr ? "right" : "left",
      });
      y += lineHeight;
    }
    doc.save(`mulakhas-${Date.now()}.pdf`);
    toast.success(t.pdfReady);
  };

  const restoreHistory = (h: HistoryItem) => {
    setText(h.source);
    setResult(h.result);
    setMode(h.mode);
    setShowHistory(false);
  };

  const deleteHistory = (id: string) => persistHistory(history.filter((h) => h.id !== id));

  const space = lang === "ar" ? "mr-1" : "ml-1";
  const spaceLg = lang === "ar" ? "mr-2" : "ml-2";

  return (
    <div dir={dir} className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <Toaster position="top-center" dir={dir} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} aria-label="History">
            <History className="w-4 h-4" />
            <span className={space}>{t.history}</span>
            {history.length > 0 && (
              <span className="ms-1 rounded-full bg-primary/15 text-primary px-1.5 text-[10px]">
                {history.length}
              </span>
            )}
          </Button>
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
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={loading === "ocr"}
                title={t.fileHint}
              >
                {loading === "ocr" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className={space}>{t.uploadImage}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleUrl} disabled={loading === "url"}>
                {loading === "url" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                <span className={space}>{t.fromUrl}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => speak(text)} disabled={!text.trim()}>
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
                onClick={() => { setText(""); setResult(""); }}
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
              {loading === "short" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className={spaceLg}>{t.short}</span>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => handleSummarize("long")}
              disabled={loading !== null || !text.trim()}
            >
              {loading === "long" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => speak(result)}>
                  {speaking ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span className={space}>{speaking ? t.stop : t.read}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copy(result)}>
                  <Copy className="w-4 h-4" />
                  <span className={space}>{t.copy}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => share(result)}>
                  <Share2 className="w-4 h-4" />
                  <span className={space}>{t.share}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => exportPdf(result)}>
                  <FileDown className="w-4 h-4" />
                  <span className={space}>{t.exportPdf}</span>
                </Button>
              </div>
            </div>
            <p className="text-base sm:text-lg leading-loose whitespace-pre-wrap">{result}</p>
            <div className="text-xs text-muted-foreground mt-3">{result.length} {t.chars}</div>
          </Card>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-4 space-y-1">
          <p>{t.footer}</p>
          <p>
            {lang === "ar" ? "تطوير: " : "Developed by: "}
            <a
              href="https://linkedin.com/in/ahmednasser1601"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Ahmed Nasser
            </a>
          </p>
        </footer>
      </div>

      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowHistory(false)}
        >
          <div
            dir={dir}
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4" />
                {t.history}
              </h3>
              <div className="flex gap-2">
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => persistHistory([])}>
                    <Trash2 className="w-4 h-4" />
                    <span className={space}>{t.clearHistory}</span>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t.noHistory}</p>
              ) : (
                history.map((h) => (
                  <Card key={h.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(h.ts).toLocaleString(h.lang === "ar" ? "ar-EG" : "en-US")}
                        {" · "}
                        {h.mode === "short" ? t.resultShort : t.resultLong}
                        {" · "}
                        {h.lang.toUpperCase()}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => restoreHistory(h)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(h.result)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteHistory(h.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm line-clamp-3 whitespace-pre-wrap">{h.result}</p>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
