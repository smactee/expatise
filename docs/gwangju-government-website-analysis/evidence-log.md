# Evidence Log

Research date: 2026-05-13 KST

## Scope and Safety

Only public pages and public frontend behavior were reviewed. No login, bypass, account access, vulnerability testing, destructive actions, or production edits were attempted.

## Public Websites Visited

- Gwangju Metropolitan City Hall: https://www.gwangju.go.kr/main.do
- Dong-gu Office: https://www.donggu.kr/index.es?sid=a1
- Seo-gu Office: https://www.seogu.gwangju.kr/kor/
- Nam-gu root: https://www.namgu.gwangju.kr/
- Nam-gu representative homepage: https://www.namgu.gwangju.kr/index.es?sid=a1
- Buk-gu Office: https://bukgu.gwangju.kr/
- Gwangsan-gu Office: https://www.gwangsan.go.kr/

## Search Terms Tested

Tested on each public site search where available:

- `여권`
- `주차`
- `쓰레기`
- `복지`
- `민원`
- `청년`
- `일자리`
- `보건소`
- `주민등록`
- `대형폐기물`
- `행사`
- `담당자`

AI-related searches:

- `챗봇`
- `AI`
- `인공지능`

## Search Evidence Files

- `evidence-search.json`
- `evidence-ai-search.json`

Important search observations:

- Gwangju City `대형폐기물`: 116 results; official environment page found.
- Dong-gu `대형폐기물`: 933 results; official waste page and employee/menu results found.
- Seo-gu `대형폐기물`: 34 results; official `대형폐기물 신고` page found.
- Nam-gu search had to be tested through the visible representative homepage form to avoid direct-query encoding issues.
- Buk-gu `대형폐기물`: 257 results; official menu path was found, but the tested URL opened a page-error view.
- Gwangsan-gu `대형폐기물`: 560 results; search result text included contractor phone, `여기로`, and official path.

## Representative Task Pages Visited

### Gwangju City

- Notices: https://www.gwangju.go.kr/boardList.do?boardId=BD_0000000022&pageId=www788
- Civil service / 바로응답: https://www.gwangju.go.kr/contentsView.do?pageId=www76
- Passport: https://www.gwangju.go.kr/contentsView.do?pageId=www63
- Bulky waste: https://www.gwangju.go.kr/envi/contentsView.do?pageId=envi248
- Organization: https://www.gwangju.go.kr/contentsView.do?pageId=www147
- Reservation: https://www.gwangju.go.kr/reserve/
- Welfare platform: https://welfare.gwangju.go.kr/

### Dong-gu

- Notices: https://www.donggu.kr/menu.es?mid=a10101010000
- Civil counter: https://www.donggu.kr/menu.es?mid=a10201010100
- Passport: https://www.donggu.kr/menu.es?mid=a10203010000
- Waste: https://www.donggu.kr/menu.es?mid=a10408010100
- Parking: https://www.donggu.kr/menu.es?mid=a10406040100
- Welfare: https://www.donggu.kr/menu.es?mid=a10401000000
- Organization: https://www.donggu.kr/menu.es?mid=a10504020000

### Seo-gu

- News: https://www.seogu.gwangju.kr/news/
- Civil service: https://www.seogu.gwangju.kr/menu.es?mid=a10201070000
- Passport: https://www.seogu.gwangju.kr/menu.es?mid=a10202010000
- Bulky waste: https://www.seogu.gwangju.kr/menu.es?mid=a10308010200
- Parking complaint system: https://www.seogu.gwangju.kr/trafficminwon/
- Welfare: https://www.seogu.gwangju.kr/welfare/
- Jobs: https://www.seogu.gwangju.kr/goodjob/
- Organization: https://www.seogu.gwangju.kr/menu.es?mid=a10106030000

### Nam-gu

- Root portal: https://www.namgu.gwangju.kr/
- Representative homepage: https://www.namgu.gwangju.kr/index.es?sid=a1
- Civil service / queue status: https://www.namgu.gwangju.kr/menu.es?mid=a10201050000
- Passport: https://www.namgu.gwangju.kr/menu.es?mid=a10203010000
- Traffic/civil area: https://www.namgu.gwangju.kr/menu.es?mid=a10207010101
- Welfare: https://www.namgu.gwangju.kr/menu.es?mid=a10411000000
- Jobs: https://www.namgu.gwangju.kr/menu.es?mid=a10505020500
- Organization: https://www.namgu.gwangju.kr/menu.es?mid=a10603040100

### Buk-gu

- Notices: https://bukgu.gwangju.kr/menu.es?mid=a10201010000
- Civil service: https://bukgu.gwangju.kr/menu.es?mid=a10101010000
- Passport: https://bukgu.gwangju.kr/menu.es?mid=a10101060000
- Bulky waste search/sitemap path tested: https://bukgu.gwangju.kr/menu.es?mid=a10406070000
- Welfare: https://bukgu.gwangju.kr/menu.es?mid=a10301040000
- Culture events: https://bukgu.gwangju.kr/menu.es?mid=a10201110000
- Organization: https://bukgu.gwangju.kr/menu.es?mid=a10602010000

### Gwangsan-gu

- Notices: https://www.gwangsan.go.kr/boardList.do?boardId=NEWS_NEW&pageId=www3
- Culture calendar: https://www.gwangsan.go.kr/pgHomeGsSchdlList.do?pageId=www9&ctgry=C
- Civil service: https://www.gwangsan.go.kr/contentsView.do?pageId=www75
- Passport: https://www.gwangsan.go.kr/contentsView.do?pageId=www81
- Bulky waste: https://www.gwangsan.go.kr/contentsView.do?pageId=www404
- Shared parking: https://www.gwangsan.go.kr/contentsView.do?pageId=www382
- Welfare finder: https://www.gwangsan.go.kr/contentsView.do?pageId=www280
- Jobs: https://www.gwangsan.go.kr/job/

## Screenshots Captured

Homepage desktop/mobile screenshots were captured for all six sites. Search result screenshots were captured for `여권` and `대형폐기물` for each site. Additional task screenshots were captured for selected civil-service, waste, welfare, parking, and menu states.

Screenshot folder:

- `screenshots/`

Examples:

- `screenshots/gwangsan-gu-homepage-desktop.png`
- `screenshots/gwangsan-gu-waste-bulky.png`
- `screenshots/gwangsan-gu-welfare-finder.png`
- `screenshots/nam-gu-homepage-desktop.png`
- `screenshots/nam-gu-representative-homepage-desktop.png`
- `screenshots/buk-gu-search-bulky-waste.png`
- `screenshots/buk-gu-waste-bulky.png`

## Frontend / DevTools-Style Observations

Evidence sources:

- `evidence-homepage.json`
- `evidence-task-pages.json`

Notable observations:

- Gwangju City homepage loaded without captured homepage console/network errors.
- Dong-gu homepage showed 404s for `/main/js/main.js`, `/main/js/sub.js`, `/main/js/ScrollMagic.min.js`, and blocked mixed-content font CSS from `http://fonts.googleapis.com/earlyaccess/notosanskr.css`.
- Nam-gu root portal showed 404s for `/intro/js/common.js`, `/intro/img/common/btn_srch.gif`, and `/intro/img/intro_thumb.jpg`.
- Nam-gu representative homepage showed font decode warnings for Pretendard WOFF2 files.
- Buk-gu `대형폐기물 배출방법` path opened a page-error view during testing.
- Gwangsan-gu homepage loaded `aiCurationKeyword.min.js`.

## Limitations

- No actual traffic analytics were available or claimed.
- Search result counts are public search counts, not user demand.
- This is not a full WCAG audit; accessibility findings are visible/obvious checks plus DOM evidence such as missing alt attributes.
- Some pages use external systems; only public landing/visible behavior was reviewed.
- Dynamic widgets may vary by date, popup settings, and current government announcements.

