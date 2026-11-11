"""Regenerate the slide figures in figs/ from results/agnews.jsonl and results/sst2.jsonl.

  python make_figs.py                 # reads results/, writes figs/
  python make_figs.py --results DIR --figs DIR

End-of-line labels are pushed apart vertically so they never overlap each other or the "chance" label.
"""
import argparse
import json
import os
from collections import defaultdict

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = ["ENC", "MLM", "AR", "AR_pseudo"]
COLOR = {"ENC": "#2a78d6", "MLM": "#eb6834", "AR": "#1aad7c", "AR_pseudo": "#6450d6"}
MARKER = {"ENC": "o", "MLM": "s", "AR": "^", "AR_pseudo": "D"}
INK, MUTED, GRID, BG = "#2b2b2b", "#6b6b6b", "#e6e6e3", "#fcfcfb"
SIZES = [128, 512, 2048]
CHANCE = {"agnews": 0.25, "sst2": 0.5}

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11, "axes.edgecolor": "#c8c8c4", "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False,
    "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG,
})


def load(results):
    g = defaultdict(list)
    for f in ("agnews.jsonl", "sst2.jsonl"):
        for line in open(os.path.join(results, f)):
            r = json.loads(line)
            g[(r["dataset"], r["layers"], r["n"], r["model"])].append(r)
    return g


def stat(g, ds, L, n, m, fn):
    v = np.array([fn(r) for r in g[(ds, L, n, m)]])
    return v.mean(), v.std()


def repel(ys, gap):
    """Return label y positions, same order as ys, at least `gap` apart, as close to the targets as possible."""
    order = np.argsort(ys)
    pos = np.array(ys, dtype=float)[order]
    for _ in range(200):
        moved = False
        for i in range(1, len(pos)):
            d = pos[i] - pos[i - 1]
            if d < gap:
                shift = (gap - d) / 2
                pos[i - 1] -= shift
                pos[i] += shift
                moved = True
        if not moved:
            break
    out = np.empty_like(pos)
    out[order] = pos
    return out


def line_panel(ax, g, ds, L, fn, title, ylabel=None, chance=None, ylim=None):
    x = np.arange(len(SIZES))
    ends = []
    for m in MODELS:
        mu, sd = zip(*[stat(g, ds, L, n, m, fn) for n in SIZES])
        ax.errorbar(x, mu, yerr=sd, color=COLOR[m], marker=MARKER[m], ms=8, lw=2, capsize=3, elinewidth=1.4,
                    mec="white", mew=1.2, label=m, zorder=3)
        ends.append((mu[-1], m, COLOR[m]))
    if chance is not None:
        ax.axhline(chance, color=MUTED, ls="--", lw=1.2, zorder=1)
        ends.append((chance, "chance", MUTED))
    if ylim:
        ax.set_ylim(*ylim)
    lo, hi = ax.get_ylim()
    ys = repel([e[0] for e in ends], gap=0.06 * (hi - lo))
    for (y0, name, c), y in zip(ends, ys):
        ax.annotate(name, (x[-1], y0), xytext=(x[-1] + 0.12, y), textcoords="data", va="center", fontsize=11,
                    color=INK if name != "chance" else MUTED,
                    arrowprops=dict(arrowstyle="-", color=c, lw=0.8, shrinkA=0, shrinkB=6) if abs(y - y0) > 0.004 else None)
    ax.set_xticks(x, [f"{n:,}" for n in SIZES])
    ax.set_xlim(-0.25, len(SIZES) - 1 + 0.75)
    ax.set_xlabel("training examples (n)")
    if ylabel:
        ax.set_ylabel(ylabel)
    ax.grid(axis="y", color=GRID, lw=1)
    ax.set_title(title, loc="left", fontsize=14, color=INK)


def legend_row(fig):
    h = [plt.Line2D([], [], color=COLOR[m], marker=MARKER[m], ms=8, lw=2, mec="white") for m in MODELS]
    fig.legend(h, MODELS, loc="upper right", ncol=4, frameon=False, fontsize=11, bbox_to_anchor=(0.99, 1.0))


def f1_fig(g, ds, path, name):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.4), sharey=True)
    vals = [stat(g, ds, L, n, m, lambda r: r["wf1"]) for L in (1, 4) for n in SIZES for m in MODELS]
    lo = min(min(v[0] - v[1] for v in vals), CHANCE[ds]) - 0.03
    hi = max(v[0] + v[1] for v in vals) + 0.03
    for ax, L in zip(axes, (1, 4)):
        line_panel(ax, g, ds, L, lambda r: r["wf1"], f"{name}, {L} layer{'s' if L > 1 else ''}",
                   ylabel="test weighted-F1" if L == 1 else None, chance=CHANCE[ds], ylim=(lo, hi))
    legend_row(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def ece_fig(g, path):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.4))
    for ax, (ds, name) in zip(axes, (("agnews", "AG News"), ("sst2", "SST-2"))):
        vals = [stat(g, ds, 4, n, m, lambda r: r["ece"]) for n in SIZES for m in MODELS]
        line_panel(ax, g, ds, 4, lambda r: r["ece"], f"{name}, 4 layers",
                   ylabel="test ECE (lower is better)" if ds == "agnews" else None,
                   ylim=(0, max(v[0] + v[1] for v in vals) + 0.03))
    legend_row(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def noise_fig(g, path):
    base = lambda r: r.get("wf1_500", r["wf1"])
    fig, ax = plt.subplots(figsize=(14, 5.4))
    x = np.arange(len(MODELS))
    w = 0.36
    for k, (mode, hatch, alpha, lab) in enumerate((("drop30", None, 1.0, "30% of tokens dropped"),
                                                    ("sub30", "//", 0.55, "30% of tokens substituted"))):
        for i, m in enumerate(MODELS):
            mu, sd = stat(g, "agnews", 4, 2048, m, lambda r: 100 * (1 - r[mode] / base(r)))
            xi = x[i] + (k - 0.5) * (w + 0.04)
            ax.bar(xi, mu, w, color=COLOR[m], alpha=alpha, hatch=hatch, edgecolor="white", lw=0, zorder=3)
            ax.errorbar(xi, mu, yerr=sd, color=INK, capsize=3, lw=1, zorder=4)
            ax.text(xi, max(mu, 0) + sd + 0.6, f"{mu:.0f}%", ha="center", va="bottom", fontsize=11, color=INK)
    ax.axhline(0, color="#c8c8c4", lw=1)
    ax.set_ylim(top=ax.get_ylim()[1] * 1.12)          # headroom so value labels never touch the title
    ax.set_xticks(x, MODELS)
    ax.set_ylabel("relative F1 loss (%)")
    ax.grid(axis="y", color=GRID, lw=1)
    ax.set_title("AG News, 4 layers, n = 2,048: F1 lost under 30% token noise (same 500 test examples)",
                 loc="left", fontsize=14, color=INK)
    h = [plt.Rectangle((0, 0), 1, 1, color="#8a8a86"), plt.Rectangle((0, 0), 1, 1, color="#8a8a86", alpha=0.55,
                                                                      hatch="//", ec="white", lw=0)]
    ax.legend(h, ["dropped (solid)", "substituted (hatched)"], loc="upper right", frameon=False, fontsize=11)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "results"))
    ap.add_argument("--figs", default=os.path.join(HERE, "figs"))
    a = ap.parse_args()
    os.makedirs(a.figs, exist_ok=True)
    g = load(a.results)
    f1_fig(g, "agnews", os.path.join(a.figs, "f1_ag.png"), "AG News")
    f1_fig(g, "sst2", os.path.join(a.figs, "f1_sst.png"), "SST-2")
    ece_fig(g, os.path.join(a.figs, "ece.png"))
    noise_fig(g, os.path.join(a.figs, "noise.png"))
    print("wrote", a.figs)


if __name__ == "__main__":
    main()
