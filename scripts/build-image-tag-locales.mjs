#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATASET_DIR = path.join(ROOT, "public", "qbank", "2023-test1");
const TAGS_PATH = path.join(DATASET_DIR, "image-color-tags.json");
const LOCALES_PATH = path.join(DATASET_DIR, "image-tag-locales.json");
const REPORT_JSON_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "image-tag-locales-report.json");
const REPORT_MD_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "image-tag-locales-report.md");
const LANGS = ["ko", "ja", "ru"];

const EXACT_ALIASES = {
  ko: {
    "blue car": ["파란 차", "파란색 자동차", "파란 차량"],
    "green car": ["초록 차", "녹색 자동차", "초록색 차량"],
    "no-image": ["이미지 없음", "그림 없음", "사진 없음"],
    "orange car": ["주황색 차", "주황색 자동차", "주황 차량"],
    "purple car": ["보라색 차", "보라색 자동차", "보라 차량"],
    "red car": ["빨간 차", "빨간색 자동차", "적색 차량"],
    "yellow car": ["노란 차", "노란색 자동차", "황색 차량"],
    "big brother is watching": ["감시 카메라", "감시", "빅브라더"],
    "black-car": ["검은 차", "검은색 자동차", "검정 차량"],
    "blue-car": ["파란 차", "파란색 자동차", "파란 차량"],
    "blue-sign": ["파란 표지", "파란색 표지판", "청색 표지"],
    "bus-stop": ["버스 정류장", "정류장", "버스 승강장"],
    "center-console": ["센터 콘솔", "중앙 콘솔", "차량 중앙 조작부"],
    "chinese-text": ["중국어 글자", "중국어 표시", "한자 표기"],
    "control-lever": ["조작 레버", "컨트롤 레버", "제어 레버"],
    "countryroad": ["시골길", "지방 도로", "교외 도로"],
    "crosswalk": ["횡단보도", "보행자 횡단보도"],
    "dashboard-indicator": ["계기판 표시등", "계기판 경고등", "차량 표시등"],
    "dashed-lines": ["점선", "차선 점선", "끊어진 선"],
    "department-store": ["백화점", "상점", "쇼핑 건물"],
    "disabled": ["장애인", "장애인 표시", "장애인 구역"],
    "double-arrows": ["양방향 화살표", "두 개의 화살표"],
    "double-headed-arrow": ["양방향 화살표", "양끝 화살표"],
    "gas-pump": ["주유기", "연료 펌프", "주유소 펌프"],
    "gas-station": ["주유소", "연료 충전소"],
    "gray-background": ["회색 배경", "회색 바탕"],
    "gray-car": ["회색 차", "회색 자동차", "회색 차량"],
    "green-car": ["초록 차", "녹색 자동차", "초록색 차량"],
    "green-light": ["초록불", "녹색 신호", "초록 신호등"],
    "green-signal": ["녹색 신호", "초록불", "진행 신호"],
    "highway-sign": ["고속도로 표지", "고속도로 표지판"],
    "island-tree": ["교통섬 나무", "섬 모양 나무", "가운데 나무"],
    "left-arrow": ["왼쪽 화살표", "좌회전 화살표", "좌측 화살표"],
    "left-down": ["왼쪽 아래 화살표", "좌하향 화살표"],
    "left-right": ["좌우 화살표", "왼쪽 오른쪽 표시"],
    "left-turn": ["좌회전", "왼쪽 회전", "좌회전 표시"],
    "lightning-bolt": ["번개 표시", "번개", "전기 경고"],
    "no-uturn": ["유턴 금지", "U턴 금지", "회차 금지"],
    "open-door": ["문 열림", "차문 열림", "도어 열림"],
    "open-hood": ["보닛 열림", "후드 열림", "엔진룸 열림"],
    "open-trunk": ["트렁크 열림", "짐칸 열림"],
    "orange-car": ["주황색 차", "주황색 자동차", "주황 차량"],
    "parking-brake": ["주차 브레이크", "파킹 브레이크", "주차 제동장치"],
    "parking-lot": ["주차장", "주차 구역"],
    "parking=space": ["주차 공간", "주차 자리", "주차 구역"],
    "police-car": ["경찰차", "순찰차"],
    "purple-car": ["보라색 차", "보라색 자동차", "보라 차량"],
    "red-arrow": ["빨간 화살표", "적색 화살표"],
    "red-car": ["빨간 차", "빨간색 자동차", "적색 차량"],
    "red-circle": ["빨간 원", "적색 원형 표시"],
    "red-light": ["빨간불", "적색 신호", "빨간 신호등"],
    "red-red-green": ["빨간빨간초록 신호", "적색 적색 녹색 신호"],
    "red-roof": ["빨간 지붕", "적색 지붕"],
    "right-arrow": ["오른쪽 화살표", "우회전 화살표", "우측 화살표"],
    "right-turn": ["우회전", "오른쪽 회전", "우회전 표시"],
    "roadway": ["도로", "차도", "도로면"],
    "rocky-mountain": ["바위산", "암석 산", "산악 지형"],
    "roundabout": ["회전교차로", "로터리", "원형 교차로"],
    "running-man": ["달리는 사람", "보행자", "사람 표시"],
    "schoolkids": ["어린이", "학생", "등하교 어린이"],
    "shopping-mall": ["쇼핑몰", "상가", "쇼핑센터"],
    "signal-light": ["신호등", "교통 신호등", "신호 표시등"],
    "signal-lights": ["신호등", "교통 신호등", "여러 신호등"],
    "silver-car": ["은색 차", "은색 자동차", "회색 차량"],
    "snow-mountain": ["눈 덮인 산", "설산", "눈 산"],
    "straight-left": ["직진 및 좌회전", "직좌 표시"],
    "straight-right": ["직진 및 우회전", "직우 표시"],
    "straight-uturn": ["직진 및 유턴", "직진 유턴 표시"],
    "three-arrows": ["세 개의 화살표", "삼방향 화살표"],
    "three-lights": ["세 개의 신호등", "삼색 신호등", "신호등"],
    "three-signals": ["세 개의 신호", "삼색 신호", "신호등"],
    "traffic-light": ["신호등", "교통 신호", "교통 신호등"],
    "traffic-signal": ["교통 신호", "신호등", "교통 신호등"],
    "turn-signal": ["방향지시등", "깜빡이", "회전 신호"],
    "turn-signals": ["방향지시등", "깜빡이", "회전 신호등"],
    "vehicle-side-view": ["차량 측면도", "차 옆모습", "측면 차량"],
    "vehicle-top-view": ["차량 평면도", "차 위에서 본 모습", "상단 차량"],
    "warning-light": ["경고등", "계기판 경고등", "주의 표시등"],
    "white-arrow": ["흰색 화살표", "백색 화살표"],
    "white-car": ["흰 차", "흰색 자동차", "백색 차량"],
    "yellow-arrow": ["노란 화살표", "황색 화살표"],
    "yellow-car": ["노란 차", "노란색 자동차", "황색 차량"],
    "yellow-car-icon": ["노란 자동차 아이콘", "노란 차량 표시"],
    "yellow-light": ["노란불", "황색 신호", "노란 신호등"],
    "yellow-line": ["노란 선", "황색 차선", "노란 차선"],
    "yellow-sign": ["노란 표지", "황색 표지판", "주의 표지"],
    "yellow-square": ["노란 사각형", "황색 사각 표시"],
    "yellow-truck": ["노란 트럭", "황색 화물차"],
    "브레이크": ["브레이크", "제동장치"],
    "스틱": ["스틱", "기어 레버"],
    "신호등": ["신호등", "교통 신호"],
    "육교": ["육교", "보행자 육교"],
    "장애인": ["장애인", "장애인 표시"],
    "주차 브레이크": ["주차 브레이크", "파킹 브레이크"],
    "페달": ["페달", "차량 페달"],
    "휠체어": ["휠체어", "장애인 표시"],
  },
  ja: {
    "blue car": ["青い車", "青色の車", "青い自動車"],
    "green car": ["緑の車", "緑色の車", "緑の自動車"],
    "no-image": ["画像なし", "写真なし", "図なし"],
    "orange car": ["オレンジ色の車", "橙色の車"],
    "purple car": ["紫の車", "紫色の車"],
    "red car": ["赤い車", "赤色の車", "赤い自動車"],
    "yellow car": ["黄色い車", "黄色の車", "黄車"],
    "big brother is watching": ["監視カメラ", "監視", "ビッグブラザー"],
    "black-car": ["黒い車", "黒色の車", "黒い自動車"],
    "blue-car": ["青い車", "青色の車", "青い自動車"],
    "blue-sign": ["青い標識", "青色標識"],
    "bus-stop": ["バス停", "バス乗り場"],
    "center-console": ["センターコンソール", "中央コンソール", "車内操作部"],
    "chinese-text": ["中国語の文字", "漢字表記", "中国語表示"],
    "control-lever": ["操作レバー", "制御レバー"],
    "countryroad": ["田舎道", "地方道路", "郊外道路"],
    "crosswalk": ["横断歩道", "歩行者横断歩道"],
    "dashboard-indicator": ["計器盤表示灯", "ダッシュボード警告灯", "車両表示灯"],
    "dashed-lines": ["破線", "点線", "車線の破線"],
    "department-store": ["百貨店", "デパート", "商業施設"],
    "disabled": ["障害者", "障害者マーク", "身障者用"],
    "double-arrows": ["両方向矢印", "二つの矢印"],
    "double-headed-arrow": ["両矢印", "両方向矢印"],
    "gas-pump": ["給油機", "燃料ポンプ", "ガソリンポンプ"],
    "gas-station": ["ガソリンスタンド", "給油所"],
    "gray-background": ["灰色の背景", "グレー背景"],
    "gray-car": ["灰色の車", "グレーの車"],
    "green-car": ["緑の車", "緑色の車", "緑の自動車"],
    "green-light": ["青信号", "緑信号", "緑色信号"],
    "green-signal": ["青信号", "緑信号", "進行信号"],
    "highway-sign": ["高速道路標識", "高速道路の標識"],
    "island-tree": ["交通島の木", "中央分離帯の木"],
    "left-arrow": ["左矢印", "左折矢印", "左向き矢印"],
    "left-down": ["左下矢印", "左下向き矢印"],
    "left-right": ["左右矢印", "左右方向表示"],
    "left-turn": ["左折", "左折表示", "左回り"],
    "lightning-bolt": ["稲妻マーク", "雷マーク", "電気警告"],
    "no-uturn": ["Uターン禁止", "転回禁止"],
    "open-door": ["ドア開き", "ドア開放警告"],
    "open-hood": ["ボンネット開き", "フード開き"],
    "open-trunk": ["トランク開き", "荷室開き"],
    "orange-car": ["オレンジ色の車", "橙色の車"],
    "parking-brake": ["駐車ブレーキ", "パーキングブレーキ"],
    "parking-lot": ["駐車場", "駐車区域"],
    "parking=space": ["駐車スペース", "駐車枠"],
    "police-car": ["パトカー", "警察車両"],
    "purple-car": ["紫の車", "紫色の車"],
    "red-arrow": ["赤い矢印", "赤色矢印"],
    "red-car": ["赤い車", "赤色の車", "赤い自動車"],
    "red-circle": ["赤い円", "赤色円形表示"],
    "red-light": ["赤信号", "赤色信号"],
    "red-red-green": ["赤赤緑信号", "赤色赤色緑色信号"],
    "red-roof": ["赤い屋根", "赤色の屋根"],
    "right-arrow": ["右矢印", "右折矢印", "右向き矢印"],
    "right-turn": ["右折", "右折表示", "右回り"],
    "roadway": ["道路", "車道", "路面"],
    "rocky-mountain": ["岩山", "岩の多い山", "山岳地形"],
    "roundabout": ["ラウンドアバウト", "環状交差点", "ロータリー"],
    "running-man": ["走る人", "歩行者マーク", "人の表示"],
    "schoolkids": ["児童", "通学児童", "子ども"],
    "shopping-mall": ["ショッピングモール", "商業施設"],
    "signal-light": ["信号機", "交通信号", "信号灯"],
    "signal-lights": ["信号機", "複数の信号機"],
    "silver-car": ["銀色の車", "シルバーの車", "灰色の車"],
    "snow-mountain": ["雪山", "雪の山", "雪に覆われた山"],
    "straight-left": ["直進と左折", "直左表示"],
    "straight-right": ["直進と右折", "直右表示"],
    "straight-uturn": ["直進とUターン", "直進転回表示"],
    "three-arrows": ["三つの矢印", "三方向矢印"],
    "three-lights": ["三色信号", "三つの信号機", "信号機"],
    "three-signals": ["三つの信号", "三色信号", "信号機"],
    "traffic-light": ["信号機", "交通信号", "交通信号機"],
    "traffic-signal": ["交通信号", "信号機", "交通信号機"],
    "turn-signal": ["方向指示器", "ウインカー", "右左折信号"],
    "turn-signals": ["方向指示器", "ウインカー", "方向指示灯"],
    "vehicle-side-view": ["車両側面図", "車の横向き", "側面車両"],
    "vehicle-top-view": ["車両平面図", "車を上から見た図", "上面車両"],
    "warning-light": ["警告灯", "計器盤警告灯", "注意表示灯"],
    "white-arrow": ["白い矢印", "白色矢印"],
    "white-car": ["白い車", "白色の車", "白い自動車"],
    "yellow-arrow": ["黄色い矢印", "黄色矢印"],
    "yellow-car": ["黄色い車", "黄色の車", "黄車"],
    "yellow-car-icon": ["黄色い車アイコン", "黄色車両マーク"],
    "yellow-light": ["黄信号", "黄色信号"],
    "yellow-line": ["黄色い線", "黄色車線", "黄線"],
    "yellow-sign": ["黄色い標識", "警戒標識", "黄色標識"],
    "yellow-square": ["黄色い四角", "黄色四角表示"],
    "yellow-truck": ["黄色いトラック", "黄色貨物車"],
    "브레이크": ["ブレーキ", "制動装置"],
    "스틱": ["スティック", "ギアレバー"],
    "신호등": ["信号機", "交通信号"],
    "육교": ["歩道橋", "横断歩道橋"],
    "장애인": ["障害者", "障害者マーク"],
    "주차 브레이크": ["駐車ブレーキ", "パーキングブレーキ"],
    "페달": ["ペダル", "車両ペダル"],
    "휠체어": ["車椅子", "障害者マーク"],
  },
  ru: {
    "blue car": ["синяя машина", "синий автомобиль", "синее авто"],
    "green car": ["зелёная машина", "зелёный автомобиль"],
    "no-image": ["нет изображения", "нет картинки", "нет фото"],
    "orange car": ["оранжевая машина", "оранжевый автомобиль"],
    "purple car": ["фиолетовая машина", "фиолетовый автомобиль"],
    "red car": ["красная машина", "красный автомобиль"],
    "yellow car": ["жёлтая машина", "жёлтый автомобиль"],
    "big brother is watching": ["камера наблюдения", "наблюдение", "большой брат"],
    "black-car": ["чёрная машина", "чёрный автомобиль"],
    "blue-car": ["синяя машина", "синий автомобиль", "синее авто"],
    "blue-sign": ["синий знак", "синий дорожный знак"],
    "bus-stop": ["автобусная остановка", "остановка автобуса"],
    "center-console": ["центральная консоль", "центральная панель", "консоль автомобиля"],
    "chinese-text": ["китайский текст", "китайские иероглифы", "надпись на китайском"],
    "control-lever": ["рычаг управления", "контрольный рычаг"],
    "countryroad": ["просёлочная дорога", "загородная дорога", "сельская дорога"],
    "crosswalk": ["пешеходный переход", "зебра"],
    "dashboard-indicator": ["индикатор на панели приборов", "лампа на приборной панели", "индикатор автомобиля"],
    "dashed-lines": ["пунктирные линии", "пунктирная разметка", "прерывистая линия"],
    "department-store": ["универмаг", "торговый центр", "магазин"],
    "disabled": ["инвалид", "знак для инвалидов", "место для инвалидов"],
    "double-arrows": ["две стрелки", "двунаправленная стрелка"],
    "double-headed-arrow": ["двусторонняя стрелка", "стрелка в обе стороны"],
    "gas-pump": ["топливная колонка", "бензоколонка", "заправочный насос"],
    "gas-station": ["заправка", "АЗС", "автозаправочная станция"],
    "gray-background": ["серый фон", "серая подложка"],
    "gray-car": ["серая машина", "серый автомобиль"],
    "green-car": ["зелёная машина", "зелёный автомобиль"],
    "green-light": ["зелёный свет", "зелёный сигнал светофора"],
    "green-signal": ["зелёный сигнал", "зелёный свет", "разрешающий сигнал"],
    "highway-sign": ["знак автомагистрали", "дорожный знак на шоссе"],
    "island-tree": ["дерево на островке", "дерево на разделительном островке"],
    "left-arrow": ["стрелка налево", "левая стрелка", "указатель налево"],
    "left-down": ["стрелка вниз налево", "левая нижняя стрелка"],
    "left-right": ["стрелки влево и вправо", "лево право"],
    "left-turn": ["поворот налево", "левый поворот", "знак налево"],
    "lightning-bolt": ["молния", "значок молнии", "электрическое предупреждение"],
    "no-uturn": ["разворот запрещён", "запрет разворота"],
    "open-door": ["открытая дверь", "дверь открыта", "индикатор двери"],
    "open-hood": ["открытый капот", "капот открыт"],
    "open-trunk": ["открытый багажник", "багажник открыт"],
    "orange-car": ["оранжевая машина", "оранжевый автомобиль"],
    "parking-brake": ["стояночный тормоз", "парковочный тормоз", "ручной тормоз"],
    "parking-lot": ["парковка", "парковочная площадка"],
    "parking=space": ["парковочное место", "место для парковки"],
    "police-car": ["полицейская машина", "патрульная машина"],
    "purple-car": ["фиолетовая машина", "фиолетовый автомобиль"],
    "red-arrow": ["красная стрелка", "стрелка красного цвета"],
    "red-car": ["красная машина", "красный автомобиль"],
    "red-circle": ["красный круг", "красный круглый знак"],
    "red-light": ["красный свет", "красный сигнал светофора"],
    "red-red-green": ["красный красный зелёный сигнал", "сигналы красный красный зелёный"],
    "red-roof": ["красная крыша", "крыша красного цвета"],
    "right-arrow": ["стрелка направо", "правая стрелка", "указатель направо"],
    "right-turn": ["поворот направо", "правый поворот", "знак направо"],
    "roadway": ["проезжая часть", "дорога", "дорожное полотно"],
    "rocky-mountain": ["скалистая гора", "каменистая гора", "горная местность"],
    "roundabout": ["круговое движение", "кольцевая развязка", "круговой перекрёсток"],
    "running-man": ["бегущий человек", "пешеход", "значок человека"],
    "schoolkids": ["школьники", "дети", "дети у школы"],
    "shopping-mall": ["торговый центр", "молл"],
    "signal-light": ["светофор", "сигнальный фонарь", "световой сигнал"],
    "signal-lights": ["светофоры", "сигнальные огни"],
    "silver-car": ["серебристая машина", "серебристый автомобиль", "серая машина"],
    "snow-mountain": ["снежная гора", "гора в снегу", "заснеженная гора"],
    "straight-left": ["прямо и налево", "движение прямо и налево"],
    "straight-right": ["прямо и направо", "движение прямо и направо"],
    "straight-uturn": ["прямо и разворот", "движение прямо и разворот"],
    "three-arrows": ["три стрелки", "стрелки в три направления"],
    "three-lights": ["три сигнала светофора", "трёхцветный светофор", "светофор"],
    "three-signals": ["три сигнала", "трёхцветный сигнал", "светофор"],
    "traffic-light": ["светофор", "дорожный светофор", "сигнал светофора"],
    "traffic-signal": ["сигнал светофора", "светофор", "дорожный сигнал"],
    "turn-signal": ["указатель поворота", "поворотник", "сигнал поворота"],
    "turn-signals": ["указатели поворота", "поворотники", "сигналы поворота"],
    "vehicle-side-view": ["вид автомобиля сбоку", "боковой вид машины"],
    "vehicle-top-view": ["вид автомобиля сверху", "схема сверху"],
    "warning-light": ["сигнальная лампа", "предупреждающий индикатор", "лампа на панели"],
    "white-arrow": ["белая стрелка", "стрелка белого цвета"],
    "white-car": ["белая машина", "белый автомобиль"],
    "yellow-arrow": ["жёлтая стрелка", "стрелка жёлтого цвета"],
    "yellow-car": ["жёлтая машина", "жёлтый автомобиль"],
    "yellow-car-icon": ["значок жёлтой машины", "жёлтый автомобильный значок"],
    "yellow-light": ["жёлтый свет", "жёлтый сигнал светофора"],
    "yellow-line": ["жёлтая линия", "жёлтая дорожная разметка"],
    "yellow-sign": ["жёлтый знак", "предупреждающий знак", "жёлтый дорожный знак"],
    "yellow-square": ["жёлтый квадрат", "квадрат жёлтого цвета"],
    "yellow-truck": ["жёлтый грузовик", "жёлтая грузовая машина"],
    "브레이크": ["тормоз", "тормозная система"],
    "스틱": ["рычаг", "рычаг переключения передач"],
    "신호등": ["светофор", "дорожный сигнал"],
    "육교": ["пешеходный мост", "надземный переход"],
    "장애인": ["инвалид", "знак для инвалидов"],
    "주차 브레이크": ["стояночный тормоз", "парковочный тормоз"],
    "페달": ["педаль", "педаль автомобиля"],
    "휠체어": ["инвалидная коляска", "знак инвалидов"],
  },
};

const TOKEN_ALIASES = {
  ko: {
    alone: ["단독"], antlers: ["뿔"], arrow: ["화살표"], arrows: ["화살표"], bambi: ["밤비"], battery: ["배터리"], bicycle: ["자전거"], bike: ["자전거"], black: ["검은색"], blinkers: ["깜빡이"], blue: ["파란색"], boat: ["배"], bolt: ["번개"], boy: ["소년"], brake: ["브레이크"], bridge: ["다리"], brown: ["갈색"], building: ["건물"], buildings: ["건물"], bull: ["황소"], bumps: ["요철"], bumpy: ["울퉁불퉁한"], bus: ["버스"], camera: ["카메라"], car: ["자동차"], cctv: ["CCTV"], child: ["어린이"], children: ["어린이"], circle: ["원"], city: ["도시"], cliff: ["절벽"], clouds: ["구름"], coffee: ["커피"], cone: ["콘"], cones: ["콘"], construction: ["공사"], cow: ["소"], crash: ["충돌"], curb: ["연석"], curve: ["커브"], curved: ["곡선"], cycle: ["자전거"], dark: ["어두운"], dash: ["계기판"], deer: ["사슴"], diamond: ["마름모"], dig: ["공사"], downhill: ["내리막"], emergency: ["비상"], flooded: ["침수"], fog: ["안개"], foggy: ["안개 낀"], fork: ["갈림길"], gas: ["주유"], girl: ["소녀"], grass: ["풀"], gray: ["회색"], green: ["초록색"], grey: ["회색"], hail: ["우박"], hammer: ["망치"], hat: ["모자"], height: ["높이"], highway: ["고속도로"], horn: ["경적"], house: ["집"], houses: ["집"], human: ["사람"], humps: ["과속방지턱"], indicator: ["표시등"], inside: ["내부"], interior: ["실내"], intersection: ["교차로"], key: ["열쇠"], kids: ["어린이"], kite: ["연"], knife: ["칼"], lamp: ["램프"], left: ["왼쪽"], lighthouse: ["등대"], lightning: ["번개"], lonely: ["외로운"], lonley: ["외로운"], man: ["남자"], merge: ["합류"], mist: ["안개"], misty: ["안개 낀"], mountain: ["산"], mountains: ["산"], narrows: ["좁아짐"], night: ["밤"], numbers: ["숫자"], open: ["열림"], orange: ["주황색"], overpass: ["고가도로"], parking: ["주차"], pedal: ["페달"], pedestrian: ["보행자"], pedestrians: ["보행자"], people: ["사람들"], pov: ["운전자 시점"], pump: ["펌프"], purple: ["보라색"], railroad: ["철도"], railway: ["철도"], rain: ["비"], raininig: ["비"], red: ["빨간색"], reindeer: ["순록"], right: ["오른쪽"], rocks: ["바위"], rudolph: ["루돌프"], run: ["달리기"], school: ["학교"], seatbelt: ["안전벨트"], shield: ["방패"], ship: ["배"], shopping: ["쇼핑"], shovel: ["삽"], sidewalk: ["보도"], sign: ["표지판"], signal: ["신호"], signals: ["신호"], silver: ["은색"], skid: ["미끄러짐"], skidding: ["미끄러짐"], skyscraper: ["고층 건물"], slanted: ["기울어진"], slope: ["경사"], slow: ["천천히"], snow: ["눈"], snowy: ["눈 덮인"], splash: ["물 튐"], square: ["사각형"], squiggly: ["구불구불한"], stalk: ["레버"], steamy: ["김 서림"], stick: ["스틱"], stop: ["정지"], straight: ["직진"], sunset: ["일몰"], telephone: ["전화"], three: ["세 개"], throttle: ["가속 페달"], thunder: ["천둥"], town: ["마을"], traffic: ["교통"], train: ["기차"], tree: ["나무"], trees: ["나무"], triangle: ["삼각형"], triple: ["세 개"], trumpet: ["나팔"], tunnel: ["터널"], turn: ["회전"], twisted: ["꼬인"], two: ["두 개"], uphill: ["오르막"], vehicle: ["차량"], village: ["마을"], wall: ["벽"], warning: ["경고"], water: ["물"], wheelchair: ["휠체어"], white: ["흰색"], wildlife: ["야생동물"], wind: ["바람"], windshield: ["앞유리"], wiper: ["와이퍼"], wipers: ["와이퍼"], wrench: ["렌치"], yellow: ["노란색"], yield: ["양보"], zigzag: ["지그재그"],
  },
  ja: {
    alone: ["単独"], antlers: ["角"], arrow: ["矢印"], arrows: ["矢印"], bambi: ["バンビ"], battery: ["バッテリー"], bicycle: ["自転車"], bike: ["自転車"], black: ["黒"], blinkers: ["ウインカー"], blue: ["青"], boat: ["船"], bolt: ["稲妻"], boy: ["男の子"], brake: ["ブレーキ"], bridge: ["橋"], brown: ["茶色"], building: ["建物"], buildings: ["建物"], bull: ["雄牛"], bumps: ["段差"], bumpy: ["でこぼこ"], bus: ["バス"], camera: ["カメラ"], car: ["車"], cctv: ["監視カメラ"], child: ["子ども"], children: ["子ども"], circle: ["円"], city: ["都市"], cliff: ["崖"], clouds: ["雲"], coffee: ["コーヒー"], cone: ["コーン"], cones: ["コーン"], construction: ["工事"], cow: ["牛"], crash: ["衝突"], curb: ["縁石"], curve: ["カーブ"], curved: ["曲線"], cycle: ["自転車"], dark: ["暗い"], dash: ["ダッシュボード"], deer: ["鹿"], diamond: ["ひし形"], dig: ["工事"], downhill: ["下り坂"], emergency: ["非常"], flooded: ["冠水"], fog: ["霧"], foggy: ["霧の"], fork: ["分岐"], gas: ["給油"], girl: ["女の子"], grass: ["草"], gray: ["灰色"], green: ["緑"], grey: ["灰色"], hail: ["ひょう"], hammer: ["ハンマー"], hat: ["帽子"], height: ["高さ"], highway: ["高速道路"], horn: ["クラクション"], house: ["家"], houses: ["家"], human: ["人"], humps: ["ハンプ"], indicator: ["表示灯"], inside: ["内部"], interior: ["車内"], intersection: ["交差点"], key: ["鍵"], kids: ["子ども"], kite: ["凧"], knife: ["ナイフ"], lamp: ["ランプ"], left: ["左"], lighthouse: ["灯台"], lightning: ["稲妻"], lonely: ["単独"], lonley: ["単独"], man: ["男性"], merge: ["合流"], mist: ["霧"], misty: ["霧の"], mountain: ["山"], mountains: ["山"], narrows: ["狭くなる"], night: ["夜"], numbers: ["数字"], open: ["開き"], orange: ["オレンジ色"], overpass: ["高架"], parking: ["駐車"], pedal: ["ペダル"], pedestrian: ["歩行者"], pedestrians: ["歩行者"], people: ["人々"], pov: ["運転者視点"], pump: ["ポンプ"], purple: ["紫"], railroad: ["鉄道"], railway: ["鉄道"], rain: ["雨"], raininig: ["雨"], red: ["赤"], reindeer: ["トナカイ"], right: ["右"], rocks: ["岩"], rudolph: ["ルドルフ"], run: ["走る"], school: ["学校"], seatbelt: ["シートベルト"], shield: ["盾"], ship: ["船"], shopping: ["買い物"], shovel: ["シャベル"], sidewalk: ["歩道"], sign: ["標識"], signal: ["信号"], signals: ["信号"], silver: ["銀色"], skid: ["スリップ"], skidding: ["スリップ"], skyscraper: ["高層ビル"], slanted: ["斜め"], slope: ["坂"], slow: ["徐行"], snow: ["雪"], snowy: ["雪の"], splash: ["水しぶき"], square: ["四角"], squiggly: ["曲がった"], stalk: ["レバー"], steamy: ["曇り"], stick: ["スティック"], stop: ["停止"], straight: ["直進"], sunset: ["夕日"], telephone: ["電話"], three: ["三つ"], throttle: ["アクセル"], thunder: ["雷"], town: ["町"], traffic: ["交通"], train: ["電車"], tree: ["木"], trees: ["木"], triangle: ["三角"], triple: ["三つ"], trumpet: ["ラッパ"], tunnel: ["トンネル"], turn: ["曲がる"], twisted: ["ねじれた"], two: ["二つ"], uphill: ["上り坂"], vehicle: ["車両"], village: ["村"], wall: ["壁"], warning: ["警告"], water: ["水"], wheelchair: ["車椅子"], white: ["白"], wildlife: ["野生動物"], wind: ["風"], windshield: ["フロントガラス"], wiper: ["ワイパー"], wipers: ["ワイパー"], wrench: ["レンチ"], yellow: ["黄色"], yield: ["譲れ"], zigzag: ["ジグザグ"],
  },
  ru: {
    alone: ["один"], antlers: ["рога"], arrow: ["стрелка"], arrows: ["стрелки"], bambi: ["оленёнок"], battery: ["аккумулятор"], bicycle: ["велосипед"], bike: ["велосипед"], black: ["чёрный"], blinkers: ["поворотники"], blue: ["синий"], boat: ["лодка"], bolt: ["молния"], boy: ["мальчик"], brake: ["тормоз"], bridge: ["мост"], brown: ["коричневый"], building: ["здание"], buildings: ["здания"], bull: ["бык"], bumps: ["неровности"], bumpy: ["неровный"], bus: ["автобус"], camera: ["камера"], car: ["автомобиль"], cctv: ["камера наблюдения"], child: ["ребёнок"], children: ["дети"], circle: ["круг"], city: ["город"], cliff: ["обрыв"], clouds: ["облака"], coffee: ["кофе"], cone: ["конус"], cones: ["конусы"], construction: ["стройка"], cow: ["корова"], crash: ["авария"], curb: ["бордюр"], curve: ["поворот"], curved: ["изогнутый"], cycle: ["велосипед"], dark: ["тёмный"], dash: ["панель приборов"], deer: ["олень"], diamond: ["ромб"], dig: ["раскопки"], downhill: ["спуск"], emergency: ["аварийный"], flooded: ["затопленный"], fog: ["туман"], foggy: ["туманный"], fork: ["развилка"], gas: ["топливо"], girl: ["девочка"], grass: ["трава"], gray: ["серый"], green: ["зелёный"], grey: ["серый"], hail: ["град"], hammer: ["молоток"], hat: ["шляпа"], height: ["высота"], highway: ["шоссе"], horn: ["сигнал"], house: ["дом"], houses: ["дома"], human: ["человек"], humps: ["лежачий полицейский"], indicator: ["индикатор"], inside: ["внутри"], interior: ["салон"], intersection: ["перекрёсток"], key: ["ключ"], kids: ["дети"], kite: ["воздушный змей"], knife: ["нож"], lamp: ["лампа"], left: ["левый"], lighthouse: ["маяк"], lightning: ["молния"], lonely: ["одинокий"], lonley: ["одинокий"], man: ["мужчина"], merge: ["слияние"], mist: ["дымка"], misty: ["туманный"], mountain: ["гора"], mountains: ["горы"], narrows: ["сужение"], night: ["ночь"], numbers: ["цифры"], open: ["открытый"], orange: ["оранжевый"], overpass: ["эстакада"], parking: ["парковка"], pedal: ["педаль"], pedestrian: ["пешеход"], pedestrians: ["пешеходы"], people: ["люди"], pov: ["вид водителя"], pump: ["насос"], purple: ["фиолетовый"], railroad: ["железная дорога"], railway: ["железная дорога"], rain: ["дождь"], raininig: ["дождь"], red: ["красный"], reindeer: ["северный олень"], right: ["правый"], rocks: ["камни"], rudolph: ["рудольф"], run: ["бег"], school: ["школа"], seatbelt: ["ремень безопасности"], shield: ["щит"], ship: ["корабль"], shopping: ["покупки"], shovel: ["лопата"], sidewalk: ["тротуар"], sign: ["знак"], signal: ["сигнал"], signals: ["сигналы"], silver: ["серебристый"], skid: ["занос"], skidding: ["занос"], skyscraper: ["небоскрёб"], slanted: ["наклонный"], slope: ["уклон"], slow: ["медленно"], snow: ["снег"], snowy: ["снежный"], splash: ["брызги"], square: ["квадрат"], squiggly: ["извилистый"], stalk: ["рычаг"], steamy: ["запотевший"], stick: ["рычаг"], stop: ["стоп"], straight: ["прямо"], sunset: ["закат"], telephone: ["телефон"], three: ["три"], throttle: ["педаль газа"], thunder: ["гром"], town: ["городок"], traffic: ["дорожный"], train: ["поезд"], tree: ["дерево"], trees: ["деревья"], triangle: ["треугольник"], triple: ["три"], trumpet: ["труба"], tunnel: ["тоннель"], turn: ["поворот"], twisted: ["изогнутый"], two: ["два"], uphill: ["подъём"], vehicle: ["транспортное средство"], village: ["деревня"], wall: ["стена"], warning: ["предупреждение"], water: ["вода"], wheelchair: ["инвалидная коляска"], white: ["белый"], wildlife: ["дикие животные"], wind: ["ветер"], windshield: ["лобовое стекло"], wiper: ["дворник"], wipers: ["дворники"], wrench: ["гаечный ключ"], yellow: ["жёлтый"], yield: ["уступи дорогу"], zigzag: ["зигзаг"],
  },
};

const SPECIAL_ALIASES = {
  ko: {
    "!": ["느낌표"], "+": ["더하기", "플러스"], "-": ["빼기", "마이너스"], "/": ["사선", "슬래시"], "<": ["왼쪽 꺾쇠"], "<>": ["양방향 꺾쇠"], "?": ["물음표"], ETC: ["ETC", "하이패스"], P: ["주차", "P 표시"], T: ["T자 표시"], X: ["X 표시", "금지 표시"], "^": ["위쪽 표시"], "^P": ["주차 표시"], "^p": ["주차 표시"], p: ["주차", "p 표시"], n: ["N 표시", "중립"], x: ["X 표시"], "3d": ["입체", "3D"],
  },
  ja: {
    "!": ["感嘆符"], "+": ["プラス"], "-": ["マイナス"], "/": ["斜線", "スラッシュ"], "<": ["左山括弧"], "<>": ["左右記号"], "?": ["疑問符"], ETC: ["ETC"], P: ["駐車", "Pマーク"], T: ["T字"], X: ["X印", "禁止印"], "^": ["上向き記号"], "^P": ["駐車マーク"], "^p": ["駐車マーク"], p: ["駐車", "pマーク"], n: ["N表示", "ニュートラル"], x: ["X印"], "3d": ["立体", "3D"],
  },
  ru: {
    "!": ["восклицательный знак"], "+": ["плюс"], "-": ["минус"], "/": ["косая черта", "слэш"], "<": ["знак меньше"], "<>": ["двусторонний знак"], "?": ["вопросительный знак"], ETC: ["ETC", "электронная оплата"], P: ["парковка", "знак P"], T: ["Т-образный знак"], X: ["знак X", "запрет"], "^": ["знак вверх"], "^P": ["знак парковки"], "^p": ["знак парковки"], p: ["парковка", "знак p"], n: ["знак N", "нейтраль"], x: ["знак X"], "3d": ["объёмный", "3D"],
  },
};

const NOISE_NAME_ALIASES = {
  ko: {
    "Thor's-hammer": ["토르의 망치", "망치"], dragonballz: ["드래곤볼", "공 모양"], "george-orwell": ["조지 오웰", "감시"], "harry-potter": ["해리 포터"], heil: ["나치식 경례"], hitler: ["히틀러"], illuminati: ["삼각형 눈", "일루미나티"], thomas: ["토마스 기차", "기차"], thor: ["토르"], zeus: ["제우스"], "sieg heil": ["나치식 경례"], "winter is coming": ["겨울", "눈"], "steven-hawking": ["스티븐 호킹", "휠체어"],
  },
  ja: {
    "Thor's-hammer": ["トールのハンマー", "ハンマー"], dragonballz: ["ドラゴンボール", "球"], "george-orwell": ["ジョージ・オーウェル", "監視"], "harry-potter": ["ハリー・ポッター"], heil: ["ナチス式敬礼"], hitler: ["ヒトラー"], illuminati: ["三角の目", "イルミナティ"], thomas: ["トーマス列車", "電車"], thor: ["トール"], zeus: ["ゼウス"], "sieg heil": ["ナチス式敬礼"], "winter is coming": ["冬", "雪"], "steven-hawking": ["スティーブン・ホーキング", "車椅子"],
  },
  ru: {
    "Thor's-hammer": ["молот Тора", "молот"], dragonballz: ["драгонболл", "шар"], "george-orwell": ["Джордж Оруэлл", "наблюдение"], "harry-potter": ["Гарри Поттер"], heil: ["нацистское приветствие"], hitler: ["Гитлер"], illuminati: ["треугольник с глазом", "иллюминаты"], thomas: ["паровоз Томас", "поезд"], thor: ["Тор"], zeus: ["Зевс"], "sieg heil": ["нацистское приветствие"], "winter is coming": ["зима", "снег"], "steven-hawking": ["Стивен Хокинг", "инвалидная коляска"],
  },
};

const generatedAt = new Date().toISOString();
const sourceRaw = await fs.readFile(TAGS_PATH);
const sourceHash = sha256(sourceRaw);
const sourceDoc = JSON.parse(sourceRaw.toString("utf8"));
const existingDoc = await readJsonIfExists(LOCALES_PATH, {});
const tags = [...collectTagStrings(sourceDoc)].sort(compareTags);

const locales = {};
const languageReports = {};

for (const lang of LANGS) {
  const existingLang = existingDoc?.[lang] && typeof existingDoc[lang] === "object" && !Array.isArray(existingDoc[lang])
    ? existingDoc[lang]
    : {};
  const nextLang = {};
  const preserved = [];
  const generated = [];
  const emptyAliases = [];

  for (const tag of tags) {
    const existingAliases = normalizeAliasArray(existingLang[tag]);
    if (existingAliases.length > 0) {
      nextLang[tag] = existingAliases;
      preserved.push(tag);
      continue;
    }

    const aliases = generateAliases(tag, lang);
    nextLang[tag] = aliases;
    generated.push(tag);
    if (aliases.length === 0) emptyAliases.push(tag);
  }

  locales[lang] = sortObject(nextLang);
  languageReports[lang] = {
    tagCount: Object.keys(nextLang).length,
    aliasCount: Object.values(nextLang).reduce((sum, aliases) => sum + aliases.length, 0),
    preservedAliasTags: preserved.length,
    generatedAliasTags: generated.length,
    emptyAliasTags: emptyAliases,
  };
}

await writeJson(LOCALES_PATH, sortObject(locales));

const report = {
  generatedAt,
  sourcePath: relative(TAGS_PATH),
  outputPath: relative(LOCALES_PATH),
  reportPaths: {
    json: relative(REPORT_JSON_PATH),
    markdown: relative(REPORT_MD_PATH),
  },
  sourceSha256: sourceHash,
  uniqueEnglishTagsFound: tags.length,
  languages: LANGS,
  aliasCountsByLanguage: Object.fromEntries(LANGS.map((lang) => [lang, languageReports[lang].aliasCount])),
  tagCountsByLanguage: Object.fromEntries(LANGS.map((lang) => [lang, languageReports[lang].tagCount])),
  generatedAliasTagsByLanguage: Object.fromEntries(LANGS.map((lang) => [lang, languageReports[lang].generatedAliasTags])),
  preservedAliasTagsByLanguage: Object.fromEntries(LANGS.map((lang) => [lang, languageReports[lang].preservedAliasTags])),
  emptyAliasTagsByLanguage: Object.fromEntries(LANGS.map((lang) => [lang, languageReports[lang].emptyAliasTags])),
  tags,
};

await writeJson(REPORT_JSON_PATH, report);
await writeText(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Wrote ${relative(LOCALES_PATH)}`);
console.log(`Wrote ${relative(REPORT_JSON_PATH)}`);
console.log(`Wrote ${relative(REPORT_MD_PATH)}`);
console.log(`Unique English tags found: ${tags.length}`);
for (const lang of LANGS) {
  console.log(`${lang} aliases: ${languageReports[lang].aliasCount}`);
}

function collectTagStrings(value, pathParts = [], out = new Set()) {
  if (Array.isArray(value)) {
    const key = pathParts.at(-1) ?? "";
    if (isTagArrayKey(key)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) out.add(item.trim());
      }
    }
    for (const item of value) collectTagStrings(item, pathParts, out);
    return out;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectTagStrings(child, [...pathParts, key], out);
    }
  }

  return out;
}

function isTagArrayKey(key) {
  return key === "colorTags" || key === "objectTags" || /tags$/i.test(key);
}

function generateAliases(tag, lang) {
  const aliases = [
    ...(EXACT_ALIASES[lang]?.[tag] ?? []),
    ...(SPECIAL_ALIASES[lang]?.[tag] ?? []),
    ...(NOISE_NAME_ALIASES[lang]?.[tag] ?? []),
    ...numericAliases(tag, lang),
    ...tokenAliases(tag, lang),
  ];

  if (aliases.length === 0) aliases.push(tag);
  return unique(aliases.map((alias) => String(alias).trim()).filter(Boolean));
}

function numericAliases(tag, lang) {
  const value = String(tag);
  const speed = value.match(/^(\d+(?:\.\d+)?)km\/h$/i);
  if (speed) {
    const n = speed[1];
    return {
      ko: [`시속 ${n}km`, `${n}km/h`, `속도 ${n}`],
      ja: [`時速${n}km`, `${n}km/h`, `${n}キロ`],
      ru: [`${n} км/ч`, `скорость ${n}`, value],
    }[lang];
  }

  const km = value.match(/^(\d+(?:\.\d+)?)km$/i);
  if (km) {
    const n = km[1];
    return {
      ko: [`${n}km`, `${n}킬로미터`, `${n}킬로`],
      ja: [`${n}km`, `${n}キロメートル`, `${n}キロ`],
      ru: [`${n} км`, `${n} километра`, value],
    }[lang];
  }

  const meters = value.match(/^(\d+(?:\.\d+)?)m$/i);
  if (meters) {
    const n = meters[1];
    return {
      ko: [`${n}m`, `${n}미터`],
      ja: [`${n}m`, `${n}メートル`],
      ru: [`${n} м`, `${n} метра`, value],
    }[lang];
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return [value];
  }

  if (/^[a-z]\d+$/i.test(value) || /^[xy]\d+$/i.test(value)) {
    return [value.toUpperCase(), value];
  }

  return [];
}

function tokenAliases(tag, lang) {
  const rawTokens = String(tag)
    .replace(/[=,/]+/g, " ")
    .split(/[\s_-]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  if (rawTokens.length === 0) return [];

  const lexicon = TOKEN_ALIASES[lang] ?? {};
  const translatedTokens = rawTokens.map((token) => {
    const direct = lexicon[token] ?? lexicon[token.toLowerCase()];
    return direct?.[0] ?? null;
  });

  if (translatedTokens.some((token) => !token)) return [];

  const joiner = lang === "ja" ? "" : " ";
  const phrase = translatedTokens.join(joiner);
  const aliases = [phrase];

  if (rawTokens.length === 2) {
    const [left, right] = rawTokens.map((token) => token.toLowerCase());
    if (isColorToken(left) && ["car", "truck", "sign", "arrow", "line", "light"].includes(right)) {
      aliases.push(colorObjectAlias(left, right, lang));
    }
  }

  return aliases.filter(Boolean);
}

function isColorToken(token) {
  return ["black", "blue", "brown", "gray", "green", "grey", "orange", "purple", "red", "silver", "white", "yellow"].includes(token);
}

function colorObjectAlias(color, object, lang) {
  const colorWord = TOKEN_ALIASES[lang]?.[color]?.[0];
  const objectWord = TOKEN_ALIASES[lang]?.[object]?.[0];
  if (!colorWord || !objectWord) return null;
  if (lang === "ko") return `${colorWord} ${objectWord}`;
  if (lang === "ja") return `${colorWord}${objectWord}`;
  return `${objectWord} ${colorWord}`;
}

function normalizeAliasArray(value) {
  return Array.isArray(value)
    ? unique(value.map((item) => String(item ?? "").trim()).filter(Boolean))
    : [];
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareTags(left, right)));
}

function unique(values) {
  return [...new Set(values)];
}

function compareTags(left, right) {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Image Tag Locales Report", "");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Source: ${report.sourcePath}`);
  lines.push(`Output: ${report.outputPath}`);
  lines.push(`Source SHA-256: ${report.sourceSha256}`);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(`- Unique English tags found: ${report.uniqueEnglishTagsFound}`);
  for (const lang of report.languages) {
    lines.push(`- ${lang}: ${report.aliasCountsByLanguage[lang]} aliases across ${report.tagCountsByLanguage[lang]} tags`);
  }
  lines.push("");
  lines.push("## Empty Alias Tags", "");
  for (const lang of report.languages) {
    const empty = report.emptyAliasTagsByLanguage[lang] ?? [];
    lines.push(`- ${lang}: ${empty.length ? empty.join(", ") : "none"}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
