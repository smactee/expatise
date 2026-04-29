function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function unique(values) {
  return [...new Set(toList(values).filter(Boolean))];
}

function normalizeKeywordToken(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const COLOR_ONLY_KEYWORDS = new Set([
  "black",
  "blue",
  "brown",
  "gray",
  "green",
  "grey",
  "orange",
  "pink",
  "purple",
  "red",
  "silver",
  "white",
  "yellow",
]);

const WEAK_KEYWORDS = new Set([
  "action",
  "answer",
  "car",
  "cars",
  "choose",
  "correct",
  "drive",
  "driver",
  "drivers",
  "driving",
  "kind",
  "meaning",
  "meanings",
  "option",
  "options",
  "question",
  "response",
  "responses",
  "road",
  "rule",
  "rules",
  "statement",
  "symbol",
  "text",
  "traffic",
  "vehicle",
  "vehicles",
]);

const TOPIC_KEYWORD_ALLOWLIST = new Set([
  "accidents",
  "dashboard-indicator",
  "driving-operations",
  "emergency-lane",
  "gears",
  "indicators",
  "license",
  "police-signals",
  "registration",
  "road-conditions",
  "road-markings",
  "road-signs",
  "safe-driving",
  "signal-lights",
  "traffic-laws",
]);

const GLOSS_CONCEPT_PRIORITY = new Map([
  ["school-zone", 140],
  ["traffic-light", 135],
  ["crosswalk", 132],
  ["pedestrian", 131],
  ["bicycle", 130],
  ["non-motorized-vehicle", 128],
  ["expressway", 126],
  ["intersection", 124],
  ["railroad-crossing", 123],
  ["tunnel", 122],
  ["bridge", 121],
  ["dashboard-indicator", 120],
  ["police-hand-signal", 119],
  ["road-marking", 118],
  ["sign", 117],
  ["low-beam", 116],
  ["high-beam", 115],
  ["hazard-lights", 114],
  ["parking-brake", 113],
  ["seatbelt", 112],
  ["turn-signal", 111],
  ["left-turn", 110],
  ["right-turn", 109],
  ["u-turn", 108],
  ["yield", 107],
  ["overtake", 106],
  ["reverse", 105],
  ["slow", 104],
  ["stop", 103],
  ["accelerate", 102],
  ["honk", 101],
  ["fog", 100],
  ["rain", 99],
  ["snow", 98],
  ["muddy-road", 97],
  ["night", 96],
  ["parking", 95],
  ["door-open", 94],
  ["fuel", 93],
  ["brake-system", 92],
  ["engine", 91],
  ["gauge", 90],
  ["switch", 89],
]);

const PROMPT_FAMILY_LABELS = {
  "dashboard-indicator": "dashboard indicator meaning",
  "device-identity": "device identification",
  "driver-action": "driver response",
  "gauge-identity": "gauge identification",
  "intersection-action": "driver action at intersection",
  "marking-meaning": "road marking meaning",
  "penalty-kind": "penalty or legal consequence",
  "picture-show": "picture meaning",
  "police-hand-signal": "police hand signal meaning",
  "road-sign-meaning": "road sign meaning",
  "sign-meaning": "road sign meaning",
  "switch-control": "switch control meaning",
  "symbol-meaning": "symbol meaning",
  "traffic-light-meaning": "traffic light meaning",
  "violation-kind": "violation type",
};

const PROMPT_FAMILY_PATTERNS = {
  ko: [
    { family: "police-hand-signal", pattern: /교통경찰.*수신호/ },
    { family: "dashboard-indicator", pattern: /계기판.*(?:등|표시).*의미|계기판에 등이 켜졌다|경고등.*의미|표시등.*의미|인스트루먼트 패널|브레이크 경고등|배터리 경고등|엔진 경고등|ABS 경고등|안전벨트 경고등/ },
    { family: "switch-control", pattern: /스위치.*어떤 장치/ },
    { family: "gauge-identity", pattern: /이 계기는 무엇인가/ },
    { family: "device-identity", pattern: /이 장치는 무엇인가|이 페달은 무엇인가/ },
    { family: "marking-meaning", pattern: /노면표시.*의미/ },
    { family: "sign-meaning", pattern: /이 표지의 뜻은|이 표지는 .* 나타낸다|이 표지는 어떤 종류|교통표지.*의미|도로표지.*의미/ },
    { family: "symbol-meaning", pattern: /이 표시의 뜻은|이 표시의 의미는|이 유도 화살표의 뜻은|이 안내 화살표의 뜻은|기호.*의미/ },
    { family: "traffic-light-meaning", pattern: /신호등.*의미|신호등.*만났을 때|이 신호는 무엇|점멸 신호.*의미/ },
    { family: "intersection-action", pattern: /이 교차로.*(?:통과|어떻게 해야|무엇을 할)|이 상황에서 .*교차로/ },
    { family: "driver-action", pattern: /운전자는 어떻게 해야|운전자가 취해야 할 조치|어떻게 통과해야 하는가|무엇을 해야 하는가|어떻게 진행해야|올바른 대응은|이 상황에서 .*해야/ },
    { family: "violation-kind", pattern: /위반사항은 무엇|어떤 위반행위/ },
    { family: "penalty-kind", pattern: /어떤 처분|어떤 처벌/ },
  ],
  ja: [
    { family: "police-hand-signal", pattern: /交通警察.*手信号|警察官.*手信号/ },
    { family: "dashboard-indicator", pattern: /インパネ.*点灯|ダッシュボード.*表示灯|計器盤.*表示灯|警告灯|表示灯.*意味|ブレーキ警告灯|バッテリー警告灯|油圧警告灯|ABS警告灯|シートベルト警告灯|エンジン警告灯/ },
    { family: "switch-control", pattern: /スイッチ.*どの.*装置|操作装置は何/ },
    { family: "gauge-identity", pattern: /メーターは何か|計器は何か/ },
    { family: "device-identity", pattern: /この操縦装置は何か|この操作装置は何か|これは何のペダルか/ },
    { family: "marking-meaning", pattern: /路面(?:標示|表示).*(示|意味)|この矢印はなにを示すか/ },
    { family: "sign-meaning", pattern: /この標識.*(?:示|意味)|この交通標識.*(?:示|意味)|この道路標識.*(?:示|意味)|警戒標識.*意味|規制標識.*意味/ },
    { family: "symbol-meaning", pattern: /この記号.*(?:示|意味)|この図.*示|この表示.*意味/ },
    { family: "traffic-light-meaning", pattern: /信号(?:灯)? .*示|この信号.*なにを示し|信号.*意味|点滅信号.*意味/ },
    { family: "intersection-action", pattern: /この交差点.*(?:走行|通る)|交差点でこのような状況|この場合.*交差点/ },
    { family: "driver-action", pattern: /運転者はどうすべき|どう対応するのが適切|どうするのが適切|どう走行すべき|どう進行すべき|正しい対応は/ },
    { family: "violation-kind", pattern: /違反.*何|違反行為/ },
    { family: "penalty-kind", pattern: /どのような処分|どのような罰/ },
  ],
  ru: [
    { family: "police-hand-signal", pattern: /жест.*регулировщика|сигнал.*регулировщика/iu },
    { family: "dashboard-indicator", pattern: /данн(?:ая|ый|ое) (?:кнопка|лампа|табло)|загорается|тормозн(?:ой|ая) систем|сигнальная лампа|индикаторная лампа|панел[ьи] приборов|щиток приборов|лампа ABS|лампа давления масла|лампа аккумулятора|лампа ремня безопасности|лампа двигателя/iu },
    { family: "switch-control", pattern: /каким устройством.*управляет|данный переключатель/iu },
    { family: "gauge-identity", pattern: /что показывает данн(?:ый|ое) .*прибор|что это за прибор/iu },
    { family: "device-identity", pattern: /что это за устройств|какая это педаль|что означает данная кнопка/iu },
    { family: "marking-meaning", pattern: /что означает .*разметк|значение .*границы на дороге|что означает отметка на дороге/iu },
    { family: "sign-meaning", pattern: /^что означает данн(?:ый|ая|ое) знак|что означает дорожный знак|значение .*знак/iu },
    { family: "symbol-meaning", pattern: /^что означает данн(?:ый|ая|ое)|что означает .*символ|значение .*символ/iu },
    { family: "traffic-light-meaning", pattern: /сигнал(?:а)? светофора|мигание .*сигнала|что означает .*сигнал светофора/iu },
    { family: "intersection-action", pattern: /проехать .*перекр[её]сток|как проехать .*ситуации|на перекр[её]стке .*как/iu },
    { family: "driver-action", pattern: /что следует сделать водителю|водителю следует|ваше действие|как следует|как должен поступить водитель|как правильно действовать|как продолжить движение/iu },
    { family: "violation-kind", pattern: /какое .*нарушен|в чем нарушение/iu },
    { family: "penalty-kind", pattern: /к какой ответственности|какое наказание|привлекут к/iu },
  ],
};

const LOCALIZED_CONCEPT_PATTERNS = {
  ko: [
    { pattern: /표지판|표지/, concepts: ["sign"] },
    { pattern: /노면표시|노면 표시/, concepts: ["road-marking"] },
    { pattern: /신호등/, concepts: ["traffic-light"] },
    { pattern: /교차로/, concepts: ["intersection"] },
    { pattern: /보행자|횡단보도/, concepts: ["pedestrian", "crosswalk"] },
    { pattern: /자전거/, concepts: ["bicycle"] },
    { pattern: /비동력 차량|비자동차/, concepts: ["non-motorized-vehicle"] },
    { pattern: /철길 건널목|건널목/, concepts: ["railroad-crossing"] },
    { pattern: /터널/, concepts: ["tunnel"] },
    { pattern: /다리|교량|교량/, concepts: ["bridge"] },
    { pattern: /안개/, concepts: ["fog"] },
    { pattern: /빗길|비가 오|폭우|호우/, concepts: ["rain"] },
    { pattern: /눈길|눈이 오|빙판|결빙/, concepts: ["snow"] },
    { pattern: /진흙길|진흙|수렁/, concepts: ["muddy-road"] },
    { pattern: /고속도로/, concepts: ["expressway"] },
    { pattern: /비상차로|갓길/, concepts: ["emergency-lane"] },
    { pattern: /학교|어린이 보호구역/, concepts: ["school-zone"] },
    { pattern: /방향지시등|윙커|우인커|깜빡이/, concepts: ["turn-signal"] },
    { pattern: /좌회전/, concepts: ["left-turn"] },
    { pattern: /우회전/, concepts: ["right-turn"] },
    { pattern: /유턴|U턴/, concepts: ["u-turn"] },
    { pattern: /후진/, concepts: ["reverse"] },
    { pattern: /추월/, concepts: ["overtake"] },
    { pattern: /양보/, concepts: ["yield"] },
    { pattern: /감속|서행|속도를 줄/, concepts: ["slow"] },
    { pattern: /정차|정지|멈추/, concepts: ["stop"] },
    { pattern: /가속/, concepts: ["accelerate"] },
    { pattern: /경적|클락션|크락션/, concepts: ["honk"] },
    { pattern: /안전벨트/, concepts: ["seatbelt"] },
    { pattern: /비상점멸등|비상등/, concepts: ["hazard-lights"] },
    { pattern: /주차 브레이크|주차제동장치/, concepts: ["parking-brake"] },
    { pattern: /브레이크 시스템|제동 시스템|제동장치/, concepts: ["brake-system"] },
    { pattern: /상향등|상향 전조등/, concepts: ["high-beam"] },
    { pattern: /하향등|하향 전조등/, concepts: ["low-beam"] },
    { pattern: /계기판|경고등|표시등/, concepts: ["dashboard-indicator"] },
    { pattern: /스위치/, concepts: ["switch"] },
    { pattern: /계기|게이지/, concepts: ["gauge"] },
    { pattern: /수신호/, concepts: ["police-hand-signal"] },
    { pattern: /문이 열|도어가 열/, concepts: ["door-open"] },
    { pattern: /연료|주유/, concepts: ["fuel"] },
    { pattern: /엔진/, concepts: ["engine"] },
    { pattern: /야간|밤/, concepts: ["night"] },
    { pattern: /주차|정차 금지|주차 금지/, concepts: ["parking"] },
  ],
  ja: [
    { pattern: /道路標識|交通標識|標識/, concepts: ["sign"] },
    { pattern: /路面標示|路面表示|矢印/, concepts: ["road-marking"] },
    { pattern: /信号(?:灯)?/, concepts: ["traffic-light"] },
    { pattern: /交差点/, concepts: ["intersection"] },
    { pattern: /歩行者|横断歩道/, concepts: ["pedestrian", "crosswalk"] },
    { pattern: /自転車/, concepts: ["bicycle"] },
    { pattern: /非自動車|非動力車/, concepts: ["non-motorized-vehicle"] },
    { pattern: /踏み切り|線路/, concepts: ["railroad-crossing"] },
    { pattern: /トンネル/, concepts: ["tunnel"] },
    { pattern: /橋/, concepts: ["bridge"] },
    { pattern: /霧/, concepts: ["fog"] },
    { pattern: /雨|豪雨|大雨/, concepts: ["rain"] },
    { pattern: /雪|アイスバーン/, concepts: ["snow"] },
    { pattern: /ぬかるん|泥/, concepts: ["muddy-road"] },
    { pattern: /高速道路/, concepts: ["expressway"] },
    { pattern: /非常停車帯|路肩/, concepts: ["emergency-lane"] },
    { pattern: /学校|住宅区|児童/, concepts: ["school-zone"] },
    { pattern: /ウィンカー|ウインカー|方向指示器/, concepts: ["turn-signal"] },
    { pattern: /左折|左へ曲/, concepts: ["left-turn"] },
    { pattern: /右折|右へ曲/, concepts: ["right-turn"] },
    { pattern: /Uターン|転回/, concepts: ["u-turn"] },
    { pattern: /バック|後退/, concepts: ["reverse"] },
    { pattern: /追い越し/, concepts: ["overtake"] },
    { pattern: /譲る|ゆずる/, concepts: ["yield"] },
    { pattern: /徐行|減速|速度を落と/, concepts: ["slow"] },
    { pattern: /停車|停止|止ま/, concepts: ["stop"] },
    { pattern: /加速/, concepts: ["accelerate"] },
    { pattern: /クラクション/, concepts: ["honk"] },
    { pattern: /シートベルト/, concepts: ["seatbelt"] },
    { pattern: /ハザード|非常点滅灯/, concepts: ["hazard-lights"] },
    { pattern: /パーキングブレーキ|駐車ブレーキ/, concepts: ["parking-brake"] },
    { pattern: /ブレーキ系統|制動装置|ブレーキシステム/, concepts: ["brake-system"] },
    { pattern: /ハイビーム/, concepts: ["high-beam"] },
    { pattern: /ロービーム/, concepts: ["low-beam"] },
    { pattern: /インパネ|ダッシュボード|計器盤|表示灯|警告灯/, concepts: ["dashboard-indicator"] },
    { pattern: /スイッチ/, concepts: ["switch"] },
    { pattern: /メーター|計器/, concepts: ["gauge"] },
    { pattern: /手信号/, concepts: ["police-hand-signal"] },
    { pattern: /ドア.*開/, concepts: ["door-open"] },
    { pattern: /燃料|給油/, concepts: ["fuel"] },
    { pattern: /エンジン/, concepts: ["engine"] },
    { pattern: /夜間/, concepts: ["night"] },
    { pattern: /駐車/, concepts: ["parking"] },
  ],
  ru: [
    { pattern: /знак/iu, concepts: ["sign"] },
    { pattern: /разметк|стрелк.*дорог/iu, concepts: ["road-marking"] },
    { pattern: /светофор|сигнал светофора/iu, concepts: ["traffic-light"] },
    { pattern: /перекр[её]сток/iu, concepts: ["intersection"] },
    { pattern: /пешеход|пешеходн/iu, concepts: ["pedestrian", "crosswalk"] },
    { pattern: /велосипедист|велосипед/iu, concepts: ["bicycle"] },
    { pattern: /безмоторн|немоторн/iu, concepts: ["non-motorized-vehicle"] },
    { pattern: /железнодорожн|переезд/iu, concepts: ["railroad-crossing"] },
    { pattern: /туннел/iu, concepts: ["tunnel"] },
    { pattern: /мост/iu, concepts: ["bridge"] },
    { pattern: /туман/iu, concepts: ["fog"] },
    { pattern: /дожд|ливн|мокр/iu, concepts: ["rain"] },
    { pattern: /снег|снежн|ледян|голол[её]д/iu, concepts: ["snow"] },
    { pattern: /гряз|грязн|луж/iu, concepts: ["muddy-road"] },
    { pattern: /скоростн.*дорог|автомагистрал|экспресс/iu, concepts: ["expressway"] },
    { pattern: /аварийн.*полос|обочин/iu, concepts: ["emergency-lane"] },
    { pattern: /школ|дет/iu, concepts: ["school-zone"] },
    { pattern: /сигнал поворота|поворотник/iu, concepts: ["turn-signal"] },
    { pattern: /лев.*поворот/iu, concepts: ["left-turn"] },
    { pattern: /прав.*поворот/iu, concepts: ["right-turn"] },
    { pattern: /разворот/iu, concepts: ["u-turn"] },
    { pattern: /задн.*ход/iu, concepts: ["reverse"] },
    { pattern: /обгон|обгонять/iu, concepts: ["overtake"] },
    { pattern: /уступить дорогу|пропустить/iu, concepts: ["yield"] },
    { pattern: /сбавить скорость|замедл|снизить скорость|медлен/iu, concepts: ["slow"] },
    { pattern: /останов|стоять|остановиться/iu, concepts: ["stop"] },
    { pattern: /ускор|разгон/iu, concepts: ["accelerate"] },
    { pattern: /сигналить|клаксон/iu, concepts: ["honk"] },
    { pattern: /ремень безопасности/iu, concepts: ["seatbelt"] },
    { pattern: /аварийн.*сигнал|аварийн.*свет/iu, concepts: ["hazard-lights"] },
    { pattern: /стояночн.*тормоз/iu, concepts: ["parking-brake"] },
    { pattern: /тормозн.*систем/iu, concepts: ["brake-system"] },
    { pattern: /дальн.*свет/iu, concepts: ["high-beam"] },
    { pattern: /ближн.*свет/iu, concepts: ["low-beam"] },
    { pattern: /кнопка|лампа|табло|индикатор/iu, concepts: ["dashboard-indicator"] },
    { pattern: /переключател/iu, concepts: ["switch"] },
    { pattern: /прибор/iu, concepts: ["gauge"] },
    { pattern: /регулировщик|жест/iu, concepts: ["police-hand-signal"] },
    { pattern: /двер.*открыт/iu, concepts: ["door-open"] },
    { pattern: /топлив|бензин/iu, concepts: ["fuel"] },
    { pattern: /двигател/iu, concepts: ["engine"] },
    { pattern: /темн.*время|ноч/iu, concepts: ["night"] },
    { pattern: /парков|стоянк/iu, concepts: ["parking"] },
  ],
};

const ENGLISH_CONCEPT_PATTERNS = [
  { pattern: /\broad sign\b/g, concepts: ["sign"] },
  { pattern: /\bsign\b/g, concepts: ["sign"] },
  { pattern: /\broad marking\b|\bmarking\b/g, concepts: ["road-marking"] },
  { pattern: /\btraffic light\b|\btraffic signal\b/g, concepts: ["traffic-light"] },
  { pattern: /\bintersection\b/g, concepts: ["intersection"] },
  { pattern: /\bresidential area\b|\bresidential zone\b/g, concepts: ["residential-area"] },
  { pattern: /\bcrosswalk\b/g, concepts: ["crosswalk", "pedestrian"] },
  { pattern: /\bpedestrian\b/g, concepts: ["pedestrian"] },
  { pattern: /\bbicycle(?: rider)?\b|\bbike\b/g, concepts: ["bicycle"] },
  { pattern: /\bbus stop\b/g, concepts: ["bus-stop"] },
  { pattern: /\bnon[- ]motorized vehicle\b/g, concepts: ["non-motorized-vehicle"] },
  { pattern: /\brailroad crossing\b|\blevel crossing\b/g, concepts: ["railroad-crossing"] },
  { pattern: /\btunnel\b/g, concepts: ["tunnel"] },
  { pattern: /\bbridge\b/g, concepts: ["bridge"] },
  { pattern: /\bmountain road\b/g, concepts: ["mountain-road", "mountain"] },
  { pattern: /\bcurve\b|\bsharp bend\b/g, concepts: ["curve"] },
  { pattern: /\bnarrow road\b|\bnarrow lane\b/g, concepts: ["narrow-road"] },
  { pattern: /\bfog\b/g, concepts: ["fog"] },
  { pattern: /\brain\b|\bheavy rain\b/g, concepts: ["rain"] },
  { pattern: /\bsnow\b/g, concepts: ["snow"] },
  { pattern: /\bicy road\b|\bicy\b|\bice-covered\b/g, concepts: ["icy-road", "snow"] },
  { pattern: /\bmuddy road\b|\bmud\b/g, concepts: ["muddy-road"] },
  { pattern: /\bexpressway\b|\bhighway\b/g, concepts: ["expressway"] },
  { pattern: /\bemergency lane\b|\bshoulder\b/g, concepts: ["emergency-lane"] },
  { pattern: /\bschool zone\b|\bschool area\b/g, concepts: ["school-zone"] },
  { pattern: /\bturn signal\b|\bindicator\b/g, concepts: ["turn-signal"] },
  { pattern: /\bleft turn\b/g, concepts: ["left-turn"] },
  { pattern: /\bright turn\b/g, concepts: ["right-turn"] },
  { pattern: /\bu[- ]turn\b/g, concepts: ["u-turn"] },
  { pattern: /\breverse\b|\bback(?:ing| up)?\b/g, concepts: ["reverse"] },
  { pattern: /\bovertake\b|\bpassing\b|\bpass\b/g, concepts: ["overtake"] },
  { pattern: /\byield\b|\bgive way\b/g, concepts: ["yield"] },
  { pattern: /\breduce speed\b|\bslow(?: down|ly)?\b/g, concepts: ["slow"] },
  { pattern: /\bstop(?: and wait)?\b/g, concepts: ["stop"] },
  { pattern: /\bstop and wait\b/g, concepts: ["stop", "wait", "stop-and-wait"] },
  { pattern: /\bstop to yield\b|\bstop and yield\b/g, concepts: ["stop", "yield", "stop-yield"] },
  { pattern: /\bproceed carefully\b|\bcontinue carefully\b|\bwith caution\b/g, concepts: ["proceed-carefully", "caution"] },
  { pattern: /\bcontinue\b|\bgo ahead\b|\bgo straight\b/g, concepts: ["continue"] },
  { pattern: /\baccelerate\b|\bspeed up\b/g, concepts: ["accelerate"] },
  { pattern: /\bhonk\b|\bhorn\b/g, concepts: ["honk"] },
  { pattern: /\bdo not honk\b|\bno horn\b|\bhorn(?:ing)? prohibited\b/g, concepts: ["no-honk", "must-not"] },
  { pattern: /\bno overtaking\b|\bovertaking prohibited\b|\bdo not overtake\b/g, concepts: ["no-overtake", "must-not"] },
  { pattern: /\bno parking\b|\bparking prohibited\b|\bdo not park\b/g, concepts: ["no-parking", "must-not"] },
  { pattern: /\bno reversing\b|\breverse prohibited\b|\bdo not reverse\b/g, concepts: ["no-reverse", "must-not"] },
  { pattern: /\bseatbelt\b|\bseat belt\b/g, concepts: ["seatbelt"] },
  { pattern: /\bhazard lights?\b|\bwarning lights?\b/g, concepts: ["hazard-lights"] },
  { pattern: /\buse hazard lights?\b|\bturn on hazard lights?\b/g, concepts: ["use-hazard-lights", "hazard-lights"] },
  { pattern: /\bgo ahead\b|\bproceed\b/g, concepts: ["go"] },
  { pattern: /\bfollow(?: the)? lane markings\b|\baccording to lane markings\b/g, concepts: ["follow-markings"] },
  { pattern: /\bbypass\b|\bpass around\b/g, concepts: ["overtake"] },
  { pattern: /\bcar park\b|\bparking lot\b|\bparking area\b/g, concepts: ["parking"] },
  { pattern: /\bpark\b/g, concepts: ["park", "parking"] },
  { pattern: /\bminimum speed\b|\bnot less than\b/g, concepts: ["min-speed", "minimum", "speed"] },
  { pattern: /\bmaximum speed\b|\bnot more than\b|\bno more than\b/g, concepts: ["max-speed", "maximum", "speed"] },
  { pattern: /\bfoot brake\b|\bbrake pedal\b|\bbrake\b/g, concepts: ["brake"] },
  { pattern: /\btire blows? out\b|\btyre blows? out\b|\bblowout\b/g, concepts: ["tire-blowout"] },
  { pattern: /\bramp\b/g, concepts: ["ramp"] },
  { pattern: /\bparking brake\b/g, concepts: ["parking-brake"] },
  { pattern: /\bbrake system\b/g, concepts: ["brake-system"] },
  { pattern: /\bhigh beam\b|\bfull beam(?: headlights?)?\b/g, concepts: ["high-beam"] },
  { pattern: /\blow beam\b|\bdipped headlights?\b/g, concepts: ["low-beam"] },
  { pattern: /\buse high beam\b|\bturn on high beam\b/g, concepts: ["use-high-beam", "high-beam"] },
  { pattern: /\buse low beam\b|\bturn on low beam\b/g, concepts: ["use-low-beam", "low-beam"] },
  { pattern: /\bno u[- ]turn\b|\bu[- ]turn prohibited\b/g, concepts: ["u-turn", "must-not"] },
  { pattern: /\bno reversing\b|\breverse prohibited\b/g, concepts: ["reverse", "must-not"] },
  { pattern: /\bdashboard\b|\bindicator light\b|\bwarning light\b/g, concepts: ["dashboard-indicator"] },
  { pattern: /\binstrument panel\b|\binstrument cluster\b|\bwarning indicator\b|\bwarning lamp\b/g, concepts: ["dashboard-indicator"] },
  { pattern: /\babs light\b/g, concepts: ["dashboard-indicator", "brake-system"] },
  { pattern: /\boil pressure light\b/g, concepts: ["dashboard-indicator", "engine"] },
  { pattern: /\bbattery light\b/g, concepts: ["dashboard-indicator"] },
  { pattern: /\bseat ?belt light\b/g, concepts: ["dashboard-indicator", "seatbelt"] },
  { pattern: /\bengine fault light\b|\bcheck engine\b/g, concepts: ["dashboard-indicator", "engine"] },
  { pattern: /\bswitch\b/g, concepts: ["switch"] },
  { pattern: /\bgauge\b|\bmeter\b/g, concepts: ["gauge"] },
  { pattern: /\bpolice hand signal\b/g, concepts: ["police-hand-signal"] },
  { pattern: /\bdoor(?:s)? open\b/g, concepts: ["door-open"] },
  { pattern: /\bfuel\b/g, concepts: ["fuel"] },
  { pattern: /\bengine\b/g, concepts: ["engine"] },
  { pattern: /\bnight\b/g, concepts: ["night"] },
  { pattern: /\bparking\b/g, concepts: ["parking"] },
  { pattern: /\bprohibited\b|\bforbidden\b|\bnot allowed\b|\bmust not\b/g, concepts: ["must-not"] },
  { pattern: /\bmust\b|\brequired\b/g, concepts: ["must"] },
  { pattern: /\bshould\b|\brecommended\b/g, concepts: ["should"] },
  { pattern: /\bmay\b|\bpermitted\b|\ballowed\b/g, concepts: ["may"] },
];

const ENGLISH_KEYWORD_PATTERNS = [
  ...ENGLISH_CONCEPT_PATTERNS,
  { pattern: /\baccident\b|\bcollision\b/g, concepts: ["accident"] },
  { pattern: /\bheadlight\b|\bhead light\b/g, concepts: ["headlight"] },
  { pattern: /\barrow\b/g, concepts: ["arrow"] },
  { pattern: /\bphone\b|\bmobile phone\b/g, concepts: ["phone"] },
  { pattern: /\byield sign\b/g, concepts: ["yield"] },
  { pattern: /\bno parking\b/g, concepts: ["no-parking"] },
  { pattern: /\bstop and wait\b/g, concepts: ["stop-and-wait"] },
];

function sortConcepts(concepts) {
  return unique(concepts).sort((left, right) => {
    const delta = (GLOSS_CONCEPT_PRIORITY.get(right) ?? 0) - (GLOSS_CONCEPT_PRIORITY.get(left) ?? 0);
    if (delta !== 0) {
      return delta;
    }

    return left.localeCompare(right);
  });
}

function detectPromptFamily(lang, localizedPrompt, fallbackFamily = null) {
  const prompt = normalizeWhitespace(localizedPrompt);

  if (!prompt) {
    return fallbackFamily ?? null;
  }

  for (const entry of PROMPT_FAMILY_PATTERNS[lang] ?? []) {
    if (entry.pattern.test(prompt)) {
      return entry.family;
    }
  }

  return fallbackFamily ?? null;
}

function extractLocalizedConcepts(lang, texts) {
  const patterns = LOCALIZED_CONCEPT_PATTERNS[lang] ?? [];
  const concepts = [];

  for (const rawText of toList(texts)) {
    const text = normalizeWhitespace(rawText);
    if (!text) {
      continue;
    }

    for (const entry of patterns) {
      if (entry.pattern.test(text)) {
        concepts.push(...entry.concepts);
      }
    }
  }

  return sortConcepts(concepts);
}

function extractEnglishConcepts(texts, { includeFallbackTokens = false } = {}) {
  const concepts = [];

  for (const rawText of toList(texts)) {
    const text = normalizeWhitespace(rawText).toLowerCase();
    if (!text) {
      continue;
    }

    for (const entry of ENGLISH_KEYWORD_PATTERNS) {
      if (entry.pattern.test(text)) {
        concepts.push(...entry.concepts);
      }
    }

    if (!includeFallbackTokens) {
      continue;
    }

    const tokens = text
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/\s+/)
      .map((token) => normalizeKeywordToken(token))
      .filter((token) => token.length >= 5)
      .filter((token) => !WEAK_KEYWORDS.has(token));
    concepts.push(...tokens);
  }

  return sortConcepts(concepts);
}

function normalizeImageKeywords(imageTags) {
  return sortConcepts(
    toList(imageTags)
      .map((tag) => normalizeKeywordToken(tag))
      .filter(Boolean)
      .filter((tag) => !COLOR_ONLY_KEYWORDS.has(tag)),
  );
}

function normalizeTopicKeywords(topic, subtopics) {
  const tags = unique([
    normalizeKeywordToken(topic),
    ...toList(subtopics).map((tag) => normalizeKeywordToken(String(tag).split(":").pop())),
  ]).filter(Boolean);

  return tags.filter((tag) => TOPIC_KEYWORD_ALLOWLIST.has(tag));
}

function conceptDisplayLabel(keyword) {
  return String(keyword ?? "")
    .replace(/-/g, " ")
    .replace(/\bmcq\b/g, "multiple choice")
    .trim();
}

function defaultLead(questionType, promptFamily = null) {
  if (promptFamily && PROMPT_FAMILY_LABELS[promptFamily]) {
    return PROMPT_FAMILY_LABELS[promptFamily];
  }

  return questionType === "mcq" ? "driver response" : "traffic rule statement";
}

function composeBridgeGloss({
  promptFamily = null,
  questionType = "row",
  promptConcepts = [],
  optionConcepts = [],
  imageTags = [],
}) {
  const lead = defaultLead(questionType, promptFamily);
  const promptSpecific = sortConcepts(promptConcepts).filter((concept) => !["sign", "road-marking"].includes(concept));
  const optionSpecific = sortConcepts(optionConcepts).filter((concept) => !["slow", "stop", "yield"].includes(concept));
  const imageSpecific = normalizeImageKeywords(imageTags);
  const detailConcepts = sortConcepts([
    ...promptSpecific,
    ...imageSpecific,
    ...(promptSpecific.length >= 2 ? [] : optionSpecific),
  ])
    .filter((concept) => !WEAK_KEYWORDS.has(concept))
    .slice(0, 5);

  if (detailConcepts.length === 0) {
    return lead;
  }

  return `${lead}: ${detailConcepts.map((concept) => conceptDisplayLabel(concept)).join(", ")}`;
}

function optionKeyForIndex(index) {
  return String.fromCharCode(65 + index);
}

function buildOptionGlossEntries({
  questionOptions = [],
  providedOptionGlossesEn = [],
  optionMeaningMap = [],
}) {
  const provided = toList(providedOptionGlossesEn)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
  const meaningById = new Map();
  const meaningByKey = new Map();

  for (const entry of toList(optionMeaningMap)) {
    const gloss = normalizeWhitespace(entry?.sourceGlossEn || entry?.canonicalOptionText || "");
    if (!gloss) {
      continue;
    }

    const normalizedEntry = {
      text: gloss,
      source: entry?.sourceGlossEn ? "optionMeaningMap:sourceGlossEn" : "optionMeaningMap:canonicalOptionText",
    };

    const canonicalId = normalizeWhitespace(entry?.canonicalOptionId);
    const canonicalKey = normalizeWhitespace(entry?.canonicalOptionKey || entry?.sourceKey);

    if (canonicalId) {
      meaningById.set(canonicalId, normalizedEntry);
    }

    if (canonicalKey) {
      meaningByKey.set(canonicalKey, normalizedEntry);
    }
  }

  return toList(questionOptions).map((option, index) => {
    const id = normalizeWhitespace(option?.id);
    const key = normalizeWhitespace(option?.key || option?.originalKey || optionKeyForIndex(index));
    const providedText = provided[index] ?? "";
    const mapped = meaningById.get(id) ?? meaningByKey.get(key) ?? null;
    const fallbackCanonicalText = normalizeWhitespace(option?.text || option?.sourceText || "");
    const text = providedText || mapped?.text || fallbackCanonicalText;
    const source = providedText
      ? "optionsGlossEn"
      : mapped?.source
      ? mapped.source
      : text
      ? "canonical-option-text"
      : null;

    return {
      id: id || null,
      key: key || null,
      text: text || null,
      source,
    };
  }).filter((entry) => entry.text);
}

function confidenceLabel({
  providedPromptGloss = false,
  promptConceptCount = 0,
  optionGlossCount = 0,
  optionConceptCount = 0,
}) {
  if (providedPromptGloss) {
    return "high";
  }

  if (promptConceptCount >= 2 || optionGlossCount >= 2) {
    return "high";
  }

  if (promptConceptCount >= 1 || optionConceptCount >= 2 || optionGlossCount >= 1) {
    return "medium";
  }

  return "low";
}

export function buildKeywordBundle({
  primaryTexts = [],
  supportingTexts = [],
  concepts = [],
  imageTags = [],
  topic = null,
  subtopics = [],
  limit = 18,
} = {}) {
  const conceptKeywords = sortConcepts([
    ...toList(concepts).map((concept) => normalizeKeywordToken(concept)),
    ...normalizeImageKeywords(imageTags),
    ...extractEnglishConcepts(primaryTexts),
    ...extractEnglishConcepts(supportingTexts),
  ])
    .filter((token) => !WEAK_KEYWORDS.has(token))
    .slice(0, 14);

  const englishKeywords = sortConcepts([
    ...extractEnglishConcepts(primaryTexts, { includeFallbackTokens: true }),
    ...extractEnglishConcepts(supportingTexts, { includeFallbackTokens: true }),
  ]).filter((token) => !WEAK_KEYWORDS.has(token));
  const topicKeywords = normalizeTopicKeywords(topic, subtopics);
  const merged = unique([
    ...conceptKeywords,
    ...englishKeywords,
    ...topicKeywords,
  ]).slice(0, limit);

  return {
    keywords: merged,
    conceptKeywords,
  };
}

export function deriveTranslationFeatureBridge({
  lang,
  localizedPrompt = "",
  localizedOptions = [],
  masterPrompt = "",
  questionType = "row",
  promptFamily = null,
  imageTags = [],
  storedPromptGlossEn = null,
  providedOptionGlossesEn = [],
  optionMeaningMap = [],
  questionOptions = [],
  correctOptionId = null,
  correctOptionKey = null,
  topic = null,
  subtopics = [],
} = {}) {
  const normalizedLang = normalizeKeywordToken(lang);
  const prompt = normalizeWhitespace(localizedPrompt);
  const optionGlossesEn = buildOptionGlossEntries({
    questionOptions,
    providedOptionGlossesEn,
    optionMeaningMap,
  });
  const optionGlossTexts = optionGlossesEn.map((entry) => entry.text);
  const promptConcepts = extractLocalizedConcepts(normalizedLang, [prompt]);
  const localizedOptionConcepts = extractLocalizedConcepts(normalizedLang, localizedOptions);
  const englishOptionConcepts = extractEnglishConcepts(optionGlossTexts);
  const imageConcepts = normalizeImageKeywords(imageTags);
  const promptGloss = normalizeWhitespace(storedPromptGlossEn);
  const resolvedPromptFamily = detectPromptFamily(normalizedLang, prompt, promptFamily);
  const glossEn = promptGloss || (
    prompt
      ? composeBridgeGloss({
        promptFamily: resolvedPromptFamily,
        questionType,
        promptConcepts,
        optionConcepts: [...localizedOptionConcepts, ...englishOptionConcepts],
        imageTags: imageConcepts,
      })
      : normalizeWhitespace(masterPrompt)
  );

  const glossEnMode = promptGloss
    ? "provided-localized-gloss"
    : prompt
      ? optionGlossTexts.length > 0
        ? "derived-from-localized-text-and-options"
        : "derived-from-localized-text"
      : "fallback-aligned-master-prompt";
  const glossEnSource = promptGloss
    ? "promptGlossEn"
    : prompt
      ? optionMeaningMap.length > 0
        ? "localized-prompt+option-meaning-map"
        : optionGlossTexts.length > 0
          ? "localized-prompt+options"
          : "localized-prompt"
      : "fallback-master-prompt";
  const conceptKeywords = sortConcepts([
    ...promptConcepts,
    ...localizedOptionConcepts,
    ...englishOptionConcepts,
    ...imageConcepts,
  ]).slice(0, 14);
  const keywordBundle = buildKeywordBundle({
    primaryTexts: [glossEn],
    supportingTexts: [masterPrompt, ...optionGlossTexts],
    concepts: conceptKeywords,
    imageTags: imageConcepts,
    topic,
    subtopics,
  });
  const correctOptionGlossEn = optionGlossesEn.find((entry) =>
    entry.id === normalizeWhitespace(correctOptionId) ||
    entry.key === normalizeWhitespace(correctOptionKey))?.text ?? null;

  return {
    glossEn: glossEn || null,
    glossEnMode,
    glossEnSource,
    glossEnConfidence: confidenceLabel({
      providedPromptGloss: Boolean(promptGloss),
      promptConceptCount: promptConcepts.length,
      optionGlossCount: optionGlossTexts.length,
      optionConceptCount: localizedOptionConcepts.length + englishOptionConcepts.length,
    }),
    promptFamily: resolvedPromptFamily,
    optionGlossesEn,
    correctOptionGlossEn,
    keywords: keywordBundle.keywords,
    conceptKeywords: keywordBundle.conceptKeywords,
  };
}

export function deriveSourceItemFeatureBridge({
  lang,
  localizedPrompt = "",
  localizedOptions = [],
  translatedPrompt = "",
  translatedOptions = [],
  questionType = "row",
  imageTags = [],
  topic = null,
  subtopics = [],
} = {}) {
  const normalizedLang = normalizeKeywordToken(lang);
  const prompt = normalizeWhitespace(localizedPrompt);
  const translatedPromptText = normalizeWhitespace(translatedPrompt);
  const localizedConcepts = extractLocalizedConcepts(normalizedLang, [prompt, ...toList(localizedOptions)]);
  const translatedConcepts = extractEnglishConcepts([translatedPromptText, ...toList(translatedOptions)]);
  const imageConcepts = normalizeImageKeywords(imageTags);
  const promptFamily = detectPromptFamily(normalizedLang, prompt, null);
  const glossEn = prompt
    ? composeBridgeGloss({
      promptFamily,
      questionType,
      promptConcepts: localizedConcepts,
      optionConcepts: translatedConcepts,
      imageTags: imageConcepts,
    })
    : translatedPromptText
      ? composeBridgeGloss({
        promptFamily,
        questionType,
        promptConcepts: translatedConcepts,
        optionConcepts: extractEnglishConcepts(translatedOptions),
        imageTags: imageConcepts,
      })
      : defaultLead(questionType, promptFamily);
  const keywordBundle = buildKeywordBundle({
    primaryTexts: [glossEn, translatedPromptText],
    supportingTexts: translatedOptions,
    concepts: [...localizedConcepts, ...translatedConcepts, ...imageConcepts],
    imageTags: imageConcepts,
    topic,
    subtopics,
  });

  return {
    glossEn,
    glossEnMode: prompt ? "derived-from-localized-text" : translatedPromptText ? "derived-from-translated-bridge" : "generic-fallback",
    promptFamily,
    keywords: keywordBundle.keywords,
    conceptKeywords: keywordBundle.conceptKeywords,
  };
}
