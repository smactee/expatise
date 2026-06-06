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


def main():
    ap = argparse.ArgumentParser(description="Precompute qbank sentence embeddings.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build-master")
    eb = sub.add_parser("embed-batch")
    eb.add_argument("--lang", required=True)
    eb.add_argument("--batch", required=True)
    args = ap.parse_args()
    if args.cmd == "build-master":
        build_master()
    elif args.cmd == "embed-batch":
        embed_batch(args.lang, args.batch)


if __name__ == "__main__":
    main()
