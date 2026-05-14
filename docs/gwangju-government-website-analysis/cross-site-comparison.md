# Cross-Site Comparison

Research date: 2026-05-13 KST

Scores are directional UX research scores based on public browsing evidence, search/task testing, mobile screenshots, and frontend observations. They are not analytics-derived.

## Comparison Table

| Website | Overall UX score out of 10 | Homepage clarity | Navigation clarity | Search quality | Mobile experience | Citizen-task convenience | Visual modernization need | AI maturity level | Biggest strength | Biggest weakness | Best prototype opportunity |
|---|---:|---|---|---|---|---|---|---|---|---|---|
| Gwangju City Hall | 7.0 | Good | Good | Good retrieval | Good | Medium-high | Medium | Level 1 | Strong search and citywide service inventory | Announcements, mayor content, and services compete | District-aware citywide AI service assistant |
| Dong-gu | 5.8 | Crowded | Medium | Good retrieval, noisy | Medium | Medium | High | Level 0 | Rich local content and audience tabs | Banner density and technical frontend errors | Service-first homepage with AI waste/parking/civil-service guide |
| Seo-gu | 6.8 | Good | Good | Medium-good | Medium-good | Medium-high | Medium | Level 1 | Clean search-first header and clear service subsites | Leadership/brand content competes with tasks | AI notice summarizer and top-task launcher |
| Nam-gu | 6.2 | Weak at root, good on representative site | Medium | Medium, form-dependent | Medium | Medium | Medium | Level 1 | Representative site has useful quick menu and queue status | Root URL portal adds entry friction | Replace portal with service-first AI landing experience |
| Buk-gu | 5.4 | Crowded | Medium | Broad but noisy | Medium-low | Medium-low | High | Level 0 | Many official service pages and strong `종합민원` category | Large popup/banner interference; broken `대형폐기물` path observed | Fix IA/reliability, then AI top-task guide |
| Gwangsan-gu | 7.4 | Strong | Good | Strongest current base | Good | High | Low-medium | Level 2 | Search-first layout, service panels, large-text control, AI keyword module | Still list/category-based, not task-completion AI | AI citizen-service assistant prototype |

## Rankings

### Best Current Website

Gwangsan-gu.

Why: It has the clearest existing platform direction: prominent search, `광산 AI 이슈키워드`, large-text toggle, language support, service grouping, clear mobile menu, and strong task pages for bulky waste, shared parking, welfare, civil service, events, and jobs.

### Worst Current Experience

Two different answers depending on the lens:

- Entry experience: Nam-gu, because the provided root URL opens a portal selector before the representative site.
- Full service experience: Buk-gu, because a high-frequency search/sitemap result for `대형폐기물 배출방법` led to a page-error URL during testing, and the first mobile/desktop view was heavily affected by a large popup/banner.

### Most Prototype-Worthy Website

Gwangsan-gu.

Why: It already hints at AI and service-first design, so the prototype can be framed as a realistic modernization rather than a speculative redesign. The existing pages provide enough content to mock credible AI answers.

### Easiest to Redesign Convincingly

Nam-gu root portal.

Why: A before/after comparison is simple: replace a portal selector with a service-first homepage that preserves access to mayor, health, library, and sports while foregrounding search, common tasks, and AI guidance.

### Strongest AI Opportunity

Gwangsan-gu for a first demo; Gwangju City Hall for platform scale.

Gwangsan-gu has the strongest existing AI hook. Gwangju City Hall has the broadest reuse potential because citywide services can route to district-specific rules and contacts.

## Search Count Comparison

Result counts below are from public site search pages on 2026-05-13. They measure search corpus/retrieval volume, not traffic or demand.

| Website | 여권 | 주차 | 쓰레기 | 복지 | 민원 | 청년 | 일자리 | 보건소 | 주민등록 | 대형폐기물 | 행사 | 담당자 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gwangju City | 194 | 4,048 | 1,104 | 9,693 | 2,968 | 6,388 | 7,114 | 985 | 2,158 | 116 | 18,973 | 4,918 |
| Dong-gu | 718 | 1,385 | 1,887 | 9,294 | 3,793 | 4,308 | 3,916 | 2,796 | 2,435 | 933 | 9,019 | 2,618 |
| Seo-gu | 106 | 464 | 338 | 2,221 | 1,632 | 482 | 5,396 | 818 | 1,123 | 34 | 1,332 | 1,823 |
| Nam-gu | 72 | 199 | 1,336 | 4,769 | 1,776 | 563 | 1,341 | 1,800 | 4,955 | 120 | 2,606 | 2,463 |
| Buk-gu | 1,305 | 109 | 1,749 | 25,934 | 3,951 | 2,981 | 3,784 | 4,508 | 15,640 | 257 | 6,516 | 9,254 |
| Gwangsan-gu | 492 | 2,832 | 3,612 | 16,410 | 6,467 | 6,311 | 11,110 | 2,219 | 26,972 | 560 | 35,640 | 1,633 |

## Shared Strengths

- All six sites expose official government identity and public-service content.
- All six sites have public search.
- Most sites have multilingual links or external language support.
- Most sites have service pages with phone numbers, fees, counters, or application links once the user reaches the correct page.
- Gwangju City and Gwangsan-gu provide the strongest search-first signals.

## Shared Weaknesses

- Search is retrieval, not task guidance.
- Homepage visual hierarchy often favors banners and leadership content over top tasks.
- Government terminology is unavoidable.
- Mobile is responsive but not always mobile-first.
- AI is fragmented into topic content, external chatbots, or internal/health programs rather than a public task-completion layer.

