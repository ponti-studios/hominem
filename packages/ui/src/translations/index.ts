import { UI_TRANSLATIONS_EN } from "./en";

type TranslationValue = string | number | boolean;
type TranslationOptions = Record<string, TranslationValue>;

function getTranslationValue(key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }

    return undefined;
  }, UI_TRANSLATIONS_EN);
}

export function registerUiTranslations() {
  return UI_TRANSLATIONS_EN;
}

export function translateUi(key: string, options?: TranslationOptions) {
  const value = getTranslationValue(key);
  if (typeof value !== "string") {
    return key;
  }

  return value.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token: string) => {
    const replacement = options?.[token];
    return replacement === undefined ? "" : String(replacement);
  });
}

export { UI_TRANSLATIONS_EN };
