#!/usr/bin/env node
/**
 * slim-bundle.mjs — post-build payload slimmer (runs as `postbuild`, after `next build`).
 *
 * Operates ONLY on `out/` (the Capacitor ship payload). `public/` is left 100% intact
 * because the qbank-tools localization pipeline reads its full provenance (localeOptionOrder
 * alignment data, optionMeaningMap, questions.raw.json) for matching/answer-key work.
 *
 * What it strips from out/ (verified safe against lib/qbank/loadDataset.ts):
 *  - translations.*.json: drop `optionMeaningMap` (dead — only in a type decl, never read);
 *    slim each `localeOptionOrder` entry to the 4 fields the app actually uses
 *    (canonicalOptionId, sourceKey, sourceTextBody, sourceText); minify (no indent).
 *  - questions.raw.json: dead in the app (0 runtime refs; pipeline-only).
 *  - orphaned qbank images: present on disk but not referenced by any question's `assets`.
 *  - .DS_Store + *.map junk.
 *
 * Idempotent. Safe to re-run. Re-running `next build` regenerates a full out/ then re-slims.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'out')
const QBANK = path.join(OUT, 'qbank', '2023-test1')
// localeOptionOrder sub-fields the app reads (lib/qbank/loadDataset.ts buildTranslatedOptions)
const KEEP_LOO = new Set(['canonicalOptionId', 'sourceKey', 'sourceTextBody', 'sourceText'])

const KB = (n) => (n / 1024).toFixed(0).padStart(7) + ' KB'
async function size(p) { try { return (await fs.stat(p)).size } catch { return 0 } }
async function exists(p) { try { await fs.access(p); return true } catch { return false } }

async function walk(dir, out = []) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

function slimTranslation(doc) {
  const qs = doc?.questions
  if (!qs || typeof qs !== 'object') return doc
  for (const q of Object.values(qs)) {
    if (q && typeof q === 'object') {
      delete q.optionMeaningMap
      if (Array.isArray(q.localeOptionOrder)) {
        q.localeOptionOrder = q.localeOptionOrder.map((e) => {
          const slim = {}
          for (const k of KEEP_LOO) if (e[k] !== undefined) slim[k] = e[k]
          return slim
        })
      }
    }
  }
  return doc
}

async function main() {
  if (!(await exists(OUT))) {
    console.error('slim-bundle: out/ not found — run `next build` first. Skipping.')
    process.exit(0)
  }
  const before = (await walk(OUT)).reduce(async (a, f) => (await a) + (await size(f)), Promise.resolve(0))
  const beforeBytes = await before
  let saved = 0

  // 1) Slim + minify translation files
  const tFiles = (await fs.readdir(QBANK).catch(() => []))
    .filter((f) => /^translations\..+\.json$/.test(f))
  for (const f of tFiles) {
    const p = path.join(QBANK, f)
    const b = await size(p)
    const doc = JSON.parse(await fs.readFile(p, 'utf8'))
    slimTranslation(doc)
    await fs.writeFile(p, JSON.stringify(doc)) // minified
    const a = await size(p)
    saved += b - a
    console.log(`  translations  ${f.padEnd(26)} ${KB(b)} -> ${KB(a)}  (-${KB(b - a).trim()})`)
  }

  // 2) Remove questions.raw.json (pipeline-only, dead in app)
  const rawP = path.join(QBANK, 'questions.raw.json')
  if (await exists(rawP)) { const b = await size(rawP); await fs.rm(rawP); saved += b; console.log(`  removed       questions.raw.json         (-${KB(b).trim()})`) }

  // 3) Remove orphaned qbank images (not referenced by any question's assets)
  const imgDir = path.join(QBANK, 'images')
  if (await exists(imgDir)) {
    const qDoc = JSON.parse(await fs.readFile(path.join(QBANK, 'questions.json'), 'utf8'))
    const referenced = new Set()
    for (const q of qDoc.questions || []) {
      for (const asset of q.assets || []) {
        const s = asset.src || asset.path
        if (s) referenced.add(path.basename(String(s)))
      }
    }
    const onDisk = (await fs.readdir(imgDir)).filter((f) => !f.startsWith('.'))
    let orphanBytes = 0, orphanCount = 0
    for (const f of onDisk) {
      if (!referenced.has(f)) {
        const fp = path.join(imgDir, f)
        orphanBytes += await size(fp)
        await fs.rm(fp)
        orphanCount++
      }
    }
    saved += orphanBytes
    console.log(`  removed       ${orphanCount} orphan images          (-${KB(orphanBytes).trim()})`)
  }

  // 4) Remove backups/scratch + .DS_Store + *.map junk (must never ship)
  let junkBytes = 0, junkCount = 0
  for (const f of await walk(OUT)) {
    const base = path.basename(f)
    if (base === '.DS_Store' || f.endsWith('.map') || base.includes('.bak') || base.includes('.pre-')) {
      junkBytes += await size(f); await fs.rm(f); junkCount++
    }
  }
  saved += junkBytes
  if (junkCount) console.log(`  removed       ${junkCount} junk (.bak/.pre-*/.map/.DS_Store)  (-${KB(junkBytes).trim()})`)

  // 5) Remove dev-only routes (app/dev/* — never for production)
  const devDir = path.join(OUT, 'dev')
  if (await exists(devDir)) {
    let devBytes = 0
    for (const f of await walk(devDir)) devBytes += await size(f)
    await fs.rm(devDir, { recursive: true, force: true })
    saved += devBytes
    console.log(`  removed       dev/ routes                (-${KB(devBytes).trim()})`)
  }

  const afterBytes = beforeBytes - saved
  console.log(`\nslim-bundle: out/ ${(beforeBytes / 1024 / 1024).toFixed(1)} MB -> ${(afterBytes / 1024 / 1024).toFixed(1)} MB  (saved ${(saved / 1024 / 1024).toFixed(1)} MB)`)
}

main().catch((e) => { console.error('slim-bundle failed:', e); process.exit(1) })
