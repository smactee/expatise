# Expatise

**Expatise (Expat + Expertise)** – is a progressive web app built with Next.js that helps expats in China prepare for the local driver’s license exam through clear, localized practice tests and a mobile-first user experience.

The long-term vision is to expand Expatise into a broader “toolbox for expat life” in China — and eventually other countries.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Planned Exam Features](#planned-exam-features)
  - [Future Vision](#future-vision)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Overview

Expatise is designed for **non-Chinese speakers living in China** who need a simple, understandable way to prepare for the Chinese driver’s license exam.

The goal is to:

- Make the exam **less intimidating** by providing clean modern UI, clear wording, and study modes tailored for expats.
- Offer a **PWA** experience that feels like a native app: installable, offline-friendly, and fast.
- Eventually grow into a broader **“toolbox” for expat life in China** and, long term, other countries.

---

## Features

### Planned Exam Features

> These are **planned** features for the first public version of Expatise.

- **Practice Tests**
  - Full-length mock exams modeled after the official Chinese driver’s license test.
  - Timed mode to simulate real exam pressure.

- **Question Bank Explorer**
  - Browse questions by category (traffic signs, laws, scenarios, penalties, etc.).
  - Filter by difficulty or topic.

- **Review & Analytics**
  - See wrong answers and explanations.
  - Track progress over time: weak topics, accuracy, and streaks.

- **Language & Localization**
  - Designed primarily for **expats** (clear English, minimal jargon).
  - Room to add additional languages later (e.g., Korean, Chinese, others).

- **Offline-friendly Study**
  - Core UI and previously loaded questions accessible while offline.
  - Ideal for studying on the subway / in low-signal environments.

### Future Vision

If usage and adoption grows, Expatise may expand into:

- **Expat Toolbox for China**
  - Other license test preps.
  - Used-goods marketplace.
  - Service listings
  - Community resources
  - Shared services and recommendations between expats.
- **Multi-country support**
  - Adapting the model for other countries’ driving exams and expat tools.

---

## Tech Stack

- **Next.js (App Router)** -core framework
- **React + TypeScript** -component logic + type safety
- **Tailwind CSS** styling
- **Node.js**-runtime environment
- **PWA support**-manifest + service worker

---

## Roadmap

1. **MVP (v0.1)**
   - Replace starter PWA content with Expatise branding and basic layout.
   - Implement a minimal practice test using a small, static question set.
   - Ensure a mobile-first, responsive layout that works well on phones.

2. **Question Bank & Study Modes (v0.2–v0.3)**
   - Integrate a larger question bank (subject to licensing and data source).
   - Add categories (signs, rules, penalties, scenarios, etc.).
   - Provide both timed exam mode and untimed practice mode.

3. **Progress & Analytics (v0.4)**
   - Track user performance (accuracy, weak topics, recent attempts).
   - Show a simple progress summary/dashboard.
   - Allow users to revisit previously wrong questions.

4. **Offline & UX Improvements (v0.5)**
   - Improve offline caching strategy for questions and key assets.
   - Polish UI states: loading, errors, empty states, and micro-interactions.
   - Add basic accessibility checks (contrast, keyboard navigation, ARIA where needed).

5. **Expat Toolbox (China) (v0.6+)**
   - Add experimental utilities for expats in China (checklists, quick-reference guides, etc.).
   - Explore early concepts for a used-goods marketplace or other community features.
   - Gather feedback to shape which tools are most valuable.

6. **Multi-country Expansion (Future)**
   - Generalize the data model to support other countries’ exams.
   - Add localization for multiple languages and regions.
   - Explore separate “country profiles” that customize content and flows.

---

