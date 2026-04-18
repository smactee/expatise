# Limited Real Next-Language Pilot

Generated at 2026-04-18T15:43:01.909Z using profile `final-targeted`.

## Status

- selected lane: ko/batch-001
- dataset: 2023-test1
- target pilot size: 40
- selection reason: Explicitly requested batch.
- batch dir: imports/ko/batch-001
- screenshots found: 0
- intake items found: 0
- baseline matched/review-needed/unresolved: 0/0/0

## Result

- No real next-language pilot was executed. The selected next-language batch exists, but it contains no screenshots.

## Next Command

- Add screenshots under `imports/ko/batch-001`, then run:
  `node scripts/extract-screenshot-intake.mjs --lang ko --batch batch-001 --dataset 2023-test1`
  `node scripts/run-limited-next-language-pilot.mjs --lang ko --batch batch-001 --dataset 2023-test1 --pilot-size 40 --run-baseline`