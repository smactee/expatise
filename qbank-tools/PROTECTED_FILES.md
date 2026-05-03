# Protected QBank Files

Some qbank files are production source-of-truth artifacts, not localization scratch files. Localization, matching, backfill, cleanup, tagging, audit, and Codex maintenance tasks must preserve these rules.

## `public/qbank/2023-test1/questions.json`

Status: **HUMAN-LOCKED**

This file is the owner-curated English master question bank. It contains selected natural English wording and canonical question structure.

Allowed:

- Read for matching, audit, coverage, generation prompts, and validation.
- Report suspected issues in audit output.
- Edit only during an explicit human-approved master-data cleanup task.

Disallowed:

- Rewriting prompts during localization or backfill.
- Normalizing OCR artifacts automatically.
- Regenerating this file from `questions.raw.json`.
- Changing answer keys, assets, tags, ordering, or schema as a side effect of localization.
- Applying Codex “fixes” based only on script output.

Safe examples:

- “Report q0934 has invalid ROW answer metadata in an audit.”
- “Use q0962 English prompt as source text for Russian backfill.”

Unsafe examples:

- “Fix all typo-looking prompts while generating Russian.”
- “Rebuild `questions.json` from raw extracted PDF data.”
- “Change a master answer key because a locale answer key differs.”

Required workflow for master edits:

1. Create an explicit task named as a master-data cleanup.
2. Identify each qid and the exact before/after.
3. Preserve evidence from source PDF, existing production behavior, or human owner instruction.
4. Run `npm run guard-protected-qbank-files -- --allow-questions-master-edit true`.
5. Commit master edits separately from localization/report cleanup whenever possible.

## `public/qbank/2023-test1/image-color-tags.json`

Status: **ADDITIVE ONLY**

This file stores reusable image/color/object tagging intelligence. Existing entries are historical evidence and must not be rewritten casually.

Allowed:

- Add a missing qid entry.
- Append new tags to the end of an existing tag array.
- Add new fields while leaving existing fields and values unchanged.

Disallowed:

- Delete existing qid entries.
- Remove existing tags.
- Rename existing tags.
- Replace existing color/object values.
- Reorder existing arrays.
- Rewrite generated metadata such as existing dominant color entries as a side effect.

Safe examples:

- Append `"construction"` to `questions.q0962.objectTags` when all existing entries remain in place.
- Add a new `questions.q0999` tag entry for a newly analyzed image.

Unsafe examples:

- Change an existing `colorTags` value from `"white"` to `"black"`.
- Reorder `objectTags`.
- Replace `dominantByAsset[0].colors[0].color`.

Required workflow for additive tag updates:

1. Make only additive changes.
2. Run `npm run guard-protected-qbank-files`.
3. If the guard reports non-additive paths, revert or split those changes into an explicit human-approved tag repair task.

## Guard Command

Run before localization commits:

```bash
npm run guard-protected-qbank-files
```

For explicit human-approved master-data cleanup only:

```bash
npm run guard-protected-qbank-files -- --allow-questions-master-edit true
```

