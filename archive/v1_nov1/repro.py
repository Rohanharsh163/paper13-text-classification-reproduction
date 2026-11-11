"""Scoped-down reproduction of "Generative or Discriminative? Revisiting Text Classification in the
Era of Transformers" (Kasa et al., EMNLP 2025), Paper #13.

What is reproduced (paper Q1/Q2/Q3, at small scale):
  ENC        discriminative encoder + linear head, cross-entropy on P(y|x)
  MLM        pseudo-generative: "... the label is [MASK]" read out over the label tokens
  AR         generative causal LM, label PREPENDED, predict argmax_y log P(x | y)  (one pass per label)
  AR_pseudo  causal LM, label APPENDED, one pass, read out over the label tokens
NOT reproduced: DIFF (discrete-diffusion classifier) -- too expensive on CPU; see README for the scope note.

All models are trained FROM SCRATCH (as in the paper), with the same tiny transformer backbone.

Usage:
  python repro.py --dataset agnews --layers 1 4 --sizes 128 512 2048 8192 --seeds 0 1 2
Results are appended to results/<dataset>.jsonl (resumable: finished runs are skipped).
"""
import argparse
import csv
import json
import math
import os
import re
import time
from collections import Counter

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import f1_score

HERE = os.path.dirname(os.path.abspath(__file__))
MAXLEN = 40          # text tokens kept per example
VOCAB = 3000         # word-level vocabulary built from the training pool
D_MODEL, N_HEADS = 128, 4
PAD, UNK, MASK, CLS, SEP, BOS = range(6)
NSPECIAL = 6
TOK = re.compile(r"\w+|[^\w\s]")


# ------------------------------------------------------------------------------------------- data
def tokenize(s):
    return TOK.findall(s.lower())


def load_dataset(name):
    d = os.path.join(HERE, "data")
    if name == "agnews":
        def rd(f):
            rows = list(csv.reader(open(os.path.join(d, f), encoding="utf-8")))
            return [(r[1] + " . " + r[2], int(r[0]) - 1) for r in rows]
        return rd("agnews_train.csv"), rd("agnews_test.csv"), 4
    if name == "sst2":
        def rd(f):
            out = []
            for line in open(os.path.join(d, f), encoding="utf-8"):
                t, _, y = line.rstrip("\n").rpartition("\t")
                out.append((t, int(y)))
            return out
        return rd("sst2_train.tsv"), rd("sst2_test.tsv"), 2
    raise ValueError(name)


class Vocab:
    def __init__(self, texts, n_classes):
        c = Counter(w for t in texts for w in tokenize(t))
        words = [w for w, _ in c.most_common(VOCAB)]
        self.n_classes = n_classes
        # label tokens sit right after the special tokens; the template words "the label is" are ordinary words
        self.label0 = NSPECIAL
        self.itos = words
        self.w2i = {w: NSPECIAL + n_classes + i for i, w in enumerate(words)}
        self.size = NSPECIAL + n_classes + len(words)
        self.tmpl = [self.w2i.get(w, UNK) for w in ["the", "label", "is"]]

    def encode(self, text):
        return [self.w2i.get(w, UNK) for w in tokenize(text)][:MAXLEN]


def pad(seqs, extra=0):
    L = max(len(s) for s in seqs) + extra
    x = torch.full((len(seqs), L), PAD, dtype=torch.long)
    for i, s in enumerate(seqs):
        x[i, :len(s)] = torch.tensor(s)
    return x


# ---------------------------------------------------------------------------------------- backbone
class Backbone(nn.Module):
    def __init__(self, vocab, layers, causal):
        super().__init__()
        self.causal = causal
        self.emb = nn.Embedding(vocab, D_MODEL, padding_idx=PAD)
        self.pos = nn.Embedding(MAXLEN + 8, D_MODEL)
        layer = nn.TransformerEncoderLayer(D_MODEL, N_HEADS, 4 * D_MODEL, dropout=0.1,
                                           batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)
        self.norm = nn.LayerNorm(D_MODEL)

    def forward(self, x):
        T = x.shape[1]
        h = self.emb(x) + self.pos(torch.arange(T, device=x.device))[None]
        if self.causal:
            m = torch.triu(torch.ones(T, T, dtype=torch.bool), 1)
            h = self.enc(h, mask=m)           # right padding never leaks into earlier positions
        else:
            h = self.enc(h, src_key_padding_mask=(x == PAD))
        return self.norm(h)


class Model(nn.Module):
    def __init__(self, kind, vocab, n_classes, layers):
        super().__init__()
        self.kind, self.K = kind, n_classes
        self.body = Backbone(vocab.size, layers, causal=kind in ("AR", "AR_pseudo"))
        self.vocab = vocab
        if kind == "ENC":
            self.head = nn.Linear(D_MODEL, n_classes)
        else:
            self.head = nn.Linear(D_MODEL, vocab.size)

    # ---- building inputs
    def build(self, texts_ids, labels=None):
        v = self.vocab
        if self.kind == "ENC":
            return pad([[CLS] + t for t in texts_ids])
        if self.kind == "MLM":   # [CLS] text [SEP] the label is [LABEL]
            return pad([[CLS] + t + [SEP] + v.tmpl + [v.label0 + (y if labels is not None else 0)]
                        for t, y in zip(texts_ids, labels if labels is not None else [0] * len(texts_ids))])
        if self.kind == "AR_pseudo":   # [BOS] text [LABEL]
            return pad([[BOS] + t + [v.label0 + y] for t, y in zip(texts_ids, labels)])
        if self.kind == "AR":          # [BOS] [LABEL] text
            return pad([[BOS, v.label0 + y] + t for t, y in zip(texts_ids, labels)])

    # ---- training loss
    def loss(self, texts_ids, labels):
        v = self.vocab
        y = torch.tensor(labels)
        if self.kind == "ENC":
            h = self.body(self.build(texts_ids))[:, 0]
            return F.cross_entropy(self.head(h), y)
        x = self.build(texts_ids, labels)
        if self.kind == "MLM":
            tgt = x.clone()
            lens = (x != PAD).sum(1)
            inp = x.clone()
            sel = (torch.rand(x.shape) < 0.15) & (x != PAD) & (x != CLS) & (x != SEP)
            lab_pos = lens - 1
            sel[torch.arange(len(x)), lab_pos] = True          # the label slot is always masked
            inp[sel] = MASK
            h = self.body(inp)
            logits = self.head(h[sel])
            return F.cross_entropy(logits, tgt[sel])
        h = self.body(x[:, :-1])                                   # causal LM, next-token loss on every token
        logits = self.head(h)
        tgt = x[:, 1:]
        return F.cross_entropy(logits.reshape(-1, logits.shape[-1]), tgt.reshape(-1), ignore_index=PAD)

    # ---- inference: returns (N, K) scores (log-probabilities up to a constant)
    @torch.no_grad()
    def scores(self, texts_ids):
        v = self.vocab
        n = len(texts_ids)
        if self.kind == "ENC":
            return F.log_softmax(self.head(self.body(self.build(texts_ids))[:, 0]), -1)
        if self.kind == "MLM":
            x = self.build(texts_ids, [0] * n)
            lens = (x != PAD).sum(1)
            x[torch.arange(n), lens - 1] = MASK
            h = self.body(x)[torch.arange(n), lens - 1]
            lg = self.head(h)[:, v.label0:v.label0 + self.K]
            return F.log_softmax(lg, -1)
        if self.kind == "AR_pseudo":
            x = pad([[BOS] + t for t in texts_ids])
            lens = torch.tensor([len(t) + 1 for t in texts_ids])
            h = self.body(x)[torch.arange(n), lens - 1]
            return F.log_softmax(self.head(h)[:, v.label0:v.label0 + self.K], -1)
        # AR: log P(x | y) for every candidate label, then softmax over labels (uniform prior)
        out = []
        for y in range(self.K):
            x = self.build(texts_ids, [y] * n)
            lg = F.log_softmax(self.head(self.body(x[:, :-1])), -1)
            tgt = x[:, 2:]                                      # skip predicting the label itself
            lp = lg[:, 1:].gather(-1, tgt[..., None])[..., 0]
            lp = (lp * (tgt != PAD)).sum(1)
            out.append(lp)
        return F.log_softmax(torch.stack(out, 1), -1)


# ------------------------------------------------------------------------------------------ metrics
def ece(probs, y, bins=10):
    conf, pred = probs.max(1)
    acc = (pred == y).float()
    e = 0.0
    edges = torch.linspace(0, 1, bins + 1)
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            e += m.float().mean() * (acc[m].mean() - conf[m].mean()).abs()
    return float(e)


def evaluate(model, X, Y, bs=256):
    model.eval()
    S = torch.cat([model.scores(X[i:i + bs]) for i in range(0, len(X), bs)])
    pred = S.argmax(1).numpy()
    p = S.exp()
    return {"wf1": float(f1_score(Y, pred, average="weighted")), "acc": float((pred == np.array(Y)).mean()),
            "ece": ece(p, torch.tensor(Y))}


def corrupt(X, rate, vocab, rng, mode):
    out = []
    for t in X:
        if mode == "drop":
            k = [w for w in t if rng.random() > rate] or t[:1]
        else:
            k = [rng.randrange(NSPECIAL + vocab.n_classes, vocab.size) if rng.random() < rate else w for w in t]
        out.append(k)
    return out


# ------------------------------------------------------------------------------------------- driver
EPOCHS = {128: 40, 512: 25, 2048: 12}


def run_one(ds, kind, layers, n, seed, vocab, train_pool, val, test, K, args):
    import random
    torch.manual_seed(seed)
    rng = random.Random(seed)
    idx = list(range(len(train_pool)))
    random.Random(seed).shuffle(idx)
    sub = [train_pool[i] for i in idx[:n]]
    X = [vocab.encode(t) for t, _ in sub]
    Y = [y for _, y in sub]
    Xv = [vocab.encode(t) for t, _ in val]
    Yv = [y for _, y in val]
    model = Model(kind, vocab, K, layers)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    ep = EPOCHS.get(n, 9)
    bs = 32
    total = ep * math.ceil(n / bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=total, pct_start=0.1)
    best, best_state, step = -1, None, 0
    for e in range(ep):
        model.train()
        order = list(range(n))
        rng.shuffle(order)
        for i in range(0, n, bs):
            b = order[i:i + bs]
            loss = model.loss([X[j] for j in b], [Y[j] for j in b])
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
        if e % max(1, ep // 4) == 0 or e == ep - 1:           # model selection on a fixed held-out validation set
            f = evaluate(model, Xv, Yv)["wf1"]
            if f > best:
                best, best_state = f, {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    Xt = [vocab.encode(t) for t, _ in test]
    Yt = [y for _, y in test]
    res = evaluate(model, Xt, Yt)
    res["val_wf1"] = best
    r2 = random.Random(1000 + seed)
    for mode in ("drop", "sub"):
        res[f"{mode}30"] = evaluate(model, corrupt(Xt[:500], 0.30, vocab, r2, mode), Yt[:500])["wf1"]
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--layers", type=int, nargs="+", default=[1, 4])
    ap.add_argument("--sizes", type=int, nargs="+", default=[128, 512, 2048])
    ap.add_argument("--seeds", type=int, nargs="+", default=[0, 1])
    ap.add_argument("--models", nargs="+", default=["ENC", "MLM", "AR", "AR_pseudo"])
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--ntest", type=int, default=1000)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    torch.set_num_threads(1)

    train, test, K = load_dataset(args.dataset)
    import random
    random.Random(123).shuffle(train)
    random.Random(124).shuffle(test)
    test = test[:args.ntest]
    val, pool = train[:200], train[200:]
    vocab = Vocab([t for t, _ in pool], K)
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    out = args.out or os.path.join(HERE, "results", f"{args.dataset}.jsonl")
    done = set()
    if os.path.exists(out):
        for line in open(out):
            r = json.loads(line)
            done.add((r["model"], r["layers"], r["n"], r["seed"]))
    for n in args.sizes:
        for L in args.layers:
            for kind in args.models:
                for seed in args.seeds:
                    if (kind, L, n, seed) in done:
                        continue
                    t0 = time.time()
                    r = run_one(args.dataset, kind, L, n, seed, vocab, pool, val, test, K, args)
                    r.update(dataset=args.dataset, model=kind, layers=L, n=n, seed=seed, secs=round(time.time() - t0, 1))
                    with open(out, "a") as f:
                        f.write(json.dumps(r) + "\n")
                    print(f"{args.dataset} L={L} n={n:5d} {kind:9s} seed={seed} wF1={r['wf1']:.3f} "
                          f"ECE={r['ece']:.3f} drop30={r['drop30']:.3f} sub30={r['sub30']:.3f} ({r['secs']}s)", flush=True)


if __name__ == "__main__":
    main()
