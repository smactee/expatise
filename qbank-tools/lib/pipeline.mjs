import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const ROOT = process.cwd();
export const DEFAULT_DATASET = "2023-test1";
export const DEFAULT_REFERENCE_LANG = "ko";
export const QBANK_TOOLS_DIR = path.join(ROOT, "qbank-tools");
export const GENERATED_DIR = path.join(QBANK_TOOLS_DIR, "generated");
export const REPORTS_DIR = path.join(GENERATED_DIR, "reports");
export const STAGING_DIR = path.join(GENERATED_DIR, "staging");
export const IMPORTS_DIR = path.join(ROOT, "imports");

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "must",
  "not",
  "of",
  "on",
  "or",
  "road",
  "should",
  "that",
  "the",
  "their",
  "this",
  "to",
  "traffic",
  "vehicle",
  "vehicles",
  "what",
  "when",
  "which",
  "with",
]);

const GENERIC_PROMPT_PATTERNS = [
  /^what does this sign (mean|indicate)$/,
  /^what does this road sign (mean|indicate)$/,
  /^what is this sign$/,
  /^what is this road sign$/,
  /^what is this traffic sign$/,
  /^what is the meaning of this sign$/,
  /^what does this symbol (mean|indicate)$/,
  /^what does this marking (mean|indicate)$/,
  /^what does this traffic sign (mean|indicate)$/,
  /^what does this picture show$/,
  /^how should this intersection be passed$/,
  /^which is the meaning shown by this sign$/,
];

const GENERIC_PROMPT_FAMILIES = [
  {
    family: "sign-meaning",
    syntheticJa: "この標識は何を示していますか",
    patterns: [
      /^what does this sign (mean|indicate)$/,
      /^what is this sign$/,
      /^what is the meaning of this sign$/,
      /^which is the meaning shown by this sign$/,
    ],
  },
  {
    family: "road-sign-meaning",
    syntheticJa: "この道路標識は何を示していますか",
    patterns: [
      /^what does this road sign (mean|indicate)$/,
      /^what does this traffic sign (mean|indicate)$/,
      /^what is this traffic sign$/,
      /^what is this road sign$/,
    ],
  },
  {
    family: "symbol-meaning",
    syntheticJa: "この記号は何を示していますか",
    patterns: [
      /^what does this symbol (mean|indicate)$/,
    ],
  },
  {
    family: "marking-meaning",
    syntheticJa: "この路面標示は何を示していますか",
    patterns: [
      /^what does this marking (mean|indicate)$/,
    ],
  },
  {
    family: "picture-show",
    syntheticJa: "この図は何を示していますか",
    patterns: [
      /^what does this picture show$/,
    ],
  },
  {
    family: "driver-action",
    syntheticJa: "運転者はどうすべきですか",
    patterns: [
      /^what should the driver do$/,
      /^what should the driver do in this situation$/,
      /^how should .*$/,
    ],
  },
  {
    family: "violation-kind",
    syntheticJa: "この車両の違反は何ですか",
    patterns: [
      /^what kind of violation does .* have$/,
      /^what kind of violation does .* have while .*$/,
    ],
  },
  {
    family: "dashboard-indicator",
    syntheticJa: "この車のダッシュボードの表示灯は何を意味しますか",
    patterns: [
      /^what does this indicator light on the car dashboard mean$/,
    ],
  },
];

const GENERIC_PROMPT_TOKENS = new Set([
  "what",
  "does",
  "this",
  "sign",
  "mean",
  "indicate",
  "meaning",
  "symbol",
  "marking",
  "traffic",
  "road",
  "picture",
  "show",
  "which",
  "shown",
  "how",
  "should",
  "intersection",
  "passed",
]);

const SEMANTIC_REPLACEMENTS = [
  [/\bhighway\b/g, "expressway"],
  [/\bfreeway\b/g, "expressway"],
  [/\bmotorway\b/g, "expressway"],
  [/\bhigh speed road\b/g, "expressway"],
  [/\btelephone\b/g, "phone"],
  [/\btelephones\b/g, "phone"],
  [/\bluggage compartment\b/g, "luggage-compartment"],
  [/\btrunk\b/g, "luggage-compartment"],
  [/\bengine compartment\b/g, "engine-compartment"],
  [/\bhood\b/g, "engine-compartment"],
  [/\bbonnet\b/g, "engine-compartment"],
  [/\bfuel tank lid\b/g, "fuel-tank-lid"],
  [/\bcover of fuel tank\b/g, "fuel-tank-lid"],
  [/\bfuel tank cover\b/g, "fuel-tank-lid"],
  [/\bfuel cap\b/g, "fuel-tank-lid"],
  [/\bone side door\b/g, "one-side-door"],
  [/\bdoor of one side\b/g, "one-side-door"],
  [/\bdoors of both sides\b/g, "both-side-doors"],
  [/\bboth side doors\b/g, "both-side-doors"],
  [/\bemergency phone\b/g, "emergency-phone"],
  [/\bemergency telephone\b/g, "emergency-phone"],
  [/\bemergency call\b/g, "emergency-phone"],
  [/\bpublic phone\b/g, "public-phone"],
  [/\bpublic telephone\b/g, "public-phone"],
  [/\bpay phone\b/g, "public-phone"],
  [/\breporting phone\b/g, "reporting-phone"],
  [/\breporting telephone\b/g, "reporting-phone"],
  [/\breport phone\b/g, "reporting-phone"],
  [/\brescue phone\b/g, "rescue-phone"],
  [/\brescue telephone\b/g, "rescue-phone"],
  [/\bcall box\b/g, "emergency-phone"],
  [/\bphone box\b/g, "emergency-phone"],
  [/\bnon motorized\b/g, "bicycle"],
  [/\bnon-motorized\b/g, "bicycle"],
  [/\bnon motor vehicle\b/g, "bicycle"],
  [/\bnon-motor vehicle\b/g, "bicycle"],
  [/\bnon motor vehicles\b/g, "bicycle"],
  [/\bnon-motor vehicles\b/g, "bicycle"],
  [/\bbikes\b/g, "bicycle"],
  [/\bbicycles\b/g, "bicycle"],
  [/\bcycle lane\b/g, "bicycle-lane"],
  [/\bbicycle-only lane\b/g, "bicycle-lane"],
  [/\bexclusive bicycle lane\b/g, "bicycle-lane"],
  [/\blane for bicycle\b/g, "bicycle-lane"],
  [/\bbicycle lane\b/g, "bicycle-lane"],
  [/\bbicycles prohibited\b/g, "bicycle-prohibited"],
  [/\bno bicycle\b/g, "bicycle-prohibited"],
  [/\bno entry\b/g, "no-entry"],
  [/\bno entering\b/g, "no-entry"],
  [/\bno entrance\b/g, "no-entry"],
  [/\bdo not enter\b/g, "no-entry"],
  [/\bentry prohibited\b/g, "no-entry"],
  [/\bt-shaped\b/g, "t-shape"],
  [/\by-shaped\b/g, "y-shape"],
  [/\bfour-way\b/g, "cross"],
  [/\bcross \(four way\)\b/g, "cross"],
  [/\bcross \(four-way\)\b/g, "cross"],
  [/\bcrossroad\b/g, "cross intersection"],
  [/\bround about\b/g, "rotary"],
  [/\broundabout\b/g, "rotary"],
  [/\brotary\b/g, "rotary"],
  [/\bu turn\b/g, "u-turn"],
  [/\bu-turn\b/g, "u-turn"],
  [/\bmake a u-turn\b/g, "u-turn"],
  [/\bmake u-turn\b/g, "u-turn"],
  [/\bturn around\b/g, "u-turn"],
  [/\bmust not\b/g, "must-not"],
  [/\bcannot\b/g, "must-not"],
  [/\bcan not\b/g, "must-not"],
  [/\bmay not\b/g, "must-not"],
  [/\bnot allowed\b/g, "must-not"],
  [/\bprohibited\b/g, "must-not"],
  [/\bforbidden\b/g, "must-not"],
  [/\bwatch for\b/g, "beware-of"],
  [/\bwatch out for\b/g, "beware-of"],
  [/\bbeware of\b/g, "beware-of"],
  [/\bcaution for\b/g, "beware-of"],
  [/\bwarning for\b/g, "beware-of"],
  [/\breduce speed\b/g, "slow"],
  [/\bslow down\b/g, "slow"],
  [/\bdecelerate\b/g, "slow"],
  [/\bspeed up\b/g, "accelerate"],
  [/\bhorn\b/g, "honk"],
  [/\bhonking\b/g, "honk"],
  [/\bfoggy\b/g, "fog"],
  [/\brainy\b/g, "rain"],
  [/\bsnowy\b/g, "snow"],
  [/\bwindy\b/g, "wind"],
  [/\bmuddy\b/g, "mud"],
  [/\bicy\b/g, "ice"],
  [/\bpoor visibility\b/g, "visibility-low"],
  [/\blow visibility\b/g, "visibility-low"],
  [/\bthick fog\b/g, "fog visibility-low"],
  [/\bextremely thick fog\b/g, "fog visibility-low"],
  [/\bfollow the (?:vehicle )?tracks\b/g, "follow-tracks"],
  [/\brespond with\b/g, "respond-with"],
  [/\boverflowing road\b/g, "flooded-road"],
  [/\bflooded road\b/g, "flooded-road"],
  [/\bwater covered road\b/g, "flooded-road"],
  [/\bwaterlogged road\b/g, "flooded-road"],
  [/\bgive way\b/g, "yield"],
  [/\bgive-way\b/g, "yield"],
  [/\byields\b/g, "yield"],
  [/\byielding\b/g, "yield"],
  [/\bovertake\b/g, "pass"],
  [/\bovertaking\b/g, "pass"],
  [/\bcoming from behind\b/g, "following"],
  [/\bfrom behind\b/g, "following"],
  [/\bfollowing vehicle\b/g, "following"],
  [/\bfollowing vehicles\b/g, "following"],
  [/\bvehicle following\b/g, "following"],
  [/\bturn left\b/g, "left-turn"],
  [/\bturn right\b/g, "right-turn"],
  [/\bturn signal lamp\b/g, "turn-signal"],
  [/\bturn signals\b/g, "turn-signal"],
  [/\bturn signal\b/g, "turn-signal"],
  [/\bblinker\b/g, "turn-signal"],
  [/\bstraight ahead\b/g, "straight"],
  [/\blane change\b/g, "lane-change"],
  [/\blane changes\b/g, "lane-change"],
  [/\bchanging lane\b/g, "lane-change"],
  [/\bchanging lanes\b/g, "lane-change"],
  [/\bchange lane\b/g, "lane-change"],
  [/\bchange lanes\b/g, "lane-change"],
  [/\blane changing\b/g, "lane-change"],
  [/\bordinary road\b/g, "ordinary-road"],
  [/\bgeneral road\b/g, "ordinary-road"],
  [/\bcommon road\b/g, "ordinary-road"],
  [/\bbacking up\b/g, "backing"],
  [/\bback up\b/g, "backing"],
  [/\bbacking\b/g, "backing"],
  [/\breversing\b/g, "backing"],
  [/\breverse\b/g, "backing"],
  [/\boncoming vehicles?\b/g, "oncoming"],
  [/\bcoming toward\b/g, "oncoming"],
  [/\bcoming towards\b/g, "oncoming"],
  [/\bopposite side\b/g, "oncoming"],
  [/\bsound the horn\b/g, "honk"],
  [/\bsound horn\b/g, "honk"],
  [/\byield the way\b/g, "yield"],
  [/\bgive the way\b/g, "yield"],
  [/\bemergency braking\b/g, "emergency-brake"],
  [/\bemergency brake\b/g, "emergency-brake"],
  [/\bstop at once\b/g, "stop"],
  [/\bstop immediately\b/g, "stop"],
  [/\bcan be parked\b/g, "parking-allowed"],
];

const JAPANESE_SEMANTIC_REPLACEMENTS = [
  [/この道路標識は何を示して(?:います|いる)か/g, "what does this road sign indicate"],
  [/この交通標識は何を示して(?:います|いる)か/g, "what does this road sign indicate"],
  [/この標識は何を示して(?:います|いる)か/g, "what does this sign indicate"],
  [/この標識の意味は何(?:です|だ)か/g, "what does this sign mean"],
  [/この記号は何を示して(?:います|いる)か/g, "what does this symbol indicate"],
  [/この路面標示は何を示して(?:います|いる)か/g, "what does this marking indicate"],
  [/この路面表示は何を示して(?:います|いる)か/g, "what does this marking indicate"],
  [/この図は何を示して(?:います|いる)か/g, "what does this picture show"],
  [/自動車のインパネの点灯は(?:、)?何を示して(?:います|いる)か/g, "what does this indicator light on the car dashboard mean"],
  [/この車の(?:ダッシュボード|計器盤|メーター(?:内)?)の?(?:表示灯|警告灯)は何を意味して(?:います|いる)か/g, "what does this indicator light on the car dashboard mean"],
  [/運転者はどうすべきか/g, "what should the driver do"],
  [/この車両の違反は何(?:です|だ)か/g, "what kind of violation does this vehicle have"],
  [/はい/g, "yes"],
  [/いいえ/g, "no"],
  [/正しい/g, "right"],
  [/誤り/g, "wrong"],
  [/道路標識/g, "road sign"],
  [/交通標識/g, "road sign"],
  [/標識/g, "sign"],
  [/路面標示/g, "marking"],
  [/路面表示/g, "marking"],
  [/記号/g, "symbol"],
  [/図/g, "picture"],
  [/ダッシュボード/g, "dashboard"],
  [/インパネ/g, "dashboard"],
  [/計器盤/g, "dashboard"],
  [/メーター/g, "dashboard"],
  [/表示灯/g, "indicator light"],
  [/警告灯/g, "indicator light"],
  [/点灯/g, "indicator light"],
  [/高速道路/g, "expressway"],
  [/一般道路/g, "road"],
  [/非動車/g, "non-motorized vehicle"],
  [/非動力車/g, "bicycle"],
  [/非動力車線/g, "lane for non-motorized vehicles"],
  [/非動車車線/g, "lane for non-motorized vehicles"],
  [/自転車/g, "bicycle"],
  [/自転車専用車線/g, "special lane for bicycles"],
  [/自転車通行止め/g, "bicycles prohibited"],
  [/自転車進入禁止/g, "no entry for bicycles"],
  [/自転車駐輪区間/g, "area where bicycles can be parked"],
  [/自転車停止区域/g, "bicycle stopping area"],
  [/二輪車/g, "motorcycle"],
  [/オートバイ/g, "motorcycle"],
  [/自動車/g, "vehicle"],
  [/車両/g, "vehicle"],
  [/後続車/g, "following"],
  [/後方から来る車/g, "following"],
  [/後方車両/g, "following"],
  [/後方から車両が来ていないことを確認すれば/g, "if there is no vehicle following"],
  [/方向指示器/g, "turn-signal"],
  [/ウィンカー/g, "turn-signal"],
  [/ウインカー/g, "turn-signal"],
  [/合図/g, "turn-signal"],
  [/一般道路/g, "ordinary road"],
  [/バックし続ける/g, "continue backing"],
  [/バックして走行/g, "backing"],
  [/バックする/g, "backing"],
  [/バック/g, "backing"],
  [/後退/g, "backing"],
  [/向かってくる車両/g, "oncoming vehicle"],
  [/道をゆずる/g, "yield the way"],
  [/道を譲る/g, "yield the way"],
  [/クラクションを鳴らし/g, "honk"],
  [/クラクション/g, "honk"],
  [/停止して/g, "stop"],
  [/停止/g, "stop"],
  [/車線変更/g, "lane-change"],
  [/右側車線数減少/g, "road narrows on the right side"],
  [/左側車線数減少/g, "road narrows on the left side"],
  [/道路幅減少/g, "road narrows on both sides"],
  [/狭い道/g, "narrow road"],
  [/狭い橋/g, "narrow bridge"],
  [/車線/g, "lane"],
  [/専用車線/g, "special lane"],
  [/通行止め/g, "prohibited"],
  [/進入禁止/g, "no-entry"],
  [/徐行/g, "slow"],
  [/減速/g, "slow"],
  [/加速/g, "accelerate"],
  [/冠水路/g, "flooded-road"],
  [/冠水した道路/g, "flooded-road"],
  [/水がたまった道路/g, "flooded-road"],
  [/大雨/g, "heavy rain"],
  [/豪雨/g, "heavy rain"],
  [/標示/g, "marking"],
  [/Uターン/g, "u-turn"],
  [/転回/g, "u-turn"],
  [/交差点/g, "intersection"],
  [/T字/g, "t-shape"],
  [/Y字/g, "y-shape"],
  [/十字/g, "cross"],
  [/環状交差点/g, "rotary"],
  [/ロータリー/g, "rotary"],
  [/トランク/g, "luggage-compartment"],
  [/ラゲージルーム/g, "luggage-compartment"],
  [/荷物室/g, "luggage-compartment"],
  [/エンジンルーム/g, "engine-compartment"],
  [/ボンネット/g, "engine-compartment"],
  [/燃料タンク(?:の)?ふた/g, "fuel-tank-lid"],
  [/燃料タンク(?:の)?蓋/g, "fuel-tank-lid"],
  [/給油口(?:の)?ふた/g, "fuel-tank-lid"],
  [/片側のドア/g, "one-side-door"],
  [/一方のドア/g, "one-side-door"],
  [/両側のドア/g, "both-side-doors"],
  [/ロービーム/g, "low beam"],
  [/ハイビーム/g, "high beam"],
  [/ヘッドライト/g, "head light"],
  [/ライト/g, "light"],
  [/追い越し/g, "pass"],
  [/譲れ/g, "yield"],
  [/注意/g, "beware-of"],
  [/してはならない/g, "must-not"],
  [/してはいけない/g, "must-not"],
  [/できる/g, "may"],
  [/べき/g, "should"],
  [/開いている/g, "open"],
  [/点灯/g, "turn on"],
  [/消灯/g, "turn off"],
];

const CANONICAL_TO_SYNTHETIC_JA_REPLACEMENTS = [
  [/\bright \/ true\b/g, "正しい"],
  [/\bwrong \/ false\b/g, "誤り"],
  [/\byes\b/g, "はい"],
  [/\bno\b/g, "いいえ"],
  [/\bindicator light on the car dashboard\b/g, "車のダッシュボードの表示灯"],
  [/\bindicator light\b/g, "表示灯"],
  [/\bluggage-compartment\b/g, "トランク"],
  [/\bengine-compartment\b/g, "エンジンルーム"],
  [/\bfuel-tank-lid\b/g, "燃料タンクのふた"],
  [/\bone-side-door\b/g, "片側のドア"],
  [/\bboth-side-doors\b/g, "両側のドア"],
  [/\bemergency-phone\b/g, "非常電話"],
  [/\bpublic-phone\b/g, "公衆電話"],
  [/\breporting-phone\b/g, "通報電話"],
  [/\brescue-phone\b/g, "救援電話"],
  [/\bbicycle-lane\b/g, "自転車専用車線"],
  [/\bbicycle-prohibited\b/g, "自転車通行止め"],
  [/\bparking-allowed\b/g, "駐車可能"],
  [/\bno-entry\b/g, "進入禁止"],
  [/\bbeware-of\b/g, "注意"],
  [/\bu-turn\b/g, "Uターン"],
  [/\bturn-signal\b/g, "方向指示器"],
  [/\blane-change\b/g, "車線変更"],
  [/\bflooded-road\b/g, "冠水路"],
  [/\bfollowing\b/g, "後続車"],
  [/\bexpressway\b/g, "高速道路"],
  [/\brotary\b/g, "環状交差点"],
  [/\by-shape\b/g, "Y字"],
  [/\bt-shape\b/g, "T字"],
  [/\bcross intersection\b/g, "十字交差点"],
  [/\bcross\b/g, "十字"],
  [/\bhigh beam\b/g, "ハイビーム"],
  [/\blow beam\b/g, "ロービーム"],
  [/\bhead light\b/g, "ヘッドライト"],
  [/\blight\b/g, "ライト"],
  [/\bbicycle\b/g, "自転車"],
  [/\bmotorcycle\b/g, "二輪車"],
  [/\bvehicle\b/g, "車両"],
  [/\bdriver\b/g, "運転者"],
  [/\broad sign\b/g, "道路標識"],
  [/\bsign\b/g, "標識"],
  [/\bmarking\b/g, "路面標示"],
  [/\bsymbol\b/g, "記号"],
  [/\bpicture\b/g, "図"],
  [/\bintersection\b/g, "交差点"],
  [/\blane\b/g, "車線"],
  [/\bturn on\b/g, "点灯する"],
  [/\bturn off\b/g, "消灯する"],
  [/\bopen\b/g, "開いている"],
  [/\bslow\b/g, "減速"],
  [/\baccelerate\b/g, "加速"],
  [/\byield\b/g, "譲れ"],
  [/\bpass\b/g, "追い越し"],
  [/\bmust-not\b/g, "してはならない"],
  [/\bshould\b/g, "べき"],
  [/\bmay\b/g, "よい"],
  [/\bahead\b/g, "この先"],
];

const ENGLISH_PHRASE_TO_SYNTHETIC_JA_REPLACEMENTS = [
  [/^no entry for bicycles?$/i, "自転車進入禁止"],
  [/^bicycles? prohibited$/i, "自転車通行止め"],
  [/^(?:the )?lane for non-motorized vehicles?$/i, "非動力車線"],
  [/^(?:the )?special lane for bicycles?$/i, "自転車専用車線"],
  [/^exclusive bicycle lane$/i, "自転車専用車線"],
  [/^bicycle stopping area$/i, "自転車停止区域"],
  [/^area where bicycles? can be parked$/i, "自転車駐輪区間"],
  [/^yield non-motorized vehicles?$/i, "非動力車に譲れ"],
  [/^watch for non-motorized vehicles?$/i, "非動力車注意"],
  [/^no passing for non-motorized vehicles?$/i, "非動力車追越禁止"],
  [/^road narrows on both sides$/i, "道路幅減少"],
  [/^road narrows on the right side$/i, "右側車線数減少"],
  [/^road narrows on the left side$/i, "左側車線数減少"],
  [/^narrow road$/i, "狭い道"],
  [/^bridge narrows$/i, "狭い橋"],
  [/^narrow bridge$/i, "狭い橋"],
  [/^luggage compartment is open(?:ed)?$/i, "ラゲージルームが開いている"],
  [/^engine compartment is open(?:ed)?$/i, "エンジンルームが開いている"],
  [/^(?:cover of )?fuel tank (?:lid|cover) is open(?:ed)?$/i, "燃料タンクの蓋が開いている"],
  [/^door of one side is open(?:ed)?$/i, "片側のドアが開いている"],
  [/^doors of both sides are open(?:ed)?$/i, "両側のドアが開いている"],
  [/^if the driver finds there is no vehicle following, he can change lanes without turning on the turn signal$/i, "後方に車がいなければ方向指示器を出さずに車線変更できる"],
  [/^you may not use the turn signal when you change to the right lane$/i, "右側車線へ変更するとき方向指示器なしでよい"],
  [/^speed up when passing an overflowing road$/i, "冠水路通過時は加速する"],
];

const BOOLEAN_OPTION_PAIRS = [
  new Set(["yes", "no"]),
  new Set(["true", "false"]),
  new Set(["right", "wrong"]),
  new Set(["correct", "incorrect"]),
  new Set(["allowed", "not-allowed"]),
];

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }

    out[key] = next;
    index += 1;
  }

  return out;
}

export function stringArg(args, key, fallback = null) {
  if (!(key in args)) {
    return fallback;
  }

  const value = String(args[key] ?? "").trim();
  return value || fallback;
}

export function booleanArg(args, key, fallback = false) {
  if (!(key in args)) {
    return fallback;
  }

  const value = args[key];
  if (value === true) {
    return true;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
}

export function batchOptionsFromArgs(args) {
  return {
    lang: normalizeLang(stringArg(args, "lang", DEFAULT_REFERENCE_LANG)),
    batchId: normalizeBatchId(stringArg(args, "batch", "batch-001")),
    dataset: stringArg(args, "dataset", DEFAULT_DATASET),
  };
}

export function normalizeLang(value) {
  return String(value ?? DEFAULT_REFERENCE_LANG).trim().toLowerCase() || DEFAULT_REFERENCE_LANG;
}

export function normalizeBatchId(value) {
  return String(value ?? "batch-001").trim().toLowerCase() || "batch-001";
}

export function getDatasetPaths(dataset = DEFAULT_DATASET, referenceLang = DEFAULT_REFERENCE_LANG) {
  const datasetDir = path.join(ROOT, "public", "qbank", dataset);

  return {
    dataset,
    datasetDir,
    imagesDir: path.join(datasetDir, "images"),
    questionsPath: path.join(datasetDir, "questions.json"),
    rawQuestionsPath: path.join(datasetDir, "questions.raw.json"),
    tagsPatchPath: path.join(datasetDir, "tags.patch.json"),
    translationPath: path.join(datasetDir, `translations.${referenceLang}.json`),
  };
}

export function getBatchDir(lang, batchId) {
  return path.join(IMPORTS_DIR, normalizeLang(lang), normalizeBatchId(batchId));
}

export function getBatchFiles(lang, batchId) {
  const batchDir = getBatchDir(lang, batchId);

  return {
    batchDir,
    intakePath: path.join(batchDir, "intake.json"),
    extractionReportPath: path.join(batchDir, "extraction-report.json"),
    matchedPath: path.join(batchDir, "matched.json"),
    reviewNeededPath: path.join(batchDir, "review-needed.json"),
    unresolvedPath: path.join(batchDir, "unresolved.json"),
  };
}

export function getReviewArtifactPaths(lang, batchId, { scope = "review-needed" } = {}) {
  const normalizedScope = String(scope ?? "review-needed").trim().toLowerCase();
  const baseName = normalizedScope === "remaining"
    ? `${normalizeLang(lang)}-${normalizeBatchId(batchId)}-remaining-review`
    : `${normalizeLang(lang)}-${normalizeBatchId(batchId)}-review`;

  return {
    baseName,
    htmlPath: path.join(REPORTS_DIR, `${baseName}.html`),
    decisionsTemplateJsonPath: path.join(STAGING_DIR, `${baseName}-decisions.template.json`),
    decisionsTemplateCsvPath: path.join(STAGING_DIR, `${baseName}-decisions.template.csv`),
    manifestPath: path.join(REPORTS_DIR, `${baseName}.manifest.json`),
  };
}

export function getNewQuestionFiles(lang, batchId) {
  const safeLang = normalizeLang(lang);
  const safeBatchId = normalizeBatchId(batchId);

  return {
    decisionsPath: path.join(STAGING_DIR, `new-question-decisions.${safeLang}.${safeBatchId}.json`),
    candidatesPath: path.join(STAGING_DIR, `new-question-candidates.${safeLang}.${safeBatchId}.json`),
    promotionPreviewPath: path.join(STAGING_DIR, `new-question-promotion-preview.${safeLang}.${safeBatchId}.json`),
    coverageReportPath: path.join(REPORTS_DIR, `localization-coverage-matrix.${safeLang}.${safeBatchId}.json`),
  };
}

export function discoverKnownLanguages({ dataset = DEFAULT_DATASET } = {}) {
  const languages = new Set(["en"]);
  const datasetPaths = getDatasetPaths(dataset);

  if (fileExists(datasetPaths.datasetDir)) {
    for (const entry of fs.readdirSync(datasetPaths.datasetDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      const match = entry.name.match(/^translations\.([a-z0-9-]+)\.json$/i);
      if (match?.[1]) {
        languages.add(normalizeLang(match[1]));
      }
    }
  }

  if (fileExists(IMPORTS_DIR)) {
    for (const entry of fs.readdirSync(IMPORTS_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        languages.add(normalizeLang(entry.name));
      }
    }
  }

  return [...languages].sort();
}

export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function ensurePipelineDirs({ lang = DEFAULT_REFERENCE_LANG, batchId = "batch-001" } = {}) {
  const batchFiles = getBatchFiles(lang, batchId);

  await Promise.all([
    ensureDir(path.join(IMPORTS_DIR, normalizeLang(lang), "raw")),
    ensureDir(batchFiles.batchDir),
    ensureDir(GENERATED_DIR),
    ensureDir(REPORTS_DIR),
    ensureDir(STAGING_DIR),
  ]);

  return batchFiles;
}

export function fileExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const body = JSON.stringify(value, null, 2);
  await fsp.writeFile(filePath, `${body}\n`, "utf8");
}

export async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, value, "utf8");
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

export async function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }

  await writeText(filePath, `${lines.join("\n")}\n`);
}

export function stableNow() {
  return new Date().toISOString();
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeQuestionType(value) {
  return String(value ?? "").trim().toUpperCase() === "MCQ" ? "MCQ" : "ROW";
}

export function normalizeTag(value) {
  return String(value ?? "").trim().replace(/^#/, "").toLowerCase();
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function stripChoiceLabel(text) {
  return String(text ?? "").replace(/^[A-H][\s.)\-:]+/i, "").trim();
}

function stemSemanticToken(token) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("es") && token.length > 4) {
    if (/(ches|shes|sses|xes|zes)$/.test(token)) {
      return token.slice(0, -2);
    }

    return token.slice(0, -1);
  }

  if (token.endsWith("s") && token.length > 4 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

function containsJapaneseText(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(value ?? ""));
}

function detectGenericPromptFamily(value) {
  const normalized = semanticNormalizeText(value)
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const candidate of GENERIC_PROMPT_FAMILIES) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized))) {
      return candidate;
    }
  }

  return null;
}

function semanticNormalizeText(value) {
  let text = normalizeWhitespace(stripChoiceLabel(value)).toLowerCase();

  if (!text) {
    return "";
  }

  text = text
    .replace(/[’']/g, "'")
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not");

  if (containsJapaneseText(text)) {
    for (const [pattern, replacement] of JAPANESE_SEMANTIC_REPLACEMENTS) {
      text = text.replace(pattern, ` ${replacement} `);
    }
  }

  for (const [pattern, replacement] of SEMANTIC_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .replace(/[()[\],/]/g, " ")
    .replace(/[?!.;:、。]/g, " ")
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/[はがをにへでとものやよりからまで]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text
    .split(/\s+/)
    .map((token) => stemSemanticToken(token))
    .join(" ")
    .trim();
}

function semanticTokenize(value) {
  return semanticNormalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function informativeSemanticTokens(value) {
  return semanticTokenize(value).filter(
    (token) => !GENERIC_PROMPT_TOKENS.has(token) && !STOPWORDS.has(token),
  );
}

function genericPromptScore(value) {
  const normalized = semanticNormalizeText(value);

  if (!normalized) {
    return 0;
  }

  if (GENERIC_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 0.35;
  }

  const informativeTokens = semanticTokenize(normalized).filter((token) => !GENERIC_PROMPT_TOKENS.has(token));

  if (informativeTokens.length <= 1) {
    return 0.45;
  }

  return Math.min(1, 0.45 + (informativeTokens.length * 0.1));
}

function syntheticJapaneseFromCanonical(value, { kind = "text" } = {}) {
  const raw = normalizeWhitespace(value);
  const rawComparable = raw.replace(/[?!.]+$/g, "");

  if (!raw) {
    return null;
  }

  for (const [pattern, replacement] of ENGLISH_PHRASE_TO_SYNTHETIC_JA_REPLACEMENTS) {
    if (pattern.test(rawComparable)) {
      return replacement;
    }
  }

  const canonical = semanticNormalizeText(value);

  if (!canonical) {
    return null;
  }

  if (kind === "prompt") {
    const promptFamily = detectGenericPromptFamily(value);
    if (promptFamily?.syntheticJa) {
      return promptFamily.syntheticJa;
    }
  }

  let synthetic = ` ${canonical} `;

  for (const [pattern, replacement] of CANONICAL_TO_SYNTHETIC_JA_REPLACEMENTS) {
    synthetic = synthetic.replace(pattern, ` ${replacement} `);
  }

  synthetic = synthetic
    .replace(/\b(?:what|does|is|are|the|a|an|this|that|these|those|of|to|on|in|at|for|from|with|while)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!synthetic) {
    return null;
  }

  if (kind === "prompt" && /[一-龯ぁ-んァ-ヶ]/u.test(synthetic) && !/[?？]$/.test(synthetic)) {
    return `${synthetic}。`;
  }

  return synthetic;
}

function buildSyntheticJapaneseMirror(question) {
  const promptFamily = detectGenericPromptFamily(question.sourcePrompt || question.prompt);
  const prompt = syntheticJapaneseFromCanonical(question.sourcePrompt || question.prompt, { kind: "prompt" });
  const options = question.options.map((option) => syntheticJapaneseFromCanonical(option.sourceText || option.text)).filter(Boolean);
  const correctOptionText =
    question.correctAnswer.kind === "MCQ"
      ? syntheticJapaneseFromCanonical(question.correctAnswer.correctOptionText ?? question.correctAnswer.correctOptionTranslatedText)
      : question.correctAnswer.correctRow === "R"
        ? "正しい"
        : question.correctAnswer.correctRow === "W"
          ? "誤り"
          : null;

  return {
    lang: "ja",
    prompt,
    options,
    correctAnswer: {
      text: correctOptionText,
      key: question.correctAnswer.correctOptionKey ?? null,
      row: question.correctAnswer.correctRow ?? null,
    },
    genericPrompt: Boolean(promptFamily || genericPromptScore(question.sourcePrompt || question.prompt) < 0.7),
    genericPromptFamily: promptFamily?.family ?? null,
  };
}

function incrementCounter(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function normalizeIdf(value, max = 4) {
  return Math.max(0, Math.min(1, Number(value ?? 0) / max));
}

function idfFromDf(total, df) {
  return Math.log((total + 1) / ((df ?? 0) + 1)) + 1;
}

function optionPhraseSignature(options) {
  return options
    .map((option) => semanticNormalizeText(option))
    .filter(Boolean)
    .sort()
    .join(" || ");
}

function weightedJaccard(leftTokens, rightTokens, idfMap) {
  const left = unique(leftTokens);
  const right = unique(rightTokens);

  if (!left.length || !right.length) {
    return 0;
  }

  const all = new Set([...left, ...right]);
  let intersection = 0;
  let union = 0;

  for (const token of all) {
    const weight = idfMap?.get(token) ?? 1;
    const inLeft = left.includes(token);
    const inRight = right.includes(token);

    if (inLeft || inRight) {
      union += weight;
    }

    if (inLeft && inRight) {
      intersection += weight;
    }
  }

  return union > 0 ? intersection / union : 0;
}

function buildMatchCorpus(matchIndex) {
  const tokenDf = new Map();
  const phraseDf = new Map();
  const setDf = new Map();

  for (const question of matchIndex.questions) {
    if (question.type !== "MCQ") {
      continue;
    }

    const phrases = question.options
      .map((option) => semanticNormalizeText(option.sourceText || option.text))
      .filter(Boolean);

    const seenTokens = new Set();
    const seenPhrases = new Set(phrases);

    for (const phrase of seenPhrases) {
      incrementCounter(phraseDf, phrase);
    }

    for (const phrase of seenPhrases) {
      for (const token of informativeSemanticTokens(phrase)) {
        seenTokens.add(token);
      }
    }

    for (const token of seenTokens) {
      incrementCounter(tokenDf, token);
    }

    const setKey = optionPhraseSignature(phrases);
    if (setKey) {
      incrementCounter(setDf, setKey);
    }
  }

  const totalMcq = matchIndex.questions.filter((question) => question.type === "MCQ").length || 1;
  const optionTokenIdf = new Map([...tokenDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const optionPhraseIdf = new Map([...phraseDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const optionSetIdf = new Map([...setDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));

  return {
    totalMcq,
    optionTokenIdf,
    optionPhraseIdf,
    optionSetIdf,
  };
}

function isBooleanChoiceOptionSet(options) {
  if (options.length !== 2) {
    return false;
  }

  const normalized = unique(
    options
      .map((option) => semanticNormalizeText(option))
      .map((option) => option.replace(/\./g, " ").trim())
      .filter(Boolean),
  );

  if (normalized.length !== 2) {
    return false;
  }

  const normalizedSet = new Set(normalized);
  return BOOLEAN_OPTION_PAIRS.some((pair) => [...pair].every((value) => normalizedSet.has(value)));
}

function analyzeItemShape(item) {
  const translatedOptions = item.translatedOptions ?? [];
  const localizedOptions = item.localizedOptions ?? [];
  const declaredType = item.questionType ?? null;
  const booleanOptions = isBooleanChoiceOptionSet(
    translatedOptions.length > 0 ? translatedOptions : localizedOptions,
  );
  const effectiveType =
    declaredType === "MCQ" && booleanOptions
      ? "ROW"
      : declaredType;

  return {
    declaredType,
    effectiveType,
    booleanOptions,
    missingCorrectAnswer: !normalizeWhitespace(item.translatedCorrectAnswer ?? item.localizedCorrectAnswer ?? item.correctKeyRaw),
  };
}

export const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
]);

export function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(String(filePath ?? "")).toLowerCase());
}

export function listBatchScreenshotFiles(batchDir) {
  if (!fileExists(batchDir)) {
    return [];
  }

  const entries = fs.readdirSync(batchDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(batchDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      files.push(...listBatchScreenshotFiles(fullPath));
      continue;
    }

    if (isImageFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return null;
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function asTextList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeWhitespace(entry)).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean);
  }

  return [];
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value ?? "")).digest("hex").slice(0, 8);
}

function md5File(filePath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function inferAssetHash(asset, diskPath) {
  if (asset?.hash) {
    return String(asset.hash);
  }

  const srcMatch = String(asset?.src ?? "").match(/img_([a-f0-9]{8,32})/i);
  if (srcMatch) {
    return srcMatch[1].toLowerCase();
  }

  if (diskPath && fileExists(diskPath)) {
    return md5File(diskPath);
  }

  return shortHash(JSON.stringify(asset ?? {}));
}

function tokenize(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(semanticTokenize(left));
  const rightTokens = new Set(semanticTokenize(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

function trigramSimilarity(left, right) {
  const leftNormalized = semanticNormalizeText(left);
  const rightNormalized = semanticNormalizeText(right);

  if (!leftNormalized || !rightNormalized) {
    return 0;
  }

  const grams = (value) => {
    const compact = value.replace(/\s+/g, " ");
    if (compact.length < 3) {
      return [compact];
    }

    const list = [];
    for (let index = 0; index <= compact.length - 3; index += 1) {
      list.push(compact.slice(index, index + 3));
    }
    return list;
  };

  const leftGrams = grams(leftNormalized);
  const rightGrams = grams(rightNormalized);
  const rightCounts = new Map();

  for (const gram of rightGrams) {
    rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const gram of leftGrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (leftGrams.length + rightGrams.length);
}

function informativeTokenOverlap(left, right) {
  const leftTokens = semanticTokenize(left).filter((token) => !GENERIC_PROMPT_TOKENS.has(token));
  const rightTokens = semanticTokenize(right).filter((token) => !GENERIC_PROMPT_TOKENS.has(token));

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let overlap = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }

  return overlap / new Set([...leftSet, ...rightSet]).size;
}

export function textSimilarity(left, right) {
  if (!normalizeWhitespace(left) || !normalizeWhitespace(right)) {
    return 0;
  }

  return (
    (tokenSimilarity(left, right) * 0.45) +
    (trigramSimilarity(left, right) * 0.2) +
    (informativeTokenOverlap(left, right) * 0.35)
  );
}

function normalizeCorrectRow(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "R" || normalized === "RIGHT" || normalized === "TRUE") {
    return "R";
  }

  if (normalized === "W" || normalized === "WRONG" || normalized === "FALSE") {
    return "W";
  }

  return null;
}

function normalizeAnswerPolarity(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["positive", "right", "true", "correct", "r"].includes(normalized)) {
    return "positive";
  }

  if (["negative", "wrong", "false", "incorrect", "w"].includes(normalized)) {
    return "negative";
  }

  return null;
}

function tagSignalsForQuestion(question, patchTags) {
  const userTags = toList(question?.tags?.user ?? question?.tags).map(normalizeTag).filter(Boolean);
  const autoTags = toList(question?.tags?.auto).map(normalizeTag).filter(Boolean);
  const suggestedTags = toList(question?.tags?.suggested)
    .map((entry) => normalizeTag(entry?.tag))
    .filter(Boolean);
  const patch = toList(patchTags).map(normalizeTag).filter(Boolean);

  const truthTags = patch.length > 0 ? patch : userTags;
  const weightedTags = unique([...truthTags, ...suggestedTags, ...autoTags]);
  const truthTopic = truthTags.find((tag) => !tag.includes(":")) ?? null;
  const truthSubtopics = truthTags.filter((tag) => tag.includes(":"));
  const weightedTopic =
    truthTopic ??
    weightedTags.find((tag) => !tag.includes(":")) ??
    weightedTags.find((tag) => tag.includes(":"))?.split(":")[0] ??
    null;
  const weightedSubtopics = truthSubtopics.length > 0
    ? truthSubtopics
    : weightedTags.filter((tag) => tag.includes(":"));

  return {
    truthTags,
    truthTopic,
    truthSubtopics,
    weightedTags,
    weightedTopic,
    weightedSubtopics,
    userTags,
    autoTags,
    suggestedTags,
  };
}

function optionTranslationMap(translationEntry) {
  if (!translationEntry?.options || typeof translationEntry.options !== "object") {
    return {};
  }

  return translationEntry.options;
}

function explainCorrectAnswer(question, translationEntry) {
  const type = normalizeQuestionType(question.type);
  const translations = optionTranslationMap(translationEntry);

  if (type === "MCQ") {
    const correctOptionId = normalizeWhitespace(question.correctOptionId);
    const correctOption = toList(question.options).find((option) => option.id === correctOptionId) ?? null;
    const answerRaw = String(question.answerRaw ?? "").trim();

    return {
      kind: "MCQ",
      correctRow: null,
      correctOptionId: correctOptionId || null,
      correctOptionKey: (correctOption?.originalKey ?? answerRaw) || null,
      correctOptionText: correctOption?.text ?? null,
      correctOptionTranslatedText: correctOption ? (translations[correctOption.id] ?? null) : null,
      answerRaw: normalizeWhitespace(question.answerRaw),
    };
  }

  const normalizedRow = normalizeCorrectRow(question.correctRow ?? question.answerRaw);

  return {
    kind: "ROW",
    correctRow: normalizedRow,
    correctOptionId: null,
    correctOptionKey: null,
    correctOptionText: normalizedRow === "R" ? "right / true" : normalizedRow === "W" ? "wrong / false" : null,
    correctOptionTranslatedText: null,
    answerRaw: normalizeWhitespace(question.answerRaw),
  };
}

function referencedAssetRecord(asset, dataset) {
  const relativeAssetPath = String(asset?.src ?? "").replace(/^\//, "");
  const diskPath = path.join(ROOT, "public", relativeAssetPath.replace(/^qbank\//, "qbank/"));
  const hash = inferAssetHash(asset, diskPath);
  const basename = path.basename(relativeAssetPath);

  return {
    src: asset?.src ?? null,
    relativePath: relativeAssetPath ? `/${relativeAssetPath}` : null,
    basename,
    ext: path.extname(basename),
    hash,
    shortHash: hash.slice(0, 8),
    page: asset?.page ?? null,
    bbox: Array.isArray(asset?.bbox) ? asset.bbox : null,
    width: asset?.width ?? null,
    height: asset?.height ?? null,
    dataset,
    diskPath,
    existsOnDisk: fileExists(diskPath),
  };
}

function matchIndexQuestion(question, rawQuestion, translationEntry, patchTags, dataset) {
  const type = normalizeQuestionType(question.type);
  const translatedOptions = optionTranslationMap(translationEntry);
  const tagSignals = tagSignalsForQuestion(question, patchTags);
  const assets = toList(question.assets).map((asset) => referencedAssetRecord(asset, dataset));
  const sourceOptions = toList(rawQuestion?.options).length > 0 ? rawQuestion.options : question.options;
  const options = toList(question.options).map((option) => ({
    id: option.id,
    originalKey: option.originalKey ?? null,
    text: option.text,
    translatedText: translatedOptions[option.id] ?? null,
    sourceText:
      toList(sourceOptions).find((candidate) => candidate.id === option.id)?.text ??
      option.text,
  }));

  const correctAnswer = explainCorrectAnswer(question, translationEntry);
  const prompt = normalizeWhitespace(question.prompt);
  const sourcePrompt = normalizeWhitespace(rawQuestion?.prompt ?? question.prompt);
  const translatedPrompt = normalizeWhitespace(translationEntry?.prompt ?? "");
  const translatedExplanation = normalizeWhitespace(translationEntry?.explanation ?? "");
  const syntheticJa = buildSyntheticJapaneseMirror({
    prompt,
    sourcePrompt,
    options,
    correctAnswer,
  });
  const reviewConceptSlots = type === "ROW"
    ? extractRowConceptSlots({
      prompt: sourcePrompt || prompt,
      promptGloss: translatedPrompt,
      promptPolarity: inferPromptPolarity(sourcePrompt || prompt),
    })
    : null;

  return {
    qid: question.id,
    number: Number(question.number),
    type,
    prompt,
    sourcePrompt,
    promptFingerprint: shortHash(prompt),
    promptTranslatedFingerprint: translatedPrompt ? shortHash(translatedPrompt) : null,
    translatedPrompt: translatedPrompt || null,
    explanation: normalizeWhitespace(question.explanation ?? ""),
    translatedExplanation: translatedExplanation || null,
    options,
    correctAnswer,
    image: {
      hasImage: assets.length > 0,
      count: assets.length,
      currentAssetSrc: assets[0]?.src ?? null,
      assetHashes: assets.map((asset) => asset.hash),
      assets,
    },
    genericPrompt: {
      isGeneric: syntheticJa.genericPrompt,
      family: syntheticJa.genericPromptFamily,
    },
    syntheticJa,
    reviewConceptSlots,
    tags: tagSignals,
    matchingSignals: {
      englishPrompt: prompt,
      englishOptions: options.map((option) => option.text),
      englishCorrectAnswer: correctAnswer.correctOptionText,
      translatedPrompt: translatedPrompt || null,
      translatedOptions: options.map((option) => option.translatedText).filter(Boolean),
      translatedCorrectAnswer: correctAnswer.correctOptionTranslatedText,
      syntheticJaPrompt: syntheticJa.prompt,
      syntheticJaOptions: syntheticJa.options,
      syntheticJaCorrectAnswer: syntheticJa.correctAnswer.text,
    },
    sourceRefs: {
      dataset,
      translationLocale: translationEntry ? DEFAULT_REFERENCE_LANG : null,
      questionsPath: `/public/qbank/${dataset}/questions.json`,
      rawQuestionsPath: `/public/qbank/${dataset}/questions.raw.json`,
      tagsPatchPath: `/public/qbank/${dataset}/tags.patch.json`,
      translationPath: translationEntry ? `/public/qbank/${dataset}/translations.${DEFAULT_REFERENCE_LANG}.json` : null,
    },
  };
}

export function loadQbankContext({ dataset = DEFAULT_DATASET, referenceLang = DEFAULT_REFERENCE_LANG } = {}) {
  const paths = getDatasetPaths(dataset, referenceLang);
  const questionsDoc = readJson(paths.questionsPath);
  const rawQuestionsDoc = readJson(paths.rawQuestionsPath);
  const tagsPatch = readJson(paths.tagsPatchPath);
  const translationDoc = fileExists(paths.translationPath)
    ? readJson(paths.translationPath)
    : { meta: { locale: referenceLang }, questions: {} };

  const questions = toList(questionsDoc?.questions);
  const rawQuestions = new Map(toList(rawQuestionsDoc?.questions).map((question) => [question.id, question]));
  const translations = translationDoc?.questions && typeof translationDoc.questions === "object"
    ? translationDoc.questions
    : {};

  const matchQuestions = questions.map((question) =>
    matchIndexQuestion(
      question,
      rawQuestions.get(question.id),
      translations[question.id],
      tagsPatch[question.id],
      dataset,
    ));

  const stats = {
    questions: matchQuestions.length,
    row: matchQuestions.filter((question) => question.type === "ROW").length,
    mcq: matchQuestions.filter((question) => question.type === "MCQ").length,
    withImage: matchQuestions.filter((question) => question.image.hasImage).length,
    withoutImage: matchQuestions.filter((question) => !question.image.hasImage).length,
  };

  return {
    dataset,
    referenceLang,
    paths,
    stats,
    meta: questionsDoc?.meta ?? null,
    rawMeta: rawQuestionsDoc?.meta ?? null,
    translationMeta: translationDoc?.meta ?? null,
    tagsPatch,
    questions: matchQuestions,
  };
}

function sanitizeFilenamePart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function keywordSlug(question) {
  const tagHint =
    question.tags.truthSubtopics[0]?.split(":").pop() ??
    question.tags.truthTopic ??
    question.tags.weightedSubtopics[0]?.split(":").pop() ??
    question.tags.weightedTopic ??
    "question";
  const promptTokens = tokenize(question.sourcePrompt || question.prompt)
    .filter((token) => token.length > 2)
    .filter((token) => !STOPWORDS.has(token))
    .slice(0, 5);
  const answerTokens =
    question.type === "MCQ"
      ? tokenize(question.correctAnswer.correctOptionText)
          .filter((token) => token.length > 2)
          .filter((token) => !STOPWORDS.has(token))
          .slice(0, 2)
      : [];
  const parts = unique([tagHint, ...promptTokens, ...answerTokens]).map(sanitizeFilenamePart).filter(Boolean);
  const joined = parts.join("-").slice(0, 64).replace(/-+$/g, "");
  return joined || `question-${String(question.number).padStart(4, "0")}`;
}

export function buildAssetRenamePlan(context) {
  const referenced = new Map();

  for (const question of context.questions) {
    for (const asset of question.image.assets) {
      const existing = referenced.get(asset.src);
      if (existing) {
        existing.qids.push(question.qid);
        existing.numbers.push(question.number);
        existing.topicTags = unique([...existing.topicTags, ...question.tags.truthTags, ...question.tags.weightedTags]);
        continue;
      }

      referenced.set(asset.src, {
        asset,
        question,
        qids: [question.qid],
        numbers: [question.number],
        topicTags: unique([...question.tags.truthTags, ...question.tags.weightedTags]),
      });
    }
  }

  const usedProposed = new Set();
  const rows = [];

  for (const entry of [...referenced.values()].sort((left, right) => left.question.number - right.question.number)) {
    const ext = entry.asset.ext || path.extname(entry.asset.basename) || ".jpeg";
    let proposedBasename = `${keywordSlug(entry.question)}-${entry.asset.shortHash}${ext}`.replace(/-{2,}/g, "-");

    if (usedProposed.has(proposedBasename)) {
      proposedBasename = `${keywordSlug(entry.question)}-${String(entry.question.number).padStart(4, "0")}-${entry.asset.shortHash}${ext}`;
    }

    usedProposed.add(proposedBasename);

    rows.push({
      currentSrc: entry.asset.src,
      currentBasename: entry.asset.basename,
      currentHash: entry.asset.hash,
      proposedBasename,
      proposedSrc: `/qbank/${context.dataset}/images/${proposedBasename}`,
      qids: unique(entry.qids).join("|"),
      numbers: unique(entry.numbers.map(String)).join("|"),
      topic: entry.question.tags.truthTopic ?? entry.question.tags.weightedTopic ?? "",
      subtopics: unique([
        ...entry.question.tags.truthSubtopics,
        ...entry.question.tags.weightedSubtopics,
      ]).join("|"),
      dryRun: true,
      semanticSource: keywordSlug(entry.question),
    });
  }

  const imageFiles = fileExists(context.paths.imagesDir)
    ? fs.readdirSync(context.paths.imagesDir)
        .filter((fileName) => fileExists(path.join(context.paths.imagesDir, fileName)))
        .sort()
    : [];

  const referencedBasenames = new Set(rows.map((row) => row.currentBasename));
  const unreferencedFiles = imageFiles.filter((fileName) => !referencedBasenames.has(fileName));

  return {
    generatedAt: stableNow(),
    dataset: context.dataset,
    dryRun: true,
    namingStrategy: "semantic filename + short hash suffix",
    stats: {
      referencedAssets: rows.length,
      unreferencedFiles: unreferencedFiles.length,
    },
    renameMap: rows,
    unreferencedFiles,
  };
}

export function buildMatchIndex(context) {
  return {
    generatedAt: stableNow(),
    dataset: context.dataset,
    referenceLang: context.referenceLang,
    sourceOfTruth: {
      questions: path.relative(ROOT, context.paths.questionsPath),
      rawQuestions: path.relative(ROOT, context.paths.rawQuestionsPath),
      tagsPatch: path.relative(ROOT, context.paths.tagsPatchPath),
      referenceTranslations: fileExists(context.paths.translationPath)
        ? path.relative(ROOT, context.paths.translationPath)
        : null,
    },
    stats: context.stats,
    questions: context.questions,
  };
}

export function buildSyntheticMatchIndex(matchIndex, { lang = "ja" } = {}) {
  return {
    generatedAt: stableNow(),
    dataset: matchIndex.dataset,
    referenceLang: matchIndex.referenceLang,
    syntheticLang: normalizeLang(lang),
    sourceMatchIndex: "qbank-tools/generated/match-index.json",
    questions: matchIndex.questions.map((question) => ({
      qid: question.qid,
      number: question.number,
      type: question.type,
      english: {
        prompt: question.sourcePrompt || question.prompt,
        options: question.options.map((option) => option.sourceText || option.text),
        correctAnswer: question.correctAnswer,
      },
      syntheticJa: question.syntheticJa,
      image: {
        hasImage: question.image.hasImage,
        currentAssetSrc: question.image.currentAssetSrc,
        assetHashes: question.image.assetHashes,
      },
      tags: question.tags,
      genericPrompt: question.genericPrompt,
      sourceRefs: question.sourceRefs,
    })),
  };
}

export function emptyBatchOutput({ lang, batchId, dataset, kind }) {
  return {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    kind,
    items: [],
  };
}

function normalizedHintTags(item) {
  return unique([
    ...toList(item?.topicHints).map(normalizeTag),
    ...toList(item?.predictedTopics).map(normalizeTag),
    ...toList(item?.topicPrediction).map(normalizeTag),
  ]);
}

function normalizeConfidenceLabel(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["high", "medium", "low"].includes(normalized)) {
    return normalized;
  }

  if (["partial", "uncertain"].includes(normalized)) {
    return "medium";
  }

  return normalized;
}

export function readBatchIntake({ lang, batchId }) {
  const files = getBatchFiles(lang, batchId);
  const intake = readJson(files.intakePath);
  const items = toList(intake.items).map((item, index) => {
    const sourceImage = normalizeWhitespace(item.sourceImage ?? item.screenshot ?? item.file ?? "");
    const itemId = normalizeWhitespace(item.itemId || path.basename(sourceImage || `item-${index + 1}`));
    const questionType = normalizeWhitespace(item.questionType ?? item.typeHint).toUpperCase();
    const translatedOptions = asTextList(item.translatedOptions ?? item.optionsTranslated);
    const localizedOptions = asTextList(item.localizedOptions ?? item.optionsRaw);

    return {
      itemId: itemId || `item-${index + 1}`,
      sourceImage: sourceImage || null,
      file: normalizeWhitespace(item.file ?? sourceImage),
      correctKeyRaw: normalizeWhitespace(item.correctKeyRaw),
      correctAnswerRaw: normalizeWhitespace(item.correctAnswerRaw ?? item.localizedCorrectAnswer),
      localizedPrompt: normalizeWhitespace(item.localizedPrompt ?? item.promptRaw),
      localizedOptions,
      localizedCorrectAnswer: normalizeWhitespace(item.localizedCorrectAnswer ?? item.correctAnswerRaw),
      localizedExplanation: normalizeWhitespace(item.localizedExplanation),
      translatedPrompt: normalizeWhitespace(item.translatedPrompt ?? item.promptTranslated),
      translatedOptions,
      translatedCorrectAnswer: normalizeWhitespace(item.translatedCorrectAnswer ?? item.correctAnswerTranslated),
      questionType: ["MCQ", "ROW"].includes(questionType) ? questionType : null,
      hasImage: coerceBoolean(item.hasImage),
      topicHints: normalizedHintTags(item),
      answerPolarity:
        normalizeAnswerPolarity(item.answerPolarity) ??
        normalizeAnswerPolarity(item.localizedCorrectAnswer) ??
        normalizeAnswerPolarity(item.translatedCorrectAnswer),
      ocrConfidence: normalizeConfidenceLabel(item.ocrConfidence ?? item.extractionConfidence),
      productionAssetHints: asTextList(item.productionAssetHints),
      notes: normalizeWhitespace(item.notes),
      extractionNotes: asTextList(item.extractionNotes),
    };
  });

  return {
    meta: {
      lang: normalizeLang(intake.lang ?? lang),
      batchId: normalizeBatchId(intake.batchId ?? batchId),
      dataset: String(intake.dataset ?? DEFAULT_DATASET),
      createdAt: intake.createdAt ?? null,
      extractionNotes: intake.extractionNotes ?? [],
    },
    items,
  };
}

function buildSourceReviewFields(item) {
  return {
    promptRawJa: item.localizedPrompt || null,
    promptGlossEn: item.translatedPrompt || null,
    optionsRawJa: item.localizedOptions,
    optionsGlossEn: item.translatedOptions,
    correctKeyRaw: item.correctKeyRaw || null,
    correctAnswerRaw: item.correctAnswerRaw || item.localizedCorrectAnswer || null,
    ocrConfidence: item.ocrConfidence || null,
    hasImage: item.hasImage,
  };
}

function sourceReviewText(item) {
  return semanticNormalizeText([
    item.localizedPrompt,
    item.translatedPrompt,
    ...item.localizedOptions,
    ...item.translatedOptions,
    item.correctAnswerRaw,
    item.localizedCorrectAnswer,
    item.translatedCorrectAnswer,
    item.notes,
  ].filter(Boolean).join(" "));
}

function pushUniqueSignal(target, value) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function inferPromptPolarity(value) {
  const normalized = semanticNormalizeText(value);

  if (!normalized) {
    return null;
  }

  if (/\b(?:must-not|cannot|illegal|prohibited|forbidden|not-allowed|no-entry)\b/.test(normalized)) {
    return "negative";
  }

  if (/\b(?:should|must|may|can|allowed|right|true)\b/.test(normalized)) {
    return "positive";
  }

  return null;
}

function extractRowConceptSlots({
  prompt = "",
  promptGloss = "",
  options = [],
  optionGlosses = [],
  promptPolarity = null,
} = {}) {
  const combined = semanticNormalizeText([
    prompt,
    promptGloss,
    ...options,
    ...optionGlosses,
  ].filter(Boolean).join(" "));
  const condition = [];
  const context = [];
  const action = [];
  const signals = [];

  if (!combined) {
    return {
      condition,
      context,
      action,
      polarity: promptPolarity ?? null,
      signals,
    };
  }

  const add = (slot, bucket, value, signal) => {
    if (!bucket.includes(value)) {
      bucket.push(value);
    }

    signals.push({ slot, value, signal });
  };

  if (/\bfog\b/.test(combined)) {
    add("condition", condition, "fog", "fog");
  }

  if (/\brain\b|\bheavy rain\b/.test(combined)) {
    add("condition", condition, "rain", "rain");
  }

  if (/\bsnow\b/.test(combined)) {
    add("condition", condition, "snow", "snow");
  }

  if (/\bwind\b/.test(combined)) {
    add("condition", condition, "wind", "wind");
  }

  if (/\bice\b/.test(combined)) {
    add("condition", condition, "ice", "ice");
  }

  if (/\bmud\b/.test(combined)) {
    add("condition", condition, "mud", "mud");
  }

  if (/\bflooded-road\b/.test(combined)) {
    add("condition", condition, "flooded-road", "flooded-road");
  }

  if (/\bvisibility-low\b/.test(combined)) {
    add("condition", condition, "visibility-low", "visibility-low");
  }

  if (/\bnight\b/.test(combined)) {
    add("condition", condition, "night", "night");
  }

  if (/\buphill\b|\bslope\b/.test(combined)) {
    add("condition", condition, "uphill", "uphill");
  }

  if (/\bdownhill\b/.test(combined)) {
    add("condition", condition, "downhill", "downhill");
  }

  if (/\bbacking\b/.test(combined)) {
    add("condition", condition, "backing", "backing");
  }

  if (/\bexpressway\b/.test(combined)) {
    add("context", context, "expressway", "expressway");
  }

  if (/\bordinary-road\b/.test(combined)) {
    add("context", context, "ordinary-road", "ordinary-road");
  }

  if (/\boncoming\b/.test(combined)) {
    add("context", context, "oncoming-traffic", "oncoming");
  }

  if (/\bfollowing\b/.test(combined)) {
    add("context", context, "following-traffic", "following");
  }

  if (/\bintersection\b/.test(combined)) {
    add("context", context, "intersection", "intersection");
  }

  if (/\bhonk\b/.test(combined)) {
    add("action", action, "honk", "honk");
  }

  if (/\byield\b/.test(combined)) {
    add("action", action, "yield", "yield");
  }

  if (/\bstop\b/.test(combined)) {
    add("action", action, "stop", "stop");
  }

  if (/\bslow\b/.test(combined)) {
    add("action", action, "slow", "slow");
  }

  if (/\baccelerate\b/.test(combined)) {
    add("action", action, "accelerate", "accelerate");
  }

  if (/\bemergency-brake\b/.test(combined)) {
    add("action", action, "emergency-brake", "emergency-brake");
  }

  if (/\bu-turn\b/.test(combined)) {
    add("action", action, "u-turn", "u-turn");
  }

  if (/\bpass\b/.test(combined)) {
    add("action", action, "pass", "pass");
  }

  if (/\blow beam\b/.test(combined)) {
    add("action", action, "low-beam", "low-beam");
  }

  if (/\bhigh beam\b/.test(combined)) {
    add("action", action, "high-beam", "high-beam");
  }

  if (/\bhead light\b|\blight\b/.test(combined)) {
    add("action", action, "head-light", "head-light");
  }

  if (/\bturn-signal\b/.test(combined)) {
    add("action", action, "turn-signal", "turn-signal");
  }

  if (/\blane-change\b/.test(combined)) {
    add("action", action, "lane-change", "lane-change");
  }

  if (/\bfollow-tracks\b/.test(combined)) {
    add("action", action, "follow-tracks", "follow-tracks");
  }

  return {
    condition,
    context,
    action,
    polarity: promptPolarity ?? inferPromptPolarity(combined),
    signals,
  };
}

function conceptOverlapScore(left = [], right = []) {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;

  for (const value of leftSet) {
    if (rightSet.has(value)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftSet.size, rightSet.size);
}

function compareRowConceptSlots(sourceSlots, candidateSlots) {
  const sourceCondition = toList(sourceSlots?.condition);
  const sourceContext = toList(sourceSlots?.context);
  const sourceAction = toList(sourceSlots?.action);
  const candidateCondition = toList(candidateSlots?.condition);
  const candidateContext = toList(candidateSlots?.context);
  const candidateAction = toList(candidateSlots?.action);
  const contradictionSignals = [];
  const matchedSignals = [];
  const conditionAlignment = conceptOverlapScore(sourceCondition, candidateCondition);
  const contextAlignment = conceptOverlapScore(sourceContext, candidateContext);
  const actionAlignment = conceptOverlapScore(sourceAction, candidateAction);
  const polarityAlignment =
    sourceSlots?.polarity && candidateSlots?.polarity
      ? sourceSlots.polarity === candidateSlots.polarity
        ? 1
        : 0
      : 0;

  if (conditionAlignment > 0) {
    pushUniqueSignal(matchedSignals, `condition:${sourceCondition.filter((value) => candidateCondition.includes(value)).join("|")}`);
  }

  if (contextAlignment > 0) {
    pushUniqueSignal(matchedSignals, `context:${sourceContext.filter((value) => candidateContext.includes(value)).join("|")}`);
  }

  if (actionAlignment > 0) {
    pushUniqueSignal(matchedSignals, `action:${sourceAction.filter((value) => candidateAction.includes(value)).join("|")}`);
  }

  let contradictionPenalty = 0;
  const hasSource = sourceCondition.length > 0 || sourceContext.length > 0 || sourceAction.length > 0;

  const has = (values, value) => values.includes(value);
  const hasAny = (values, candidates) => candidates.some((candidate) => values.includes(candidate));

  if (has(sourceContext, "expressway") && has(candidateContext, "ordinary-road")) {
    contradictionPenalty += 0.45;
    pushUniqueSignal(contradictionSignals, "context:expressway-vs-ordinary-road");
  }

  if (has(sourceContext, "ordinary-road") && has(candidateContext, "expressway")) {
    contradictionPenalty += 0.45;
    pushUniqueSignal(contradictionSignals, "context:ordinary-road-vs-expressway");
  }

  if (
    has(sourceCondition, "night") &&
    !has(candidateCondition, "night") &&
    hasAny(candidateCondition, ["fog", "rain", "snow", "wind", "ice", "mud", "flooded-road"])
  ) {
    contradictionPenalty += 0.18;
    pushUniqueSignal(contradictionSignals, "condition:night-vs-weather-only");
  }

  if (
    hasAny(sourceCondition, ["uphill", "downhill"]) &&
    !hasAny(candidateCondition, ["uphill", "downhill"]) &&
    hasAny(candidateCondition, ["fog", "rain", "snow", "wind", "ice", "mud", "flooded-road"])
  ) {
    contradictionPenalty += 0.24;
    pushUniqueSignal(contradictionSignals, "condition:hill-vs-weather-only");
  }

  if (
    has(sourceCondition, "backing") &&
    !has(candidateCondition, "backing") &&
    (
      hasAny(candidateCondition, ["fog", "rain", "snow", "wind", "ice", "mud", "flooded-road", "night", "uphill", "downhill"]) ||
      candidateAction.length > 0
    )
  ) {
    contradictionPenalty += 0.3;
    pushUniqueSignal(contradictionSignals, "condition:backing-vs-other-scenario");
  }

  if (has(sourceAction, "follow-tracks") && candidateAction.length > 0 && !has(candidateAction, "follow-tracks")) {
    contradictionPenalty += 0.28;
    pushUniqueSignal(contradictionSignals, "action:follow-tracks-vs-other-action");
  }

  if (has(sourceAction, "yield") && hasAny(candidateAction, ["accelerate", "pass", "emergency-brake"]) && !hasAny(candidateAction, ["yield", "stop"])) {
    contradictionPenalty += 0.26;
    pushUniqueSignal(contradictionSignals, "action:yield-vs-aggressive-action");
  }

  if (has(sourceAction, "stop") && hasAny(candidateAction, ["accelerate", "pass"]) && !has(candidateAction, "stop")) {
    contradictionPenalty += 0.22;
    pushUniqueSignal(contradictionSignals, "action:stop-vs-accelerate-or-pass");
  }

  if (has(sourceAction, "honk") && has(candidateAction, "slow") && !has(candidateAction, "honk")) {
    contradictionPenalty += 0.12;
    pushUniqueSignal(contradictionSignals, "action:honk-vs-slow");
  }

  const hasComparableConcepts =
    (sourceCondition.length > 0 && candidateCondition.length > 0) ||
    (sourceContext.length > 0 && candidateContext.length > 0) ||
    (sourceAction.length > 0 && candidateAction.length > 0);
  const alignment = hasSource && hasComparableConcepts
    ? combineAvailableScores([
      { value: conditionAlignment, weight: 0.35, available: sourceCondition.length > 0 && candidateCondition.length > 0 },
      { value: contextAlignment, weight: 0.25, available: sourceContext.length > 0 && candidateContext.length > 0 },
      { value: actionAlignment, weight: 0.35, available: sourceAction.length > 0 && candidateAction.length > 0 },
      { value: polarityAlignment, weight: 0.05, available: Boolean(sourceSlots?.polarity && candidateSlots?.polarity) },
    ], 0)
    : 0;

  return {
    alignment,
    contradictionPenalty,
    matchedSignals,
    contradictionSignals,
  };
}

function addTopicSignal(topicScores, subtopicScores, signals, { topic, subtopic = null, signal, weight = 1 }) {
  if (!topic) {
    return;
  }

  topicScores.set(topic, (topicScores.get(topic) ?? 0) + weight);

  if (subtopic) {
    subtopicScores.set(subtopic, (subtopicScores.get(subtopic) ?? 0) + weight);
  }

  const key = [topic, subtopic ?? "", signal].join("|");
  if (!signals.some((entry) => entry.key === key)) {
    signals.push({
      key,
      topic,
      subtopic,
      signal,
      weight: round(weight),
    });
  }
}

function inferProvisionalTopicMetadata(item) {
  const normalized = sourceReviewText(item);
  const topicScores = new Map();
  const subtopicScores = new Map();
  const signals = [];

  if (!normalized) {
    return {
      provisionalTopic: null,
      provisionalSubtopics: [],
      topicConfidence: 0,
      topicSignals: [],
    };
  }

  if (/\b(?:road sign|sign|symbol|no-entry|yield|rotary|t-shape|y-shape|cross intersection)\b/.test(normalized) || (item.hasImage && /\bu-turn\b/.test(normalized))) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "traffic-signals",
      subtopic: "traffic-signals:road-signs",
      signal: "sign-family",
      weight: item.hasImage ? 1.4 : 1.1,
    });
  }

  if (/\bmarking\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "traffic-signals",
      subtopic: "traffic-signals:road-markings",
      signal: "road-marking",
      weight: 1.25,
    });
  }

  if (/\b(?:signal light|traffic light|red light|green light|yellow light)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "traffic-signals",
      subtopic: "traffic-signals:signal-lights",
      signal: "signal-light",
      weight: 1.35,
    });
  }

  if (/\b(?:police signal|traffic police|policeman)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "traffic-signals",
      subtopic: "traffic-signals:police-signals",
      signal: "police-signal",
      weight: 1.35,
    });
  }

  if (/\b(?:fog|rain|snow|wind|ice|mud|flooded-road|visibility-low|night|uphill|downhill|backing|oncoming)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "road-safety",
      subtopic: "road-safety:road-conditions",
      signal: "road-condition-or-hazard",
      weight: 1.3,
    });
  }

  if (/\b(?:accident|collision|crash)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "road-safety",
      subtopic: "road-safety:accidents",
      signal: "accident",
      weight: 1.15,
    });
  }

  if (/\b(?:license|driving permit)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "road-safety",
      subtopic: "road-safety:license",
      signal: "license",
      weight: 1.15,
    });
  }

  if (/\b(?:yield|stop|slow|accelerate|honk|pass|follow-tracks|u-turn|turn-signal|lane-change|high beam|low beam|head light|backing)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "proper-driving",
      subtopic: "proper-driving:safe-driving",
      signal: "driving-action",
      weight: 1.2,
    });
  }

  if (/\b(?:must-not|prohibited|illegal|forbidden|not-allowed)\b/.test(normalized)) {
    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "proper-driving",
      subtopic: "proper-driving:traffic-laws",
      signal: "traffic-law",
      weight: 1.15,
    });
  }

  if (/\b(?:turn-signal|indicator light|dashboard|gear|engine-compartment|luggage-compartment|fuel-tank-lid)\b/.test(normalized)) {
    const subtopic = /\bgear\b/.test(normalized)
      ? "driving-operations:gears"
      : "driving-operations:indicators";

    addTopicSignal(topicScores, subtopicScores, signals, {
      topic: "driving-operations",
      subtopic,
      signal: subtopic.endsWith(":gears") ? "gear-operation" : "indicator-operation",
      weight: 1.25,
    });
  }

  const rankedTopics = [...topicScores.entries()].sort((left, right) => right[1] - left[1]);
  const provisionalTopic = rankedTopics[0]?.[0] ?? null;
  const bestScore = rankedTopics[0]?.[1] ?? 0;
  const runnerUp = rankedTopics[1]?.[1] ?? 0;
  const provisionalSubtopics = [...subtopicScores.entries()]
    .filter(([subtopic, score]) => score >= 0.9 || (provisionalTopic && subtopic.startsWith(`${provisionalTopic}:`)))
    .sort((left, right) => right[1] - left[1])
    .map(([subtopic]) => subtopic);

  return {
    provisionalTopic,
    provisionalSubtopics: unique(provisionalSubtopics),
    topicConfidence: provisionalTopic ? round(bestScore / Math.max(bestScore + runnerUp, 1)) : 0,
    topicSignals: signals
      .sort((left, right) => right.weight - left.weight)
      .map(({ key, ...entry }) => entry),
  };
}

function buildSourceReviewMetadata(item, itemShape) {
  const sourceFields = buildSourceReviewFields(item);
  const provisionalTopic = inferProvisionalTopicMetadata(item);
  const sourceConceptSlots =
    itemShape?.effectiveType === "ROW"
      ? extractRowConceptSlots({
        prompt: item.localizedPrompt,
        promptGloss: item.translatedPrompt,
        options: item.localizedOptions,
        optionGlosses: item.translatedOptions,
      })
      : null;

  return {
    ...sourceFields,
    ...provisionalTopic,
    sourceConceptSlots,
  };
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function optionListSimilarity(leftOptions, rightOptions) {
  const left = leftOptions.filter(Boolean);
  const right = rightOptions.filter(Boolean);

  if (!left.length || !right.length) {
    return 0;
  }

  const forward = average(left.map((option) => Math.max(...right.map((candidate) => textSimilarity(option, candidate)))));
  const reverse = average(right.map((option) => Math.max(...left.map((candidate) => textSimilarity(option, candidate)))));
  return (forward + reverse) / 2;
}

function phraseExactness(left, right) {
  const l = semanticNormalizeText(left);
  const r = semanticNormalizeText(right);

  if (!l || !r) {
    return 0;
  }

  if (l === r) {
    return 1;
  }

  if (l.includes(r) || r.includes(l)) {
    return 0.8;
  }

  return 0;
}

function phraseRareOverlap(left, right, corpus) {
  const leftTokens = informativeSemanticTokens(left);
  const rightTokens = informativeSemanticTokens(right);

  return weightedJaccard(leftTokens, rightTokens, corpus.optionTokenIdf);
}

function phraseSimilarity(left, right, corpus) {
  const semantic = textSimilarity(left, right);
  const rare = phraseRareOverlap(left, right, corpus);
  const exact = phraseExactness(left, right);

  return {
    score: (semantic * 0.45) + (rare * 0.35) + (exact * 0.2),
    semantic,
    rare,
    exact,
  };
}

function bestOptionPairing(leftOptions, rightOptions, corpus) {
  const left = leftOptions.filter(Boolean);
  const right = rightOptions.filter(Boolean);

  if (!left.length || !right.length) {
    return {
      score: 0,
      pairScores: [],
    };
  }

  const targetSize = Math.max(left.length, right.length);
  const matrix = left.map((leftOption) =>
    right.map((rightOption) => phraseSimilarity(leftOption, rightOption, corpus)),
  );
  let best = {
    total: -1,
    pairScores: [],
  };

  function walk(leftIndex, used, total, pairScores) {
    if (leftIndex >= left.length) {
      if (total > best.total) {
        best = { total, pairScores: [...pairScores] };
      }
      return;
    }

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (used.has(rightIndex)) {
        continue;
      }
      used.add(rightIndex);
      pairScores.push(matrix[leftIndex][rightIndex].score);
      walk(leftIndex + 1, used, total + matrix[leftIndex][rightIndex].score, pairScores);
      pairScores.pop();
      used.delete(rightIndex);
    }
  }

  walk(0, new Set(), 0, []);

  return {
    score: best.total <= 0 ? 0 : best.total / targetSize,
    pairScores: best.pairScores,
  };
}

function optionFingerprintMetrics(itemOptions, questionOptions, corpus) {
  const leftPhrases = itemOptions.map((option) => semanticNormalizeText(option)).filter(Boolean);
  const rightPhrases = questionOptions.map((option) => semanticNormalizeText(option)).filter(Boolean);

  if (!leftPhrases.length || !rightPhrases.length) {
    return {
      similarity: 0,
      fingerprint: 0,
      exactSet: 0,
      rareTokenCoverage: 0,
      rareSetBonus: 0,
    };
  }

  const pairing = bestOptionPairing(leftPhrases, rightPhrases, corpus);
  const exactSet =
    optionPhraseSignature(leftPhrases) === optionPhraseSignature(rightPhrases)
      ? 1
      : weightedJaccard(leftPhrases, rightPhrases, corpus.optionPhraseIdf);
  const rareTokenCoverage = weightedJaccard(
    leftPhrases.flatMap((phrase) => informativeSemanticTokens(phrase)),
    rightPhrases.flatMap((phrase) => informativeSemanticTokens(phrase)),
    corpus.optionTokenIdf,
  );
  const leftSetIdf = normalizeIdf(corpus.optionSetIdf.get(optionPhraseSignature(leftPhrases)));
  const rightSetIdf = normalizeIdf(corpus.optionSetIdf.get(optionPhraseSignature(rightPhrases)));
  const rareSetBonus = exactSet > 0.7 ? Math.max(leftSetIdf, rightSetIdf) : 0;
  const similarity = (pairing.score * 0.65) + (rareTokenCoverage * 0.2) + (exactSet * 0.15);
  const fingerprint = Math.min(1, similarity + (rareSetBonus * 0.2));

  return {
    similarity,
    fingerprint,
    exactSet,
    rareTokenCoverage,
    rareSetBonus,
  };
}

function questionTypeScore(itemShape, candidateType) {
  if (!itemShape.declaredType) {
    return 0.5;
  }

  if (itemShape.effectiveType === candidateType) {
    return 1;
  }

  if (itemShape.booleanOptions && candidateType === "ROW") {
    return 1;
  }

  if (itemShape.booleanOptions && candidateType === "MCQ") {
    return 0.2;
  }

  return 0;
}

function promptSimilarityForMatch(itemPrompt, questionPrompt) {
  const rawSimilarity = textSimilarity(itemPrompt, questionPrompt);
  const itemSpecificity = genericPromptScore(itemPrompt);
  const questionSpecificity = genericPromptScore(questionPrompt);
  const specificity = (itemSpecificity + questionSpecificity) / 2;

  return {
    rawSimilarity,
    specificity,
    effectiveSimilarity: rawSimilarity * specificity,
  };
}

function combineAvailableScores(entries, fallback = 0) {
  let total = 0;
  let weight = 0;

  for (const entry of entries) {
    if (!entry?.available) {
      continue;
    }

    total += Number(entry.value ?? 0) * Number(entry.weight ?? 1);
    weight += Number(entry.weight ?? 1);
  }

  return weight > 0 ? total / weight : fallback;
}

function correctAnswerSimilarityFromSignals(answerSignals, candidateTexts) {
  const normalizedSignals = answerSignals.filter(Boolean);
  const normalizedCandidates = candidateTexts.filter(Boolean);

  if (normalizedSignals.length === 0 || normalizedCandidates.length === 0) {
    return {
      score: 0.5,
      neutral: true,
      exactKey: false,
      available: false,
    };
  }

  let best = 0;
  let exactKey = false;
  for (const signal of normalizedSignals) {
    for (const candidate of normalizedCandidates) {
      best = Math.max(best, textSimilarity(signal, candidate));
      if (semanticNormalizeText(signal) === semanticNormalizeText(candidate)) {
        best = Math.max(best, 1);
      }
      if (
        normalizeWhitespace(signal).toUpperCase() &&
        normalizeWhitespace(signal).toUpperCase() === normalizeWhitespace(candidate).toUpperCase()
      ) {
        exactKey = true;
      }
    }
  }

  return {
    score: best,
    neutral: false,
    exactKey,
    available: true,
  };
}

function correctAnswerSimilarityForMatch(item, question) {
  return correctAnswerSimilarityFromSignals(
    [
      item.translatedCorrectAnswer,
      item.localizedCorrectAnswer,
      item.correctKeyRaw,
    ],
    [
      question.correctAnswer.correctOptionText,
      question.correctAnswer.correctOptionTranslatedText,
      question.correctAnswer.correctOptionKey,
    ],
  );
}

function syntheticCorrectAnswerSimilarityForMatch(item, question) {
  return correctAnswerSimilarityFromSignals(
    [
      item.localizedCorrectAnswer,
      item.correctKeyRaw,
      item.translatedCorrectAnswer,
    ],
    [
      question.syntheticJa?.correctAnswer?.text,
      question.syntheticJa?.correctAnswer?.key,
    ],
  );
}

function optionSimilarityFromSignals(itemShape, itemOptions, questionOptions, candidateType, corpus) {
  if (itemShape.booleanOptions && candidateType === "ROW") {
    return {
      score: 0.5,
      neutral: true,
      fingerprint: 0,
      exactSet: 0,
      rareTokenCoverage: 0,
      rareSetBonus: 0,
      available: false,
    };
  }

  if (itemOptions.filter(Boolean).length === 0 || questionOptions.filter(Boolean).length === 0) {
    return {
      score: 0,
      neutral: false,
      fingerprint: 0,
      exactSet: 0,
      rareTokenCoverage: 0,
      rareSetBonus: 0,
      available: false,
    };
  }

  const fingerprint = optionFingerprintMetrics(
    itemOptions,
    questionOptions,
    corpus,
  );
  const score = optionListSimilarity(
    itemOptions,
    questionOptions,
  );

  return {
    score: Math.max(score, fingerprint.similarity),
    neutral: false,
    fingerprint: fingerprint.fingerprint,
    exactSet: fingerprint.exactSet,
    rareTokenCoverage: fingerprint.rareTokenCoverage,
    rareSetBonus: fingerprint.rareSetBonus,
    available: true,
  };
}

function optionSimilarityForMatch(itemShape, item, question, corpus) {
  return optionSimilarityFromSignals(
    itemShape,
    item.translatedOptions,
    question.options.map((option) => option.sourceText || option.text),
    question.type,
    corpus,
  );
}

function syntheticOptionSimilarityForMatch(itemShape, item, question, corpus) {
  return optionSimilarityFromSignals(
    itemShape,
    item.localizedOptions,
    question.syntheticJa?.options ?? [],
    question.type,
    corpus,
  );
}

function shortlistPlausibility(top, gap) {
  if (!top) {
    return false;
  }

  const promptish =
    top.score.breakdown.promptSimilarity >= 0.2 ||
    top.score.breakdown.optionSimilarity >= 0.22 ||
    top.score.breakdown.optionFingerprint >= 0.45 ||
    top.score.breakdown.correctAnswerMeaning >= 0.4 ||
    (
      (top.score.breakdown.conceptAlignment ?? 0) >= 0.42 &&
      (top.score.breakdown.contradictionPenalty ?? 0) <= 0.18
    );

  return top.score.total >= 34 && gap >= 0 && promptish;
}

function buildCandidateExplanation(itemShape, score) {
  const notes = [];

  if (itemShape.booleanOptions) {
    notes.push("Binary yes/no options were treated as ROW-like for type scoring.");
  }

  if (score.diagnostics.genericPromptPenalty < 0.75) {
    notes.push("Generic prompt wording was down-weighted to avoid overvaluing template matches.");
  }

  if (score.diagnostics.missingCorrectAnswerNeutral) {
    notes.push("Missing correct answer was treated as a neutral signal.");
  }

  if (score.breakdown.optionSimilarity >= 0.35) {
    notes.push("Option comparison used unordered semantic set matching.");
  }

  if ((score.breakdown.syntheticOptionSimilarity ?? 0) >= 0.4) {
    notes.push("Synthetic Japanese option matching strengthened the shortlist.");
  }

  if ((score.breakdown.syntheticCorrectAnswerMeaning ?? 0) >= 0.75) {
    notes.push("Synthetic Japanese correct-answer alignment reinforced the candidate.");
  }

  if ((score.breakdown.englishOptionSimilarity ?? 0) >= 0.4) {
    notes.push("English semantic option matching still supported the top candidate.");
  }

  if (score.breakdown.optionFingerprint >= 0.55) {
    notes.push("Rare option-combination fingerprint increased candidate separation.");
  }

  if (score.breakdown.optionExactSet >= 0.7) {
    notes.push("Candidate shares a near-exact normalized option set.");
  }

  if (score.breakdown.questionType === 0) {
    notes.push("Candidate type conflicts with the extracted item shape.");
  }

  if ((score.breakdown.conceptAlignment ?? 0) >= 0.45) {
    notes.push("ROW concept slots aligned on condition/context/action.");
  }

  if ((score.breakdown.contradictionPenalty ?? 0) >= 0.18) {
    notes.push("Context or action contradictions reduced this candidate's rank.");
  }

  return notes;
}

function safeAutoMatch(itemShape, top, gap) {
  if (!top) {
    return false;
  }

  if (itemShape.effectiveType === "MCQ") {
    return (
      (
        top.score.total >= 66 &&
        gap >= 9 &&
        top.score.breakdown.questionType >= 1 &&
        top.score.breakdown.imageSignal >= 0.5 &&
        (
          top.score.breakdown.optionFingerprint >= 0.72 ||
          (top.score.breakdown.optionSimilarity >= 0.78 && top.score.breakdown.optionRareCoverage >= 0.5)
        )
      ) || (
        top.score.total >= 64 &&
        gap >= 8.5 &&
        top.score.breakdown.questionType >= 1 &&
        top.score.breakdown.imageSignal >= 1 &&
        top.score.breakdown.optionSimilarity >= 0.72 &&
        top.score.breakdown.optionFingerprint >= 0.58 &&
        (
          top.score.breakdown.optionExactSet >= 0.45 ||
          top.score.breakdown.correctAnswerMeaning >= 0.8
        )
      ) || (
        top.score.total >= 61 &&
        gap >= 12 &&
        top.score.breakdown.questionType >= 1 &&
        top.score.breakdown.imageSignal >= 1 &&
        top.score.breakdown.optionSimilarity >= 0.5 &&
        top.score.breakdown.optionFingerprint >= 0.45 &&
        top.score.breakdown.optionRareCoverage >= 0.55
      )
    );
  }

  return (
    (
      top.score.total >= 58 &&
      gap >= 8 &&
      top.score.breakdown.questionType >= 1 &&
      top.score.breakdown.promptSimilarity >= 0.28
    ) || (
      top.score.total >= 49 &&
      gap >= 7 &&
      top.score.breakdown.questionType >= 1 &&
      top.score.breakdown.imageSignal >= 1 &&
      top.score.breakdown.promptSimilarity >= 0.33
    )
  );
}

function scoreTopicHints(item, question) {
  const hints = item.topicHints ?? [];

  if (!hints.length) {
    return 0.5;
  }

  const candidateTags = new Set([
    ...question.tags.truthTags,
    ...question.tags.weightedTags,
    question.tags.truthTopic,
    question.tags.weightedTopic,
  ].filter(Boolean));

  let best = 0;

  for (const hint of hints) {
    if (candidateTags.has(hint)) {
      best = Math.max(best, hint.includes(":") ? 1 : 0.8);
      continue;
    }

    const topic = hint.includes(":") ? hint.split(":")[0] : hint;
    if (topic && candidateTags.has(topic)) {
      best = Math.max(best, 0.55);
    }
  }

  return best;
}

function scoreAssetHints(item, question) {
  const hints = item.productionAssetHints ?? [];

  if (!hints.length || !question.image.hasImage) {
    return 0;
  }

  const haystack = [
    question.image.currentAssetSrc,
    ...question.image.assetHashes,
    ...question.image.assets.map((asset) => asset.basename),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hints.some((hint) => haystack.includes(String(hint).toLowerCase())) ? 1 : 0;
}

function buildProposedLocalization(item, question) {
  if (!item.localizedPrompt && item.localizedOptions.length === 0) {
    return null;
  }

  const localization = {
    prompt: item.localizedPrompt || null,
    explanation: item.localizedExplanation || "",
  };

  const warnings = [];

  if (question.type === "MCQ") {
    if (item.localizedOptions.length === question.options.length && item.localizedOptions.length > 0) {
      localization.options = Object.fromEntries(
        question.options.map((option, index) => [option.id, item.localizedOptions[index] ?? ""]),
      );
      warnings.push("Option IDs were mapped by position only. Review before merge.");
    } else if (item.localizedOptions.length > 0) {
      warnings.push("Localized options were not staged because the option count did not match the candidate question.");
    }
  }

  if (warnings.length > 0) {
    localization.warnings = warnings;
  }

  return localization;
}

function scoreQuestionForBatchItem(item, question, corpus) {
  const itemShape = analyzeItemShape(item);
  const englishPrompt = promptSimilarityForMatch(item.translatedPrompt, question.sourcePrompt || question.prompt);
  const syntheticPrompt = promptSimilarityForMatch(item.localizedPrompt, question.syntheticJa?.prompt ?? "");
  const englishPromptAvailable = Boolean(item.translatedPrompt) && Boolean(question.sourcePrompt || question.prompt);
  const syntheticPromptAvailable = Boolean(item.localizedPrompt) && Boolean(question.syntheticJa?.prompt);
  const prompt = {
    rawSimilarity: Math.max(
      englishPrompt.rawSimilarity,
      syntheticPrompt.rawSimilarity,
      combineAvailableScores([
        { value: englishPrompt.rawSimilarity, weight: 0.45, available: englishPromptAvailable },
        { value: syntheticPrompt.rawSimilarity, weight: 0.55, available: syntheticPromptAvailable },
      ], 0),
    ),
    specificity: Math.max(
      englishPrompt.specificity,
      syntheticPrompt.specificity,
      combineAvailableScores([
        { value: englishPrompt.specificity, weight: 0.45, available: englishPromptAvailable },
        { value: syntheticPrompt.specificity, weight: 0.55, available: syntheticPromptAvailable },
      ], 0.5),
    ),
    effectiveSimilarity: Math.max(
      englishPrompt.effectiveSimilarity,
      syntheticPrompt.effectiveSimilarity,
      combineAvailableScores([
        { value: englishPrompt.effectiveSimilarity, weight: 0.45, available: englishPromptAvailable },
        { value: syntheticPrompt.effectiveSimilarity, weight: 0.55, available: syntheticPromptAvailable },
      ], 0),
    ),
  };
  const typeScore = questionTypeScore(itemShape, question.type);
  const imageScore =
    item.hasImage === null
      ? 0.5
      : item.hasImage === question.image.hasImage
        ? 1
        : 0;
  const topicScore = scoreTopicHints(item, question);
  const assetTieBreak = scoreAssetHints(item, question);

  if (question.type === "MCQ") {
    const englishOptionScore = optionSimilarityForMatch(itemShape, item, question, corpus);
    const syntheticOptionScore = syntheticOptionSimilarityForMatch(itemShape, item, question, corpus);
    const optionAgreement =
      englishOptionScore.available && syntheticOptionScore.available
        ? Math.min(
          1,
          (Math.min(englishOptionScore.score, syntheticOptionScore.score) * 0.65) +
          (Math.min(englishOptionScore.fingerprint, syntheticOptionScore.fingerprint) * 0.35),
        )
        : 0;
    const optionScore = {
      score: Math.max(
        englishOptionScore.score,
        syntheticOptionScore.score,
        combineAvailableScores([
          { value: englishOptionScore.score, weight: 0.45, available: englishOptionScore.available },
          { value: syntheticOptionScore.score, weight: 0.55, available: syntheticOptionScore.available },
        ], 0),
        optionAgreement,
      ),
      fingerprint: Math.max(
        englishOptionScore.fingerprint,
        syntheticOptionScore.fingerprint,
        combineAvailableScores([
          { value: englishOptionScore.fingerprint, weight: 0.45, available: englishOptionScore.available },
          { value: syntheticOptionScore.fingerprint, weight: 0.55, available: syntheticOptionScore.available },
        ], 0),
        optionAgreement,
      ),
      exactSet: Math.max(englishOptionScore.exactSet, syntheticOptionScore.exactSet),
      rareTokenCoverage: Math.max(englishOptionScore.rareTokenCoverage, syntheticOptionScore.rareTokenCoverage),
      rareSetBonus: Math.max(englishOptionScore.rareSetBonus, syntheticOptionScore.rareSetBonus),
      agreement: optionAgreement,
    };
    const englishCorrectScore = correctAnswerSimilarityForMatch(item, question);
    const syntheticCorrectScore = syntheticCorrectAnswerSimilarityForMatch(item, question);
    const missingCorrectNeutral = englishCorrectScore.neutral && syntheticCorrectScore.neutral;
    const correctAgreement =
      englishCorrectScore.available && syntheticCorrectScore.available
        ? Math.min(
          1,
          Math.min(englishCorrectScore.score, syntheticCorrectScore.score) +
          ((englishCorrectScore.exactKey || syntheticCorrectScore.exactKey) ? 0.1 : 0),
        )
        : 0;
    const correctScore = {
      score: missingCorrectNeutral
        ? 0.5
        : Math.max(
          englishCorrectScore.score,
          syntheticCorrectScore.score,
          combineAvailableScores([
            { value: englishCorrectScore.score, weight: 0.45, available: englishCorrectScore.available },
            { value: syntheticCorrectScore.score, weight: 0.55, available: syntheticCorrectScore.available },
          ], 0.5),
          correctAgreement,
        ),
      neutral: missingCorrectNeutral,
      exactKey: englishCorrectScore.exactKey || syntheticCorrectScore.exactKey,
      agreement: correctAgreement,
    };
    const mirrorAgreement = Math.max(optionAgreement, correctAgreement);

    return {
      total:
        (prompt.effectiveSimilarity * 18) +
        (optionScore.score * 34) +
        (optionScore.fingerprint * 22) +
        (correctScore.score * (correctScore.neutral ? 6 : 18)) +
        (mirrorAgreement * 6) +
        (typeScore * 13) +
        (imageScore * 8) +
        (topicScore * 3) +
        (assetTieBreak * 1.5),
      breakdown: {
        promptSimilarity: round(prompt.effectiveSimilarity),
        rawPromptSimilarity: round(prompt.rawSimilarity),
        englishPromptSimilarity: round(englishPrompt.effectiveSimilarity),
        syntheticPromptSimilarity: round(syntheticPrompt.effectiveSimilarity),
        optionSimilarity: round(optionScore.score),
        englishOptionSimilarity: round(englishOptionScore.score),
        syntheticOptionSimilarity: round(syntheticOptionScore.score),
        optionFingerprint: round(optionScore.fingerprint),
        englishOptionFingerprint: round(englishOptionScore.fingerprint),
        syntheticOptionFingerprint: round(syntheticOptionScore.fingerprint),
        optionExactSet: round(optionScore.exactSet),
        optionRareCoverage: round(optionScore.rareTokenCoverage),
        mirrorAgreement: round(mirrorAgreement),
        correctAnswerMeaning: round(correctScore.score),
        englishCorrectAnswerMeaning: round(englishCorrectScore.score),
        syntheticCorrectAnswerMeaning: round(syntheticCorrectScore.score),
        questionType: round(typeScore),
        imageSignal: round(imageScore),
        topicWeighting: round(topicScore),
        assetTieBreak: round(assetTieBreak),
      },
      diagnostics: {
        effectiveItemType: itemShape.effectiveType,
        declaredItemType: itemShape.declaredType,
        binaryChoiceDetected: itemShape.booleanOptions,
        promptSpecificity: round(prompt.specificity),
        genericPromptPenalty: round(prompt.specificity),
        missingCorrectAnswerNeutral: correctScore.neutral,
        exactCorrectKey: correctScore.exactKey,
        optionSetMode: "unordered-semantic + synthetic-ja mirror",
        rareSetBonus: round(optionScore.rareSetBonus),
        syntheticMirrorUsed: true,
        genericPromptFamily: question.genericPrompt?.family ?? null,
      },
    };
  }

  const polarityScore =
    item.answerPolarity === null
      ? 0.5
      : item.answerPolarity === "positive" && question.correctAnswer.correctRow === "R"
        ? 1
        : item.answerPolarity === "negative" && question.correctAnswer.correctRow === "W"
          ? 1
          : 0;
  const sourceConceptSlots =
    itemShape.effectiveType === "ROW"
      ? extractRowConceptSlots({
        prompt: item.localizedPrompt,
        promptGloss: item.translatedPrompt,
        options: item.localizedOptions,
        optionGlosses: item.translatedOptions,
      })
      : null;
  const candidateConceptSlots = question.reviewConceptSlots ?? null;
  const conceptComparison =
    itemShape.effectiveType === "ROW" && candidateConceptSlots
      ? compareRowConceptSlots(sourceConceptSlots, candidateConceptSlots)
      : {
        alignment: 0,
        contradictionPenalty: 0,
        matchedSignals: [],
        contradictionSignals: [],
      };

  return {
    total:
      (prompt.effectiveSimilarity * 58) +
      (
        englishPromptAvailable && syntheticPromptAvailable
          ? Math.min(
            1,
            (Math.min(englishPrompt.effectiveSimilarity, syntheticPrompt.effectiveSimilarity) * 0.8) +
            (Math.min(englishPrompt.rawSimilarity, syntheticPrompt.rawSimilarity) * 0.2),
          )
          : 0
      ) * 4 +
      (conceptComparison.alignment * 20) -
      (conceptComparison.contradictionPenalty * 16) +
      (typeScore * 10) +
      (imageScore * 10) +
      (topicScore * 10) +
      (polarityScore * 5) +
      (assetTieBreak * 1.5),
    breakdown: {
      promptSimilarity: round(prompt.effectiveSimilarity),
      rawPromptSimilarity: round(prompt.rawSimilarity),
      englishPromptSimilarity: round(englishPrompt.effectiveSimilarity),
      syntheticPromptSimilarity: round(syntheticPrompt.effectiveSimilarity),
      questionType: round(typeScore),
      imageSignal: round(imageScore),
      topicWeighting: round(topicScore),
      answerPolarity: round(polarityScore),
      conceptAlignment: round(conceptComparison.alignment),
      contradictionPenalty: round(conceptComparison.contradictionPenalty),
      assetTieBreak: round(assetTieBreak),
    },
    diagnostics: {
      effectiveItemType: itemShape.effectiveType,
      declaredItemType: itemShape.declaredType,
      binaryChoiceDetected: itemShape.booleanOptions,
      promptSpecificity: round(prompt.specificity),
      genericPromptPenalty: round(prompt.specificity),
      missingCorrectAnswerNeutral: true,
      optionSetMode: itemShape.booleanOptions ? "binary-row-neutral + synthetic-ja mirror" : "synthetic-ja mirror",
      syntheticMirrorUsed: true,
      genericPromptFamily: question.genericPrompt?.family ?? null,
      sourceConceptSlots,
      candidateConceptSlots,
      conceptMatches: conceptComparison.matchedSignals,
      contradictionSignals: conceptComparison.contradictionSignals,
      rowConceptMode: "slot-alignment + contradiction-penalties",
    },
  };
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function candidateSnapshot(item, question, score) {
  const itemShape = analyzeItemShape(item);

  return {
    qid: question.qid,
    number: question.number,
    type: question.type,
    score: round(score.total),
    scoreBreakdown: score.breakdown,
    diagnostics: {
      ...score.diagnostics,
      explanation: buildCandidateExplanation(itemShape, score),
    },
    prompt: question.prompt,
    syntheticJaPrompt: question.syntheticJa?.prompt ?? null,
    translatedPrompt: question.translatedPrompt,
    options: question.options.map((option) => ({
      id: option.originalKey ?? option.id,
      text: option.text,
      translatedText: option.translatedText,
    })),
    correctAnswer: question.correctAnswer,
    image: {
      hasImage: question.image.hasImage,
      currentAssetSrc: question.image.currentAssetSrc,
      assetHashes: question.image.assetHashes,
    },
    topic: question.tags.truthTopic ?? question.tags.weightedTopic,
    subtopics: unique([...question.tags.truthSubtopics, ...question.tags.weightedSubtopics]),
    conceptSlots: question.reviewConceptSlots ?? null,
  };
}

function filterQuestionsByImageParity(item, questions) {
  if (item.hasImage === true) {
    return {
      applied: true,
      sourceHasImage: true,
      label: "image-only candidate set",
      questions: questions.filter((question) => question.image.hasImage),
    };
  }

  if (item.hasImage === false) {
    return {
      applied: true,
      sourceHasImage: false,
      label: "text-only candidate set",
      questions: questions.filter((question) => !question.image.hasImage),
    };
  }

  return {
    applied: false,
    sourceHasImage: null,
    label: "image-status-unknown",
    questions,
  };
}

export function processBatchAgainstIndex(batchIntake, matchIndex, options = {}) {
  const analysisMode = options.analysisMode ?? "standard";
  const candidateLimit = Number(options.candidateLimit ?? (analysisMode === "diagnostic" ? 8 : 5));
  const reviewFloor = Number(options.reviewFloor ?? (analysisMode === "diagnostic" ? 32 : 45));
  const autoMatchThreshold = Number(options.autoMatchThreshold ?? (analysisMode === "diagnostic" ? 78 : 70));
  const autoGapThreshold = Number(options.autoGapThreshold ?? (analysisMode === "diagnostic" ? 10 : 8));
  const autoPromptThreshold = Number(options.autoPromptThreshold ?? (analysisMode === "diagnostic" ? 0.4 : 0.35));
  const corpus = buildMatchCorpus(matchIndex);
  const matched = [];
  const reviewNeeded = [];
  const unresolved = [];

  for (const item of batchIntake.items) {
    const itemShape = analyzeItemShape(item);
    const sourceReviewMetadata = buildSourceReviewMetadata(item, itemShape);
    const parity = filterQuestionsByImageParity(item, matchIndex.questions);
    const hasComparableText =
      Boolean(item.translatedPrompt) ||
      item.translatedOptions.length > 0 ||
      Boolean(item.translatedCorrectAnswer);

    if (!hasComparableText) {
      unresolved.push({
        itemId: item.itemId,
        sourceImage: item.sourceImage,
        ...sourceReviewMetadata,
        reason: "No translated text was provided. Populate intake.json with translated prompt/options before matching.",
        translatedText: {
          prompt: item.translatedPrompt,
          options: item.translatedOptions,
          correctAnswer: item.translatedCorrectAnswer,
        },
      });
      continue;
    }

    if (parity.questions.length === 0) {
      unresolved.push({
        itemId: item.itemId,
        sourceImage: item.sourceImage,
        ...sourceReviewMetadata,
        reason: `Image-parity filtering found no eligible master questions for this ${parity.label}.`,
        analysis: {
          mode: analysisMode,
          effectiveQuestionType: itemShape.effectiveType,
          declaredQuestionType: itemShape.declaredType,
          booleanChoiceDetected: itemShape.booleanOptions,
          topScore: 0,
          topGap: 0,
          plausibleShortlist: false,
          imageParityApplied: parity.applied,
          candidateImageParityMode: parity.label,
          candidateCountBeforeParity: matchIndex.questions.length,
          candidateCountAfterParity: 0,
          explanation: "Parity filtering removed all candidates, so no image-mismatched comparisons were produced.",
        },
        topCandidates: [],
      });
      continue;
    }

    const ranked = parity.questions
      .map((question) => {
        const score = scoreQuestionForBatchItem(item, question, corpus);
        return {
          question,
          score,
        };
      })
      .sort((left, right) => right.score.total - left.score.total);

    const top = ranked[0];
    const runnerUp = ranked[1];
    const gap = top ? top.score.total - (runnerUp?.score.total ?? 0) : 0;
    const candidates = ranked
      .slice(0, candidateLimit)
      .map(({ question, score }) => candidateSnapshot(item, question, score));
    const plausibleShortlist = shortlistPlausibility(top, gap);

    if (!top || top.score.total < reviewFloor || (analysisMode === "diagnostic" && !plausibleShortlist)) {
      unresolved.push({
        itemId: item.itemId,
        sourceImage: item.sourceImage,
        ...sourceReviewMetadata,
        reason:
          analysisMode === "diagnostic"
            ? "No candidate produced a plausible review shortlist after semantic normalization. See shortlist diagnostics."
            : "No candidate passed the minimum similarity threshold.",
        analysis: {
          mode: analysisMode,
          effectiveQuestionType: itemShape.effectiveType,
          declaredQuestionType: itemShape.declaredType,
          booleanChoiceDetected: itemShape.booleanOptions,
          topScore: round(top?.score.total ?? 0),
          topGap: round(gap),
          plausibleShortlist,
          imageParityApplied: parity.applied,
          candidateImageParityMode: parity.label,
          candidateCountBeforeParity: matchIndex.questions.length,
          candidateCountAfterParity: parity.questions.length,
          explanation: plausibleShortlist
            ? "Shortlist is plausible but still below the review floor."
            : "Shortlist remains weak after semantic normalization.",
        },
        topCandidates: candidates,
      });
      continue;
    }

    const result = {
      itemId: item.itemId,
      sourceImage: item.sourceImage,
      ...sourceReviewMetadata,
      localizedText: {
        prompt: item.localizedPrompt || null,
        options: item.localizedOptions,
        correctAnswer: item.localizedCorrectAnswer || null,
        explanation: item.localizedExplanation || null,
      },
      translatedText: {
        prompt: item.translatedPrompt || null,
        options: item.translatedOptions,
        correctAnswer: item.translatedCorrectAnswer || null,
      },
      topicHints: item.topicHints,
      answerPolarity: item.answerPolarity,
      match: {
        qid: top.question.qid,
        number: top.question.number,
        score: round(top.score.total),
        scoreGap: round(gap),
        scoreBreakdown: top.score.breakdown,
        candidateTopicTruth: {
          topic: top.question.tags.truthTopic,
          subtopics: top.question.tags.truthSubtopics,
          tags: top.question.tags.truthTags,
        },
        candidateImageRef: {
          hasImage: top.question.image.hasImage,
          currentAssetSrc: top.question.image.currentAssetSrc,
          assetHashes: top.question.image.assetHashes,
        },
      },
      analysis: {
        mode: analysisMode,
        effectiveQuestionType: itemShape.effectiveType,
        declaredQuestionType: itemShape.declaredType,
        booleanChoiceDetected: itemShape.booleanOptions,
        plausibleShortlist,
        imageParityApplied: parity.applied,
        candidateImageParityMode: parity.label,
        candidateCountBeforeParity: matchIndex.questions.length,
        candidateCountAfterParity: parity.questions.length,
        explanation: plausibleShortlist
          ? "Top candidate cleared the review floor but remains review-first."
          : "Top candidate is available for inspection, but confidence is still weak.",
      },
      proposedLocalization: buildProposedLocalization(item, top.question),
      reviewDecision: null,
      approvedLocalization: null,
      topCandidates: candidates,
    };

    const confident =
      (
        (
          top.score.total >= autoMatchThreshold &&
          gap >= autoGapThreshold &&
          top.score.breakdown.promptSimilarity >= autoPromptThreshold
        ) ||
        safeAutoMatch(itemShape, top, gap)
      ) &&
      (!itemShape.effectiveType || itemShape.effectiveType === top.question.type);

    if (confident) {
      matched.push(result);
    } else {
      reviewNeeded.push(result);
    }
  }

  return { matched, reviewNeeded, unresolved };
}

export function reportSummary(kind, items) {
  return {
    kind,
    count: items.length,
  };
}

export function buildMergePreview({ lang, batchId, dataset, existingDoc, approvedItems }) {
  const base = existingDoc?.questions && typeof existingDoc.questions === "object"
    ? structuredClone(existingDoc)
    : { meta: { locale: lang }, questions: {} };

  if (!base.meta || typeof base.meta !== "object") {
    base.meta = { locale: lang };
  }

  if (!base.questions || typeof base.questions !== "object") {
    base.questions = {};
  }

  for (const item of approvedItems) {
    base.questions[item.match.qid] = item.approvedLocalization;
  }

  base.meta.locale = lang;
  base.meta.generatedAt = stableNow();
  base.meta.reviewedBatchId = batchId;
  base.meta.approvedCount = approvedItems.length;
  base.meta.dataset = dataset;

  return base;
}

export function approvedBatchItems(outputs) {
  const pool = [...outputs.matched, ...outputs.reviewNeeded];

  return pool.filter((item) => {
    const approved = String(item.reviewDecision ?? "").trim().toLowerCase();
    return approved === "approve" && item.approvedLocalization && typeof item.approvedLocalization === "object";
  });
}

export async function writeBatchOutputs({ lang, batchId, dataset, matched, reviewNeeded, unresolved }) {
  const files = getBatchFiles(lang, batchId);

  await writeJson(files.matchedPath, {
    ...emptyBatchOutput({ lang, batchId, dataset, kind: "matched" }),
    items: matched,
  });

  await writeJson(files.reviewNeededPath, {
    ...emptyBatchOutput({ lang, batchId, dataset, kind: "review-needed" }),
    items: reviewNeeded,
  });

  await writeJson(files.unresolvedPath, {
    ...emptyBatchOutput({ lang, batchId, dataset, kind: "unresolved" }),
    items: unresolved,
  });

  return files;
}

export function summarizeExtractionItems(items) {
  const counts = {
    totalScreenshots: items.length,
    successfullyExtracted: 0,
    partialExtraction: 0,
    failedExtraction: 0,
  };

  for (const item of items) {
    const status = String(item.extractionStatus ?? "").trim().toLowerCase();

    if (status === "success") {
      counts.successfullyExtracted += 1;
      continue;
    }

    if (status === "partial") {
      counts.partialExtraction += 1;
      continue;
    }

    counts.failedExtraction += 1;
  }

  return counts;
}
