# Code audit: our repro.py vs the authors' released code

> **Status, 11 Nov.** Decision: the section A differences (AR scoring, MLM masking, AR_pseudo cue, model sizes,
> tokenizer, optimisation) are **kept as they are** and reported as deliberate deviations in the README, slides and
> viva prep. Changing them is a separate reproduction decision, not part of the presentation cleanup.
> Done since this audit: #8 re-confirmed by reading the released code (both `encoder_mlm/mlm_classif_seed_fixed.py`
> and `ar/train_gpt.py` validate on the test split); #10 fixed (official SST-2 split, verified, SST-2 rerun; validation
> is still 200 held-out training examples, not dev); #12 partly addressed (clean and noisy F1 now on the same 500
> test examples; still one noise level, no sweep). #9, #11, #13 to #15 are open.

Reference: https://github.com/amazon-science/Generative-vs-Discriminative-Classifiers (cloned and read: `ar/`, `ar_pseudo/`,
`encoder_mlm/`). The `diff/` folder (a SEDD-based diffusion implementation) was not audited.
The released repo contains training and inference for the models only. It has **no code for ECE/MCE, ordinality
(UM, MAE, MSE) or the token-noise robustness protocol**, so those parts of the paper cannot be checked against code.
Everything below was checked in the source files, not inferred from the paper text.

## A. Differences that change results (fix before any large run)

| # | Item | Authors' code | Ours | Effect on comparison |
|---|---|---|---|---|
| 1 | **AR scoring** | Sequence `Label:{k},Text:{text}`; loss over the **whole** sequence, including the label token; predicts argmax of `-mean NLL` | `[BOS][LABEL] text`; score = sum of log P(text tokens given y), label token **excluded**, uniform prior | Theirs implicitly scores the joint P(y, x) (learned class prior included). Ours is the textbook P(x given y) with a uniform prior. Same on balanced AG News, different on imbalanced sets (Twitter has a 65.6% class) |
| 2 | **AR probabilities for ECE** | `softmax(-mean NLL per label)` | `softmax(sum of log-likelihoods)` | Mean-NLL differences are tiny, so their AR probabilities are very flat (underconfident). Ours are far sharper. **Our AR ECE is not comparable with the paper's** until this is matched or both reported |
| 3 | **MLM input and masking** | `"{text} Label:{k}"`, label is a digit token at the end; standard 15% random masking over all tokens, so the label is masked only ~15% of the time. Inference masks the label and restricts to label tokens | `[CLS] text [SEP] the label is [LABEL]`, label slot **always** masked in training | Ours trains the label prediction on every step. It is a stronger discriminative signal than the paper's MLM and may explain differences in MLM behavior. The paper text mentions a "The label is [MASK]" style template; the released code uses `Label:[MASK]`. Decide which one we follow and say so |
| 4 | **AR_pseudo input** | `"text: {text}, label:"` then the label token; left truncation; read at the `label:` cue | `[BOS] text [LABEL]`, no cue words | Minor, but ours has no delimiter before the label |
| 5 | **Model sizes** | hidden = 768 x heads / 12, so 1 layer/1 head = **hidden 64**, 6/6 = **hidden 384**, 12/12 = 768; random init | d=128, 4 heads for every depth | Different capacity. At 1 layer ours is 2x wider |
| 6 | **Tokenizer and length** | BERT WordPiece (ENC, MLM) and GPT-2 BPE (AR, AR_pseudo), max length 512 | word-level 3,000-word vocabulary, 40 tokens | Large. Long truncation drops evidence on IMDb-like text; the unknown-word rate is high |
| 7 | **Optimization** | ENC/MLM: HF defaults (lr 5e-5), batch 16, 200 epochs, early stopping patience 10. AR: lr 1e-5, batch 8 per GPU on 4 GPUs, up to 500 epochs | lr 1e-3 one-cycle, batch 32, 12 to 40 epochs | Ours is a very different, short regime. Most likely reason for our non-reproduced trends |
| 8 | **Model selection / test data** | Validation = the **test split** (the code comments admit it: "for illustration purposes only"). ENC/MLM select by eval loss; AR by weighted-F1 on 480 test examples | Separate 200-example validation set from the training pool; test untouched | Ours is cleaner. The paper's reported numbers may therefore be slightly optimistic. Note this as a limitation of the original, not a bug of ours |
| 9 | **Seeds** | 3 fixed seeds (79140, 24561, 54641) | seeds 0, 1 | Use 3 seeds |

## B. Our own issues (independent of the reference)

| # | Item | Status |
|---|---|---|
| 10 | SST-2 test set = official test (1,821) **plus dev (872)** merged. The standard protocol uses dev as validation and test separately | Fix: you said you already fixed an SST-2 split issue. Confirm that your copy no longer merges them, and that validation comes from dev |
| 11 | Checkpoint selection evaluates only 4 to 5 times per run | Fine for the audit; for the final run evaluate every epoch (cheap for ENC, costly for AR) |
| 12 | Noise robustness uses one noise level (30%), applied at test time, on 500 examples | The paper reports the **minimum noise for a 10% relative drop**, which needs a sweep. Not implemented |
| 13 | Ordinality (UM, MAE, MSE on SST-5 etc.) and MCE | Not implemented |
| 14 | Dataset coverage | 2 of 9. Missing: SST-5, Emotion, IMDb, Rotten Tomatoes, Hate Speech, Multiclass Sentiment, Twitter Financial |
| 15 | DIFF | Not implemented (the authors' `diff/` folder is a SEDD fork that can be read for the loss and the absorbing graph) |

## C. Verified as consistent with the reference

- ENC: Transformer encoder, classification head, cross-entropy, trained from scratch.
- AG News 120,000 / 7,600 and labels 0 to 3 in the standard order; SST-2 6,920 / 872 / 1,821.
- Subsampling: shuffle with a seed and take the first n (no class balancing) in both.
- AR training loss covers every token of the sequence (the label-conditioned LM objective).
- AR_pseudo and MLM inference restrict the output to label tokens, as in ours.
- Weighted-F1 via scikit-learn.

## D. Recommended order of fixes (cheapest and most important first)

1. Make AR scoring match: include the label token and use the mean NLL (or report both variants as an ablation).
   Report ECE for both mean-based and sum-based probabilities.
2. Make MLM follow the released code (`text Label:[MASK]`, plain 15% masking) as the main variant. Keep our forced-label
   masking as a labeled ablation.
3. Use the authors' size rule (hidden = 768 x heads / 12; 64 at 1 layer) and subword tokenizers if the GPT-2 and BERT
   tokenizers can be obtained here (Hugging Face is blocked from the cloud sandbox; it works on your Mac).
4. Lower the learning rate and train longer with early stopping; this needs a GPU or the HPC.
5. Then add the missing metrics (MCE, ordinality, noise sweep), datasets, 3 seeds, and finally DIFF.
