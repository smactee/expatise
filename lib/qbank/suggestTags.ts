import type { Question } from './types';
import { TAG_KEYWORDS, type CanonicalTagId } from './tagDictionary';

const norm = (s: string) => s.toLowerCase();

export function suggestTags(q: Question): CanonicalTagId[] {
  const out = new Set<CanonicalTagId>();

  // type tags
  out.add(q.type === 'MCQ' ? 'mcq' : 'row');

  // media
  if (q.assets.length > 0) out.add('pic');

  const text = norm(q.prompt);

  (Object.keys(TAG_KEYWORDS) as CanonicalTagId[]).forEach((tag) => {
    const kws = TAG_KEYWORDS[tag];
    if (!kws.length) return;
    if (kws.some((kw) => text.includes(norm(kw)))) out.add(tag);
  });

  return [...out];
}
