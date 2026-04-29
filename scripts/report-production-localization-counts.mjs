import fs from 'node:fs';
import path from 'node:path';

const TRANSLATION_DIR = path.join(process.cwd(), 'public/qbank/2023-test1');

const LANGUAGES = [
  { code: 'ko', label: 'Korean', file: 'translations.ko.json' },
  { code: 'ja', label: 'Japanese', file: 'translations.ja.json' },
  { code: 'ru', label: 'Russian', file: 'translations.ru.json' },
  { code: 'zh', label: 'Chinese', file: 'translations.zh.json' },
  { code: 'es', label: 'Spanish', file: 'translations.es.json' },
];

function countUsableTranslatedQuestions(raw) {
  const questions = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw.questions ?? raw
    : null;

  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    return 0;
  }

  return Object.values(questions).filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return typeof entry.prompt === 'string' && entry.prompt.trim().length > 0;
  }).length;
}

console.log('Production qbank localization counts (2023-test1):');

for (const language of LANGUAGES) {
  const filePath = path.join(TRANSLATION_DIR, language.file);

  if (!fs.existsSync(filePath)) {
    console.log(`${language.label}: 0 (${language.file} not present)`);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`${language.label}: ${countUsableTranslatedQuestions(raw)}`);
}
