# Release Cleanup Applied Summary

Generated at 2026-04-18T16:38:50.427Z for dataset `2023-test1`.

Mode: applied
Archive root: qbank-tools/generated/archive/release-cleanup/2026-04-18T16-38-50-344Z
Archived operations: 468
Delete operations: 0

## Archived / Moved

- imports
- qbank-tools/generated
- android/app
- public/qbank

## Stayed Active

- Web app source: app, components, lib, messages
- Web/build config: capacitor.config.ts, next-env.d.ts, next.config.ts, package-lock.json, package.json, postcss.config.mjs ... (+1 more)
- Runtime public assets: public/assets, public/images, public/qbank/2023-test1/image-color-tags.json, public/qbank/2023-test1/images, public/qbank/2023-test1/questions.json, public/qbank/2023-test1/tags.patch.json ... (+3 more)
- Qbank maintenance source files: public/qbank/2023-test1/questions.raw.json
- Workflow scripts and qbank tooling: qbank-tools/lib, scripts
- Non-Japanese intake lane: imports/ko

## Still Excluded From Deploy Upload

- Qbank maintenance source files: public/qbank/2023-test1/questions.raw.json
- Workflow scripts and qbank tooling: qbank-tools/lib, scripts
- Android project and local SDK binding: android
- Non-Japanese intake lane: imports/ko
- Japanese review intelligence package: artifacts/japanese-review-intelligence
- Next-language pilot artifacts: artifacts/next-language-pilot
- Generated archive tree: qbank-tools/generated/archive
- Japanese import source tree: imports/ja
- Generated review reports: qbank-tools/generated/reports
- Generated review staging: qbank-tools/generated/staging
- Existing Android release bundle output: android/app/release
- Unreferenced public .orig image copies: public/qbank/2023-test1/images/img_000d6d639264ebc0ad3be1eb876c9af3.orig.jpeg, public/qbank/2023-test1/images/img_016189bcd1b755d9b3bb465fb8a678ef.orig.jpeg, public/qbank/2023-test1/images/img_0163e0a727cf534758ac667450edb8a4.orig.jpeg, public/qbank/2023-test1/images/img_01f5d51eb306f0c286566cabae215a71.orig.jpeg, public/qbank/2023-test1/images/img_03be883c0b895c93b4a7b923c25b1e8e.orig.jpeg, public/qbank/2023-test1/images/img_03d43fffd64d0dea86e3aded8ecc746a.orig.jpeg ... (+458 more)
- Finder/OS clutter: .DS_Store, android/.DS_Store, android/app/.DS_Store, android/app/src/main/assets/public/.DS_Store, android/app/src/main/assets/public/assets/.DS_Store, android/app/src/main/assets/public/images/.DS_Store ... (+58 more)
- Local Next export output: out
- Copied Android web assets: android/app/src/main/assets/public

## Notes

- Delete-after-archive candidates were intentionally left untouched in this run.
- Only manifest-approved archive moves were applied; no hard deletions were performed by default.
