"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  LANGUAGES,
} from "@/config/languages";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Manages core text input, language selection, attachment, and clipboard states.
 */
export function useTranslationFormState() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLangValue, setSourceLangValue] = useState(
    DEFAULT_SOURCE_LANGUAGE,
  );
  const [targetLangValue, setTargetLangValue] = useState(
    DEFAULT_TARGET_LANGUAGE,
  );
  const [modelId, setModelId] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceLang = useMemo(
    () => LANGUAGES.find((l) => l.value === sourceLangValue) || LANGUAGES[0],
    [sourceLangValue],
  );

  const targetLang = useMemo(
    () => LANGUAGES.find((l) => l.value === targetLangValue) || LANGUAGES[1],
    [targetLangValue],
  );

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReset = () => {
    setSourceText("");
    setTranslatedText("");
    setAttachment(null);
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  return {
    sourceText,
    setSourceText,
    translatedText,
    setTranslatedText,
    sourceLangValue,
    setSourceLangValue,
    targetLangValue,
    setTargetLangValue,
    modelId,
    setModelId,
    isCopied,
    attachment,
    setAttachment,
    isExtracting,
    setIsExtracting,
    fileInputRef,
    sourceLang,
    targetLang,
    handleCopy,
    handleReset,
    removeAttachment,
  };
}
