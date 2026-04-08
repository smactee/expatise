//messages/index.ts

import type { MessageSchema } from '@/lib/i18n/types';

import { en } from './en';
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
} as const satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof LOCALE_REGISTRY;

export const DEFAULT_LOCALE = 'en' as const satisfies Locale;
