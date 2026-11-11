# Viva prep: Paper #13 (Group 13)

All numbers below are read from `results/*.jsonl` (mean of 2 seeds, weighted-F1 unless stated). They match the
slides, which are built from the same files.

## Know these numbers

| AG News, 4 layers | 128 | 512 | 2,048 |
|---|---|---|---|
| ENC | 0.360 | 0.524 | 0.703 |
| MLM | 0.326 | 0.423 | 0.502 |
| AR | 0.363 | 0.555 | 0.821 |
| AR_pseudo | 0.259 | 0.300 | 0.378 |

| AG News, 1 layer | 128 | 512 | 2,048 |
|---|---|---|---|
| ENC | 0.327 | 0.464 | 0.682 |
| MLM | 0.256 | 0.329 | 0.351 |
| AR | 0.333 | 0.434 | 0.728 |
| AR_pseudo | 0.255 | 0.260 | 0.286 |

| SST-2, 4 layers | 128 | 512 | 2,048 |
|---|---|---|---|
| ENC | 0.549 | 0.582 | 0.650 |
| MLM | 0.499 | 0.502 | 0.493 |
| AR | 0.552 | 0.587 | 0.647 |
| AR_pseudo | 0.512 | 0.530 | 0.561 |

- SST-2 best: 0.650 (ENC, 4 layers, n = 2,048); chance is 0.5, so SST-2 says little.
  At 4 layers, n = 2,048, ENC vs AR differ by 0.003, with seed standard deviations up to 0.020.
- SST-2 numbers are on the **official 1,821-sentence test set** (fixed random 1,000). The paper uses the 872-sentence
  dev set as its SST-2 test set. Our old (1 Nov) SST-2 numbers used a merged dev+test set; they are archived and must
  not be quoted.
- ECE, AG News 4 layers n=2,048: ENC 0.238, MLM 0.039, AR 0.110, AR_pseudo 0.026.
- Relative F1 loss with 30% of tokens dropped / substituted (AG News, 4 layers, n=2,048; clean and noisy F1 on the
  **same 500** test examples): ENC 5% / 17%, MLM 29% / 10%, AR 7% / 9%, AR_pseudo 17% / 15%.
- Even on the same 500 examples, 21 of 96 runs score slightly *higher* with 30% of tokens dropped (before the
  fix: 33). All of them have clean F1 within 0.14 of chance (SST-2, or small-n / AR_pseudo runs on AG News), where
  F1 moves by noise. Only large differences in robustness are meaningful.
- Before the same-500 fix these AG News numbers were ENC 4% / 17%, MLM 25% / 5%, AR 5% / 7%, AR_pseudo 12% / 10%.
  The conclusions did not change, but quote only the new numbers.

## Questions to expect, and honest answers

1. **What is the core contribution?** A large controlled comparison: 5 models × 9 datasets × 7 training sizes ×
   3 depths × 3 seeds = 2,835 runs. It shows the classic "generative learns faster, discriminative wins
   asymptotically" rule depends on architecture and depth, and that accuracy, calibration and robustness favour
   different models.
2. **How does AR classify?** One forward pass per label with the label prepended; score = sum of token
   log-probabilities of the text given that label; argmax (uniform prior). Cost grows with the number of classes.
   This matches the paper's text. The released code differs: it scores label + text with the mean token loss.
3. **Why is AR_pseudo different?** The label comes after the text, so the model learns P(label | text) as a
   next-token prediction. It is not a model of P(text | label), hence "pseudo-generative".
4. **How does your MLM predict?** Template "the label is [MASK]"; we read the logits over the label tokens only.
   In training we mask the label slot **every time** (plus 15% of other tokens). The paper and its code use plain
   15% random masking, so their label is masked only about 15% of the time. Ours gets a stronger label signal: say
   this is a deliberate difference, not the paper's method.
5. **What did you simplify, and why?** DIFF, depth (1 and 4 layers), vocabulary, datasets, seeds, training length.
   CPU only, two cores, about 2 hours of compute per full rerun. Mechanisms are faithful; scale is not.
6. **Which of the paper's claims did you reproduce?** Be precise:
   - Reproduced: AR_pseudo is weaker than AR (ours stays far below AR at every n on AG News, close to chance at 1 layer); MLM is the least robust to dropped
     tokens (loses 29%).
   - Partly: substitution hurts more than dropping for ENC and AR, but not for MLM and AR_pseudo.
   - **Not reproduced: the paper's two-regimes shape.** In the paper (12 layers) the generative advantage is at
     *low* data and **shrinks** as data grows. Ours (4 layers) is a tie at n = 128 (0.363 vs 0.360) and
     the gap **grows** to 0.821 vs 0.703 at n = 2,048. So "AR beats ENC" is true in our runs, but it is the
     opposite shape from the paper's, at a different depth. Do not call it a reproduction of the two-regimes claim.
   - Not reproduced: MLM strongest at high data; ENC well calibrated; AR noise-sensitive (different metric too).
   - **Can't test: the 1-layer claim** ("only ENC keeps improving and wins at high data"). Our 1-layer AR beats ENC at
     n = 2,048 (0.728 vs 0.682), but our data stops at 2,048 examples while the paper's
     "high data" goes up to the full dataset (120,000 for AG News). Say "we can't test it", not "we refuted it".
7. **Why might the gap grow in your runs when the paper's shrinks?** Our ENC is likely under-tuned (one lr, few epochs)
   and our largest n is only 2,048. We have not run an ablation to confirm this, so say "likely", not "because".
8. **Why is your ENC badly calibrated?** Probably overfitting: high lr, many epochs on tiny data, and we select
   the best-F1 epoch. Untested. Also, low ECE for near-chance models is partly trivial.
9. **Is SST-2 informative?** No. Models are close to chance, and differences are inside seed noise. Also say that we
   rescored it on the official test set, and that the paper used the dev set as its test set.
10. **Why are your absolute numbers low?** Tiny models trained from scratch on at most 2,048 examples with a
    word-level vocabulary; the paper's numbers come from BERT/GPT-2-size models and far longer training.
11. **How did you avoid test leakage?** Checkpoint chosen on a separate 200-example validation set drawn from the
    training pool (outside the n training examples); test used once per run. (Contrast with the released code,
    which validates on the test split: see Q13.)
12. **What would you do with more compute?** Add 6 and 12 layers, DIFF, subword tokenization, per-model tuning,
    more seeds, pretrained backbones, and equal training budgets across models.
13. **Weaknesses of the paper?** Go beyond what the paper itself lists:
    - **Model selection on test data in the released code.** `encoder_mlm/mlm_classif_seed_fixed.py` and
      `ar/train_gpt.py` use the test split as the validation set (ENC/MLM pick the best checkpoint by eval loss on
      it). The authors' own comment says this is "for illustration purposes only". We cannot tell whether the
      paper's numbers came from exactly this code, so say "the released code does this".
    - **Paper text and code disagree:** MLM template ("The label is" vs "Label:"), AR scoring (log P(X given y) vs
      mean loss over label + text), training length (Appendix B: ENC 30 epochs, MLM 200, AR up to 100; code: 200,
      200 and up to 500).
    - **Unequal training budgets per model,** so some gaps may reflect training budget, not the modelling approach.
    - No significance tests (3 seeds, shaded std only); from-scratch only (the pretrained check covers ENC vs AR
      only); no distribution shift; synthetic noise at full data only; DIFF has no calibration measure.
14. **Link to the course?** Naive Bayes vs logistic regression is the same generative/discriminative split;
    AR is a neural analogue of Naive Bayes' P(x|y)P(y), ENC of logistic regression.

## Three more questions to prepare (answers are untested hypotheses: say so)

15. **Why is AR_pseudo close to chance?** In `[BOS] text [LABEL]` the label is 1 target out of up to about 41 in
    the next-token loss, so it is only about 2.5% of the training signal. With 12 to 40 epochs the language-modelling
    part dominates and the label is barely learned. A test would be to up-weight the label token's loss.
16. **Why does dropping tokens hurt MLM much more than substitution, unlike the paper?** MLM (and AR_pseudo) read the
    label from the last position. Dropping tokens shortens the sequence, so the label slot moves to an earlier
    absolute position than in training; substitution keeps the length. That would also explain AR_pseudo
    (17% dropped vs 15% substituted). Not tested.
17. **How does a model trained on n = 128 have a 3,000-word vocabulary?** The vocabulary is built from all training
    texts (119,800 for AG News, 6,720 for SST-2; labels not used), not only the n labelled examples. Every model uses
    the same vocabulary, so the comparison is fair, but it is a small amount of unlabelled information.

## Do not claim
- That the two-regimes effect is confirmed or refuted by our runs.
- That "AR beats ENC" reproduces the paper's low-data result (see Q6).
- Any number from the paper that is not in the slides. The robustness table and the calibration, noise and
  epoch statements were checked against the paper; the remaining paper details were not independently re-checked.
- That AR beats ENC at n=512 in every seed. It does not: seed 0 gives ENC 0.521 vs AR 0.514.
- That our AR ECE can be compared with the paper's (different probability definition; see Q2).
- Any SST-2 number from before 11 Nov (merged dev+test).
