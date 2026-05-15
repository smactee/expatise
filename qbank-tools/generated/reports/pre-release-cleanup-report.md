# Pre-release Cleanup Report

Generated: 2026-05-15T07:42:57.043Z

## Outcome

- qbank integrity audit: passed, 0 critical blockers, 19 warnings.
- Build: passed.
- Capacitor Android sync: passed.
- Hard-deleted files: 0.

## Size Summary

|Metric|Before|After|Delta|
|---|---:|---:|---:|
|out/|55.1 MB|46.1 MB|-9.08 MB|
|source maps in out/|9.19 MB|113.0 KB|reduced|
|Android web assets|55.1 MB|46.1 MB|after cap sync|
|imports/fr working tree artifacts|644 MB observed before cleanup|8.16 KB|archived|

## Safe Optimizations Applied

- Disabled production browser source maps in next.config.ts. Source maps in out dropped from 66 files / 9.19 MB to 1 files / 113.0 KB.
- Archived regenerable French batch directories out of imports/fr. 19 batch dirs, 992 files, 902 screenshots, 642.0 MB moved to archive.

## French Preservation

- Decision bundle: `qbank-tools/history/fr-decision-bundle-20260515T164028+0900`
- Decision bundle files: 352 (77.95 MB)
- Cleanup archive: `qbank-tools/generated/archive/fr/pre-release-cleanup-20260515T164028+0900`
- Archived batch directories: 19
- Archived screenshots: 902
- Archived total files: 992
- Archived size: 642.0 MB

## Shipped Generated Artifact Check

Generated report/staging/import files found in `out/`: 0.

## Largest Remaining Qbank Images

|path|size|bytes|
|---|---|---|
|public/qbank/2023-test1/images/p59-638.png|312.7 KB|320199|
|public/qbank/2023-test1/images/img_8a1ecb217a73dc66d6b053c0f0d691e1.jpeg|239.2 KB|244925|
|public/qbank/2023-test1/images/img_a123f96a5e756eef08f7abc6b2d765b1.jpeg|223.2 KB|228607|
|public/qbank/2023-test1/images/img_97eafa9b7591870879419b31853e0c33.png|222.4 KB|227687|
|public/qbank/2023-test1/images/img_49222e285638a0de0ce9af26c17ce473.png|219.9 KB|225199|
|public/qbank/2023-test1/images/img_8222d61bfd3c0ad92c9e5347c7541e06.png|219.3 KB|224523|
|public/qbank/2023-test1/images/p65-677.png|190.7 KB|195296|
|public/qbank/2023-test1/images/img_replacement_q0876_688845c8900b.jpeg|151.7 KB|155388|
|public/qbank/2023-test1/images/img_71e9c9f575a4363ecf3aaa56063a7ad4.png|146.9 KB|150451|
|public/qbank/2023-test1/images/img_1fe3cb75793b614923e3ab91c8d834fc.png|146.2 KB|149695|


## Largest Remaining Qbank JSON

|path|size|bytes|
|---|---|---|
|public/qbank/2023-test1/translations.ru.json|2.79 MB|2925231|
|public/qbank/2023-test1/translations.fr.json|2.46 MB|2583725|
|public/qbank/2023-test1/translations.ja.json|2.41 MB|2525124|
|public/qbank/2023-test1/questions.json|1.26 MB|1325285|
|public/qbank/2023-test1/questions.raw.json|1.05 MB|1101669|
|public/qbank/2023-test1/translations.ko.json|545.5 KB|558588|
|public/qbank/2023-test1/image-color-tags.json|492.5 KB|504316|
|public/qbank/2023-test1/image-tag-locales.json|63.9 KB|65482|
|public/qbank/2023-test1/tags.patch.json|28.2 KB|28830|


## Deferred

- Mass qbank image recompression/conversion: useful but needs visual QA, especially for sign readability.
- Qbank/translation JSON lazy-load architecture changes: possible post-release, but too risky immediately before Play Store upload.
- Deleting generated reports/staging: not shipped in out/ and useful for release traceability.
- Removing the last small .map file manually from out/: only 113 KB remains, likely emitted by Next/Turbopack; not worth a custom postbuild hook before release.

## Remaining Risks

- qbank integrity audit reports 19 warnings but 0 critical blockers; review warnings separately if release policy requires warning-free output.
- The shipped app still includes about 34.5 MB of qbank data/images; deeper reductions should be post-release work with visual and offline-loading QA.
