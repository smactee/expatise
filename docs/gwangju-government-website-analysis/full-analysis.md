# Gwangju Government Website Transformation Research

Research date: 2026-05-13 KST

## Executive Summary

The six reviewed government websites already contain extensive service information, but the experience is still mostly organized around government structure, boards, notices, and category menus. From a citizen perspective, the problem is not absence of information. The problem is that users often need to know the right terminology, the responsible department, or the correct menu category before they can complete a task.

The highest-value modernization opportunity is not only a visual redesign. It is a service layer: natural-language search, task guidance, notice summarization, local benefit matching, multilingual support, and simple step-by-step flows for high-frequency needs such as `대형폐기물`, `여권`, `주차`, `복지`, `일자리`, `보건소`, and `민원`.

No real analytics were available. All high-traffic conclusions in this report are inferred from homepage prominence, repeated links, menu priority, public-service patterns, and search-result evidence.

## Method

Evidence was gathered through normal public browsing only. No login, bypass, vulnerability testing, destructive action, or aggressive scraping was attempted.

What was tested:

- Desktop and mobile homepage views for all six sites.
- Expanded menu or sitemap states where accessible.
- Public search queries: `여권`, `주차`, `쓰레기`, `복지`, `민원`, `청년`, `일자리`, `보건소`, `주민등록`, `대형폐기물`, `행사`, `담당자`.
- AI-related searches: `챗봇`, `AI`, `인공지능`.
- Representative task pages: notices, civil-service guidance, passport pages, bulky-waste pages, parking/traffic, welfare, jobs, events, organization/contact pages.
- Public frontend signals: visible forms, scripts, console/network errors, missing image alt attributes, mobile layout, and obvious accessibility/inclusion factors.

Primary evidence files:

- `evidence-homepage.json`
- `evidence-namgu-representative.json`
- `evidence-search.json`
- `evidence-ai-search.json`
- `evidence-task-pages.json`
- `evidence-menu.json`
- `screenshots/`

## Cross-Site Themes

### 1. Information is present, but task completion is not the organizing principle.

Most sites provide official pages for common tasks. For example, Gwangju City Hall's bulky-waste page lists district-specific handling contacts and `여기로` application guidance. Gwangsan-gu's bulky-waste page gives a step sequence, contractor phone number, and app/homepage option. Seo-gu's bulky-waste page gives the facility-management contact and `한손` app guidance.

The friction is discovery and comprehension. Users often need to search or navigate through `분야별정보 > 도시/환경/위생 > 폐기물` or similar structures before seeing what to do.

### 2. Search is useful, but not yet citizen-intent search.

The search systems returned relevant results for concrete terms like `여권` and `대형폐기물`. However, the result pages are still lists grouped by content type. They do not answer the user's question directly.

Example:

- Gwangju City search for `대형폐기물` returned 116 results and led to the official environment page.
- Gwangsan-gu search for `대형폐기물` returned 560 results and included an unusually useful related-link style result: contractor phone number, `여기로` link, and menu path.
- Buk-gu search for `대형폐기물` returned 257 results, but the visible official menu path `분야별정보 > 환경재활용 > 대형폐기물 배출방법` opened a page-error URL during testing.

This is a strong AI opportunity because an assistant could convert a search term into a direct answer: process, fee, documents, application link, department, and district-specific rule.

### 3. Homepages compete between leadership messaging, announcements, and citizen services.

Most sites dedicate prominent homepage space to mayor/gu-head messaging, popup banners, election notices, social media, and news. Citizen services are present, but they are often below or beside promotional content.

Gwangsan-gu and Gwangju City Hall are closer to search-first design. Dong-gu and Buk-gu feel more banner/card dense. Nam-gu's supplied URL starts with a visual portal selector before the representative site, adding a step before public service discovery.

### 4. Mobile exists, but many mobile pages still feel desktop-derived.

Every site rendered on a mobile viewport. The quality varied:

- Gwangsan-gu has a clear mobile header, search/menu entry, and drawer navigation.
- Gwangju City Hall has a clean search-first mobile start, but long scrolling and many content bands remain.
- Dong-gu and Seo-gu mobile pages are usable but visually dense with banners and leadership imagery.
- Buk-gu mobile starts with a large popup/banner area that pushes core tasks down.
- Nam-gu's representative homepage is usable on mobile, but the root portal still creates entry friction.

### 5. AI is visible mostly as topic content, external chatbots, or limited widgets.

No site showed a full task-completion AI assistant for citizen services. Visible AI-related elements include:

- Gwangsan-gu: prominent `광산 AI 이슈키워드` and `aiCurationKeyword.min.js`; search also exposes related terms.
- Seo-gu: search result for `챗봇` found `지방세 챗봇상담` and a public notice for a public-health KakaoTalk chatbot.
- Nam-gu: search result for `챗봇` found `지방세 상담챗봇`; search for `인공지능` found office translation support, AI care, and AI/IoT elderly health items.
- Gwangju City Hall: search for `챗봇` found `지방세 상담챗봇` and many AI policy/news items, but not a general website assistant.
- Dong-gu and Buk-gu: AI mostly appears in news, internal operations, health services, or education, not as a public website service layer.

## Likely High-Traffic / High-Importance User Paths

These are inferred from UX/content prominence, repeated links, menus, search evidence, and common government service demand. They are not confirmed analytics.

| Path | Why likely important | Current friction | AI/prototype opportunity |
|---|---|---|---|
| Notices / announcements | Every site prioritizes `공지`, `새소식`, `고시공고`, and event notices. | Users must scan long boards; old and new results mix in search. | AI notice summarizer: eligibility, deadline, documents, apply link, contact. |
| Civil complaints / 민원 | Core public-service duty; all sites have `열린민원`, `전자민원`, `종합민원`. | Labels vary and often lead to submenus or external systems. | "I want to..." launcher for complaint, certificate, passport, visit, report. |
| Waste / 대형폐기물 | Search-tested task; appears in quick services on some sites. | District-specific vendors/apps differ; some paths are buried; Buk-gu search path errored. | AI bulky-waste guide with district selection, fees, app link, pickup steps. |
| Parking / traffic | Search and menus show parking complaints, shared parking, illegal parking alerts. | Split across traffic offices, complaint systems, maps/tables. | AI parking/reporting guide: find shared parking, sign up for alerts, file complaint. |
| Welfare / benefits | Many result counts and dedicated welfare portals. | Dense policy pages; users must map themselves to programs. | Local benefit finder by age, household, income, employment, disability, district. |
| Jobs / youth | Search counts high; homepages and city/district menus expose jobs/youth. | Notices and job boards are fragmented. | Youth/job recommender with deadlines and eligibility summaries. |
| Health center / 보건소 | All sites link to health centers; search counts high. | Separate subsites, notices, and program pages. | AI health-service navigator for vaccination, certificates, clinic hours, locations. |
| Department/contact | Users frequently need the right 담당자. | Employee search exists, but users must know department or exact keyword. | Ask: "이 업무 담당자 누구예요?" and return department, phone, hours, fallback. |
| Events/culture/tourism | Sites emphasize culture/tourism and local events. | Event pages differ by site; calendars and boards are not unified. | AI event finder by date, location, family/elderly/foreign-resident suitability. |

### Per-Site High-Importance Path Notes

#### Gwangju City Hall

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| `공지사항` / city news | Homepage and main nav prioritize `시정소식`; board had 15,641 posts. | Easy. | Large board scanning; notices are not summarized. | AI notice summary with deadline and eligibility. |
| `바로응답` / 민원 | Homepage quick link and `열린민원` nav expose it. | Medium-easy. | Label is branded; users may not know it means civil request routing. | Convert to "민원/신고 도와줘" flow. |
| `여권` | Search and menu expose full contact table. | Easy via search. | Page is long and table-heavy. | AI checklist: office, hours, documents, fee, pickup. |
| `대형폐기물` | Search finds official environment page; page includes all districts. | Medium via search. | Category path is not obvious; district rules differ. | District-aware waste guide. |
| `광주복지플랫폼` | Homepage family/service link and welfare search volume. | Medium. | Separate portal; users must know what benefit fits. | Personalized benefit finder. |

#### Dong-gu

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| `새소식` / notices | Homepage and `소통/참여` emphasize it; board had 7,431 posts. | Easy. | Dense list view. | Summarized notices and "for me?" eligibility filter. |
| `열린민원` | Main nav category. | Medium. | Many subcategories; official labels. | Guided civil-service launcher. |
| `여권민원` | Search `여권` returned a specific result and menu path. | Medium-easy. | Multiple pages: 개요, 수수료, 신규, 재발급, 교부. | AI combines subpages into one checklist. |
| `대형폐기물` | Search `대형폐기물` returned staff, menu, and webpage results. | Medium via search. | Needs the user to choose among staff/menu/page results. | Direct answer with `여기로` app and 동 contact. |
| `주정차` / parking | Homepage popular search showed `주정차`; menu has traffic pages. | Medium. | Split across traffic/civil labels. | Parking-report and alert-signup guide. |

#### Seo-gu

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| `열린민원` / 민원실 | Main nav and page includes counter phone table. | Easy. | Long administrative table. | AI "which counter do I need?" answer. |
| `대형폐기물 신고` | Search finds official page; quick keyword `폐기물` appears on homepage. | Medium. | Homepage quick keyword is not a direct explanatory flow. | Waste guide with `한손` app and 4-7 day expectation. |
| `불법주정차단속민원` | Utility links expose dedicated system. | Easy for known label. | Separate system; label may be unclear to ordinary users. | Natural-language parking issue router. |
| `복지정책` / jobs | Dedicated welfare and job-center subsites. | Medium-easy. | Subsites fragment experience. | Benefit/job recommender with deadlines. |
| `구정소식` | Separate news subsite and homepage visibility. | Easy. | Promotional/news cards mix with official notices. | AI summary and priority tagging. |

#### Nam-gu

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| Representative homepage access | Provided URL opens a portal selector. | Medium. | One extra decision before services. | Replace portal with service-first AI landing page. |
| `전자민원` / queue status | Representative page exposes 민원 and queue status. | Medium-easy after portal. | Queue page is useful but not a full task guide. | "Do I need to visit?" assistant. |
| `여권` | Search and `전자민원` expose it. | Medium. | Search direct URL encoding issue observed; form worked. | Passport assistant with document checklist and lunch closure. |
| `복지정보` / `일자리정보` | Main nav and quick menu expose both. | Medium. | Program pages are dense. | Local benefit/job eligibility finder. |
| Parking/traffic | Quick menu has `주정차단속`; traffic pages exist. | Medium. | `교통민원` can lead into vehicle-registration substructure. | Parking-specific intent flow. |

#### Buk-gu

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| `종합민원` | Main nav and quick services emphasize it. | Easy. | Popup/banner pushes tasks down. | Top-task assistant above banners. |
| `여권민원` | Search returned 1,305 results and direct menu/staff entries. | Medium-easy. | Many results and table-heavy pages. | Passport checklist and contact card. |
| `대형폐기물 배출방법` | Search/sitemap expose it; high-frequency service. | Poor during test. | Tested official path opened page-error view. | Fix link, then add waste assistant. |
| `더불어복지` | Main nav and high search result volume. | Medium. | Very broad; `복지` returned 25,934 results. | Benefit finder and search-result grouping. |
| `문화행사` / notices | Boards and homepage modules emphasize events/news. | Medium. | Long board scanning. | Event finder by date/user type. |

#### Gwangsan-gu

| Path | Why likely important | Ease to find | Current friction | AI/prototype opportunity |
|---|---|---|---|---|
| Search / `광산 AI 이슈키워드` | First-screen search and AI keyword module are prominent. | Easy. | AI keyword is not a task-completion assistant. | Upgrade into full AI service assistant. |
| `대형폐기물` | Homepage service area and search result provide direct process. | Easy-medium. | Still a long official page after discovery. | Best demo flow for AI step-by-step guide. |
| Shared parking | Search finds `공유 및 시민참여주차장`; page has detailed table. | Medium. | Data is table-heavy. | AI parking finder by location/time/free/paid. |
| `맞춤형 복지정보` | Homepage and search expose it; content already categorized by life stage. | Easy-medium. | Not personalized yet. | Local benefit finder. |
| Jobs/events | Dedicated `광산일자리여기다` and calendar pages. | Easy-medium. | Events/jobs still require scanning lists. | Personalized job/event recommender. |

## Prioritized Issue List

### Critical User-Experience Issues

1. Users often need government vocabulary before they can complete a task.

Evidence: Common paths use labels such as `전자민원`, `민원편람`, `분야별정보`, `생활폐기물`, `고시/공고/입법`. Search helps, but does not translate user intent into steps.

Why it matters: A resident may type or think "이사했어요", "소파 버리고 싶어요", "주차 문제 신고", or "지원금 받을 수 있나요" rather than knowing the official category.

Suggested improvement: Add an `I want to...` task launcher and AI service assistant.

2. Important service pages are often below promotional or announcement content.

Evidence: Homepage screenshots show large rotating banners, leadership sections, and notice boards competing with quick service tasks.

Why it matters: High-frequency tasks should be reachable immediately, especially on mobile.

Suggested improvement: Move search, top tasks, and service cards into the first interaction zone.

3. Search result pages do not answer directly.

Evidence: Search results return many content groups but no synthesized answer. `복지` returned thousands of results on several sites; `행사` returned 35,640 results on Gwangsan-gu.

Why it matters: Large result counts create cognitive load and increase calls/visits.

Suggested improvement: Add AI search answers with cited official page links.

4. Broken or brittle paths exist.

Evidence: Buk-gu `대형폐기물 배출방법` path from search/sitemap opened `https://bukgu.gwangju.kr/error/503.jsp` during testing.

Why it matters: Waste disposal is a high-frequency task; a broken path directly creates user failure.

Suggested improvement: Fix link routing and add automated link checks.

### Design/UI Issues

- Banner density is high on several sites. Dong-gu and Buk-gu especially use many cards, banners, and sliders above or near core services.
- Typography and spacing are inconsistent across subsites and service pages.
- Many boards are table/list-heavy and not optimized for scanning.
- Nam-gu's root portal is visually polished but delays access to citizen tasks.
- Mobile pages often require long scrolling before task pages or search results become actionable.

### Information Architecture Issues

- Navigation is frequently organized by departments or government categories rather than life events or user intent.
- Duplicate paths exist across homepage cards, global navigation, search, and subsites.
- Some services are split into external systems (`정부24`, `국민신문고`, `여기로`, `한손`, traffic complaint systems), but the transition is not always explained in one coherent flow.
- Department/contact search is available, but not conversational or service-intent based.

### AI / Opportunity Gaps

- No site demonstrated a full citizen-service AI assistant.
- No site provided natural-language answer synthesis from official service pages.
- No site offered a strong multilingual foreign-resident assistant embedded into common services.
- No site summarized long notices into eligibility, deadline, documents, and contact.
- Benefit/welfare pages exist, but benefit matching is not yet personalized.

### Accessibility / Inclusion Issues

- Several homepages have missing image alt attributes in the DOM evidence. Counts from homepage capture included 32/128 missing alt images on Dong-gu, 63/279 on Buk-gu, 51/133 on Gwangsan-gu, and 27/131 on Seo-gu.
- Public-sector terms are difficult for elderly users, younger users, foreign residents, and users unfamiliar with government structures.
- Gwangsan-gu's large-text control is a positive pattern.
- Nam-gu search for `인공지능` exposed office translation support and AI care-related services, but this is not surfaced as a web-wide inclusive service layer.

## Search Evidence Summary

Result counts are from public site search pages on 2026-05-13. Counts are not traffic counts.

| Website | 여권 | 주차 | 쓰레기 | 복지 | 민원 | 청년 | 일자리 | 보건소 | 주민등록 | 대형폐기물 | 행사 | 담당자 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gwangju City | 194 | 4,048 | 1,104 | 9,693 | 2,968 | 6,388 | 7,114 | 985 | 2,158 | 116 | 18,973 | 4,918 |
| Dong-gu | 718 | 1,385 | 1,887 | 9,294 | 3,793 | 4,308 | 3,916 | 2,796 | 2,435 | 933 | 9,019 | 2,618 |
| Seo-gu | 106 | 464 | 338 | 2,221 | 1,632 | 482 | 5,396 | 818 | 1,123 | 34 | 1,332 | 1,823 |
| Nam-gu | 72 | 199 | 1,336 | 4,769 | 1,776 | 563 | 1,341 | 1,800 | 4,955 | 120 | 2,606 | 2,463 |
| Buk-gu | 1,305 | 109 | 1,749 | 25,934 | 3,951 | 2,981 | 3,784 | 4,508 | 15,640 | 257 | 6,516 | 9,254 |
| Gwangsan-gu | 492 | 2,832 | 3,612 | 16,410 | 6,467 | 6,311 | 11,110 | 2,219 | 26,972 | 560 | 35,640 | 1,633 |

## Best-Practice Comparison

Modern public-sector sites should be service-first, mobile-first, accessible, search-first, and organized around user needs. The six sites partially meet this: they provide search, mobile layouts, language links, and extensive content. The gap is the absence of an intelligent service layer.

Best-practice target:

- First screen: search, top tasks, emergency/current alerts, personalized/local service access.
- Navigation: `I want to...`, `Life events`, `Popular services`, `Departments/contact`, and `Notices`.
- Search: natural language, grouped results, direct answer with source links.
- Notices: AI summary and deadline extraction.
- Mobile: task cards and search before banners.
- Inclusion: simple Korean, multilingual support, large text, voice-ready content.

## Recommended Direction

Build a prototype around Gwangsan-gu first: `AI-powered citizen-service homepage and assistant for district residents`.

Why:

- Gwangsan-gu has the best existing bridge to an AI story: visible `광산 AI 이슈키워드`, search-first homepage, large-text controls, multilingual links, and good service-page evidence.
- Its current content is strong enough to power a realistic demo: `대형폐기물`, shared parking, welfare finder, jobs, notices, passport/civil service, and events.
- The prototype can be shown as a reusable platform pattern for all Gwangju gu offices and eventually the metropolitan city site.

Primary demo flow:

1. User enters: `대형폐기물 버리고 싶어요`.
2. AI asks or infers district: `광산구`.
3. It gives step-by-step process, `여기로` link, contractor phone, fee guidance, pickup sequence, and official source citation.
4. It offers simple Korean, English/Vietnamese/Chinese mode, and a department contact fallback.
5. It shows related notices and nearby services.
