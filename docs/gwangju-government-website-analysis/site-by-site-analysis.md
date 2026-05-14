# Site-by-Site Analysis

Research date: 2026-05-13 KST

## 1. Gwangju Metropolitan City Hall

URL: https://www.gwangju.go.kr/main.do

Screenshots:

- `screenshots/gwangju-city-homepage-desktop.png`
- `screenshots/gwangju-city-homepage-mobile.png`
- `screenshots/gwangju-city-search-passport.png`
- `screenshots/gwangju-city-search-bulky-waste.png`

### Homepage Structure

Above the fold: official government banner, City Hall logo, global navigation, social links, weather/air quality, prominent search box, `나만의 메뉴`, large rotating banner, mayor/administration panel, and quick links such as `모두의광주`, `광주온(ON)`, `바로응답`, `바로예약`, `행정조직도`.

Main navigation: `소통ㆍ참여`, `시정소식`, `열린민원`, `정보공개`, `광주소개`, `분야별정보`, `사이트맵`.

Assessment: The homepage is one of the stronger sites because search is prominent and citizen quick links are visible. It still mixes citizen service, mayoral messaging, policy banners, and broad city promotion in the first viewport.

### User Task Analysis

- Notices: `시정소식 > 공지사항`, one main-menu click. Page showed 15,641 total posts and current notices dated 2026-05-13.
- Civil complaints/services: `열린민원 > 바로응답`; the page explains that internet/smartphone 민원 are received and routed to 담당자, with `062-120`.
- Passport: Search `여권` returns `열린민원 > 여권안내 > 여권발급`; page lists city and district office contacts and operating hours.
- Bulky waste: Search `대형폐기물` returns `환경정보 > 자원순환 > 자원재활용 > 대형 폐기물`; page gives district contacts and `여기로` app/homepage guidance.
- Welfare: linked to `광주복지플랫폼`, which has a stronger service-search orientation.
- Department contact: `행정조직도` is available from quick links and global nav.
- Reservation: `바로예약` is a strong citywide service with filters by district and reservation type.

### Navigation and IA

The city site has broad IA and many subdomains. The strongest pattern is the prominent search box plus quick-service row. The weakness is that service pages often sit inside official categories, and citizens still need to understand terms such as `열린민원`, `바로응답`, and `분야별정보`.

### UI and Visual Design

The design is modern enough to feel credible. It uses generous spacing, big search, rounded cards, icon buttons, and a clear top nav. The main risk is mixed hierarchy: banner, mayor card, and services compete for attention.

Mobile is readable and search-first, but long scrolling begins quickly after the top banner and mayor/service panels.

### Search Experience

Search is useful and grouped by menu, employee/work, notices, boards, web pages, files, media, and blog.

Evidence:

- `여권`: 194 results, with `여권발급`, `여권재발급`, and contact info surfaced.
- `대형폐기물`: 116 results, official environment page surfaced.
- `복지`: 9,693 results, including portals and service pages.
- `행사`: 18,973 results, a likely overload case for ordinary users.

Search quality: good retrieval, limited task guidance. AI search could turn these into direct answers.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 1.

Evidence: Search for `챗봇` found `지방세 상담챗봇`; homepage/search also exposes many AI policy/news items and `AI디지털배움터`, but no general citizen-service assistant was observed.

### Accessibility and Inclusion

Positive: language links, mobile support, official government identity, skip links, search prominence.

Risks: homepage evidence showed 5 images without alt text out of 53; service language remains official/technical; no simple Korean or multilingual task assistant was visible.

### Technical Observations

Observed scripts include jQuery, jQuery UI, `siiru.min.js`, `main-new2025.min.js`, `common-new.min.js`, and `netfunnel.js`. No homepage console or HTTP errors were captured in the first pass.

## 2. Dong-gu Office

URL: https://www.donggu.kr/index.es?sid=a1

Screenshots:

- `screenshots/dong-gu-homepage-desktop.png`
- `screenshots/dong-gu-homepage-mobile.png`
- `screenshots/dong-gu-search-passport.png`
- `screenshots/dong-gu-search-bulky-waste.png`

### Homepage Structure

Above the fold: official government banner, Dong-gu logo, global nav, top utility links, integrated search, app download, weather/air quality, large slogan, social icons, large rotating emergency/support banners, audience tabs (`구민`, `사업자`, `관광객`), mayor panel, notices, and service blocks.

Main navigation: `소통/참여`, `열린민원`, `정보공개`, `분야별정보`, `동구소개`, `동 행정복지센터`.

Assessment: Service information is present, but the homepage is visually crowded. Banners, audience tabs, mayor links, news boards, and green quick-link panels all compete.

### User Task Analysis

- Notices: `소통/참여 > 알림마당 > 새소식`; page showed 7,431 posts and current items dated 2026-05-13.
- Civil service: `열린민원 > 이용안내 > 창구민원안내`; page gives counter layout and phone numbers, but much content is in dense text.
- Passport: `열린민원 > 여권민원 > 여권개요`; page explains the concept, process, and related subpages.
- Waste: `분야별정보 > 청소/환경 > 생활폐기물 배출안내`; search result for `대형폐기물` gives the page and references `여기로`.
- Parking: `분야별정보 > 건설/교통 > 주·정차 안내`.
- Welfare: `분야별정보 > 복지`; useful but department/category-led.

### Navigation and IA

Top categories are predictable for a Korean public office, but citizen tasks are spread across `소통/참여`, `열린민원`, and `분야별정보`. Some important tasks require 2-4 clicks or search. Labels are official rather than life-event based.

### UI and Visual Design

Dong-gu uses a dense, banner-heavy layout with strong color blocks. The audience tabs are a good idea, but the surrounding visual load reduces clarity. Mobile keeps the same density and pushes task completion down.

### Search Experience

Search is broad and has useful "specific keyword" results and popular terms.

Evidence:

- `여권`: 718 results; a specific `여권발급` result appeared with summary.
- `대형폐기물`: 933 results; employee, menu, and webpage results were present.
- `복지`: 9,294 results.
- `행사`: 9,019 results.

Search quality: good at retrieval, weaker at prioritizing direct next steps.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 0.

Evidence: `AI` and `인공지능` search results mostly referenced internal AI administration, AI mentor/GPTs news, AI health care, and AI 면접. No public general assistant was observed.

### Accessibility and Inclusion

Positive: language links and health/tourism subsites are exposed. Risks: homepage evidence showed 32 missing alt attributes out of 128 images; mixed-content font loading was blocked; dense visual hierarchy may be difficult for elderly users.

### Technical Observations

Homepage console/network evidence included multiple 404s for `/main/js/main.js`, `/main/js/sub.js`, `/main/js/ScrollMagic.min.js`, and blocked mixed-content stylesheet `http://fonts.googleapis.com/earlyaccess/notosanskr.css`.

## 3. Seo-gu Office

URL: https://www.seogu.gwangju.kr/kor/

Screenshots:

- `screenshots/seo-gu-homepage-desktop.png`
- `screenshots/seo-gu-homepage-mobile.png`
- `screenshots/seo-gu-search-passport.png`
- `screenshots/seo-gu-search-bulky-waste.png`
- `screenshots/seo-gu-waste-bulky.png`

### Homepage Structure

Above the fold: utility links, large centered search, weather/air quality, logo and navigation, mayor/leadership panel, rotating announcement banner, and a prominent quick-service carousel including organization, local initiatives, and shared parking.

Main navigation: `열린민원`, `소통참여`, `정보공개`, `구정소식`, `서구소개`, `분야별정보`.

Assessment: Cleaner than Dong-gu and Buk-gu, with a stronger search-first pattern. The mayor/personal communication area is very prominent and competes with citizen tasks.

### User Task Analysis

- Notices/news: `구정소식` subsite has social/news cards and board summaries.
- Civil service: `열린민원 > 민원안내 > 민원실안내`; page lists operating hours, phone, fax, counter layout, and task phone numbers.
- Passport: `열린민원 > 여권민원 > 여권안내`.
- Waste: `분야별정보 > 도시/환경/위생 > 폐기물 > 대형폐기물 신고`; page gives `한손` app/homepage guidance and facility-management contact.
- Parking: `불법주정차단속민원` opens a dedicated traffic complaint system.
- Welfare/jobs: separate welfare and job-center subsites are linked from the homepage utility menu.
- Department: `서구소개 > 청사안내 > 행정조직도` and `직원 업무안내`.

### Navigation and IA

The IA is broad but relatively understandable. Useful quick links exist, but service pages still sit in official categories. Some quick-link items on the homepage are slogans/initiatives rather than tasks.

### UI and Visual Design

Seo-gu has a polished, bright visual identity and readable search. The top hero area is still leadership-heavy. Mobile is usable but starts with announcement/leadership content before practical service tasks.

### Search Experience

Search groups results by menu, content, staff, posts, images, and attachments. Result counts are much lower than some other sites, which can be easier to scan.

Evidence:

- `여권`: 106 results.
- `대형폐기물`: 34 results and official `대형폐기물 신고` page.
- `일자리`: 5,396 results.
- `담당자`: 1,823 results.

Search quality: structured and usable, but still not answer-oriented.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 1.

Evidence: Search for `챗봇` found `지방세 챗봇상담` and a notice for a Seo-gu Health Center KakaoTalk chatbot. Search for `AI` surfaced AI smart administration and AI welfare-related staff work, but no general website assistant.

### Accessibility and Inclusion

Positive: large search, language links, clear organization/contact pages. Risks: 27 missing image alts out of 131 in homepage evidence; text-heavy service pages; no simple Korean or multilingual service guide.

### Technical Observations

Observed jQuery-era stack with Slick/Swiper and local layout scripts. No homepage console or HTTP errors were captured in the first pass.

## 4. Nam-gu Office

Provided URL: https://www.namgu.gwangju.kr/

Representative homepage: https://www.namgu.gwangju.kr/index.es?sid=a1

Screenshots:

- `screenshots/nam-gu-homepage-desktop.png`
- `screenshots/nam-gu-homepage-mobile.png`
- `screenshots/nam-gu-representative-homepage-desktop.png`
- `screenshots/nam-gu-representative-homepage-mobile.png`
- `screenshots/nam-gu-search-passport.png`
- `screenshots/nam-gu-search-bulky-waste.png`

### Homepage Structure

The provided root URL opens a portal/splash selector with six large choices: representative homepage, mayor office, manifesto, health center, library, and sports reservation. This is visually simple but adds one step before citizen service access.

The representative homepage has a standard government structure: top utility links, nav (`참여세상`, `전자민원`, `정보공개/개방`, `복지정보`, `생활정보`, `우리남구`), quick menu, search, weather, mayor panel, notices, and policy links.

### User Task Analysis

- Notices: representative homepage exposes `남구 소식` and `공지사항`.
- Civil service: `전자민원 > 종합민원실 > 순번대기 알림서비스`; page gives queue status by counter.
- Passport: `전자민원 > 여권민원 > 여권안내`.
- Parking: `전자민원 > 교통민원`; the tested link opened an automobile registration page from the `교통민원` area, which indicates the section is not task-obvious from a plain parking need.
- Welfare: `복지정보`; includes official welfare program categories.
- Jobs: `생활정보 > 산업경제 > 일자리정보`.
- Department/contact: `우리남구 > 남구소개 > 행정조직 안내`, plus phone-number guidance.

### Navigation and IA

The portal root is the biggest IA issue: users arriving from search/bookmark may need to choose the correct site before starting. The representative homepage is more conventional and usable, but official labels still dominate.

### UI and Visual Design

The portal is visually strong but not service-first. The representative homepage is modern enough and has useful quick menu icons. Mobile representative layout is readable, but the root portal still adds friction.

### Search Experience

Nam-gu required testing through the visible representative homepage search form; direct GET query encoding produced mojibake during testing.

Evidence:

- `여권`: 72 results with staff and official pages.
- `대형폐기물`: 120 results.
- `복지`: 4,769 results.
- `주민등록`: 4,955 results.

Search quality: usable once on the representative site, but the root URL and encoding behavior make the search experience more fragile than others.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 1.

Evidence: Search for `챗봇` found `세무민원 > 지방세 상담챗봇`. Search for `인공지능` found translation support, AI care, and AI/IoT elderly health programs. These are useful domain services, not a general website assistant.

### Accessibility and Inclusion

Positive: language links and evidence of translation support in office services. Risks: portal step; font decode warnings on representative homepage; service labels remain technical.

### Technical Observations

Root portal showed 404s for `/intro/js/common.js`, `/intro/img/common/btn_srch.gif`, and `/intro/img/intro_thumb.jpg`. Representative homepage produced font decode warnings for Pretendard WOFF2 files.

## 5. Buk-gu Office

URL: https://bukgu.gwangju.kr/

Screenshots:

- `screenshots/buk-gu-homepage-desktop.png`
- `screenshots/buk-gu-homepage-mobile.png`
- `screenshots/buk-gu-search-passport.png`
- `screenshots/buk-gu-search-bulky-waste.png`
- `screenshots/buk-gu-waste-bulky.png`

### Homepage Structure

Above the fold during testing: official government banner, a large popup/election notice overlay, logo/nav, quick services, mayor panel, banner carousel, SNS, notices, and main site cards.

Main navigation: `종합민원`, `소통광장`, `더불어복지`, `분야별정보`, `정보공개`, `북구소개`.

Assessment: Buk-gu exposes many citizen tasks, but the first experience is cluttered by a large popup/banner and many visual modules.

### User Task Analysis

- Notices: `소통광장 > 알림마당 > 공지사항`.
- Civil service: `종합민원 > 민원실배치도(창구안내)`.
- Passport: `종합민원 > 여권민원 > 여권안내`.
- Waste: Search/sitemap exposed `분야별정보 > 환경재활용 > 대형폐기물 배출방법`, but the tested URL redirected to a page-error view.
- Welfare: `더불어복지 > 복지정책 > 긴급복지`.
- Events: `소통광장 > 알림마당 > 문화행사`.
- Department: `북구소개 > 구청안내 > 행정조직`.

### Navigation and IA

Buk-gu has understandable high-level categories and a strong `종합민원` label. The problem is reliability and visual interference. If a search or sitemap result for a high-frequency task breaks, users lose trust quickly.

### UI and Visual Design

The site uses strong color, large image areas, and many modules. Mobile view started with a large popup/banner, then quick services, then search and mayor content. This pushes core tasks down.

### Search Experience

Search groups by menu, staff work, board, web content, media, attachments, health center, culture, and related sites.

Evidence:

- `여권`: 1,305 results with direct menu and staff results.
- `대형폐기물`: 257 results, but direct official page path failed in testing.
- `복지`: 25,934 results, which is too broad without better intent grouping.
- `담당자`: 9,254 results, mostly boards/files rather than a clear staff finder.

Search quality: broad but noisy; link reliability issue observed.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 0.

Evidence: Search for `AI` and `인공지능` surfaced AI-IoT health and education content, but no visible public-facing assistant or AI search layer.

### Accessibility and Inclusion

Positive: font-size controls on content pages, official government identity, language links. Risks: 63 missing alt attributes out of 279 homepage images; popup/banner interference; broken high-frequency service path.

### Technical Observations

Observed jQuery/Slick/Swiper/GSAP. No homepage console errors captured, but the `대형폐기물 배출방법` path failed with `페이지 오류`.

## 6. Gwangsan-gu Office

URL: https://www.gwangsan.go.kr/

Screenshots:

- `screenshots/gwangsan-gu-homepage-desktop.png`
- `screenshots/gwangsan-gu-homepage-mobile.png`
- `screenshots/gwangsan-gu-menu-mobile.png`
- `screenshots/gwangsan-gu-search-passport.png`
- `screenshots/gwangsan-gu-search-bulky-waste.png`
- `screenshots/gwangsan-gu-waste-bulky.png`
- `screenshots/gwangsan-gu-welfare-finder.png`
- `screenshots/gwangsan-gu-parking-shared.png`

### Homepage Structure

Above the fold: official government banner, related-site links, `광산 라이브`, large-text controls, language menu, search-first hero, `광산 AI 이슈키워드`, main navigation, `나만의 메뉴`, large visual banner, social links, news, mayor panel, and service groups.

Main navigation: `뉴스·소식`, `참여·소통`, `광산구보`, `전자민원`, `정보공개`, `분야별 정보`, `광산구 소개`, `동행정복지센터`, `부가서비스`.

Assessment: Best current foundation among the six for an AI/service-first prototype. It has a clearer search-first intent and more visible service grouping.

### User Task Analysis

- Notices: `뉴스·소식 > 새소식`; page showed 7,579 posts and current items dated 2026-05-13.
- Events: `광산문화캘린더`; calendar view exposes events by date.
- Civil service: `전자민원 > 민원안내 > 민원실`; page gives location, hours, lunch closure, busy times, and counter details.
- Passport: `전자민원 > 민원안내 > 여권`.
- Waste: `분야별 정보 > 환경∙청소∙주택∙식품 > 청소 > 대형폐기물`; page gives contractor phone, `여기로`, and steps.
- Parking: `분야별 정보 > 교통 > 공유 및 시민참여주차장`; page provides shared parking table.
- Welfare: `분야별 정보 > 광산복지로 > 맞춤형 복지정보`.
- Jobs: `광산일자리여기다` has public/private jobs and deadlines.

### Navigation and IA

The IA is still government-category based, but the homepage service grouping, `나만의 메뉴`, and search-first approach make common paths more discoverable. The mobile drawer is clear with left-side categories and right-side submenus.

### UI and Visual Design

Gwangsan-gu has the most modern and prototype-ready visual system. The search box, large-text toggle, AI keyword module, and service panels give a strong platform feel. Visual density remains high, but task surfaces are more coherent.

### Search Experience

Search is the best among the six for AI-prototype inspiration because it surfaces related terms and direct summary-like related links.

Evidence:

- `여권`: 492 results, with menu and staff results.
- `대형폐기물`: 560 results; search page directly surfaced processing method, contractor phone, and `여기로` link.
- `복지`: 16,410 results and `맞춤형 복지정보` link.
- `행사`: 35,640 results, showing the need for AI grouping/filtering.

Search quality: strongest current base, still not natural-language task completion.

### AI / Automation / Smart-Service Audit

Current AI maturity: Level 2.

Evidence: `광산 AI 이슈키워드` is visible on homepage, `aiCurationKeyword.min.js` is loaded, and search provides related terms. However, no conversational assistant, form helper, or task-completion AI was observed.

### Accessibility and Inclusion

Positive: large-text control, language links including Russian, mobile drawer, service grouping, direct task pages. Risks: 51 missing alt attributes out of 133 homepage images; service language still official.

### Technical Observations

Observed `siiru` stack, jQuery, CKEditor, D3, `search.js`, `aiCurationKeyword.min.js`, and multiple custom UI scripts. No homepage console or HTTP errors were captured in the first pass.

