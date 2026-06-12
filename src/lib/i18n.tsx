import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = {
  appTitle: string; tagline: string; taglineShort: string; originalText: string; uploadImage: string;
  read: string; stop: string; placeholder: string; chars: string; clear: string;
  result: string;
  copy: string; copied: string; footer: string; enterTextFirst: string;
  fileTooLarge: string; noTextFound: string; extracted: string;
  extractFailed: string; unknownError: string; noSpeech: string;
  retry: string; error: string; langToggle: string;
  share: string; shareFailed: string; exportPdf: string; pdfReady: string;
  fromUrl: string; urlPrompt: string; invalidUrl: string;
  history: string; noHistory: string; clearHistory: string; restore: string; delete: string;
  uploadFile: string; fileHint: string;
  summarize: string; outputLanguage: string; selectLanguage: string;
  minChars: string; maxChars: string; rangeHint: string; invalidRange: string;
  selectLangFirst: string;
};

const translations: Record<"ar" | "en", Dict> = {
  ar: {
    appTitle: "ملخّص",
    tagline: "أداة ذكية لتلخيص النصوص وإعادة صياغتها، قراءتها، واستخراجها من الصور وملفات PDF بأي لغة.",
    taglineShort: "تلخيص ذكي بأي لغة.",
    originalText: "النص الأصلي",
    uploadImage: "رفع ملف",
    read: "قراءة",
    stop: "إيقاف",
    placeholder: "ألصق النص هنا أو ارفع صورة/PDF أو أدخل رابطاً لاستخراج النص...",
    chars: "حرف",
    clear: "مسح",
    result: "النتيجة",
    copy: "نسخ",
    copied: "تم النسخ",
    footer: "يعمل على الويب، الجوال، وأنظمة سطح المكتب.",
    enterTextFirst: "الرجاء إدخال نص أولاً",
    fileTooLarge: "حجم الملف كبير جداً (الحد 5MB)",
    noTextFound: "لم يتم العثور على نص",
    extracted: "تم استخراج النص",
    extractFailed: "فشل استخراج النص",
    unknownError: "خطأ غير معروف",
    noSpeech: "متصفحك لا يدعم قراءة النص",
    retry: "إعادة المحاولة",
    error: "حدث خطأ",
    langToggle: "EN",
    share: "مشاركة",
    shareFailed: "تعذرت المشاركة",
    exportPdf: "تصدير PDF",
    pdfReady: "تم تصدير الملف",
    fromUrl: "من رابط",
    urlPrompt: "أدخل رابط صورة أو PDF",
    invalidUrl: "رابط غير صالح",
    history: "السجل",
    noHistory: "لا يوجد سجل بعد",
    clearHistory: "مسح السجل",
    restore: "استرجاع",
    delete: "حذف",
    uploadFile: "رفع صورة أو PDF",
    fileHint: "صورة أو PDF (حد أقصى 5MB)",
    summarize: "تلخيص",
    outputLanguage: "لغة الإخراج",
    selectLanguage: "اختر اللغة",
    minChars: "الحد الأدنى",
    maxChars: "الحد الأقصى",
    rangeHint: "عدد الأحرف",
    invalidRange: "الحد الأقصى يجب أن يكون أكبر من الأدنى",
    selectLangFirst: "اختر لغة الإخراج أولاً",
  },
  en: {
    appTitle: "Mulakhas",
    tagline: "Smart tool to summarize, paraphrase, read aloud, and extract text from images or PDFs in any language.",
    taglineShort: "Smart summarization in any language.",
    originalText: "Original Text",
    uploadImage: "Upload File",
    read: "Read",
    stop: "Stop",
    placeholder: "Paste text, upload an image/PDF, or enter a URL to extract text...",
    chars: "chars",
    clear: "Clear",
    result: "Result",
    copy: "Copy",
    copied: "Copied",
    footer: "Works on Web, Mobile, and Desktop.",
    enterTextFirst: "Please enter some text first",
    fileTooLarge: "File is too large (max 5MB)",
    noTextFound: "No text found",
    extracted: "Text extracted",
    extractFailed: "Failed to extract text",
    unknownError: "Unknown error",
    noSpeech: "Your browser does not support speech",
    retry: "Try again",
    error: "An error occurred",
    langToggle: "ع",
    share: "Share",
    shareFailed: "Could not share",
    exportPdf: "Export PDF",
    pdfReady: "PDF exported",
    fromUrl: "From URL",
    urlPrompt: "Enter image or PDF URL",
    invalidUrl: "Invalid URL",
    history: "History",
    noHistory: "No history yet",
    clearHistory: "Clear history",
    restore: "Restore",
    delete: "Delete",
    uploadFile: "Upload image or PDF",
    fileHint: "Image or PDF (max 5MB)",
    summarize: "Summarize",
    outputLanguage: "Output language",
    selectLanguage: "Select language",
    minChars: "Min",
    maxChars: "Max",
    rangeHint: "Character range",
    invalidRange: "Max must be greater than Min",
    selectLangFirst: "Select an output language first",
  },
};

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: Dict;
  dir: "rtl" | "ltr";
}>({
  lang: "ar",
  setLang: () => {},
  toggle: () => {},
  t: translations.ar,
  dir: "rtl",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang, dir]);

  return (
    <I18nCtx.Provider
      value={{ lang, setLang, toggle: () => setLang(lang === "ar" ? "en" : "ar"), t: translations[lang], dir }}
    >
      {children}
    </I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);
