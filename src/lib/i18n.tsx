import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = {
  appTitle: string; tagline: string; originalText: string; uploadImage: string;
  read: string; stop: string; placeholder: string; chars: string; clear: string;
  short: string; long: string; resultShort: string; resultLong: string;
  copy: string; copied: string; footer: string; enterTextFirst: string;
  imageTooLarge: string; noTextFound: string; extracted: string;
  extractFailed: string; unknownError: string; noSpeech: string;
  retry: string; error: string; langToggle: string;
};

const translations: Record<"ar" | "en", Dict> = {
  ar: {
    appTitle: "ملخّص",
    tagline: "أداة ذكية لتلخيص وإعادة صياغة النصوص العربية، قراءتها، واستخراجها من الصور.",
    originalText: "النص الأصلي",
    uploadImage: "رفع صورة",
    read: "قراءة",
    stop: "إيقاف",
    placeholder: "ألصق النص هنا أو ارفع صورة لاستخراج النص منها...",
    chars: "حرف",
    clear: "مسح",
    short: "قصير (≤200 حرف)",
    long: "طويل (300–500 حرف)",
    resultShort: "النتيجة (قصيرة)",
    resultLong: "النتيجة (طويلة)",
    copy: "نسخ",
    copied: "تم النسخ",
    footer: "يعمل على الويب، الجوال، وأنظمة سطح المكتب.",
    enterTextFirst: "الرجاء إدخال نص أولاً",
    imageTooLarge: "حجم الصورة كبير جداً (الحد 8MB)",
    noTextFound: "لم يتم العثور على نص في الصورة",
    extracted: "تم استخراج النص من الصورة",
    extractFailed: "فشل استخراج النص",
    unknownError: "خطأ غير معروف",
    noSpeech: "متصفحك لا يدعم قراءة النص",
    retry: "إعادة المحاولة",
    error: "حدث خطأ",
    langToggle: "EN",
  },
  en: {
    appTitle: "Mulakhas",
    tagline: "Smart tool to summarize, paraphrase, read aloud, and OCR text from images.",
    originalText: "Original Text",
    uploadImage: "Upload Image",
    read: "Read",
    stop: "Stop",
    placeholder: "Paste your text here or upload an image to extract text...",
    chars: "chars",
    clear: "Clear",
    short: "Short (≤200 chars)",
    long: "Long (300–500 chars)",
    resultShort: "Result (Short)",
    resultLong: "Result (Long)",
    copy: "Copy",
    copied: "Copied",
    footer: "Works on Web, Mobile, and Desktop.",
    enterTextFirst: "Please enter some text first",
    imageTooLarge: "Image is too large (max 8MB)",
    noTextFound: "No text found in the image",
    extracted: "Text extracted from image",
    extractFailed: "Failed to extract text",
    unknownError: "Unknown error",
    noSpeech: "Your browser does not support speech",
    retry: "Try again",
    error: "An error occurred",
    langToggle: "ع",
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
