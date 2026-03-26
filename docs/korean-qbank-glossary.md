# Korean QBank Glossary and Style Guide

## Scope

- The English in-app question bank remains the source of truth.
- The Korean PDF is a terminology and phrasing reference only.
- Keep existing taxonomy keys, qbank IDs, and app structure unchanged.
- Use the PDF's Korean where it reads naturally; modernize obvious calques when needed.

## A. Korean PDF -> App Taxonomy Mapping

| Korean PDF section | Observed in PDF | App taxonomy target | Mapping note |
| --- | --- | --- | --- |
| `도로교통안전 법률과 법규 및 규정` | section list on PDF p.6, questions start on PDF p.7 | `Road Safety` | Clean for `license`, `registration`, `accidents`. Some punishment/legal phrasing also feeds `Proper Driving > Traffic Laws`. |
| `도로교통신호 및 의미` | section start on PDF p.20 | `Traffic Signals` | Cleanest one-to-one mapping. Its own outline already separates signal lights, signs, markings, and police signals. |
| `안전운행과 문명운전 지식` | section start on PDF p.39 | `Proper Driving` | Main source for safe-driving phrasing, right-of-way, weather, highway, emergency handling. Also supplies some `Road Safety > Road Conditions` wording. |
| `자동차 전체구조와 주요 안전장치 상식, 일상검사와 수리보양 기본지식` | section start on PDF p.45 | `Driving Operations` | Clean for indicators, controls, pedals, switches, and safety devices. The section title itself is dated and should be modernized in running prose. |

### Subtopic alignment notes

- `Traffic Signals` maps almost exactly:
  `도로교통신호등` -> `signal-lights`
  `도로교통표지` -> `road-signs`
  `도로교통표시선` -> `road-markings`
  `교통경찰관 수신호` -> `police-signals`
- `Road Safety > road-conditions` does not exist as a single clean PDF section.
  Most usable Korean comes from `안전운행과 문명운전 지식`.
- `Proper Driving > traffic-laws` is split across section 1 and section 3.
  Section 1 is more administrative/legal.
  Section 3 is more behavior/rule application.
- `Driving Operations > gears` is broader than "gears" in the PDF.
  The Korean source groups pedals, switches, steering, wipers, and safety devices together.

## B. Style Guide

### Tone

- Use concise exam-style Korean.
- Prefer short official wording over conversational paraphrase.
- Default to plain present tense: `한다`, `해야 한다`, `할 수 있다`, `할 수 없다`.
- Keep stems short when the image or answer choices already carry detail.
- Use Korean road-exam vocabulary consistently, but do not preserve awkward Chinese-source phrasing if a simpler Korean term is clearer.
- For fixed visual-concept questions, follow the Korean PDF wording more literally even if the result is slightly less natural than a freer app-style rewrite.

### Standardized recurring phrasing

| English function | Preferred Korean pattern | Note |
| --- | --- | --- |
| What does this sign mean? | `이 표지의 뜻은?` | Default PDF-first stem for sign families. |
| What does this lane-use / lane-direction sign mean? | `이 표시의 뜻은?` | Keep this for signal/lane-direction families that are not best treated as `표지`. |
| What does this road marking mean? | `이 노면표시의 의미는?` | Keep `노면`-based wording aligned with the Korean PDF. |
| What does this hand signal mean? | `다음 교통경찰 수신호의 의미는?` | Keep `수신호` consistent. |
| What does this dashboard light mean? | `계기판에 등이 켜졌다. 무슨 의미인가?` | Prefer this over freer `경고등` stems unless the concept is explicitly a warning light label. |
| What does this dashboard symbol mean? | `계기판에서 이 표시의 의미는?` | Use for fixed dashboard/icon meaning families. |
| What device does this switch control? | `표시가 된 스위치는 어떤 장치를 제어하는가?` | Prefer this PDF-style stem over rewrites like `이 기호가 표시된...`. |
| What is this gauge / instrument? | `이 계기는 무엇인가?` | Keep this exact stem for gauge/instrument families. |
| What should the driver do? | `운전자가 취해야 할 조치는?` | Best default for MCQ stems. |
| How should the driver proceed? | `운전자는 어떻게 해야 하는가?` | Better for row statements or broader safe-driving prompts. |
| Which violation is this? | `어떤 위반행위에 해당하는가?` | Prefer `해당하는가` to stiff legalese. |
| What penalty applies? | `어떤 처벌을 받는가?` | Use only when penalty is the actual tested concept. |
| may / may not | `할 수 있다 / 할 수 없다` | Keep the pair fixed across the bank. |
| must / should | `해야 한다` | Use `반드시` only if the rule is explicitly mandatory. |
| yield | `양보해야 한다` | Do not alternate casually with `비켜 줘야 한다`. |
| reduce speed | `감속해야 한다` | Use `서행하다` when the point is slow passing, not mere deceleration. |
| stop / pull over | `정차해야 한다` | Reserve `주차` for parking, not temporary stopping. |
| keep distance | `안전거리를 유지해야 한다` | More exam-natural than a literal long paraphrase. |
| turn on hazard lights | `비상점멸등을 켜야 한다` | Standardize on `비상점멸등`. |
| report immediately | `즉시 신고해야 한다` | Good default for accident handling. |

### Translation rules that help readability

- Prefer `차로` when you mean the lane a vehicle drives in.
- Prefer `차선` or `차선 경계선` when you mean painted lane lines.
- Use `노면` as the Korean taxonomy/subtopic label for road markings.
- In question wording, prefer `노면표시` for the tested marking itself.
- In PDF-first lane-use families, prefer direct label terms such as `갈림길차선`, `좌회전차선`, `우회전차선`, `직진 우회전 공용차선`, `직진 좌회전 공용차선`, `U턴 차선` when the image and English source truth clearly support them.
- In school-zone sign families, lock `어린이 보호구역` for `school area` and keep `어린이 주의` as the warning-only label.
- In animal-sign families, keep `야생동물 주의`, `동물 주의`, and `야생동물 보호구역` distinct.
- In bus-lane families, prefer `공공버스 전용 차로`, `간선급행버스(BRT) 전용 차로`, `대형버스 전용 차로`, `소형버스 전용 차로`, and `다인승 차량 전용 차로`.
- In road-marking families, prefer `도로 진입 표시`, `도로 출구 표시`, `통과 가능한 차로 구분선`, `망형 노면표시`, `중앙 원형 표시`, `유도 차로선`, `가변 유도 차로선`, and `진행 방향 유도선`.
- In lane-label sign families, prefer `직진·좌회전 공용차선`, `직진·우회전 공용차선`, `직진·U턴 공용차선`, and `U턴 차선`.
- Prefer `정차` for a temporary or required stop.
- Prefer `주차` only for parking.
- Prefer `안전거리` as the default translation of following distance.
- Prefer `통행 우선권` when right-of-way is the tested concept.

### Terms to avoid or modernize

| Avoid as default | Prefer | Why |
| --- | --- | --- |
| `문명운전` | `안전 운전` | Use this as the default live-bank replacement unless a question explicitly contrasts manners/courtesy. |
| `수리보양` | `정비·관리`, `점검·정비` | Natural Korean is shorter and clearer. |
| `도로교통표시선` as a blanket term | `노면`, `노면표시` | Use `노면` for taxonomy labels and `노면표시` in question stems. |
| `차선 변경` for every lane-change context | `차로 변경` | `차선` is better reserved for markings. |
| `법에 의거하여` | `법에 따라` | Shorter and less bureaucratic. |
| `비자동차` alone | `비동력 차량`, `자전거 등 비동력 차량` | More user-friendly unless an official/legal label clearly requires the exact term. |
| `차량을 몬다` | `운전하다` | Keep exam tone formal and neutral. |

## C. Glossary By App Taxonomy

### 1. Road Safety

| Category | Subtopic | English concept | Preferred Korean wording | Notes |
| --- | --- | --- | --- | --- |
| Road Safety | license | driving licence | `운전면허` | Use `운전면허증` when the physical card/document is meant. |
| Road Safety | license | driving licence card | `운전면허증` | Keep distinct from the abstract right/qualification. |
| Road Safety | license | probation period | `실습기간` | This is the Korean form closest to the Chinese exam concept. |
| Road Safety | license | penalty points | `벌점` | Stable and should stay consistent everywhere. |
| Road Safety | license | reissue / replacement | `면허 재발급` | Good default for lost, damaged, or renewed licence-card wording. |
| Road Safety | license | licence revocation / suspension | `면허 취소`, `면허 정지` | Keep the pair fixed; do not collapse them. |
| Road Safety | license | detain the driving licence | `운전면허증을 압류하다` | Used in legal/admin questions. |
| Road Safety | license | drive a vehicle matching licence class | `면허 종류에 맞는 차량을 운전하다` | Better than a literal "qualification listed on the licence". |
| Road Safety | registration | vehicle registration | `자동차 등록` | Use as the core term. |
| Road Safety | registration | licence plate | `번호판` | Use `자동차 번호판` on first mention if clarity helps. |
| Road Safety | registration | temporary plate | `임시 운행 번호판` | Natural and close to PDF phrasing. |
| Road Safety | registration | inspection label | `검사표지` | Use this as the default recurring term unless the exact wording requires a fuller label. |
| Road Safety | registration | insurance label | `보험표지` | Keep consistent in admin/legal questions. |
| Road Safety | registration | vehicle management office | `차량관리소` | Useful for China-specific process wording; manual review still recommended. |
| Road Safety | accidents | traffic accident | `교통사고` | Default term across the bank. |
| Road Safety | accidents | accident scene | `사고 현장` | Use with `현장 보존` and `즉시 신고`. |
| Road Safety | accidents | preserve the scene | `현장을 보존하다` | Strong recurring exam phrase. |
| Road Safety | accidents | rescue the injured | `부상자를 구조하다` | `구호하다` also works, but `구조하다` is plainer. |
| Road Safety | accidents | report to the police immediately | `즉시 경찰에 신고하다` | Good default for accident-handling stems. |
| Road Safety | accidents | flee the scene | `사고 현장을 이탈하다` | Better exam/legal tone than casual `도주하다` as the main term. |
| Road Safety | accidents | collect evidence | `증거를 확보하다` | Use when police detention or accident processing is involved. |
| Road Safety | road-conditions | road / weather conditions | `노면·기상 상태` | Useful umbrella phrase for section-level summaries. |
| Road Safety | road-conditions | wet road surface | `젖은 노면` | Better than a literal full-clause translation every time. |
| Road Safety | road-conditions | slippery road | `미끄러운 노면` | Standardize with wet/icy conditions. |
| Road Safety | road-conditions | muddy road | `진흙탕길` | Close to PDF wording and still natural. |
| Road Safety | road-conditions | fog / rain / snow conditions | `안개길`, `빗길`, `눈길` | Prefer compact condition nouns in question text. |
| Road Safety | road-conditions | tunnel / mountain road / sharp curve | `터널`, `산길`, `급커브` | Reusable for hazard and visibility prompts. |

### 2. Traffic Signals

| Category | Subtopic | English concept | Preferred Korean wording | Notes |
| --- | --- | --- | --- | --- |
| Traffic Signals | signal-lights | traffic lights | `신호등` | Default umbrella term. |
| Traffic Signals | signal-lights | red / yellow / green light | `적색 신호`, `황색 신호`, `녹색 신호` | Slightly more exam-formal than `빨간불/노란불/초록불`. |
| Traffic Signals | signal-lights | flashing yellow | `황색 점멸 신호` | Keep fixed for repeated signal-light questions. |
| Traffic Signals | signal-lights | green arrow light | `녹색 화살표 신호` | Use when lane direction matters. |
| Traffic Signals | signal-lights | intersection | `교차로` | Core term; use everywhere consistently. |
| Traffic Signals | signal-lights | level crossing | `철길 건널목` | Natural Korean exam wording. |
| Traffic Signals | signal-lights | lane signal | `차로별 진행 신호` | Useful for controlled-lane questions. |
| Traffic Signals | road-signs | road sign | `표지판` | Use this as the Korean taxonomy/subtopic label; `표지` is fine inside stems. |
| Traffic Signals | road-signs | warning sign | `경고표지` | Stable category term from the PDF. |
| Traffic Signals | road-signs | prohibitory sign | `금지표지` | Stable category term from the PDF. |
| Traffic Signals | road-signs | mandatory / indication sign | `지시표지` | Use `지시표지` consistently, not ad hoc paraphrases. |
| Traffic Signals | road-signs | guide sign | `안내표지` | Good default for directional/route guidance signs. |
| Traffic Signals | road-signs | parking sign | `주차장 표지` | Prefer the simple Korean label when the image makes it obvious. |
| Traffic Signals | road-signs | maximum / minimum speed sign | `최고속도`, `최저속도` | Keep concise; avoid over-explaining the sign name. |
| Traffic Signals | road-markings | road marking | `노면표시` | Keep the tested concept tied to `노면` wording. |
| Traffic Signals | road-markings | center line | `중앙선` | Standard road-marking term. |
| Traffic Signals | road-markings | solid line / broken line | `실선`, `점선` | Reusable across sign-and-marking questions. |
| Traffic Signals | road-markings | yellow solid / broken line | `황색 실선`, `황색 점선` | Keep color first for consistency. |
| Traffic Signals | road-markings | white solid / broken line | `백색 실선`, `백색 점선` | Match the same pattern as yellow lines. |
| Traffic Signals | road-markings | stop line | `정지선` | Stable traffic-law term. |
| Traffic Signals | road-markings | crosswalk | `횡단보도` | Use everywhere; do not vary with casual paraphrases. |
| Traffic Signals | road-markings | lane boundary line | `차선 경계선` | Use when the marking itself is the tested concept. |
| Traffic Signals | road-markings | directional arrow marking | `진행 방향 화살표` | Better live-bank wording than a literal long form. |
| Traffic Signals | police-signals | traffic police hand signal | `교통경찰 수신호` | Keep this exact phrase. |
| Traffic Signals | police-signals | stop signal | `정지 신호` | Standard label for hand-signal questions. |
| Traffic Signals | police-signals | proceed-straight signal | `직진 신호` | Standard label for hand-signal questions. |
| Traffic Signals | police-signals | left-turn waiting signal | `좌회전 대기 신호` | Matches PDF usage. |
| Traffic Signals | police-signals | left-turn signal | `좌회전 신호` | Keep parallel with other signal labels. |
| Traffic Signals | police-signals | right-turn signal | `우회전 신호` | Keep parallel with other signal labels. |
| Traffic Signals | police-signals | lane-change signal | `차선 변경 신호` | Keep as the conventional label inside this specific hand-signal set. |
| Traffic Signals | police-signals | pull-over signal | `길가 정차 신호` | Useful for police-control questions. |
| Traffic Signals | police-signals | slow-down signal | `감속 서행 신호` | Strong reusable phrase from the PDF set. |

### 3. Proper Driving

| Category | Subtopic | English concept | Preferred Korean wording | Notes |
| --- | --- | --- | --- | --- |
| Proper Driving | safe-driving | safe driving | `안전운전` | Core category term. |
| Proper Driving | safe-driving | civilized driving | `안전 운전` | Default replacement for the PDF's dated `문명운전`. |
| Proper Driving | safe-driving | yield / give way | `양보하다` | Standardize across pedestrians, non-motor vehicles, and oncoming traffic. |
| Proper Driving | safe-driving | reduce speed | `감속하다` | Default for immediate speed reduction. |
| Proper Driving | safe-driving | drive slowly | `서행하다` | Use when passing schools, curves, crowds, or hazards. |
| Proper Driving | safe-driving | stop / pull over | `정차하다` | More precise than using `멈추다` everywhere. |
| Proper Driving | safe-driving | keep a safe distance | `안전거리를 유지하다` | Strong recurring exam phrase. |
| Proper Driving | safe-driving | lane change | `차로를 변경하다` | Prefer this wording outside police-hand-signal labels. |
| Proper Driving | safe-driving | overtake | `추월하다` | Keep consistent across rules and safe-driving prompts. |
| Proper Driving | safe-driving | right of way | `통행 우선권` | Use when the tested concept is priority, not politeness. |
| Proper Driving | safe-driving | give way to pedestrians | `보행자에게 양보하다` | Stable and natural. |
| Proper Driving | safe-driving | use hazard warning lights | `비상점멸등을 켜다` | Default wording for breakdown and poor-visibility questions. |
| Proper Driving | safe-driving | shoulder / emergency lane | `갓길`, `비상차로` | Keep the distinction when the question makes it relevant. |
| Proper Driving | safe-driving | warning triangle / breakdown sign | `고장 차량 경고표지판`, `삼각표지판` | Both are useful; keep one chosen term per question. |
| Proper Driving | safe-driving | traffic jam / congestion | `교통 정체` | Better than long literal paraphrases. |
| Proper Driving | safe-driving | tire blowout | `타이어가 터지다` | Preferred over casual slang. |
| Proper Driving | safe-driving | engine braking | `엔진 브레이크를 사용하다` | Useful for downhill and emergency-control questions. |
| Proper Driving | safe-driving | hold the steering wheel firmly | `핸들을 두 손으로 단단히 잡다` | Common in tire-blowout and skid-control items. |
| Proper Driving | safe-driving | night / fog / rain / snow driving | `야간 운전`, `안개길`, `빗길`, `눈길` | Keep the compact condition labels. |
| Proper Driving | safe-driving | expressway driving | `고속도로 주행` | Good default umbrella term. |
| Proper Driving | traffic-laws | violation | `위반행위` | Best default across law-and-penalty questions. |
| Proper Driving | traffic-laws | penalty / punishment | `처벌` | Short and reusable. |
| Proper Driving | traffic-laws | penalty points | `벌점` | Do not alternate with loose paraphrases. |
| Proper Driving | traffic-laws | fine / administrative fine | `범칙금·과태료` | Needs context-sensitive choice; see audit notes. |
| Proper Driving | traffic-laws | criminal detention | `구류` | Keep distinct from fines and imprisonment. |
| Proper Driving | traffic-laws | imprisonment | `징역` | Standard legal term. |
| Proper Driving | traffic-laws | criminal liability | `형사책임` | Use when the legal consequence itself is tested. |
| Proper Driving | traffic-laws | drunk driving | `음주운전` | Stable and standard. |
| Proper Driving | traffic-laws | drug-impaired driving | `약물 복용 후 운전` | Safer/natural phrasing than a literal calque. |
| Proper Driving | traffic-laws | speeding | `과속` | Keep concise. |
| Proper Driving | traffic-laws | overloaded / over-seated | `과적`, `정원 초과` | Keep cargo and passenger violations distinct. |
| Proper Driving | traffic-laws | use of mobile phone while driving | `운전 중 휴대전화 사용` | Natural standardized form. |

### 4. Driving Operations

| Category | Subtopic | English concept | Preferred Korean wording | Notes |
| --- | --- | --- | --- | --- |
| Driving Operations | indicators | instrument panel / dashboard | `계기판` | Default umbrella term. |
| Driving Operations | indicators | speedometer | `속도계` | Prefer the common Korean term over a literal gauge phrase. |
| Driving Operations | indicators | tachometer | `엔진 회전수계` | Natural for exam translation; PDF also uses gauge-style wording. |
| Driving Operations | indicators | fuel gauge | `연료 게이지` | Clear and familiar. |
| Driving Operations | indicators | coolant temperature gauge | `냉각수 온도 게이지` | Better live-bank wording than a direct long calque. |
| Driving Operations | indicators | warning light | `경고등` | Use only when the concept specifically needs the warning-light label; fixed visual stems should often start from `계기판에 등이 켜졌다...`. |
| Driving Operations | indicators | indicator light | `계기판 표시등` | Use this when the item is a non-fault status light on the dashboard. |
| Driving Operations | indicators | low-beam indicator | `하향 전조등 표시등` | Keep `전조등` consistent. |
| Driving Operations | indicators | high-beam indicator | `상향 전조등 표시등` | Keep paired with low beam. |
| Driving Operations | indicators | front / rear fog light | `전면 안개등`, `후면 안개등` | Prefer these in PDF-first fixed visual switch/light families. |
| Driving Operations | indicators | turn signal indicator | `방향지시등` | Use as the default vehicle-light term. |
| Driving Operations | indicators | hazard warning lights | `비상점멸등` | Keep fixed across both driving and dashboard questions. |
| Driving Operations | indicators | seat belt warning light | `안전벨트 경고등` | Standard term. |
| Driving Operations | indicators | engine oil pressure warning | `엔진오일 압력 경고등` | Safer than alternating with shorter informal variants. |
| Driving Operations | indicators | brake system warning light | `브레이크 시스템 경고등` | Good default wording. |
| Driving Operations | indicators | ABS warning light | `ABS 경고등` | Stable acronym-based term. |
| Driving Operations | indicators | airbag warning light | `에어백 경고등` | Stable acronym-based term. |
| Driving Operations | indicators | door / trunk / hood open indicator | `문 열림`, `트렁크 열림`, `엔진룸 열림` | Short, image-friendly labels. |
| Driving Operations | gears | steering wheel | `핸들` | Natural everyday Korean; acceptable in exam text. |
| Driving Operations | gears | clutch pedal | `클러치 페달` | Standard control term. |
| Driving Operations | gears | brake pedal | `브레이크 페달` | Standard control term. |
| Driving Operations | gears | accelerator pedal | `가속 페달` | Prefer this over overly literal variants. |
| Driving Operations | gears | parking brake | `주차 브레이크` | Good default for the control itself. |
| Driving Operations | gears | gear shift lever | `기어 변속 레버` | Natural and implementation-friendly. |
| Driving Operations | gears | ignition switch | `시동 스위치` | Standard term for key/switch items. |
| Driving Operations | gears | light switch | `전조등 스위치` | In PDF-first fixed visual families, prefer more specific switch labels such as `하향 전조등 스위치`, `상향 전조등 스위치`, `실내등 스위치`, `후면 안개등 스위치` when the icon family supports them. |
| Driving Operations | gears | wiper switch | `와이퍼 스위치` | Stable device term. |
| Driving Operations | gears | washer fluid | `워셔액` | Best default consumer-facing term. |
| Driving Operations | gears | defrost / defog | `서리 제거`, `제습` | Prefer these PDF-style terms in switch/control option families; do not normalize everything to `김서림 제거`. |
| Driving Operations | gears | headrest | `헤드레스트` | Natural Korean; `머리 받침` can appear in notes if needed. |
| Driving Operations | gears | seat belt | `안전벨트` | Stable safety-device term. |
| Driving Operations | gears | airbag | `에어백` | Stable safety-device term. |
| Driving Operations | gears | ABS | `ABS` | Leave the acronym as-is. |

## D. Short Audit Notes

### Mapped cleanly

- `도로교통신호 및 의미` -> `Traffic Signals`
- `자동차 전체구조...` -> `Driving Operations`
- The PDF's signal-light, sign, marking, and police-signal wording is directly reusable.
- Dashboard, warning-light, pedal, switch, and safety-device vocabulary is also directly reusable.

### Awkward or ambiguous

- `Road Safety` vs `Proper Driving` is not cleanly separated in the PDF.
  Legal penalties live mostly in section 1.
  Operational rule wording lives mostly in section 3.
- `road-conditions` is distributed across hazard, weather, mountain-road, tunnel, highway, and emergency-driving pages rather than a single labeled section.
- `Driving Operations > gears` is broader in practice than the subtopic name suggests; the PDF bundles controls, switches, and safety devices together.

### Terms that need manual/native review

- `문명운전`
- `수리보양`
- `비자동차`
- `차량관리소`
- `검사표지` vs any fuller legal/administrative label
- `보험표지`
- penalty-language distinctions:
  `범칙금`
  `과태료`
  `벌금`
  `벌점`
  `구류`

## Recommendation For The Translation Pass

- Treat this file as a Korean reference layer, not a replacement dataset.
- Reuse the glossary wording first.
- If a literal translation sounds stiff, prefer the style-guide pattern unless the question is explicitly testing a legal label or instrument name.
