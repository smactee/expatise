# Android Release Readiness Report

Generated: 2026-05-14T06:26:48.437Z

## Version

- Current Android versionName/versionCode: 3.2.0 / 13
- Recommended next versionName/versionCode: 3.2.1 / 14
- package.json version: 0.1.0
- Application ID: com.expatise.app

## Validation

- Web build passed: yes
- Capacitor sync passed: yes
- Release Gradle tasks detected: yes
- Upload performed: no

## Signing / Artifact

- Release signing config detected: no
- Keystore files detected: none in repo
- Expected Play Store artifact: AAB via android/app/build/outputs/bundle/release/app-release.aab when app:bundleRelease succeeds

## Blockers

- No release signingConfig was detected in android/app/build.gradle; confirm Play App Signing/upload key setup before building/uploading release AAB.
- No keystore or keystore.properties file was detected in the repo; this may be expected if signing is configured locally/CI, but it is not verifiable here.

## Warnings

- package.json version (0.1.0) differs from Android versionName (3.2.0); Android release uses Gradle versionName.
- android/app/google-services.json is not present; google-services plugin is skipped. This is only a blocker if Firebase/Google services are required for release.

## Next Manual Commands

- Confirm/increment android/app/build.gradle versionName/versionCode when ready, for example 3.2.1 / 14.
- npm run build
- npx cap sync android
- cd android && ./gradlew app:signingReport
- cd android && ./gradlew app:bundleRelease
- Upload android/app/build/outputs/bundle/release/app-release.aab in Google Play Console after signing is confirmed.

