import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildKeywordBundle,
  deriveSourceItemFeatureBridge,
  deriveTranslationFeatureBridge,
} from "./feature-bridge.mjs";

export const ROOT = process.cwd();
export const DEFAULT_DATASET = "2023-test1";
export const DEFAULT_REFERENCE_LANG = "ko";
export const QBANK_TOOLS_DIR = path.join(ROOT, "qbank-tools");
export const GENERATED_DIR = path.join(QBANK_TOOLS_DIR, "generated");
export const REPORTS_DIR = path.join(GENERATED_DIR, "reports");
export const STAGING_DIR = path.join(GENERATED_DIR, "staging");
export const HISTORY_DIR = path.join(QBANK_TOOLS_DIR, "history");
export const DEFAULT_FEATURE_STORE_PATH = path.join(HISTORY_DIR, "qid-feature-store.json");
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
  /^what does this traffic sign (mean|indicate)$/,
  /^what does this warning sign (mean|indicate)$/,
  /^what does this prohibition sign (mean|indicate)$/,
  /^what is this sign$/,
  /^what is this road sign$/,
  /^what is this traffic sign$/,
  /^what is the meaning of this sign$/,
  /^what does this symbol (mean|indicate)$/,
  /^what does this marking (mean|indicate)$/,
  /^what does this road marking (mean|indicate)$/,
  /^what does this lane marking (mean|indicate)$/,
  /^what does this traffic light (mean|indicate)$/,
  /^what does this picture show$/,
  /^what does this (indicator|warning) light .* (mean|indicate)$/,
  /^what does this .*dashboard.*(light|indicator).*(mean|indicate)$/,
  /^what does this instrument panel .* (mean|indicate)$/,
  /^what does this warning light indicate$/,
  /^how should this intersection be passed$/,
  /^what should the driver do$/,
  /^what should the driver do in this situation$/,
  /^what is the correct response$/,
  /^how should the driver proceed$/,
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
      /^what does this warning sign (mean|indicate)$/,
      /^what does this prohibition sign (mean|indicate)$/,
      /^what is this traffic sign$/,
      /^what is this road sign$/,
    ],
  },
  {
    family: "symbol-meaning",
    syntheticJa: "この記号は何を示していますか",
    patterns: [
      /^what does this symbol (mean|indicate)$/,
      /^what does this traffic symbol (mean|indicate)$/,
    ],
  },
  {
    family: "marking-meaning",
    syntheticJa: "この路面標示は何を示していますか",
    patterns: [
      /^what does this marking (mean|indicate)$/,
      /^what does this road marking (mean|indicate)$/,
      /^what does this lane marking (mean|indicate)$/,
    ],
  },
  {
    family: "traffic-light-meaning",
    syntheticJa: "この信号は何を示していますか",
    patterns: [
      /^what does this traffic light (mean|indicate)$/,
      /^what does this signal light (mean|indicate)$/,
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
      /^what is the correct response$/,
      /^what is the correct handling$/,
      /^how should the driver proceed$/,
      /^how should the driver act$/,
      /^what should be done in this situation$/,
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
  [/\bkm\s*\/\s*h(?:r)?\b/g, "kmh"],
  [/\bkmhr\b/g, "kmh"],
  [/\bkm h\b/g, "kmh"],
  [/\bkm\s*\/\s*hr\b/g, "kmh"],
  [/\bhighway\b/g, "expressway"],
  [/\bfreeway\b/g, "expressway"],
  [/\bmotorway\b/g, "expressway"],
  [/\bhigh speed road\b/g, "expressway"],
  [/\bmotorized vehicles?\b/g, "vehicle"],
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
  [/\blevel crossing\b/g, "railway crossing"],
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
  [/\bincrease speed\b/g, "accelerate"],
  [/\bspeed increase\b/g, "accelerate"],
  [/\bhand brake\b/g, "handbrake"],
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
  [/\bvisibility is poor\b/g, "visibility-low"],
  [/\bvisibility is low\b/g, "visibility-low"],
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
  [/\bstop and wait\b/g, "stop-and-wait stop wait"],
  [/\bstop to yield\b/g, "stop yield"],
  [/\bstop and yield\b/g, "stop yield"],
  [/\bdo not\b/g, "must-not"],
  [/\bshould not\b/g, "must-not"],
  [/\bovertake\b/g, "pass"],
  [/\bovertaking\b/g, "pass"],
  [/\bbypass\b/g, "pass"],
  [/\bpass around\b/g, "pass"],
  [/\bcoming from behind\b/g, "following"],
  [/\bfrom behind\b/g, "following"],
  [/\bfollowing vehicle\b/g, "following"],
  [/\bfollowing vehicles\b/g, "following"],
  [/\bvehicle following\b/g, "following"],
  [/\bturn left\b/g, "left-turn"],
  [/\bturn right\b/g, "right-turn"],
  [/\bgo ahead\b/g, "go"],
  [/\bproceed ahead\b/g, "go"],
  [/\bproceed\b/g, "go"],
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
  [/\bfollow lane markings\b/g, "follow-markings"],
  [/\baccording to lane markings\b/g, "follow-markings"],
  [/\bfollow the markings\b/g, "follow-markings"],
  [/\bbacking up\b/g, "backing"],
  [/\bback up\b/g, "backing"],
  [/\bbacking\b/g, "backing"],
  [/\breversing\b/g, "backing"],
  [/\breverse\b/g, "backing"],
  [/\bno reversing\b/g, "must-not backing"],
  [/\breverse prohibited\b/g, "must-not backing"],
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
  [/\bgentle braking\b/g, "gentle-brake"],
  [/\bgentle brake\b/g, "gentle-brake"],
  [/\bmaximum\b/g, "max"],
  [/\bminimum\b/g, "min"],
  [/\bgo forward\b/g, "go"],
  [/\bgo straight\b/g, "go"],
  [/\bstop at once\b/g, "stop"],
  [/\bstop immediately\b/g, "stop"],
  [/\bwarning lights?\b/g, "hazard-lights"],
  [/\bemergency lights?\b/g, "hazard-lights"],
  [/\bdipped headlights?\b/g, "low-beam"],
  [/\blow beams?\b/g, "low-beam"],
  [/\bhigh beams?\b/g, "high-beam"],
  [/\bfull beam(?: headlights?)?\b/g, "high-beam"],
  [/\bshoulder lane\b/g, "emergency-lane"],
  [/\broad shoulder\b/g, "emergency-lane"],
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

const MCQ_KEYWORD_STOPWORDS = new Set([
  ...STOPWORDS,
  ...GENERIC_PROMPT_TOKENS,
  "driver",
  "drivers",
  "situation",
  "picture",
  "question",
  "kind",
  "behavior",
  "behaviour",
]);

export const CURRENT_FEATURE_SCHEMA_VERSION = 3;

const FEATURE_KEYWORD_STOPWORDS = new Set([
  ...MCQ_KEYWORD_STOPWORDS,
  "car",
  "cars",
  "follow",
  "following",
  "indicate",
  "indicates",
  "mean",
  "meaning",
  "means",
  "motor",
  "motorized",
  "vehicle",
  "vehicles",
]);

const FEATURE_DOMAIN_KEYWORDS = new Set([
  "accident",
  "accelerate",
  "ahead",
  "airbag",
  "arrow",
  "backing",
  "battery",
  "bicycle",
  "bicycle-lane",
  "bicycle-prohibited",
  "bike",
  "bridge",
  "bus",
  "children",
  "cliff",
  "crosswalk",
  "dashboard",
  "deer",
  "downhill",
  "emergency-phone",
  "engine-compartment",
  "expressway",
  "flooded-road",
  "fog",
  "fuel-tank-lid",
  "gear",
  "green",
  "head-light",
  "headlight",
  "high-beam",
  "honk",
  "horn",
  "ice",
  "indicator",
  "indicator-light",
  "intersection",
  "key",
  "lane",
  "lane-change",
  "left-turn",
  "license",
  "lighthouse",
  "low-beam",
  "luggage-compartment",
  "marking",
  "mountain",
  "mud",
  "night",
  "no-entry",
  "overtake",
  "parking",
  "pass",
  "pedestrian",
  "phone",
  "railroad",
  "railway",
  "rain",
  "red",
  "red-car",
  "reverse",
  "right-turn",
  "school",
  "seatbelt",
  "ship",
  "sign",
  "signal",
  "slow",
  "snow",
  "speed",
  "stop",
  "straight",
  "traffic-light",
  "train",
  "tunnel",
  "turn-signal",
  "uphill",
  "visibility-low",
  "wheelchair",
  "wildlife",
  "wind",
  "yield",
]);

const MCQ_CONTRADICTION_RULES = [
  { label: "left-vs-right", left: ["left", "left-turn"], right: ["right", "right-turn"], weight: 0.28 },
  { label: "maximum-vs-minimum", left: ["max", "maximum"], right: ["min", "minimum"], weight: 0.24 },
  { label: "stop-vs-go-pass", left: ["stop"], right: ["go", "pass", "accelerate"], weight: 0.22 },
  { label: "allowed-vs-prohibited", left: ["allowed", "allow", "may", "can"], right: ["must-not", "prohibited", "forbidden", "not-allowed", "no-entry"], weight: 0.22 },
  { label: "increase-vs-reduce", left: ["increase", "accelerate"], right: ["reduce", "slow"], weight: 0.18 },
  { label: "before-vs-after", left: ["before", "prior"], right: ["after", "following"], weight: 0.2 },
  { label: "inside-vs-outside", left: ["inside"], right: ["outside"], weight: 0.18 },
  { label: "ahead-vs-behind", left: ["ahead", "straight"], right: ["behind", "following"], weight: 0.18 },
  { label: "emergency-vs-gentle-braking", left: ["emergency-brake"], right: ["gentle-brake", "slow"], weight: 0.22 },
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
    imageColorTagsPath: path.join(datasetDir, "image-color-tags.json"),
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
    ensureDir(HISTORY_DIR),
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

export async function loadCorrectionRulesFile(filePath) {
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.resolve(String(filePath));
  const raw = await fsp.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeCorrectionRulesDoc(parsed, resolvedPath);
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

function prioritizeReasonCodes(values, limit) {
  const priority = new Map([
    ["force-review", 100],
    ["family-mismatch", 96],
    ["indicator-vs-sign-conflict", 95],
    ["indicator-vs-action-conflict", 95],
    ["sign-vs-action-conflict", 95],
    ["numeric-mismatch", 94],
    ["unit-mismatch", 93],
    ["max-vs-min-conflict", 93],
    ["duration-vs-penalty-conflict", 93],
    ["prompt-family-mismatch", 92],
    ["review-floor", 91],
    ["total-low", 90],
    ["gap-small", 89],
  ]);
  const deduped = unique(values);

  return deduped
    .map((code, index) => ({
      code,
      index,
      priority: priority.get(code) ?? 0,
    }))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.code);
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

const PROMPT_FAMILY_BUCKETS = {
  indicator: new Set([
    "dashboard-indicator",
    "gauge-identity",
    "switch-control",
    "device-identity",
  ]),
  sign: new Set([
    "sign-meaning",
    "road-sign-meaning",
    "symbol-meaning",
    "marking-meaning",
    "traffic-light-meaning",
    "picture-show",
    "police-hand-signal",
  ]),
  action: new Set([
    "driver-action",
    "intersection-action",
  ]),
};

function promptFamilyBucketFromFamily(family) {
  const normalized = normalizeWhitespace(family);

  if (!normalized) {
    return null;
  }

  for (const [bucket, families] of Object.entries(PROMPT_FAMILY_BUCKETS)) {
    if (families.has(normalized)) {
      return bucket;
    }
  }

  return null;
}

function inferPromptFamilyBucket({
  family = null,
  text = "",
  gloss = "",
  keywords = [],
  questionType = null,
} = {}) {
  const familyBucket = promptFamilyBucketFromFamily(family);

  if (familyBucket) {
    return familyBucket;
  }

  const normalized = semanticNormalizeText([
    text,
    gloss,
    ...toList(keywords),
  ].filter(Boolean).join(" "));

  if (!normalized) {
    return null;
  }

  if (
    /\b(?:dashboard|instrument panel|instrument cluster|warning light|warning lamp|indicator light|indicator lamp|warning indicator|indicator|brake-system|battery|oil pressure|check engine|engine fault|abs|seatbelt light|seat belt light|gauge|meter|switch|open hood|engine compartment|luggage compartment|open trunk|open door|door open|car-icon|yellow-car-icon)\b/.test(normalized) ||
    /\bdashboard-indicator\b/.test(normalized)
  ) {
    return "indicator";
  }

  if (
    /\b(?:road sign|traffic sign|warning sign|prohibition sign|sign mean|sign indicate|symbol mean|symbol indicate|road marking|lane marking|marking mean|traffic light meaning|signal light meaning)\b/.test(normalized) ||
    /\b(?:sign|road-marking|traffic-light|police-hand-signal)\b/.test(normalized)
  ) {
    return "sign";
  }

  if (
    /\b(?:what should|how should|driver response|correct response|correct handling|in this situation|how to proceed|should the driver|what action|what should be done|may proceed|allowed|prohibited)\b/.test(normalized) ||
    (
      questionType === "ROW" &&
      /\b(?:yield|stop|slow|accelerate|overtake|reverse|park|honk|proceed|continue)\b/.test(normalized) &&
      !/\b(?:sign|symbol|marking|dashboard|indicator|warning light)\b/.test(normalized)
    )
  ) {
    return "action";
  }

  return null;
}

function familyConflictReasonCode(sourceBucket, candidateBucket) {
  const pair = unique([sourceBucket, candidateBucket]).sort().join("|");

  switch (pair) {
    case "action|indicator":
      return "indicator-vs-action-conflict";
    case "action|sign":
      return "sign-vs-action-conflict";
    case "indicator|sign":
      return "indicator-vs-sign-conflict";
    default:
      return "family-mismatch";
  }
}

function comparePromptFamilyCompatibility({
  sourceFamily = null,
  sourceBucket = null,
  candidateFamily = null,
  candidateBucket = null,
} = {}) {
  const normalizedSourceBucket = sourceBucket ?? promptFamilyBucketFromFamily(sourceFamily);
  const normalizedCandidateBucket = candidateBucket ?? promptFamilyBucketFromFamily(candidateFamily);

  if (!normalizedSourceBucket && !sourceFamily) {
    return {
      score: 0.5,
      mismatchPenalty: 0,
      supportBonus: 0,
      reasonCodes: [],
      sourceBucket: null,
      candidateBucket: normalizedCandidateBucket,
      exactFamilyMatch: false,
      bucketMatch: false,
    };
  }

  if (!normalizedCandidateBucket && !candidateFamily) {
    return {
      score: 0.35,
      mismatchPenalty: 0,
      supportBonus: 0,
      reasonCodes: [],
      sourceBucket: normalizedSourceBucket,
      candidateBucket: null,
      exactFamilyMatch: false,
      bucketMatch: false,
    };
  }

  if (sourceFamily && candidateFamily && sourceFamily === candidateFamily) {
    return {
      score: 1,
      mismatchPenalty: 0,
      supportBonus: 0.12,
      reasonCodes: [],
      sourceBucket: normalizedSourceBucket,
      candidateBucket: normalizedCandidateBucket,
      exactFamilyMatch: true,
      bucketMatch: normalizedSourceBucket === normalizedCandidateBucket,
    };
  }

  if (normalizedSourceBucket && normalizedCandidateBucket && normalizedSourceBucket === normalizedCandidateBucket) {
    return {
      score: 0.82,
      mismatchPenalty: 0,
      supportBonus: 0.06,
      reasonCodes: [],
      sourceBucket: normalizedSourceBucket,
      candidateBucket: normalizedCandidateBucket,
      exactFamilyMatch: false,
      bucketMatch: true,
    };
  }

  if (normalizedSourceBucket && normalizedCandidateBucket && normalizedSourceBucket !== normalizedCandidateBucket) {
    return {
      score: 0,
      mismatchPenalty: 0.22,
      supportBonus: 0,
      reasonCodes: ["family-mismatch", familyConflictReasonCode(normalizedSourceBucket, normalizedCandidateBucket)],
      sourceBucket: normalizedSourceBucket,
      candidateBucket: normalizedCandidateBucket,
      exactFamilyMatch: false,
      bucketMatch: false,
    };
  }

  return {
    score: 0.4,
    mismatchPenalty: 0,
    supportBonus: 0,
    reasonCodes: [],
    sourceBucket: normalizedSourceBucket,
    candidateBucket: normalizedCandidateBucket,
    exactFamilyMatch: false,
    bucketMatch: false,
  };
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

function semanticTextTokens(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean);
}

function keywordTokensFromNormalized(value, stopwords = MCQ_KEYWORD_STOPWORDS) {
  return unique(
    semanticTextTokens(value).filter(
      (token) => token.length > 1 && !stopwords.has(token) && !/^\d+(?:\.\d+)?(?:kmh|km|m|cm|mm|kg|t|%)?$/.test(token),
    ),
  );
}

function keywordPhraseTokensFromNormalized(value, { minSize = 2, maxSize = 3 } = {}) {
  const tokens = keywordTokensFromNormalized(value);
  const phrases = [];

  for (let size = minSize; size <= Math.min(maxSize, tokens.length); size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (slice.length === size) {
        phrases.push(slice.join(" "));
      }
    }
  }

  return unique(phrases);
}

function optionConceptTokensFromNormalized(value) {
  const baseTokens = keywordTokensFromNormalized(value, FEATURE_KEYWORD_STOPWORDS);
  const concepts = [...baseTokens];
  const tokenSet = new Set(baseTokens);

  if (tokenSet.has("stop") && tokenSet.has("wait")) {
    concepts.push("stop-and-wait");
  }

  if (tokenSet.has("stop") && tokenSet.has("yield")) {
    concepts.push("stop-yield");
  }

  if (tokenSet.has("must-not") && tokenSet.has("pass")) {
    concepts.push("no-pass");
  }

  if (tokenSet.has("must-not") && tokenSet.has("backing")) {
    concepts.push("no-backing");
  }

  if (tokenSet.has("must-not") && tokenSet.has("u-turn")) {
    concepts.push("no-u-turn");
  }

  if (tokenSet.has("must-not") && tokenSet.has("left-turn")) {
    concepts.push("no-left-turn");
  }

  if (tokenSet.has("must-not") && tokenSet.has("right-turn")) {
    concepts.push("no-right-turn");
  }

  if (tokenSet.has("must-not") && tokenSet.has("parking")) {
    concepts.push("no-parking");
  }

  if (tokenSet.has("must-not") && tokenSet.has("honk")) {
    concepts.push("no-honk");
  }

  if (tokenSet.has("follow-markings")) {
    concepts.push("lane-marking-guidance");
  }

  if (tokenSet.has("hazard-lights")) {
    concepts.push("warning-lights");
  }

  if (tokenSet.has("low-beam")) {
    concepts.push("headlight-low");
  }

  if (tokenSet.has("high-beam")) {
    concepts.push("headlight-high");
  }

  return unique(concepts);
}

function optionConceptSignatureFromTokens(tokens) {
  return unique(tokens).sort().join(" ");
}

function optionConceptSetSignature(optionConceptTokenSets) {
  return optionConceptTokenSets
    .map((tokens) => optionConceptSignatureFromTokens(tokens))
    .filter(Boolean)
    .sort()
    .join(" || ");
}

function distinctiveKeywordTokens(tokens) {
  return unique(
    toList(tokens).filter((token) => token.includes("-") || token.length >= 6 || /\d/.test(token)),
  );
}

function extractNumericSignalsFromNormalized(value) {
  const text = normalizeWhitespace(value);
  const tokens = [];
  const values = [];
  const pattern = /\b(\d+(?:\.\d+)?)(kmh|km|m|cm|mm|kg|t|%)?\b/g;

  for (const match of text.matchAll(pattern)) {
    const numericValue = String(match[1]);
    const unit = String(match[2] ?? "");
    values.push(numericValue);
    tokens.push(unit ? `${numericValue}${unit}` : numericValue);
  }

  return {
    tokens: unique(tokens),
    values: unique(values),
  };
}

function detectNumericPromptIntent({
  normalizedPrompt = "",
  promptTokens = [],
  keywordTokens = [],
  numericSignals = {},
  extraKeywords = [],
} = {}) {
  const normalizedExtraKeywords = toList(extraKeywords).flatMap((keyword) =>
    semanticTextTokens(semanticNormalizeText(keyword))
  );
  const tokens = new Set([
    ...semanticTextTokens(normalizedPrompt),
    ...toList(promptTokens),
    ...toList(keywordTokens),
    ...normalizedExtraKeywords,
  ]);
  const numericTokens = toList(numericSignals?.tokens);
  const numericValues = toList(numericSignals?.values);
  const unitTypes = [];
  const pushUnit = (value) => {
    if (value && !unitTypes.includes(value)) {
      unitTypes.push(value);
    }
  };

  if (
    numericTokens.some((token) => /kmh$/.test(token)) ||
    tokens.has("speed") ||
    tokens.has("max-speed") ||
    tokens.has("min-speed")
  ) {
    pushUnit("kmh");
  }

  if (
    numericTokens.some((token) => /\d(?:km|m|cm|mm)$/.test(token)) ||
    tokens.has("distance") ||
    tokens.has("meter") ||
    tokens.has("metre") ||
    tokens.has("km")
  ) {
    pushUnit("distance");
  }

  if (tokens.has("year")) {
    pushUnit("years");
  }

  if (tokens.has("month")) {
    pushUnit("months");
  }

  if (tokens.has("day")) {
    pushUnit("days");
  }

  if (tokens.has("point")) {
    pushUnit("points");
  }

  if (tokens.has("yuan") || tokens.has("fine")) {
    pushUnit("yuan");
  }

  const modifier =
    tokens.has("max") || tokens.has("maximum") || tokens.has("highest")
      ? "max"
      : tokens.has("min") || tokens.has("minimum") || tokens.has("lowest")
      ? "min"
      : null;

  let promptFamily = null;
  if (
    tokens.has("penalty") ||
    tokens.has("punishment") ||
    tokens.has("fine") ||
    tokens.has("deprived") ||
    tokens.has("revoked") ||
    tokens.has("bribery") ||
    tokens.has("illegal") ||
    tokens.has("crime") ||
    tokens.has("point")
  ) {
    promptFamily = "penalty";
  } else if (
    tokens.has("age") ||
    tokens.has("old") ||
    tokens.has("adult") ||
    tokens.has("minor")
  ) {
    promptFamily = "age";
  } else if (
    tokens.has("speed") ||
    tokens.has("max-speed") ||
    tokens.has("min-speed") ||
    unitTypes.includes("kmh")
  ) {
    promptFamily = "speed";
  } else if (
    tokens.has("distance") ||
    tokens.has("meter") ||
    tokens.has("metre") ||
    unitTypes.includes("distance")
  ) {
    promptFamily = "distance";
  } else if (
    tokens.has("period") ||
    tokens.has("within") ||
    tokens.has("before") ||
    tokens.has("after") ||
    tokens.has("probation") ||
    tokens.has("expire") ||
    tokens.has("expiration") ||
    tokens.has("duration") ||
    unitTypes.includes("years") ||
    unitTypes.includes("months") ||
    unitTypes.includes("days")
  ) {
    promptFamily = "duration";
  } else if (
    tokens.has("accelerate") ||
    tokens.has("slow") ||
    tokens.has("stop") ||
    tokens.has("yield") ||
    tokens.has("pass") ||
    tokens.has("go") ||
    tokens.has("backing") ||
    tokens.has("honk")
  ) {
    promptFamily = "action";
  }

  return {
    hasNumber: numericValues.length > 0 || unitTypes.length > 0,
    unitTypes,
    modifier,
    promptFamily,
  };
}

function compareNumericPromptIntent(sourceIntent, candidateIntent) {
  const reasonCodes = [];
  let penalty = 0;
  const addReason = (code, weight) => {
    if (!reasonCodes.includes(code)) {
      reasonCodes.push(code);
      penalty += weight;
    }
  };
  const sourceFamily = sourceIntent?.promptFamily ?? null;
  const candidateFamily = candidateIntent?.promptFamily ?? null;
  const sourceUnits = toList(sourceIntent?.unitTypes);
  const candidateUnits = toList(candidateIntent?.unitTypes);
  const unitOverlap = sourceUnits.filter((unit) => candidateUnits.includes(unit));

  if (
    sourceIntent?.modifier &&
    candidateIntent?.modifier &&
    sourceIntent.modifier !== candidateIntent.modifier &&
    (sourceFamily === "speed" || candidateFamily === "speed")
  ) {
    addReason("max-vs-min-conflict", 0.18);
  }

  if (
    (sourceFamily === "duration" && candidateFamily === "penalty") ||
    (sourceFamily === "penalty" && candidateFamily === "duration")
  ) {
    addReason("duration-vs-penalty-conflict", 0.18);
  }

  if (
    sourceUnits.length > 0 &&
    candidateUnits.length > 0 &&
    unitOverlap.length === 0
  ) {
    addReason("unit-mismatch", 0.1);
  }

  if (
    sourceFamily &&
    candidateFamily &&
    sourceFamily !== candidateFamily &&
    !(sourceFamily === "action" && candidateFamily === "action")
  ) {
    addReason("prompt-family-mismatch", 0.1);
  }

  return {
    penalty: clamp01(penalty),
    reasonCodes,
  };
}

const NUMERIC_GROUP_NUMBER_PATTERN = "(\\d+(?:[.,]\\d+)?)";
const NUMERIC_GROUP_UNIT_PATTERN = [
  "km/h",
  "km/hr",
  "kmh",
  "км/ч",
  "км/час",
  "kilometers? per hour",
  "kilometres? per hour",
  "meters?",
  "metres?",
  "метр(?:ов|а)?",
  "m",
  "kilometers?",
  "kilometres?",
  "километр(?:ов|а)?",
  "km",
  "years?",
  "yrs?",
  "год(?:а|у|ом)?",
  "лет",
  "months?",
  "месяц(?:ев|а)?",
  "days?",
  "д(?:ень|ня|ней)",
  "сут(?:ки|ок)?",
  "hours?",
  "час(?:ов|а)?",
  "points?",
  "балл(?:ов|а)?",
  "yuan",
  "юан(?:ей|я)?",
  "percent",
  "%",
  "times?",
  "раз(?:а)?",
].join("|");
const NUMERIC_GROUP_RANGE_SEPARATOR_PATTERN = "(?:to|до|по|through|thru|~|-|\\u2013|\\u2014)";
const NUMERIC_GROUP_GT_PATTERN = "(?:more than|greater than|over|above|exceeding|больше|более|свыше)";
const NUMERIC_GROUP_LT_PATTERN = "(?:less than|fewer than|under|below|меньше|менее)";
const NUMERIC_GROUP_COMPARATOR_PATTERN = [
  "not more than",
  "no more than",
  "up to",
  "not less than",
  "no less than",
  "at least",
  "more than",
  "greater than",
  "less than",
  "fewer than",
  "under",
  "below",
  "over",
  "above",
  "exceeding",
  "не\\s+более",
  "не\\s+менее",
  "меньше",
  "менее",
  "больше",
  "более",
  "свыше",
  "до",
  "от",
].join("|");

function normalizeNumericGroupValue(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number)) {
    return null;
  }

  return Number.isInteger(number) ? number : Number(number.toFixed(3));
}

function normalizeNumericGroupUnit(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) {
    return null;
  }

  if (/^(?:km\/h|km\/hr|kmh|км\/ч|км\/час|kilometers? per hour|kilometres? per hour)$/.test(text)) {
    return "km/h";
  }

  if (/^(?:meters?|metres?|m|метр(?:ов|а)?)$/.test(text)) {
    return "meters";
  }

  if (/^(?:kilometers?|kilometres?|km|километр(?:ов|а)?)$/.test(text)) {
    return "km";
  }

  if (/^(?:years?|yrs?|год(?:а|у|ом)?|лет)$/.test(text)) {
    return "years";
  }

  if (/^(?:months?|месяц(?:ев|а)?)$/.test(text)) {
    return "months";
  }

  if (/^(?:days?|д(?:ень|ня|ней)|сут(?:ки|ок)?)$/.test(text)) {
    return "days";
  }

  if (/^(?:hours?|час(?:ов|а)?)$/.test(text)) {
    return "hours";
  }

  if (/^(?:points?|балл(?:ов|а)?)$/.test(text)) {
    return "points";
  }

  if (/^(?:yuan|юан(?:ей|я)?)$/.test(text)) {
    return "yuan";
  }

  if (/^(?:percent|%)$/.test(text)) {
    return "percent";
  }

  if (/^(?:times?|раз(?:а)?)$/.test(text)) {
    return "times";
  }

  return text;
}

function normalizeNumericGroupComparator(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) {
    return "exact";
  }

  if (/^(?:less than|fewer than|under|below|меньше|менее)$/.test(text)) {
    return "lt";
  }

  if (/^(?:not more than|no more than|up to|не более|до)$/.test(text)) {
    return "lte";
  }

  if (/^(?:more than|greater than|over|above|exceeding|больше|более|свыше)$/.test(text)) {
    return "gt";
  }

  if (/^(?:not less than|no less than|at least|не менее|от)$/.test(text)) {
    return "gte";
  }

  return "exact";
}

function numericGroupKey(group) {
  return [
    group.range ? "range" : "single",
    group.comparator ?? "exact",
    group.values.join("~"),
    group.unit ?? "",
  ].join("|");
}

function numericGroupForDiagnostics(group) {
  return {
    values: group.values,
    range: group.range === true,
    unit: group.unit ?? null,
    comparator: group.comparator ?? (group.range ? "range" : "exact"),
    text: group.text ?? null,
  };
}

function numericGroupsOverlap(left, right) {
  return left.values.some((value) => right.values.includes(value));
}

function numericGroupValuesEqual(left, right) {
  return left.values.length === right.values.length && left.values.every((value, index) => right.values[index] === value);
}

function numericGroupUnitsCompatible(left, right) {
  if (!left.unit || !right.unit) {
    return true;
  }

  return left.unit === right.unit;
}

function numericGroupComparatorFamily(group) {
  if (group.range) {
    return "range";
  }

  if (["lt", "lte"].includes(group.comparator)) {
    return "max";
  }

  if (["gt", "gte"].includes(group.comparator)) {
    return "min";
  }

  return "exact";
}

function pushNumericGroup(groups, seen, group) {
  if (!group || !Array.isArray(group.values) || group.values.length === 0) {
    return;
  }

  const normalized = {
    values: group.values,
    range: group.range === true,
    unit: group.unit ?? null,
    comparator: group.comparator ?? (group.range ? "range" : "exact"),
    text: normalizeWhitespace(group.text ?? ""),
  };
  const key = numericGroupKey(normalized);
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  groups.push(normalized);
}

function extractNumericGroupsFromText(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) {
    return [];
  }

  const groups = [];
  const seen = new Set();
  const consumed = [];
  const markConsumed = (match) => {
    consumed.push([match.index, match.index + match[0].length]);
  };
  const isConsumed = (match) =>
    consumed.some(([start, end]) => match.index >= start && match.index < end);
  const unit = `(?:${NUMERIC_GROUP_UNIT_PATTERN})`;
  const comparatorRangePattern = new RegExp(
    `\\b(${NUMERIC_GROUP_GT_PATTERN})\\s+${NUMERIC_GROUP_NUMBER_PATTERN}\\s*(${unit})?\\s+(?:and|и)\\s+(${NUMERIC_GROUP_LT_PATTERN})\\s+${NUMERIC_GROUP_NUMBER_PATTERN}\\s*(${unit})?`,
    "giu",
  );
  const rangePattern = new RegExp(
    `\\b(?:from|between|от|с)?\\s*${NUMERIC_GROUP_NUMBER_PATTERN}\\s*(${unit})?\\s*${NUMERIC_GROUP_RANGE_SEPARATOR_PATTERN}\\s*${NUMERIC_GROUP_NUMBER_PATTERN}\\s*(${unit})?`,
    "giu",
  );
  const singlePattern = new RegExp(
    `\\b(?:(?:${NUMERIC_GROUP_COMPARATOR_PATTERN})\\s+)?${NUMERIC_GROUP_NUMBER_PATTERN}\\s*(${unit})?`,
    "giu",
  );

  for (const match of text.matchAll(comparatorRangePattern)) {
    const leftValue = normalizeNumericGroupValue(match[2]);
    const rightValue = normalizeNumericGroupValue(match[5]);
    if (leftValue === null || rightValue === null) {
      continue;
    }

    pushNumericGroup(groups, seen, {
      values: [leftValue, rightValue],
      range: true,
      unit: normalizeNumericGroupUnit(match[6] || match[3]),
      comparator: "exclusive-range",
      text: match[0],
    });
    markConsumed(match);
  }

  for (const match of text.matchAll(rangePattern)) {
    if (isConsumed(match)) {
      continue;
    }

    const leftValue = normalizeNumericGroupValue(match[1]);
    const rightValue = normalizeNumericGroupValue(match[3]);
    if (leftValue === null || rightValue === null) {
      continue;
    }

    pushNumericGroup(groups, seen, {
      values: [leftValue, rightValue],
      range: true,
      unit: normalizeNumericGroupUnit(match[4] || match[2]),
      comparator: "range",
      text: match[0],
    });
    markConsumed(match);
  }

  for (const match of text.matchAll(singlePattern)) {
    if (isConsumed(match)) {
      continue;
    }

    const numericMatch = match[0].match(new RegExp(NUMERIC_GROUP_NUMBER_PATTERN));
    const numericValue = normalizeNumericGroupValue(numericMatch?.[1]);
    if (numericValue === null) {
      continue;
    }

    const comparatorMatch = match[0].match(new RegExp(`^(${NUMERIC_GROUP_COMPARATOR_PATTERN})\\s+`, "iu"));
    pushNumericGroup(groups, seen, {
      values: [numericValue],
      range: false,
      unit: normalizeNumericGroupUnit(match[2]),
      comparator: normalizeNumericGroupComparator(comparatorMatch?.[1]),
      text: match[0],
    });
  }

  return groups.map(numericGroupForDiagnostics);
}

function extractNumericGroupsFromTexts(values) {
  const groups = [];
  const seen = new Set();

  for (const value of toList(values)) {
    for (const group of extractNumericGroupsFromText(value)) {
      pushNumericGroup(groups, seen, group);
    }
  }

  return groups.map(numericGroupForDiagnostics);
}

function numericGroupComparisonForPair(sourceGroup, candidateGroup) {
  const reasonCodes = [];
  let score = 0;
  let penalty = 0;
  const valuesEqual = numericGroupValuesEqual(sourceGroup, candidateGroup);
  const valuesOverlap = numericGroupsOverlap(sourceGroup, candidateGroup);
  const unitsCompatible = numericGroupUnitsCompatible(sourceGroup, candidateGroup);

  if (!unitsCompatible && valuesOverlap) {
    reasonCodes.push("numeric-unit-mismatch");
    penalty = Math.max(penalty, 0.35);
  }

  if (
    valuesEqual &&
    unitsCompatible &&
    numericGroupComparatorFamily(sourceGroup) === numericGroupComparatorFamily(candidateGroup)
  ) {
    reasonCodes.push("numeric-group-match");
    if (sourceGroup.range && candidateGroup.range) {
      reasonCodes.push("numeric-range-match");
    }

    score = sourceGroup.range ? 1 : 0.86;
    if (sourceGroup.unit && !candidateGroup.unit) {
      score = Math.min(score, 0.65);
      penalty = Math.max(penalty, 0.12);
    }

    return { score, penalty, reasonCodes };
  }

  if (sourceGroup.range && valuesOverlap && unitsCompatible) {
    reasonCodes.push("numeric-range-partial", "numeric-range-missing-value");
    score = 0.18;
    penalty = Math.max(penalty, 0.55);
  }

  if (!valuesOverlap) {
    reasonCodes.push("numeric-range-missing-value");
    penalty = Math.max(penalty, 0.42);
  }

  if (
    valuesOverlap &&
    numericGroupComparatorFamily(sourceGroup) !== numericGroupComparatorFamily(candidateGroup)
  ) {
    reasonCodes.push("numeric-comparator-conflict");
    penalty = Math.max(penalty, 0.52);
  }

  return { score, penalty, reasonCodes };
}

function compareNumericGroups(sourceGroups, candidateGroups) {
  const sources = toList(sourceGroups);
  const candidates = toList(candidateGroups);
  const reasonCodes = [];
  const matches = [];

  if (sources.length === 0) {
    return {
      available: false,
      score: 0.5,
      penalty: 0,
      reasonCodes,
      matches,
    };
  }

  if (candidates.length === 0) {
    return {
      available: true,
      score: 0,
      penalty: 0.58,
      reasonCodes: ["numeric-range-missing-value"],
      matches,
    };
  }

  let totalScore = 0;
  let maxPenalty = 0;

  for (const sourceGroup of sources) {
    let best = null;
    for (const candidateGroup of candidates) {
      const comparison = numericGroupComparisonForPair(sourceGroup, candidateGroup);
      const rank = comparison.score - comparison.penalty;
      if (!best || rank > best.rank) {
        best = {
          ...comparison,
          rank,
          source: sourceGroup,
          candidate: candidateGroup,
        };
      }
    }

    if (!best) {
      continue;
    }

    totalScore += best.score;
    maxPenalty = Math.max(maxPenalty, best.penalty);
    reasonCodes.push(...best.reasonCodes);
    matches.push({
      source: best.source,
      candidate: best.candidate,
      score: round(best.score),
      penalty: round(best.penalty),
      reasonCodes: unique(best.reasonCodes),
    });
  }

  return {
    available: true,
    score: clamp01(totalScore / sources.length),
    penalty: clamp01(maxPenalty),
    reasonCodes: unique(reasonCodes),
    matches,
  };
}

function sourceNumericGroupTexts(item, sourceFeatureBridge) {
  return unique([
    item?.localizedPrompt,
    item?.translatedPrompt,
    item?.localizedCorrectAnswer,
    item?.translatedCorrectAnswer,
    sourceFeatureBridge?.glossEn,
    ...toList(item?.localizedOptions),
    ...toList(item?.translatedOptions),
  ].filter(Boolean));
}

function candidateNumericGroupTexts(question, sourceLang) {
  const localized = question?.translations?.[normalizeLang(sourceLang)] ?? null;
  return unique([
    question?.prompt,
    question?.sourcePrompt,
    question?.translatedPrompt,
    question?.normalizedFeatures?.masterGlossEn,
    localized?.prompt,
    localized?.promptGlossEn,
    localized?.questionText,
    question?.correctAnswer?.correctOptionText,
    question?.correctAnswer?.correctOptionTranslatedText,
    question?.correctAnswer?.correctOptionKey,
    ...toList(question?.options).flatMap((option) => [
      option?.text,
      option?.sourceText,
      option?.translatedText,
    ]),
  ].filter(Boolean));
}

function buildMcqFingerprint({
  prompt = "",
  correctAnswer = "",
  options = [],
  topic = null,
  subtopics = [],
  hasImage = false,
} = {}) {
  const normalizedPrompt = semanticNormalizeText(prompt);
  const normalizedCorrectAnswer = semanticNormalizeText(correctAnswer);
  const normalizedOptions = options
    .map((option) => semanticNormalizeText(option))
    .filter(Boolean);
  const promptAllTokens = semanticTextTokens(normalizedPrompt);
  const answerAllTokens = semanticTextTokens(normalizedCorrectAnswer);
  const optionAllTokenSets = normalizedOptions.map((option) => semanticTextTokens(option));
  const promptTokens = keywordTokensFromNormalized(normalizedPrompt);
  const answerTokens = keywordTokensFromNormalized(normalizedCorrectAnswer);
  const promptPhraseTokens = keywordPhraseTokensFromNormalized(normalizedPrompt);
  const answerPhraseTokens = keywordPhraseTokensFromNormalized(normalizedCorrectAnswer);
  const optionTokenSets = normalizedOptions.map((option) => keywordTokensFromNormalized(option));
  const optionPhraseTokenSets = normalizedOptions.map((option) => keywordPhraseTokensFromNormalized(option));
  const optionConceptTokenSets = normalizedOptions.map((option) => optionConceptTokensFromNormalized(option));
  const optionTokens = unique(optionTokenSets.flat());
  const optionPhraseTokens = unique(optionPhraseTokenSets.flat());
  const optionConceptTokens = unique(optionConceptTokenSets.flat());
  const optionConceptSignatures = optionConceptTokenSets
    .map((tokens) => optionConceptSignatureFromTokens(tokens))
    .filter(Boolean);
  const promptDistinctiveTokens = distinctiveKeywordTokens(promptTokens);
  const answerDistinctiveTokens = distinctiveKeywordTokens(answerTokens);
  const optionDistinctiveTokens = unique(optionTokenSets.flatMap((tokens) => distinctiveKeywordTokens(tokens)));
  const distinctiveOptionConcepts = unique(
    optionConceptTokenSets.flatMap((tokens) => distinctiveKeywordTokens(tokens)),
  );
  const keywordTokens = unique([...promptTokens, ...answerTokens, ...optionTokens]);
  const promptNumericSignals = extractNumericSignalsFromNormalized(normalizedPrompt);
  const answerNumericSignals = extractNumericSignalsFromNormalized(normalizedCorrectAnswer);
  const optionNumericSignals = normalizedOptions.map((option) => extractNumericSignalsFromNormalized(option));
  const optionSetSignature = optionPhraseSignature(normalizedOptions);
  const numericTokens = unique([
    ...promptNumericSignals.tokens,
    ...answerNumericSignals.tokens,
    ...optionNumericSignals.flatMap((signal) => signal.tokens),
  ]);
  const numericValues = unique([
    ...promptNumericSignals.values,
    ...answerNumericSignals.values,
    ...optionNumericSignals.flatMap((signal) => signal.values),
  ]);

  return {
    normalizedPrompt,
    normalizedCorrectAnswer,
    normalizedOptions,
    promptAllTokens,
    answerAllTokens,
    optionAllTokenSets,
    promptTokens,
    answerTokens,
    promptPhraseTokens,
    answerPhraseTokens,
    optionTokens,
    optionTokenSets,
    optionPhraseTokens,
    optionPhraseTokenSets,
    optionConceptTokens,
    optionConceptTokenSets,
    optionConceptSignatures,
    promptDistinctiveTokens,
    answerDistinctiveTokens,
    optionDistinctiveTokens,
    distinctiveOptionConcepts,
    keywordTokens,
    rareKeywords: distinctiveKeywordTokens(keywordTokens),
    optionSetSignature,
    alignedOptionSetSignature: optionSetSignature,
    optionConceptSetSignature: optionConceptSetSignature(optionConceptTokenSets),
    numericSignals: {
      tokens: numericTokens,
      values: numericValues,
    },
    promptNumericSignals,
    answerNumericSignals,
    optionNumericSignals,
    topic: topic ?? null,
    subtopics: unique(toList(subtopics).filter(Boolean)),
    hasImage: hasImage === true,
  };
}

function selectRareKeywords(tokens, idfMap, maxCount = 8) {
  const ranked = unique(tokens)
    .map((token) => ({
      token,
      weight: Number(idfMap?.get(token) ?? 1),
    }))
    .sort((left, right) => right.weight - left.weight || right.token.length - left.token.length);

  const strong = ranked.filter(({ token, weight }) => weight >= 1.65 || token.includes("-") || /\d/.test(token));
  const pool = strong.length > 0 ? strong : ranked.filter(({ weight }) => weight >= 1.2);
  return pool.slice(0, maxCount).map(({ token }) => token);
}

function plainJaccard(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);

  if (!left.size || !right.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / new Set([...left, ...right]).size;
}

function weightedKeywordOverlap(leftTokens, rightTokens, idfMap, { bothMissing = 0.5, missingOne = 0.15 } = {}) {
  const left = unique(leftTokens);
  const right = unique(rightTokens);

  if (left.length === 0 && right.length === 0) {
    return bothMissing;
  }

  if (left.length === 0 || right.length === 0) {
    return missingOne;
  }

  return weightedJaccard(left, right, idfMap);
}

function scoreNumericSignalAlignment(leftSignals, rightSignals) {
  const leftTokens = unique(leftSignals?.tokens ?? []);
  const rightTokens = unique(rightSignals?.tokens ?? []);
  const leftValues = unique(leftSignals?.values ?? []);
  const rightValues = unique(rightSignals?.values ?? []);

  if (leftTokens.length === 0 && rightTokens.length === 0) {
    return {
      score: 0.5,
      exactOverlap: 0,
      valueOverlap: 0,
      conflict: false,
      available: false,
    };
  }

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return {
      score: 0.2,
      exactOverlap: 0,
      valueOverlap: 0,
      conflict: false,
      available: true,
    };
  }

  const exactOverlap = plainJaccard(leftTokens, rightTokens);
  const valueOverlap = plainJaccard(leftValues, rightValues);
  const conflict = exactOverlap === 0 && valueOverlap === 0;

  return {
    score: conflict ? 0 : Math.min(1, (exactOverlap * 0.7) + (valueOverlap * 0.3) + (exactOverlap > 0 ? 0.15 : 0)),
    exactOverlap,
    valueOverlap,
    conflict,
    available: true,
  };
}

function contradictionPenaltyForTokenSets(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const signals = [];
  let penalty = 0;

  for (const rule of MCQ_CONTRADICTION_RULES) {
    const leftHasLeft = rule.left.some((token) => left.has(token));
    const leftHasRight = rule.right.some((token) => left.has(token));
    const rightHasLeft = rule.left.some((token) => right.has(token));
    const rightHasRight = rule.right.some((token) => right.has(token));
    const contradicted =
      (leftHasLeft && rightHasRight && !leftHasRight && !rightHasLeft) ||
      (leftHasRight && rightHasLeft && !leftHasLeft && !rightHasRight);

    if (contradicted) {
      penalty += rule.weight;
      pushUniqueSignal(signals, rule.label);
    }
  }

  return {
    penalty: Math.min(1, penalty),
    signals,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value ?? 0)));
}

function compareMcqTextPair(leftText, rightText, corpus) {
  const leftNormalized = semanticNormalizeText(leftText);
  const rightNormalized = semanticNormalizeText(rightText);

  if (!leftNormalized || !rightNormalized) {
    return {
      score: 0,
      semantic: 0,
      rare: 0,
      exact: 0,
      numberScore: 0.5,
      contradictionPenalty: 0,
      contradictionSignals: [],
    };
  }

  const semantic = textSimilarity(leftNormalized, rightNormalized);
  const rare = weightedKeywordOverlap(
    keywordTokensFromNormalized(leftNormalized),
    keywordTokensFromNormalized(rightNormalized),
    corpus.mcqTokenIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const phraseScore = weightedKeywordOverlap(
    keywordPhraseTokensFromNormalized(leftNormalized),
    keywordPhraseTokensFromNormalized(rightNormalized),
    corpus.mcqPhraseIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const exact = phraseExactness(leftNormalized, rightNormalized);
  const number = scoreNumericSignalAlignment(
    extractNumericSignalsFromNormalized(leftNormalized),
    extractNumericSignalsFromNormalized(rightNormalized),
  );
  const contradiction = contradictionPenaltyForTokenSets(
    semanticTextTokens(leftNormalized),
    semanticTextTokens(rightNormalized),
  );

  return {
    score: clamp01(
      (semantic * 0.3) +
      (rare * 0.22) +
      (phraseScore * 0.2) +
      (exact * 0.12) +
      (number.score * 0.16) -
      (contradiction.penalty * 0.55) -
      ((number.conflict ? 1 : 0) * 0.18),
    ),
    semantic,
    rare,
    phraseScore,
    exact,
    numberScore: number.score,
    numberConflict: number.conflict ? 1 : 0,
    contradictionPenalty: contradiction.penalty,
    contradictionSignals: contradiction.signals,
  };
}

function compareMcqOptionSets(sourceFingerprint, candidateFingerprint, corpus) {
  const sourceOptions = toList(sourceFingerprint?.normalizedOptions);
  const candidateOptions = toList(candidateFingerprint?.normalizedOptions);
  const left = sourceOptions.length <= candidateOptions.length ? sourceOptions : candidateOptions;
  const right = sourceOptions.length <= candidateOptions.length ? candidateOptions : sourceOptions;
  const sourceConceptSets = toList(sourceFingerprint?.optionConceptTokenSets);
  const candidateConceptSets = toList(candidateFingerprint?.optionConceptTokenSets);
  const conceptLeft = sourceConceptSets.length <= candidateConceptSets.length ? sourceConceptSets : candidateConceptSets;
  const conceptRight = sourceConceptSets.length <= candidateConceptSets.length ? candidateConceptSets : sourceConceptSets;

  if (left.length === 0 || right.length === 0) {
    return {
      score: 0.2,
      alignedSimilarity: 0,
      exactCoverage: 0,
      conceptPairingScore: 0,
      conceptTokenOverlap: 0,
      conceptSignatureOverlap: 0,
      conceptExactSet: 0,
      dominantConceptCoverage: 0,
      optionSignatureScore: 0,
      rareKeywordOverlap: 0,
      numberScore: 0.5,
      contradictionPenalty: 0,
      contradictionSignals: [],
      available: false,
    };
  }

  const targetSize = Math.max(left.length, right.length);
  const matrix = left.map((leftOption) =>
    right.map((rightOption) => compareMcqTextPair(leftOption, rightOption, corpus)),
  );
  const conceptMatrix = conceptLeft.map((leftTokens) =>
    conceptRight.map((rightTokens) => weightedKeywordOverlap(
      leftTokens,
      rightTokens,
      corpus.mcqTokenIdf,
      { bothMissing: 0, missingOne: 0 },
    )),
  );

  let best = {
    total: -1,
    pairs: [],
  };
  let bestConcept = {
    total: -1,
    pairs: [],
  };

  function walk(leftIndex, used, total, pairs) {
    if (leftIndex >= left.length) {
      if (total > best.total) {
        best = { total, pairs: [...pairs] };
      }
      return;
    }

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (used.has(rightIndex)) {
        continue;
      }
      used.add(rightIndex);
      pairs.push(matrix[leftIndex][rightIndex]);
      walk(leftIndex + 1, used, total + matrix[leftIndex][rightIndex].score, pairs);
      pairs.pop();
      used.delete(rightIndex);
    }
  }

  walk(0, new Set(), 0, []);

  function walkConcept(leftIndex, used, total, pairs) {
    if (leftIndex >= conceptLeft.length) {
      if (total > bestConcept.total) {
        bestConcept = { total, pairs: [...pairs] };
      }
      return;
    }

    for (let rightIndex = 0; rightIndex < conceptRight.length; rightIndex += 1) {
      if (used.has(rightIndex)) {
        continue;
      }
      used.add(rightIndex);
      pairs.push(conceptMatrix[leftIndex][rightIndex]);
      walkConcept(leftIndex + 1, used, total + conceptMatrix[leftIndex][rightIndex], pairs);
      pairs.pop();
      used.delete(rightIndex);
    }
  }

  walkConcept(0, new Set(), 0, []);

  const alignedSimilarity = best.total <= 0 ? 0 : best.total / targetSize;
  const conceptPairingScore = bestConcept.total <= 0 ? 0 : bestConcept.total / targetSize;
  const exactCoverage = average(best.pairs.map((pair) => pair.exact));
  const alignedKeywordScore = average(best.pairs.map((pair) => Math.max(pair.rare, pair.phraseScore ?? 0)));
  const rareKeywordOverlap = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionTokens, corpus.mcqTokenIdf, 10),
    selectRareKeywords(candidateFingerprint.optionTokens, corpus.mcqTokenIdf, 10),
    corpus.mcqTokenIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const optionPhraseScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionPhraseTokens, corpus.mcqPhraseIdf, 10),
    selectRareKeywords(candidateFingerprint.optionPhraseTokens, corpus.mcqPhraseIdf, 10),
    corpus.mcqPhraseIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const distinctiveOptionScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionDistinctiveTokens, corpus.mcqTokenIdf, 10),
    selectRareKeywords(candidateFingerprint.optionDistinctiveTokens, corpus.mcqTokenIdf, 10),
    corpus.mcqTokenIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const conceptTokenOverlap = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionConceptTokens, corpus.mcqTokenIdf, 12),
    selectRareKeywords(candidateFingerprint.optionConceptTokens, corpus.mcqTokenIdf, 12),
    corpus.mcqTokenIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const conceptSignatureOverlap = plainJaccard(
    sourceFingerprint.optionConceptSignatures,
    candidateFingerprint.optionConceptSignatures,
  );
  const conceptExactSet =
    sourceFingerprint.optionConceptSetSignature === candidateFingerprint.optionConceptSetSignature
      ? 1
      : conceptSignatureOverlap;
  const dominantConceptCoverage = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.distinctiveOptionConcepts, corpus.mcqTokenIdf, 10),
    selectRareKeywords(candidateFingerprint.distinctiveOptionConcepts, corpus.mcqTokenIdf, 10),
    corpus.mcqTokenIdf,
    { bothMissing: 0, missingOne: 0 },
  );
  const numberScore = average(best.pairs.map((pair) => pair.numberScore));
  const numberConflictShare = average(best.pairs.map((pair) => pair.numberConflict ?? 0));
  const contradictionPenalty = average(best.pairs.map((pair) => pair.contradictionPenalty));
  const contradictionSignals = unique(best.pairs.flatMap((pair) => pair.contradictionSignals));
  const optionSignatureScore = clamp01(
    (conceptPairingScore * 0.3) +
    (conceptTokenOverlap * 0.18) +
    (conceptExactSet * 0.18) +
    (dominantConceptCoverage * 0.12) +
    (alignedSimilarity * 0.12) +
    (exactCoverage * 0.05) +
    (optionPhraseScore * 0.05) -
    (contradictionPenalty * 0.28) -
    (numberConflictShare * 0.1),
  );

  return {
    score: clamp01(
      Math.max(
        optionSignatureScore,
        alignedSimilarity,
        (alignedSimilarity * 0.6) +
          (exactCoverage * 0.07) +
          (conceptPairingScore * 0.12) +
          (conceptTokenOverlap * 0.1) +
          (conceptExactSet * 0.1) +
          (dominantConceptCoverage * 0.08) +
          (rareKeywordOverlap * 0.08) +
          (optionPhraseScore * 0.1) +
          (distinctiveOptionScore * 0.07) +
          (alignedKeywordScore * 0.06) +
          (numberScore * 0.08) -
          (contradictionPenalty * 0.3) -
          (numberConflictShare * 0.14),
      ),
    ),
    alignedSimilarity,
    exactCoverage,
    alignedKeywordScore,
    conceptPairingScore,
    conceptTokenOverlap,
    conceptSignatureOverlap,
    conceptExactSet,
    dominantConceptCoverage,
    optionSignatureScore,
    rareKeywordOverlap,
    optionPhraseScore,
    distinctiveOptionScore,
    numberScore,
    numberConflictShare,
    contradictionPenalty,
    contradictionSignals,
    available: true,
  };
}

function compareMcqAnswerFingerprints(sourceFingerprint, candidateFingerprint, corpus) {
  const left = sourceFingerprint?.normalizedCorrectAnswer ?? "";
  const right = candidateFingerprint?.normalizedCorrectAnswer ?? "";

  if (!left || !right) {
    return {
      score: 0.5,
      rareKeywordScore: 0.5,
      numberScore: 0.5,
      contradictionPenalty: 0,
      contradictionSignals: [],
      available: false,
    };
  }

  const semantic = textSimilarity(left, right);
  const rareKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerTokens, corpus.mcqTokenIdf, 6),
    selectRareKeywords(candidateFingerprint.answerTokens, corpus.mcqTokenIdf, 6),
    corpus.mcqTokenIdf,
    { bothMissing: 0.5, missingOne: 0.2 },
  );
  const phraseScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerPhraseTokens, corpus.mcqPhraseIdf, 6),
    selectRareKeywords(candidateFingerprint.answerPhraseTokens, corpus.mcqPhraseIdf, 6),
    corpus.mcqPhraseIdf,
    { bothMissing: 0.5, missingOne: 0.2 },
  );
  const distinctiveAnswerScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerDistinctiveTokens, corpus.mcqTokenIdf, 6),
    selectRareKeywords(candidateFingerprint.answerDistinctiveTokens, corpus.mcqTokenIdf, 6),
    corpus.mcqTokenIdf,
    { bothMissing: 0.5, missingOne: 0.2 },
  );
  const exact = phraseExactness(left, right);
  const number = scoreNumericSignalAlignment(
    sourceFingerprint.answerNumericSignals,
    candidateFingerprint.answerNumericSignals,
  );
  const contradiction = contradictionPenaltyForTokenSets(
    sourceFingerprint.answerAllTokens,
    candidateFingerprint.answerAllTokens,
  );

  return {
    score: clamp01(
      (semantic * 0.34) +
      (rareKeywordScore * 0.14) +
      (phraseScore * 0.18) +
      (distinctiveAnswerScore * 0.12) +
      (exact * 0.12) +
      (number.score * 0.1) -
      (contradiction.penalty * 0.7) -
      ((number.conflict ? 1 : 0) * 0.16),
    ),
    rareKeywordScore,
    phraseScore,
    distinctiveAnswerScore,
    numberScore: number.score,
    numberConflict: number.conflict ? 1 : 0,
    contradictionPenalty: contradiction.penalty,
    contradictionSignals: contradiction.signals,
    available: true,
  };
}

function scoreMcqKeywordOverlap(sourceFingerprint, candidateFingerprint, corpus) {
  const promptKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.promptTokens, corpus.mcqTokenIdf, 8),
    selectRareKeywords(candidateFingerprint.promptTokens, corpus.mcqTokenIdf, 8),
    corpus.mcqTokenIdf,
  );
  const promptPhraseScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.promptPhraseTokens, corpus.mcqPhraseIdf, 6),
    selectRareKeywords(candidateFingerprint.promptPhraseTokens, corpus.mcqPhraseIdf, 6),
    corpus.mcqPhraseIdf,
  );
  const answerKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerTokens, corpus.mcqTokenIdf, 6),
    selectRareKeywords(candidateFingerprint.answerTokens, corpus.mcqTokenIdf, 6),
    corpus.mcqTokenIdf,
  );
  const answerPhraseScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerPhraseTokens, corpus.mcqPhraseIdf, 6),
    selectRareKeywords(candidateFingerprint.answerPhraseTokens, corpus.mcqPhraseIdf, 6),
    corpus.mcqPhraseIdf,
  );
  const distinctiveAnswerScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.answerDistinctiveTokens, corpus.mcqTokenIdf, 6),
    selectRareKeywords(candidateFingerprint.answerDistinctiveTokens, corpus.mcqTokenIdf, 6),
    corpus.mcqTokenIdf,
  );
  const optionKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionTokens, corpus.mcqTokenIdf, 12),
    selectRareKeywords(candidateFingerprint.optionTokens, corpus.mcqTokenIdf, 12),
    corpus.mcqTokenIdf,
  );
  const optionPhraseScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionPhraseTokens, corpus.mcqPhraseIdf, 10),
    selectRareKeywords(candidateFingerprint.optionPhraseTokens, corpus.mcqPhraseIdf, 10),
    corpus.mcqPhraseIdf,
  );
  const distinctiveOptionScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionDistinctiveTokens, corpus.mcqTokenIdf, 10),
    selectRareKeywords(candidateFingerprint.optionDistinctiveTokens, corpus.mcqTokenIdf, 10),
    corpus.mcqTokenIdf,
  );
  const optionConceptKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.optionConceptTokens, corpus.mcqTokenIdf, 10),
    selectRareKeywords(candidateFingerprint.optionConceptTokens, corpus.mcqTokenIdf, 10),
    corpus.mcqTokenIdf,
  );
  const optionConceptDistinctiveScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.distinctiveOptionConcepts, corpus.mcqTokenIdf, 8),
    selectRareKeywords(candidateFingerprint.distinctiveOptionConcepts, corpus.mcqTokenIdf, 8),
    corpus.mcqTokenIdf,
  );
  const rareKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceFingerprint.keywordTokens, corpus.mcqTokenIdf, 12),
    selectRareKeywords(candidateFingerprint.keywordTokens, corpus.mcqTokenIdf, 12),
    corpus.mcqTokenIdf,
  );
  const answerSignalScore = clamp01(
    (answerKeywordScore * 0.42) +
    (answerPhraseScore * 0.34) +
    (distinctiveAnswerScore * 0.24),
  );
  const optionSignalScore = clamp01(
    (optionKeywordScore * 0.26) +
    (optionPhraseScore * 0.3) +
    (distinctiveOptionScore * 0.16) +
    (optionConceptKeywordScore * 0.16) +
    (optionConceptDistinctiveScore * 0.12),
  );
  const promptSignalScore = clamp01((promptKeywordScore * 0.6) + (promptPhraseScore * 0.4));

  return {
    score: clamp01(
      (answerSignalScore * 0.36) +
      (optionSignalScore * 0.4) +
      (rareKeywordScore * 0.14) +
      (promptSignalScore * 0.1),
    ),
    promptKeywordScore,
    promptPhraseScore,
    promptSignalScore,
    answerKeywordScore,
    answerPhraseScore,
    distinctiveAnswerScore,
    answerSignalScore,
    optionKeywordScore,
    optionPhraseScore,
    distinctiveOptionScore,
    optionConceptKeywordScore,
    optionConceptDistinctiveScore,
    optionSignalScore,
    rareKeywordScore,
  };
}

function scoreMcqPrior(sourceMetadata, question, structural, imageScore, topicScore) {
  let bonus = 0;

  if ((sourceMetadata?.provisionalTopic ?? null) && topicScore >= 0.75) {
    bonus += 0.5;
  } else if ((sourceMetadata?.provisionalTopic ?? null) && topicScore >= 0.55) {
    bonus += 0.2;
  }

  if (question.image.hasImage === true && sourceMetadata?.hasImage === true && imageScore >= 1) {
    bonus += 0.18;
  }

  if ((structural?.promptFamilyAgreement ?? 0.5) >= 0.9) {
    bonus += 0.12;
  }

  return clamp01(bonus);
}

function scoreMcqStageAShortlist(sourceMetadata, question, corpus) {
  const sourceFingerprint = sourceMetadata?.mcqFingerprint ?? null;
  const candidateFingerprint = question?.mcqFingerprint ?? null;

  if (!sourceFingerprint || !candidateFingerprint) {
    return {
      score: 0,
      breakdown: null,
    };
  }

  const keyword = scoreMcqKeywordOverlap(sourceFingerprint, candidateFingerprint, corpus);
  const answer = compareMcqAnswerFingerprints(sourceFingerprint, candidateFingerprint, corpus);
  const number = scoreNumericSignalAlignment(sourceFingerprint.numericSignals, candidateFingerprint.numericSignals);
  const visual = scoreSourceVisualEvidence(sourceMetadata, question);
  const topicPrior = scoreMcqPrior(
    sourceMetadata,
    question,
    { promptFamilyAgreement: scorePromptFamilyAgreement(sourceMetadata, question) },
      sourceMetadata?.hasImage === question.image.hasImage ? 1 : 0,
      scoreSourceTopicAgreement(sourceMetadata, question),
  );
  const answerPrimary = Math.max(answer.score, keyword.answerSignalScore, keyword.answerPhraseScore);
  const optionPrimary = Math.max(
    keyword.optionSignalScore,
    keyword.optionKeywordScore,
    keyword.optionPhraseScore,
    keyword.distinctiveOptionScore,
  );
  const contradictionPenalty = Math.min(
    1,
    (answer.contradictionPenalty * 0.75) +
    ((number.conflict ? 1 : 0) * 0.15) +
    ((visual.available ? visual.contradictionPenalty : 0) * 0.1),
  );
  const visualPrimary = Math.max(visual.score, visual.objectScore ?? 0, visual.numberScore ?? 0);
  const visualEnabled = visual.available === true;

  return {
    score: clamp01(
      (
        visualEnabled
          ? (
            (visualPrimary * 0.46) +
            (answerPrimary * 0.24) +
            (optionPrimary * 0.14) +
            (number.score * 0.06) +
            (topicPrior * 0.04) +
            ((visual.colorScore ?? 0) * 0.03) +
            ((visual.layoutScore ?? 0) * 0.03)
          )
          : (
            (answerPrimary * 0.42) +
            (optionPrimary * 0.34) +
            (number.score * 0.12) +
            (topicPrior * 0.08) +
            (keyword.promptSignalScore * 0.04)
          )
      ) -
      (contradictionPenalty * 0.2),
    ),
    breakdown: {
      visualScore: round(visualPrimary),
      visualObjectScore: round(visual.objectScore ?? 0),
      visualColorScore: round(visual.colorScore ?? 0),
      visualNumberScore: round(visual.numberScore ?? 0),
      visualLayoutScore: round(visual.layoutScore ?? 0),
      answerScore: round(answerPrimary),
      answerKeywordScore: round(keyword.answerSignalScore),
      optionKeywordScore: round(optionPrimary),
      promptScore: round(keyword.promptSignalScore),
      rareKeywordScore: round(keyword.rareKeywordScore),
      numberScore: round(number.score),
      priorBonus: round(topicPrior),
      contradictionPenalty: round(contradictionPenalty),
    },
  };
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
  const mcqTokenDf = new Map();
  const mcqPhraseDf = new Map();
  const featureKeywordDf = new Map();
  const imageTagDf = new Map();

  for (const question of matchIndex.questions) {
    const featureKeywords = new Set([
      ...toList(question.normalizedFeatures?.masterKeywords),
      ...toList(question.normalizedFeatures?.conceptKeywords),
      ...Object.values(question.translations ?? {}).flatMap((translation) => [
        ...toList(translation?.keywords),
        ...toList(translation?.conceptKeywords),
      ]),
    ]);

    for (const keyword of featureKeywords) {
      incrementCounter(featureKeywordDf, keyword);
    }

    for (const tag of new Set(question.normalizedFeatures?.imageTags ?? [])) {
      incrementCounter(imageTagDf, tag);
    }

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

    for (const token of new Set(question.mcqFingerprint?.keywordTokens ?? [])) {
      incrementCounter(mcqTokenDf, token);
    }

    for (const phrase of new Set([
      ...(question.mcqFingerprint?.promptPhraseTokens ?? []),
      ...(question.mcqFingerprint?.answerPhraseTokens ?? []),
      ...(question.mcqFingerprint?.optionPhraseTokens ?? []),
    ])) {
      incrementCounter(mcqPhraseDf, phrase);
    }
  }

  const totalMcq = matchIndex.questions.filter((question) => question.type === "MCQ").length || 1;
  const optionTokenIdf = new Map([...tokenDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const optionPhraseIdf = new Map([...phraseDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const optionSetIdf = new Map([...setDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const mcqTokenIdf = new Map([...mcqTokenDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const mcqPhraseIdf = new Map([...mcqPhraseDf.entries()].map(([key, df]) => [key, idfFromDf(totalMcq, df)]));
  const totalQuestions = matchIndex.questions.length || 1;
  const featureKeywordIdf = new Map([...featureKeywordDf.entries()].map(([key, df]) => [key, idfFromDf(totalQuestions, df)]));
  const imageTagIdf = new Map([...imageTagDf.entries()].map(([key, df]) => [key, idfFromDf(totalQuestions, df)]));

  return {
    totalMcq,
    totalQuestions,
    optionTokenIdf,
    optionPhraseIdf,
    optionSetIdf,
    mcqTokenIdf,
    mcqPhraseIdf,
    featureKeywordIdf,
    imageTagIdf,
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

function normalizeImageTagList(value) {
  return unique(toList(value).map((entry) => normalizeWhitespace(entry).toLowerCase()).filter(Boolean));
}

function normalizeDominantByAsset(value) {
  return toList(value)
    .map((entry) => ({
      assetSrc: normalizeWhitespace(entry?.assetSrc) || null,
      colors: toList(entry?.colors)
        .map((colorEntry) => ({
          color: normalizeWhitespace(colorEntry?.color).toLowerCase(),
          overallShare: Number.isFinite(Number(colorEntry?.overallShare)) ? Number(colorEntry.overallShare) : null,
          chromaticShare: Number.isFinite(Number(colorEntry?.chromaticShare)) ? Number(colorEntry.chromaticShare) : null,
        }))
        .filter((colorEntry) => colorEntry.color),
    }))
    .filter((entry) => entry.assetSrc || entry.colors.length > 0);
}

function dominantColorTagsFromMetadata(dominantByAsset) {
  const scored = new Map();

  for (const asset of normalizeDominantByAsset(dominantByAsset)) {
    for (const color of asset.colors) {
      const share = Math.max(
        Number(color.overallShare ?? 0),
        Number(color.chromaticShare ?? 0) * 0.75,
      );
      if (share >= 0.18) {
        scored.set(color.color, Math.max(scored.get(color.color) ?? 0, share));
      }
    }
  }

  return [...scored.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([color]) => color);
}

function matchIndexQuestion(question, rawQuestion, translationEntry, patchTags, imageTagEntry, dataset, referenceLang) {
  const type = normalizeQuestionType(question.type);
  const translatedOptions = optionTranslationMap(translationEntry);
  const tagSignals = tagSignalsForQuestion(question, patchTags);
  const assets = toList(question.assets).map((asset) => referencedAssetRecord(asset, dataset));
  const imageColorTags = normalizeImageTagList(imageTagEntry?.colorTags);
  const imageObjectTags = normalizeImageTagList(imageTagEntry?.objectTags);
  const dominantByAsset = normalizeDominantByAsset(imageTagEntry?.dominantByAsset);
  const dominantColorTags = dominantColorTagsFromMetadata(dominantByAsset);
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
  const mcqFingerprint = type === "MCQ"
    ? buildMcqFingerprint({
      prompt: sourcePrompt || prompt,
      correctAnswer:
        correctAnswer.correctOptionText ??
        correctAnswer.correctOptionTranslatedText ??
        correctAnswer.correctOptionKey ??
        "",
      options: options.map((option) => option.sourceText || option.text),
      topic: tagSignals.truthTopic ?? tagSignals.weightedTopic ?? null,
      subtopics: unique([...tagSignals.truthSubtopics, ...tagSignals.weightedSubtopics]),
      hasImage: assets.length > 0,
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
      colorTags: imageColorTags,
      dominantColorTags,
      objectTags: imageObjectTags,
      dominantByAsset,
      assets,
    },
    genericPrompt: {
      isGeneric: syntheticJa.genericPrompt,
      family: syntheticJa.genericPromptFamily,
    },
    syntheticJa,
    mcqFingerprint,
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
      translationLocale: translationEntry ? normalizeLang(referenceLang) : null,
      questionsPath: `/public/qbank/${dataset}/questions.json`,
      rawQuestionsPath: `/public/qbank/${dataset}/questions.raw.json`,
      tagsPatchPath: `/public/qbank/${dataset}/tags.patch.json`,
      translationPath: translationEntry ? `/public/qbank/${dataset}/translations.${normalizeLang(referenceLang)}.json` : null,
    },
  };
}

export function loadQbankContext({ dataset = DEFAULT_DATASET, referenceLang = DEFAULT_REFERENCE_LANG } = {}) {
  const paths = getDatasetPaths(dataset, referenceLang);
  const questionsDoc = readJson(paths.questionsPath);
  const rawQuestionsDoc = readJson(paths.rawQuestionsPath);
  const tagsPatch = readJson(paths.tagsPatchPath);
  const imageTagDoc = fileExists(paths.imageColorTagsPath)
    ? readJson(paths.imageColorTagsPath)
    : { questions: {} };
  const translationDoc = fileExists(paths.translationPath)
    ? readJson(paths.translationPath)
    : { meta: { locale: referenceLang }, questions: {} };

  const questions = toList(questionsDoc?.questions);
  const rawQuestions = new Map(toList(rawQuestionsDoc?.questions).map((question) => [question.id, question]));
  const translations = translationDoc?.questions && typeof translationDoc.questions === "object"
    ? translationDoc.questions
    : {};
  const imageTags = imageTagDoc?.questions && typeof imageTagDoc.questions === "object"
    ? imageTagDoc.questions
    : {};

  const matchQuestions = questions.map((question) =>
    matchIndexQuestion(
      question,
      rawQuestions.get(question.id),
      translations[question.id],
      tagsPatch[question.id],
      imageTags[question.id],
      dataset,
      referenceLang,
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

function listDatasetTranslationDocs(dataset = DEFAULT_DATASET) {
  const datasetPaths = getDatasetPaths(dataset);
  const docs = new Map();

  if (!fileExists(datasetPaths.datasetDir)) {
    return docs;
  }

  for (const entry of fs.readdirSync(datasetPaths.datasetDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const match = entry.name.match(/^translations\.([a-z0-9-]+)\.json$/i);
    if (!match?.[1]) {
      continue;
    }

    const lang = normalizeLang(match[1]);
    const filePath = path.join(datasetPaths.datasetDir, entry.name);
    const doc = readJson(filePath);
    docs.set(lang, {
      lang,
      path: filePath,
      meta: doc?.meta ?? null,
      questions:
        doc?.questions && typeof doc.questions === "object"
          ? doc.questions
          : {},
    });
  }

  return docs;
}

function normalizedFeatureQuestionType(type) {
  return normalizeQuestionType(type) === "MCQ" ? "mcq" : "row";
}

function featureKeywordTokensFromTexts(texts) {
  const normalized = semanticNormalizeText(toList(texts).filter(Boolean).join(" "));
  const baseTokens = keywordTokensFromNormalized(normalized, FEATURE_KEYWORD_STOPWORDS)
    .filter((token) => !/^[_-]+$/.test(token));
  const prioritized = baseTokens.filter((token) =>
    FEATURE_DOMAIN_KEYWORDS.has(token) ||
    token.includes("-") ||
    /\d/.test(token) ||
    token.length >= 6,
  );

  return unique((prioritized.length > 0 ? prioritized : baseTokens).map((token) => token.toLowerCase()));
}

function featureTopicKeywords(question) {
  return unique(
    [
      question.tags.truthTopic,
      question.tags.weightedTopic,
      ...question.tags.truthSubtopics,
      ...question.tags.weightedSubtopics,
    ]
      .filter(Boolean)
      .flatMap((tag) => {
        const normalized = String(tag).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const tail = normalized.split("-").filter(Boolean).slice(-2).join("-");
        return [normalized, tail].filter(Boolean);
      }),
  );
}

function featureImageTagsForQuestion(question) {
  return unique([
    ...question.image.objectTags.map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
    ...question.image.colorTags.map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
    ...toList(question.image.dominantColorTags).map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
  ]);
}

function buildFeatureKeywordList(question) {
  const bundle = buildKeywordBundle({
    primaryTexts: [question.sourcePrompt || question.prompt],
    supportingTexts: [
      question.prompt,
      question.correctAnswer.correctOptionText,
      ...question.options.map((option) => option.sourceText || option.text),
    ],
    concepts: [
      ...(question.mcqFingerprint?.rareKeywords ?? []),
      ...(question.mcqFingerprint?.answerDistinctiveTokens ?? []),
      ...(question.mcqFingerprint?.optionDistinctiveTokens ?? []),
      ...(question.mcqFingerprint?.promptDistinctiveTokens ?? []),
      ...(question.reviewConceptSlots?.condition ?? []),
      ...(question.reviewConceptSlots?.context ?? []),
      ...(question.reviewConceptSlots?.action ?? []),
    ],
    imageTags: featureImageTagsForQuestion(question),
    topic: question.tags.truthTopic ?? question.tags.weightedTopic ?? null,
    subtopics: unique([...question.tags.truthSubtopics, ...question.tags.weightedSubtopics]),
  });

  return bundle;
}

function featureOptionEntries(question, translatedOptions = {}) {
  return question.options.map((option, index) => {
    const key = normalizeWhitespace(option.originalKey ?? String.fromCharCode(65 + index));
    const translatedText = normalizeWhitespace(translatedOptions[option.id] ?? "");

    return {
      id: option.id,
      key: key || option.id,
      text: normalizeWhitespace(option.sourceText || option.text),
      translatedText: translatedText || null,
    };
  });
}

function buildQuestionFeatureFields(question) {
  const keywordBundle = buildFeatureKeywordList(question);
  const optionEntries = featureOptionEntries(question);
  const optionKeywords = Object.fromEntries(
    optionEntries.map((option) => [
      option.key,
      featureKeywordTokensFromTexts([option.text]),
    ]),
  );

  return {
    masterGlossEn: question.sourcePrompt || question.prompt,
    masterKeywords: keywordBundle.keywords,
    conceptKeywords: keywordBundle.conceptKeywords,
    imageTags: featureImageTagsForQuestion(question),
    imageColorTags: question.image.colorTags.map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
    imageDominantColorTags: toList(question.image.dominantColorTags).map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
    imageObjectTags: question.image.objectTags.map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean),
    promptFamily: question.genericPrompt?.family ?? null,
    topic: question.tags.truthTopic ?? question.tags.weightedTopic ?? null,
    subtopics: unique([...question.tags.truthSubtopics, ...question.tags.weightedSubtopics]),
    optionSignature: {
      type: normalizedFeatureQuestionType(question.type),
      count: question.type === "ROW" ? Math.max(question.options.length, 2) : question.options.length,
      correctOptionKey: question.correctAnswer.correctOptionKey ?? null,
      correctRow: question.correctAnswer.correctRow ?? null,
      normalizedOptions: question.mcqFingerprint?.normalizedOptions ?? optionEntries.map((option) => semanticNormalizeText(option.text)),
      optionKeywords,
    },
  };
}

function buildFeatureTranslationEntry(question, lang, translationEntry, questionFeatures) {
  const translatedOptions = optionTranslationMap(translationEntry);
  const optionEntries = featureOptionEntries(question, translatedOptions)
    .filter((option) => option.translatedText)
    .map((option) => ({
      id: option.id,
      key: option.key,
      text: option.translatedText,
    }));
  const correctOptionText = question.correctAnswer.correctOptionId
    ? optionEntries.find((option) => option.id === question.correctAnswer.correctOptionId)?.text ?? null
    : null;
  const translationBridge = deriveTranslationFeatureBridge({
    lang,
    localizedPrompt: translationEntry?.prompt ?? "",
    localizedOptions: optionEntries.map((option) => option.text),
    masterPrompt: questionFeatures.masterGlossEn,
    questionType: normalizedFeatureQuestionType(question.type),
    promptFamily: questionFeatures.promptFamily,
    imageTags: questionFeatures.imageTags,
    storedPromptGlossEn: translationEntry?.promptGlossEn ?? null,
    providedOptionGlossesEn: translationEntry?.optionsGlossEn ?? [],
    optionMeaningMap: translationEntry?.optionMeaningMap ?? translationEntry?.localeOptionOrder ?? [],
    questionOptions: question.options.map((option, index) => ({
      id: option.id,
      key: normalizeWhitespace(option.originalKey ?? String.fromCharCode(65 + index)),
      text: normalizeWhitespace(option.sourceText || option.text),
    })),
    correctOptionId: question.correctAnswer.correctOptionId ?? null,
    correctOptionKey: question.correctAnswer.correctOptionKey ?? null,
    topic: questionFeatures.topic,
    subtopics: questionFeatures.subtopics,
  });

  return {
    lang,
    questionText: normalizeWhitespace(translationEntry?.prompt ?? ""),
    explanation: normalizeWhitespace(translationEntry?.explanation ?? ""),
    options: optionEntries,
    correctOptionKey: question.correctAnswer.correctOptionKey ?? null,
    correctOptionText,
    glossEn: translationBridge.glossEn,
    glossEnMode: translationBridge.glossEnMode,
    glossEnSource: translationBridge.glossEnSource,
    glossEnConfidence: translationBridge.glossEnConfidence,
    promptFamily: translationBridge.promptFamily,
    optionGlossesEn: translationBridge.optionGlossesEn,
    correctOptionGlossEn: translationBridge.correctOptionGlossEn,
    keywords: translationBridge.keywords,
    conceptKeywords: translationBridge.conceptKeywords,
    keywordSource: "localized-gloss-and-concepts",
    sourceMode: normalizeWhitespace(translationEntry?.sourceMode) || null,
    confidence: normalizeConfidenceLabel(translationEntry?.confidence) || normalizeWhitespace(translationEntry?.confidence) || null,
    reviewStatus: normalizeWhitespace(translationEntry?.reviewStatus) || null,
    flags: asTextList(translationEntry?.flags),
    notes: asTextList(translationEntry?.notes),
  };
}

function buildFeatureStoreEntry(question, translationDocsByLang) {
  const features = buildQuestionFeatureFields(question);
  const translations = {};

  for (const [lang, doc] of translationDocsByLang.entries()) {
    const translationEntry = doc.questions[question.qid];
    if (!translationEntry) {
      continue;
    }

    translations[lang] = buildFeatureTranslationEntry(question, lang, translationEntry, features);
  }

  return {
    qid: question.qid,
    number: question.number,
    master: {
      lang: "en",
      questionText: question.sourcePrompt || question.prompt,
      explanation: question.explanation ?? "",
      questionType: normalizedFeatureQuestionType(question.type),
      options: featureOptionEntries(question).map(({ id, key, text }) => ({ id, key, text })),
      correctOptionId: question.correctAnswer.correctOptionId ?? null,
      correctOptionKey: question.correctAnswer.correctOptionKey ?? null,
      correctRow: question.correctAnswer.correctRow ?? null,
      hasImage: question.image.hasImage,
    },
    features,
    translations,
  };
}

function normalizeFeatureStoreDoc(value, sourcePath = null) {
  const qids = Array.isArray(value?.qids)
    ? value.qids
        .map((entry) => ({
          qid: normalizeWhitespace(entry?.qid),
          number: Number(entry?.number ?? 0) || null,
          master: entry?.master && typeof entry.master === "object" ? entry.master : {},
          features: entry?.features && typeof entry.features === "object" ? entry.features : {},
          translations: entry?.translations && typeof entry.translations === "object" ? entry.translations : {},
        }))
        .filter((entry) => entry.qid)
    : [];

  return {
    featureSchemaVersion: Number(value?.featureSchemaVersion ?? CURRENT_FEATURE_SCHEMA_VERSION) || CURRENT_FEATURE_SCHEMA_VERSION,
    generatedAt: value?.generatedAt ?? null,
    dataset: value?.dataset ?? DEFAULT_DATASET,
    referenceLang: normalizeLang(value?.referenceLang ?? DEFAULT_REFERENCE_LANG),
    sourceOfTruth: value?.sourceOfTruth && typeof value.sourceOfTruth === "object" ? value.sourceOfTruth : {},
    stats: value?.stats && typeof value.stats === "object" ? value.stats : {},
    languages: unique(["en", ...toList(value?.languages).map((lang) => normalizeLang(lang))]),
    qids,
    sourcePath,
  };
}

export async function loadFeatureStoreFile(filePath) {
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.resolve(String(filePath));
  const raw = await fsp.readFile(resolvedPath, "utf8");
  return normalizeFeatureStoreDoc(JSON.parse(raw), resolvedPath);
}

export function buildQidFeatureStore(context, options = {}) {
  const dataset = String(options.dataset ?? context.dataset ?? DEFAULT_DATASET);
  const translationDocsByLang = listDatasetTranslationDocs(dataset);
  const qids = context.questions.map((question) => buildFeatureStoreEntry(question, translationDocsByLang));
  const translationCoverage = Object.fromEntries(
    [...translationDocsByLang.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([lang, doc]) => [lang, Object.keys(doc.questions).length]),
  );

  return {
    featureSchemaVersion: CURRENT_FEATURE_SCHEMA_VERSION,
    generatedAt: stableNow(),
    dataset,
    referenceLang: normalizeLang(context.referenceLang ?? DEFAULT_REFERENCE_LANG),
    languages: unique(["en", ...[...translationDocsByLang.keys()].sort()]),
    sourceOfTruth: {
      questions: path.relative(ROOT, context.paths.questionsPath),
      rawQuestions: path.relative(ROOT, context.paths.rawQuestionsPath),
      tagsPatch: path.relative(ROOT, context.paths.tagsPatchPath),
      imageColorTags: fileExists(context.paths.imageColorTagsPath)
        ? path.relative(ROOT, context.paths.imageColorTagsPath)
        : null,
      translations: Object.fromEntries(
        [...translationDocsByLang.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([lang, doc]) => [lang, path.relative(ROOT, doc.path)]),
      ),
    },
    stats: {
      questionCount: qids.length,
      rowCount: qids.filter((entry) => entry.master.questionType === "row").length,
      mcqCount: qids.filter((entry) => entry.master.questionType === "mcq").length,
      withImageCount: qids.filter((entry) => entry.master.hasImage).length,
      translationCoverage,
      glossCoverageByLang: Object.fromEntries(
        [...translationDocsByLang.keys()]
          .sort((left, right) => left.localeCompare(right))
          .map((lang) => [
            lang,
            qids.filter((entry) => normalizeWhitespace(entry.translations?.[lang]?.glossEn)).length,
          ]),
      ),
      glossModesByLang: Object.fromEntries(
        [...translationDocsByLang.keys()]
          .sort((left, right) => left.localeCompare(right))
          .map((lang) => {
            const counts = new Map();
            for (const entry of qids) {
              const mode = normalizeWhitespace(entry.translations?.[lang]?.glossEnMode);
              if (mode) {
                counts.set(mode, (counts.get(mode) ?? 0) + 1);
              }
            }

            return [lang, Object.fromEntries([...counts.entries()].sort((leftEntry, rightEntry) => leftEntry[0].localeCompare(rightEntry[0])))];
          }),
      ),
    },
    qids,
  };
}

function enrichQuestionWithFeatureStore(question, featureEntry, referenceLang) {
  const features = featureEntry?.features ?? buildQuestionFeatureFields(question);
  const translations = featureEntry?.translations ?? {};
  const preferredTranslation = translations[normalizeLang(referenceLang)] ?? null;
  const translatedOptionsById = new Map(
    toList(preferredTranslation?.options).map((option) => [option.id, option.text]),
  );
  const translatedCorrectText = question.correctAnswer.correctOptionId
    ? translatedOptionsById.get(question.correctAnswer.correctOptionId) ?? null
    : null;

  return {
    ...question,
    translatedPrompt: preferredTranslation?.questionText || question.translatedPrompt,
    translatedExplanation: preferredTranslation?.explanation || question.translatedExplanation,
    options: question.options.map((option) => ({
      ...option,
      translatedText: translatedOptionsById.get(option.id) ?? option.translatedText,
    })),
    correctAnswer: {
      ...question.correctAnswer,
      correctOptionTranslatedText: translatedCorrectText ?? question.correctAnswer.correctOptionTranslatedText,
    },
    normalizedFeatures: features,
    translations,
  };
}

export function buildMatchIndex(context, options = {}) {
  const normalizedFeatureStore = normalizeFeatureStoreDoc(
    options.featureStore ?? buildQidFeatureStore(context),
    options.featureStorePath ?? DEFAULT_FEATURE_STORE_PATH,
  );
  const featureByQid = new Map(normalizedFeatureStore.qids.map((entry) => [entry.qid, entry]));
  const questions = context.questions.map((question) =>
    enrichQuestionWithFeatureStore(question, featureByQid.get(question.qid), context.referenceLang));

  return {
    generatedAt: stableNow(),
    dataset: context.dataset,
    referenceLang: context.referenceLang,
    featureSchemaVersion: normalizedFeatureStore.featureSchemaVersion,
    featureStoreLanguages: normalizedFeatureStore.languages,
    sourceOfTruth: {
      questions: path.relative(ROOT, context.paths.questionsPath),
      rawQuestions: path.relative(ROOT, context.paths.rawQuestionsPath),
      tagsPatch: path.relative(ROOT, context.paths.tagsPatchPath),
      imageColorTags: fileExists(context.paths.imageColorTagsPath)
        ? path.relative(ROOT, context.paths.imageColorTagsPath)
        : null,
      referenceTranslations: fileExists(context.paths.translationPath)
        ? path.relative(ROOT, context.paths.translationPath)
        : null,
      featureStore: normalizedFeatureStore.sourcePath
        ? path.relative(ROOT, normalizedFeatureStore.sourcePath)
        : path.relative(ROOT, DEFAULT_FEATURE_STORE_PATH),
      translations: normalizedFeatureStore.sourceOfTruth?.translations ?? null,
    },
    stats: {
      ...context.stats,
      translationLanguages: normalizedFeatureStore.languages.filter((lang) => lang !== "en").length,
    },
    questions,
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
      visualObjectTags: normalizeImageTagList(item.visualObjectTags),
      visualColorTags: normalizeImageTagList(item.visualColorTags),
      visualNumberTags: unique(
        asTextList(item.visualNumberTags).map((entry) => normalizeWhitespace(entry)).filter((entry) => /^\d+(?:\.\d+)?$/.test(entry)),
      ),
      visualLayoutTags: unique(
        asTextList(item.visualLayoutTags).map((entry) => normalizeWhitespace(entry).toLowerCase()).filter(Boolean),
      ),
      visualEvidenceNotes: asTextList(item.visualEvidenceNotes),
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
    visualObjectTags: normalizeImageTagList(item.visualObjectTags),
    visualColorTags: normalizeImageTagList(item.visualColorTags),
    visualNumberTags: unique(toList(item.visualNumberTags).map((entry) => normalizeWhitespace(entry)).filter(Boolean)),
    visualLayoutTags: unique(toList(item.visualLayoutTags).map((entry) => normalizeWhitespace(entry).toLowerCase()).filter(Boolean)),
    visualEvidenceNotes: asTextList(item.visualEvidenceNotes),
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

function inferObligationStrength(value) {
  const normalized = semanticNormalizeText(value);

  if (!normalized) {
    return null;
  }

  if (
    /\b(?:must-not|cannot|illegal|prohibited|forbidden|not-allowed|no-entry|may-not)\b/.test(normalized) ||
    /\b(?:no-honk|no-overtake|no-parking|no-reverse)\b/.test(normalized)
  ) {
    return "prohibited";
  }

  if (/\b(?:must|shall|required)\b/.test(normalized)) {
    return "must";
  }

  if (/\b(?:should|ought|recommended)\b/.test(normalized)) {
    return "should";
  }

  if (/\b(?:may|can|allowed|permitted)\b/.test(normalized)) {
    return "may";
  }

  if (/\b(?:carefully|caution|watchfully|slowly)\b/.test(normalized)) {
    return "caution";
  }

  return null;
}

const ROW_SLOT_HINTS = {
  condition: [
    ["fog", "fog", "fog"],
    ["rain", "rain", "rain"],
    ["snow", "snow", "snow"],
    ["icy-road", "icy-road", "icy-road"],
    ["wind", "wind", "wind"],
    ["ice", "ice", "ice"],
    ["muddy-road", "mud", "muddy-road"],
    ["flooded-road", "flooded-road", "flooded-road"],
    ["visibility-low", "visibility-low", "visibility-low"],
    ["night", "night", "night"],
    ["uphill", "uphill", "uphill"],
    ["downhill", "downhill", "downhill"],
    ["reverse", "backing", "reverse"],
    ["tire-blowout", "tire-blowout", "tire-blowout"],
  ],
  context: [
    ["expressway", "expressway", "expressway"],
    ["ordinary-road", "ordinary-road", "ordinary-road"],
    ["intersection", "intersection", "intersection"],
    ["tunnel", "tunnel", "tunnel"],
    ["bridge", "bridge", "bridge"],
    ["curve", "curve", "curve"],
    ["narrow-road", "narrow-road", "narrow-road"],
    ["railroad-crossing", "railroad-crossing", "railroad-crossing"],
    ["crosswalk", "crosswalk", "crosswalk"],
    ["school-zone", "school-zone", "school-zone"],
    ["residential-area", "residential-area", "residential-area"],
    ["pedestrian", "pedestrian", "pedestrian"],
    ["bicycle", "bicycle", "bicycle"],
    ["bus-stop", "bus-stop", "bus-stop"],
    ["mountain", "mountain-road", "mountain"],
    ["mountain-road", "mountain-road", "mountain-road"],
    ["parking", "parking-area", "parking"],
    ["emergency-lane", "emergency-lane", "emergency-lane"],
    ["ramp", "ramp", "ramp"],
    ["traffic-light", "traffic-light", "traffic-light"],
  ],
  action: [
    ["honk", "honk", "honk"],
    ["no-honk", "no-honk", "no-honk"],
    ["yield", "yield", "yield"],
    ["stop", "stop", "stop"],
    ["stop-yield", "stop-yield", "stop-yield"],
    ["stop-yield", "yield", "stop-yield"],
    ["stop-and-wait", "stop", "stop-and-wait"],
    ["stop-and-wait", "stop-and-wait", "stop-and-wait"],
    ["reduce-speed", "reduce-speed", "reduce-speed"],
    ["reduce-speed", "slow", "reduce-speed"],
    ["slow", "slow", "slow"],
    ["proceed-carefully", "proceed-carefully", "proceed-carefully"],
    ["continue", "continue", "continue"],
    ["accelerate", "accelerate", "accelerate"],
    ["emergency-brake", "emergency-brake", "emergency-brake"],
    ["u-turn", "u-turn", "u-turn"],
    ["overtake", "pass", "overtake"],
    ["overtake", "overtake", "overtake"],
    ["no-overtake", "no-overtake", "no-overtake"],
    ["pass", "pass", "pass"],
    ["use-low-beam", "use-low-beam", "use-low-beam"],
    ["low-beam", "low-beam", "low-beam"],
    ["use-high-beam", "use-high-beam", "use-high-beam"],
    ["high-beam", "high-beam", "high-beam"],
    ["headlight", "head-light", "headlight"],
    ["turn-signal", "turn-signal", "turn-signal"],
    ["lane-change", "lane-change", "lane-change"],
    ["follow-tracks", "follow-tracks", "follow-tracks"],
    ["use-hazard-lights", "use-hazard-lights", "use-hazard-lights"],
    ["hazard-lights", "hazard-lights", "hazard-lights"],
    ["park", "park", "park"],
    ["no-parking", "no-parking", "no-parking"],
    ["parking-brake", "parking-brake", "parking-brake"],
    ["brake", "brake", "brake"],
    ["reverse", "reverse", "reverse"],
    ["no-reverse", "no-reverse", "no-reverse"],
    ["min-speed", "min-speed", "min-speed"],
    ["max-speed", "max-speed", "max-speed"],
  ],
};

function cloneRowConceptSlots(slots) {
  return {
    condition: [...toList(slots?.condition)],
    context: [...toList(slots?.context)],
    action: [...toList(slots?.action)],
    polarity: slots?.polarity ?? null,
    obligation: slots?.obligation ?? null,
    signals: [...toList(slots?.signals)],
  };
}

function augmentRowConceptSlots(slots, keywords = []) {
  const augmented = cloneRowConceptSlots(slots);
  const keywordSet = new Set(
    toList(keywords)
      .map((keyword) => normalizeWhitespace(keyword).toLowerCase())
      .filter(Boolean),
  );

  const add = (slot, value, signal) => {
    if (!augmented[slot].includes(value)) {
      augmented[slot].push(value);
    }

    if (!augmented.signals.some((entry) => entry?.slot === slot && entry?.value === value)) {
      augmented.signals.push({ slot, value, signal });
    }
  };

  for (const [keyword, value, signal] of ROW_SLOT_HINTS.condition) {
    if (keywordSet.has(keyword)) {
      add("condition", value, signal);
    }
  }

  for (const [keyword, value, signal] of ROW_SLOT_HINTS.context) {
    if (keywordSet.has(keyword)) {
      add("context", value, signal);
    }
  }

  for (const [keyword, value, signal] of ROW_SLOT_HINTS.action) {
    if (keywordSet.has(keyword)) {
      add("action", value, signal);
    }
  }

  if ((keywordSet.has("minimum") || keywordSet.has("min") || keywordSet.has("min-speed")) && keywordSet.has("speed")) {
    add("action", "min-speed", "minimum-speed");
  }

  if ((keywordSet.has("maximum") || keywordSet.has("max") || keywordSet.has("max-speed")) && keywordSet.has("speed")) {
    add("action", "max-speed", "maximum-speed");
  }

  if (!augmented.obligation) {
    if (
      keywordSet.has("must-not") ||
      keywordSet.has("no-honk") ||
      keywordSet.has("no-overtake") ||
      keywordSet.has("no-parking") ||
      keywordSet.has("no-reverse")
    ) {
      augmented.obligation = "prohibited";
    } else if (keywordSet.has("must")) {
      augmented.obligation = "must";
    } else if (keywordSet.has("should")) {
      augmented.obligation = "should";
    } else if (keywordSet.has("may")) {
      augmented.obligation = "may";
    } else if (keywordSet.has("proceed-carefully") || keywordSet.has("caution")) {
      augmented.obligation = "caution";
    }
  }

  if (!augmented.polarity) {
    augmented.polarity =
      augmented.obligation === "prohibited"
        ? "negative"
        : augmented.action.length > 0
          ? "positive"
          : null;
  }

  return augmented;
}

function extractRowConceptSlots({
  prompt = "",
  promptGloss = "",
  options = [],
  optionGlosses = [],
  promptPolarity = null,
} = {}) {
  const promptOnly = semanticNormalizeText([prompt, promptGloss].filter(Boolean).join(" "));
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
  const obligation = inferObligationStrength(promptOnly || combined);

  if (!combined) {
    return {
      condition,
      context,
      action,
      polarity: promptPolarity ?? null,
      obligation,
      signals,
    };
  }

  const add = (slot, bucket, value, signal) => {
    if (!bucket.includes(value)) {
      bucket.push(value);
    }

    signals.push({ slot, value, signal });
  };

  const addAction = (value, signal, aliases = []) => {
    add("action", action, value, signal);

    for (const alias of aliases) {
      add("action", action, alias, signal);
    }
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

  if (/\bicy road\b|\bicy\b|\bice-covered\b/.test(combined)) {
    add("condition", condition, "icy-road", "icy-road");
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

  if (/\btunnel\b/.test(combined)) {
    add("context", context, "tunnel", "tunnel");
  }

  if (/\bbridge\b/.test(combined)) {
    add("context", context, "bridge", "bridge");
  }

  if (/\bcrosswalk\b/.test(combined)) {
    add("context", context, "crosswalk", "crosswalk");
  }

  if (/\bschool zone\b|\bschool area\b/.test(combined)) {
    add("context", context, "school-zone", "school-zone");
  }

  if (/\bresidential area\b|\bresidential zone\b/.test(combined)) {
    add("context", context, "residential-area", "residential-area");
  }

  if (/\bpedestrian\b/.test(combined)) {
    add("context", context, "pedestrian", "pedestrian");
  }

  if (/\bbicycle\b|\bbike\b/.test(combined)) {
    add("context", context, "bicycle", "bicycle");
  }

  if (/\bbus stop\b/.test(combined)) {
    add("context", context, "bus-stop", "bus-stop");
  }

  if (/\brailroad crossing\b|\blevel crossing\b/.test(combined)) {
    add("context", context, "railroad-crossing", "railroad-crossing");
  }

  if (/\bcurve\b|\bsharp bend\b/.test(combined)) {
    add("context", context, "curve", "curve");
  }

  if (/\bnarrow road\b|\bnarrow lane\b/.test(combined)) {
    add("context", context, "narrow-road", "narrow-road");
  }

  if (/\bmountain road\b/.test(combined)) {
    add("context", context, "mountain-road", "mountain-road");
  }

  if (/\bexpressway\b/.test(combined)) {
    add("context", context, "expressway", "expressway");
  }

  if (/\bramp\b/.test(combined)) {
    add("context", context, "ramp", "ramp");
  }

  if (/\bdo not honk\b|\bno horn\b|\bhorn(?:ing)? prohibited\b/.test(combined)) {
    addAction("no-honk", "no-honk");
  } else if (/\bhonk\b|\bhorn\b/.test(combined)) {
    addAction("honk", "honk");
  }

  if (/\bstop and wait\b|\bcome to complete stop and wait\b/.test(combined)) {
    addAction("stop-and-wait", "stop-and-wait", ["stop"]);
  }

  if (/\bstop (?:to|and) yield\b|\bstop (?:to|and) give way\b/.test(combined)) {
    addAction("stop-yield", "stop-yield", ["stop", "yield"]);
  }

  if (/\byield\b|\bgive way\b/.test(combined)) {
    addAction("yield", "yield");
  }

  if (/\bstop\b/.test(combined)) {
    addAction("stop", "stop");
  }

  if (/\breduce speed\b|\bslow(?: down|ly)?\b/.test(combined)) {
    addAction("reduce-speed", "reduce-speed", ["slow"]);
  }

  if (/\bproceed carefully\b|\bcontinue carefully\b|\bwith caution\b/.test(combined)) {
    addAction("proceed-carefully", "proceed-carefully");
  }

  if (/\bcontinue\b|\bgo ahead\b|\bgo straight\b|\bproceed\b/.test(combined)) {
    addAction("continue", "continue");
  }

  if (/\baccelerate\b|\bspeed up\b/.test(combined)) {
    addAction("accelerate", "accelerate");
  }

  if (/\bemergency-brake\b/.test(combined)) {
    addAction("emergency-brake", "emergency-brake");
  }

  if (/\bu-turn\b/.test(combined)) {
    addAction("u-turn", "u-turn");
  }

  if (/\bno overtaking\b|\bovertaking prohibited\b|\bdo not overtake\b/.test(combined)) {
    addAction("no-overtake", "no-overtake");
  } else if (/\bovertake\b|\bpass\b/.test(combined)) {
    addAction("overtake", "overtake", ["pass"]);
  }

  if (/\buse hazard lights\b|\bturn on hazard lights\b|\bwarning lights\b|\bhazard lights\b/.test(combined)) {
    addAction("use-hazard-lights", "use-hazard-lights", ["hazard-lights"]);
  }

  if (/\buse low beam\b|\bturn on low beam\b/.test(combined)) {
    addAction("use-low-beam", "use-low-beam", ["low-beam"]);
  } else if (/\blow beam\b/.test(combined)) {
    addAction("low-beam", "low-beam");
  }

  if (/\buse high beam\b|\bturn on high beam\b/.test(combined)) {
    addAction("use-high-beam", "use-high-beam", ["high-beam"]);
  } else if (/\bhigh beam\b/.test(combined)) {
    addAction("high-beam", "high-beam");
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

  if (/\bno parking\b|\bparking prohibited\b|\bdo not park\b/.test(combined)) {
    addAction("no-parking", "no-parking");
  } else if (/\bpark\b|\bparking\b/.test(combined)) {
    addAction("park", "park");
  }

  if (/\bno reversing\b|\breverse prohibited\b|\bdo not reverse\b/.test(combined)) {
    addAction("no-reverse", "no-reverse");
  } else if (/\breverse\b|\bback(?:ing| up)?\b/.test(combined)) {
    addAction("reverse", "reverse");
  }

  return {
    condition,
    context,
    action,
    polarity: promptPolarity ?? inferPromptPolarity(promptOnly || combined),
    obligation,
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
  const sourceObligation = sourceSlots?.obligation ?? null;
  const candidateCondition = toList(candidateSlots?.condition);
  const candidateContext = toList(candidateSlots?.context);
  const candidateAction = toList(candidateSlots?.action);
  const candidateObligation = candidateSlots?.obligation ?? null;
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
  const obligationAlignment =
    sourceObligation && candidateObligation
      ? sourceObligation === candidateObligation
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

  if (obligationAlignment > 0 && sourceObligation) {
    pushUniqueSignal(matchedSignals, `obligation:${sourceObligation}`);
  }

  let contradictionPenalty = 0;
  const hasSource = sourceCondition.length > 0 || sourceContext.length > 0 || sourceAction.length > 0;

  const has = (values, value) => values.includes(value);
  const hasAny = (values, candidates) => candidates.some((candidate) => values.includes(candidate));
  const mismatchGroup = (sourceValues, candidateValues, leftGroup, rightGroup) =>
    hasAny(sourceValues, leftGroup) &&
    hasAny(candidateValues, rightGroup) &&
    !hasAny(candidateValues, leftGroup);

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

  if (
    hasAny(sourceAction, ["yield", "stop-yield"]) &&
    hasAny(candidateAction, ["continue", "accelerate", "overtake", "pass"]) &&
    !hasAny(candidateAction, ["yield", "stop", "stop-yield", "proceed-carefully"])
  ) {
    contradictionPenalty += 0.28;
    pushUniqueSignal(contradictionSignals, "action:yield-vs-proceed");
  }

  if (
    hasAny(sourceAction, ["reduce-speed", "slow"]) &&
    hasAny(candidateAction, ["continue", "accelerate", "overtake", "pass"]) &&
    !hasAny(candidateAction, ["reduce-speed", "slow", "proceed-carefully", "stop"])
  ) {
    contradictionPenalty += 0.22;
    pushUniqueSignal(contradictionSignals, "action:reduce-speed-vs-proceed");
  }

  if (
    hasAny(sourceAction, ["stop-and-wait", "stop-yield"]) &&
    hasAny(candidateAction, ["continue", "accelerate", "overtake", "pass"]) &&
    !hasAny(candidateAction, ["stop", "stop-and-wait", "stop-yield"])
  ) {
    contradictionPenalty += 0.3;
    pushUniqueSignal(contradictionSignals, "action:stop-and-wait-vs-proceed");
  }

  if (has(sourceAction, "no-overtake") && hasAny(candidateAction, ["overtake", "pass"]) && !has(candidateAction, "no-overtake")) {
    contradictionPenalty += 0.32;
    pushUniqueSignal(contradictionSignals, "negation:no-overtake-vs-overtake");
  }

  if (has(sourceAction, "no-honk") && has(candidateAction, "honk") && !has(candidateAction, "no-honk")) {
    contradictionPenalty += 0.26;
    pushUniqueSignal(contradictionSignals, "negation:no-honk-vs-honk");
  }

  if (has(sourceAction, "no-parking") && hasAny(candidateAction, ["park", "parking"]) && !has(candidateAction, "no-parking")) {
    contradictionPenalty += 0.24;
    pushUniqueSignal(contradictionSignals, "negation:no-parking-vs-park");
  }

  if (has(sourceAction, "no-reverse") && hasAny(candidateAction, ["reverse", "backing"]) && !has(candidateAction, "no-reverse")) {
    contradictionPenalty += 0.24;
    pushUniqueSignal(contradictionSignals, "negation:no-reverse-vs-reverse");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["mountain-road", "downhill", "uphill"], ["tunnel"]) ||
    mismatchGroup(sourceContext, candidateContext, ["tunnel"], ["mountain-road", "downhill", "uphill"])
  ) {
    contradictionPenalty += 0.2;
    pushUniqueSignal(contradictionSignals, "context:mountain-road-vs-tunnel");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["parking-area"], ["expressway", "ramp"]) ||
    mismatchGroup(sourceContext, candidateContext, ["expressway", "ramp"], ["parking-area"])
  ) {
    contradictionPenalty += 0.24;
    pushUniqueSignal(contradictionSignals, "context:parking-area-vs-expressway-or-ramp");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["crosswalk", "pedestrian", "school-zone"], ["expressway", "tunnel"]) ||
    mismatchGroup(sourceContext, candidateContext, ["expressway", "tunnel"], ["crosswalk", "pedestrian", "school-zone"])
  ) {
    contradictionPenalty += 0.16;
    pushUniqueSignal(contradictionSignals, "context:pedestrian-zone-vs-through-road");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["residential-area", "school-zone", "bus-stop"], ["expressway", "ramp", "tunnel"]) ||
    mismatchGroup(sourceContext, candidateContext, ["expressway", "ramp", "tunnel"], ["residential-area", "school-zone", "bus-stop"])
  ) {
    contradictionPenalty += 0.18;
    pushUniqueSignal(contradictionSignals, "context:local-zone-vs-through-road");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["railroad-crossing"], ["intersection", "bridge", "tunnel"]) ||
    mismatchGroup(sourceContext, candidateContext, ["intersection", "bridge", "tunnel"], ["railroad-crossing"])
  ) {
    contradictionPenalty += 0.18;
    pushUniqueSignal(contradictionSignals, "context:railroad-crossing-vs-other-road-context");
  }

  if (
    mismatchGroup(sourceContext, candidateContext, ["curve", "narrow-road"], ["expressway", "parking-area"]) ||
    mismatchGroup(sourceContext, candidateContext, ["expressway", "parking-area"], ["curve", "narrow-road"])
  ) {
    contradictionPenalty += 0.16;
    pushUniqueSignal(contradictionSignals, "context:curve-or-narrow-road-vs-other-context");
  }

  if (
    mismatchGroup(sourceAction, candidateAction, ["min-speed", "max-speed"], ["stop", "parking", "parking-brake"]) ||
    mismatchGroup(sourceAction, candidateAction, ["stop", "parking", "parking-brake"], ["min-speed", "max-speed"])
  ) {
    contradictionPenalty += 0.28;
    pushUniqueSignal(contradictionSignals, "action:speed-limit-vs-stop-or-parking");
  }

  if (
    mismatchGroup(sourceAction, candidateAction, ["hazard-lights"], ["low-beam", "high-beam", "head-light"]) ||
    mismatchGroup(sourceAction, candidateAction, ["low-beam", "high-beam", "head-light"], ["hazard-lights"])
  ) {
    contradictionPenalty += 0.26;
    pushUniqueSignal(contradictionSignals, "action:hazard-lights-vs-headlights");
  }

  if (
    mismatchGroup(sourceAction, candidateAction, ["low-beam"], ["high-beam"]) ||
    mismatchGroup(sourceAction, candidateAction, ["high-beam"], ["low-beam"])
  ) {
    contradictionPenalty += 0.18;
    pushUniqueSignal(contradictionSignals, "action:low-beam-vs-high-beam");
  }

  if (
    mismatchGroup(sourceAction, candidateAction, ["brake", "emergency-brake", "parking-brake"], ["accelerate", "pass"]) ||
    mismatchGroup(sourceAction, candidateAction, ["accelerate", "pass"], ["brake", "emergency-brake", "parking-brake"])
  ) {
    contradictionPenalty += 0.18;
    pushUniqueSignal(contradictionSignals, "action:brake-vs-accelerate-or-pass");
  }

  if (
    sourceObligation === "prohibited" &&
    candidateObligation &&
    candidateObligation !== "prohibited" &&
    !candidateAction.some((value) => String(value).startsWith("no-"))
  ) {
    contradictionPenalty += 0.16;
    pushUniqueSignal(contradictionSignals, "obligation:prohibited-vs-permissive");
  }

  if (
    sourceObligation === "must" &&
    candidateObligation === "may"
  ) {
    contradictionPenalty += 0.12;
    pushUniqueSignal(contradictionSignals, "obligation:must-vs-may");
  }

  if (
    sourceObligation === "caution" &&
    hasAny(candidateAction, ["accelerate", "overtake", "pass"]) &&
    !hasAny(candidateAction, ["reduce-speed", "slow", "proceed-carefully"])
  ) {
    contradictionPenalty += 0.12;
    pushUniqueSignal(contradictionSignals, "obligation:caution-vs-aggressive-action");
  }

  const hasComparableConcepts =
    (sourceCondition.length > 0 && candidateCondition.length > 0) ||
    (sourceContext.length > 0 && candidateContext.length > 0) ||
    (sourceAction.length > 0 && candidateAction.length > 0);
  const alignment = hasSource && hasComparableConcepts
    ? combineAvailableScores([
      { value: conditionAlignment, weight: 0.3, available: sourceCondition.length > 0 && candidateCondition.length > 0 },
      { value: contextAlignment, weight: 0.24, available: sourceContext.length > 0 && candidateContext.length > 0 },
      { value: actionAlignment, weight: 0.3, available: sourceAction.length > 0 && candidateAction.length > 0 },
      { value: polarityAlignment, weight: 0.08, available: Boolean(sourceSlots?.polarity && candidateSlots?.polarity) },
      { value: obligationAlignment, weight: 0.08, available: Boolean(sourceObligation && candidateObligation) },
    ], 0)
    : 0;

  return {
    alignment,
    conditionAlignment,
    contextAlignment,
    actionAlignment,
    polarityAlignment,
    obligationAlignment,
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

function inferExpectedObjectTagsFromText(text) {
  const tags = [];

  if (!text) {
    return tags;
  }

  if (/\btraffic-light\b|\bsignal light\b/.test(text)) tags.push("traffic-light");
  if (/\bcrosswalk\b|\bpedestrian crossing\b/.test(text)) tags.push("crosswalk");
  if (/\bbicycle\b|\bbike\b|\bcycle\b/.test(text)) tags.push("bicycle");
  if (/\bbus\b/.test(text)) tags.push("bus");
  if (/\btrain\b/.test(text)) tags.push("train");
  if (/\brailroad\b|\brailway\b|\blevel crossing\b/.test(text)) tags.push("railroad");
  if (/\bmountain\b|\bcliff\b|\bembankment\b|\brock-falling\b/.test(text)) tags.push("mountain");
  if (/\bsnow\b/.test(text)) tags.push("snow");
  if (/\brain\b|\bwet road\b/.test(text)) tags.push("rain");
  if (/\bintersection\b|\bcross intersection\b|\bt-shape\b|\by-shape\b|\bjunction\b/.test(text)) tags.push("intersection");
  if (/\barrow\b|\bguide arrow\b|\bleft-turn\b|\bright-turn\b|\bstraight\b/.test(text)) tags.push("arrow");
  if (/\b(?:dashboard|indicator|warning light|indicator light|warning lamp|instrument panel|symbol indicate|it lights|lights to indicate|signal about)\b/.test(text)) {
    tags.push("indicator", "dashboard-indicator", "warning-light");
  }
  if (/\b(?:car|vehicle|hood|engine compartment|engine-compartment|door|one-side-door|both-side-doors|luggage compartment|luggage-compartment|trunk)\b/.test(text)) {
    tags.push("car-icon");
  }
  if (/\b(?:open hood|hood open|open engine-compartment|engine-compartment open|engine compartment(?: is)? opened?|opened? engine compartment|engine-compartment(?: is)? opened?|opened? engine-compartment)\b/.test(text)) {
    tags.push("open-hood", "vehicle-side-view");
  }
  if (/\b(?:open door|door(?:s)? (?:is |are )?not closed|door open|left door|right door|one-side-door|both-side-doors)\b/.test(text)) {
    tags.push("open-door", "vehicle-top-view");
  }
  if (/\b(?:open trunk|trunk open|open luggage-compartment|luggage-compartment open|luggage compartment(?: is)? open|luggage compartment|luggage-compartment(?: is)? opened?|opened? luggage-compartment)\b/.test(text)) {
    tags.push("open-trunk", "vehicle-side-view");
  }

  return unique(tags);
}

function inferExpectedColorTagsFromText(text) {
  const tags = [];

  if (!text) {
    return tags;
  }

  for (const color of ["red", "yellow", "blue", "white", "black", "green", "orange", "brown", "gray"]) {
    if (new RegExp(`\\b${color}\\b`).test(text)) {
      tags.push(color);
    }
  }

  return unique(tags);
}

function sourceOptionCount(item) {
  return Math.max(item?.translatedOptions?.length ?? 0, item?.localizedOptions?.length ?? 0, 0);
}

function augmentIndicatorVisualTags(objectTags, colorTags, sourceText = "") {
  const objects = normalizeImageTagList(objectTags);
  const colors = normalizeImageTagList(colorTags);
  const text = semanticNormalizeText(sourceText);
  const augmented = [...objects];
  const explicitIndicatorSignal =
    objects.includes("indicator") ||
    objects.includes("dashboard-indicator") ||
    objects.includes("warning-light") ||
    objects.includes("car-icon") ||
    objects.includes("yellow-car-icon") ||
    /\b(?:dashboard|indicator|warning light|indicator light|warning lamp|instrument panel|it lights|lights to indicate|signal about|symbol indicate)\b/.test(text);

  if (colors.includes("gray")) {
    pushUniqueSignal(augmented, "gray-background");
  }

  if (explicitIndicatorSignal && (objects.includes("car") || objects.includes("vehicle") || /\b(?:car|vehicle|hood|door|trunk|luggage compartment|luggage-compartment|engine compartment|engine-compartment|one-side-door|both-side-doors)\b/.test(text))) {
    pushUniqueSignal(augmented, "car-icon");
  }

  if (explicitIndicatorSignal && colors.includes("yellow") && (augmented.includes("car-icon") || objects.includes("car") || objects.includes("vehicle"))) {
    pushUniqueSignal(augmented, "yellow-car-icon");
  }

  if (
    explicitIndicatorSignal ||
    augmented.includes("yellow-car-icon")
  ) {
    pushUniqueSignal(augmented, "indicator");
    pushUniqueSignal(augmented, "dashboard-indicator");
    pushUniqueSignal(augmented, "warning-light");
  }

  if (/\b(?:open hood|hood open|open engine-compartment|engine-compartment open|engine compartment(?: is)? opened?|opened? engine compartment|engine-compartment(?: is)? opened?|opened? engine-compartment)\b/.test(text)) {
    pushUniqueSignal(augmented, "open-hood");
    pushUniqueSignal(augmented, "vehicle-side-view");
  }

  if (/\b(?:open door|door(?:s)? (?:is |are )?not closed|door open|left door|right door|one-side-door|both-side-doors)\b/.test(text)) {
    pushUniqueSignal(augmented, "open-door");
    pushUniqueSignal(augmented, "vehicle-top-view");
  }

  if (/\b(?:open trunk|trunk open|open luggage-compartment|luggage-compartment open|luggage compartment(?: is)? open|luggage compartment|luggage-compartment(?: is)? opened?|opened? luggage-compartment)\b/.test(text)) {
    pushUniqueSignal(augmented, "open-trunk");
    pushUniqueSignal(augmented, "vehicle-side-view");
  }

  return unique(augmented);
}

function isReliableOptionCount(item, itemShape, count) {
  if (!count) {
    return false;
  }

  const translatedCount = item?.translatedOptions?.length ?? 0;
  const localizedCount = item?.localizedOptions?.length ?? 0;

  if (itemShape?.effectiveType === "ROW") {
    return count === 2;
  }

  if (itemShape?.effectiveType === "MCQ" && count >= 3) {
    return translatedCount === 0 || localizedCount === 0 || translatedCount === localizedCount;
  }

  return false;
}

function buildSourceReviewMetadata(item, itemShape) {
  const sourceFields = buildSourceReviewFields(item);
  const provisionalTopic = inferProvisionalTopicMetadata(item);
  const sourceText = sourceReviewText(item);
  const visualObjectTags = normalizeImageTagList(item.visualObjectTags);
  const visualColorTags = normalizeImageTagList(item.visualColorTags);
  const visualNumberTags = unique(toList(item.visualNumberTags).map((entry) => normalizeWhitespace(entry)).filter(Boolean));
  const visualLayoutTags = unique(toList(item.visualLayoutTags).map((entry) => normalizeWhitespace(entry).toLowerCase()).filter(Boolean));
  const expectedObjectTags = augmentIndicatorVisualTags(
    unique([...visualObjectTags, ...inferExpectedObjectTagsFromText(sourceText)]),
    visualColorTags,
    sourceText,
  );
  const expectedColorTags = unique([...visualColorTags, ...inferExpectedColorTagsFromText(sourceText)]);
  const promptFamily = detectGenericPromptFamily(item.translatedPrompt || item.localizedPrompt);
  const optionCount = sourceOptionCount(item);
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
    visualObjectTags,
    visualColorTags,
    visualNumberTags,
    visualLayoutTags,
    visualEvidenceAvailable:
      item?.hasImage === true &&
      (
        visualObjectTags.length > 0 ||
        visualColorTags.length > 0 ||
        visualNumberTags.length > 0 ||
        visualLayoutTags.length > 0
      ),
    sourcePromptFamily: promptFamily?.family ?? null,
    sourcePromptFamilyBucket: inferPromptFamilyBucket({
      family: promptFamily?.family ?? null,
      text: item.translatedPrompt || item.localizedPrompt,
      keywords: [
        ...inferExpectedObjectTagsFromText(sourceText),
        ...expectedObjectTags,
        ...expectedColorTags,
      ],
      questionType: itemShape?.effectiveType,
    }),
    sourceOptionCount: optionCount,
    optionCountReliable: isReliableOptionCount(item, itemShape, optionCount),
    expectedObjectTags,
    expectedColorTags,
    sourceIsSignHeavy:
      item?.hasImage === true &&
      (
        provisionalTopic.provisionalTopic === "traffic-signals" ||
        visualLayoutTags.some((tag) => tag.includes("sign") || tag === "intersection-diagram" || tag === "traffic-light-state" || tag === "lane-assignment" || tag === "pov-scene") ||
        /\bsign\b|\bsymbol\b|\bmarking\b|\blane\b|\barrow\b|\btraffic-light\b/.test(sourceText) ||
        expectedObjectTags.length > 0
      ),
    sourceConceptSlots,
    mcqFingerprint:
      itemShape?.effectiveType === "MCQ"
        ? buildMcqFingerprint({
          prompt: item.translatedPrompt || item.localizedPrompt,
          correctAnswer: item.translatedCorrectAnswer || item.localizedCorrectAnswer || item.correctKeyRaw,
          options: item.translatedOptions.length > 0 ? item.translatedOptions : item.localizedOptions,
          topic: provisionalTopic.provisionalTopic,
          subtopics: provisionalTopic.provisionalSubtopics,
          hasImage: item?.hasImage === true,
        })
        : null,
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
  const leftConceptTokenSets = leftPhrases.map((option) => optionConceptTokensFromNormalized(option));
  const rightConceptTokenSets = rightPhrases.map((option) => optionConceptTokensFromNormalized(option));
  const conceptExactSet =
    optionConceptSetSignature(leftConceptTokenSets) === optionConceptSetSignature(rightConceptTokenSets)
      ? 1
      : plainJaccard(
        leftConceptTokenSets.map((tokens) => optionConceptSignatureFromTokens(tokens)),
        rightConceptTokenSets.map((tokens) => optionConceptSignatureFromTokens(tokens)),
      );
  const conceptCoverage = weightedJaccard(
    leftConceptTokenSets.flat(),
    rightConceptTokenSets.flat(),
    corpus.optionTokenIdf,
  );
  const rareTokenCoverage = weightedJaccard(
    leftPhrases.flatMap((phrase) => informativeSemanticTokens(phrase)),
    rightPhrases.flatMap((phrase) => informativeSemanticTokens(phrase)),
    corpus.optionTokenIdf,
  );
  const leftSetIdf = normalizeIdf(corpus.optionSetIdf.get(optionPhraseSignature(leftPhrases)));
  const rightSetIdf = normalizeIdf(corpus.optionSetIdf.get(optionPhraseSignature(rightPhrases)));
  const rareSetBonus = exactSet > 0.7 ? Math.max(leftSetIdf, rightSetIdf) : 0;
  const similarity =
    (pairing.score * 0.52) +
    (conceptCoverage * 0.18) +
    (conceptExactSet * 0.12) +
    (rareTokenCoverage * 0.1) +
    (exactSet * 0.08);
  const fingerprint = Math.min(1, similarity + (rareSetBonus * 0.18));

  return {
    similarity,
    fingerprint,
    exactSet,
    conceptExactSet,
    conceptCoverage,
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
    conceptExactSet: fingerprint.conceptExactSet,
    conceptCoverage: fingerprint.conceptCoverage,
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

function localizedCandidateSignalsForMatch(question, sourceLang) {
  const normalizedLang = normalizeLang(sourceLang);
  const translatedQuestion = question.translations?.[normalizedLang] ?? null;

  if (translatedQuestion) {
    return {
      label: `translation-${normalizedLang}`,
      prompt: translatedQuestion.questionText ?? "",
      options: toList(translatedQuestion.options).map((option) => option?.text ?? "").filter(Boolean),
      correctCandidates: [
        translatedQuestion.correctOptionText,
        translatedQuestion.correctOptionKey,
      ],
      glossEn: translatedQuestion.glossEn ?? "",
      optionGlossesEn: toList(translatedQuestion.optionGlossesEn).map((entry) => entry?.text ?? "").filter(Boolean),
      correctOptionGlossEn: translatedQuestion.correctOptionGlossEn ?? null,
      keywords: unique([
        ...toList(translatedQuestion.keywords),
        ...toList(translatedQuestion.conceptKeywords),
      ]),
    };
  }

  if (normalizedLang === "ja") {
    return {
      label: "synthetic-ja",
      prompt: question.syntheticJa?.prompt ?? "",
      options: question.syntheticJa?.options ?? [],
      correctCandidates: [
        question.syntheticJa?.correctAnswer?.text,
        question.syntheticJa?.correctAnswer?.key,
      ],
      glossEn: question.syntheticJa?.prompt ?? "",
      optionGlossesEn: question.syntheticJa?.options ?? [],
      correctOptionGlossEn: question.syntheticJa?.correctAnswer?.text ?? null,
      keywords: [],
    };
  }

  if (normalizedLang === DEFAULT_REFERENCE_LANG) {
    return {
      label: `reference-${DEFAULT_REFERENCE_LANG}`,
      prompt: question.translatedPrompt ?? "",
      options: question.options.map((option) => option.translatedText),
      correctCandidates: [
        question.correctAnswer.correctOptionTranslatedText,
        question.correctAnswer.correctOptionKey,
      ],
      glossEn: question.translatedPrompt ?? "",
      optionGlossesEn: question.options.map((option) => option.translatedText).filter(Boolean),
      correctOptionGlossEn: question.correctAnswer.correctOptionTranslatedText ?? null,
      keywords: [],
    };
  }

  return {
    label: null,
    prompt: "",
    options: [],
    correctCandidates: [],
    glossEn: "",
    optionGlossesEn: [],
    correctOptionGlossEn: null,
    keywords: [],
  };
}

function localizedPromptSimilarityForMatch(item, question, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...promptSimilarityForMatch(item.localizedPrompt, candidateSignals.prompt),
    available: Boolean(item.localizedPrompt) && Boolean(candidateSignals.prompt),
  };
}

function localizedOptionSimilarityForMatch(itemShape, item, question, corpus, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...optionSimilarityFromSignals(
      itemShape,
      item.localizedOptions,
      candidateSignals.options,
      question.type,
      corpus,
    ),
  };
}

function localizedCorrectAnswerSimilarityForMatch(item, question, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...correctAnswerSimilarityFromSignals(
      [
        item.localizedCorrectAnswer,
        item.correctKeyRaw,
      ],
      candidateSignals.correctCandidates,
    ),
  };
}

function localizedGlossSimilarityForMatch(sourceFeatureBridge, question, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...promptSimilarityForMatch(sourceFeatureBridge?.glossEn, candidateSignals.glossEn),
    available: Boolean(sourceFeatureBridge?.glossEn) && Boolean(candidateSignals.glossEn),
  };
}

function localizedOptionGlossSimilarityForMatch(itemShape, item, question, corpus, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...optionSimilarityFromSignals(
      itemShape,
      item.translatedOptions,
      candidateSignals.optionGlossesEn,
      question.type,
      corpus,
    ),
  };
}

function localizedCorrectGlossSimilarityForMatch(item, question, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);
  return {
    label: candidateSignals.label,
    ...correctAnswerSimilarityFromSignals(
      [
        item.translatedCorrectAnswer,
        item.correctKeyRaw,
      ],
      [
        candidateSignals.correctOptionGlossEn,
        question.correctAnswer.correctOptionText,
        question.correctAnswer.correctOptionKey,
      ],
    ),
  };
}

function localizedKeywordSupportForMatch(sourceKeywords, question, corpus, sourceLang) {
  const candidateSignals = localizedCandidateSignalsForMatch(question, sourceLang);

  return {
    label: candidateSignals.label,
    available: sourceKeywords.length > 0 || candidateSignals.keywords.length > 0,
    score: scoreFeatureKeywordSignal(sourceKeywords, candidateSignals.keywords, corpus, 0.5),
  };
}

function candidateOptionCount(question) {
  if (question.type === "ROW") {
    return Math.max(question.options.length, 2);
  }

  return question.options.length;
}

function scoreOptionCountAgreement(sourceMetadata, question) {
  const sourceCount = Number(sourceMetadata?.sourceOptionCount ?? 0);
  if (!sourceMetadata?.optionCountReliable || !sourceCount) {
    return 0.5;
  }

  const candidateCount = candidateOptionCount(question);
  if (!candidateCount) {
    return 0.5;
  }

  if (sourceCount === candidateCount) {
    return 1;
  }

  if (Math.abs(sourceCount - candidateCount) === 1 && question.type === "MCQ") {
    return 0.25;
  }

  return 0;
}

function scorePromptFamilyAgreement(sourceMetadata, question) {
  const candidateFamily = question.genericPrompt?.family ?? question.normalizedFeatures?.promptFamily ?? null;
  const candidateBucket = inferPromptFamilyBucket({
    family: candidateFamily,
    text: question.sourcePrompt || question.prompt,
    keywords: [
      ...(question.normalizedFeatures?.masterKeywords ?? []),
      ...(question.normalizedFeatures?.conceptKeywords ?? []),
    ],
    questionType: question.type,
  });

  return comparePromptFamilyCompatibility({
    sourceFamily: sourceMetadata?.sourcePromptFamily ?? null,
    sourceBucket: sourceMetadata?.sourcePromptFamilyBucket ?? null,
    candidateFamily,
    candidateBucket,
  }).score;
}

function scoreAnswerStructureAgreement(itemShape, item, question) {
  if (itemShape?.effectiveType !== "ROW") {
    return 0.5;
  }

  if (question.type !== "ROW") {
    return 0;
  }

  if (!item.answerPolarity) {
    return 0.5;
  }

  const expectedRow = item.answerPolarity === "positive" ? "R" : "W";
  return question.correctAnswer.correctRow === expectedRow ? 1 : 0;
}

function scoreSourceTopicAgreement(sourceMetadata, question) {
  const sourceTopic = sourceMetadata?.provisionalTopic ?? null;
  const topicConfidence = Number(sourceMetadata?.topicConfidence ?? 0);

  if (!sourceTopic || topicConfidence < 0.6) {
    return 0.5;
  }

  const candidateTopic = question.tags.truthTopic ?? question.tags.weightedTopic ?? null;
  if (!candidateTopic) {
    return 0.35;
  }

  if (candidateTopic === sourceTopic) {
    return 1;
  }

  const sourceSubtopics = new Set(sourceMetadata?.provisionalSubtopics ?? []);
  const candidateSubtopics = [
    ...question.tags.truthSubtopics,
    ...question.tags.weightedSubtopics,
  ];
  if (candidateSubtopics.some((subtopic) => sourceSubtopics.has(subtopic))) {
    return 0.75;
  }

  return topicConfidence >= 0.82 ? 0 : 0.2;
}

function scoreExpectedTagAgreement(expectedTags, candidateTags, neutralFallback = 0.5) {
  const expected = unique(toList(expectedTags).filter(Boolean));
  const candidate = unique(toList(candidateTags).filter(Boolean));

  if (!expected.length) {
    return neutralFallback;
  }

  if (!candidate.length) {
    return 0.35;
  }

  const overlap = conceptOverlapScore(expected, candidate);
  return overlap > 0 ? Math.min(1, 0.6 + (overlap * 0.4)) : 0;
}

function normalizeVisualTagForScoring(value) {
  let normalized = normalizeWhitespace(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/_/g, "-").replace(/\s+/g, "-");

  if (["railway", "railway-crossing", "level-crossing", "railroad-crossing"].includes(normalized)) {
    return "railroad";
  }

  if (normalized === "pov-scene") {
    return "pov";
  }

  if (normalized === "traffic-light-state") {
    return "traffic-light";
  }

  return normalized;
}

function visualTagSimilarity(leftTag, rightTag) {
  const left = normalizeVisualTagForScoring(leftTag);
  const right = normalizeVisualTagForScoring(rightTag);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftSemantic = semanticNormalizeText(left.replace(/-/g, " "));
  const rightSemantic = semanticNormalizeText(right.replace(/-/g, " "));

  if (leftSemantic && rightSemantic && leftSemantic === rightSemantic) {
    return 0.96;
  }

  const containment =
    leftSemantic && rightSemantic && (leftSemantic.includes(rightSemantic) || rightSemantic.includes(leftSemantic))
      ? 0.84
      : 0;
  const tokenOverlap = plainJaccard(semanticTextTokens(leftSemantic), semanticTextTokens(rightSemantic));
  const semantic = textSimilarity(leftSemantic, rightSemantic);

  return clamp01(Math.max(containment, (tokenOverlap * 0.55) + (semantic * 0.45)));
}

function scoreVisualTagCompatibility(sourceTags, candidateTags, { bothMissing = 0.5, missingOne = 0.15 } = {}) {
  const source = unique(toList(sourceTags).map((entry) => normalizeVisualTagForScoring(entry)).filter(Boolean));
  const candidate = unique(toList(candidateTags).map((entry) => normalizeVisualTagForScoring(entry)).filter(Boolean));

  if (source.length === 0 && candidate.length === 0) {
    return {
      score: bothMissing,
      exactOverlap: 0,
      matchedTags: [],
      available: false,
    };
  }

  if (source.length === 0 || candidate.length === 0) {
    return {
      score: missingOne,
      exactOverlap: 0,
      matchedTags: [],
      available: true,
    };
  }

  const forward = average(
    source.map((sourceTag) => Math.max(...candidate.map((candidateTag) => visualTagSimilarity(sourceTag, candidateTag)))),
  );
  const reverse = average(
    candidate.map((candidateTag) => Math.max(...source.map((sourceTag) => visualTagSimilarity(sourceTag, candidateTag)))),
  );
  const exactOverlap = plainJaccard(source, candidate);
  const matchedTags = source.filter((sourceTag) => candidate.some((candidateTag) => visualTagSimilarity(sourceTag, candidateTag) >= 0.9));

  return {
    score: clamp01(Math.max(exactOverlap, (forward * 0.72) + (reverse * 0.28))),
    exactOverlap,
    matchedTags: unique(matchedTags),
    available: true,
  };
}

function candidateDirectionTokens(question) {
  const fingerprint = question?.mcqFingerprint ?? null;
  const tokens = new Set([
    ...toList(fingerprint?.promptAllTokens),
    ...toList(fingerprint?.answerAllTokens),
    ...toList(fingerprint?.optionTokens),
  ]);

  return ["left", "right", "straight", "u-turn", "merge", "split"]
    .filter((token) => tokens.has(token));
}

function candidateVisualLayoutTags(question) {
  const objectTags = normalizeImageTagList(question?.image?.objectTags);
  const layoutTags = [];

  if (objectTags.includes("triangle")) {
    layoutTags.push("triangular-sign", "warning-sign");
  }

  if (objectTags.includes("traffic-light")) {
    layoutTags.push("traffic-light-state");
  }

  if (objectTags.includes("pov")) {
    layoutTags.push("pov-scene");
  }

  if (objectTags.includes("intersection") || objectTags.includes("crosswalk") || objectTags.includes("pov")) {
    layoutTags.push("intersection-diagram");
  }

  if (objectTags.includes("arrow")) {
    layoutTags.push("lane-assignment");
  }

  return unique([...layoutTags, ...candidateDirectionTokens(question)]);
}

function scoreVisualNumberEvidence(sourceMetadata, question) {
  const sourceNumbers = unique(toList(sourceMetadata?.visualNumberTags).map((entry) => normalizeWhitespace(entry)).filter(Boolean));

  if (sourceNumbers.length === 0) {
    return {
      score: 0.5,
      imageTagScore: 0,
      textScore: 0.5,
      exactOverlap: 0,
      matchedTags: [],
      conflict: false,
      available: false,
    };
  }

  const candidateImageNumbers = normalizeImageTagList(question?.image?.objectTags)
    .filter((entry) => /^\d+(?:\.\d+)?$/.test(entry));
  const imageTagMatch = scoreVisualTagCompatibility(sourceNumbers, candidateImageNumbers, {
    bothMissing: 0,
    missingOne: 0.08,
  });
  const textNumberMatch = scoreNumericSignalAlignment(
    { tokens: sourceNumbers, values: sourceNumbers },
    question?.mcqFingerprint?.numericSignals,
  );
  const conflict =
    sourceNumbers.length > 0 &&
    (
      (candidateImageNumbers.length > 0 && imageTagMatch.exactOverlap === 0) ||
      textNumberMatch.conflict === true
    );

  return {
    score: clamp01(Math.max(
      imageTagMatch.score,
      (imageTagMatch.score * 0.72) + (textNumberMatch.score * 0.28) - ((conflict ? 1 : 0) * 0.18),
    )),
    imageTagScore: imageTagMatch.score,
    textScore: textNumberMatch.score,
    exactOverlap: imageTagMatch.exactOverlap,
    matchedTags: imageTagMatch.matchedTags,
    conflict,
    available: true,
  };
}

function scoreVisualLayoutCompatibility(sourceMetadata, question) {
  const sourceLayouts = unique(toList(sourceMetadata?.visualLayoutTags).map((entry) => normalizeWhitespace(entry).toLowerCase()).filter(Boolean));

  if (sourceLayouts.length === 0) {
    return {
      score: 0.5,
      matchedTags: [],
      contradictionPenalty: 0,
      available: false,
    };
  }

  const candidateLayouts = candidateVisualLayoutTags(question);
  const candidateTokens = unique([
    ...candidateLayouts,
    ...toList(question?.mcqFingerprint?.promptAllTokens),
    ...toList(question?.mcqFingerprint?.answerAllTokens),
    ...toList(question?.mcqFingerprint?.optionTokens),
  ]);
  const layoutMatch = scoreVisualTagCompatibility(sourceLayouts, candidateLayouts, {
    bothMissing: 0,
    missingOne: 0.12,
  });
  const tokenSupport = scoreVisualTagCompatibility(sourceLayouts, candidateTokens, {
    bothMissing: 0,
    missingOne: 0.08,
  });
  const contradiction = contradictionPenaltyForTokenSets(sourceLayouts, candidateTokens);

  return {
    score: clamp01(Math.max(
      layoutMatch.score,
      (layoutMatch.score * 0.72) + (tokenSupport.score * 0.28) - (contradiction.penalty * 0.35),
    )),
    matchedTags: unique([...layoutMatch.matchedTags, ...tokenSupport.matchedTags]),
    contradictionPenalty: contradiction.penalty,
    available: true,
  };
}

function candidateVisualObjectTagsForScoring(question) {
  return augmentIndicatorVisualTags(
    question?.image?.objectTags ?? [],
    [
      ...toList(question?.image?.colorTags),
      ...toList(question?.image?.dominantColorTags),
    ],
    [
      question?.sourcePrompt,
      question?.prompt,
      question?.correctAnswer?.correctOptionText,
      ...toList(question?.options).map((option) => option?.sourceText || option?.text),
    ].filter(Boolean).join(" "),
  );
}

function candidateVisualColorTagsForScoring(question) {
  return unique([
    ...normalizeImageTagList(question?.image?.colorTags),
    ...normalizeImageTagList(question?.image?.dominantColorTags),
  ]);
}

function scoreSourceVisualEvidence(sourceMetadata, question) {
  if (sourceMetadata?.hasImage !== true || sourceMetadata?.visualEvidenceAvailable !== true) {
    return {
      score: 0.5,
      objectScore: 0.5,
      colorScore: 0.5,
      numberScore: 0.5,
      layoutScore: 0.5,
      contradictionPenalty: 0,
      matchedTags: [],
      available: false,
    };
  }

  const candidateObjectTags = candidateVisualObjectTagsForScoring(question);
  const candidateColorTags = candidateVisualColorTagsForScoring(question);
  const objectMatch = scoreVisualTagCompatibility(sourceMetadata.expectedObjectTags, candidateObjectTags, {
    bothMissing: 0,
    missingOne: 0.06,
  });
  const colorMatch = scoreVisualTagCompatibility(sourceMetadata.visualColorTags, candidateColorTags, {
    bothMissing: 0,
    missingOne: 0.12,
  });
  const numberMatch = scoreVisualNumberEvidence(sourceMetadata, question);
  const layoutMatch = scoreVisualLayoutCompatibility(sourceMetadata, question);
  const topicMatch = scoreSourceTopicAgreement(sourceMetadata, question);
  const objectScore = Math.max(
    objectMatch.score,
    scoreExpectedTagAgreement(sourceMetadata.expectedObjectTags, candidateObjectTags, 0),
  );
  const contradictionPenalty = Math.min(
    1,
    (layoutMatch.contradictionPenalty * 0.65) +
    ((numberMatch.conflict ? 1 : 0) * 0.35),
  );

  return {
    score: clamp01(Math.max(
      objectScore,
      (objectScore * 0.44) +
      (numberMatch.score * 0.2) +
      (colorMatch.score * 0.12) +
      (layoutMatch.score * 0.16) +
      (topicMatch * 0.08) -
      (contradictionPenalty * 0.3),
    )),
    objectScore,
    colorScore: colorMatch.score,
    numberScore: numberMatch.score,
    layoutScore: layoutMatch.score,
    contradictionPenalty,
    matchedTags: unique([
      ...objectMatch.matchedTags,
      ...colorMatch.matchedTags,
      ...numberMatch.matchedTags,
      ...layoutMatch.matchedTags,
    ]),
    available: true,
  };
}

function evaluateStructuralCompatibility(item, itemShape, sourceMetadata, question) {
  const typeAgreement = questionTypeScore(itemShape, question.type);
  const optionCountAgreement = scoreOptionCountAgreement(sourceMetadata, question);
  const answerStructureAgreement = scoreAnswerStructureAgreement(itemShape, item, question);
  const promptFamilyAgreement = scorePromptFamilyAgreement(sourceMetadata, question);
  const provisionalTopicAgreement = scoreSourceTopicAgreement(sourceMetadata, question);
  const imageObjectAgreement = scoreExpectedTagAgreement(
    sourceMetadata?.expectedObjectTags,
    candidateVisualObjectTagsForScoring(question),
  );
  const imageColorAgreement = scoreExpectedTagAgreement(
    sourceMetadata?.expectedColorTags,
    candidateVisualColorTagsForScoring(question),
  );
  const severeSignals = [];
  const softSignals = [];

  if (itemShape?.effectiveType && typeAgreement === 0) {
    severeSignals.push("question-type");
  }

  if (sourceMetadata?.optionCountReliable && optionCountAgreement === 0) {
    severeSignals.push("option-count");
  }

  if (itemShape?.effectiveType === "ROW" && item.answerPolarity && answerStructureAgreement === 0) {
    severeSignals.push("answer-polarity");
  }

  if (sourceMetadata?.sourcePromptFamily && promptFamilyAgreement === 0) {
    softSignals.push("prompt-family");
  }

  if (Number(sourceMetadata?.topicConfidence ?? 0) >= 0.82 && provisionalTopicAgreement === 0) {
    softSignals.push("topic");
  }

  if (sourceMetadata?.sourceIsSignHeavy && (sourceMetadata?.expectedObjectTags?.length ?? 0) > 0 && imageObjectAgreement === 0) {
    softSignals.push("image-object");
  }

  if (sourceMetadata?.sourceIsSignHeavy && (sourceMetadata?.expectedColorTags?.length ?? 0) > 0 && imageColorAgreement === 0) {
    softSignals.push("image-color");
  }

  const structuralAgreement = combineAvailableScores([
    { value: typeAgreement, weight: 0.3, available: true },
    { value: optionCountAgreement, weight: 0.2, available: true },
    { value: answerStructureAgreement, weight: 0.15, available: itemShape?.effectiveType === "ROW" },
    { value: promptFamilyAgreement, weight: 0.1, available: Boolean(sourceMetadata?.sourcePromptFamily) },
    { value: provisionalTopicAgreement, weight: 0.12, available: Boolean(sourceMetadata?.provisionalTopic) },
    { value: imageObjectAgreement, weight: 0.09, available: Boolean(sourceMetadata?.expectedObjectTags?.length) },
    { value: imageColorAgreement, weight: 0.04, available: Boolean(sourceMetadata?.expectedColorTags?.length) },
  ], 0.5);

  const structuralPenalty = Math.min(1, (severeSignals.length * 0.35) + (softSignals.length * 0.16));
  const softEligible =
    severeSignals.filter((signal) => signal !== "option-count").length === 0 &&
    structuralAgreement >= 0.35;

  return {
    typeAgreement,
    optionCountAgreement,
    answerStructureAgreement,
    promptFamilyAgreement,
    provisionalTopicAgreement,
    imageObjectAgreement,
    imageColorAgreement,
    structuralAgreement,
    structuralPenalty,
    severeSignals,
    softSignals,
    hardPass: severeSignals.length === 0 && structuralAgreement >= 0.55,
    softPass: softEligible,
    candidateOptionCount: candidateOptionCount(question),
  };
}

function filterQuestionsByStructure(item, itemShape, sourceMetadata, questions, options = {}) {
  const candidateLimit = Number(options.candidateLimit ?? 5);
  const sourceLang = normalizeLang(options.sourceLang ?? DEFAULT_REFERENCE_LANG);
  const evaluated = questions.map((question) => ({
    question,
    structural: evaluateStructuralCompatibility(item, itemShape, sourceMetadata, question),
  }));
  const hard = evaluated.filter((entry) => entry.structural.hardPass);
  const soft = evaluated.filter((entry) => entry.structural.softPass);
  const desiredHardPool = Math.min(questions.length, Math.max(candidateLimit * 4, 12));
  const desiredSoftPool = Math.min(questions.length, Math.max(candidateLimit * 2, 8));

  let selected = hard;
  let mode = "hard-structural";

  if (selected.length < desiredHardPool) {
    selected = soft;
    mode = hard.length > 0 ? "soft-structural-fallback" : "soft-structural";
  }

  if (selected.length < desiredSoftPool) {
    selected = evaluated;
    mode = "parity-fallback";
  }

  const sourceNumericGroups =
    itemShape?.effectiveType === "ROW"
      ? extractNumericGroupsFromTexts(sourceNumericGroupTexts(item, null))
      : [];
  if (sourceNumericGroups.length > 0) {
    const selectedQids = new Set(selected.map((entry) => entry.question?.qid).filter(Boolean));
    const numericAligned = evaluated.filter((entry) => {
      const qid = entry.question?.qid ?? null;
      if (!qid || selectedQids.has(qid)) {
        return false;
      }

      const candidateNumericGroups = extractNumericGroupsFromTexts(candidateNumericGroupTexts(entry.question, sourceLang));
      const comparison = compareNumericGroups(sourceNumericGroups, candidateNumericGroups);
      return comparison.score >= 0.8 && comparison.penalty <= 0.12;
    });

    if (numericAligned.length > 0) {
      selected = [...selected, ...numericAligned];
      mode = `${mode}+numeric-group`;
    }
  }

  return {
    mode,
    evaluated,
    hardCount: hard.length,
    softCount: soft.length,
    selectedCount: selected.length,
    entries: selected,
  };
}

function shortlistQuestionsForMcq(itemShape, sourceMetadata, entries, corpus, options = {}) {
  if (itemShape?.effectiveType !== "MCQ") {
    return {
      applied: false,
      mode: "row-bypass",
      originalCount: entries.length,
      shortlistedCount: entries.length,
      topStageAScore: null,
      entries,
    };
  }

  const mcqEntries = entries.filter(({ question }) => question.type === "MCQ");
  if (mcqEntries.length === 0 || !sourceMetadata?.mcqFingerprint) {
    return {
      applied: true,
      mode: "mcq-shortlist-fallback",
      originalCount: entries.length,
      shortlistedCount: mcqEntries.length || entries.length,
      topStageAScore: null,
      entries: mcqEntries.length > 0 ? mcqEntries : entries,
    };
  }

  const candidateLimit = Number(options.candidateLimit ?? 5);
  const shortlistSize = Math.min(mcqEntries.length, Math.max(candidateLimit * 8, 24));
  const shortlisted = mcqEntries
    .map((entry) => ({
      ...entry,
      stageA: scoreMcqStageAShortlist(sourceMetadata, entry.question, corpus),
    }))
    .sort((left, right) => right.stageA.score - left.stageA.score)
    .slice(0, shortlistSize);

  return {
    applied: true,
    mode: "mcq-answer-option-number-shortlist",
    originalCount: entries.length,
    shortlistedCount: shortlisted.length,
    topStageAScore: round(shortlisted[0]?.stageA?.score ?? 0),
    entries: shortlisted.map(({ stageA, ...entry }) => entry),
  };
}

function applyWeightedReranking(entries) {
  return entries
    .map((entry) => {
      const breakdown = entry.score.breakdown;
      const isMcq = entry.question?.type === "MCQ";
      const localizedAdjustment = entry.score.diagnostics.localizedSignalAvailable
        ? ((breakdown.localizedAgreement ?? 0.5) - 0.5) * 8
        : 0;
      const numericGroupAdjustment =
        !isMcq && toList(entry.score.diagnostics.numericGroupReasonCodes).length > 0
          ? ((breakdown.numericGroupScore ?? 0.5) - 0.5) * 10 - ((breakdown.numericGroupPenalty ?? 0) * 10)
          : 0;
      const imageTagAdjustment =
        (
          entry.score.diagnostics.imageObjectComparable
            ? ((breakdown.imageObjectAgreement ?? 0.5) - 0.5) * 8
            : 0
        ) +
        (
          entry.score.diagnostics.imageColorComparable
            ? ((breakdown.imageColorAgreement ?? 0.5) - 0.5) * 4
            : 0
        ) +
        (
          entry.score.diagnostics.sourceIndicatorVisual
            ? ((breakdown.indicatorVisualScore ?? 0.5) - 0.5) * 18 +
              ((entry.score.diagnostics.dominantColorMatch ?? 0.5) - 0.5) * 6 +
              ((entry.score.diagnostics.imageObjectMatch ?? 0.5) - 0.5) * 8 -
              ((breakdown.missingImagePenalty ?? 0) * 0.35) -
              ((breakdown.imageFamilyMismatchPenalty ?? 0) * 0.25)
            : 0
        );
      const mcqEvidenceAdjustment = isMcq
        ? (
          ((breakdown.answerScore ?? breakdown.correctAnswerMeaning ?? 0.5) - 0.5) * 6 +
          ((breakdown.optionSetScore ?? breakdown.optionSimilarity ?? 0.5) - 0.5) * 6 +
          ((breakdown.optionKeywordScore ?? 0.5) - 0.5) * 4 -
          ((breakdown.contradictionPenalty ?? 0) * 6)
        )
        : 0;
      const rerankAdjustment = round(
        ((breakdown.structuralAgreement ?? 0.5) - 0.5) * (isMcq ? 14 : 26) +
        localizedAdjustment +
        numericGroupAdjustment +
        imageTagAdjustment -
        ((breakdown.structuralPenalty ?? 0) * 18) +
        mcqEvidenceAdjustment,
      );

      return {
        ...entry,
        score: {
          ...entry.score,
          total: round(entry.score.baseTotal + rerankAdjustment),
          rerankAdjustment,
          breakdown: {
            ...entry.score.breakdown,
            baseScore: round(entry.score.baseTotal),
            rerankAdjustment,
          },
        },
      };
    })
    .sort((left, right) => right.score.total - left.score.total);
}

function shortlistPlausibility(top, gap) {
  if (!top) {
    return false;
  }

  if (top.question.type === "MCQ") {
    return (
      top.score.total >= 38 &&
      gap >= 0 &&
      (top.score.breakdown.optionSetScore ?? top.score.breakdown.optionSimilarity ?? 0) >= 0.42 &&
      (top.score.breakdown.optionKeywordScore ?? 0) >= 0.3 &&
      (top.score.breakdown.answerScore ?? top.score.breakdown.correctAnswerMeaning ?? 0.5) >= 0.5 &&
      (top.score.breakdown.contradictionPenalty ?? 0) <= 0.45 &&
      (top.score.breakdown.numberConflictPenalty ?? 0) <= 0.45
    );
  }

  const promptish =
    top.score.breakdown.promptSimilarity >= 0.2 ||
    top.score.breakdown.optionSimilarity >= 0.22 ||
    top.score.breakdown.optionFingerprint >= 0.45 ||
    (top.score.breakdown.structuralAgreement ?? 0) >= 0.55 ||
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

  if ((score.breakdown.localizedOptionSimilarity ?? 0) >= 0.4) {
    notes.push("Locale-specific option corroboration strengthened the shortlist.");
  }

  if ((score.breakdown.localizedCorrectAnswerMeaning ?? 0) >= 0.75) {
    notes.push("Locale-specific correct-answer alignment reinforced the candidate.");
  }

  if ((score.breakdown.answerScore ?? 0) >= 0.8) {
    notes.push("Correct-answer gloss alignment strongly supported the candidate.");
  }

  if ((score.breakdown.optionSetScore ?? 0) >= 0.72) {
    notes.push("Order-agnostic MCQ option-set alignment separated the candidate from near-misses.");
  }

  if ((score.breakdown.optionSignatureScore ?? 0) >= 0.78) {
    notes.push("Canonical option-signature matching strongly supported the MCQ candidate.");
  }

  if ((score.breakdown.optionSignatureDominance ?? 0) >= 0.82) {
    notes.push("Option-signature evidence dominated final MCQ disambiguation.");
  }

  if ((score.breakdown.optionKeywordScore ?? 0) >= 0.42) {
    notes.push("Distinctive option-row keywords strongly supported the candidate.");
  }

  if ((score.breakdown.optionConceptCoverage ?? 0) >= 0.72) {
    notes.push("Whole-option-set concept coverage matched the candidate unusually well.");
  }

  if ((score.breakdown.multilingualSupportScore ?? 0) >= 0.48) {
    notes.push("Localized gloss and keyword evidence converged on the same candidate.");
  }

  if ((score.breakdown.visualScore ?? 0) >= 0.7 || (score.breakdown.visualObjectScore ?? 0) >= 0.78) {
    notes.push("Image-tag compatibility strongly supported the candidate before text reranking.");
  }

  if ((score.breakdown.indicatorVisualScore ?? 0) >= 0.72) {
    notes.push("Indicator visual tags, dominant colors, and image presence strengthened this candidate.");
  }

  if ((score.breakdown.missingImagePenalty ?? 0) > 0) {
    notes.push("Missing candidate image reduced rank for an image-backed indicator source.");
  }

  if ((score.breakdown.visualNumberScore ?? 0) >= 0.75) {
    notes.push("Visible numeral evidence matched the candidate image family.");
  }

  if ((score.breakdown.keywordScore ?? 0) >= 0.45) {
    notes.push("Distinctive keyword overlap strengthened the MCQ match.");
  }

  if ((score.breakdown.numberScore ?? 0) >= 0.7) {
    notes.push("Numeric or unit evidence matched between source and candidate.");
  }

  if ((score.breakdown.numericIntentMismatchPenalty ?? 0) >= 0.08) {
    notes.push("Numeric intent or prompt-family mismatch reduced confidence.");
  }

  if ((score.breakdown.promptFamilySupport ?? 0) >= 0.06) {
    notes.push("Question family alignment reinforced this candidate.");
  }

  if ((score.breakdown.promptFamilyMismatchPenalty ?? 0) >= 0.08) {
    notes.push("Indicator/sign/action family mismatch reduced confidence.");
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

  if ((score.breakdown.structuralAgreement ?? 0) >= 0.72) {
    notes.push("Structural filtering and scoring strongly agree with this candidate.");
  }

  if ((score.breakdown.structuralPenalty ?? 0) >= 0.18) {
    notes.push("Structural mismatch penalties reduced this candidate's rank.");
  }

  if ((score.breakdown.imageObjectAgreement ?? 0) >= 0.8) {
    notes.push("Source-side visual cues overlap with the candidate image tags.");
  }

  if ((score.breakdown.conceptAlignment ?? 0) >= 0.45) {
    notes.push("ROW concept slots aligned on condition/context/action.");
  }

  if ((score.breakdown.actionAlignment ?? 0) >= 0.5) {
    notes.push("Source-side action intent aligned strongly with the candidate.");
  }

  if ((score.breakdown.contextAlignment ?? 0) >= 0.5) {
    notes.push("Scenario context tags aligned strongly with the candidate.");
  }

  if ((score.breakdown.rowDistinctiveKeywordScore ?? 0) >= 0.45) {
    notes.push("Distinctive scenario keywords helped separate this candidate from nearby ROW variants.");
  }

  if ((score.breakdown.contradictionPenalty ?? 0) >= 0.18) {
    notes.push("Context or action contradictions reduced this candidate's rank.");
  }

  return notes;
}

const PROFILE_CONFIDENCE_RULES = {
  "mcq-text": {
    reviewFloorDelta: -2,
    autoMatchDelta: -2,
    gapDelta: -1,
    minStructural: 0.74,
    maxStructuralPenalty: 0.16,
    maxContradiction: 0.12,
    maxNumberConflict: 0.14,
    minOption: 0.72,
    minGloss: 0.18,
    minKeyword: 0.28,
    minImage: null,
    minConcept: null,
    minAgreement: 0.5,
    minStrongSignals: 3,
    strongSignalFloor: 0.52,
    weakSignalCeiling: 0.22,
    maxSignalSpread: 0.56,
    minSignalSeparation: 0.08,
  },
  "mcq-image": {
    reviewFloorDelta: -1,
    autoMatchDelta: -1,
    gapDelta: 0,
    minStructural: 0.74,
    maxStructuralPenalty: 0.16,
    maxContradiction: 0.12,
    maxNumberConflict: 0.14,
    minOption: 0.68,
    minGloss: 0.16,
    minKeyword: 0.24,
    minImage: 0.72,
    minConcept: null,
    minAgreement: 0.54,
    minStrongSignals: 3,
    strongSignalFloor: 0.54,
    weakSignalCeiling: 0.22,
    maxSignalSpread: 0.54,
    minSignalSeparation: 0.08,
  },
  "row-text": {
    reviewFloorDelta: -7,
    autoMatchDelta: -12,
    gapDelta: -3,
    minStructural: 0.78,
    maxStructuralPenalty: 0.16,
    maxContradiction: 0.14,
    maxNumberConflict: 0.2,
    minOption: 0.36,
    minGloss: 0.26,
    minKeyword: 0.22,
    minImage: null,
    minConcept: 0.42,
    minAgreement: 0.42,
    minStrongSignals: 2,
    strongSignalFloor: 0.46,
    weakSignalCeiling: 0.2,
    maxSignalSpread: 0.52,
    minSignalSeparation: 0.06,
  },
  "row-image": {
    reviewFloorDelta: -5,
    autoMatchDelta: -8,
    gapDelta: -2,
    minStructural: 0.76,
    maxStructuralPenalty: 0.16,
    maxContradiction: 0.14,
    maxNumberConflict: 0.2,
    minOption: 0.34,
    minGloss: 0.24,
    minKeyword: 0.2,
    minImage: 0.72,
    minConcept: 0.38,
    minAgreement: 0.48,
    minStrongSignals: 2,
    strongSignalFloor: 0.48,
    weakSignalCeiling: 0.2,
    maxSignalSpread: 0.52,
    minSignalSeparation: 0.06,
  },
};

function confidenceRuleForProfile(profile) {
  return PROFILE_CONFIDENCE_RULES[profile] ?? PROFILE_CONFIDENCE_RULES["mcq-text"];
}

function hasActionableMultilingualEvidence(top) {
  const diagnostics = top?.score?.diagnostics ?? {};
  const multilingualScore = top?.score?.breakdown?.multilingualSupportScore ?? 0;

  return (
    diagnostics.localizedMirrorUsed === true &&
    Boolean(diagnostics.localizedMirrorLabel) &&
    multilingualScore > 0.24
  );
}

function decisionSignalVector(top) {
  const breakdown = top?.score?.breakdown ?? {};
  const mcqOptionSimilarity = Math.max(
    breakdown.optionSimilarity ?? 0.5,
    breakdown.localizedOptionSimilarity ?? 0.5,
    breakdown.localizedOptionGlossSimilarity ?? 0.5,
    breakdown.optionFingerprint ?? 0.5,
    breakdown.optionSignatureScore ?? 0.5,
    breakdown.optionSignatureDominance ?? 0.5,
  );
  const mcqAnswerMeaning = Math.max(
    breakdown.answerScore ?? 0.5,
    breakdown.correctAnswerMeaning ?? 0.5,
    breakdown.localizedCorrectAnswerMeaning ?? 0.5,
    breakdown.localizedCorrectGlossMeaning ?? 0.5,
  );
  const mcqOptionStructure = Math.max(
    breakdown.optionSetScore ?? 0.5,
    breakdown.optionExactSet ?? 0.5,
    breakdown.optionRareCoverage ?? 0.5,
    breakdown.optionConceptCoverage ?? 0.5,
    breakdown.optionConceptPairing ?? 0.5,
  );
  const mcqOptionKeyword = Math.max(
    breakdown.optionKeywordScore ?? 0.5,
    breakdown.optionRowKeywordScore ?? 0.5,
    breakdown.optionConceptKeywordScore ?? 0.5,
  );

  return {
    option: top?.question?.type === "MCQ"
      ? Math.max(
        mcqOptionSimilarity,
        (mcqOptionSimilarity * 0.42) +
        (mcqAnswerMeaning * 0.24) +
        (mcqOptionStructure * 0.18) +
        (mcqOptionKeyword * 0.16),
      )
      : Math.max(
        breakdown.optionSimilarity ?? 0,
        breakdown.conceptAlignment ?? 0,
        breakdown.answerPolarity ?? 0,
        breakdown.numericGroupScore ?? 0,
      ),
    gloss: Math.max(
      breakdown.glossScore ?? 0,
      breakdown.promptSimilarity ?? 0,
      breakdown.localizedGlossSimilarity ?? 0,
      breakdown.bridgePromptSimilarity ?? 0,
    ),
    keyword: Math.max(
      breakdown.keywordScore ?? 0,
      breakdown.localizedKeywordSupport ?? 0,
      breakdown.bridgeKeywordScore ?? 0,
      breakdown.numericGroupScore ?? 0,
    ),
    image: Math.max(
      breakdown.imageScore ?? 0,
      breakdown.visualScore ?? 0,
      breakdown.imageObjectAgreement ?? 0,
    ),
    multilingual: breakdown.multilingualSupportScore ?? breakdown.localizedAgreement ?? 0,
    concept: Math.max(
      breakdown.conceptAlignment ?? 0,
      breakdown.optionSimilarity ?? 0,
      breakdown.numericGroupScore ?? 0,
    ),
  };
}

function relevantSignalNamesForProfile(profile, top) {
  const localizedAvailable = hasActionableMultilingualEvidence(top);

  switch (profile) {
    case "mcq-image":
      return ["option", "gloss", "keyword", "image", ...(localizedAvailable ? ["multilingual"] : [])];
    case "row-text":
      return ["gloss", "keyword", "concept", ...(localizedAvailable ? ["multilingual"] : [])];
    case "row-image":
      return ["gloss", "keyword", "image", "concept", ...(localizedAvailable ? ["multilingual"] : [])];
    case "mcq-text":
    default:
      return ["option", "gloss", "keyword", ...(localizedAvailable ? ["multilingual"] : [])];
  }
}

function computeSignalAgreement(profile, top) {
  const rule = confidenceRuleForProfile(profile);
  const signalVector = decisionSignalVector(top);
  const relevantNames = relevantSignalNamesForProfile(profile, top);
  const relevantValues = relevantNames.map((name) => signalVector[name]).filter((value) => Number.isFinite(value));
  const strongCount = relevantValues.filter((value) => value >= rule.strongSignalFloor).length;
  const weakCount = relevantValues.filter((value) => value <= rule.weakSignalCeiling).length;
  const minValue = relevantValues.length > 0 ? Math.min(...relevantValues) : 0;
  const maxValue = relevantValues.length > 0 ? Math.max(...relevantValues) : 0;
  const signalSpread = maxValue - minValue;
  const optionVsBridgeConflict =
    profile.startsWith("mcq") &&
    signalVector.option >= Math.max(rule.minOption, 0.72) &&
    signalVector.gloss <= 0.14 &&
    signalVector.multilingual <= 0.24;
  const imageVsTextConflict =
    profile.endsWith("image") &&
    signalVector.image >= Math.max(rule.minImage ?? 0.7, 0.7) &&
    signalVector.gloss <= 0.12 &&
    signalVector.keyword <= 0.18;
  const spreadConflict =
    profile.startsWith("mcq")
      ? (
        strongCount >= Math.max(1, rule.minStrongSignals - 1) &&
        weakCount > 0 &&
        signalSpread >= rule.maxSignalSpread
      )
      : (
        strongCount >= rule.minStrongSignals &&
        weakCount > 1 &&
        signalSpread >= rule.maxSignalSpread + 0.06
      );
  const signalConflict =
    optionVsBridgeConflict ||
    imageVsTextConflict ||
    spreadConflict;

  return {
    signalVector,
    relevantNames,
    strongCount,
    weakCount,
    signalSpread,
    agreementScore: average(relevantValues),
    signalConflict,
  };
}

function computeSignalSeparation(profile, top, runnerUp) {
  if (!top || !runnerUp) {
    return {
      signalSeparation: 1,
      tooClose: false,
    };
  }

  const names = relevantSignalNamesForProfile(profile, top);
  const topSignals = decisionSignalVector(top);
  const runnerSignals = decisionSignalVector(runnerUp);
  const differences = names.map((name) => Math.abs((topSignals[name] ?? 0) - (runnerSignals[name] ?? 0)));
  const signalSeparation = average(differences);
  const rule = confidenceRuleForProfile(profile);

  return {
    signalSeparation,
    tooClose: signalSeparation < rule.minSignalSeparation,
  };
}

function evaluateProfileEvidence(profile, top, signalAgreement) {
  const rule = confidenceRuleForProfile(profile);
  const reasons = [];
  const breakdown = top?.score?.breakdown ?? {};
  const signals = signalAgreement.signalVector;

  if ((top?.score?.breakdown?.structuralAgreement ?? 0) < rule.minStructural) {
    reasons.push("structural-weak");
  }

  if ((top?.score?.breakdown?.structuralPenalty ?? 0) > rule.maxStructuralPenalty) {
    reasons.push("structural-penalty");
  }

  if ((breakdown.contradictionPenalty ?? 0) > rule.maxContradiction) {
    reasons.push("contradiction");
  }

  if ((breakdown.numberConflictPenalty ?? 0) > rule.maxNumberConflict) {
    reasons.push("number-conflict");
  }

  if ((breakdown.numericIntentMismatchPenalty ?? 0) >= 0.08) {
    reasons.push("numeric-mismatch");
  }

  if ((breakdown.numericGroupPenalty ?? 0) >= 0.45) {
    reasons.push("numeric-group-mismatch");
  }

  if ((breakdown.promptFamilyMismatchPenalty ?? 0) >= 0.08) {
    reasons.push("family-mismatch");
  }

  if (signals.option < rule.minOption) {
    reasons.push("option-weak");
  }

  if (signals.gloss < rule.minGloss) {
    reasons.push("gloss-weak");
  }

  if (signals.keyword < rule.minKeyword) {
    reasons.push("keyword-weak");
  }

  if (rule.minImage !== null && signals.image < rule.minImage) {
    reasons.push("image-weak");
  }

  if (
    rule.minConcept !== null &&
    signals.concept < rule.minConcept &&
    signals.keyword < rule.minKeyword
  ) {
    reasons.push("concept-weak");
  }

  if (hasActionableMultilingualEvidence(top) && signals.multilingual <= 0.24) {
    reasons.push("multilingual-weak");
  }

  if (signalAgreement.strongCount < rule.minStrongSignals || signalAgreement.agreementScore < rule.minAgreement) {
    reasons.push("signal-agreement-low");
  }

  if (signalAgreement.signalConflict) {
    reasons.push("signal-conflict");
  }

  return unique(reasons);
}

function computeDiscriminativeEvidence(profile, top, runnerUp) {
  if (!top || !runnerUp) {
    return {
      uniqueSupportCount: 0,
      promptMargin: 1,
      keywordMargin: 1,
      distinctiveKeywordMargin: 1,
      conceptMargin: 1,
      optionSetMargin: 1,
      optionSignatureMargin: 1,
      optionConceptMargin: 1,
      optionDominanceMargin: 1,
      promptCompatibilityMargin: 1,
      contrastMargin: 1,
      contradictionMargin: 1,
      structuralMargin: 1,
      actionMargin: 1,
      contextMargin: 1,
      obligationMargin: 1,
      familyMargin: 1,
      top2SemanticNearDuplicate: false,
      contrastUnclear: false,
      actionConflict: false,
      obligationMismatch: false,
      contextMismatch: false,
      negationConflict: false,
      weakActionSeparation: false,
      weakFamilySeparation: false,
      mcqTop2OptionSeparated: false,
      optionSetNearMatch: false,
      optionSetMismatch: false,
      promptCompatibleOptionDominant: false,
      insufficientDiscriminativeEvidence: false,
    };
  }

  const topBreakdown = top.score?.breakdown ?? {};
  const runnerBreakdown = runnerUp.score?.breakdown ?? {};
  const topDiagnostics = top.score?.diagnostics ?? {};
  const runnerDiagnostics = runnerUp.score?.diagnostics ?? {};
  const rowProfile = profile.startsWith("row");
  const promptMargin = (topBreakdown.promptSimilarity ?? 0) - (runnerBreakdown.promptSimilarity ?? 0);
  const keywordMargin = (topBreakdown.keywordScore ?? 0) - (runnerBreakdown.keywordScore ?? 0);
  const distinctiveKeywordMargin =
    (topBreakdown.rowDistinctiveKeywordScore ?? topBreakdown.keywordScore ?? 0) -
    (runnerBreakdown.rowDistinctiveKeywordScore ?? runnerBreakdown.keywordScore ?? 0);
  const conceptMargin = (topBreakdown.conceptAlignment ?? 0) - (runnerBreakdown.conceptAlignment ?? 0);
  const optionSetMargin = (topBreakdown.optionSetScore ?? 0) - (runnerBreakdown.optionSetScore ?? 0);
  const optionSignatureMargin =
    (topBreakdown.optionSignatureScore ?? topBreakdown.optionSetScore ?? 0) -
    (runnerBreakdown.optionSignatureScore ?? runnerBreakdown.optionSetScore ?? 0);
  const optionConceptMargin =
    (topBreakdown.optionConceptCoverage ?? topBreakdown.optionRareCoverage ?? 0) -
    (runnerBreakdown.optionConceptCoverage ?? runnerBreakdown.optionRareCoverage ?? 0);
  const optionDominanceMargin =
    (topBreakdown.optionSignatureDominance ?? topBreakdown.optionSignatureScore ?? 0) -
    (runnerBreakdown.optionSignatureDominance ?? runnerBreakdown.optionSignatureScore ?? 0);
  const promptCompatibilityMargin =
    (topBreakdown.promptFamilyAgreement ?? 0) -
    (runnerBreakdown.promptFamilyAgreement ?? 0);
  const contrastMargin =
    (runnerBreakdown.rowContrastPenalty ?? runnerBreakdown.contradictionPenalty ?? 0) -
    (topBreakdown.rowContrastPenalty ?? topBreakdown.contradictionPenalty ?? 0);
  const contradictionMargin =
    (runnerBreakdown.contradictionPenalty ?? 0) -
    (topBreakdown.contradictionPenalty ?? 0);
  const structuralMargin = (topBreakdown.structuralAgreement ?? 0) - (runnerBreakdown.structuralAgreement ?? 0);
  const actionMargin = (topBreakdown.actionAlignment ?? 0) - (runnerBreakdown.actionAlignment ?? 0);
  const contextMargin = (topBreakdown.contextAlignment ?? 0) - (runnerBreakdown.contextAlignment ?? 0);
  const obligationMargin = (topBreakdown.obligationAlignment ?? 0) - (runnerBreakdown.obligationAlignment ?? 0);
  const familyMargin = (topBreakdown.promptFamilyAgreement ?? 0.5) - (runnerBreakdown.promptFamilyAgreement ?? 0.5);
  const topContrastSignals = unique(toList(topDiagnostics.rowContrastSignals));
  const sourcePromptFamilyBucket = topDiagnostics.sourcePromptFamilyBucket ?? null;
  const topPromptFamilyBucket = topDiagnostics.candidatePromptFamilyBucket ?? null;
  const runnerPromptFamilyBucket = runnerDiagnostics.candidatePromptFamilyBucket ?? null;
  const uniqueSupportCount = [
    promptMargin >= 0.08,
    keywordMargin >= 0.12,
    distinctiveKeywordMargin >= 0.14,
    conceptMargin >= 0.16,
    actionMargin >= 0.14,
    contextMargin >= 0.14,
    obligationMargin >= 0.2,
    contrastMargin >= 0.12,
    contradictionMargin >= 0.12,
    structuralMargin >= 0.08,
    familyMargin >= 0.1,
  ].filter(Boolean).length;
  const top2SemanticNearDuplicate =
    rowProfile &&
    uniqueSupportCount <= 1 &&
    promptMargin < 0.1 &&
    keywordMargin < 0.14 &&
    distinctiveKeywordMargin < 0.16 &&
    conceptMargin < 0.16 &&
    actionMargin < 0.14 &&
    contextMargin < 0.14;
  const contrastUnclear =
    rowProfile &&
    contrastMargin < 0.1 &&
    contradictionMargin < 0.1 &&
    (
      top2SemanticNearDuplicate ||
      (promptMargin < 0.08 && distinctiveKeywordMargin < 0.14 && conceptMargin < 0.14 && actionMargin < 0.14)
    );
  const actionConflict = rowProfile && topContrastSignals.some((signal) => String(signal).startsWith("action:"));
  const obligationMismatch = rowProfile && topContrastSignals.some((signal) => String(signal).startsWith("obligation:"));
  const contextMismatch =
    rowProfile &&
    topContrastSignals.some((signal) =>
      String(signal).startsWith("context:") ||
      String(signal).startsWith("condition:"),
    );
  const sourcePolarity = topDiagnostics.sourceConceptSlots?.polarity ?? null;
  const topPolarity = topDiagnostics.candidateConceptSlots?.polarity ?? null;
  const negationConflict =
    rowProfile &&
    (
      topContrastSignals.some((signal) => String(signal).startsWith("negation:")) ||
      (Boolean(sourcePolarity) && Boolean(topPolarity) && topPolarity !== sourcePolarity)
    );
  const weakActionSeparation =
    rowProfile &&
    toList(topDiagnostics.sourceConceptSlots?.action).length > 0 &&
    (topBreakdown.actionAlignment ?? 0) < 0.72 &&
    actionMargin < 0.12 &&
    conceptMargin < 0.16;
  const weakFamilySeparation =
    Boolean(sourcePromptFamilyBucket) &&
    familyMargin < 0.08 &&
    (
      topPromptFamilyBucket === sourcePromptFamilyBucket &&
      runnerPromptFamilyBucket === sourcePromptFamilyBucket
    );
  const mcqProfile = profile.startsWith("mcq");
  const mcqTop2OptionSeparated =
    mcqProfile &&
    (
      optionDominanceMargin >= 0.1 ||
      optionSignatureMargin >= 0.12 ||
      (optionSetMargin >= 0.08 && optionConceptMargin >= 0.08) ||
      (optionSignatureMargin >= 0.08 && promptCompatibilityMargin >= 0.08)
    );
  const optionSetNearMatch =
    mcqProfile &&
    !mcqTop2OptionSeparated &&
    (
      (topBreakdown.optionSignatureScore ?? 0) >= 0.74 ||
      (topBreakdown.optionSetScore ?? 0) >= 0.72
    ) &&
    optionDominanceMargin < 0.1 &&
    optionSignatureMargin < 0.12;
  const optionSetMismatch =
    mcqProfile &&
    (topBreakdown.optionSignatureScore ?? 0) < 0.6 &&
    (topBreakdown.optionSetScore ?? 0) < 0.58;
  const promptCompatibleOptionDominant =
    mcqProfile &&
    (topBreakdown.promptFamilyAgreement ?? 0) >= 0.78 &&
    (topBreakdown.optionSignatureScore ?? 0) >= 0.84 &&
    (topBreakdown.optionSignatureDominance ?? 0) >= 0.82 &&
    (topBreakdown.contradictionPenalty ?? 0) <= 0.08 &&
    mcqTop2OptionSeparated;

  return {
    uniqueSupportCount,
    promptMargin,
    keywordMargin,
    distinctiveKeywordMargin,
    conceptMargin,
    optionSetMargin,
    optionSignatureMargin,
    optionConceptMargin,
    optionDominanceMargin,
    promptCompatibilityMargin,
    contrastMargin,
    contradictionMargin,
    structuralMargin,
    actionMargin,
    contextMargin,
    obligationMargin,
    familyMargin,
    top2SemanticNearDuplicate,
    contrastUnclear,
    actionConflict,
    obligationMismatch,
    contextMismatch,
    negationConflict,
    weakActionSeparation,
    weakFamilySeparation,
    mcqTop2OptionSeparated,
    optionSetNearMatch,
    optionSetMismatch,
    promptCompatibleOptionDominant,
    insufficientDiscriminativeEvidence:
      rowProfile &&
      uniqueSupportCount < 2 &&
      (top2SemanticNearDuplicate || contrastUnclear || weakActionSeparation || weakFamilySeparation),
  };
}

function effectiveGapThresholdForDecision(profile, top, signalAgreement, separation, discriminative, thresholds) {
  const signals = signalAgreement.signalVector;
  const baseGapThreshold = thresholds.autoGapThreshold;

  if (
    profile.startsWith("mcq") &&
    top.score.total >= thresholds.autoMatchThreshold &&
    signalAgreement.agreementScore >= 0.62 &&
    signalAgreement.strongCount >= 3 &&
    signalAgreement.weakCount <= 1 &&
    signalAgreement.signalConflict === false &&
    (top?.score?.breakdown?.optionSignatureScore ?? 0) >= 0.84 &&
    (top?.score?.breakdown?.optionSignatureDominance ?? 0) >= 0.82 &&
    (top?.score?.breakdown?.promptFamilyAgreement ?? 0) >= 0.78 &&
    (top?.score?.breakdown?.contradictionPenalty ?? 0) <= 0.08 &&
    (top?.score?.breakdown?.numberConflictPenalty ?? 0) <= 0.12 &&
    discriminative.mcqTop2OptionSeparated &&
    (profile !== "mcq-image" || signals.image >= 0.74)
  ) {
    return {
      value: Math.max(5, baseGapThreshold - 4),
      relaxationCode: "prompt-compatible-option-dominant",
    };
  }

  if (
    profile === "mcq-image" &&
    top.score.total >= thresholds.autoMatchThreshold + 10 &&
    signalAgreement.agreementScore >= 0.72 &&
    signalAgreement.strongCount >= 4 &&
    signalAgreement.weakCount === 0 &&
    signalAgreement.signalConflict === false &&
    separation.signalSeparation >= 0.1 &&
    signals.option >= 0.8 &&
    signals.image >= 0.9 &&
    signals.gloss >= 0.5 &&
    (top?.score?.breakdown?.contradictionPenalty ?? 0) === 0
  ) {
    return {
      value: Math.max(4, baseGapThreshold - 5),
      relaxationCode: "gap-relaxed-strong-evidence",
    };
  }

  if (
    profile === "row-text" &&
    top.score.total >= thresholds.autoMatchThreshold &&
    signalAgreement.agreementScore >= 0.6 &&
    signalAgreement.strongCount >= 3 &&
    signalAgreement.weakCount === 0 &&
    signalAgreement.signalConflict === false &&
    separation.signalSeparation >= 0.09 &&
    signals.gloss >= 0.28 &&
    signals.keyword >= 0.6 &&
    signals.concept >= 0.65 &&
    (top?.score?.breakdown?.contradictionPenalty ?? 0) === 0
  ) {
    return {
      value: Math.max(4, baseGapThreshold - 2),
      relaxationCode: "gap-relaxed-profile",
    };
  }

  return {
    value: baseGapThreshold,
    relaxationCode: null,
  };
}

function evaluateAutoMatchDecision({
  itemShape,
  top,
  runnerUp,
  gap,
  thresholds,
  gatingAdjustments,
}) {
  if (!top) {
    return {
      profile: matchSignalProfile(itemShape, { hasImage: itemShape?.declaredHasImage ?? false }),
      thresholds,
      autoMatched: false,
      reasonCodes: ["no-top-candidate"],
      signalAgreement: null,
      separation: null,
    };
  }

  const profile = top.score?.diagnostics?.matchingProfile ?? matchSignalProfile(itemShape, { hasImage: top.question?.image?.hasImage === true });
  const rule = confidenceRuleForProfile(profile);
  const calibratedThresholds = {
    reviewFloor: round(Math.max(0, thresholds.reviewFloor + rule.reviewFloorDelta + (gatingAdjustments?.reviewFloorDelta ?? 0))),
    autoMatchThreshold: round(Math.max(0, thresholds.autoMatchThreshold + rule.autoMatchDelta + (gatingAdjustments?.autoMatchThresholdDelta ?? 0))),
    autoGapThreshold: round(Math.max(0, thresholds.autoGapThreshold + rule.gapDelta + (gatingAdjustments?.autoGapThresholdDelta ?? 0))),
  };
  const signalAgreement = computeSignalAgreement(profile, top);
  const separation = computeSignalSeparation(profile, top, runnerUp);
  const discriminative = computeDiscriminativeEvidence(profile, top, runnerUp);
  const effectiveGapThreshold = effectiveGapThresholdForDecision(
    profile,
    top,
    signalAgreement,
    separation,
    discriminative,
    calibratedThresholds,
  );
  const reasonCodes = [];

  if (gatingAdjustments?.forceReview) {
    reasonCodes.push("force-review");
  }

  if (top.score.total < calibratedThresholds.reviewFloor) {
    reasonCodes.push("review-floor");
  }

  if (top.score.total < calibratedThresholds.autoMatchThreshold) {
    reasonCodes.push("total-low");
  }

  if (gap < effectiveGapThreshold.value) {
    reasonCodes.push("gap-small");
  }

  if (separation.tooClose && !discriminative.mcqTop2OptionSeparated) {
    reasonCodes.push("signal-separation-low");
  }

  if (runnerUp && separation.tooClose && gap < effectiveGapThreshold.value + 3 && !discriminative.mcqTop2OptionSeparated) {
    reasonCodes.push("runner-up-close");
  }

  reasonCodes.push(...evaluateProfileEvidence(profile, top, signalAgreement));

  if (profile.startsWith("mcq")) {
    if ((top.score.breakdown.optionSignatureScore ?? 0) < 0.64) {
      reasonCodes.push("option-signature-weak");
    }

    if (discriminative.optionSetNearMatch) {
      reasonCodes.push("option-set-near-match");
    }

    if (discriminative.optionSetMismatch) {
      reasonCodes.push("option-set-mismatch");
    }
  }

  reasonCodes.push(...toList(top.score.diagnostics?.promptFamilyReasonCodes));
  reasonCodes.push(...toList(top.score.diagnostics?.numericIntentReasonCodes));

  if (discriminative.top2SemanticNearDuplicate) {
    reasonCodes.push("top2-semantic-near-duplicate");
  }

  if (discriminative.contrastUnclear) {
    reasonCodes.push("contrast-unclear");
  }

  if (discriminative.actionConflict) {
    reasonCodes.push("action-conflict");
  }

  if (discriminative.obligationMismatch) {
    reasonCodes.push("obligation-mismatch");
  }

  if (discriminative.contextMismatch) {
    reasonCodes.push("context-mismatch");
  }

  if (discriminative.negationConflict) {
    reasonCodes.push("negation-conflict");
  }

  if (discriminative.weakActionSeparation) {
    reasonCodes.push("weak-action-separation");
  }

  if (discriminative.weakFamilySeparation) {
    reasonCodes.push("weak-family-separation");
  }

  if (discriminative.insufficientDiscriminativeEvidence) {
    reasonCodes.push("insufficient-discriminative-evidence");
  }

  const profilePass =
    !gatingAdjustments?.forceReview &&
    top.score.total >= calibratedThresholds.autoMatchThreshold &&
    gap >= effectiveGapThreshold.value &&
    !separation.tooClose &&
    !reasonCodes.some((code) => [
      "structural-weak",
      "structural-penalty",
      "contradiction",
      "number-conflict",
      "numeric-mismatch",
      "numeric-group-mismatch",
      "unit-mismatch",
      "max-vs-min-conflict",
      "duration-vs-penalty-conflict",
      "prompt-family-mismatch",
      "family-mismatch",
      "indicator-vs-sign-conflict",
      "indicator-vs-action-conflict",
      "sign-vs-action-conflict",
      "gap-small",
      "signal-separation-low",
      "runner-up-close",
      "option-signature-weak",
      "option-set-near-match",
      "option-set-mismatch",
      "top2-semantic-near-duplicate",
      "contrast-unclear",
      "action-conflict",
      "obligation-mismatch",
      "context-mismatch",
      "negation-conflict",
      "weak-action-separation",
      "weak-family-separation",
      "insufficient-discriminative-evidence",
      "signal-agreement-low",
      "signal-conflict",
      "option-weak",
      "gloss-weak",
      "keyword-weak",
      "image-weak",
      "concept-weak",
      "multilingual-weak",
    ].includes(code));
  const mcqOptionDominanceOverride =
    !gatingAdjustments?.forceReview &&
    profile.startsWith("mcq") &&
    top.score.total >= calibratedThresholds.autoMatchThreshold - 3 &&
    gap >= Math.max(8, calibratedThresholds.autoGapThreshold + 2) &&
    !separation.tooClose &&
    signalAgreement.signalConflict === false &&
    (top.score.breakdown.optionSetScore ?? 0) >= 0.95 &&
    (top.score.breakdown.optionSignatureScore ?? 0) >= 0.8 &&
    (top.score.breakdown.optionSignatureDominance ?? 0) >= 0.83 &&
    (top.score.breakdown.optionKeywordScore ?? top.score.breakdown.optionRowKeywordScore ?? 0) >= 0.8 &&
    (top.score.breakdown.structuralAgreement ?? 0) >= 0.8 &&
    (top.score.breakdown.promptFamilyAgreement ?? 0) >= 0.5 &&
    (top.score.breakdown.contradictionPenalty ?? 0) <= 0.04 &&
    (top.score.breakdown.numericIntentMismatchPenalty ?? 0) <= 0.04 &&
    (top.score.breakdown.numberConflictPenalty ?? 0) <= 0.08 &&
    (profile !== "mcq-image" || (signalAgreement.signalVector.image ?? 0) >= 0.72);
  const fallbackPass = safeAutoMatch(itemShape, top, gap);
  const autoMatched = profilePass || mcqOptionDominanceOverride || fallbackPass;
  const successReasonCodes = [];

  if (autoMatched) {
    successReasonCodes.push(
      profilePass
        ? (effectiveGapThreshold.relaxationCode ?? "profile-pass")
        : mcqOptionDominanceOverride
        ? "option-signature-dominant"
        : "safe-pass",
    );

    if (profile.startsWith("mcq")) {
      if ((top.score.breakdown.optionSignatureScore ?? 0) >= 0.82) {
        successReasonCodes.push("option-signature-strong");
      }

      if ((top.score.breakdown.optionSignatureDominance ?? 0) >= 0.84) {
        successReasonCodes.push("option-signature-dominant");
      }

      if (discriminative.mcqTop2OptionSeparated) {
        successReasonCodes.push("mcq-top2-option-separated");
      }

      if (discriminative.promptCompatibleOptionDominant) {
        successReasonCodes.push("prompt-compatible-option-dominant");
      }
    }
  }

  return {
    profile,
    thresholds: calibratedThresholds,
    autoMatched,
    reasonCodes: autoMatched ? unique(successReasonCodes).slice(0, 4) : prioritizeReasonCodes(reasonCodes, 8),
    signalAgreement: {
      agreementScore: round(signalAgreement.agreementScore),
      strongSignalCount: signalAgreement.strongCount,
      weakSignalCount: signalAgreement.weakCount,
      signalSpread: round(signalAgreement.signalSpread),
      signalConflict: signalAgreement.signalConflict,
      signalVector: Object.fromEntries(
        Object.entries(signalAgreement.signalVector).map(([key, value]) => [key, round(value)]),
      ),
    },
    separation: {
      signalSeparation: round(separation.signalSeparation),
      tooClose: separation.tooClose,
    },
    discriminative: {
      uniqueSupportCount: discriminative.uniqueSupportCount,
      promptMargin: round(discriminative.promptMargin),
      keywordMargin: round(discriminative.keywordMargin),
      distinctiveKeywordMargin: round(discriminative.distinctiveKeywordMargin),
      conceptMargin: round(discriminative.conceptMargin),
      optionSetMargin: round(discriminative.optionSetMargin),
      optionSignatureMargin: round(discriminative.optionSignatureMargin),
      optionConceptMargin: round(discriminative.optionConceptMargin),
      optionDominanceMargin: round(discriminative.optionDominanceMargin),
      promptCompatibilityMargin: round(discriminative.promptCompatibilityMargin),
      contrastMargin: round(discriminative.contrastMargin),
      contradictionMargin: round(discriminative.contradictionMargin),
      structuralMargin: round(discriminative.structuralMargin),
      top2SemanticNearDuplicate: discriminative.top2SemanticNearDuplicate,
      contrastUnclear: discriminative.contrastUnclear,
      actionConflict: discriminative.actionConflict,
      negationConflict: discriminative.negationConflict,
      mcqTop2OptionSeparated: discriminative.mcqTop2OptionSeparated,
      optionSetNearMatch: discriminative.optionSetNearMatch,
      optionSetMismatch: discriminative.optionSetMismatch,
      promptCompatibleOptionDominant: discriminative.promptCompatibleOptionDominant,
      insufficientDiscriminativeEvidence: discriminative.insufficientDiscriminativeEvidence,
    },
    gapThreshold: {
      configured: calibratedThresholds.autoGapThreshold,
      effective: effectiveGapThreshold.value,
      relaxationCode: effectiveGapThreshold.relaxationCode,
    },
  };
}

function safeAutoMatch(itemShape, top, gap) {
  if (!top) {
    return false;
  }

  const structuralReady =
    (top.score.breakdown.structuralAgreement ?? 0) >= 0.72 &&
    (top.score.breakdown.structuralPenalty ?? 0) <= 0.18 &&
    (top.score.breakdown.optionCountAgreement ?? 0.5) >= 0.75 &&
    (itemShape.effectiveType !== "ROW" || (top.score.breakdown.answerStructureAgreement ?? 0.5) >= 0.8);

  if (!structuralReady) {
    return false;
  }

  if (itemShape.effectiveType === "MCQ") {
    const answerScore = top.score.breakdown.answerScore ?? top.score.breakdown.correctAnswerMeaning ?? 0;
    const optionSetScore = top.score.breakdown.optionSetScore ?? top.score.breakdown.optionSimilarity ?? 0;
    const optionSignatureScore = top.score.breakdown.optionSignatureScore ?? optionSetScore;
    const optionSignatureDominance = top.score.breakdown.optionSignatureDominance ?? optionSignatureScore;
    const optionKeywordScore = top.score.breakdown.optionKeywordScore ?? top.score.breakdown.optionRowKeywordScore ?? 0;
    const promptScore = top.score.breakdown.promptScore ?? top.score.breakdown.promptSimilarity ?? 0;
    const promptFamilyAgreement = top.score.breakdown.promptFamilyAgreement ?? 0.5;
    const visualScore = top.score.breakdown.visualScore ?? 0.5;
    const visualObjectScore = top.score.breakdown.visualObjectScore ?? 0.5;
    const visualNumberScore = top.score.breakdown.visualNumberScore ?? 0.5;
    const visualComparable = top.score.diagnostics?.visualComparable === true;
    const contradictionPenalty = top.score.breakdown.contradictionPenalty ?? 0;
    const promptFamilyMismatchPenalty = top.score.breakdown.promptFamilyMismatchPenalty ?? 0;
    const numericIntentMismatchPenalty = top.score.breakdown.numericIntentMismatchPenalty ?? 0;
    const numberConflictPenalty = top.score.breakdown.numberConflictPenalty ?? 0;
    const numberComparable = top.score.diagnostics?.numberComparable === true;

    return (
      (
        top.score.total >= 78 &&
        gap >= 12 &&
        top.score.breakdown.questionType >= 1 &&
        answerScore >= 0.84 &&
        optionSetScore >= 0.78 &&
        optionSignatureScore >= 0.8 &&
        optionKeywordScore >= 0.46 &&
        promptScore >= 0.15 &&
        (
          visualComparable !== true ||
          visualScore >= 0.74 ||
          visualObjectScore >= 0.8 ||
          visualNumberScore >= 0.84
        ) &&
        contradictionPenalty <= 0.1 &&
        promptFamilyMismatchPenalty <= 0.08 &&
        numericIntentMismatchPenalty <= 0.08 &&
        numberConflictPenalty <= 0.12 &&
        (
          (top.score.breakdown.numberScore ?? 0.5) >= 0.55 ||
          numberComparable !== true
        )
      ) || (
        top.score.total >= 74 &&
        gap >= 14 &&
        top.score.breakdown.questionType >= 1 &&
        answerScore >= 0.92 &&
        optionSetScore >= 0.82 &&
        optionSignatureScore >= 0.84 &&
        optionKeywordScore >= 0.52 &&
        promptScore >= 0.12 &&
        (
          visualComparable !== true ||
          visualScore >= 0.78 ||
          visualObjectScore >= 0.84 ||
          visualNumberScore >= 0.88
        ) &&
        contradictionPenalty <= 0.08 &&
        promptFamilyMismatchPenalty <= 0.08 &&
        numericIntentMismatchPenalty <= 0.08 &&
        numberConflictPenalty <= 0.08 &&
        (
          (top.score.breakdown.numberScore ?? 0.5) >= 0.72 ||
          numberComparable !== true
        )
      ) || (
        top.score.total >= 74 &&
        gap >= 8 &&
        top.score.breakdown.questionType >= 1 &&
        answerScore >= 0.82 &&
        optionSetScore >= 0.78 &&
        optionSignatureScore >= 0.86 &&
        optionSignatureDominance >= 0.84 &&
        optionKeywordScore >= 0.44 &&
        promptFamilyAgreement >= 0.78 &&
        promptScore >= 0.12 &&
        (
          visualComparable !== true ||
          visualScore >= 0.72 ||
          visualObjectScore >= 0.78 ||
          visualNumberScore >= 0.82
        ) &&
        contradictionPenalty <= 0.08 &&
        promptFamilyMismatchPenalty <= 0.04 &&
        numericIntentMismatchPenalty <= 0.04 &&
        numberConflictPenalty <= 0.12 &&
        (
          (top.score.breakdown.numberScore ?? 0.5) >= 0.55 ||
          numberComparable !== true
        )
      )
    );
  }

  return (
    (
      top.score.total >= 60 &&
      gap >= 8 &&
      top.score.breakdown.questionType >= 1 &&
      top.score.breakdown.promptSimilarity >= 0.28
    ) || (
      top.score.total >= 52 &&
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

const MATCH_SIGNAL_PROFILES = {
  "mcq-image": {
    option: 0.42,
    gloss: 0.16,
    keyword: 0.08,
    image: 0.22,
    multilingual: 0.12,
  },
  "mcq-text": {
    option: 0.5,
    gloss: 0.18,
    keyword: 0.1,
    image: 0.04,
    multilingual: 0.18,
  },
  "row-image": {
    option: 0.08,
    gloss: 0.34,
    keyword: 0.14,
    image: 0.28,
    multilingual: 0.16,
  },
  "row-text": {
    option: 0.08,
    gloss: 0.44,
    keyword: 0.24,
    image: 0.02,
    multilingual: 0.22,
  },
};

function matchSignalProfile(itemShape, item) {
  const type = itemShape?.effectiveType === "MCQ" ? "mcq" : "row";
  return `${type}-${item?.hasImage === true ? "image" : "text"}`;
}

function sourceFeatureTopicKeywords(sourceMetadata) {
  return unique([
    sourceMetadata?.provisionalTopic,
    ...toList(sourceMetadata?.provisionalSubtopics),
  ]
    .filter(Boolean)
    .flatMap((tag) => String(tag).toLowerCase().split(/[:\s]+/))
    .map((token) => token.replace(/[^a-z0-9-]+/g, ""))
    .filter(Boolean));
}

function buildSourceFeatureBridge(item, itemShape, sourceMetadata, sourceLang) {
  return deriveSourceItemFeatureBridge({
    lang: sourceLang,
    localizedPrompt: item?.localizedPrompt,
    localizedOptions: item?.localizedOptions ?? [],
    translatedPrompt: item?.translatedPrompt,
    translatedOptions: item?.translatedOptions ?? [],
    questionType: itemShape?.effectiveType === "MCQ" ? "mcq" : "row",
    imageTags: sourceFeatureImageTags(sourceMetadata),
    topic: sourceMetadata?.provisionalTopic ?? null,
    subtopics: sourceMetadata?.provisionalSubtopics ?? [],
  });
}

function buildSourceFeatureKeywords(item, itemShape, sourceMetadata, sourceLang) {
  const sourceBridge = buildSourceFeatureBridge(item, itemShape, sourceMetadata, sourceLang);
  if (sourceBridge.keywords.length > 0) {
    return sourceBridge.keywords.slice(0, 18);
  }

  const bridgeTexts = [
    item?.translatedPrompt,
    item?.translatedCorrectAnswer,
    ...(item?.translatedOptions ?? []),
  ].filter(Boolean);
  const fallbackTexts = bridgeTexts.length > 0
    ? []
    : [
      item?.localizedPrompt,
      item?.localizedCorrectAnswer,
      ...(item?.localizedOptions ?? []),
    ].filter(Boolean);
  const prioritized = [
    ...(sourceMetadata?.mcqFingerprint?.rareKeywords ?? []),
    ...(sourceMetadata?.mcqFingerprint?.answerDistinctiveTokens ?? []),
    ...(sourceMetadata?.mcqFingerprint?.optionDistinctiveTokens ?? []),
    ...(sourceMetadata?.mcqFingerprint?.promptDistinctiveTokens ?? []),
    ...(sourceMetadata?.sourceConceptSlots?.condition ?? []),
    ...(sourceMetadata?.sourceConceptSlots?.context ?? []),
    ...(sourceMetadata?.sourceConceptSlots?.action ?? []),
    ...sourceFeatureTopicKeywords(sourceMetadata),
    ...toList(sourceMetadata?.expectedObjectTags).map((tag) => normalizeVisualTagForScoring(tag)),
    ...toList(sourceMetadata?.expectedColorTags).map((tag) => normalizeVisualTagForScoring(tag)),
    ...featureKeywordTokensFromTexts([...bridgeTexts, ...fallbackTexts]),
  ];

  const keywords = unique(
    prioritized
      .map((token) => normalizeWhitespace(token).toLowerCase())
      .filter((token) => token && !/^[_-]+$/.test(token)),
  );

  if (keywords.length > 0) {
    return keywords.slice(0, 18);
  }

  if (itemShape?.effectiveType === "MCQ") {
    return unique(sourceMetadata?.mcqFingerprint?.keywordTokens ?? []).slice(0, 12);
  }

  return [];
}

function comparePromptFamiliesForMatch(sourceMetadata, sourceFeatureBridge, itemShape, item, question, sourceKeywords = []) {
  const sourceFamily = sourceMetadata?.sourcePromptFamily ?? sourceFeatureBridge?.promptFamily ?? null;
  const sourceBucket = inferPromptFamilyBucket({
    family: sourceFamily,
    text: item?.translatedPrompt || item?.localizedPrompt || sourceFeatureBridge?.glossEn || "",
    gloss: sourceFeatureBridge?.glossEn || "",
    keywords: [
      ...toList(sourceKeywords),
      ...toList(sourceFeatureBridge?.keywords),
      ...toList(sourceFeatureBridge?.conceptKeywords),
    ],
    questionType: itemShape?.effectiveType,
  });
  const candidateFamily = question.genericPrompt?.family ?? question.normalizedFeatures?.promptFamily ?? null;
  const candidateImageTags = candidateFeatureImageTags(question);
  const candidateBucketFromImage = candidateImageTags.some((tag) =>
    ["indicator", "dashboard-indicator", "warning-light", "open-hood", "open-door", "open-trunk", "yellow-car-icon"].includes(tag)
  )
    ? "indicator"
    : null;
  const candidateBucket = candidateBucketFromImage ?? inferPromptFamilyBucket({
    family: candidateFamily,
    text: question.sourcePrompt || question.prompt,
    gloss: question.normalizedFeatures?.masterGlossEn ?? "",
    keywords: [
      ...(question.normalizedFeatures?.masterKeywords ?? []),
      ...(question.normalizedFeatures?.conceptKeywords ?? []),
      ...candidateImageTags,
    ],
    questionType: question.type,
  });

  return comparePromptFamilyCompatibility({
    sourceFamily,
    sourceBucket,
    candidateFamily,
    candidateBucket,
  });
}

function candidateFeatureKeywords(question, sourceLang) {
  const normalizedLang = normalizeLang(sourceLang);
  const translatedQuestion = question.translations?.[normalizedLang] ?? null;
  const fallback = buildFeatureKeywordList(question);
  const masterKeywords = question.normalizedFeatures?.masterKeywords ?? fallback.keywords;
  const masterConcepts = question.normalizedFeatures?.conceptKeywords ?? fallback.conceptKeywords;

  return unique([
    ...toList(masterKeywords),
    ...toList(masterConcepts),
    ...toList(translatedQuestion?.keywords),
    ...toList(translatedQuestion?.conceptKeywords),
  ]);
}

function sourceFeatureImageTags(sourceMetadata) {
  return unique([
    ...toList(sourceMetadata?.expectedObjectTags).map((tag) => normalizeVisualTagForScoring(tag)),
    ...toList(sourceMetadata?.expectedColorTags).map((tag) => normalizeVisualTagForScoring(tag)),
  ].filter(Boolean));
}

function candidateFeatureImageTags(question) {
  const fromStore = toList(question.normalizedFeatures?.imageTags)
    .map((tag) => normalizeVisualTagForScoring(tag))
    .filter(Boolean);

  if (fromStore.length > 0) {
    return unique(augmentIndicatorVisualTags(
      fromStore,
      [
        ...toList(question.image?.colorTags),
        ...toList(question.image?.dominantColorTags),
      ],
      [
        question.sourcePrompt,
        question.prompt,
        question.correctAnswer?.correctOptionText,
        ...toList(question.options).map((option) => option?.sourceText || option?.text),
      ].filter(Boolean).join(" "),
    ).map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean));
  }

  return unique(augmentIndicatorVisualTags(
    featureImageTagsForQuestion(question),
    [
      ...toList(question.image?.colorTags),
      ...toList(question.image?.dominantColorTags),
    ],
    [
      question.sourcePrompt,
      question.prompt,
      question.correctAnswer?.correctOptionText,
      ...toList(question.options).map((option) => option?.sourceText || option?.text),
    ].filter(Boolean).join(" "),
  ).map((tag) => normalizeVisualTagForScoring(tag)).filter(Boolean));
}

function scoreFeatureKeywordSignal(sourceKeywords, candidateKeywords, corpus, fallbackScore = 0.5) {
  if (sourceKeywords.length === 0 && candidateKeywords.length === 0) {
    return fallbackScore;
  }

  return weightedKeywordOverlap(sourceKeywords, candidateKeywords, corpus.featureKeywordIdf, {
    bothMissing: fallbackScore,
    missingOne: 0.2,
  });
}

function isIndicatorSourceMetadata(sourceMetadata) {
  const tags = new Set(sourceFeatureImageTags(sourceMetadata));
  return (
    sourceMetadata?.hasImage === true &&
    (
      sourceMetadata?.sourcePromptFamilyBucket === "indicator" ||
      tags.has("indicator") ||
      tags.has("dashboard-indicator") ||
      tags.has("car-icon") ||
      tags.has("yellow-car-icon") ||
      tags.has("open-hood") ||
      tags.has("open-door") ||
      tags.has("open-trunk")
    )
  );
}

function isIndicatorCandidateQuestion(question, promptFamilyComparison = null) {
  const tags = new Set(candidateFeatureImageTags(question));
  return (
    question?.image?.hasImage === true &&
    (
      promptFamilyComparison?.candidateBucket === "indicator" ||
      tags.has("indicator") ||
      tags.has("dashboard-indicator") ||
      tags.has("car-icon") ||
      tags.has("yellow-car-icon") ||
      tags.has("open-hood") ||
      tags.has("open-door") ||
      tags.has("open-trunk")
    )
  );
}

function scoreIndicatorVisualMatch(item, question, sourceMetadata, visualEvidence, promptFamilyComparison = null) {
  const sourceIndicator = isIndicatorSourceMetadata(sourceMetadata);

  if (!sourceIndicator) {
    return {
      sourceIndicator,
      candidateIndicator: false,
      score: 0.5,
      boost: 0,
      penalty: 0,
      reasonCodes: [],
      objectScore: visualEvidence.objectScore ?? 0.5,
      colorScore: visualEvidence.colorScore ?? 0.5,
      dominantColorScore: 0.5,
      familyScore: 0.5,
      imagePresenceScore: item?.hasImage === question?.image?.hasImage ? 1 : 0,
    };
  }

  const candidateIndicator = isIndicatorCandidateQuestion(question, promptFamilyComparison);
  const candidateHasImage = question?.image?.hasImage === true;
  const sourceTagSet = new Set(sourceFeatureImageTags(sourceMetadata));
  const candidateTagSet = new Set(candidateFeatureImageTags(question));
  const sourcePartTags = ["open-hood", "open-door", "open-trunk"].filter((tag) => sourceTagSet.has(tag));
  const candidatePartTags = ["open-hood", "open-door", "open-trunk"].filter((tag) => candidateTagSet.has(tag));
  const candidateMeaningTags = new Set(augmentIndicatorVisualTags(
    inferExpectedObjectTagsFromText([
      question?.sourcePrompt,
      question?.prompt,
      question?.correctAnswer?.correctOptionText,
      ...toList(question?.options).map((option) => option?.sourceText || option?.text),
    ].filter(Boolean).join(" ")),
    candidateVisualColorTagsForScoring(question),
    [
      question?.sourcePrompt,
      question?.prompt,
      question?.correctAnswer?.correctOptionText,
      ...toList(question?.options).map((option) => option?.sourceText || option?.text),
    ].filter(Boolean).join(" "),
  ));
  const exactPartMatch = sourcePartTags.some((tag) => candidateTagSet.has(tag));
  const relatedPartMatch = sourcePartTags.length > 0 && candidatePartTags.length > 0;
  const exactOptionMeaningMatch = sourcePartTags.some((tag) => candidateMeaningTags.has(tag));
  const relatedOptionMeaningMatch =
    sourcePartTags.length > 0 &&
    ["open-hood", "open-door", "open-trunk"].some((tag) => candidateMeaningTags.has(tag));
  const partScore = exactPartMatch ? 1 : relatedPartMatch ? 0.72 : sourcePartTags.length > 0 ? 0.25 : 0.5;
  const optionMeaningScore = exactOptionMeaningMatch ? 1 : relatedOptionMeaningMatch ? 0.72 : sourcePartTags.length > 0 ? 0.25 : 0.5;
  const sourceColors = unique([
    ...normalizeImageTagList(sourceMetadata?.visualColorTags),
    ...normalizeImageTagList(sourceMetadata?.expectedColorTags),
  ]);
  const candidateColors = candidateVisualColorTagsForScoring(question);
  const dominantColorMatch = scoreVisualTagCompatibility(sourceColors, candidateColors, {
    bothMissing: 0.35,
    missingOne: 0.05,
  });
  const objectScore = visualEvidence.objectScore ?? 0.5;
  const colorScore = Math.max(visualEvidence.colorScore ?? 0.5, dominantColorMatch.score);
  const familyScore =
    promptFamilyComparison?.bucketMatch === true || candidateIndicator
      ? 1
      : promptFamilyComparison?.candidateBucket && promptFamilyComparison.candidateBucket !== "indicator"
        ? 0
        : 0.35;
  const imagePresenceScore = candidateHasImage ? 1 : 0;
  const score = clamp01(
    (objectScore * 0.34) +
    (colorScore * 0.22) +
    (partScore * 0.16) +
    (optionMeaningScore * 0.14) +
    (familyScore * 0.14) +
    (imagePresenceScore * 0.08),
  );
  const reasonCodes = [];

  if (dominantColorMatch.matchedTags.length > 0 || dominantColorMatch.score >= 0.82) {
    reasonCodes.push("dominant-color-match");
  }

  if ((visualEvidence.matchedTags ?? []).length > 0 || objectScore >= 0.78) {
    reasonCodes.push("image-object-match");
  }

  if (candidateIndicator && familyScore >= 0.8) {
    reasonCodes.push("indicator-visual-match");
  }

  if (exactPartMatch) {
    reasonCodes.push("indicator-part-match");
  }

  if (exactOptionMeaningMatch) {
    reasonCodes.push("option-meaning-match");
  }

  if (candidateHasImage && score >= 0.72) {
    reasonCodes.push("image-candidate-boost");
  }

  if (!candidateHasImage) {
    reasonCodes.push("missing-image-penalty");
  }

  if (promptFamilyComparison?.candidateBucket && promptFamilyComparison.candidateBucket !== "indicator") {
    reasonCodes.push("image-family-mismatch");
  }

  const boost = candidateHasImage
    ? Math.max(0, (score - 0.5) * 34) +
      (exactPartMatch ? 8 : relatedPartMatch ? 3 : 0) +
      (exactOptionMeaningMatch ? 12 : relatedOptionMeaningMatch ? 4 : 0)
    : 0;
  const penalty = !candidateHasImage
    ? 10
    : promptFamilyComparison?.candidateBucket && promptFamilyComparison.candidateBucket !== "indicator"
      ? Math.max(0, (0.7 - score) * 10)
      : 0;

  return {
    sourceIndicator,
    candidateIndicator,
    score,
    boost,
    penalty,
    reasonCodes: unique(reasonCodes),
    objectScore,
    colorScore,
    dominantColorScore: dominantColorMatch.score,
    familyScore,
    imagePresenceScore,
    partScore,
    optionMeaningScore,
    matchedTags: unique([
      ...(visualEvidence.matchedTags ?? []),
      ...dominantColorMatch.matchedTags,
      ...(exactPartMatch ? sourcePartTags : []),
    ]),
  };
}

function scoreFeatureImageSignal(item, question, sourceMetadata, visualEvidence, corpus) {
  if (item?.hasImage !== true && question.image.hasImage !== true) {
    return 0.5;
  }

  if (item?.hasImage === false && question.image.hasImage === true) {
    return 0;
  }

  if (item?.hasImage === true && question.image.hasImage === false) {
    return 0;
  }

  const sourceTags = sourceFeatureImageTags(sourceMetadata);
  const candidateTags = candidateFeatureImageTags(question);
  const featureOverlap = weightedKeywordOverlap(sourceTags, candidateTags, corpus.imageTagIdf, {
    bothMissing: question.image.hasImage ? 0.35 : 0.5,
    missingOne: 0.18,
  });

  if (visualEvidence.available !== true) {
    return featureOverlap;
  }

  return clamp01(Math.max(
    featureOverlap,
    visualEvidence.score,
    visualEvidence.objectScore ?? 0,
    visualEvidence.colorScore ?? 0,
    visualEvidence.numberScore ?? 0,
  ));
}

function weightedSignalComposite(profile, signals) {
  const weights = MATCH_SIGNAL_PROFILES[profile] ?? MATCH_SIGNAL_PROFILES["mcq-text"];

  return {
    weights,
    total:
      (signals.optionScore * weights.option) +
      (signals.glossScore * weights.gloss) +
      (signals.keywordScore * weights.keyword) +
      (signals.imageScore * weights.image) +
      (signals.multilingualSupportScore * weights.multilingual),
  };
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

function scoreQuestionForBatchItem(item, question, corpus, context = {}) {
  const itemShape = context.itemShape ?? analyzeItemShape(item);
  const sourceMetadata = context.sourceMetadata ?? buildSourceReviewMetadata(item, itemShape);
  const sourceLang = context.sourceLang ?? DEFAULT_REFERENCE_LANG;
  const structural = context.structural ?? evaluateStructuralCompatibility(item, itemShape, sourceMetadata, question);
  const visualEvidence = scoreSourceVisualEvidence(sourceMetadata, question);
  const sourceFeatureBridge = context.sourceFeatureBridge ?? buildSourceFeatureBridge(item, itemShape, sourceMetadata, sourceLang);
  const candidateMasterGloss = question.normalizedFeatures?.masterGlossEn ?? question.sourcePrompt ?? question.prompt;
  const englishPrompt = promptSimilarityForMatch(item.translatedPrompt, question.sourcePrompt || question.prompt);
  const bridgePrompt = promptSimilarityForMatch(
    sourceFeatureBridge.glossEn,
    candidateMasterGloss,
  );
  const localizedPrompt = localizedPromptSimilarityForMatch(item, question, sourceLang);
  const englishPromptAvailable = Boolean(item.translatedPrompt) && Boolean(question.sourcePrompt || question.prompt);
  const bridgePromptAvailable = Boolean(sourceFeatureBridge.glossEn) && Boolean(candidateMasterGloss);
  const localizedPromptAvailable = localizedPrompt.available;
  const prompt = {
    rawSimilarity: Math.max(
      englishPrompt.rawSimilarity,
      bridgePrompt.rawSimilarity,
      localizedPrompt.rawSimilarity,
      combineAvailableScores([
        { value: englishPrompt.rawSimilarity, weight: 0.58, available: englishPromptAvailable },
        { value: bridgePrompt.rawSimilarity, weight: 0.22, available: bridgePromptAvailable },
        { value: localizedPrompt.rawSimilarity, weight: 0.2, available: localizedPromptAvailable },
      ], 0),
    ),
    specificity: Math.max(
      englishPrompt.specificity,
      bridgePrompt.specificity,
      localizedPrompt.specificity,
      combineAvailableScores([
        { value: englishPrompt.specificity, weight: 0.58, available: englishPromptAvailable },
        { value: bridgePrompt.specificity, weight: 0.22, available: bridgePromptAvailable },
        { value: localizedPrompt.specificity, weight: 0.2, available: localizedPromptAvailable },
      ], 0.5),
    ),
    effectiveSimilarity: Math.max(
      englishPrompt.effectiveSimilarity,
      bridgePrompt.effectiveSimilarity,
      localizedPrompt.effectiveSimilarity,
      combineAvailableScores([
        { value: englishPrompt.effectiveSimilarity, weight: 0.58, available: englishPromptAvailable },
        { value: bridgePrompt.effectiveSimilarity, weight: 0.22, available: bridgePromptAvailable },
        { value: localizedPrompt.effectiveSimilarity, weight: 0.2, available: localizedPromptAvailable },
      ], 0),
    ),
  };
  const typeScore = structural.typeAgreement;
  const imageScore =
    item.hasImage === null
      ? 0.5
      : item.hasImage === question.image.hasImage
        ? 1
        : 0;
  const topicScore = scoreTopicHints(item, question);
  const assetTieBreak = scoreAssetHints(item, question);
  const scoringProfile = matchSignalProfile(itemShape, item);
  const sourceKeywords = buildSourceFeatureKeywords(item, itemShape, sourceMetadata, sourceLang);
  const candidateKeywords = candidateFeatureKeywords(question, sourceLang);
  const promptFamilyComparison = comparePromptFamiliesForMatch(
    sourceMetadata,
    sourceFeatureBridge,
    itemShape,
    item,
    question,
    sourceKeywords,
  );
  const localizedGlossScore = localizedGlossSimilarityForMatch(sourceFeatureBridge, question, sourceLang);
  const localizedOptionGlossScore = localizedOptionGlossSimilarityForMatch(itemShape, item, question, corpus, sourceLang);
  const localizedCorrectGlossScore = localizedCorrectGlossSimilarityForMatch(item, question, sourceLang);
  const localizedKeywordScore = localizedKeywordSupportForMatch(sourceKeywords, question, corpus, sourceLang);

  if (question.type === "MCQ") {
    const sourceFingerprint = sourceMetadata.mcqFingerprint ?? buildMcqFingerprint({
      prompt: item.translatedPrompt || item.localizedPrompt,
      correctAnswer: item.translatedCorrectAnswer || item.localizedCorrectAnswer || item.correctKeyRaw,
      options: item.translatedOptions.length > 0 ? item.translatedOptions : item.localizedOptions,
      topic: sourceMetadata.provisionalTopic,
      subtopics: sourceMetadata.provisionalSubtopics,
      hasImage: item.hasImage === true,
    });
    const candidateFingerprint = question.mcqFingerprint ?? buildMcqFingerprint({
      prompt: question.sourcePrompt || question.prompt,
      correctAnswer:
        question.correctAnswer.correctOptionText ??
        question.correctAnswer.correctOptionTranslatedText ??
        question.correctAnswer.correctOptionKey ??
        "",
      options: question.options.map((option) => option.sourceText || option.text),
      topic: question.tags.truthTopic ?? question.tags.weightedTopic ?? null,
      subtopics: unique([...question.tags.truthSubtopics, ...question.tags.weightedSubtopics]),
      hasImage: question.image.hasImage,
    });
    const englishOptionScore = optionSimilarityForMatch(itemShape, item, question, corpus);
    const localizedOptionScore = localizedOptionSimilarityForMatch(itemShape, item, question, corpus, sourceLang);
    const optionAgreement =
      englishOptionScore.available && localizedOptionScore.available
        ? Math.min(
          1,
          (Math.min(englishOptionScore.score, localizedOptionScore.score) * 0.65) +
          (Math.min(englishOptionScore.fingerprint, localizedOptionScore.fingerprint) * 0.35),
        )
        : 0;
    const optionSetComparison = compareMcqOptionSets(sourceFingerprint, candidateFingerprint, corpus);
    const optionScore = {
      score: Math.max(
        optionSetComparison.score,
        optionSetComparison.optionSignatureScore,
        englishOptionScore.score,
        localizedOptionScore.score,
        combineAvailableScores([
          { value: englishOptionScore.score, weight: 0.72, available: englishOptionScore.available },
          { value: localizedOptionScore.score, weight: 0.28, available: localizedOptionScore.available },
        ], 0),
        optionAgreement,
      ),
      fingerprint: Math.max(
        optionSetComparison.exactCoverage,
        optionSetComparison.optionSignatureScore,
        englishOptionScore.fingerprint,
        localizedOptionScore.fingerprint,
        combineAvailableScores([
          { value: englishOptionScore.fingerprint, weight: 0.72, available: englishOptionScore.available },
          { value: localizedOptionScore.fingerprint, weight: 0.28, available: localizedOptionScore.available },
        ], 0),
        optionAgreement,
      ),
      exactSet: Math.max(optionSetComparison.exactCoverage, englishOptionScore.exactSet, localizedOptionScore.exactSet),
      rareTokenCoverage: Math.max(
        optionSetComparison.rareKeywordOverlap,
        optionSetComparison.conceptTokenOverlap,
        englishOptionScore.rareTokenCoverage,
        localizedOptionScore.rareTokenCoverage,
      ),
      rareSetBonus: Math.max(englishOptionScore.rareSetBonus, localizedOptionScore.rareSetBonus),
      agreement: optionAgreement,
      optionSetScore: optionSetComparison.score,
      optionSignatureScore: optionSetComparison.optionSignatureScore,
      alignedSimilarity: optionSetComparison.alignedSimilarity,
      contradictionPenalty: optionSetComparison.contradictionPenalty,
      contradictionSignals: optionSetComparison.contradictionSignals,
      numberScore: optionSetComparison.numberScore,
    };
    const englishCorrectScore = correctAnswerSimilarityForMatch(item, question);
    const localizedCorrectScore = localizedCorrectAnswerSimilarityForMatch(item, question, sourceLang);
    const missingCorrectNeutral = englishCorrectScore.neutral && localizedCorrectScore.neutral && localizedCorrectGlossScore.neutral;
    const correctAgreement =
      englishCorrectScore.available && (localizedCorrectScore.available || localizedCorrectGlossScore.available)
        ? Math.min(
          1,
          Math.min(
            englishCorrectScore.score,
            Math.max(localizedCorrectScore.score, localizedCorrectGlossScore.score),
          ) +
          ((englishCorrectScore.exactKey || localizedCorrectScore.exactKey || localizedCorrectGlossScore.exactKey) ? 0.1 : 0),
        )
        : 0;
    const answerComparison = compareMcqAnswerFingerprints(sourceFingerprint, candidateFingerprint, corpus);
    const correctScore = {
      score: missingCorrectNeutral
        ? 0.5
        : Math.max(
          answerComparison.score,
          englishCorrectScore.score,
          localizedCorrectScore.score,
          localizedCorrectGlossScore.score,
          combineAvailableScores([
            { value: englishCorrectScore.score, weight: 0.62, available: englishCorrectScore.available },
            { value: localizedCorrectScore.score, weight: 0.16, available: localizedCorrectScore.available },
            { value: localizedCorrectGlossScore.score, weight: 0.22, available: localizedCorrectGlossScore.available },
          ], 0.5),
          correctAgreement,
        ),
      neutral: missingCorrectNeutral,
      exactKey: englishCorrectScore.exactKey || localizedCorrectScore.exactKey || localizedCorrectGlossScore.exactKey,
      agreement: correctAgreement,
      contradictionPenalty: answerComparison.contradictionPenalty,
      contradictionSignals: answerComparison.contradictionSignals,
    };
    const keywordScore = scoreMcqKeywordOverlap(sourceFingerprint, candidateFingerprint, corpus);
    const numberScore = scoreNumericSignalAlignment(sourceFingerprint.numericSignals, candidateFingerprint.numericSignals);
    const sourceNumericIntent = detectNumericPromptIntent({
      normalizedPrompt: sourceFingerprint.normalizedPrompt,
      promptTokens: sourceFingerprint.promptTokens,
      keywordTokens: sourceFingerprint.keywordTokens,
      numericSignals: sourceFingerprint.numericSignals,
      extraKeywords: sourceKeywords,
    });
    const candidateNumericIntent = detectNumericPromptIntent({
      normalizedPrompt: candidateFingerprint.normalizedPrompt,
      promptTokens: candidateFingerprint.promptTokens,
      keywordTokens: candidateFingerprint.keywordTokens,
      numericSignals: candidateFingerprint.numericSignals,
      extraKeywords: candidateKeywords,
    });
    const numericIntentComparison = compareNumericPromptIntent(sourceNumericIntent, candidateNumericIntent);
    const sourceNumericGroups = extractNumericGroupsFromTexts(sourceNumericGroupTexts(item, sourceFeatureBridge));
    const candidateNumericGroups = extractNumericGroupsFromTexts(candidateNumericGroupTexts(question, sourceLang));
    const numericGroupComparison = compareNumericGroups(sourceNumericGroups, candidateNumericGroups);
    const promptContradiction = contradictionPenaltyForTokenSets(
      sourceFingerprint.promptAllTokens,
      candidateFingerprint.promptAllTokens,
    );
    const contradictionPenalty = Math.min(
      1,
      (promptContradiction.penalty * 0.25) +
      (answerComparison.contradictionPenalty * 0.45) +
      (optionSetComparison.contradictionPenalty * 0.3),
    );
    const numericIntentMismatchPenalty = numericIntentComparison.penalty;
    const numberConflictPenalty = Math.min(
      1,
      ((numberScore.conflict ? 1 : 0) * 0.45) +
      ((answerComparison.numberConflict ?? 0) * 0.3) +
      ((optionSetComparison.numberConflictShare ?? 0) * 0.25),
    );
    const contradictionSignals = unique([
      ...promptContradiction.signals,
      ...answerComparison.contradictionSignals,
      ...optionSetComparison.contradictionSignals,
    ]);
    const priorBonus = scoreMcqPrior(sourceMetadata, question, structural, imageScore, topicScore);
    const mirrorAgreement = Math.max(optionAgreement, correctAgreement);
    const answerGlossScore = Math.max(
      answerComparison.score,
      (answerComparison.score * 0.8) + (correctScore.score * 0.2),
    );
    const optionRowKeywordScore = Math.max(
      keywordScore.optionSignalScore,
      keywordScore.optionKeywordScore,
      keywordScore.optionPhraseScore,
      keywordScore.optionConceptKeywordScore,
      keywordScore.optionConceptDistinctiveScore,
      keywordScore.distinctiveOptionScore,
      optionSetComparison.rareKeywordOverlap,
      optionSetComparison.optionPhraseScore,
      optionSetComparison.conceptTokenOverlap,
      optionSetComparison.dominantConceptCoverage,
    );
    const bridgeLocalizedAgreement = combineAvailableScores([
      { value: localizedGlossScore.effectiveSimilarity, weight: 0.36, available: localizedGlossScore.available },
      { value: localizedOptionGlossScore.score, weight: 0.34, available: localizedOptionGlossScore.available },
      { value: localizedCorrectGlossScore.score, weight: 0.14, available: localizedCorrectGlossScore.available && !localizedCorrectGlossScore.neutral },
      { value: localizedKeywordScore.score, weight: 0.16, available: localizedKeywordScore.available },
    ], 0.5);
    const optionSignatureDominance = clamp01(
      (optionSetComparison.optionSignatureScore * 0.36) +
      (optionSetComparison.conceptPairingScore * 0.18) +
      (optionSetComparison.conceptExactSet * 0.12) +
      (optionScore.fingerprint * 0.12) +
      (optionRowKeywordScore * 0.12) +
      (mirrorAgreement * 0.06) +
      (bridgeLocalizedAgreement * 0.04),
    );
    const fullLocalizedAgreement = combineAvailableScores([
      { value: localizedPrompt.effectiveSimilarity, weight: 0.14, available: localizedPromptAvailable },
      { value: localizedOptionScore.score, weight: 0.24, available: localizedOptionScore.available },
      { value: localizedCorrectScore.score, weight: 0.08, available: localizedCorrectScore.available && !localizedCorrectScore.neutral },
      { value: localizedGlossScore.effectiveSimilarity, weight: 0.22, available: localizedGlossScore.available },
      { value: localizedOptionGlossScore.score, weight: 0.2, available: localizedOptionGlossScore.available },
      { value: localizedCorrectGlossScore.score, weight: 0.04, available: localizedCorrectGlossScore.available && !localizedCorrectGlossScore.neutral },
      { value: localizedKeywordScore.score, weight: 0.08, available: localizedKeywordScore.available },
    ], 0.5);
    const visualScore = visualEvidence.available === true
      ? Math.max(visualEvidence.score, visualEvidence.objectScore ?? 0, visualEvidence.numberScore ?? 0)
      : 0;
    const masterKeywordScore = Math.max(
      scoreFeatureKeywordSignal(sourceKeywords, candidateKeywords, corpus, 0.5),
      keywordScore.score,
      keywordScore.rareKeywordScore,
      localizedKeywordScore.score,
    );
    const optionSignal = clamp01(
      (optionSignatureDominance * 0.34) +
      (optionSetComparison.score * 0.24) +
      (answerGlossScore * 0.16) +
      (optionRowKeywordScore * 0.12) +
      (correctScore.score * 0.08) +
      (numberScore.score * 0.04) +
      (numericGroupComparison.score * 0.02) +
      (mirrorAgreement * 0.04) +
      (bridgeLocalizedAgreement * 0.06) -
      (promptFamilyComparison.mismatchPenalty * 0.12) +
      (promptFamilyComparison.supportBonus * 0.08) -
      (contradictionPenalty * 0.18) -
      (numericIntentMismatchPenalty * 0.08) -
      (numericGroupComparison.penalty * 0.03) -
      (numberConflictPenalty * 0.08),
    );
    const featureImageScore = scoreFeatureImageSignal(item, question, sourceMetadata, visualEvidence, corpus);
    const indicatorVisual = scoreIndicatorVisualMatch(item, question, sourceMetadata, visualEvidence, promptFamilyComparison);
    const effectiveImageScore = indicatorVisual.sourceIndicator
      ? Math.max(featureImageScore, indicatorVisual.score)
      : featureImageScore;
    const signalComposite = weightedSignalComposite(scoringProfile, {
      optionScore: optionSignal,
      glossScore: prompt.effectiveSimilarity,
      keywordScore: masterKeywordScore,
      imageScore: effectiveImageScore,
      multilingualSupportScore: fullLocalizedAgreement,
    });
    const baseTotal = Math.max(
      0,
      (signalComposite.total * 100) +
      (typeScore * 4) +
      (structural.structuralAgreement * 4) +
      (priorBonus * 3) +
      (topicScore * 2) +
      (promptFamilyComparison.supportBonus * 4) +
      (numericGroupComparison.score * 4) +
      indicatorVisual.boost +
      (assetTieBreak * 1.5) -
      indicatorVisual.penalty -
      (promptFamilyComparison.mismatchPenalty * 12) -
      (contradictionPenalty * 14) -
      (numericIntentMismatchPenalty * 10) -
      (numericGroupComparison.penalty * 4) -
      ((visualEvidence.contradictionPenalty ?? 0) * 5) -
      (numberConflictPenalty * 6) -
      (structural.structuralPenalty * 6),
    );

    return {
      baseTotal,
      total: round(baseTotal),
      breakdown: {
        optionScore: round(optionSignal),
        glossScore: round(prompt.effectiveSimilarity),
        promptScore: round(prompt.effectiveSimilarity),
        promptSimilarity: round(prompt.effectiveSimilarity),
        rawPromptSimilarity: round(prompt.rawSimilarity),
        englishPromptSimilarity: round(englishPrompt.effectiveSimilarity),
        bridgePromptSimilarity: round(bridgePrompt.effectiveSimilarity),
        syntheticPromptSimilarity: localizedPrompt.label === "synthetic-ja" ? round(localizedPrompt.effectiveSimilarity) : 0,
        localizedPromptSimilarity: round(localizedPrompt.effectiveSimilarity),
        optionSimilarity: round(optionScore.score),
        englishOptionSimilarity: round(englishOptionScore.score),
        syntheticOptionSimilarity: localizedOptionScore.label === "synthetic-ja" ? round(localizedOptionScore.score) : 0,
        localizedOptionSimilarity: round(localizedOptionScore.score),
        localizedOptionGlossSimilarity: round(localizedOptionGlossScore.score),
        optionSetScore: round(optionSetComparison.score),
        optionSignatureScore: round(optionSetComparison.optionSignatureScore),
        optionSignatureDominance: round(optionSignatureDominance),
        optionConceptPairing: round(optionSetComparison.conceptPairingScore),
        optionConceptCoverage: round(optionSetComparison.conceptTokenOverlap),
        optionConceptExactSet: round(optionSetComparison.conceptExactSet),
        alignedOptionSimilarity: round(optionSetComparison.alignedSimilarity),
        optionFingerprint: round(optionScore.fingerprint),
        englishOptionFingerprint: round(englishOptionScore.fingerprint),
        syntheticOptionFingerprint: localizedOptionScore.label === "synthetic-ja" ? round(localizedOptionScore.fingerprint) : 0,
        localizedOptionFingerprint: round(localizedOptionScore.fingerprint),
        optionExactSet: round(optionScore.exactSet),
        optionRareCoverage: round(optionScore.rareTokenCoverage),
        optionRowKeywordScore: round(optionRowKeywordScore),
        mirrorAgreement: round(mirrorAgreement),
        localizedAgreement: round(fullLocalizedAgreement),
        answerScore: round(answerComparison.score),
        answerGlossScore: round(answerGlossScore),
        correctAnswerMeaning: round(correctScore.score),
        englishCorrectAnswerMeaning: round(englishCorrectScore.score),
        syntheticCorrectAnswerMeaning: localizedCorrectScore.label === "synthetic-ja" ? round(localizedCorrectScore.score) : 0,
        localizedCorrectAnswerMeaning: round(localizedCorrectScore.score),
        localizedCorrectGlossMeaning: round(localizedCorrectGlossScore.score),
        keywordScore: round(masterKeywordScore),
        bridgeKeywordScore: round(keywordScore.score),
        localizedKeywordSupport: round(localizedKeywordScore.score),
        promptKeywordScore: round(keywordScore.promptKeywordScore),
        promptPhraseScore: round(keywordScore.promptPhraseScore),
        answerKeywordScore: round(keywordScore.answerKeywordScore),
        answerPhraseScore: round(keywordScore.answerPhraseScore),
        optionKeywordScore: round(keywordScore.optionKeywordScore),
        optionPhraseScore: round(keywordScore.optionPhraseScore),
        optionConceptKeywordScore: round(keywordScore.optionConceptKeywordScore),
        optionConceptDistinctiveScore: round(keywordScore.optionConceptDistinctiveScore),
        rareKeywordScore: round(keywordScore.rareKeywordScore),
        numberScore: round(numberScore.score),
        numberExactOverlap: round(numberScore.exactOverlap),
        numberValueOverlap: round(numberScore.valueOverlap),
        numericGroupScore: round(numericGroupComparison.score),
        numericGroupPenalty: round(numericGroupComparison.penalty),
        numericIntentMismatchPenalty: round(numericIntentMismatchPenalty),
        promptFamilyMismatchPenalty: round(promptFamilyComparison.mismatchPenalty),
        promptFamilySupport: round(promptFamilyComparison.supportBonus),
        numberConflictPenalty: round(numberConflictPenalty),
        imageScore: round(effectiveImageScore),
        rawImageScore: round(featureImageScore),
        indicatorVisualScore: round(indicatorVisual.score),
        indicatorVisualBoost: round(indicatorVisual.boost),
        missingImagePenalty: round(indicatorVisual.reasonCodes.includes("missing-image-penalty") ? indicatorVisual.penalty : 0),
        imageFamilyMismatchPenalty: round(indicatorVisual.reasonCodes.includes("image-family-mismatch") ? indicatorVisual.penalty : 0),
        visualScore: round(visualScore),
        visualObjectScore: round(visualEvidence.objectScore ?? 0),
        visualColorScore: round(visualEvidence.colorScore ?? 0),
        dominantColorScore: round(indicatorVisual.dominantColorScore),
        visualNumberScore: round(visualEvidence.numberScore ?? 0),
        visualLayoutScore: round(visualEvidence.layoutScore ?? 0),
        questionType: round(typeScore),
        optionCountAgreement: round(structural.optionCountAgreement),
        answerStructureAgreement: round(structural.answerStructureAgreement),
        promptFamilyAgreement: round(structural.promptFamilyAgreement),
        provisionalTopicAgreement: round(structural.provisionalTopicAgreement),
        structuralAgreement: round(structural.structuralAgreement),
        structuralPenalty: round(structural.structuralPenalty),
        imageSignal: round(imageScore),
        imageObjectAgreement: round(structural.imageObjectAgreement),
        imageColorAgreement: round(structural.imageColorAgreement),
        priorBonus: round(priorBonus),
        topicWeighting: round(topicScore),
        contradictionPenalty: round(contradictionPenalty),
        assetTieBreak: round(assetTieBreak),
        localizedGlossSimilarity: round(localizedGlossScore.effectiveSimilarity),
        bridgeLocalizedAgreement: round(bridgeLocalizedAgreement),
        multilingualSupportScore: round(fullLocalizedAgreement),
        totalScore: round(baseTotal),
      },
      diagnostics: {
        effectiveItemType: itemShape.effectiveType,
        declaredItemType: itemShape.declaredType,
        binaryChoiceDetected: itemShape.booleanOptions,
        matchingProfile: scoringProfile,
        signalWeights: signalComposite.weights,
        promptSpecificity: round(prompt.specificity),
        genericPromptPenalty: round(prompt.specificity),
        missingCorrectAnswerNeutral: correctScore.neutral,
        exactCorrectKey: correctScore.exactKey,
        optionSetMode: localizedOptionScore.available
          ? `unordered-semantic + canonical-option-signature + ${localizedOptionScore.label} corroboration`
          : "unordered-semantic + canonical-option-signature",
        rareSetBonus: round(optionScore.rareSetBonus),
        localizedMirrorUsed:
          localizedPromptAvailable ||
          localizedOptionScore.available ||
          localizedCorrectScore.available ||
          localizedGlossScore.available ||
          localizedOptionGlossScore.available ||
          localizedKeywordScore.available,
        localizedMirrorLabel: localizedPrompt.label,
        localizedSignalAvailable:
          localizedPromptAvailable ||
          localizedOptionScore.available ||
          localizedCorrectScore.available ||
          localizedGlossScore.available ||
          localizedOptionGlossScore.available ||
          localizedKeywordScore.available,
        syntheticMirrorUsed: localizedPrompt.label === "synthetic-ja",
        genericPromptFamily: question.genericPrompt?.family ?? null,
        sourcePromptFamily: sourceMetadata?.sourcePromptFamily ?? sourceFeatureBridge?.promptFamily ?? null,
        sourcePromptFamilyBucket: promptFamilyComparison.sourceBucket,
        candidatePromptFamilyBucket: promptFamilyComparison.candidateBucket,
        promptFamilyReasonCodes: promptFamilyComparison.reasonCodes,
        sourceNumericIntent,
        candidateNumericIntent,
        numericIntentReasonCodes: numericIntentComparison.reasonCodes,
        sourceNumericGroups,
        candidateNumericGroups,
        numericGroupScore: round(numericGroupComparison.score),
        numericGroupPenalty: round(numericGroupComparison.penalty),
        numericGroupReasonCodes: numericGroupComparison.reasonCodes,
        numericGroupMatches: numericGroupComparison.matches,
        numberComparable: numberScore.available,
        contradictionSignals,
        visualComparable: visualEvidence.available === true,
        visualMatchedTags: unique([
          ...toList(visualEvidence.matchedTags),
          ...toList(indicatorVisual.matchedTags),
        ]),
        imageObjectMatch: round(indicatorVisual.objectScore),
        dominantColorMatch: round(indicatorVisual.dominantColorScore),
        indicatorVisualMatch: round(indicatorVisual.score),
        imageCandidateBoost: round(indicatorVisual.boost),
        missingImagePenalty: round(indicatorVisual.reasonCodes.includes("missing-image-penalty") ? indicatorVisual.penalty : 0),
        imageFamilyMismatch: round(indicatorVisual.reasonCodes.includes("image-family-mismatch") ? indicatorVisual.penalty : 0),
        imageVisualReasonCodes: indicatorVisual.reasonCodes,
        sourceIndicatorVisual: indicatorVisual.sourceIndicator,
        candidateIndicatorVisual: indicatorVisual.candidateIndicator,
        sourceFeatureGloss: sourceFeatureBridge.glossEn,
        sourceFeatureKeywords: sourceKeywords,
        candidateFeatureKeywords: candidateKeywords,
        candidateImageTags: candidateFeatureImageTags(question),
        structuralSevereSignals: structural.severeSignals,
        structuralSoftSignals: structural.softSignals,
        imageObjectComparable: Boolean(sourceMetadata?.expectedObjectTags?.length),
        imageColorComparable: Boolean(sourceMetadata?.expectedColorTags?.length),
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
      ? augmentRowConceptSlots(
        sourceMetadata.sourceConceptSlots ?? extractRowConceptSlots({
          prompt: item.localizedPrompt,
          promptGloss: item.translatedPrompt,
          options: item.localizedOptions,
          optionGlosses: item.translatedOptions,
        }),
        [
          ...toList(sourceFeatureBridge?.conceptKeywords),
          ...sourceKeywords,
        ],
      )
      : null;
  const candidateConceptSlots =
    itemShape.effectiveType === "ROW"
      ? augmentRowConceptSlots(
        question.reviewConceptSlots ?? null,
        [
          ...toList(question.normalizedFeatures?.conceptKeywords),
          ...candidateKeywords,
        ],
      )
      : null;
  const conceptComparison =
    itemShape.effectiveType === "ROW" && candidateConceptSlots
      ? compareRowConceptSlots(sourceConceptSlots, candidateConceptSlots)
      : {
        alignment: 0,
        contradictionPenalty: 0,
        matchedSignals: [],
        contradictionSignals: [],
      };
  const sourceNumericGroups = extractNumericGroupsFromTexts(sourceNumericGroupTexts(item, sourceFeatureBridge));
  const candidateNumericGroups = extractNumericGroupsFromTexts(candidateNumericGroupTexts(question, sourceLang));
  const numericGroupComparison = compareNumericGroups(sourceNumericGroups, candidateNumericGroups);
  const numericGroupBoost = numericGroupComparison.available
    ? numericGroupComparison.score * (scoringProfile === "row-text" ? 24 : 18)
    : 0;
  const numericGroupPenalty = numericGroupComparison.available
    ? numericGroupComparison.penalty * (scoringProfile === "row-text" ? 20 : 16)
    : 0;
  const promptMirrorAgreement =
    englishPromptAvailable && localizedPromptAvailable
      ? Math.min(
        1,
        (Math.min(englishPrompt.effectiveSimilarity, localizedPrompt.effectiveSimilarity) * 0.8) +
        (Math.min(englishPrompt.rawSimilarity, localizedPrompt.rawSimilarity) * 0.2),
      )
      : 0;
  const promptBridgeAgreement = combineAvailableScores([
    { value: localizedPrompt.effectiveSimilarity, weight: 0.18, available: localizedPromptAvailable },
    { value: localizedGlossScore.effectiveSimilarity, weight: 0.52, available: localizedGlossScore.available },
    { value: localizedKeywordScore.score, weight: 0.3, available: localizedKeywordScore.available },
  ], 0.5);
  const rowKeywordSignal = scoreFeatureKeywordSignal(sourceKeywords, candidateKeywords, corpus, 0.5);
  const rowDistinctiveKeywordScore = weightedKeywordOverlap(
    selectRareKeywords(sourceKeywords, corpus.featureKeywordIdf, 10),
    selectRareKeywords(candidateKeywords, corpus.featureKeywordIdf, 10),
    corpus.featureKeywordIdf,
    {
      bothMissing: rowKeywordSignal,
      missingOne: 0.15,
    },
  );
  const rowConceptKeywordSupport = Math.min(
    0.4,
    (conceptComparison.alignment * 0.16) +
    (conceptComparison.matchedSignals.some((signal) => String(signal).startsWith("context:") || String(signal).startsWith("condition:")) ? 0.16 : 0) +
    (conceptComparison.matchedSignals.some((signal) => String(signal).startsWith("action:")) ? 0.08 : 0),
  );
  const masterKeywordScore = clamp01(Math.max(
    rowKeywordSignal,
    (rowKeywordSignal * 0.46) +
    (rowDistinctiveKeywordScore * 0.24) +
    rowConceptKeywordSupport +
    (localizedKeywordScore.score * 0.08) -
    (numericGroupComparison.penalty * 0.1) +
    (numericGroupComparison.score * 0.16) -
    (conceptComparison.contradictionPenalty * 0.08),
  ));
  const optionSignal = clamp01(
    (conceptComparison.alignment * 0.7) +
    (polarityScore * 0.2) +
    (structural.answerStructureAgreement * 0.1) -
    (numericGroupComparison.penalty * 0.18) +
    (numericGroupComparison.score * 0.12) -
    (promptFamilyComparison.mismatchPenalty * 0.16) +
    (promptFamilyComparison.supportBonus * 0.08) -
    (conceptComparison.contradictionPenalty * 0.35),
  );
  const featureImageScore = scoreFeatureImageSignal(item, question, sourceMetadata, visualEvidence, corpus);
  const indicatorVisual = scoreIndicatorVisualMatch(item, question, sourceMetadata, visualEvidence, promptFamilyComparison);
  const effectiveImageScore = indicatorVisual.sourceIndicator
    ? Math.max(featureImageScore, indicatorVisual.score)
    : featureImageScore;
  const signalComposite = weightedSignalComposite(scoringProfile, {
    optionScore: optionSignal,
    glossScore: prompt.effectiveSimilarity,
    keywordScore: masterKeywordScore,
    imageScore: effectiveImageScore,
    multilingualSupportScore: promptBridgeAgreement,
  });
  const baseTotal = Math.max(
    0,
    (signalComposite.total * 100) +
    (promptMirrorAgreement * 3) +
    (typeScore * 4) +
    (topicScore * 3) +
    (promptFamilyComparison.supportBonus * 3) +
    numericGroupBoost +
    indicatorVisual.boost +
    (assetTieBreak * 1.5) -
    indicatorVisual.penalty -
    numericGroupPenalty -
    (promptFamilyComparison.mismatchPenalty * 12) -
    (conceptComparison.contradictionPenalty * 12) -
    (structural.structuralPenalty * 6),
  );

  return {
    baseTotal,
    total: round(baseTotal),
    breakdown: {
      optionScore: round(optionSignal),
      glossScore: round(prompt.effectiveSimilarity),
      promptSimilarity: round(prompt.effectiveSimilarity),
      rawPromptSimilarity: round(prompt.rawSimilarity),
      englishPromptSimilarity: round(englishPrompt.effectiveSimilarity),
      bridgePromptSimilarity: round(bridgePrompt.effectiveSimilarity),
      syntheticPromptSimilarity: localizedPrompt.label === "synthetic-ja" ? round(localizedPrompt.effectiveSimilarity) : 0,
      localizedPromptSimilarity: round(localizedPrompt.effectiveSimilarity),
      localizedAgreement: round(promptBridgeAgreement),
      localizedGlossSimilarity: round(localizedGlossScore.effectiveSimilarity),
      localizedKeywordSupport: round(localizedKeywordScore.score),
      multilingualSupportScore: round(promptBridgeAgreement),
      keywordScore: round(masterKeywordScore),
      rowKeywordSignal: round(rowKeywordSignal),
      rowDistinctiveKeywordScore: round(rowDistinctiveKeywordScore),
      rowConceptKeywordSupport: round(rowConceptKeywordSupport),
      rowContrastPenalty: round(conceptComparison.contradictionPenalty),
      numericGroupScore: round(numericGroupComparison.score),
      numericGroupPenalty: round(numericGroupComparison.penalty),
      numericGroupBoost: round(numericGroupBoost),
      promptFamilyMismatchPenalty: round(promptFamilyComparison.mismatchPenalty),
      promptFamilySupport: round(promptFamilyComparison.supportBonus),
      imageScore: round(effectiveImageScore),
      rawImageScore: round(featureImageScore),
      indicatorVisualScore: round(indicatorVisual.score),
      indicatorVisualBoost: round(indicatorVisual.boost),
      missingImagePenalty: round(indicatorVisual.reasonCodes.includes("missing-image-penalty") ? indicatorVisual.penalty : 0),
      imageFamilyMismatchPenalty: round(indicatorVisual.reasonCodes.includes("image-family-mismatch") ? indicatorVisual.penalty : 0),
      optionSimilarity: round(optionSignal),
      questionType: round(typeScore),
      optionCountAgreement: round(structural.optionCountAgreement),
      answerStructureAgreement: round(structural.answerStructureAgreement),
      promptFamilyAgreement: round(structural.promptFamilyAgreement),
      provisionalTopicAgreement: round(structural.provisionalTopicAgreement),
      structuralAgreement: round(structural.structuralAgreement),
      structuralPenalty: round(structural.structuralPenalty),
      imageSignal: round(imageScore),
      imageObjectAgreement: round(structural.imageObjectAgreement),
      imageColorAgreement: round(structural.imageColorAgreement),
      topicWeighting: round(topicScore),
      answerPolarity: round(polarityScore),
      conceptAlignment: round(conceptComparison.alignment),
      conditionAlignment: round(conceptComparison.conditionAlignment),
      contextAlignment: round(conceptComparison.contextAlignment),
      actionAlignment: round(conceptComparison.actionAlignment),
      obligationAlignment: round(conceptComparison.obligationAlignment),
      polarityAlignment: round(conceptComparison.polarityAlignment),
      contradictionPenalty: round(conceptComparison.contradictionPenalty),
      assetTieBreak: round(assetTieBreak),
      totalScore: round(baseTotal),
    },
    diagnostics: {
      effectiveItemType: itemShape.effectiveType,
      declaredItemType: itemShape.declaredType,
      binaryChoiceDetected: itemShape.booleanOptions,
      matchingProfile: scoringProfile,
      signalWeights: signalComposite.weights,
      promptSpecificity: round(prompt.specificity),
      genericPromptPenalty: round(prompt.specificity),
      missingCorrectAnswerNeutral: true,
      optionSetMode: localizedPrompt.available ? `row + ${localizedPrompt.label} corroboration` : "row-semantic",
      localizedMirrorUsed: localizedPromptAvailable || localizedGlossScore.available || localizedKeywordScore.available,
      localizedMirrorLabel: localizedPrompt.label,
      localizedSignalAvailable: localizedPromptAvailable || localizedGlossScore.available || localizedKeywordScore.available,
      syntheticMirrorUsed: localizedPrompt.label === "synthetic-ja",
      genericPromptFamily: question.genericPrompt?.family ?? null,
      sourcePromptFamily: sourceMetadata?.sourcePromptFamily ?? sourceFeatureBridge?.promptFamily ?? null,
      sourcePromptFamilyBucket: promptFamilyComparison.sourceBucket,
      candidatePromptFamilyBucket: promptFamilyComparison.candidateBucket,
      promptFamilyReasonCodes: promptFamilyComparison.reasonCodes,
      sourceConceptSlots,
      candidateConceptSlots,
      conceptMatches: conceptComparison.matchedSignals,
      contradictionSignals: conceptComparison.contradictionSignals,
      rowContrastSignals: conceptComparison.contradictionSignals,
      rowConceptMode: "slot-alignment + contradiction-penalties",
      sourceNumericGroups,
      candidateNumericGroups,
      numericGroupScore: round(numericGroupComparison.score),
      numericGroupPenalty: round(numericGroupComparison.penalty),
      numericGroupReasonCodes: numericGroupComparison.reasonCodes,
      numericGroupMatches: numericGroupComparison.matches,
      sourceFeatureGloss: sourceFeatureBridge.glossEn,
      sourceFeatureKeywords: sourceKeywords,
      candidateFeatureKeywords: candidateKeywords,
      candidateImageTags: candidateFeatureImageTags(question),
      imageObjectMatch: round(indicatorVisual.objectScore),
      dominantColorMatch: round(indicatorVisual.dominantColorScore),
      indicatorVisualMatch: round(indicatorVisual.score),
      imageCandidateBoost: round(indicatorVisual.boost),
      missingImagePenalty: round(indicatorVisual.reasonCodes.includes("missing-image-penalty") ? indicatorVisual.penalty : 0),
      imageFamilyMismatch: round(indicatorVisual.reasonCodes.includes("image-family-mismatch") ? indicatorVisual.penalty : 0),
      imageVisualReasonCodes: indicatorVisual.reasonCodes,
      sourceIndicatorVisual: indicatorVisual.sourceIndicator,
      candidateIndicatorVisual: indicatorVisual.candidateIndicator,
      structuralSevereSignals: structural.severeSignals,
      structuralSoftSignals: structural.softSignals,
      imageObjectComparable: Boolean(sourceMetadata?.expectedObjectTags?.length),
      imageColorComparable: Boolean(sourceMetadata?.expectedColorTags?.length),
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
      colorTags: question.image.colorTags,
      dominantColorTags: question.image.dominantColorTags,
      objectTags: question.image.objectTags,
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
  const autoMatchThreshold = Number(options.autoMatchThreshold ?? (analysisMode === "diagnostic" ? 80 : 72));
  const autoGapThreshold = Number(options.autoGapThreshold ?? (analysisMode === "diagnostic" ? 10 : 9));
  const autoPromptThreshold = Number(options.autoPromptThreshold ?? (analysisMode === "diagnostic" ? 0.35 : 0.3));
  const sourceLang = normalizeLang(options.sourceLang ?? batchIntake?.meta?.lang ?? DEFAULT_REFERENCE_LANG);
  const correctionRules = normalizeCorrectionRulesOption(options.correctionRules);
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
        analysis: {
          matchingProfile: matchSignalProfile(itemShape, item),
          decisionReasonCodes: ["no-translated-text"],
          autoMatch: {
            profile: matchSignalProfile(itemShape, item),
            topScore: 0,
            rank2Score: 0,
            scoreGap: 0,
            thresholds: null,
            signalAgreement: null,
            separation: null,
            autoMatched: false,
            reasonCodes: ["no-translated-text"],
          },
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
          candidateCountAfterMcqShortlist: 0,
          mcqShortlistApplied: false,
          mcqShortlistMode: "no-candidates",
          matchingProfile: matchSignalProfile(itemShape, item),
          decisionReasonCodes: ["no-parity-candidates"],
          autoMatch: {
            profile: matchSignalProfile(itemShape, item),
            topScore: 0,
            rank2Score: 0,
            scoreGap: 0,
            thresholds: null,
            signalAgreement: null,
            separation: null,
            autoMatched: false,
            reasonCodes: ["no-parity-candidates"],
          },
          explanation: "Parity filtering removed all candidates, so no image-mismatched comparisons were produced.",
        },
        topCandidates: [],
      });
      continue;
    }

    const structuralPool = filterQuestionsByStructure(item, itemShape, sourceReviewMetadata, parity.questions, {
      candidateLimit,
      sourceLang,
    });
    const mcqShortlist = shortlistQuestionsForMcq(itemShape, sourceReviewMetadata, structuralPool.entries, corpus, {
      candidateLimit,
    });
    const reranked = applyWeightedReranking(
      mcqShortlist.entries.map(({ question, structural }) => ({
        question,
        score: scoreQuestionForBatchItem(item, question, corpus, {
          itemShape,
          sourceMetadata: sourceReviewMetadata,
          sourceLang,
          structural,
        }),
      })),
    );
    const learnedAdjustment = applyCorrectionRulesToRankedCandidates({
      ranked: reranked,
      correctionRules,
    });
    const ranked = learnedAdjustment.ranked;

    const top = ranked[0];
    const runnerUp = ranked[1];
    const gap = top ? top.score.total - (runnerUp?.score.total ?? 0) : 0;
    const gatingAdjustments = computeCorrectionRuleGatingAdjustments(top, correctionRules);
    const decision = evaluateAutoMatchDecision({
      itemShape,
      top,
      runnerUp,
      gap,
      thresholds: {
        reviewFloor,
        autoMatchThreshold,
        autoGapThreshold,
        autoPromptThreshold,
      },
      gatingAdjustments,
    });
    const candidates = ranked
      .slice(0, candidateLimit)
      .map(({ question, score }) => candidateSnapshot(item, question, score));
    const plausibleShortlist = shortlistPlausibility(top, gap);

    if (!top || top.score.total < decision.thresholds.reviewFloor || (analysisMode === "diagnostic" && !plausibleShortlist)) {
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
          candidateCountAfterStructuralFilter: structuralPool.selectedCount,
          candidateCountAfterMcqShortlist: mcqShortlist.shortlistedCount,
          structuralFilterMode: structuralPool.mode,
          structuralHardCandidateCount: structuralPool.hardCount,
          structuralSoftCandidateCount: structuralPool.softCount,
          mcqShortlistApplied: mcqShortlist.applied,
          mcqShortlistMode: mcqShortlist.mode,
          mcqShortlistTopScore: mcqShortlist.topStageAScore,
          correctionRuleIdsAppliedToRanking: learnedAdjustment.appliedRuleIds,
          correctionRuleIdsAppliedToGating: gatingAdjustments.appliedRuleIds,
          reviewFloorDelta: gatingAdjustments.reviewFloorDelta,
          matchingProfile: decision.profile,
          decisionReasonCodes: decision.reasonCodes,
          autoMatch: {
            profile: decision.profile,
            topScore: round(top?.score.total ?? 0),
            rank2Score: round(runnerUp?.score.total ?? 0),
            scoreGap: round(gap),
            thresholds: decision.thresholds,
            signalAgreement: decision.signalAgreement,
            separation: decision.separation,
            autoMatched: false,
          },
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
          colorTags: top.question.image.colorTags,
          objectTags: top.question.image.objectTags,
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
        candidateCountAfterStructuralFilter: structuralPool.selectedCount,
        candidateCountAfterMcqShortlist: mcqShortlist.shortlistedCount,
        structuralFilterMode: structuralPool.mode,
        structuralHardCandidateCount: structuralPool.hardCount,
        structuralSoftCandidateCount: structuralPool.softCount,
        mcqShortlistApplied: mcqShortlist.applied,
        mcqShortlistMode: mcqShortlist.mode,
        mcqShortlistTopScore: mcqShortlist.topStageAScore,
        correctionRuleIdsAppliedToRanking: learnedAdjustment.appliedRuleIds,
        correctionRuleIdsAppliedToGating: gatingAdjustments.appliedRuleIds,
        matchingProfile: decision.profile,
        decisionReasonCodes: decision.reasonCodes,
        autoMatchThresholdDelta: gatingAdjustments.autoMatchThresholdDelta,
        autoGapThresholdDelta: gatingAdjustments.autoGapThresholdDelta,
        autoMatch: {
          profile: decision.profile,
          topScore: round(top?.score.total ?? 0),
          rank2Score: round(runnerUp?.score.total ?? 0),
          scoreGap: round(gap),
          thresholds: decision.thresholds,
          signalAgreement: decision.signalAgreement,
          separation: decision.separation,
          autoMatched: false,
        },
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
      decision.autoMatched &&
      (!itemShape.effectiveType || itemShape.effectiveType === top.question.type);

    if (!confident && itemShape.effectiveType && itemShape.effectiveType !== top.question.type) {
      result.analysis.decisionReasonCodes = unique([
        ...result.analysis.decisionReasonCodes,
        "type-mismatch",
      ]);
    }

    result.analysis.autoMatch.autoMatched = confident;
    result.analysis.autoMatch.reasonCodes = result.analysis.decisionReasonCodes;

    if (confident) {
      matched.push(result);
    } else {
      reviewNeeded.push(result);
    }
  }

  return { matched, reviewNeeded, unresolved };
}

function normalizeCorrectionRulesDoc(doc, sourcePath = null) {
  if (!doc || typeof doc !== "object") {
    throw new Error(`Invalid correction rules document${sourcePath ? ` in ${sourcePath}` : ""}.`);
  }

  return {
    generatedAt: typeof doc.generatedAt === "string" ? doc.generatedAt : null,
    sourcePath,
    rules: Array.isArray(doc.rules) ? doc.rules.filter((rule) => rule && typeof rule === "object") : [],
  };
}

function normalizeCorrectionRulesOption(correctionRules) {
  if (!correctionRules) {
    return null;
  }

  if (Array.isArray(correctionRules?.rules)) {
    return correctionRules;
  }

  return normalizeCorrectionRulesDoc(correctionRules);
}

function applyCorrectionRulesToRankedCandidates({ ranked, correctionRules }) {
  if (!Array.isArray(ranked) || ranked.length === 0 || !Array.isArray(correctionRules?.rules) || correctionRules.rules.length === 0) {
    return {
      ranked,
      appliedRuleIds: [],
    };
  }

  const rankedByQid = new Map(ranked.map((entry) => [entry?.question?.qid, entry]));
  const adjustedByQid = new Map();
  const appliedRuleIds = [];

  for (const rule of correctionRules.rules) {
    if (rule?.type !== "candidate_confusion_pair") {
      continue;
    }

    const topCandidate = normalizeCorrectionRuleQid(rule?.when?.topCandidate);
    const reviewedChoice = normalizeCorrectionRuleQid(rule?.when?.reviewedChoice);
    if (!topCandidate || !reviewedChoice) {
      continue;
    }

    if ((ranked[0]?.question?.qid ?? null) !== topCandidate) {
      continue;
    }

    const topEntry = rankedByQid.get(topCandidate);
    const reviewedEntry = rankedByQid.get(reviewedChoice);
    if (!topEntry || !reviewedEntry) {
      continue;
    }

    const scoreDelta = clampRuleNumber(rule?.action?.scoreDelta, 0, 4) ?? 0;
    if (scoreDelta <= 0) {
      continue;
    }

    adjustedByQid.set(topCandidate, (adjustedByQid.get(topCandidate) ?? 0) - scoreDelta);
    adjustedByQid.set(reviewedChoice, (adjustedByQid.get(reviewedChoice) ?? 0) + scoreDelta);
    appliedRuleIds.push(typeof rule?.id === "string" ? rule.id : `${rule.type}:${topCandidate}:${reviewedChoice}`);
  }

  if (adjustedByQid.size === 0) {
    return {
      ranked,
      appliedRuleIds,
    };
  }

  return {
    ranked: ranked
      .map((entry) => {
        const qid = entry?.question?.qid ?? null;
        const learnedAdjustment = qid ? adjustedByQid.get(qid) ?? 0 : 0;
        if (!learnedAdjustment) {
          return entry;
        }

        return {
          ...entry,
          score: {
            ...entry.score,
            total: round(entry.score.total + learnedAdjustment),
            learnedAdjustment: round((entry.score.learnedAdjustment ?? 0) + learnedAdjustment),
            breakdown: {
              ...entry.score.breakdown,
              learnedAdjustment: round((entry.score.breakdown.learnedAdjustment ?? 0) + learnedAdjustment),
            },
          },
        };
      })
      .sort((left, right) => right.score.total - left.score.total),
    appliedRuleIds,
  };
}

function computeCorrectionRuleGatingAdjustments(top, correctionRules) {
  const result = {
    reviewFloorDelta: 0,
    autoMatchThresholdDelta: 0,
    autoGapThresholdDelta: 0,
    forceReview: false,
    appliedRuleIds: [],
  };

  const topQid = top?.question?.qid ?? null;
  if (!topQid || !Array.isArray(correctionRules?.rules) || correctionRules.rules.length === 0) {
    return result;
  }

  for (const rule of correctionRules.rules) {
    const whenTopCandidate = normalizeCorrectionRuleQid(rule?.when?.topCandidate);
    if (!whenTopCandidate || whenTopCandidate !== topQid) {
      continue;
    }

    if (rule?.type === "top_candidate_requires_review") {
      result.reviewFloorDelta += clampRuleNumber(rule?.action?.raiseReviewFloorBy, 0, 6) ?? 0;
      result.autoMatchThresholdDelta += clampRuleNumber(rule?.action?.raiseAutoMatchThresholdBy, 0, 8) ?? 0;
      result.autoGapThresholdDelta += clampRuleNumber(rule?.action?.raiseAutoGapThresholdBy, 0, 4) ?? 0;
      result.forceReview = result.forceReview || rule?.action?.routeToReview === true;
      result.appliedRuleIds.push(typeof rule?.id === "string" ? rule.id : `${rule.type}:${topQid}`);
      continue;
    }

    if (rule?.type === "top_candidate_high_precision") {
      result.autoMatchThresholdDelta -= clampRuleNumber(rule?.action?.lowerAutoMatchThresholdBy, 0, 4) ?? 0;
      result.appliedRuleIds.push(typeof rule?.id === "string" ? rule.id : `${rule.type}:${topQid}`);
    }
  }

  result.reviewFloorDelta = round(result.reviewFloorDelta);
  result.autoMatchThresholdDelta = round(result.autoMatchThresholdDelta);
  result.autoGapThresholdDelta = round(result.autoGapThresholdDelta);
  return result;
}

function clampRuleNumber(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(minimum, Math.min(maximum, numeric));
}

function normalizeCorrectionRuleQid(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (/^q\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `q${trimmed.padStart(4, "0")}`;
  }

  return null;
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
