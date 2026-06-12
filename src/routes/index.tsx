import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Upload, Volume2, Square, Copy, Sparkles, FileText, Languages,
  Share2, FileDown, Link as LinkIcon, History, Trash2, RotateCcw, X, Plus, Minus,
  Sun, Moon,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  summarizeArabic,
  extractTextFromImage,
  extractTextFromUrl,
} from "@/lib/api/arabic.functions";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ملخّص — Multilingual Text Summarizer" },
      {
        name: "description",
        content:
          "Smart tool to summarize and paraphrase text in many languages, with read-aloud, image/PDF OCR, and history.",
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
  minChars: number;
  maxChars: number;
  outputLang: string;
  uiLang: "ar" | "en";
  source: string;
  result: string;
};

const HISTORY_KEY = "mulakhas:history:v2";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_BOUND = 20;
const MAX_BOUND = 2000;
const STEP = 20;

const OUTPUT_LANGS: { code: string; ar: string; en: string }[] = [
  { code: "ar", ar: "العربية", en: "Arabic" },
  { code: "en", ar: "الإنجليزية", en: "English" },
  { code: "es", ar: "الإسبانية", en: "Spanish" },
  { code: "fr", ar: "الفرنسية", en: "French" },
  { code: "de", ar: "الألمانية", en: "German" },
  { code: "zh", ar: "الصينية", en: "Chinese" },
  { code: "hi", ar: "الهندية", en: "Hindi" },
  { code: "pt", ar: "البرتغالية", en: "Portuguese" },
  { code: "ru", ar: "الروسية", en: "Russian" },
  { code: "ja", ar: "اليابانية", en: "Japanese" },
  { code: "tr", ar: "التركية", en: "Turkish" },
  { code: "it", ar: "الإيطالية", en: "Italian" },
  { code: "ur", ar: "الأردية", en: "Urdu" },
  { code: "fa", ar: "الفارسية", en: "Persian" },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function Index() {
  const summarize = useServerFn(summarizeArabic);
  const ocr = useServerFn(extractTextFromImage);
  const ocrUrl = useServerFn(extractTextFromUrl);
  const { t, lang, toggle, dir } = useI18n();

  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [outputLang, setOutputLang] = useState<string>("");
  const [minChars, setMinChars] = useState(100);
  const [maxChars, setMaxChars] = useState(300);
  const [loading, setLoading] = useState<null | "sum" | "ocr" | "url">(null);
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

  const rangeValid = maxChars > minChars;
  const canSummarize = !!text.trim() && !!outputLang && rangeValid && loading === null;

  const setMin = (n: number) => setMinChars(clamp(Math.round(n), MIN_BOUND, MAX_BOUND));
  const setMax = (n: number) => setMaxChars(clamp(Math.round(n), MIN_BOUND, MAX_BOUND));

  const handleSummarize = async () => {
    if (!text.trim()) { toast.error(t.enterTextFirst); return; }
    if (!outputLang) { toast.error(t.selectLangFirst); return; }
    if (!rangeValid) { toast.error(t.invalidRange); return; }
    setLoading("sum");
    try {
      const { result } = await summarize({ data: { text, minChars, maxChars, outputLang } });
      setResult(result);
      addHistory({
        id: crypto.randomUUID(),
        ts: Date.now(),
        minChars, maxChars, outputLang,
        uiLang: lang,
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
    if (file.size > MAX_BYTES) { toast.error(t.fileTooLarge); return; }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error(t.extractFailed); return;
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
      toast.error(t.noSpeech); return;
    }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    if (!content.trim()) return;
    const u = new SpeechSynthesisUtterance(content);
    const speakLang = outputLang || lang;
    u.lang = speakLang === "ar" ? "ar-SA" : speakLang === "en" ? "en-US" : speakLang;
    u.rate = 0.95;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(speakLang.toLowerCase()));
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
      if (navigator.share) await navigator.share({ title: t.appTitle, text: s });
      else { await navigator.clipboard.writeText(s); toast.success(t.copied); }
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
    const lines = doc.splitTextToSize(s, width);
    let y = margin;
    const lineHeight = 18;
    const pageH = doc.internal.pageSize.getHeight();
    const isRtl = outputLang === "ar" || outputLang === "ur" || outputLang === "fa";
    for (const line of lines) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, isRtl ? doc.internal.pageSize.getWidth() - margin : margin, y, {
        align: isRtl ? "right" : "left",
      });
      y += lineHeight;
    }
    doc.save(`mulakhas-${Date.now()}.pdf`);
    toast.success(t.pdfReady);
  };

  const restoreHistory = (h: HistoryItem) => {
    setText(h.source);
    setResult(h.result);
    setOutputLang(h.outputLang);
    setMinChars(h.minChars);
    setMaxChars(h.maxChars);
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
                variant="outline" size="sm"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t.outputLanguage}</label>
              <Select value={outputLang} onValueChange={setOutputLang}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectLanguage} />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {lang === "ar" ? l.ar : l.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberStepper
              label={t.minChars} value={minChars}
              onChange={setMin} min={MIN_BOUND} max={MAX_BOUND} step={STEP}
              invalid={!rangeValid}
            />
            <NumberStepper
              label={t.maxChars} value={maxChars}
              onChange={setMax} min={MIN_BOUND} max={MAX_BOUND} step={STEP}
              invalid={!rangeValid}
            />
          </div>
          {!rangeValid && (
            <p className="text-xs text-destructive mt-2">{t.invalidRange}</p>
          )}

          <Button
            size="lg"
            onClick={handleSummarize}
            disabled={!canSummarize}
            className="mt-5 w-full bg-[image:var(--gradient-hero)] hover:opacity-90 text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            {loading === "sum" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className={spaceLg}>{t.summarize}</span>
          </Button>
          {!outputLang && (
            <p className="text-xs text-muted-foreground text-center mt-2">{t.selectLangFirst}</p>
          )}
        </Card>

        {result && (
          <Card className="p-5 sm:p-6 shadow-[var(--shadow-soft)] border-primary/30 bg-card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {t.result}
                <span className="text-xs text-muted-foreground font-normal">
                  ({minChars}–{maxChars} {t.chars})
                </span>
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                      <span className="truncate">
                        {new Date(h.ts).toLocaleString(h.uiLang === "ar" ? "ar-EG" : "en-US")}
                        {" · "}
                        {h.outputLang.toUpperCase()}
                        {" · "}
                        {h.minChars}–{h.maxChars}
                      </span>
                      <div className="flex gap-1 shrink-0">
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

function NumberStepper({
  label, value, onChange, min, max, step, invalid,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number; max: number; step: number;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <Button
          type="button" variant="outline" size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(value - step)}
          disabled={value <= min}
          aria-label="decrease"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Input
          type="number" inputMode="numeric"
          value={value}
          min={min} max={max} step={step}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className={`text-center ${invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        <Button
          type="button" variant="outline" size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(value + step)}
          disabled={value >= max}
          aria-label="increase"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
