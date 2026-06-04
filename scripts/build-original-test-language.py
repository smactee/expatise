#!/usr/bin/env python3
"""
DEV / BUILD-TIME MAINTENANCE TOOL — NOT part of the app, never bundled or shipped.

Regenerates  public/qbank/2023-test1/translations.en-orig.json , the question
language shown in-app as "British Chinglish, (original test version)".

What it does:
  - Reads the ORIGINAL question wording straight from the text layer of
    raw/2023 Driving test 1.pdf  (questions 1-973), column reading-order.
  - Maps each onto the English master qbank (questions.json) by question number.
  - Writes one translation entry per master question that exists in the PDF.
    Questions NOT in this PDF (numbers 974+, and the de-duplicated 431/450/518/906)
    get no entry and fall back to English in the app.

What it deliberately does NOT do:
  - It never stores answers/categories/images. The app inherits those from the
    master (questions.json), so the answer key is always the master's — even where
    the PDF itself staged a wrong answer.
  - It never touches questions.json (human-locked master).

Run it again only if the master qbank changes and you want to refresh this language:
    pip install pdfplumber
    python3 scripts/build-original-test-language.py
"""
import json, re, os, datetime
import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QBANK = os.path.join(ROOT, "public", "qbank", "2023-test1")
PDF = os.path.join(ROOT, "raw", "2023 Driving test 1.pdf")
OUT = os.path.join(QBANK, "translations.en-orig.json")

NUM = re.compile(r"^\s*(\d{1,4})\s*[.、,]\s*(.*)$")
OPT = re.compile(r"^\s*([A-D])\s*[.、,]\s*(.*)$")
ANS = re.compile(r"^\s*Answer\s*[:：]\s*(.*)$", re.I)
PAGENUM = re.compile(r"^\s*\d{1,3}\s*$")  # standalone page-number lines to drop


def collapse(s):
    return re.sub(r"\s+", " ", s).strip()


def parse_block(body, is_mcq):
    """Split a question's lines into (prompt, [(letter, text), ...])."""
    prompt_lines, options = [], []
    cur, buf, in_opts = None, [], False

    def flush():
        nonlocal cur, buf
        if cur is not None:
            options.append((cur, collapse(" ".join(buf))))
        cur, buf = None, []

    for line in body:
        m = OPT.match(line) if is_mcq else None
        if m:
            in_opts = True
            flush()
            cur, buf = m.group(1), [m.group(2)]
        elif in_opts:
            buf.append(line)
        else:
            prompt_lines.append(line)
    flush()
    return collapse(" ".join(prompt_lines)), options


def extract_pdf(pdf_path):
    """Return {question_number: {'prompt': str, 'options': [(letter, text), ...]}}."""
    pdf = pdfplumber.open(pdf_path)
    stream = []
    for page in pdf.pages:
        for x0, x1 in ((0, 300), (300, page.width)):  # left column, then right column
            text = page.within_bbox((x0, 0, x1, page.height)).extract_text() or ""
            for line in text.split("\n"):
                if not PAGENUM.match(line):
                    stream.append(line)

    questions, buf = {}, []
    for line in stream:
        answer = ANS.match(line)
        if not answer:
            buf.append(line)
            continue
        # buf now holds one question's lines; finalize it at the "Answer:" delimiter
        nidx = next((i for i, l in enumerate(buf) if NUM.match(l)), None)
        if nidx is not None:
            m = NUM.match(buf[nidx])
            num = int(m.group(1))
            body = [m.group(2)] + buf[nidx + 1:]
            is_mcq = any(OPT.match(l) for l in body)
            prompt, options = parse_block(body, is_mcq)
            questions[num] = {"prompt": prompt, "options": options}
        buf = []
    return questions


def main():
    master = json.load(open(os.path.join(QBANK, "questions.json")))["questions"]
    extracted = extract_pdf(PDF)

    out, mcq, row = {}, 0, 0
    for mq in master:
        e = extracted.get(mq["number"])
        if not e or not e.get("prompt"):
            continue  # not in this PDF -> English fallback in the app
        entry = {
            "prompt": e["prompt"],
            "explanation": "",
            "sourceMode": "original-pdf-text-extract",
            "confidence": "high",
            "reviewStatus": "ready",
        }
        if mq["type"] == "mcq":
            mcq += 1
            by_letter = {k: t for k, t in e["options"]}
            entry["options"] = {}
            for i, mo in enumerate(mq["options"]):
                letter = mo.get("originalKey") or chr(65 + i)
                entry["options"][mo["id"]] = (
                    by_letter.get(letter)
                    or (e["options"][i][1] if i < len(e["options"]) else mo["text"])
                )
            ci = next((i for i, o in enumerate(mq["options"]) if o["id"] == mq["correctOptionId"]), None)
            if ci is not None:
                entry["localeCorrectOptionKey"] = mq["options"][ci].get("originalKey") or chr(65 + ci)
        else:
            row += 1
        out[mq["id"]] = entry

    payload = {
        "meta": {
            "locale": "en-orig",
            "label": "British Chinglish, (original test version)",
            "description": (
                'Verbatim original question text extracted from the text layer of '
                '"2023 Driving test 1.pdf". Answers inherited from the English master qbank '
                '(some PDF-staged answers are wrong). Mapped 1:1 to master by question number; '
                "master questions not present in this PDF fall back to English."
            ),
            "source": {"pdf": "2023 Driving test 1.pdf", "method": "pdfplumber text-layer, column reading-order"},
            "translatedQuestions": len(out),
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "localeAnswerKeySupport": True,
        },
        "questions": out,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {OUT}\n  {len(out)} entries ({mcq} MCQ + {row} ROW)")


if __name__ == "__main__":
    main()
