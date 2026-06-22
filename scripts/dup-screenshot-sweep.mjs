// Per-language verbatim-duplicate sweep builder for the localized qbank.
// (Promoted from /tmp/dup-build.mjs 2026-06-04 so it's durable/version-controlled.)
// Distinct from build-duplicate-candidate-review.mjs, which finds dup candidates WITHIN
// the English master qbank; this one OCRs a language's question SCREENSHOTS and builds a
// review workbench. See docs/localization-decisions.md ("Verbatim-duplicate sweep").
// Usage: node scripts/dup-screenshot-sweep.mjs <lang> <screenshotDir> <ocrTsv> <outDir>
// Produces: <outDir>/montages/, <outDir>/<lang>-duplicates-workbench.html,
//           <outDir>/<lang>-dup-groups.json, <outDir>/DUPLICATES-FOUND.md
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const [LANG, SD, OCR, OUT] = process.argv.slice(2);
if (!LANG || !SD || !OCR || !OUT) { console.error("args: <lang> <screenshotDir> <ocrTsv> <outDir>"); process.exit(1); }
fs.mkdirSync(path.join(OUT, "montages"), { recursive: true });

// ---- 1. load OCR, tokenize, group by identical wording ----
const rows = fs.readFileSync(OCR, "utf8").split("\n").filter(Boolean).map((l) => {
  const i = l.indexOf("\t"); return { file: l.slice(0, i), text: i < 0 ? "" : l.slice(i + 1) };
});
// Multi-script tokenizer: Latin/digit runs (>=2), Cyrillic runs (>=2), and
// individual CJK / Kana / Hangul characters (CJK has no spaces). Works for every
// pending language (es/de Latin, zh CJK, ja Kana+CJK, ko Hangul, ru Cyrillic, fr Latin).
const tokens = (s) => (s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .match(/[a-z0-9]{2,}|[؀-ۿ]{2,}|[Ѐ-ӿ]{2,}|[一-鿿]|[぀-ヿ]|[가-힯]/g) || []);
const MIN_TOKS = 5; // CJK gives 1 token/char; a real question still clears this
for (const r of rows) { r.toks = tokens(r.text); r.strict = r.toks.join(" "); r.sort = [...r.toks].sort().join(" "); }
function groupBy(key) {
  const m = new Map();
  for (const r of rows) { if (r.toks.length < MIN_TOKS) continue; const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.values()].filter((g) => g.length > 1);
}
// FUZZY=1 clusters by token-set similarity (Jaccard>=thr) instead of exact match —
// needed for noisy OCR (e.g. Arabic) where identical questions render slightly
// differently (a dropped/garbled option). Different questions stay separate because
// their distinct option phrases pull Jaccard well below the threshold.
const FUZZY = process.env.FUZZY === "1";
const FUZZ_THR = parseFloat(process.env.FUZZ_THR || "0.9");
function fuzzyClusters(thr) {
  const big = rows.filter((r) => r.toks.length >= MIN_TOKS);
  big.forEach((r) => (r._set = new Set(r.toks)));
  const parent = big.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const jac = (A, B) => { let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n || 1); };
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    if (jac(big[i]._set, big[j]._set) >= thr) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
  }
  const m = new Map();
  for (let i = 0; i < big.length; i++) { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(big[i]); }
  return [...m.values()].filter((g) => g.length > 1);
}
// IMGHASH=1 clusters by an OCR-FREE average-hash of the question region — for
// languages whose OCR is too poor for text matching (e.g. Korean Hangul). Two
// instances of the same question render identically, so their hashes match; the
// black margins are constant so only the centered content drives the distance.
const IMGHASH = process.env.IMGHASH === "1";
const HASH_T = parseInt(process.env.HASH_T || "15", 10); // max Hamming (of 1024 bits)
// dHash (difference hash): gradient-based, robust on sparse white regions where
// average-hash collapses. resize to (W+1)xH, bit = pixel brighter than right neighbor.
const HW = 32, HH = 32;
function dHash(file) {
  const buf = execSync(`magick ${JSON.stringify(SD + "/" + file)} -crop 1520x1814+1175+448 +repage -colorspace Gray -resize ${HW + 1}x${HH}! -depth 8 gray:-`, { maxBuffer: 1e7 });
  const bits = new Uint8Array(HW * HH); let k = 0;
  for (let r = 0; r < HH; r++) for (let c = 0; c < HW; c++) { const idx = r * (HW + 1) + c; bits[k++] = buf[idx] > buf[idx + 1] ? 1 : 0; }
  return bits;
}
function imgHashClusters(T) {
  let _err = null;
  for (const r of rows) { try { r._h = dHash(r.file); } catch (e) { r._h = null; if (!_err) _err = e.message; } }
  if (_err) console.error("[imghash] dHash error sample: " + _err);
  const big = rows.filter((r) => r._h);
  const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
  const parent = big.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    if (ham(big[i]._h, big[j]._h) <= T) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
  }
  const m = new Map();
  for (let i = 0; i < big.length; i++) { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(big[i]); }
  const out = [...m.values()].filter((g) => g.length > 1);
  console.error(`[imghash] hashed ${big.length}/${rows.length}, clusters>=2: ${out.length}`);
  return out;
}
const strictGroups = IMGHASH ? imgHashClusters(HASH_T) : FUZZY ? fuzzyClusters(FUZZ_THR) : groupBy("strict");
const strictFiles = new Set(strictGroups.flat().map((r) => r.file));
const shuffledGroups = (IMGHASH || FUZZY) ? [] : groupBy("sort").filter((g) => !g.every((r) => strictFiles.has(r.file)) && new Set(g.map((r) => r.strict)).size > 1);

// ---- 2. image-band diff per group (signRMSE) ----
const SIGN = "1150x560+1350+470"; // pure image band, above the prompt text (RMSE only)
const MONT = "1520x2300+1175+110"; // FULL phone: app# strip + image + prompt + options
const FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
const q = (s) => JSON.stringify(s);
const cropSign = (f, o) => execSync(`magick ${q(SD + "/" + f)} -crop ${SIGN} +repage -colorspace Gray ${o}`);
const rmse = (a, b) => { const o = execSync(`magick compare -metric RMSE ${a} ${b} null: 2>&1 || true`, { encoding: "utf8" }); const m = o.match(/\(([0-9.]+)\)/); return m ? parseFloat(m[1]) : NaN; };
const lbl = (f) => f.replace(/^Screenshot /, "").replace(".png", "");

function buildGroup(g, kind, idx) {
  const id = (kind === "strict" ? "S" : "T") + (idx + 1);
  // signRMSE: max pairwise difference on the image band
  cropSign(g[0].file, ".ocrtmp/_da.png");
  let maxSign = 0;
  for (let k = 1; k < g.length; k++) { cropSign(g[k].file, ".ocrtmp/_db.png"); maxSign = Math.max(maxSign, rmse(".ocrtmp/_da.png", ".ocrtmp/_db.png")); }
  // Is there actually a picture in the band, or is it blank?
  const bandSd = parseFloat(execSync(`magick .ocrtmp/_da.png -format "%[fx:standard_deviation]" info:`, { encoding: "utf8" }).trim()) || 0;
  const bandHasImage = bandSd > 0.03;
  // Does the WORDING imply the question has a picture? (sign/figure/dashboard/pedal/
  // marking/device/arrow). If so but the band is blank, the image simply didn't
  // render in this capture — we then CANNOT confirm the picture is the same, so it
  // must not be auto-called a duplicate (different signs share an option set).
  const promptText = g[0].text || "";
  const imageExpected = /标志|标线|如图|图[中所]|这是什么|仪表|踏板|操纵|信号灯|符号|装置|手势|箭头|车道线|这种灯|指示|路面这|这条/.test(promptText)
    || /\bse[ñn]al\b|pedal|tablero|panel|flecha|dispositivo|medidor|zeichen|signalleuchte|armaturen|pedal|fahrspur|geste|pfeil/i.test(promptText)
    || /هذه الإشارة|هذه العلامة|ما اسم هذا|هذا الجهاز|هذا المصباح|لوحة العدادات|هذا الرمز|هذا السهم|هذه الخطوط|على سطح الطريق|داخل الصورة|الدواسة/.test(promptText);
  const blankButExpected = imageExpected && !bandHasImage;
  // CORRECTED RULE (es+de ground truth): a duplicate is VERBATIM — identical wording
  // AND, if there's a picture, the picture is pixel-identical (Δ<0.02). A different/
  // mirrored/variant image (Δ≥0.02) is NOT a dup. And if a picture is EXPECTED but
  // absent from the capture, we cannot verify -> needs eyes (unsure), never auto-dup.
  let verdict, note;
  if (maxSign >= 0.02) {
    verdict = "not";
    note = `Different image (Δ=${maxSign.toFixed(3)}): identical wording but the picture differs — usually a mirror or variant (different pedal / arrow / sign / plate). NOT a duplicate.`;
  } else if (blankButExpected) {
    verdict = "unsure";
    note = `Identical wording, but the sign/figure did NOT render in these captures (blank image area) — cannot confirm it's the same picture. These options are shared by a whole family of signs; verify in-app whether this is one repeated question or two different signs.`;
  } else {
    verdict = "dup";
    note = bandHasImage
      ? `Image is PIXEL-IDENTICAL (Δ=${maxSign.toFixed(3)}) and wording identical — exact verbatim duplicate.`
      : `Text-only, wording identical verbatim${kind === "shuffled" ? " (options reordered)" : ""} — duplicate.`;
  }
  const isDup = verdict === "dup";
  const hasImage = bandHasImage || imageExpected;
  // montage
  const labeled = g.map((r, i) => {
    const tmp = `.ocrtmp/_dm${i}.png`;
    execSync(`magick ${q(SD + "/" + r.file)} -crop ${MONT} +repage -resize 680x -bordercolor '#ccc' -border 2 -background white -gravity North -splice 0x52 -font ${FONT} -pointsize 30 -fill ${verdict==="dup"?"green":verdict==="unsure"?"darkorange":"darkred"} -annotate +0+8 ${q(lbl(r.file))} ${tmp}`);
    return tmp;
  });
  const montPath = path.join(OUT, "montages", `${id}_${kind}_${hasImage ? "img" : "txt"}.png`);
  execSync(`magick ${labeled.join(" ")} +append -background black -splice 8x0 ${q(montPath)}`);
  return { id, kind, hasImage, signRMSE: Number(maxSign.toFixed(4)), verdict, note,
    prompt: (g[0].text || "").replace(/\s+/g, " ").trim().slice(0, 140),
    files: g.map((r) => r.file), montPath };
}

const data = [];
strictGroups.forEach((g, i) => data.push(buildGroup(g, "strict", i)));
shuffledGroups.forEach((g, i) => data.push(buildGroup(g, "shuffled", i)));
const order = { dup: 0, unsure: 1, not: 2 };
data.sort((a, b) => order[a.verdict] - order[b.verdict] || a.id.localeCompare(b.id, undefined, { numeric: true }));

fs.writeFileSync(path.join(OUT, `${LANG}-dup-groups.json`), JSON.stringify(data, null, 2));

// ---- 3. workbench HTML (montages embedded) ----
const cards = data.map((g) => ({ ...g, img: "data:image/png;base64," + fs.readFileSync(g.montPath).toString("base64"),
  files: g.files.map((f) => ({ name: f, label: lbl(f) })) }));
const nDup = data.filter((d) => d.verdict === "dup").length;
const nNot = data.filter((d) => d.verdict === "not").length;
const nUns = data.filter((d) => d.verdict === "unsure").length;
const html = workbenchHtml(LANG, cards, rows.length, nDup, nNot);
fs.writeFileSync(path.join(OUT, `${LANG}-duplicates-workbench.html`), html);

// ---- 4. findings markdown ----
let md = `# ${LANG.toUpperCase()} qbank — verbatim duplicate scan (${rows.length} screenshots)\n\n`;
md += `Rule: duplicate = identical wording AND (text-only OR pixel-identical image, Δ<0.02). A different/mirrored/variant image (Δ≥0.02) is NOT a duplicate even with identical wording.\n\n`;
md += `**${nDup} verbatim duplicates · ${nUns} unverifiable (image didn't render — your call) · ${nNot} different-image (not dup).**\n\n`;
for (const g of data) {
  md += `- **${g.id}** ${g.verdict.toUpperCase()} (${g.kind}${g.hasImage ? `, image Δ=${g.signRMSE}` : ", text-only"}) ×${g.files.length}\n  - _${g.prompt}_\n`;
  for (const f of g.files) md += `  - \`${lbl(f)}\`\n`;
}
fs.writeFileSync(path.join(OUT, "DUPLICATES-FOUND.md"), md);
console.log(`${LANG}: ${data.length} groups (${nDup} dup, ${nUns} unsure, ${nNot} not) from ${rows.length} screenshots -> ${OUT}/${LANG}-duplicates-workbench.html`);

function workbenchHtml(lang, DATA, total, nDup, nUns) {
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${lang.toUpperCase()} qbank — duplicate review</title><style>
:root{--dup:#1a7f37;--not:#b42318;--unsure:#9a6700;--bg:#f6f7f9;--line:#e3e6ea}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:#1c1e21}
header{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid var(--line);padding:12px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
header h1{font-size:16px;margin:0 12px 0 0}.counts{display:flex;gap:8px}.pill{padding:2px 9px;border-radius:999px;font-weight:600;font-size:13px}
.pill.dup{background:#e7f5ec;color:var(--dup)}.pill.not{background:#fdeceb;color:var(--not)}.pill.unsure{background:#fdf6e3;color:var(--unsure)}.pill.tot{background:#eef1f4;color:#444}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:7px;padding:7px 13px}button.primary{background:#1c5fd6;color:#fff;border-color:#1c5fd6;font-weight:600}
.wrap{max-width:1080px;margin:18px auto;padding:0 16px}.filterbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}.filterbar button.active{background:#1c1e21;color:#fff;border-color:#1c1e21}
.banner{background:#fff8e6;border:1px solid #f0e0a8;border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#6a5400}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:16px}
.card.v-dup{border-left:5px solid var(--dup)}.card.v-not{border-left:5px solid var(--not)}.card.v-unsure{border-left:5px solid var(--unsure)}
.chead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.gid{font-weight:700;font-size:15px}
.tag{font-size:11px;padding:1px 7px;border-radius:6px;background:#eef1f4;color:#555}.tag.img{background:#efe7fb;color:#6b3fa0}
.note{font-size:12.5px;color:#6a6f76;margin:0 0 10px}.montage{width:100%;border:1px solid var(--line);border-radius:8px;background:#000;margin-bottom:10px}
.verds{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}.verds label{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:8px;padding:6px 12px;cursor:pointer}
.verds label.sel-dup{background:#e7f5ec;border-color:var(--dup);color:var(--dup);font-weight:600}.verds label.sel-not{background:#fdeceb;border-color:var(--not);color:var(--not);font-weight:600}.verds label.sel-unsure{background:#fdf6e3;border-color:var(--unsure);color:var(--unsure);font-weight:600}
.files{border-top:1px dashed var(--line);padding-top:9px;margin-top:4px}.frow{display:flex;align-items:center;gap:10px;padding:3px 0}.frow code{background:#f0f2f5;padding:1px 6px;border-radius:5px;font-size:12.5px}
.frow .act{margin-left:auto}.frow.killed code{text-decoration:line-through;opacity:.5}.kept{color:var(--dup);font-weight:600;font-size:12px}.del{color:var(--not);font-weight:600;font-size:12px}
textarea{width:100%;border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:inherit;resize:vertical;min-height:34px;margin-top:8px}.hint{font-size:12px;color:#888;margin-left:auto}
</style></head><body>
<header><h1>${lang.toUpperCase()} qbank — duplicate review</h1><div class="counts" id="counts"></div>
<div style="margin-left:auto;display:flex;gap:8px"><button onclick="resetAll()">Reset</button><button class="primary" onclick="exportJSON()">⬇ Export decisions JSON</button></div></header>
<div class="wrap">
<div class="banner"><b>A duplicate = the same question twice: identical wording AND a pixel-identical image (or no image).</b> <b>dup</b> = text-only or byte-for-byte identical picture. <b>not</b> = identical wording but a <i>different</i> picture (mirror / variant / different sign — these only look alike). <b>unsure</b> = identical wording but the picture didn't render in the capture (blank), so it can't be verified — your call. Start with the <b>unsure</b> filter.</div>
<div class="filterbar" id="filterbar"></div><div id="list"></div></div>
<script>
const DATA=${JSON.stringify(DATA)};const KEY="${lang}-dup-workbench-v1";let state=load(),filter="all";
function load(){let s={};try{s=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}for(const g of DATA){if(!s[g.id]){const del={};g.files.forEach((f,i)=>del[f.name]=(g.verdict==="dup"&&i>0));s[g.id]={verdict:g.verdict,del,notes:""}}}return s}
function save(){localStorage.setItem(KEY,JSON.stringify(state));render()}
function resetAll(){if(!confirm("Reset to pre-fill?"))return;localStorage.removeItem(KEY);state=load();save()}
function setFilter(f){filter=f;render()}
function setVerdict(id,v){state[id].verdict=v;const g=DATA.find(x=>x.id===id);g.files.forEach((f,i)=>state[id].del[f.name]=(v==="dup"&&i>0));save()}
function toggleDel(id,n){state[id].del[n]=!state[id].del[n];save()}
function setNotes(id,v){state[id].notes=v;localStorage.setItem(KEY,JSON.stringify(state))}
function counts(){let c={dup:0,not:0,unsure:0};for(const g of DATA)c[state[g.id].verdict]++;return c}
function render(){const c=counts();
 document.getElementById("counts").innerHTML='<span class="pill dup">dup '+c.dup+'</span><span class="pill unsure">unsure '+c.unsure+'</span><span class="pill not">not '+c.not+'</span><span class="pill tot">'+DATA.length+' groups</span>';
 document.getElementById("filterbar").innerHTML=["all","dup","unsure","not"].map(f=>'<button class="'+(filter===f?'active':'')+'" onclick="setFilter(\\''+f+'\\')">'+f+' ('+(f==="all"?DATA.length:c[f])+')</button>').join("");
 const list=document.getElementById("list");list.innerHTML="";
 for(const g of DATA){const st=state[g.id];if(filter!=="all"&&st.verdict!==filter)continue;
  const card=document.createElement("div");card.className="card v-"+st.verdict;let files="";
  g.files.forEach((f)=>{const k=st.del[f.name];files+='<div class="frow '+(k?"killed":"")+'"><code>'+f.label+'</code>'+(k?'<span class="del">DELETE</span>':'<span class="kept">KEEP</span>')+'<span class="act"><label><input type="checkbox" '+(k?"checked":"")+' onchange="toggleDel(\\''+g.id+'\\',this.dataset.n)" data-n="'+f.name.replace(/"/g,"&quot;")+'"> mark delete</label></span></div>'});
  card.innerHTML='<div class="chead"><span class="gid">'+g.id+'</span><span class="tag'+(g.hasImage?" img":"")+'">'+(g.hasImage?"image":"text-only")+' · '+g.kind+'</span><span class="tag">×'+g.files.length+'</span><span class="hint">'+g.prompt.replace(/</g,"&lt;")+'</span></div>'+
   '<div class="note">🛈 '+g.note.replace(/</g,"&lt;")+'</div>'+(g.img?'<img class="montage" src="'+g.img+'">':"")+
   '<div class="verds">'+["dup","unsure","not"].map(v=>'<label class="'+(st.verdict===v?"sel-"+v:"")+'"><input type="radio" name="v'+g.id+'" '+(st.verdict===v?"checked":"")+' onclick="setVerdict(\\''+g.id+'\\',\\''+v+'\\')"> '+(v==="dup"?"Duplicate":v==="not"?"Not a dup":"Unsure")+'</label>').join("")+'</div>'+
   '<div class="files">'+files+'</div><textarea placeholder="notes" oninput="setNotes(\\''+g.id+'\\',this.value)">'+(st.notes||"")+'</textarea>';
  list.appendChild(card)}}
function exportJSON(){const out={dataset:"2023-test1",lang:"${lang}",source:"all-screenshot verbatim scan",generatedAt:new Date().toISOString(),summary:counts(),
 decisions:DATA.map(g=>{const st=state[g.id];const del=g.files.filter(f=>st.del[f.name]).map(f=>f.name);const keep=g.files.filter(f=>!st.del[f.name]).map(f=>f.name);
  return{id:g.id,kind:g.kind,hasImage:g.hasImage,prompt:g.prompt,verdict:st.verdict,files:g.files.map(f=>f.name),keep,delete:del,notes:st.notes||""}})};
 const b=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="${lang}-duplicates-decisions.json";a.click()}
render();
</script></body></html>`;
}
