// Bayes + expected cost decision + Monte Carlo.
// This is a toy model for intuition. No tactical claims.

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function fmtPct(x) { return (100 * x).toFixed(2) + "%"; }
function fmtInt(x) { return Math.round(x).toLocaleString(); }
function fmtNum(x) { return Number(x).toLocaleString(); }

const els = {
  pT: document.getElementById("pT"),
  pE_T: document.getElementById("pE_T"),
  pE_D: document.getElementById("pE_D"),
  cShot: document.getElementById("cShot"),
  cHit: document.getElementById("cHit"),
  scarcity: document.getElementById("scarcity"),
  trials: document.getElementById("trials"),
  noise: document.getElementById("noise"),

  pTVal: document.getElementById("pTVal"),
  pE_TVal: document.getElementById("pE_TVal"),
  pE_DVal: document.getElementById("pE_DVal"),
  cShotVal: document.getElementById("cShotVal"),
  cHitVal: document.getElementById("cHitVal"),
  scarcityVal: document.getElementById("scarcityVal"),
  trialsVal: document.getElementById("trialsVal"),
  noiseVal: document.getElementById("noiseVal"),

  posterior: document.getElementById("posterior"),
  threshold: document.getElementById("threshold"),
  decision: document.getElementById("decision"),

  numVal: document.getElementById("numVal"),
  denVal: document.getElementById("denVal"),

  runBtn: document.getElementById("runBtn"),
  resetBtn: document.getElementById("resetBtn"),

  mcShots: document.getElementById("mcShots"),
  mcShotsPct: document.getElementById("mcShotsPct"),
  mcWaste: document.getElementById("mcWaste"),
  mcWastePct: document.getElementById("mcWastePct"),
  mcStops: document.getElementById("mcStops"),
  mcStopsPct: document.getElementById("mcStopsPct"),
  mcHits: document.getElementById("mcHits"),
  mcHitsPct: document.getElementById("mcHitsPct"),
  mcSummary: document.getElementById("mcSummary"),
};

function bayesPosterior(pT, pE_T, pE_D) {
  const pD = 1 - pT;
  const num = pE_T * pT;
  const den = (pE_T * pT) + (pE_D * pD);
  const post = den > 0 ? (num / den) : 0;
  return { post, num, den };
}

function decisionEngage(posterior, cShot, cHit, scarcity) {
  const effectiveShot = cShot * scarcity;
  // Engage if expected hold loss > engage loss.
  const holdLoss = posterior * cHit;
  const engageLoss = effectiveShot;
  return { engage: (holdLoss > engageLoss), holdLoss, engageLoss };
}

// Small helper to generate a noisy log-likelihood ratio around the "base" LR.
// LR = P(E|T)/P(E|D). noise controls spread.
function sampleLikelihoodRatio(baseLR, noise) {
  // lognormal noise: LR' = baseLR * exp(N(0, noise))
  const z = randn();
  return baseLR * Math.exp(z * noise);
}

// Standard normal (Box-Muller)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Given prior odds and an LR, compute posterior probability.
function posteriorFromOdds(priorP, lr) {
  const priorOdds = priorP / (1 - priorP);
  const postOdds = priorOdds * lr;
  return postOdds / (1 + postOdds);
}

function recomputeBayesPanel() {
  const pT = parseFloat(els.pT.value);
  const pE_T = parseFloat(els.pE_T.value);
  const pE_D = parseFloat(els.pE_D.value);
  const cShot = parseFloat(els.cShot.value);
  const cHit = parseFloat(els.cHit.value);
  const scarcity = parseFloat(els.scarcity.value);

  const { post, num, den } = bayesPosterior(pT, pE_T, pE_D);
  const thr = (cShot * scarcity) / cHit;

  const dec = decisionEngage(post, cShot, cHit, scarcity);

  // Update labels
  els.pTVal.textContent = fmtPct(pT);
  els.pE_TVal.textContent = fmtPct(pE_T);
  els.pE_DVal.textContent = fmtPct(pE_D);
  els.cShotVal.textContent = fmtNum(cShot);
  els.cHitVal.textContent = fmtNum(cHit);
  els.scarcityVal.textContent = scarcity.toFixed(1) + "×";
  els.trialsVal.textContent = fmtInt(parseFloat(els.trials.value));
  els.noiseVal.textContent = parseFloat(els.noise.value).toFixed(2);

  els.posterior.textContent = fmtPct(post);
  els.threshold.textContent = fmtPct(clamp01(thr));

  els.numVal.textContent = num.toFixed(6);
  els.denVal.textContent = den.toFixed(6);

  if (dec.engage) {
    els.decision.innerHTML =
      `<span style="color: var(--good);">ENGAGE</span>
       <span class="mono">(hold loss ≈ ${fmtNum(dec.holdLoss.toFixed(0))} vs shot ≈ ${fmtNum(dec.engageLoss.toFixed(0))})</span>`;
  } else {
    els.decision.innerHTML =
      `<span style="color: var(--warn);">HOLD</span>
       <span class="mono">(hold loss ≈ ${fmtNum(dec.holdLoss.toFixed(0))} vs shot ≈ ${fmtNum(dec.engageLoss.toFixed(0))})</span>`;
  }

  return { pT, pE_T, pE_D, cShot, cHit, scarcity };
}

function resetMCDisplay() {
  els.mcShots.textContent = "—";
  els.mcShotsPct.textContent = "";
  els.mcWaste.textContent = "—";
  els.mcWastePct.textContent = "";
  els.mcStops.textContent = "—";
  els.mcStopsPct.textContent = "";
  els.mcHits.textContent = "—";
  els.mcHitsPct.textContent = "";
  els.mcSummary.textContent = "";
}

function runMonteCarlo() {
  const { pT, pE_T, pE_D, cShot, cHit, scarcity } = recomputeBayesPanel();
  const trials = parseInt(els.trials.value, 10);
  const noise = parseFloat(els.noise.value);

  // Base likelihood ratio implied by the "evidence" slider parameters.
  // This is a stylized, single-evidence event model.
  const baseLR = (pE_T / pE_D);

  // Decision threshold in posterior probability
  const thresholdP = (cShot * scarcity) / cHit;

  let shots = 0;
  let wasted = 0;   // decoys shot
  let stops = 0;    // threats engaged
  let hits = 0;     // threats not engaged

  for (let i = 0; i < trials; i++) {
    const isThreat = (Math.random() < pT);

    // Generate a noisy LR around baseLR
    const lr = sampleLikelihoodRatio(baseLR, noise);

    // Compute posterior for this track
    const post = posteriorFromOdds(pT, lr);

    // Engage decision
    const engage = (post > thresholdP);

    if (engage) {
      shots++;
      if (isThreat) stops++;
      else wasted++;
    } else {
      if (isThreat) hits++;
    }
  }

  const shotsPct = shots / trials;
  const wastePctOfShots = shots > 0 ? (wasted / shots) : 0;
  const hitRate = hits / trials;

  els.mcShots.textContent = fmtInt(shots);
  els.mcShotsPct.textContent = fmtPct(shotsPct) + " of tracks";

  els.mcWaste.textContent = fmtInt(wasted);
  els.mcWastePct.textContent = shots > 0
    ? fmtPct(wastePctOfShots) + " of shots"
    : "—";

  els.mcStops.textContent = fmtInt(stops);
  els.mcStopsPct.textContent = fmtPct(stops / trials) + " of tracks";

  els.mcHits.textContent = fmtInt(hits);
  els.mcHitsPct.textContent = fmtPct(hitRate) + " of tracks";

  // Expected cost comparison (toy)
  const effectiveShot = cShot * scarcity;
  const totalShotCost = shots * effectiveShot;
  const totalHitCost = hits * cHit;
  const totalCost = totalShotCost + totalHitCost;

  els.mcSummary.textContent =
    `Toy costs: shots×(Cshot×scarcity) = ${fmtNum(totalShotCost.toFixed(0))}, ` +
    `hits×Chit = ${fmtNum(totalHitCost.toFixed(0))}, total = ${fmtNum(totalCost.toFixed(0))}. ` +
    `Waste per shot = ${fmtPct(wastePctOfShots)}.`;

  return { shots, wasted, stops, hits };
}

function wireEvents() {
  const live = () => { recomputeBayesPanel(); };
  ["pT","pE_T","pE_D","cShot","cHit","scarcity","trials","noise"].forEach(id => {
    els[id].addEventListener("input", live);
  });

  els.runBtn.addEventListener("click", () => {
    // Keep UI responsive for big trials by yielding occasionally
    // but we keep it simple and fast enough for 50k.
    runMonteCarlo();
  });

  els.resetBtn.addEventListener("click", () => {
    els.pT.value = "0.05";
    els.pE_T.value = "0.80";
    els.pE_D.value = "0.30";
    els.cShot.value = "25";
    els.cHit.value = "5000";
    els.scarcity.value = "1";
    els.trials.value = "10000";
    els.noise.value = "0.60";
    recomputeBayesPanel();
    resetMCDisplay();
  });
}

recomputeBayesPanel();
resetMCDisplay();
wireEvents();
