# Expatise

**Expatise (Expat + Expertise)** – is a mobile-first driver’s license exam prep app for expats in China, built with Next.js and packaged for Android with Capacitor.

The current product focus is helping non-Chinese speakers prepare for the Chinese driver’s license exam through guided test modes, review tools, progress tracking, and localized study support.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Current Exam Features](#current-exam-features)
  - [In Progress / Planned](#in-progress--planned)
  - [Long-Term Vision](#long-term-vision)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Overview

Expatise is designed for **non-Chinese speakers living in China** who need a simpler, clearer way to prepare for the Chinese driver’s license exam.

The goal is to:

- Make the exam **less intimidating** by providing a clean mobile-first UI, clearer wording, and study flows built around how expats actually prepare.
- Offer multiple ways to study, from **full tests** to **practice, rapid-fire, bookmarks, mistakes, and topic-based review**.
- Help users improve through **progress tracking, readiness signals, and personalized study feedback**.
- Build a strong app-first foundation for practical expat tools in China, starting with driving license prep.

---

## Features

### Current Exam Features

- **Multiple Test Modes**
  - Real Test
  - Practice Test
  - Half Test
  - 10% Test
  - Rapid Fire Test

- **Question Bank & Review**
  - Browse the full question bank
  - Search and filter questions by topic and subtopic
  - Review correct answers
  - Bookmark questions for later study

- **Mistakes Workflows**
  - Revisit your own wrong answers
  - Review globally common mistakes
  - Clear reviewed mistakes from your mistakes view
  - Launch quiz flows based on mistakes or bookmarks

- **Stats & Progress**
  - Personal stats and progress tracking
  - Readiness-focused study views
  - Topic mastery and weak-topic review flows
  - Session-based score and study-time tracking

- **AI Coach**
  - Personalized coaching based on study history and metrics
  - Actionable next-step guidance for improving exam prep

- **Accounts, Premium, and App Support**
  - Guest and account-based usage
  - Premium-gated features
  - Checkout / entitlement flow
  - Login, onboarding, profile, password reset, and account security flows

- **Localization**
  - English support
  - Korean support
  - Additional languages planned for future releases

### In Progress / Planned

- Continued improvement of question wording, categorization, and study UX
- Deeper analytics and more useful coaching output
- Broader localization support
- Ongoing polish for premium, onboarding, and release-readiness flows
- More refinement of review experiences around topic weaknesses and repeated mistakes

### Long-Term Vision

If usage and adoption grow, Expatise may expand into a broader **expat support product** starting in China and, over time, other countries.

Possible future directions include:

- Additional exam-prep products
- Broader language support
- More practical expat-focused utilities
- A wider “toolbox” for navigating everyday life abroad

---

## Tech Stack

- **Next.js 16 (App Router)** — core application framework
- **React 19 + TypeScript** — UI and type-safe application logic
- **Tailwind CSS 4** — styling foundation
- **Capacitor + Android Studio** — Android app packaging and deployment workflow
- **Supabase** — auth and backend services
- **RevenueCat** — premium entitlement and subscription infrastructure
- **OpenAI** — AI coaching functionality
- **Vercel Speed Insights** — performance monitoring

---

## Roadmap

1. **Core Study Experience**
   - Keep improving the main driver’s license prep flows already in place
   - Refine question quality, topic tagging, and review UX
   - Continue optimizing the app for mobile-first use

2. **Progress & Coaching**
   - Expand readiness and topic-level study feedback
   - Improve the usefulness and consistency of AI coaching
   - Make performance feedback easier to act on day to day

3. **Localization**
   - Strengthen the English-first expat experience
   - Continue improving Korean support
   - Add more languages as the content pipeline matures

4. **Platform & Product Maturity**
   - Continue hardening auth, premium flows, legal/compliance pages, and account management
   - Improve reliability, polish, and store-readiness for Android releases

5. **Future Expansion**
   - Explore broader expat-facing utilities once the exam-prep experience is solid
   - Evaluate whether Expatise should stay narrowly focused or evolve into a larger expat utility platform
