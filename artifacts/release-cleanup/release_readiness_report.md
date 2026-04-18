# Release Readiness Report

Generated at 2026-04-18T16:38:45.961Z for dataset `2023-test1`.

Overall status: **ready**

## Checks

- Runtime dataset files present: PASSED
  Required for: runtime, deploy, android-release
  Note: Found runtime qbank files under public/qbank/2023-test1.
- .vercelignore deploy exclusions: PASSED
  Required for: deploy
  Note: Recommended non-runtime exclusions are present.
- TypeScript check: PASSED
  Required for: build, deploy
  Note: TypeScript check passed.
  Command: `./node_modules/.bin/tsc --noEmit`
- Next.js build: PASSED
  Required for: build, deploy, android-release
  Note: Next.js production build succeeded.
  Command: `./node_modules/.bin/next build --webpack`
- Android release config files present: PASSED
  Required for: android-release
  Note: Found Capacitor and Gradle project files required for Android packaging.
- Android bundleRelease dry-run: PASSED
  Required for: android-release
  Note: Gradle bundleRelease dry-run succeeded.
  Command: `./android/gradlew -p android app:bundleRelease -m`

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

## Archive / Exclude Candidates

- Qbank maintenance source files: EXCLUDE_FROM_DEPLOY_UPLOAD (1.02 MB)
  Paths: public/qbank/2023-test1/questions.raw.json
  Recommended action: keep-local-only
  Reason: These files are used by qbank maintenance scripts and image/source workflows, but the deployed app does not fetch them.
- Workflow scripts and qbank tooling: EXCLUDE_FROM_DEPLOY_UPLOAD (0.97 MB)
  Paths: qbank-tools/lib, scripts
  Recommended action: keep-local-only
  Reason: These scripts drive review, cleanup, validation, and qbank maintenance. They are developer tooling, not runtime code.
- Japanese review intelligence package: ARCHIVE_KEEP (4.95 MB)
  Paths: artifacts/japanese-review-intelligence
  Recommended action: keep-archived
  Reason: This compact package is the reusable learning layer distilled from the Japanese workflow and should be preserved intact.
- Next-language pilot artifacts: ARCHIVE_KEEP (0.55 MB)
  Paths: artifacts/next-language-pilot
  Recommended action: keep-archived
  Reason: These pilot/adversarial/calibration artifacts are not runtime data, but they preserve the current transfer-validation history.
- Generated archive tree: ARCHIVE_KEEP (37.47 MB)
  Paths: qbank-tools/generated/archive
  Recommended action: keep-archived
  Reason: This tree is already the long-term landing zone for archived review outputs and should remain preserved.
- Japanese import source tree: SAFE_TO_ARCHIVE_NOW (588.75 MB)
  Paths: imports/ja
  Recommended action: archive
  Reason: This is the heaviest completed review source material and is not needed for app runtime, web deploy, or Android release packaging.
- Generated review reports: SAFE_TO_ARCHIVE_NOW (2.04 MB)
  Paths: qbank-tools/generated/reports
  Recommended action: archive
  Reason: Workbench HTML and generated report files are historical review outputs and can move out of the active workspace.
- Generated review staging: SAFE_TO_ARCHIVE_NOW (7.89 MB)
  Paths: qbank-tools/generated/staging
  Recommended action: archive
  Reason: Staging decision/preview trees are valuable history but not part of runtime or release packaging.
- Existing Android release bundle output: SAFE_TO_ARCHIVE_NOW (42.94 MB)
  Paths: android/app/release
  Recommended action: archive
  Reason: The current AAB is a release artifact, not source. Archive it outside the active tree before generating the next one.
- Unreferenced public .orig image copies: SAFE_TO_ARCHIVE_NOW (9.85 MB)
  Paths: public/qbank/2023-test1/images/img_000d6d639264ebc0ad3be1eb876c9af3.orig.jpeg, public/qbank/2023-test1/images/img_016189bcd1b755d9b3bb465fb8a678ef.orig.jpeg, public/qbank/2023-test1/images/img_0163e0a727cf534758ac667450edb8a4.orig.jpeg, public/qbank/2023-test1/images/img_01f5d51eb306f0c286566cabae215a71.orig.jpeg, public/qbank/2023-test1/images/img_03be883c0b895c93b4a7b923c25b1e8e.orig.jpeg, public/qbank/2023-test1/images/img_03d43fffd64d0dea86e3aded8ecc746a.orig.jpeg ... (+458 more)
  Recommended action: archive
  Reason: These source-original copies live under public but are not referenced by questions.json. They are good archive candidates and should be excluded from deploy upload.
- Finder/OS clutter: SAFE_TO_DELETE_AFTER_ARCHIVE (0.75 MB)
  Paths: .DS_Store, android/.DS_Store, android/app/.DS_Store, android/app/src/main/assets/public/.DS_Store, android/app/src/main/assets/public/assets/.DS_Store, android/app/src/main/assets/public/images/.DS_Store ... (+58 more)
  Recommended action: delete-only-after-archive
  Reason: These files are pure OS clutter and provide no runtime or workflow value.
- Local Next export output: SAFE_TO_DELETE_AFTER_ARCHIVE (45.88 MB)
  Paths: out
  Recommended action: delete-only-after-archive
  Reason: The exported web bundle is generated by next build and can be regenerated at any time.
- Copied Android web assets: SAFE_TO_DELETE_AFTER_ARCHIVE (43.36 MB)
  Paths: android/app/src/main/assets/public
  Recommended action: delete-only-after-archive
  Reason: This directory is generated by Capacitor sync/build and mirrors web assets into Android. It can be regenerated.
