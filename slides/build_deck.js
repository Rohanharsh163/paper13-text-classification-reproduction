// Builds slides/Paper13_slides.pptx from results/*.jsonl and figs/*.png.
//   node slides/build_deck.js        (run from the project root, after aggregate.py and make_figs.py)
// Every number on the "our results" slides is computed here from the result files, not typed in.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const SKILL = process.env.PPTX_SKILL_DIR;           // optional: path to apply_theme.js's skill folder
const OUT = path.join(__dirname, "Paper13_slides.pptx");

// ------------------------------------------------------------------ data
const rows = ["agnews.jsonl", "sst2.jsonl"].flatMap((f) =>
  fs.readFileSync(path.join(process.env.RESULTS_DIR || path.join(ROOT, "results"), f), "utf8").trim().split("\n").map((l) => JSON.parse(l)));
function cell(ds, L, n, m) { return rows.filter((r) => r.dataset === ds && r.layers === L && r.n === n && r.model === m); }
function mean(ds, L, n, m, fn) { const rs = cell(ds, L, n, m); return rs.reduce((a, r) => a + fn(r), 0) / rs.length; }
const F1 = (ds, L, n, m) => mean(ds, L, n, m, (r) => r.wf1);
const ECE = (ds, L, n, m) => mean(ds, L, n, m, (r) => r.ece);
const DROP = (ds, L, n, m) => 100 * mean(ds, L, n, m, (r) => 1 - r.drop30 / r.wf1_500);
const SUB = (ds, L, n, m) => 100 * mean(ds, L, n, m, (r) => 1 - r.sub30 / r.wf1_500);
const f3 = (x) => x.toFixed(3);
const pc = (x) => `${Math.round(x)}%`;
const seedRow = (ds, L, n, m, s) => rows.find((r) => r.dataset === ds && r.layers === L && r.n === n && r.model === m && r.seed === s);

// ------------------------------------------------------------------ theme
const THEME = {
  name: "Paper13",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1F2230", lt1: "FFFFFF", dk2: "1B2A41", lt2: "F2F4F7",
    accent1: "2A78D6", accent2: "EB6834", accent3: "1AAD7C", accent4: "6450D6", accent5: "8A8A86", accent6: "C9A227",
    hlink: "2A78D6", folHlink: "6450D6",
  },
};
const MODEL = { ENC: "2A78D6", MLM: "EB6834", AR: "1AAD7C", AR_pseudo: "6450D6", DIFF: "7A7D85" };
const INK = "1F2230", MUTED = "5F6370", TINT = "F2F4F7", NAVY = "1B2A41", LINE = "D9DCE3";
const VERDICT = { "Reproduced": "137A55", "Partly": "9A6B00", "Not reproduced": "B23A2E", "Can't test": "5F6370" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Generative or Discriminative? Paper #13";
pres.subject = "CS F429 paper presentation";
const C = pres.SchemeColor;
const W = 13.333;

pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.6, w: 11.7, h: 1.6, fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Cambria", valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.35, w: 11.7, h: 0.9, fontSize: 24, color: "CADCFC", fontFace: "Calibri", valign: "top" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION_DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.6, w: 11.7, h: 1.2, fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Cambria", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.85, w: 11.7, h: 0.8, fontSize: 22, color: "CADCFC", fontFace: "Calibri", align: "left" }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: "CADCFC", align: "right" },
});
pres.defineSlideMaster({
  title: "CLOSE_DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 0.7, w: 11.7, h: 1.1, fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Cambria", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 2.1, w: 11.7, h: 4.3, fontSize: 22, color: "FFFFFF", fontFace: "Calibri", align: "left", valign: "top" }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: "CADCFC", align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.95, fontSize: 32, bold: true, color: INK, fontFace: "Cambria", valign: "middle" }, text: "" } },
    { text: { text: "Paper #13 · Kasa et al., EMNLP 2025 · CS F429", options: { x: 0.6, y: 6.95, w: 8, h: 0.35, fontSize: 11, color: MUTED, fontFace: "Calibri" } } },
  ],
  slideNumber: { x: 12.1, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: MUTED, align: "right" },
});

function slide(master, section) { return pres.addSlide({ masterName: master, sectionTitle: section }); }
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, fontFace: "Calibri", color: INK, fontSize: 16, valign: "top", margin: 0.08 }, o)); }
function card(s, x, y, w, h, fill = TINT, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: name });
}
function chip(s, x, y, m, w = 1.35, h = 0.42, fs = 14, label) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: MODEL[m] }, line: { color: MODEL[m] }, rectRadius: 0.21, objectName: `chip ${m}` });
  s.addText(label || m, { x, y, w, h, isTextBox: true, align: "center", valign: "middle", fontSize: fs, bold: true, color: "FFFFFF", fontFace: "Calibri", margin: 0 });
}
function num(s, x, y, w, big, label, color = NAVY) {
  s.addText(big, { x, y, w, h: 1.0, isTextBox: true, fontSize: 54, bold: true, color, fontFace: "Cambria", align: "left", valign: "bottom", margin: 0 });
  s.addText(label, { x, y: y + 1.05, w, h: 0.7, isTextBox: true, fontSize: 15, color: MUTED, fontFace: "Calibri", valign: "top", margin: 0 });
}
function figure(s, file, y = 1.45, takeaway) {
  const w = 12.1, h = w * 810 / 2100;
  s.addImage({ path: path.join(ROOT, "figs", file), x: 0.6, y, w, h, altText: file });
  if (takeaway) txt(s, takeaway, { x: 0.6, y: y + h + 0.1, w: 12.1, h: 0.75, fontSize: 16, color: INK });
}

// ================================================================== 1. title
pres.addSection({ title: "The paper" });
let s = slide("TITLE_DARK", "The paper");
s.addText("Generative or Discriminative?", { placeholder: "title" });
s.addText("Revisiting Text Classification in the Era of Transformers", { placeholder: "body" });
txt(s, "Kasa et al. (Amazon) · EMNLP 2025, Outstanding Paper", { x: 0.8, y: 4.45, w: 11.7, h: 0.5, fontSize: 18, color: "FFFFFF" });
txt(s, "CS F429 Paper Presentation · Paper #13 · Group 13", { x: 0.8, y: 4.95, w: 11.7, h: 0.5, fontSize: 18, color: "CADCFC" });
["ENC", "MLM", "AR", "AR_pseudo", "DIFF"].forEach((m, i) => chip(s, 0.8 + i * 1.55, 5.9, m));
s.addNotes("Paper #13. The question: when we build a text classifier from a transformer trained from scratch, should it model the label given the text (discriminative) or the text and label together (generative)? Five model families, colour-coded the same way throughout the deck.");

// ================================================================== 2. motivation
s = slide("CONTENT", "The paper");
s.addText("Does the classic “two regimes” rule survive transformers?", { placeholder: "title" });
card(s, 0.6, 1.5, 5.85, 3.3, TINT, "generative card");
card(s, 6.85, 1.5, 5.85, 3.3, TINT, "discriminative card");
txt(s, [
  { text: "Generative", options: { bold: true, fontSize: 24, fontFace: "Cambria", breakLine: true } },
  { text: "Models the text and the label together:", options: { fontSize: 17, breakLine: true } },
  { text: "P(X, y) = P(X | y) · P(y)", options: { fontSize: 17, bold: true, breakLine: true } },
  { text: " ", options: { fontSize: 8, breakLine: true } },
  { text: "Classic example: Naive Bayes", options: { bullet: true, breakLine: true } },
  { text: "Learns fast from few examples", options: { bullet: true, breakLine: true } },
  { text: "But a higher error once data is plentiful", options: { bullet: true } },
], { x: 0.85, y: 1.7, w: 5.4, h: 3.0, fontSize: 18 });
txt(s, [
  { text: "Discriminative", options: { bold: true, fontSize: 24, fontFace: "Cambria", breakLine: true } },
  { text: "Models only the label given the text:", options: { fontSize: 17, breakLine: true } },
  { text: "P(y | X)", options: { fontSize: 17, bold: true, breakLine: true } },
  { text: " ", options: { fontSize: 8, breakLine: true } },
  { text: "Classic example: logistic regression", options: { bullet: true, breakLine: true } },
  { text: "Needs more data to get going", options: { bullet: true, breakLine: true } },
  { text: "But a lower error in the end", options: { bullet: true } },
], { x: 7.1, y: 1.7, w: 5.4, h: 3.0, fontSize: 18 });
txt(s, [
  { text: "Known so far: ", options: { bold: true } },
  { text: "Ng & Jordan (2001) proved this trade-off for linear models; Yogatama et al. (2017) saw it with LSTMs. " },
  { text: "Open: ", options: { bold: true } },
  { text: "does it hold for modern transformer classifiers, and does it depend on model size?" },
], { x: 0.6, y: 5.15, w: 12.1, h: 1.3, fontSize: 19 });
s.addNotes("Link to the course: Naive Bayes vs logistic regression is the same split. AR in this paper is a neural Naive Bayes: it scores P(X|y)P(y). ENC is the neural logistic regression: a learned feature extractor plus a softmax over labels.");

// ================================================================== 3. five classifiers
s = slide("CONTENT", "The paper");
s.addText("Five ways to turn a transformer into a classifier", { placeholder: "title" });
const hdr = { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 14, fontFace: "Calibri", valign: "middle" };
const mono = { fontFace: "Courier New", fontSize: 13 };
const tb = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 14, fontFace: "Calibri", valign: "middle", color: INK }, o) });
const modelCell = (m) => ({ text: m, options: { bold: true, color: "FFFFFF", fill: { color: MODEL[m] }, align: "center", valign: "middle", fontSize: 14 } });
s.addTable([
  [tb("Model", hdr), tb("What the model sees", hdr), tb("Trained to", hdr), tb("How it predicts", hdr), tb("Passes", hdr)],
  [modelCell("ENC"), tb("[CLS] text", mono), tb("predict y (cross-entropy)"), tb("linear head on [CLS]"), tb("1")],
  [modelCell("MLM"), tb("[CLS] text [SEP] The label is y", mono), tb("fill in 15% masked tokens"), tb("fill [MASK] in the label slot, label tokens only"), tb("1")],
  [modelCell("AR"), tb("y text", mono), tb("predict every next token"), tb("pick y with the highest log P(text | y)"), tb("one per label")],
  [modelCell("AR_pseudo"), tb("text y", mono), tb("predict every next token"), tb("next token after the text, label tokens only"), tb("1")],
  [modelCell("DIFF"), tb("text [SEP] The label is y", mono), tb("undo random masking (discrete diffusion, SEDD)"), tb("denoise the label slot"), tb("many steps")],
], { x: 0.6, y: 1.5, w: 12.1, colW: [1.45, 3.55, 2.75, 3.3, 1.05], rowH: 0.62, border: { type: "solid", color: LINE, pt: 1 }, fill: { color: "FFFFFF" } });
txt(s, "Discriminative: ENC. Generative: AR, DIFF. “Pseudo-generative”: MLM and AR_pseudo, which learn a likelihood but read the label off as one prediction.",
  { x: 0.6, y: 5.55, w: 12.1, h: 0.9, fontSize: 16, color: MUTED });
s.addNotes("AR is the only true P(X|y) model: it needs one forward pass per label, so cost grows with the number of classes. AR_pseudo puts the label after the text, so it really learns P(y|X) as a next-token prediction: one pass, but not a model of the text given the label. MLM is pseudo-generative because masked-token prediction approximates a pseudo-likelihood (Wang & Cho 2019). DIFF masks the label slot and denoises it.");

// ================================================================== 4. why it should work
s = slide("CONTENT", "The paper");
s.addText("Why might generative models need fewer examples?", { placeholder: "title" });
const why = [
  ["1", "More training signal per example", "ENC gets one target per example (the label). AR and MLM also predict the text tokens, so one example gives dozens of training targets."],
  ["2", "Learning the text works like built-in pretraining", "Modelling P(X) alongside the label acts as a data-dependent regulariser (Erhan et al., 2010). The paper uses this to explain MLM's strength at high data."],
  ["3", "But capacity is shared", "Modelling the text competes with modelling the label. A small model cannot do both well, so the generative advantage should depend on model size."],
  ["4", "Calibration should favour ENC", "ENC's loss targets P(y | X) directly. The others optimise token likelihoods, so their label probabilities need not be calibrated."],
];
why.forEach(([k, head, body], i) => {
  const y = 1.5 + i * 1.32;
  s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.08, w: 0.62, h: 0.62, fill: { color: NAVY }, line: { color: NAVY }, objectName: `why ${k}` });
  s.addText(k, { x: 0.6, y: y + 0.08, w: 0.62, h: 0.62, isTextBox: true, align: "center", valign: "middle", fontSize: 20, bold: true, color: "FFFFFF", margin: 0 });
  txt(s, [{ text: head, options: { bold: true, fontSize: 19, breakLine: true } }, { text: body, options: { fontSize: 16, color: MUTED } }], { x: 1.45, y, w: 11.25, h: 1.2 });
});
s.addNotes("This is the 'why it works' part of the rubric. Point 3 is the paper's multi-task argument (Section 2): log P(X, y) = log P(X) + log P(y|X), two tasks sharing one network. Point 4 is from Appendix A: all losses are proper scoring rules, but only ENC's is aligned with the classification task.");

// ================================================================== 5. setup
s = slide("CONTENT", "The paper");
s.addText("The study: 2,835 training runs, all from scratch", { placeholder: "title" });
[["5", "models"], ["9", "datasets (AG News, SST-2, SST-5, IMDb, ...)"], ["7", "training sizes, 128 up to the full set"], ["3", "depths: 1, 6 and 12 layers"], ["3", "random seeds"]]
  .forEach(([b, l], i) => num(s, 0.6 + i * 2.48, 1.5, 2.3, b, l));
txt(s, "5 × 9 × 7 × 3 × 3 = 2,835 runs", { x: 0.6, y: 3.45, w: 12.1, h: 0.5, fontSize: 18, bold: true, color: NAVY });
card(s, 0.6, 4.15, 12.1, 1.95, TINT, "metrics card");
txt(s, [
  { text: "What they measure", options: { bold: true, fontSize: 19, breakLine: true } },
  { text: "Accuracy: weighted-F1 at every size and depth (Q1)", options: { bullet: true, breakLine: true } },
  { text: "Robustness: randomly drop or substitute X% of tokens; report the noise level that costs 5%, 10%, ... of F1 (Q2)", options: { bullet: true, breakLine: true } },
  { text: "Reliability: calibration (ECE, MCE) and ordinality (MAE, MSE, unimodality) of the predicted probabilities (Q3)", options: { bullet: true } },
], { x: 0.85, y: 4.3, w: 11.6, h: 2.0, fontSize: 18 });
s.addNotes("Training from scratch is deliberate: it removes the effect of pretraining data, so differences come from the modelling approach and size. Section 5.1 adds a pretrained check (BERT vs GPT-2).");

// ================================================================== 6. main finding
s = slide("CONTENT", "The paper");
s.addText("Main finding: which approach wins depends on model size", { placeholder: "title" });
const cols = [
  ["1 layer", "ENC", "Only ENC keeps improving with data and wins at high data. No two regimes."],
  ["6 layers", "DIFF", "DIFF is best with little data; ENC overtakes it as data grows. The classic two regimes hold."],
  ["12 layers", "AR", "AR and DIFF win with little data, the gap shrinks with data, and MLM is best at high data."],
];
cols.forEach(([h, m, body], i) => {
  const x = 0.6 + i * 4.13;
  card(s, x, 1.5, 3.85, 3.65, TINT, `size ${h}`);
  txt(s, h, { x: x + 0.25, y: 1.65, w: 3.4, h: 0.6, fontSize: 24, bold: true, fontFace: "Cambria" });
  chip(s, x + 0.3, 2.35, m, 1.45);
  if (i === 2) chip(s, x + 1.9, 2.35, "MLM", 1.45);
  txt(s, body, { x: x + 0.25, y: 3.0, w: 3.4, h: 2.0, fontSize: 17 });
});
txt(s, [
  { text: "Also: ", options: { bold: true } },
  { text: "AR_pseudo is below AR with little data (and noisier). With pretrained models (BERT vs GPT-2), ENC wins at every size: pretraining removes the two-regimes effect." },
], { x: 0.6, y: 5.4, w: 12.1, h: 1.2, fontSize: 17 });
s.addNotes("This is the core contribution: the generative/discriminative trade-off is not one rule; it depends on architecture and depth. The 1-layer result is the practical one: small, fast models should be ENC.");

// ================================================================== 7. robustness & calibration (paper)
s = slide("CONTENT", "The paper");
s.addText("Robustness and calibration in the paper", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "12 layers", labels: ["ENC", "AR_pseudo", "AR", "MLM", "DIFF"], values: [51.1, 46.7, 37.8, 34.4, 54.5] }], {
  x: 0.6, y: 1.45, w: 6.6, h: 4.9, barDir: "col", chartColors: [MODEL.ENC, MODEL.AR_pseudo, MODEL.AR, MODEL.MLM, MODEL.DIFF], varyColors: true,
  showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", dataLabelFontSize: 13, dataLabelColor: INK, dataLabelFontFace: "+mn-lt",
  showTitle: true, title: "% of tokens dropped before F1 falls 10% (12 layers, higher = more robust)", titleFontSize: 14, titleColor: INK, titleFontFace: "+mn-lt",
  catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontSize: 13, valAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  valGridLine: { color: "E6E6E3", size: 1 }, catGridLine: { style: "none" }, showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 60,
});
txt(s, "Source: paper, Table 2 (random token dropping).", { x: 0.6, y: 6.35, w: 6.6, h: 0.4, fontSize: 12, color: MUTED });
txt(s, [
  { text: "Robustness", options: { bold: true, fontSize: 20, fontFace: "Cambria", breakLine: true } },
  { text: "Substituting tokens hurts every model more than dropping them", options: { bullet: true, breakLine: true } },
  { text: "DIFF is the most robust; 12-layer MLM is the least robust to dropping", options: { bullet: true, breakLine: true } },
  { text: "AR is sensitive to noise", options: { bullet: true, breakLine: true } },
  { text: " ", options: { fontSize: 8, breakLine: true } },
  { text: "Calibration", options: { bold: true, fontSize: 20, fontFace: "Cambria", breakLine: true } },
  { text: "ENC is well calibrated at every size", options: { bullet: true, breakLine: true } },
  { text: "MLM is only as good once data is plentiful", options: { bullet: true, breakLine: true } },
  { text: "DIFF gives no usable probabilities, so it has no ECE", options: { bullet: true } },
], { x: 7.55, y: 1.5, w: 5.15, h: 5.0, fontSize: 16 });
s.addNotes("Their robustness metric is the minimum noise level that degrades F1 by a given percentage relative to the model's peak, averaged over datasets, at full data, for 6 and 12 layers. Ours (later) is a single 30% level at n = 2,048: not the same measurement.");

// ================================================================== 8. recommendations
s = slide("CONTENT", "The paper");
s.addText("The paper's practical advice", { placeholder: "title" });
const recs = [
  ["Fast inference needed", "ENC", "Small 1-layer ENC: efficient, robust to noise, well-calibrated and ordinal outputs."],
  ["Plenty of labelled data, offline", "MLM", "12-layer MLM: best F1, calibration and ordinality. Careful with noisy input."],
  ["Little labelled data", "DIFF", "AR or DIFF. DIFF is more robust to noise and strongest at 6 layers, but slow at inference (20 to 100 times ENC)."],
  ["Calibrated probabilities needed", "AR", "Among generative models, AR: better calibrated than AR_pseudo in 7 of 9 datasets at low data."],
];
recs.forEach(([h, m, body], i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 1.5 + Math.floor(i / 2) * 2.6;
  card(s, x, y, 5.95, 2.4, TINT, `rec ${i}`);
  chip(s, x + 0.25, y + 0.25, m, 1.45);
  txt(s, h, { x: x + 1.9, y: y + 0.2, w: 3.9, h: 0.55, fontSize: 19, bold: true, valign: "middle" });
  txt(s, body, { x: x + 0.25, y: y + 0.85, w: 5.5, h: 1.45, fontSize: 16 });
});
s.addNotes("Section 6 and Table 1 of the paper.");

// ================================================================== 9. critique
pres.addSection({ title: "Critical discussion" });
s = slide("CONTENT", "Critical discussion");
s.addText("Limitations the paper does not state", { placeholder: "title" });
const lims = [
  ["Checkpoints chosen on the test set", "In the released code, ENC, MLM and AR are validated on the test split (their comment: “for illustration purposes only”). If the paper's runs did the same, scores are optimistic."],
  ["Unequal training budgets", "Appendix B: ENC 30 epochs, MLM 200, AR up to 100. The code sets 200, 200 and 500. Gaps may partly reflect training budget, not the approach."],
  ["Paper text and code disagree", "MLM template (“The label is” vs “Label:”) and AR scoring (log P(X | y) vs mean loss over label and text, which adds a learned class prior)."],
  ["No significance tests", "Three seeds and shaded standard deviations only. Many curves overlap, so several “wins” may be within noise."],
  ["Narrow evaluation data", "Short English texts, mostly sentiment. SST-2 is scored on its 872-sentence dev set. Noise is synthetic, at full data only."],
  ["Gaps in the comparison", "DIFF, recommended for low data, has no calibration numbers. The pretrained check covers only ENC vs AR."],
];
lims.forEach(([h, body], i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 1.45 + Math.floor(i / 2) * 1.78;
  card(s, x, y, 5.95, 1.62, TINT, `limit ${i}`);
  txt(s, [{ text: `${i + 1}. ${h}`, options: { bold: true, fontSize: 17, breakLine: true } }, { text: body, options: { fontSize: 15, color: "3A3D47" } }], { x: x + 0.18, y: y + 0.1, w: 5.6, h: 1.45 });
});
s.addNotes("Items 1 to 3 come from reading the released code (github.com/amazon-science/Generative-vs-Discriminative-Classifiers; files encoder_mlm/mlm_classif_seed_fixed.py, ar/train_gpt.py, ar_pseudo/train_gpt.py). Say 'the released code does X'; we cannot know whether the paper's numbers were produced by exactly this code.");

// ================================================================== 10. open problems
s = slide("CONTENT", "Critical discussion");
s.addText("Open problems and future work", { placeholder: "title" });
const fut = [
  ["Compute-matched comparison", "Give every model the same training budget and tuning, then re-ask the question."],
  ["Real shifts, real noise", "Distribution shift, typos and OCR errors instead of random token edits."],
  ["Pretrained MLM and diffusion classifiers", "Does MLM still win at high data when it starts from pretrained weights?"],
  ["Fix AR_pseudo's weak label signal", "The label is one token out of dozens in its loss; up-weighting it is a one-line change."],
  ["Hybrid models and theory", "Generative and discriminative heads on one backbone; an explanation for why depth flips the result."],
];
fut.forEach(([h, body], i) => {
  const y = 1.5 + i * 1.04;
  s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.1, w: 0.52, h: 0.52, fill: { color: MODEL.AR }, line: { color: MODEL.AR }, objectName: `future ${i}` });
  s.addText(String(i + 1), { x: 0.6, y: y + 0.1, w: 0.52, h: 0.52, isTextBox: true, align: "center", valign: "middle", fontSize: 17, bold: true, color: "FFFFFF", margin: 0 });
  txt(s, [{ text: h, options: { bold: true, fontSize: 18, breakLine: true } }, { text: body, options: { fontSize: 16, color: MUTED } }], { x: 1.35, y, w: 11.35, h: 0.98 });
});

// ================================================================== 11. section: reproduction
pres.addSection({ title: "Our reproduction" });
s = slide("SECTION_DARK", "Our reproduction");
s.addText("Our reproduction", { placeholder: "title" });
s.addText("Four classifiers, one small transformer, trained from scratch on CPU", { placeholder: "body" });

// ================================================================== 12. scope
s = slide("CONTENT", "Our reproduction");
s.addText("What we built, and what we cut", { placeholder: "title" });
const sc = (t, o = {}) => tb(t, Object.assign({ fontSize: 14 }, o));
s.addTable([
  [sc("", hdr), sc("Paper", hdr), sc("Ours", hdr)],
  [sc("Models", { bold: true }), sc("ENC, MLM, AR, AR_pseudo, DIFF"), sc("ENC, MLM, AR, AR_pseudo (no DIFF: too slow on CPU)")],
  [sc("Size", { bold: true }), sc("1, 6, 12 layers; hidden 64 to 768"), sc("1 and 4 layers; hidden 128, 4 heads")],
  [sc("Tokens", { bold: true }), sc("WordPiece / GPT-2 BPE, up to 512 tokens"), sc("3,000 most frequent words, first 40 tokens")],
  [sc("Data", { bold: true }), sc("9 datasets; 128 examples up to the full set"), sc("AG News and SST-2; n = 128, 512, 2,048")],
  [sc("Training", { bold: true }), sc("Grid search per model; 30 to 500 epochs; 3 seeds"), sc("One learning rate (0.001); 12 to 40 epochs; 2 seeds")],
  [sc("Checkpoint", { bold: true }), sc("Test split (released code)"), sc("200 held-out training examples; test used once")],
  [sc("Noise", { bold: true }), sc("Sweep of noise levels, full data, 6 and 12 layers"), sc("One level (30%), n = 2,048, 500 test examples")],
], { x: 0.6, y: 1.45, w: 12.1, colW: [1.7, 4.8, 5.6], rowH: 0.56, border: { type: "solid", color: LINE, pt: 1 }, fill: { color: "FFFFFF" } });
txt(s, "96 runs in about 2 CPU-hours. The mechanisms are faithful; the scale is not.", { x: 0.6, y: 6.1, w: 12.1, h: 0.5, fontSize: 17, bold: true, color: NAVY });
s.addNotes("Why these cuts: CPU only, two cores. DIFF needs 200K iterations in the paper. Everything else keeps the mechanism: same four objectives and prediction rules, same weighted-F1, ECE and token-noise definitions.");

// ================================================================== 13. differences
s = slide("CONTENT", "Our reproduction");
s.addText("Where our models differ from the paper and its code", { placeholder: "title" });
const diffRows = [
  ["AR", "Matches the paper's text: score log P(text | y), uniform prior.", "Differs from the code, which scores label + text with a mean loss. So our AR probabilities are sharper, and our AR ECE is not comparable to theirs."],
  ["MLM", "Template “the label is [MASK]” as in the paper.", "Differs from both: we mask the label slot in every training example; the paper masks it only when it falls in the random 15%. Our MLM gets a stronger label signal."],
  ["AR_pseudo", "Label after the text, read out over label tokens.", "No “label:” cue word before the label (the code has one)."],
  ["All", "Same backbone and optimiser for every model.", "Labels are dedicated vocabulary tokens, not words."],
];
diffRows.forEach(([m, same, diff], i) => {
  const y = 1.85 + i * 1.12;
  if (m === "All") chip(s, 0.6, y + 0.12, "DIFF", 1.45, 0.42, 14, "All models"); else chip(s, 0.6, y + 0.12, m, 1.45);
  txt(s, same, { x: 2.25, y, w: 4.1, h: 1.05, fontSize: 15 });
  txt(s, diff, { x: 6.55, y, w: 6.15, h: 1.05, fontSize: 15, color: "3A3D47" });
});
txt(s, "Same as the paper", { x: 2.25, y: 1.42, w: 4.1, h: 0.4, fontSize: 13, bold: true, color: MUTED });
txt(s, "Different", { x: 6.55, y: 1.42, w: 6.15, h: 0.4, fontSize: 13, bold: true, color: MUTED });
txt(s, "We kept these choices on purpose and report them; changing them would be a separate reproduction.", { x: 0.6, y: 6.35, w: 12.1, h: 0.45, fontSize: 15, color: MUTED });

// ================================================================== 14. AG News F1
const ag = (L, n, m) => F1("agnews", L, n, m);
s = slide("CONTENT", "Our reproduction");
s.addText("AG News: AR pulls ahead as the data grows", { placeholder: "title" });
figure(s, "f1_ag.png", 1.4, [
  { text: "4 layers, n = 2,048: ", options: { bold: true } },
  { text: `AR ${f3(ag(4, 2048, "AR"))}, ENC ${f3(ag(4, 2048, "ENC"))}, MLM ${f3(ag(4, 2048, "MLM"))}, AR_pseudo ${f3(ag(4, 2048, "AR_pseudo"))}. ` },
  { text: `At n = 128 AR and ENC are tied (${f3(ag(4, 128, "AR"))} vs ${f3(ag(4, 128, "ENC"))}). Bars show the spread over 2 seeds; chance = 0.25.` },
]);
s.addNotes(`AR at n = 512 is seed-dependent: seed 0 gives ENC ${f3(seedRow("agnews", 4, 512, "ENC", 0).wf1)} vs AR ${f3(seedRow("agnews", 4, 512, "AR", 0).wf1)}; seed 1 gives AR the lead. Do not claim AR wins at 512 in every seed.`);

// ================================================================== 15. SST-2 F1
const ss = (L, n, m) => F1("sst2", L, n, m);
const sstBest = Math.max(...[1, 4].flatMap((L) => [128, 512, 2048].flatMap((n) => ["ENC", "MLM", "AR", "AR_pseudo"].map((m) => ss(L, n, m)))));
s = slide("CONTENT", "Our reproduction");
s.addText("SST-2: a weak signal, and ENC and AR tie", { placeholder: "title" });
figure(s, "f1_sst.png", 1.4, [
  { text: `Best result ${f3(sstBest)} (chance 0.5). `, options: { bold: true } },
  { text: `At 4 layers, n = 2,048: ENC ${f3(ss(4, 2048, "ENC"))}, AR ${f3(ss(4, 2048, "AR"))}; MLM stays at chance. Differences are mostly within seed noise, so SST-2 tells us little at this scale. Scored on the official 1,821-sentence test set.` },
]);
s.addNotes("Why so weak: 40 word-level tokens and a 3,000-word vocabulary lose much of the sentiment signal (negation, rare words), and 2,048 examples is small for a from-scratch model. The paper scores SST-2 on the 872-sentence dev set; we use the official test set and keep dev unused.");

// ================================================================== 16. calibration
s = slide("CONTENT", "Our reproduction");
s.addText("Calibration: our ENC is the worst, unlike the paper's", { placeholder: "title" });
figure(s, "ece.png", 1.4, [
  { text: "AG News, 4 layers, n = 2,048 (ECE, lower is better): ", options: { bold: true } },
  { text: `ENC ${f3(ECE("agnews", 4, 2048, "ENC"))}, AR ${f3(ECE("agnews", 4, 2048, "AR"))}, MLM ${f3(ECE("agnews", 4, 2048, "MLM"))}, AR_pseudo ${f3(ECE("agnews", 4, 2048, "AR_pseudo"))}. ` },
  { text: "Caution: a model near chance can get a low ECE just by being unsure, as AR_pseudo does here." },
]);
s.addNotes("Likely cause (untested): ENC is over-confident from a high learning rate and many epochs on tiny data. Our AR ECE is not comparable to the paper's because its probabilities come from the sum of log-likelihoods, which is much sharper than the authors' mean-loss scores.");

// ================================================================== 17. robustness
s = slide("CONTENT", "Our reproduction");
s.addText("Robustness: dropping tokens hurts our MLM most", { placeholder: "title" });
const R = (f, m) => pc(f("agnews", 4, 2048, m));
figure(s, "noise.png", 1.4, [
  { text: "F1 lost with 30% of tokens dropped / substituted: ", options: { bold: true } },
  { text: `ENC ${R(DROP, "ENC")} / ${R(SUB, "ENC")}, MLM ${R(DROP, "MLM")} / ${R(SUB, "MLM")}, AR ${R(DROP, "AR")} / ${R(SUB, "AR")}, AR_pseudo ${R(DROP, "AR_pseudo")} / ${R(SUB, "AR_pseudo")}. ` },
  { text: "Clean and noisy F1 on the same 500 test examples." },
]);
s.addNotes("Hypothesis, untested: dropping tokens moves the label slot to an earlier position in the sequence, which MLM and AR_pseudo read the label from; substitution keeps the length. That would explain why they suffer more from dropping than from substitution, the opposite of the paper's finding for all models.");

// ================================================================== 18. comparison table
s = slide("CONTENT", "Our reproduction");
s.addText("Paper vs us, claim by claim", { placeholder: "title" });
const v = (t) => tb(t, { bold: true, color: VERDICT[t] });
const cmp = [
  ["Generative wins at low data, gap shrinks with data (12 layers)", `Tie at n = 128; gap grows to ${f3(ag(4, 2048, "AR"))} vs ${f3(ag(4, 2048, "ENC"))} at 2,048 (4 layers)`, "Not reproduced"],
  ["1 layer: only ENC keeps improving, best at high data", `AR ${f3(ag(1, 2048, "AR"))} vs ENC ${f3(ag(1, 2048, "ENC"))} at 2,048; our n stops before “high data”`, "Can't test"],
  ["AR_pseudo is weaker than AR with little data", `AR_pseudo far below AR at every n (best ${f3(ag(4, 2048, "AR_pseudo"))} vs AR ${f3(ag(4, 2048, "AR"))})`, "Reproduced"],
  ["MLM is best at high data (12 layers)", `MLM ${f3(ag(4, 2048, "MLM"))}, well below AR and ENC`, "Not reproduced"],
  ["ENC is well calibrated", `ENC has the highest ECE (${f3(ECE("agnews", 4, 2048, "ENC"))})`, "Not reproduced"],
  ["MLM is least robust to dropped tokens", `MLM loses ${R(DROP, "MLM")}, the most of any model`, "Reproduced"],
  ["Substitution hurts more than dropping, all models", "True for ENC and AR, not for MLM and AR_pseudo", "Partly"],
  ["AR is sensitive to noise", `AR loses ${R(DROP, "AR")} / ${R(SUB, "AR")} (ENC ${R(DROP, "ENC")} / ${R(SUB, "ENC")}); different metric`, "Not reproduced"],
];
s.addTable([[tb("Paper's claim", hdr), tb("Our result (AG News)", hdr), tb("Verdict", hdr)], ...cmp.map(([a, b, c]) => [tb(a), tb(b), v(c)])],
  { x: 0.6, y: 1.45, w: 12.1, colW: [5.0, 5.2, 1.9], rowH: 0.56, border: { type: "solid", color: LINE, pt: 1 }, fill: { color: "FFFFFF" } });
s.addNotes("Most likely reason for the 'not reproduced' rows: our scale (4 layers, n up to 2,048) and our short single-learning-rate training, which probably leaves ENC under-tuned. We have not run an ablation to confirm this, so say 'likely', not 'because'.");

// ================================================================== 19. live demo
s = slide("CONTENT", "Our reproduction");
s.addText("Live demo: one cell of the grid, trained live", { placeholder: "title" });
card(s, 0.6, 1.5, 12.1, 1.15, "1F2230", "command");
txt(s, [{ text: "python repro.py --dataset agnews --layers 4 --sizes 2048 \\", options: { breakLine: true } }, { text: "    --seeds 0 --models ENC AR --out /tmp/demo.jsonl" }],
  { x: 0.85, y: 1.6, w: 11.6, h: 0.95, fontFace: "Courier New", fontSize: 14, color: "FFFFFF", valign: "middle" });
const d = (m) => seedRow("agnews", 4, 2048, m, 0);
s.addTable([
  [tb("Expected (deterministic)", hdr), tb("weighted-F1", hdr), tb("ECE", hdr), tb("30% dropped", hdr), tb("30% substituted", hdr)],
  [modelCell("ENC"), tb(f3(d("ENC").wf1)), tb(f3(d("ENC").ece)), tb(f3(d("ENC").drop30)), tb(f3(d("ENC").sub30))],
  [modelCell("AR"), tb(f3(d("AR").wf1)), tb(f3(d("AR").ece)), tb(f3(d("AR").drop30)), tb(f3(d("AR").sub30))],
], { x: 0.6, y: 2.95, w: 7.4, colW: [2.4, 1.3, 1.0, 1.3, 1.4], rowH: 0.55, border: { type: "solid", color: LINE, pt: 1 }, fill: { color: "FFFFFF" } });
txt(s, [
  { text: "What it shows", options: { bold: true, fontSize: 19, breakLine: true } },
  { text: "AR beats ENC on F1 and is better calibrated, from 2,048 examples", options: { bullet: true, breakLine: true } },
  { text: "About 7 minutes on one CPU core: start it at the beginning of the talk", options: { bullet: true, breakLine: true } },
  { text: "Fallback: demo/expected_output_n2048.txt (output of this exact command)", options: { bullet: true } },
], { x: 8.3, y: 2.9, w: 4.4, h: 3.3, fontSize: 16 });
txt(s, "Same code and seed as our stored grid, so the numbers should match to three decimals.", { x: 0.6, y: 4.85, w: 7.4, h: 0.8, fontSize: 15, color: MUTED });

// ================================================================== 20. close
pres.addSection({ title: "Close" });
s = slide("CLOSE_DARK", "Close");
s.addText("Takeaways", { placeholder: "title" });
s.addText([
  { text: "The paper: the generative vs discriminative trade-off depends on model size; there is no single rule.", options: { bullet: true, breakLine: true } },
  { text: "Our runs: AR is the strongest model on AG News at our scale, but the paper's size-dependent pattern did not reproduce at 1 and 4 layers.", options: { bullet: true, breakLine: true } },
  { text: "Our caveat: small models, short training and one learning rate; several gaps are within seed noise.", options: { bullet: true, breakLine: true } },
  { text: "With more compute: 6 and 12 layers, DIFF, subword tokens, per-model tuning, 3 seeds and equal training budgets.", options: { bullet: true } },
], { placeholder: "body", paraSpaceAfter: 14 });

(async () => {
  await pres.writeFile({ fileName: OUT });
  if (SKILL) {
    const { applyTheme } = require(path.join(SKILL, "scripts", "apply_theme.js"));
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
})();
