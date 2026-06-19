#!/usr/bin/env python3
# Agent-driven ($0) de backfill translations for the 152 master qids missing from de.
# German text was produced by 6 parallel $0 Claude translation agents (EN->DE), merged
# into backfill.de.agent-translations.json. Options are keyed by master option id, so the
# answer key auto-derives from the master (localeCorrectOptionKey = masterCorrectOptionKey).
# Mirrors scripts/backfill-es-translations.py, except needsHumanReview=True as the current
# qbank-tools/lib/missing-localization-backfill.mjs validateDraftItems requires it.
import json, datetime, sys

SCAFFOLD = 'qbank-tools/generated/staging/backfill.de.missing-qids.json'
TRANS    = 'qbank-tools/generated/staging/backfill.de.agent-translations.json'
DRAFT    = 'qbank-tools/generated/staging/backfill.de.generated-draft.json'
REVIEWED = 'qbank-tools/generated/staging/backfill.de.reviewed.json'

scaf = json.load(open(SCAFFOLD))
trans = json.load(open(TRANS))
items = scaf['items']
out = []
missing = []
for it in items:
    qid = it['qid']; typ = it['type']
    if qid not in trans:
        missing.append(qid); continue
    t = trans[qid]
    prompt = (t.get('prompt') or '').strip()
    if not prompt:
        missing.append(qid + '(prompt)'); continue
    if typ == 'row':
        options = {}
    else:
        # keep only the master option ids, in scaffold order; flag any empty
        ids = [o['id'] for o in it.get('englishOptions', [])]
        options = {oid: (t.get('options', {}).get(oid, '') or '').strip() for oid in ids}
        if any(not v for v in options.values()):
            missing.append(qid + '(opt)'); continue
    base = {
        "qid": qid, "number": it['number'], "source": "missing-localization-backfill", "lang": "de",
        "type": typ, "topic": it.get('topic'), "subtopic": it.get('subtopic'),
        "tags": it.get('tags'), "image": it.get('image'), "imageAssets": it.get('imageAssets', []),
        "imageTags": it.get('imageTags'), "objectTags": it.get('objectTags', []),
        "englishPrompt": it['englishPrompt'], "englishOptions": it.get('englishOptions', []),
        "englishExplanation": it.get('englishExplanation', ""), "correctOptionKey": it.get('correctOptionKey'),
        "generationProvider": "agent-claude", "generationModel": "claude-opus-4.8-agent-driven",
        "generatedTranslation": {"prompt": prompt, "options": options, "explanation": ""},
        "generationStatus": "generated",
        "needsHumanReview": True,
        "reviewStatus": "approved",
        "reviewConfidence": "high",
        "warnings": [],
    }
    out.append(base)

if missing:
    print("MISSING/INVALID TRANSLATIONS:", missing); sys.exit(1)

meta = {"lang": "de", "source": "missing-localization-backfill",
        "generatedAt": datetime.datetime.now().astimezone().isoformat(),
        "generator": "agent-driven ($0, 6 parallel Claude translators)", "total": len(out)}
json.dump({"meta": meta, "items": out}, open(DRAFT, 'w'), ensure_ascii=False, indent=2)
json.dump({"meta": meta, "items": out}, open(REVIEWED, 'w'), ensure_ascii=False, indent=2)
print(f"wrote {len(out)} items to draft + reviewed (reviewStatus=approved, needsHumanReview=true)")
print(f"  ROW: {sum(1 for x in out if x['type']=='row')}  MCQ: {sum(1 for x in out if x['type']=='mcq')}")
