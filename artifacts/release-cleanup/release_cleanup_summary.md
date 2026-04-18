# Release Cleanup Summary

Generated at 2026-04-18T16:25:38.113Z.

This is a dry-run cleanup/archive plan. No files were moved or deleted.

## MUST_KEEP_ACTIVE

- Web app source: app, components, lib, messages
  Why it must stay: This is the live Next.js/Capacitor application source. It must remain for runtime behavior, builds, deploys, and Android web bundle generation.
  What breaks if removed/excluded: The app stops building and the deployed/runtime UI breaks.
  Required for: runtime, build, deploy, android-release
- Web/build config: capacitor.config.ts, next-env.d.ts, next.config.ts, package-lock.json, package.json, postcss.config.mjs ... (+1 more)
  Why it must stay: These config files define the package graph, Next.js build, TypeScript compile, and Capacitor bridge setup.
  What breaks if removed/excluded: Build, deploy, or Android packaging commands stop working or produce the wrong output.
  Required for: build, deploy, android-release
- Runtime public assets: public/assets, public/images, public/qbank/2023-test1/image-color-tags.json, public/qbank/2023-test1/images, public/qbank/2023-test1/questions.json, public/qbank/2023-test1/tags.patch.json ... (+3 more)
  Why it must stay: These files are fetched or rendered by the live app: qbank JSON, translations, image tags, and the public UI/media assets.
  What breaks if removed/excluded: Questions, translations, image search tags, or visible app assets fail at runtime.
  Required for: runtime, build, deploy, android-release
- Qbank maintenance source files: public/qbank/2023-test1/questions.raw.json
  Why it must stay: These files are used by qbank maintenance scripts and image/source workflows, but the deployed app does not fetch them.
  What breaks if removed/excluded: Qbank regeneration and maintenance workflows lose their local source-of-truth inputs.
  Required for: maintenance
- Workflow scripts and qbank tooling: qbank-tools/lib, scripts
  Why it must stay: These scripts drive review, cleanup, validation, and qbank maintenance. They are developer tooling, not runtime code.
  What breaks if removed/excluded: You lose the ability to regenerate qbank artifacts, run review flows, or repeat release-cleanup validation locally.
  Required for: maintenance
- Non-Japanese intake lane: imports/ko
  Why it must stay: This is the only real next-language intake lane currently present in the repo, and it is tiny.
  What breaks if removed/excluded: Limited next-language pilot work cannot resume from the current repo state without recreating the KO intake lane.
  Required for: maintenance

## MUST_KEEP_FOR_DEPLOY

- Web app source: app, components, lib, messages
  Why it must stay: This is the live Next.js/Capacitor application source. It must remain for runtime behavior, builds, deploys, and Android web bundle generation.
  What breaks if removed/excluded: The app stops building and the deployed/runtime UI breaks.
  Required for: runtime, build, deploy, android-release
- Web/build config: capacitor.config.ts, next-env.d.ts, next.config.ts, package-lock.json, package.json, postcss.config.mjs ... (+1 more)
  Why it must stay: These config files define the package graph, Next.js build, TypeScript compile, and Capacitor bridge setup.
  What breaks if removed/excluded: Build, deploy, or Android packaging commands stop working or produce the wrong output.
  Required for: build, deploy, android-release
- Runtime public assets: public/assets, public/images, public/qbank/2023-test1/image-color-tags.json, public/qbank/2023-test1/images, public/qbank/2023-test1/questions.json, public/qbank/2023-test1/tags.patch.json ... (+3 more)
  Why it must stay: These files are fetched or rendered by the live app: qbank JSON, translations, image tags, and the public UI/media assets.
  What breaks if removed/excluded: Questions, translations, image search tags, or visible app assets fail at runtime.
  Required for: runtime, build, deploy, android-release

## MUST_KEEP_FOR_ANDROID_RELEASE

- Web app source: app, components, lib, messages
  Why it must stay: This is the live Next.js/Capacitor application source. It must remain for runtime behavior, builds, deploys, and Android web bundle generation.
  What breaks if removed/excluded: The app stops building and the deployed/runtime UI breaks.
  Required for: runtime, build, deploy, android-release
- Web/build config: capacitor.config.ts, next-env.d.ts, next.config.ts, package-lock.json, package.json, postcss.config.mjs ... (+1 more)
  Why it must stay: These config files define the package graph, Next.js build, TypeScript compile, and Capacitor bridge setup.
  What breaks if removed/excluded: Build, deploy, or Android packaging commands stop working or produce the wrong output.
  Required for: build, deploy, android-release
- Runtime public assets: public/assets, public/images, public/qbank/2023-test1/image-color-tags.json, public/qbank/2023-test1/images, public/qbank/2023-test1/questions.json, public/qbank/2023-test1/tags.patch.json ... (+3 more)
  Why it must stay: These files are fetched or rendered by the live app: qbank JSON, translations, image tags, and the public UI/media assets.
  What breaks if removed/excluded: Questions, translations, image search tags, or visible app assets fail at runtime.
  Required for: runtime, build, deploy, android-release
- Android project and local SDK binding: android
  Why it must stay: This is the actual Capacitor Android project, Gradle wrapper, and local SDK binding used for release packaging.
  What breaks if removed/excluded: Android sync, bundle generation, and release packaging stop working.
  Required for: android-release

## SAFE_TO_ARCHIVE_NOW

- Japanese import source tree: imports/ja (588.75 MB)
  Reason: This is the heaviest completed review source material and is not needed for app runtime, web deploy, or Android release packaging.
- Generated review reports: qbank-tools/generated/reports (2.04 MB)
  Reason: Workbench HTML and generated report files are historical review outputs and can move out of the active workspace.
- Generated review staging: qbank-tools/generated/staging (7.89 MB)
  Reason: Staging decision/preview trees are valuable history but not part of runtime or release packaging.
- Existing Android release bundle output: android/app/release (42.94 MB)
  Reason: The current AAB is a release artifact, not source. Archive it outside the active tree before generating the next one.
- Unreferenced public .orig image copies: public/qbank/2023-test1/images/img_000d6d639264ebc0ad3be1eb876c9af3.orig.jpeg, public/qbank/2023-test1/images/img_016189bcd1b755d9b3bb465fb8a678ef.orig.jpeg, public/qbank/2023-test1/images/img_0163e0a727cf534758ac667450edb8a4.orig.jpeg, public/qbank/2023-test1/images/img_01f5d51eb306f0c286566cabae215a71.orig.jpeg, public/qbank/2023-test1/images/img_03be883c0b895c93b4a7b923c25b1e8e.orig.jpeg, public/qbank/2023-test1/images/img_03d43fffd64d0dea86e3aded8ecc746a.orig.jpeg ... (+458 more) (9.85 MB)
  Reason: These source-original copies live under public but are not referenced by questions.json. They are good archive candidates and should be excluded from deploy upload.

## ARCHIVE_KEEP

- Japanese review intelligence package: artifacts/japanese-review-intelligence (4.95 MB)
  Reason: This compact package is the reusable learning layer distilled from the Japanese workflow and should be preserved intact.
- Next-language pilot artifacts: artifacts/next-language-pilot (0.55 MB)
  Reason: These pilot/adversarial/calibration artifacts are not runtime data, but they preserve the current transfer-validation history.
- Generated archive tree: qbank-tools/generated/archive (37.47 MB)
  Reason: This tree is already the long-term landing zone for archived review outputs and should remain preserved.

## EXCLUDE_FROM_DEPLOY_UPLOAD

- Qbank maintenance source files: public/qbank/2023-test1/questions.raw.json
  Reason: These files are used by qbank maintenance scripts and image/source workflows, but the deployed app does not fetch them.
- Workflow scripts and qbank tooling: qbank-tools/lib, scripts
  Reason: These scripts drive review, cleanup, validation, and qbank maintenance. They are developer tooling, not runtime code.
- Android project and local SDK binding: android
  Reason: This is the actual Capacitor Android project, Gradle wrapper, and local SDK binding used for release packaging.
- Non-Japanese intake lane: imports/ko
  Reason: This is the only real next-language intake lane currently present in the repo, and it is tiny.
- Japanese review intelligence package: artifacts/japanese-review-intelligence
  Reason: This compact package is the reusable learning layer distilled from the Japanese workflow and should be preserved intact.
- Next-language pilot artifacts: artifacts/next-language-pilot
  Reason: These pilot/adversarial/calibration artifacts are not runtime data, but they preserve the current transfer-validation history.
- Generated archive tree: qbank-tools/generated/archive
  Reason: This tree is already the long-term landing zone for archived review outputs and should remain preserved.
- Japanese import source tree: imports/ja
  Reason: This is the heaviest completed review source material and is not needed for app runtime, web deploy, or Android release packaging.
- Generated review reports: qbank-tools/generated/reports
  Reason: Workbench HTML and generated report files are historical review outputs and can move out of the active workspace.
- Generated review staging: qbank-tools/generated/staging
  Reason: Staging decision/preview trees are valuable history but not part of runtime or release packaging.
- Existing Android release bundle output: android/app/release
  Reason: The current AAB is a release artifact, not source. Archive it outside the active tree before generating the next one.
- Unreferenced public .orig image copies: public/qbank/2023-test1/images/img_000d6d639264ebc0ad3be1eb876c9af3.orig.jpeg, public/qbank/2023-test1/images/img_016189bcd1b755d9b3bb465fb8a678ef.orig.jpeg, public/qbank/2023-test1/images/img_0163e0a727cf534758ac667450edb8a4.orig.jpeg, public/qbank/2023-test1/images/img_01f5d51eb306f0c286566cabae215a71.orig.jpeg, public/qbank/2023-test1/images/img_03be883c0b895c93b4a7b923c25b1e8e.orig.jpeg, public/qbank/2023-test1/images/img_03d43fffd64d0dea86e3aded8ecc746a.orig.jpeg ... (+458 more)
  Reason: These source-original copies live under public but are not referenced by questions.json. They are good archive candidates and should be excluded from deploy upload.
- Finder/OS clutter: .DS_Store, android/.DS_Store, android/app/.DS_Store, android/app/src/main/assets/public/.DS_Store, android/app/src/main/assets/public/assets/.DS_Store, android/app/src/main/assets/public/images/.DS_Store ... (+58 more)
  Reason: These files are pure OS clutter and provide no runtime or workflow value.
- Local Next export output: out
  Reason: The exported web bundle is generated by next build and can be regenerated at any time.
- Copied Android web assets: android/app/src/main/assets/public
  Reason: This directory is generated by Capacitor sync/build and mirrors web assets into Android. It can be regenerated.

## SAFE_TO_DELETE_AFTER_ARCHIVE

- Finder/OS clutter: .DS_Store, android/.DS_Store, android/app/.DS_Store, android/app/src/main/assets/public/.DS_Store, android/app/src/main/assets/public/assets/.DS_Store, android/app/src/main/assets/public/images/.DS_Store ... (+58 more) (0.75 MB)
  Reason: These files are pure OS clutter and provide no runtime or workflow value.
- Local Next export output: out (45.88 MB)
  Reason: The exported web bundle is generated by next build and can be regenerated at any time.
- Copied Android web assets: android/app/src/main/assets/public (43.36 MB)
  Reason: This directory is generated by Capacitor sync/build and mirrors web assets into Android. It can be regenerated.

## Vercel Upload Notes

- The recommended .vercelignore patterns are present.
