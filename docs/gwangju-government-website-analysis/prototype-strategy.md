# Prototype Strategy

Research date: 2026-05-13 KST

## Recommended Primary Prototype

### A. Website to Prototype From

Gwangsan-gu Office.

Reason:

- It already has the best starting point for an AI pitch: prominent search, `광산 AI 이슈키워드`, large-text controls, multilingual access, clear mobile menu, and service panels.
- It has strong public task pages for `대형폐기물`, `공유 및 시민참여주차장`, `맞춤형 복지정보`, `민원실`, `여권`, `광산문화캘린더`, and `광산일자리여기다`.
- The prototype can be positioned as a reusable district-service pattern for all five gu offices and later the citywide Gwangju portal.

### B. Prototype Concept

AI-powered citizen-service homepage for Gwangsan-gu residents.

Working pitch name: `광산 AI 민원 길잡이`.

Core promise: "A resident can describe their situation in natural Korean and immediately get the correct local process, contact, application link, deadline, documents, and next step."

### C. Core Screens to Build

1. Modern homepage with search/AI assistant as the primary first-screen action.
2. AI assistant answer screen.
3. `대형폐기물` service guide page.
4. Notice summary page.
5. Local benefit finder.
6. Shared parking / parking problem guide.
7. Department/contact result page.
8. Mobile version of the homepage and assistant flow.

### D. Core Demo Flow

Scenario: A resident visits the site and types:

`대형폐기물 버리고 싶어요`

Prototype flow:

1. AI understands the request as `대형폐기물 배출`.
2. It confirms or defaults to `광산구`.
3. It shows the official process:
   - `여기로` app/homepage 신청.
   - Fee/payment guidance.
   - 배출번호 receipt.
   - 배출 placement.
   - 수거.
4. It shows district-specific contact:
   - 청소행정과 or contractor phone from the official page.
5. It links to the official service page and `여기로`.
6. It summarizes related notices if any.
7. It offers `쉬운 한국어`, English, Chinese, Vietnamese, and Russian explanation modes.
8. It provides a `담당자/전화 확인` fallback.

### E. Why This Prototype Will Sell

- Saves citizen time: one natural-language request replaces menu searching.
- Reduces phone calls and wrong visits.
- Makes the government office look modern without requiring an immediate CMS replacement.
- Supports elderly users and foreign residents.
- Demonstrates a platform that can be reused across all gu offices.
- Uses existing official content, so it feels realistic and lower risk.

## Design Direction

### Layout

- First screen: official header, emergency/current alert strip, large AI search bar, top task chips, and compact service cards.
- Avoid a marketing hero. The main experience should be the service interface.
- Keep mayor/office identity present but secondary.

### Visual Tone

- Trustworthy, civic, calm, and modern.
- Use white/blue/green civic palette with restrained accent colors.
- Preserve official identity and local branding; avoid overly commercial SaaS styling.

### Navigation

Primary nav:

- `서비스 찾기`
- `민원/신고`
- `복지/지원`
- `생활/교통/환경`
- `소식/행사`
- `부서/담당자`

Task launcher:

- `쓰레기 배출`
- `여권/증명`
- `주차`
- `복지지원`
- `청년/일자리`
- `보건소`
- `행사`
- `담당자 찾기`

### Search / AI Placement

The assistant should be the dominant first action. Use a prompt like:

`무엇을 도와드릴까요? 예: 대형폐기물 버리고 싶어요`

The assistant answer should always cite official pages and expose non-AI links.

### Mobile

- Sticky compact search.
- Large tap targets.
- Avoid popups above core tasks.
- Use bottom task categories or compact chips.
- Assistant answers should be card-based, not long paragraphs.

### Accessibility

- Large text toggle.
- Simple Korean mode.
- High contrast.
- Keyboard-focusable controls.
- Avoid image-only service cards.
- Multilingual answer mode.

## Technical Prototype Plan

Recommended stack:

- Next.js frontend.
- Static prototype first.
- Mock AI responses.
- Mock service database extracted from observed official pages.
- Reusable components: header, AI search, answer card, source citation, task card, notice summary, benefit finder, mobile drawer.
- Responsive design from the beginning.

Mock data should include:

- Bulky waste service rules for Gwangsan-gu plus comparison rows for other districts.
- Passport/civil-service office hours and contact.
- Shared parking sample table.
- Welfare categories.
- Notice examples.
- Department contacts.

Later integration path:

1. Connect to existing site search/CMS.
2. Add retrieval layer over official pages.
3. Add editorial approval/citation rules.
4. Add analytics for failed searches and top tasks.
5. Add multilingual generation with review guardrails.

## Alternate Prototype Directions

### Alternate 1. Gwangju City Hall District-Aware AI Portal

Concept: A citywide assistant that routes residents to the right district rule.

Best for: Metropolitan-level decision makers.

Strong demo: `대형폐기물` answer shows different contacts/rules for Dong-gu, Seo-gu, Nam-gu, Buk-gu, and Gwangsan-gu.

Risk: Broader scope means harder to make credible without more data.

### Alternate 2. Nam-gu Service-First Homepage Replacement

Concept: Replace the root portal selector with a direct service-first homepage while preserving links to mayor office, manifesto, health center, library, and sports reservation.

Best for: A dramatic before/after pitch.

Strong demo: User lands on `namgu.gwangju.kr` and immediately sees `검색`, `전자민원`, `복지`, `주차`, `일자리`, and AI task help.

Risk: Less AI-specific than Gwangsan unless assistant is emphasized.

## Prototype Validation Plan

Before presenting:

- Verify all copied official facts against current official pages.
- Label mock AI answers as prototype content.
- Test desktop and mobile screenshots.
- Test flows for at least:
  - `대형폐기물 버리고 싶어요`
  - `여권 만들고 싶어요`
  - `주차 문제 신고`
  - `청년 지원 받고 싶어요`
  - `담당자 찾기`
- Include a slide/page showing "Official source linked" to avoid AI trust concerns.

