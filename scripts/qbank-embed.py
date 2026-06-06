#!/usr/bin/env python3
"""
qbank-embed — precompute bge-small-en-v1.5 sentence embeddings for the matcher's
optional semantic re-ranker (Option A).

The model only ever runs here (Python); pipeline.mjs just loads the resulting
vectors and does cheap dot-products. Embeddings are L2-normalized so cosine == dot.

Requires: fastembed  (pip install fastembed)

Usage:
  # one-time / when the English master changes:
  python scripts/qbank-embed.py build-master
  # per batch, before matching:
  python scripts/qbank-embed.py embed-batch --lang es --batch batch-006

Artifacts:
  qbank-tools/generated/qid-prompt-embeddings.json      (qid -> 384 floats)
  imports/<lang>/<batch>/gloss-embeddings.json          (itemId -> 384 floats)
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET = "2023-test1"
MODEL_NAME = "BAAI/bge-small-en-v1.5"
MASTER_OUT = os.path.join(ROOT, "qbank-tools", "generated", "qid-prompt-embeddings.json")


def _model():
    try:
        from fastembed import TextEmbedding
    except ImportError:
        sys.exit("fastembed not installed. Run: pip install fastembed")
    return TextEmbedding(MODEL_NAME)


def _embed(model, texts):
    import numpy as np
    arr = np.asarray(list(model.embed(list(texts))), dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    arr = arr / norms
    # round to keep the JSON artifact compact; cosine is robust to this
    return [[round(float(x), 6) for x in row] for row in arr]


def _write(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh)
    print(f"wrote {path} ({len(payload.get('vectors', {}))} vectors, dim {payload.get('dim')})")


def build_master():
    qpath = os.path.join(ROOT, "public", "qbank", DATASET, "questions.json")
    questions = json.load(open(qpath, encoding="utf-8"))["questions"]
    qids = [q["id"] for q in questions]
    texts = [(q.get("prompt") or "").strip() or "(no prompt)" for q in questions]
    model = _model()
    vecs = _embed(model, texts)
    _write(MASTER_OUT, {"model": MODEL_NAME, "dim": len(vecs[0]) if vecs else 0,
                        "vectors": dict(zip(qids, vecs))})


def _intake_gloss(item):
    return (item.get("translatedPrompt")
            or item.get("promptTranslated")
            or (item.get("translatedText") or {}).get("prompt")
            or item.get("promptGlossEn")
            or "").strip()


def embed_batch(lang, batch):
    intake_path = os.path.join(ROOT, "imports", lang, batch, "intake.json")
    intake = json.load(open(intake_path, encoding="utf-8"))
    items = intake["items"] if isinstance(intake, dict) and "items" in intake else intake
    ids = [it["itemId"] for it in items]
    texts = [_intake_gloss(it) or "(no prompt)" for it in items]
    model = _model()
    vecs = _embed(model, texts)
    out = os.path.join(ROOT, "imports", lang, batch, "gloss-embeddings.json")
    _write(out, {"model": MODEL_NAME, "dim": len(vecs[0]) if vecs else 0,
                 "lang": lang, "batch": batch, "vectors": dict(zip(ids, vecs))})


IMAGE_MODEL = "Qdrant/clip-ViT-B-32-vision"
MASTER_IMG_OUT = os.path.join(ROOT, "qbank-tools", "generated", "qid-image-embeddings.json")


def _image_model():
    try:
        from fastembed import ImageEmbedding
    except ImportError:
        sys.exit("fastembed ImageEmbedding not available. Run: pip install fastembed pillow")
    return ImageEmbedding(IMAGE_MODEL)


def _embed_images(model, paths):
    import numpy as np
    arr = np.asarray(list(model.embed(list(paths))), dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    arr = arr / norms
    return [[round(float(x), 6) for x in row] for row in arr]


def _master_image_path(src):
    # src like "/qbank/2023-test1/images/img_*.png" -> public/qbank/.../images/...
    return os.path.join(ROOT, "public", str(src or "").lstrip("/"))


def build_master_images():
    qpath = os.path.join(ROOT, "public", "qbank", DATASET, "questions.json")
    questions = json.load(open(qpath, encoding="utf-8"))["questions"]
    qids, paths = [], []
    for q in questions:
        src = next((a.get("src") for a in (q.get("assets") or [])
                    if a.get("kind") == "image" and a.get("src")), None)
        if not src:
            continue
        p = _master_image_path(src)
        if os.path.exists(p):
            qids.append(q["id"]); paths.append(p)
    model = _image_model()
    vecs = _embed_images(model, paths)
    _write(MASTER_IMG_OUT, {"model": IMAGE_MODEL, "dim": len(vecs[0]) if vecs else 0,
                            "vectors": dict(zip(qids, vecs))})


def crop_question_image(path):
    # Source captures are the phone screen letterboxed in a black canvas, with the question image
    # as a band amid white UI. Isolate it: drop the letterbox (columns/rows mostly non-black,
    # ignoring stray dots), then keep the tallest contiguous band of "image" rows in the upper
    # ~two-thirds. A row is "image" if it has a meaningful count of COLORFUL pixels (catches signs
    # and scenes, incl. their thin/sparse arcs) OR is densely non-white (catches gray icons and
    # line diagrams). Per-pixel counts, not row means, so a thin sign arc still registers. Falls
    # back to the whole de-letterboxed image if nothing is found.
    from PIL import Image
    import numpy as np
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype("int16")
    nb = a.sum(axis=2) > 30
    H, W = nb.shape
    cols = np.where(nb.sum(axis=0) > H * 0.2)[0]
    rows = np.where(nb.sum(axis=1) > W * 0.2)[0]
    if len(cols) and len(rows):
        x0, y0, x1, y1 = int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1
        im = im.crop((x0, y0, x1, y1)); a = a[y0:y1, x0:x1]
    h, w, _ = a.shape
    hsv = np.asarray(Image.fromarray(a.astype("uint8")).convert("HSV"))
    colorful = (hsv[:, :, 1] > 60).mean(axis=1)
    dense = (a.max(axis=2) < 235).mean(axis=1)
    signal = (colorful > 0.015) | (dense > 0.14)
    start, upper = int(h * 0.10), int(h * 0.66)
    runs, i = [], start
    while i < upper:
        if signal[i]:
            j = i
            while j < h and signal[j]:
                j += 1
            runs.append((i, j)); i = j
        else:
            i += 1
    if not runs:
        return im
    y0, y1 = max(runs, key=lambda t: t[1] - t[0])
    return im.crop((0, max(0, y0 - 6), im.width, min(im.height, y1 + 6)))


def embed_batch_images(lang, batch):
    base = os.path.join(ROOT, "imports", lang, batch)
    intake = json.load(open(os.path.join(base, "intake.json"), encoding="utf-8"))
    items = intake["items"] if isinstance(intake, dict) and "items" in intake else intake
    ids, imgs = [], []
    for it in items:
        if it.get("hasImage") is not True:
            continue
        rel = it.get("itemId") or it.get("file") or it.get("sourceImage")
        p = os.path.join(base, rel) if rel else None
        if p and os.path.exists(p):
            ids.append(it["itemId"]); imgs.append(crop_question_image(p))
    model = _image_model()
    vecs = _embed_images(model, imgs)
    _write(os.path.join(base, "image-embeddings.json"),
           {"model": IMAGE_MODEL, "dim": len(vecs[0]) if vecs else 0,
            "lang": lang, "batch": batch, "vectors": dict(zip(ids, vecs))})


def main():
    ap = argparse.ArgumentParser(description="Precompute qbank sentence embeddings.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build-master")
    eb = sub.add_parser("embed-batch")
    eb.add_argument("--lang", required=True)
    eb.add_argument("--batch", required=True)
    sub.add_parser("build-master-images")
    ebi = sub.add_parser("embed-batch-images")
    ebi.add_argument("--lang", required=True)
    ebi.add_argument("--batch", required=True)
    args = ap.parse_args()
    if args.cmd == "build-master":
        build_master()
    elif args.cmd == "embed-batch":
        embed_batch(args.lang, args.batch)
    elif args.cmd == "build-master-images":
        build_master_images()
    elif args.cmd == "embed-batch-images":
        embed_batch_images(args.lang, args.batch)


if __name__ == "__main__":
    main()
