"""Aggregate results/*.jsonl into mean +- std tables (results/summary.md, results/summary.json)."""
import json
import os
from collections import defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
for f in sorted(os.listdir(os.path.join(HERE, "results"))):
    if f.endswith(".jsonl"):
        rows += [json.loads(l) for l in open(os.path.join(HERE, "results", f))]

g = defaultdict(list)
for r in rows:
    g[(r["dataset"], r["layers"], r["n"], r["model"])].append(r)

MODELS = ["ENC", "MLM", "AR", "AR_pseudo"]
out, summ = [], {}
for metric, title in [("wf1", "Test weighted-F1"), ("ece", "Test ECE (lower = better calibrated)"),
                      ("drop30", "Weighted-F1 with 30% of test tokens dropped"),
                      ("sub30", "Weighted-F1 with 30% of test tokens substituted")]:
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
                        v = np.array([r[metric] for r in rs])
                        vals[m] = v.mean()
                        cells.append(f"{v.mean():.3f}±{v.std():.3f}")
                        summ[f"{metric}|{ds}|{L}|{n}|{m}"] = [float(v.mean()), float(v.std()), len(v)]
                    else:
                        cells.append("–")
                pick = (min if metric == "ece" else max)(vals, key=vals.get) if vals else "–"
                out.append(f"| {n} | " + " | ".join(cells) + f" | {pick} |")

# relative degradation under noise
out.append("\n### Relative F1 drop under 30% noise (1 - noisy/clean), mean over datasets, sizes and seeds\n")
out.append("| layers | noise | " + " | ".join(MODELS) + " |")
out.append("|---|---|" + "---|" * len(MODELS))
for L in sorted({r["layers"] for r in rows}):
    for mode in ("drop30", "sub30"):
        cells = []
        for m in MODELS:
            rs = [r for r in rows if r["layers"] == L and r["model"] == m]
            cells.append(f"{np.mean([1 - r[mode] / r['wf1'] for r in rs]):.3f}" if rs else "–")
        out.append(f"| {L} | {mode} | " + " | ".join(cells) + " |")
out.append(f"\nTotal runs aggregated: {len(rows)}")
open(os.path.join(HERE, "results", "summary.md"), "w").write("\n".join(out))
json.dump(summ, open(os.path.join(HERE, "results", "summary.json"), "w"), indent=1)
print("\n".join(out))
