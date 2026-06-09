//messages/index.ts

import type { MessageSchema } from '@/lib/i18n/types';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';

export type AppMessages = MessageSchema<typeof en>;

export type LocaleDefinition<TMessages = AppMessages> = {
  label: string;
  messages: TMessages;
};

// Add new locales by importing the messages file above and registering it here.
export const LOCALE_REGISTRY = {
  en: {
    label: 'English',
    messages: en,
  },
  ko: {
    label: '한국어',
    messages: ko,
  },
  ja: {
    label: '日本語（ベータ）',
    messages: ja,
  },
  fr: {
    label: 'Français',
    messages: fr,
  },
  es: {
    label: 'Español',
    messages: es,
  },
  de: {
    label: 'Deutsch (Beta)',
    messages: de,
  },
  // British Chinglish: the verbatim pre-correction PDF extract, surfaced as a
  // selectable question language. UI chrome stays English (reuses `en` messages);
  // only the qbank question/option text differs (see translations.en-orig.json).
  'en-orig': {
    label: 'British Chinglish, (original test version)',
    messages: en,
  },
} as const satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof LOCALE_REGISTRY;

export const DEFAULT_LOCALE = 'en' as const satisfies Locale;
