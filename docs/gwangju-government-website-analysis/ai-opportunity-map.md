# AI Opportunity Map

Research date: 2026-05-13 KST

## AI Maturity Scale

- Level 0: No visible AI service layer.
- Level 1: Basic or domain-specific chatbot/scripted automation exists, often external or buried.
- Level 2: Search/help automation or AI keywording is visible, but limited intelligence and no task completion.
- Level 3: Useful AI-assisted public service guidance.
- Level 4: Personalized, multilingual, task-completion AI service layer.

## Current AI Maturity Audit

| Website | Level | Evidence | Interpretation |
|---|---:|---|---|
| Gwangju City Hall | 1 | Search for `챗봇` found `지방세 상담챗봇`; homepage/search included `AI디지털배움터` and many AI policy/news items. | AI exists as domain content or specific service, not as a general citizen web assistant. |
| Dong-gu | 0 | Search found internal `AI 멘토`/AI administration news and AI/IoT health references. | No visible citizen-facing assistant or AI search observed. |
| Seo-gu | 1 | Search for `챗봇` found `지방세 챗봇상담` and a health-center KakaoTalk chatbot notice. | Useful but domain-specific and not integrated into site-wide service completion. |
| Nam-gu | 1 | Search found `지방세 상담챗봇`; `인공지능` search found translation support, AI care, and AI/IoT health. | Several smart-service signals, but no general website assistant. |
| Buk-gu | 0 | Search found AI/IoT health and education content, not a public AI assistant. | No visible general AI service layer. |
| Gwangsan-gu | 2 | Homepage exposes `광산 AI 이슈키워드`; `aiCurationKeyword.min.js` loads; search provides related terms and useful related-link snippets. | Best current base for AI UX, but still not a conversational task assistant. |

## Recommended AI Features

### 1. AI Citizen Service Assistant

User problem solved: Citizens do not know the correct department, menu label, app, fee, or step sequence.

Scenario: User types `대형폐기물 버리는 방법 알려줘`.

Response should include:

- District confirmation.
- Step-by-step process.
- App/homepage link (`여기로`, `한손`, or district-specific system).
- Fee guidance or fee-table link.
- Pickup sequence.
- Department/vendor phone.
- Official source links.

Government value: Reduces phone calls and wrong visits; makes common services feel modern and trustworthy.

Difficulty: Medium.

Prototype feasibility: High with mocked service database and official-page citations.

Best demo site: Gwangsan-gu first; citywide variant can route to all districts.

### 2. Natural-Language Government Search

User problem solved: Keyword search returns too many documents and old notices.

Scenario: User asks `주차 딱지 이의신청 어디서 해요?`.

AI groups results as:

- Service answer.
- Related department/contact.
- Form/download.
- Notice/legal explanation.
- External system link.

Government value: Turns existing content into usable answers without replacing CMS immediately.

Difficulty: Medium.

Prototype feasibility: High.

Best demo site: Gwangju City Hall or Gwangsan-gu.

### 3. "I Want To..." Service Launcher

User problem solved: Citizens think in situations, not departments.

Example flows:

- `이사했어요`
- `아이를 낳았어요`
- `청년 지원 받고 싶어요`
- `쓰레기 배출 방법 알고 싶어요`
- `주차 문제 신고하고 싶어요`
- `여권 만들고 싶어요`

Government value: Makes websites service-first without requiring full IA replacement.

Difficulty: Low to Medium.

Prototype feasibility: Very high.

Best demo site: Nam-gu root portal redesign or Gwangsan-gu homepage upgrade.

### 4. Personalized Local Benefit Finder

User problem solved: Welfare/youth/job content is broad and hard to match to personal eligibility.

Scenario: User selects district, age, employment status, household type, disability/child/elderly status, and income band. AI recommends relevant benefits and explains next steps.

Government value: Improves take-up of benefits and reduces missed support.

Difficulty: Medium to High depending on data freshness and eligibility rules.

Prototype feasibility: Medium with mocked data; high pitch value.

Best demo site: Gwangsan-gu because it already has `맞춤형 복지정보`; Gwangju welfare platform for citywide scale.

### 5. Multilingual Foreign Resident Assistant

User problem solved: Foreign residents may not understand Korean public-sector labels or required documents.

Scenario: A Vietnamese resident asks how to register a move, dispose bulky waste, or find health-center support.

Government value: Supports inclusion and reduces language-related service failures.

Difficulty: Medium.

Prototype feasibility: High with static language toggles and mocked responses.

Best demo site: Gwangsan-gu because it already exposes multiple languages including Russian; Nam-gu also has evidence of translation support in civil-service context.

### 6. AI Form/Application Helper

User problem solved: Citizens arrive at office without correct documents or use the wrong external system.

Scenario: User selects `여권`, `주민등록`, `민원서식`, or `사업자 관련 인허가`; assistant explains required documents, whether online application is possible, fees, office hours, lunch closures, and expected processing time.

Government value: Reduces repeat visits and counter workload.

Difficulty: Medium.

Prototype feasibility: High for selected flows.

Best demo site: Gwangju City Hall for passport; Gwangsan-gu for civil-service counter and passport pages.

### 7. AI Notice Summarizer

User problem solved: Long announcement boards are hard to scan.

Scenario: User opens a support notice. AI summary shows:

- Who is eligible.
- What the benefit/service is.
- Deadline.
- Required documents.
- Application link.
- Contact.

Government value: Improves notice comprehension and participation.

Difficulty: Low to Medium.

Prototype feasibility: Very high.

Best demo site: Seo-gu or Gwangsan-gu, both with active news/notice pages.

### 8. AI Accessibility Layer

User problem solved: Elderly users, disabled users, and low-literacy users may struggle with dense official pages.

Features:

- Simple Korean mode.
- Larger text/task mode.
- Voice-ready step reading.
- Jargon explanations.
- "Call this department" action.

Government value: Visible inclusion and accessibility improvement.

Difficulty: Medium.

Prototype feasibility: High for UI demo.

Best demo site: Gwangsan-gu, because it already has a large-text control and service-first structure.

## Highest-Impact AI Demo Flow

`대형폐기물 버리고 싶어요`

Why this flow sells:

- It is common, concrete, and easy for decision makers to understand.
- It varies by district, which shows the value of AI routing.
- It has clear official steps, fees/contact, and external application links.
- It can show simple Korean, multilingual support, and source citations.
- It demonstrates reduced calls and wrong visits.

Prototype response example:

1. `광산구 기준으로 안내드릴게요.`
2. `1. 여기로 앱 또는 홈페이지에서 배출신고를 합니다.`
3. `2. 수수료를 결제하고 배출번호를 받습니다.`
4. `3. 배출번호를 폐기물에 적어 지정 장소에 배출합니다.`
5. `4. 수거업체가 현장 방문 후 수거합니다.`
6. `문의: 청소행정과 / 수거업체 전화번호 / 공식 페이지 링크`

