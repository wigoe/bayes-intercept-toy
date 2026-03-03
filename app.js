// Bayes + expected cost decision + Monte Carlo.
// This is a toy model for intuition. No tactical claims.

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function fmtPct(x) { return (100 * x).toFixed(2) + "%"; }
function fmtInt(x) { return Math.round(x).toLocaleString(); }
function fmtNum(x) { return Number(x).toLocaleString(); }

const els = {
  // Inputs
  pT: document.getElementById("pT"),
  pE_T: document.getElementById("pE_T"),
  pE_D: document.getElementById("pE_D"),
  cShot: document.getElementById("cShot"),
  cHit: document.getElementById("cHit"),
  scarcity: document.getElementById("scarcity"),
  trials: document.getElementById("trials"),
  magazine: document.getElementById("magazine"),
  noise: document.getElementById("noise"),

  // Input value labels
  pTVal: document.getElementById("pTVal"),
  pE_TVal: document.getElementById("pE_TVal"),
  pE_DVal: document.getElementById("pE_DVal"),
  cShotVal: document.getElementById("cShotVal"),
  cHitVal: document.getElementById("cHitVal"),
  scarcityVal: document.getElementById("scarcityVal"),
  trialsVal: document.getElementById("trialsVal"),
  magazineVal: document.getElementById("magazineVal"),
  noiseVal: document.getElementById("noiseVal"),

  // Bayes panel
  posterior: document.getElementById("posterior"),
  threshold: document.getElementById("threshold"),
  decision: document.getElementById("decision"),
  numVal: document.getElementById("numVal"),
  denVal: document.getElementById("denVal"),

  // Buttons
  runBtn: document.getElementById("runBtn"),
  resetBtn: document.getElementById("resetBtn"),

  // Monte Carlo outputs
  mcShots: document.getElementById("mcShots"),
  mcShotsPct: document.getElementById("mcShotsPct"),
  mcWaste: document.getElementById("mcWaste"),
  mcWastePct: document.getElementById("mcWastePct"),
  mcStops: document.getElementById("mcStops"),
  mcStopsPct: document.getElementById("mcStopsPct"),
  mcHits: document.getElementById("mcHits"),
  mcHitsPct: document.getElementById("mcHitsPct"),
  mcDeplete: document.getElementById("mcDeplete"),
  mcDepleteNote: document.getElementById("mcDepleteNote"),
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
  const holdLoss = posterior * cHit;
  const engageLoss = effectiveShot;
  return { engage: (holdLoss > engageLoss), holdLoss, engageLoss };
}

// lognormal noise around base LR
function sampleLikelihoodRatio(baseLR, noise) {
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

// odds form
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
  const trials = parseInt(els.trials.value, 10);
  const magazine = parseInt(els.magazine.value, 10);
  const noise = parseFloat(els.noise.value);

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
  els.trialsVal.textContent = fmtInt(trials);
  els.magazineVal.textContent = fmtInt(magazine);
  els.noiseVal.textContent = noise.toFixed(2);

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

  return { pT, pE_T, pE_D, cShot, cHit, scarcity, trials, magazine, noise };
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
  els.mcDeplete.textContent = "—";
  els.mcDepleteNote.textContent = "";
  els.mcSummary.textContent = "";
}

function runMonteCarlo() {
  const { pT, pE_T, pE_D, cShot, cHit, scarcity, trials, magazine, noise } = recomputeBayesPanel();

  const baseLR = (pE_T / pE_D);
  const thresholdP = (cShot * scarcity) / cHit;

  let remaining = magazine;
  let ranOutAt = null;

  let shots = 0;
  let wasted = 0;
  let stops = 0;
  let hits = 0;

  for (let i = 0; i < trials; i++) {
    const isThreat = (Math.random() < pT);
    const lr = sampleLikelihoodRatio(baseLR, noise);
    const post = posteriorFromOdds(pT, lr);
    const engage = (post > thresholdP);

    if (engage && remaining > 0) {
      remaining--;
      shots++;
      if (isThreat) stops++;
      else wasted++;
      if (remaining === 0 && ranOutAt === null) ranOutAt = i + 1;
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
  els.mcWastePct.textContent = shots > 0 ? fmtPct(wastePctOfShots) + " of shots" : "—";

  els.mcStops.textContent = fmtInt(stops);
  els.mcStopsPct.textContent = fmtPct(stops / trials) + " of tracks";

  els.mcHits.textContent = fmtInt(hits);
  els.mcHitsPct.textContent = fmtPct(hitRate) + " of tracks";

  if (ranOutAt === null) {
    els.mcDeplete.textContent = "No";
    els.mcDepleteNote.textContent = `${fmtInt(remaining)} remaining`;
  } else {
    els.mcDeplete.textContent = "Yes";
    els.mcDepleteNote.textContent = `Ran out at track ${fmtInt(ranOutAt)} (0 remaining)`;
  }

  const effectiveShot = cShot * scarcity;
  const totalShotCost = shots * effectiveShot;
  const totalHitCost = hits * cHit;
  const totalCost = totalShotCost + totalHitCost;

  els.mcSummary.textContent =
    `Toy costs: shots×(Cshot×scarcity) = ${fmtNum(totalShotCost.toFixed(0))}, ` +
    `hits×Chit = ${fmtNum(totalHitCost.toFixed(0))}, total = ${fmtNum(totalCost.toFixed(0))}. ` +
    `Waste per shot = ${fmtPct(wastePctOfShots)}.`;

  return { shots, wasted, stops, hits, remaining, ranOutAt };
}

function wireEvents() {
  const live = () => { recomputeBayesPanel(); };

  ["pT","pE_T","pE_D","cShot","cHit","scarcity","trials","magazine","noise"].forEach(id => {
    els[id].addEventListener("input", live);
  });

  els.runBtn.addEventListener("click", () => runMonteCarlo());

  els.resetBtn.addEventListener("click", () => {
    els.pT.value = "0.05";
    els.pE_T.value = "0.80";
    els.pE_D.value = "0.30";
    els.cShot.value = "25";
    els.cHit.value = "5000";
    els.scarcity.value = "1";
    els.trials.value = "10000";
    els.magazine.value = "300";
    els.noise.value = "0.60";
    recomputeBayesPanel();
    resetMCDisplay();
  });
}

// init
recomputeBayesPanel();
resetMCDisplay();
wireEvents();
