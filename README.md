# Paper #13 reproduction: Generative or Discriminative? (Kasa et al., EMNLP 2025)

Scaled-down, from-scratch reproduction of the paper's core comparison: a discriminative encoder (ENC) against
generative / pseudo-generative classifiers (MLM, AR, AR_pseudo), across training-set sizes, with calibration (ECE)
and token-noise robustness.

## Folder contents

| Path | What it is |
|---|---|
| `repro.py` | All four classifiers, training, evaluation (one file) |
| `aggregate.py` | Builds `results/summary.md` and `results/summary.json` from the two experiment files |
| `make_figs.py` | Builds the four slide figures in `figs/` |
| `results/agnews.jsonl`, `results/sst2.jsonl` | One row per run (96 runs). The only files `aggregate.py` reads |
| `logs/` | Console output of the two grid runs |
| `slides/` | `Paper13_slides.pptx` (editable), `Paper13_slides.pdf` (for presenting/printing), `build_deck.js` (generator) |
| `demo/` | Live-demo fallback: the exact output of the demo command |
| `VIVA_PREP.md` | Numbers to know and expected viva questions |
| `AUDIT.md` | Line-by-line comparison of our code with the authors' released code |
| `CHANGES.md` | What changed on 11 Nov and why |
| `archive/v1_nov1/` | The original results, figures, logs and scripts, kept unchanged for the record |

## Run it

```bash
pip install torch scikit-learn numpy matplotlib
mkdir data && cd data
B=https://raw.githubusercontent.com
curl -sLO $B/mhjabreel/CharCNN_Keras/master/data/ag_news_csv/train.csv && mv train.csv agnews_train.csv
curl -sLO $B/mhjabreel/CharCNN_Keras/master/data/ag_news_csv/test.csv  && mv test.csv  agnews_test.csv
for s in train dev test; do curl -sL -o sst2_$s.tsv $B/clairett/pytorch-sentiment-classification/master/data/SST2/$s.tsv; done
cd ..

python repro.py --dataset agnews          # 48 runs, about 65 minutes on one CPU core
python repro.py --dataset sst2            # 48 runs, about 60 minutes on one CPU core
python aggregate.py                       # tables -> results/summary.md
python make_figs.py                       # figures -> figs/
node slides/build_deck.js                 # slides -> slides/Paper13_slides.pptx (numbers read from results/)
```

The two grids are independent and each uses one thread, so on a 2-core machine run them at the same time.
Runs are resumable: finished (model, layers, n, seed) rows in `results/*.jsonl` are skipped. Every run is
deterministic for a given seed (checked: rerunning the full AG News grid reproduced every stored number exactly).

## Live demo (about 7 minutes)

Train one cell of the grid in front of the examiner. **Start it at the beginning of the presentation**, so it has
finished by the time the results slides come up:

```bash
python repro.py --dataset agnews --layers 4 --sizes 2048 --seeds 0 --models ENC AR --out /tmp/demo.jsonl
```

`--out /tmp/demo.jsonl` matters: without it the run writes to `results/agnews.jsonl`, finds the cell already
finished, and skips it.

Expected output (same code and seed as the stored grid, so it should match to three decimals):

| Model | weighted-F1 | ECE | F1, 30% dropped | F1, 30% substituted |
|---|---|---|---|---|
| ENC | 0.715 | 0.226 | 0.663 | 0.587 |
| AR | 0.817 | 0.108 | 0.768 | 0.772 |

What it shows: AR beats ENC on F1 and is better calibrated, from 2,048 training examples.
Timing from our runs: ENC about 2.7 minutes, AR about 4 minutes (one core).

**Fallback** if the live run is slow or fails: `demo/expected_output_n2048.txt` is the captured console output of
this exact command; the same rows are in `results/agnews.jsonl` (seed 0, 4 layers, n = 2,048).

**Short backup demo** (about 3.5 minutes): `--sizes 512` instead of `--sizes 2048`. Expect ENC 0.521 and AR 0.514.
At n = 512 seed 0 happens to show AR slightly *below* ENC (AR leads only in seed 1), so if you use it, say so.

## What each classifier does (repro.py)

| Model | Sequence | Training loss | Prediction |
|---|---|---|---|
| ENC | `[CLS] text` | cross-entropy on a linear head | argmax of head |
| MLM | `[CLS] text [SEP] the label is [LABEL]` | masked-LM; label slot always masked, 15% of other tokens masked | logits at the masked label slot, restricted to the label tokens |
| AR | `[BOS] [LABEL] text` | next-token loss on every token | for each label y: sum of log P(text tokens given y); softmax over labels (uniform prior) |
| AR_pseudo | `[BOS] text [LABEL]` | next-token loss on every token | next-token logits after the text, restricted to label tokens |

All share one pre-LN transformer (d=128, 4 heads, 1 or 4 layers), trained from scratch, AdamW lr 1e-3 with one-cycle
schedule, batch 32. Checkpoint chosen on 200 held-out training-pool examples (not counted in n).

### How these differ from the paper and from the released code (deliberate; not changed)

| Model | Paper text | Released code | Ours |
|---|---|---|---|
| AR | argmax of log P(X given y) | scores label + text with the mean token loss (adds a learned class prior); probabilities = softmax of minus mean loss | **matches the paper's text**: sum of log P(text given y), uniform prior. Our AR probabilities are therefore much sharper, so **our AR ECE is not comparable** with the paper's |
| MLM | `[CLS] X [SEP] "The label is" y`, standard 15% random masking (label masked only when it falls in the 15%) | `text Label:k`, standard 15% masking | template as in the paper, but the **label slot is masked in every training example**. This differs from both and gives our MLM a stronger label signal |
| AR_pseudo | label appended after the text | `text: ..., label:` then the label | no cue word before the label |
| all | WordPiece / GPT-2 BPE, natural label words | same | word-level vocabulary; labels are dedicated vocabulary tokens |

These are reproduction decisions, kept as they are and reported. See `AUDIT.md` for the full list.

## Scope reductions (be ready to defend these)

- DIFF (discrete diffusion classifier) not implemented: too expensive on CPU.
- 1 and 4 layers, not 1/6/12; d=128; word-level 3,000-word vocabulary built from the training texts; 40 tokens.
- AG News and SST-2 only; n in {128, 512, 2048}; 2 seeds; 1,000 test examples (500 for the noise runs).
- One learning rate, short training (12 to 40 epochs), no per-model grid search.
- Label tokens are dedicated vocabulary items, not natural-language label words.
- Noise is applied at test time only: 30% of test tokens dropped, or replaced by a random word. Clean and noisy F1
  are both measured on the **same 500 test examples** (`wf1_500` vs `drop30`/`sub30`). The paper instead reports the
  minimum noise level that causes a given relative drop, at full data, for 6 and 12 layers.

## SST-2 protocol (differs from the paper)

- We use the official SST-2 split: 6,920 train, 872 dev, 1,821 test. Validation is 200 examples held out from the
  training set (as for AG News); the dev set is not used. Test = a fixed random 1,000 of the 1,821 test sentences.
- **The paper scores SST-2 on 872 examples (its Table 6), i.e. the dev set.** So our SST-2 numbers are on a
  different test set from the paper's, in addition to the scale differences above.
- Split checks: no dev-test overlap, no dev-train overlap. Two trivial sentences ("no", "what 's next ?") appear in
  both train and test, a known property of SST; we left them in.
- The original (1 Nov) SST-2 results were computed on a test set that merged dev and test. They are kept in
  `archive/v1_nov1/` and are no longer used anywhere.

## Results

See `results/summary.md` (all tables) and `results/*.jsonl` (every run). 96 runs total.
Plots used in the slides are in `figs/` (regenerate with `make_figs.py`).
