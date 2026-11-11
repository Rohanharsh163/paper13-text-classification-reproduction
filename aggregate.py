"""Aggregate the experiment grids into mean +- std tables (results/summary.md, results/summary.json).

Reads ONLY the two experiment files listed in EXPERIMENT_FILES. Any other .jsonl in results/ (smoke tests,
demo runs, one-off checks) is ignored, so it can never leak into the tables.
"""
import json
import os
import sys
from collections import defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EXPERIMENT_FILES = ["agnews.jsonl", "sst2.jsonl"]

rows = []
for f in EXPERIMENT_FILES:
    p = os.path.join(HERE, "results", f)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    rows += [json.loads(l) for l in open(p)]

# every row must carry the same-500 clean score used for the noise comparison
missing = [r for r in rows if "wf1_500" not in r]
if missing:
    sys.exit(f"{len(missing)} rows lack wf1_500 (produced by an older repro.py); rerun them")

g = defaultdict(list)
for r in rows:
    g[(r["dataset"], r["layers"], r["n"], r["model"])].append(r)
dups = [k for k, v in g.items() if len({r['seed'] for r in v}) != len(v)]
if dups:
    sys.exit(f"duplicate seeds in cells: {dups}")

MODELS = ["ENC", "MLM", "AR", "AR_pseudo"]
out, summ = [], {}


def table(metric, title, lower_better=False):
    out.append(f"\n### {title} (mean over seeds)\n")
    for ds in sorted({k[0] for k in g}):
        for L in sorted({k[1] for k in g if k[0] == ds}):
            out.append(f"\n**{ds}, {L} layer(s)**\n")
            out.append("| n | " + " | ".join(MODELS) + " | best |")
            out.append("|---|" + "---|" * (len(MODELS) + 1))
            for n in sorted({k[2] for k in g if k[0] == ds and k[1] == L}):
                cells, vals = [], {}
                for m in MODELS:
                    rs = g.get((ds, L, n, m), [])
                    if rs:
                        v = np.array([metric(r) for r in rs])
                        vals[m] = v.mean()
                        cells.append(f"{v.mean():.3f}±{v.std():.3f}")
                        summ[f"{title}|{ds}|{L}|{n}|{m}"] = [float(v.mean()), float(v.std()), len(v)]
                    else:
                        cells.append("–")
                pick = (min if lower_better else max)(vals, key=vals.get) if vals else "–"
                out.append(f"| {n} | " + " | ".join(cells) + f" | {pick} |")


table(lambda r: r["wf1"], "Test weighted-F1 (1,000 test examples)")
table(lambda r: r["ece"], "Test ECE, lower = better calibrated (1,000 test examples)", lower_better=True)
table(lambda r: r["wf1_500"], "Clean weighted-F1 on the 500-example noise subset")
table(lambda r: r["drop30"], "Weighted-F1 with 30% of test tokens dropped (same 500)")
table(lambda r: r["sub30"], "Weighted-F1 with 30% of test tokens substituted (same 500)")
table(lambda r: 1 - r["drop30"] / r["wf1_500"], "Relative F1 loss, 30% dropped = 1 - drop30 / wf1_500",
      lower_better=True)
table(lambda r: 1 - r["sub30"] / r["wf1_500"], "Relative F1 loss, 30% substituted = 1 - sub30 / wf1_500",
      lower_better=True)

out.append("\n### Relative F1 loss under 30% noise, mean over datasets, sizes and seeds (same-500 basis)\n")
out.append("| layers | noise | " + " | ".join(MODELS) + " |")
out.append("|---|---|" + "---|" * len(MODELS))
for L in sorted({r["layers"] for r in rows}):
    for mode in ("drop30", "sub30"):
        cells = []
        for m in MODELS:
            rs = [r for r in rows if r["layers"] == L and r["model"] == m]
            cells.append(f"{np.mean([1 - r[mode] / r['wf1_500'] for r in rs]):.3f}" if rs else "–")
        out.append(f"| {L} | {mode} | " + " | ".join(cells) + " |")

neg = sum(r["drop30"] > r["wf1_500"] for r in rows)
out.append(f"\nRuns scoring higher with 30% of tokens dropped than clean (same 500): {neg} of {len(rows)}")
out.append(f"\nTotal runs aggregated: {len(rows)} (files: {', '.join(EXPERIMENT_FILES)})")
open(os.path.join(HERE, "results", "summary.md"), "w").write("\n".join(out))
json.dump(summ, open(os.path.join(HERE, "results", "summary.json"), "w"), indent=1)
print("\n".join(out))
