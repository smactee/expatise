# Expatise

**Expatise (Expat + Expertise)** is a mobile-first driver's license exam prep app for expats in China, built with Next.js and packaged for Android with Capacitor.

The current product focus is helping non-Chinese speakers prepare for the Chinese driver's license exam through guided test modes, review tools, progress tracking, premium study features, and localized study support.

---

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Features](#features)
  - [Exam Prep](#exam-prep)
  - [Review Workflows](#review-workflows)
  - [Stats, Coaching, and Sync](#stats-coaching-and-sync)
  - [Accounts, Premium, and App Support](#accounts-premium-and-app-support)
  - [Localization](#localization)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Roadmap](#roadmap)

---

## Overview

Expatise is designed for **non-Chinese speakers living in China** who need a simpler, clearer way to prepare for the Chinese driver's license exam.

The goal is to:

- Make the exam **less intimidating** by providing a clean mobile-first UI, clearer wording, and study flows built around how expats actually prepare.
- Offer multiple ways to study, from **full tests** to **practice, rapid-fire, bookmarks, mistakes, and topic-based review**.
- Help users improve through **progress tracking, readiness signals, topic mastery, and personalized study feedback**.
- Build a strong app-first foundation for practical expat tools in China, starting with driving license prep.

---

## Current Status

The app currently includes a **985-question China 2023 Test 1 question bank** with full English-first study flows and a Korean question-bank translation. Japanese is available as a beta locale for the translated subset of the bank.

The product is implemented as a static-exportable Next.js app for Capacitor Android packaging, with Supabase-backed auth, premium entitlement support, RevenueCat integration, and Supabase Edge Functions for coach, entitlement, account deletion, stats reset, and RevenueCat webhook workflows.

Localization tooling has also grown beyond the app UI: the repository includes screenshot intake, matching, review, staging, and merge scripts for expanding translated question-bank coverage.

---

## Features

### Exam Prep

- **Multiple test modes**
  - Real Test: 100 questions, 45 minutes
  - Half Test: 50 questions, 23 minutes
  - 10% Test: 10 questions, 5 minutes
  - Practice Test: 20 questions, untimed
  - Rapid Fire Test: 100 questions, 10 minutes, timed auto-advance
  - Mistakes Test
  - Bookmarks Test
  - Topic Quiz

- **Question bank**
  - Browse the full question bank
  - Search by text, question number, image-related tags, topic, and subtopic
  - Filter by topic and subtopic
  - Review answers and explanations where available
  - Bookmark questions for later study

### Review Workflows

- Revisit personal wrong answers
- Review globally common mistakes
- Clear reviewed mistakes from the mistakes view
- Launch quiz flows based on mistakes, bookmarks, or weak topics
- Track repeated mistakes and prioritize recent problem areas

### Stats, Coaching, and Sync

- Personal stats and progress tracking
- Readiness-focused study views
- Score, study-time, daily progress, heatmap, and topic mastery charts
- Weak-topic review flow that can start a topic-focused quiz
- AI coach report based on study history and metrics
- Local-first attempt tracking with Supabase sync support for attempts and time logs

### Accounts, Premium, and App Support

- Guest and account-based usage
- Supabase auth with login, onboarding, profile, password reset, and account security flows
- Premium-gated study areas with free usage caps
- RevenueCat-backed native purchase and entitlement flow
- Checkout, success, premium, privacy, terms, account deletion, and account security pages
- Android packaging through Capacitor with app id `com.expatise.app`

### Localization

- English app UI and question-bank support
- Korean app UI and full question-bank translation
- Japanese beta app UI and translated-subset question-bank support
- Pending UI language options for Chinese, Spanish, Russian, French, German, and Arabic
- Screenshot-to-localization pipeline for adding and reviewing future translated question batches

---

## Tech Stack

- **Next.js 16 (App Router, static export)** - core application framework
- **React 19 + TypeScript** - UI and type-safe application logic
- **Tailwind CSS 4** - styling foundation
- **Capacitor 8 + Android Studio** - Android app packaging and deployment workflow
- **Supabase** - auth, backend services, and Edge Functions
- **RevenueCat** - premium entitlement and subscription infrastructure
- **OpenAI** - AI coaching and localization-assist tooling
- **Vercel Speed Insights** - performance monitoring

---

## Local Development

Install dependencies:

```bash
npm install
```

Run the web app locally:

```bash
npm run dev
```

Build the static export used by Capacitor:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Useful qbank localization scripts include:

```bash
npm run build-match-index
npm run extract-screenshot-intake -- --lang ja --batch batch-001
npm run process-screenshot-batch -- --lang ja --batch batch-001
npm run generate-batch-workbench -- --lang ja --batch batch-001
```

Environment variables are required for the connected backend, payment, and AI flows. See the code paths that reference `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID`, `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, and the Supabase Edge Function secrets for RevenueCat and service-role workflows.

---

## Roadmap

1. **Core Study Experience**
   - Keep improving the driver license prep flows already in place
   - Refine question quality, answer explanations, topic tagging, and review UX
   - Continue optimizing the app for mobile-first and native Android use

2. **Progress & Coaching**
   - Expand readiness and topic-level study feedback
   - Improve the usefulness, consistency, and localization of AI coaching
   - Make performance feedback easier to act on day to day

3. **Localization**
   - Strengthen the English-first expat experience
   - Continue improving Korean support
   - Expand Japanese beta coverage toward a full translated bank
   - Add more languages as the localization pipeline matures

4. **Platform & Product Maturity**
   - Continue hardening auth, premium flows, legal/compliance pages, and account management
   - Improve reliability, entitlement verification, release polish, and store-readiness for Android

5. **Future Expansion**
   - Explore broader expat-facing utilities once the exam-prep experience is solid
   - Evaluate whether Expatise should stay narrowly focused or evolve into a larger expat utility platform
