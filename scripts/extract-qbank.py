#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
from datetime import datetime

import fitz  # PyMuPDF


QSTART_RE = re.compile(r"^\s*(\d{1,4})\.\s+(.+)$")
ANSWER_RE = re.compile(r"^\s*Answer:\s*(.*?)\s*$", re.IGNORECASE)
OPT_RE = re.compile(r"^\s*([A-D])\s*[\.\):：、．·。]\s*(.+?)\s*$")

def md5_bytes(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()

def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

def normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def bbox_intersection_area(a, b) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    x0 = max(ax0, bx0)
    y0 = max(ay0, by0)
    x1 = min(ax1, bx1)
    y1 = min(ay1, by1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return float((x1 - x0) * (y1 - y0))

def bbox_area(a) -> float:
    x0, y0, x1, y1 = a
    return float(max(0, x1 - x0) * max(0, y1 - y0))

def parse_question_block(qid: str, number: int, lines: list[str]):
    """
    Returns:
      type: 'row' | 'mcq'
      prompt: str
      options: [{id, originalKey, text}] for MCQ
      correctRow: 'R'|'W' for ROW
      correctOptionId: str for MCQ
    """

    answer_raw = None
    content_lines: list[str] = []

    def _is_row_token(s: str) -> bool:
        t = s.strip().lower()
        if not t:
            return False
        return (
            t in {"right", "wrong", "true", "false", "correct", "incorrect", "yes", "no", "√", "×"}
            or t.startswith("right")
            or t.startswith("wrong")
        )

    def _is_mcq_token(s: str) -> bool:
        t = s.strip().upper()
        return t in {"A", "B", "C", "D"}

    # Walk through the block and extract Answer, allowing "Answer:" to appear alone.
    i = 0
    while i < len(lines):
        ln = lines[i].strip()

        m = ANSWER_RE.match(ln)
        if not m:
            content_lines.append(lines[i])
            i += 1
            continue

        tail = (m.group(1) or "").strip()

        # Case 1: "Answer: Right" on the same line
        if tail:
            answer_raw = tail
            i += 1
            continue

        # Case 2: "Answer:" alone → scan ahead for a valid token
        found = None
        found_idx = None

        for j in range(i + 1, min(i + 8, len(lines))):
            cand = lines[j].strip()

            # Sometimes the PDF has another "Answer: Wrong" line after "Answer:"
            m2 = ANSWER_RE.match(cand)
            if m2:
                t2 = (m2.group(1) or "").strip()
                if t2 and (_is_row_token(t2) or _is_mcq_token(t2)):
                    found = t2
                    found_idx = j
                    break
                continue

            if _is_row_token(cand) or _is_mcq_token(cand):
                found = cand
                found_idx = j
                break

        # Keep intervening lines as prompt continuation (fixes #958 "slowly.")
        if found is not None and found_idx is not None:
            for k in range(i + 1, found_idx):
                content_lines.append(lines[k])
            answer_raw = found
            i = found_idx + 1
        else:
            # Couldn't find a token → ignore this "Answer:" and move on
            i += 1

    # detect MCQ
    has_opt = any(OPT_RE.match(ln) for ln in content_lines)

    # ROW
    if not has_opt:
        prompt = normalize_space(" ".join(content_lines))
        correct = None
        if answer_raw:
            ar = answer_raw.strip().lower()
            if ar in {"right", "true", "correct", "yes", "√"} or ar.startswith("r") or "right" in ar:
                correct = "R"
            elif ar in {"wrong", "false", "incorrect", "no", "×"} or ar.startswith("w") or "wrong" in ar:
                correct = "W"

        return {
            "id": qid,
            "number": number,
            "type": "row",
            "prompt": prompt,
            "options": [],
            "correctRow": correct,
            "correctOptionId": None,
            "answerRaw": answer_raw,
        }

    # MCQ parsing
    prompt_parts: list[str] = []
    opt_map: dict[str, str] = {}  # key -> text
    current_key = None

    for ln in content_lines:
        m = OPT_RE.match(ln)
        if m:
            current_key = m.group(1)
            opt_map[current_key] = m.group(2).strip()
        else:
            if current_key:
                opt_map[current_key] = (opt_map[current_key] + " " + ln).strip()
            else:
                prompt_parts.append(ln)

    prompt = normalize_space(" ".join(prompt_parts))

    # build options in A-D order
    key_order = ["A", "B", "C", "D"]
    options = []
    key_to_id = {}
    for idx, k in enumerate(key_order, start=1):
        txt = opt_map.get(k, "").strip()
        oid = f"{qid}_o{idx}"
        key_to_id[k] = oid
        if txt:
            options.append({"id": oid, "originalKey": k, "text": normalize_space(txt)})

    # answer mapping
    correct_option_id = None
    if answer_raw:
        m = re.search(r"[A-D]", answer_raw.upper())
        if m:
            correct_option_id = key_to_id.get(m.group(0))

    return {
        "id": qid,
        "number": number,
        "type": "mcq",
        "prompt": prompt,
        "options": options,
        "correctRow": None,
        "correctOptionId": correct_option_id,
        "answerRaw": answer_raw,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to source PDF")
    ap.add_argument("--out", required=True, help="Output directory (e.g. public/qbank/2023-test1)")
    ap.add_argument("--slug", required=True, help="Dataset slug used in URLs (e.g. 2023-test1)")
    args = ap.parse_args()

    pdf_path = args.pdf
    out_dir = args.out
    slug = args.slug

    ensure_dir(out_dir)
    img_dir = os.path.join(out_dir, "images")
    ensure_dir(img_dir)

    doc = fitz.open(pdf_path)

    # Collect all text lines in 2-column reading order
    all_lines = []  # {page, colIndex, x0,y0, text, bbox}
    page_mid = []

    # Collect all image instances (xref placements) for later binding
    all_images = []  # {page, bbox, xref}

    for pno in range(len(doc)):
        page = doc[pno]
        midx = page.rect.width / 2.0
        page_mid.append(midx)

        # --- text lines ---
        d = page.get_text("dict")
        lines = []
        for b in d.get("blocks", []):
            if b.get("type") != 0:
                continue
            for ln in b.get("lines", []):
                # join spans into a line
                txt = "".join(sp.get("text", "") for sp in ln.get("spans", []))
                txt = txt.strip()
                if not txt:
                    continue
                bbox = ln.get("bbox")
                if not bbox:
                    continue
                col_index = 0 if bbox[0] < midx else 1  # 0 left, 1 right
                lines.append({
                    "page": pno + 1,
                    "colIndex": col_index,
                    "x0": bbox[0],
                    "y0": bbox[1],
                    "bbox": [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])],
                    "text": normalize_space(txt),
                })

        # reading order: left col then right col; within col top->bottom
        lines.sort(key=lambda it: (it["colIndex"], it["y0"], it["x0"]))
        all_lines.extend(lines)

        # --- image placements ---
        # get_images returns unique xrefs; get_image_rects returns all placements (rectangles)
        for img in page.get_images(full=True):
            xref = img[0]
            rects = page.get_image_rects(xref)
            for r in rects:
                all_images.append({
                    "page": pno + 1,
                    "xref": xref,
                    "bbox": [float(r.x0), float(r.y0), float(r.x1), float(r.y1)],
                })

    # --- split into question blocks by detecting "N." ---
    questions = []
    current = None

    def finalize_current():
        nonlocal current, questions
        if not current:
            return

        qid = f"q{current['number']:04d}"
        parsed = parse_question_block(qid, current["number"], current["lines"])

        # regions -> list
        regions = []
        for (page, colIndex), rb in current["regions"].items():
            regions.append({
                "page": page,
                "colIndex": colIndex,
                "bbox": rb
            })
        parsed["regions"] = regions
        parsed["assets"] = []  # filled after binding
        parsed["source"] = {
            "pdf": os.path.basename(pdf_path),
        }
        questions.append(parsed)
        current = None

    for item in all_lines:
        m = QSTART_RE.match(item["text"])
        if m:
            # start new
            finalize_current()
            number = int(m.group(1))
            rest = m.group(2).strip()
            current = {
                "number": number,
                "lines": [rest] if rest else [],
                "regions": {}
            }

        if not current:
            continue

        # normal line belongs to current question
        if not m:
            current["lines"].append(item["text"])

        # update region bbox for this page+column
        key = (item["page"], item["colIndex"])
        bb = item["bbox"]
        if key not in current["regions"]:
            current["regions"][key] = bb[:]
        else:
            rb = current["regions"][key]
            rb[0] = min(rb[0], bb[0])
            rb[1] = min(rb[1], bb[1])
            rb[2] = max(rb[2], bb[2])
            rb[3] = max(rb[3], bb[3])

    finalize_current()

    # --- extract embedded images (dedup by bytes hash) ---
    hash_to_filename = {}  # md5 -> filename
    xref_to_hash = {}      # xref -> md5

    def ensure_image_saved(xref: int) -> tuple[str, str]:
        """
        Returns (src, md5hash) for the image stream.
        """
        if xref in xref_to_hash:
            h = xref_to_hash[xref]
            fname = hash_to_filename[h]
            return f"/qbank/{slug}/images/{fname}", h

        info = doc.extract_image(xref)
        img_bytes = info.get("image")
        ext = info.get("ext", "png")
        if not img_bytes:
            # fallback: shouldn't happen often
            return "", ""

        h = md5_bytes(img_bytes)
        xref_to_hash[xref] = h

        if h not in hash_to_filename:
            fname = f"img_{h}.{ext}"
            hash_to_filename[h] = fname
            with open(os.path.join(img_dir, fname), "wb") as f:
                f.write(img_bytes)

        fname = hash_to_filename[h]
        return f"/qbank/{slug}/images/{fname}", h

    # Build candidates per page from question regions
    candidates_by_page = {}  # page -> list of (qIndex, regionBbox, colIndex)
    for qi, q in enumerate(questions):
        for r in q.get("regions", []):
            candidates_by_page.setdefault(r["page"], []).append((qi, r["bbox"], r["colIndex"]))

    # Bind each image placement to best-overlap question region on same page
    for img in all_images:
        page = img["page"]
        bbox = img["bbox"]
        colIndex = 0 if bbox[0] < page_mid[page - 1] else 1

        best = None  # (overlapRatio, qi)
        img_area = bbox_area(bbox)
        if img_area <= 0:
            continue

        for (qi, rb, rcol) in candidates_by_page.get(page, []):
            if rcol != colIndex:
                continue
            inter = bbox_intersection_area(bbox, rb)
            if inter <= 0:
                continue
            ratio = inter / img_area
            if (best is None) or (ratio > best[0]):
                best = (ratio, qi)

        # threshold + fallback: if no overlap, skip (conservative)
        if not best or best[0] < 0.12:
            continue

        src, h = ensure_image_saved(img["xref"])
        if not src:
            continue

        q = questions[best[1]]
        q["assets"].append({
            "kind": "image",
            "src": src,
            "page": page,
            "bbox": bbox,
            "hash": h
        })

    # Write raw JSON
    out_raw = os.path.join(out_dir, "questions.raw.json")
    payload = {
        "meta": {
            "slug": slug,
            "pdf": os.path.basename(pdf_path),
            "extractedAt": datetime.utcnow().isoformat() + "Z",
            "questionCount": len(questions),
        },
        "questions": questions
    }
    with open(out_raw, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ Extracted {len(questions)} questions")
    print(f"✅ Wrote: {out_raw}")
    print(f"✅ Images: {img_dir}")


if __name__ == "__main__":
    main()
