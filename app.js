/* FB4 Fragen-Trainer – vanilla JS, no build step */

const state = {
  all: [],
  pool: [],
  idx: 0,
  mode: "practice",
  showCorrect: true,
  autoAdvance: false,
  answersGiven: new Map(), // qid -> {selectedOriginalIndex, isCorrect, shownAnswers:[{text, originalIndex}]}
};

const el = (id) => document.getElementById(id);

// ----------------------------
// Cookie consent (EU/DSGVO) – no tracking
// ----------------------------
const CONSENT_KEY = "fb4_consent_v1";
// Variant B: remember banner was seen (so it won't reappear)
const BANNER_SEEN_KEY = "fb4_banner_seen_v1";
// consent = { decided: boolean, prefs: boolean, ts: number }

function readConsent(){
  const raw = localStorage.getItem(CONSENT_KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeConsent(consent){
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

function hasPrefsConsent(){
  const c = readConsent();
  return !!(c && c.decided && c.prefs);
}

// ----------------------------
// Subjects / Labels
// ----------------------------
function inferSubject(qid){
  // qid like "4 C.6.12" -> subject = "C"
  const m = qid.match(/^\d+\s+([A-Z])\./);
  return m ? m[1] : "ALL";
}

const SUBJECT_LABELS = {
  A: "A – Jachtbedienung & Jachtführung",
  B: "B – Jachtbau & Schiffstechnik",
  C: "C – Navigation",
  E: "E – Wetterkunde",
  F: "F – Sicherheit & Notfälle",
};

function uniqSubjects(items){
  const s = new Set(items.map(q => inferSubject(q.id)));
  return ["ALL", ...Array.from(s).sort()];
}

// ----------------------------
// Shuffle helpers
// ----------------------------
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

/**
 * Returns a shuffled list of answers with their original indices preserved.
 * Example return: [{text:"...", originalIndex:2}, ...]
 */
function getShuffledAnswers(q){
  const items = q.answers.map((text, originalIndex) => ({ text, originalIndex }));
  return shuffle(items);
}

// ----------------------------
// Persistence: cookie (settings) + localStorage (session)
// (only after prefs consent)
// ----------------------------
const COOKIE_NAME = "fb4_settings_v1";
const SESSION_NAME = "fb4_session_v1";

function setCookie(name, value, days = 365){
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function getCookie(name){
  const needle = encodeURIComponent(name) + "=";
  const parts = document.cookie.split("; ");
  for(const p of parts){
    if(p.startsWith(needle)) return decodeURIComponent(p.substring(needle.length));
  }
  return null;
}

function deleteCookie(name){
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function saveSettingsToCookie(){
  if(!hasPrefsConsent()) return;

  const payload = {
    showCorrect: el("showCorrect")?.value ?? (state.showCorrect ? "yes" : "no"),
    autoAdvance: el("autoAdvance")?.value ?? (state.autoAdvance ? "yes" : "no"),
    mode: el("mode")?.value ?? state.mode,
    order: el("order")?.value ?? "shuffle",
    limit: el("limit")?.value ?? "30",
    filter: el("filter")?.value ?? "ALL",
  };
  setCookie(COOKIE_NAME, JSON.stringify(payload), 365);
}

function loadSettingsFromCookie(){
  if(!hasPrefsConsent()) return null;

  const raw = getCookie(COOKIE_NAME);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveSession(){
  if(!hasPrefsConsent()) return;

  const payload = {
    active: !el("panelQuiz").classList.contains("hidden"),
    idx: state.idx,
    mode: state.mode,
    poolIds: state.pool.map(q => q.id),
    answersGiven: Array.from(state.answersGiven.entries()), // [qid, {...}]
    // keep per-question answer order so refresh doesn't reshuffle mid-question
    shuffled: state.pool.map(q => [q.id, q._shuffledAnswers ?? null]),
  };
  localStorage.setItem(SESSION_NAME, JSON.stringify(payload));
}

function loadSession(){
  if(!hasPrefsConsent()) return null;

  const raw = localStorage.getItem(SESSION_NAME);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function clearSession(){
  localStorage.removeItem(SESSION_NAME);
}

// ----------------------------
// Settings (UI + state)
// ----------------------------
function loadSettings(){
  // defaults (no consent required; only sets in-memory + UI)
  const sc = localStorage.getItem("fb4_showCorrect");
  const aa = localStorage.getItem("fb4_autoAdvance");
  state.showCorrect = (sc ?? "yes") === "yes";
  state.autoAdvance = (aa ?? "no") === "yes";

  // cookie overrides only if consented
  const cookie = loadSettingsFromCookie();
  if(cookie){
    if(cookie.showCorrect) state.showCorrect = cookie.showCorrect === "yes";
    if(cookie.autoAdvance) state.autoAdvance = cookie.autoAdvance === "yes";
  }

  el("showCorrect").value = state.showCorrect ? "yes" : "no";
  el("autoAdvance").value = state.autoAdvance ? "yes" : "no";
}

function saveSettings(){
  // keep legacy localStorage keys (harmless)
  localStorage.setItem("fb4_showCorrect", el("showCorrect").value);
  localStorage.setItem("fb4_autoAdvance", el("autoAdvance").value);

  // bundled prefs/session only if consented
  saveSettingsToCookie();
  loadSettings();
  saveSession();
}

// ----------------------------
// UI helpers
// ----------------------------
function setVisible(panelId){
  ["panelSetup","panelQuiz","panelResults","panelSettings"].forEach(id => el(id).classList.add("hidden"));
  el(panelId).classList.remove("hidden");
}

function updateSetupMeta(){
  const total = state.all.length;
  const subj = el("filter").value;
  const pool = subj==="ALL" ? state.all : state.all.filter(q => inferSubject(q.id)===subj);
  el("setupMeta").textContent = `${pool.length} Fragen im Filter (gesamt: ${total})`;

  saveSettingsToCookie();
}

function buildPool(){
  const subj = el("filter").value;
  let pool = subj==="ALL" ? [...state.all] : state.all.filter(q => inferSubject(q.id)===subj);

  const order = el("order").value;
  if(order==="shuffle") shuffle(pool);

  const limitRaw = el("limit").value;
  const limit = Number(limitRaw);
  if(Number.isFinite(limit) && limit > 0) pool = pool.slice(0, limit);

  // remove any previously stored shuffled state so every new run reshuffles
  for(const q of pool){
    delete q._shuffledAnswers;
  }

  state.pool = pool;
  state.idx = 0;
  state.answersGiven.clear();
  state.mode = el("mode").value;

  saveSession();
}

function calcScore(){
  let correct=0, wrong=0;
  for(const v of state.answersGiven.values()){
    if(v.isCorrect) correct++; else wrong++;
  }
  const total = correct + wrong;
  const rate = total ? Math.round((correct/total)*100) : 0;
  return {correct, wrong, total, rate};
}

function renderTopbar(){
  const {correct, wrong, total, rate} = calcScore();
  el("scoreCorrect").textContent = String(correct);
  el("scoreWrong").textContent = String(wrong);
  el("scoreRate").textContent = `${rate}%`;

  const done = state.idx + 1;
  const totalQ = state.pool.length;
  el("progressText").textContent = `${done}/${totalQ}`;
  el("progressBar").style.width = `${Math.round((done/Math.max(totalQ,1))*100)}%`;

  el("btnPrev").disabled = state.idx === 0;
  el("btnNext").classList.toggle("hidden", state.idx >= totalQ-1);
  el("btnFinish").classList.toggle("hidden", state.idx < totalQ-1);
}

function clearFeedback(){
  const fb = el("feedback");
  fb.classList.add("hidden");
  fb.classList.remove("ok","bad");
  fb.textContent = "";
}

// ----------------------------
// Quiz rendering / logic
// ----------------------------
function renderQuestion(){
  if(state.pool.length===0){
    alert("Keine Fragen im Pool (Filter/Limit prüfen).");
    setVisible("panelSetup");
    return;
  }

  const q = state.pool[state.idx];
  el("qid").textContent = q.id;
  el("question").textContent = q.question;

  const answersEl = el("answers");
  answersEl.innerHTML = "";

  const answered = state.answersGiven.get(q.id);
  const inExam = state.mode === "exam";

  // Shuffle answers once per question (so navigating back/forward keeps same order)
  if(!q._shuffledAnswers){
    q._shuffledAnswers = getShuffledAnswers(q);
  }
  const shownAnswers = q._shuffledAnswers; // [{text, originalIndex}...]

  shownAnswers.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.type = "button";
    btn.textContent = a.text;

    if(answered){
      btn.disabled = true;

      if(!inExam){
        if(a.originalIndex === q.correctIndex) btn.classList.add("correct");
        if(a.originalIndex === answered.selectedOriginalIndex && !answered.isCorrect){
          btn.classList.add("wrong");
        }
      }
    }

    btn.addEventListener("click", () => onSelectAnswer(a.originalIndex));
    answersEl.appendChild(btn);
  });

  clearFeedback();
  if(answered && state.mode==="practice"){
    showPracticeFeedback(q, answered.selectedOriginalIndex);
  }

  renderTopbar();
  saveSession();
}

function showPracticeFeedback(q, selectedOriginalIndex){
  const fb = el("feedback");
  const isCorrect = selectedOriginalIndex === q.correctIndex;

  if(isCorrect){
    fb.classList.add("ok");
    fb.textContent = "✅ Richtig.";
  } else {
    fb.classList.add("bad");
    if(state.showCorrect){
      fb.textContent = `❌ Falsch. Richtige Antwort: ${q.answers[q.correctIndex]}`;
    } else {
      fb.textContent = "❌ Falsch.";
    }
  }
  fb.classList.remove("hidden");
}

function onSelectAnswer(selectedOriginalIndex){
  const q = state.pool[state.idx];
  const isCorrect = selectedOriginalIndex === q.correctIndex;

  state.answersGiven.set(q.id, {
    selectedOriginalIndex,
    isCorrect,
    shownAnswers: q._shuffledAnswers ?? null
  });

  saveSession();

  if(state.mode==="practice"){
    renderQuestion();
    if(state.autoAdvance){
      setTimeout(() => next(), 800);
    }
  } else {
    next();
  }
}

function next(){
  if(state.idx < state.pool.length-1){
    state.idx++;
    renderQuestion();
    saveSession();
  } else {
    showResults();
  }
}

function prev(){
  if(state.idx > 0){
    state.idx--;
    renderQuestion();
    saveSession();
  }
}

function showResults(){
  const {correct, wrong, total, rate} = calcScore();
  const totalQ = state.pool.length;

  const unanswered = totalQ - total;
  el("resultsSummary").innerHTML =
    `<div class="meta">Modus: <strong>${state.mode==="exam" ? "Prüfungsmodus" : "Üben"}</strong></div>
     <div style="margin-top:8px">
       <div>Richtig: <strong>${correct}</strong></div>
       <div>Falsch: <strong>${wrong}</strong></div>
       <div>Nicht beantwortet: <strong>${unanswered}</strong></div>
       <div>Quote (nur beantwortet): <strong>${rate}%</strong></div>
     </div>`;

  const wrongList = el("wrongList");
  wrongList.innerHTML = "";

  for(const q of state.pool){
    const a = state.answersGiven.get(q.id);
    if(!a || a.isCorrect) continue;

    const div = document.createElement("div");
    div.className = "wrong-item";

    const chosen = q.answers[a.selectedOriginalIndex] ?? "(keine Auswahl)";
    const correctAns = q.answers[q.correctIndex];

    div.innerHTML = `
      <div class="wqid">${q.id}</div>
      <div class="wq">${escapeHtml(q.question)}</div>
      <div class="wa">Deine Antwort: <strong>${escapeHtml(chosen)}</strong><br/>Richtig: <strong>${escapeHtml(correctAns)}</strong></div>
    `;
    wrongList.appendChild(div);
  }

  if(wrongList.children.length === 0){
    wrongList.innerHTML = `<div class="meta">Keine falschen Antworten 🎉</div>`;
  }

  setVisible("panelResults");
  saveSession();
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ----------------------------
// Cookie banner (Variant B: show once) wiring
// ----------------------------
function initCookieConsentUI(){
  const banner = el("cookieBanner");
  const checkbox = el("consentPrefs");

  // Initialize checkbox from stored consent (if settings panel exists)
  const c = readConsent();
  if(checkbox){
    checkbox.checked = !!(c && c.decided && c.prefs);
  }

  // Show banner only once until user closes it (and only if banner exists)
  const seen = localStorage.getItem(BANNER_SEEN_KEY) === "yes";
  if(banner){
    if(!seen){
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  // Open settings from banner
  el("cookieOpenSettings")?.addEventListener("click", () => {
    setVisible("panelSettings");
    banner?.classList.add("hidden");
    // also mark as seen, since user interacted with it
    localStorage.setItem(BANNER_SEEN_KEY, "yes");
  });

  // Close banner button (if present in HTML)
  el("cookieCloseBanner")?.addEventListener("click", () => {
    localStorage.setItem(BANNER_SEEN_KEY, "yes");
    banner?.classList.add("hidden");
  });
}


// ----------------------------
// init / wiring
// ----------------------------
async function init(){
  loadSettings();
  initCookieConsentUI(); // banner events

  const res = await fetch("questions.json");
  if(!res.ok){
    throw new Error("questions.json konnte nicht geladen werden.");
  }
  state.all = await res.json();

  // Build subject filter
  const filter = el("filter");
  filter.innerHTML = "";
  for(const s of uniqSubjects(state.all)){
    const opt = document.createElement("option");
    opt.value = s;

    if(s === "ALL"){
      opt.textContent = "Alle Sachgebiete";
    } else {
      opt.textContent = SUBJECT_LABELS[s] ?? s;
    }

    filter.appendChild(opt);
  }

  // Apply cookie-bundled settings to setup controls (only if consented)
  const cookie = loadSettingsFromCookie();
  if(cookie){
    if(cookie.mode) el("mode").value = cookie.mode;
    if(cookie.order) el("order").value = cookie.order;
    if(cookie.limit !== undefined) el("limit").value = cookie.limit;
    if(cookie.filter) el("filter").value = cookie.filter;
  } else {
    filter.value = "ALL";
  }

  state.mode = el("mode").value;
  updateSetupMeta();

  // Restore session ONLY if consented (loadSession() enforces this)
  const sess = loadSession();
  if(sess && sess.active && Array.isArray(sess.poolIds) && sess.poolIds.length){
    const byId = new Map(state.all.map(q => [q.id, q]));
    state.pool = sess.poolIds.map(id => byId.get(id)).filter(Boolean);

    const shMap = new Map(sess.shuffled || []);
    for(const q of state.pool){
      const sh = shMap.get(q.id);
      if(sh) q._shuffledAnswers = sh;
    }

    state.answersGiven = new Map(sess.answersGiven || []);
    state.idx = Math.min(Math.max(sess.idx ?? 0, 0), Math.max(state.pool.length-1, 0));
    state.mode = sess.mode || el("mode").value;

    setVisible("panelQuiz");
    renderQuestion();
  }

  // events
  el("btnStart").addEventListener("click", () => {
    buildPool();
    setVisible("panelQuiz");
    renderQuestion();
  });

  el("btnNext").addEventListener("click", next);
  el("btnFinish").addEventListener("click", showResults);
  el("btnPrev").addEventListener("click", prev);

  el("btnReset").addEventListener("click", () => {
    clearSession();
    setVisible("panelSetup");
    updateSetupMeta();
  });

  el("btnRestart").addEventListener("click", () => {
    clearSession();
    setVisible("panelSetup");
    updateSetupMeta();
  });

  // keep cookie/session current when setup inputs change
  ["mode","order","filter"].forEach(id => {
    el(id).addEventListener("change", () => { saveSettingsToCookie(); saveSession(); updateSetupMeta(); });
  });
  el("limit").addEventListener("input", () => { saveSettingsToCookie(); saveSession(); updateSetupMeta(); });

  // settings panel
  el("btnSettings").addEventListener("click", () => setVisible("panelSettings"));

  el("btnCloseSettings").addEventListener("click", () => {
    // --- 1) normale App-Einstellungen speichern
    saveSettings(); // showCorrect, autoAdvance etc.

    // --- 2) Cookie / Consent speichern
    const checkbox = el("consentPrefs");
    if(checkbox){
      const prefs = checkbox.checked;

      writeConsent({
        decided: true,
        prefs,
        ts: Date.now()
      });

      if(!prefs){
        // Widerruf → alles Optionale löschen
        deleteCookie(COOKIE_NAME);
        clearSession();
      } else {
        // Zustimmung → sofort persistieren
        saveSettingsToCookie();
        saveSession();
      }
    }

    // --- 3) Banner ausblenden + als gesehen markieren
    localStorage.setItem(BANNER_SEEN_KEY, "yes");
    el("cookieBanner")?.classList.add("hidden");

    // --- 4) zurück zur Setup-Ansicht
    setVisible("panelSetup");
    updateSetupMeta();
  });

  el("showCorrect").addEventListener("change", saveSettings);
  el("autoAdvance").addEventListener("change", saveSettings);
}

init().catch((err) => {
  console.error(err);
  alert(
    "Fehler beim Laden. Wenn du index.html direkt öffnest, blocken manche Browser fetch() auf lokale Dateien.\n\n" +
    "Lösung: Im Ordner einen lokalen Server starten: python -m http.server 8000\n" +
    "Dann im Browser öffnen: http://localhost:8000\n\n" +
    "Details: " + err.message
  );
});

// Register service worker for offline shell + PWA installability (requires HTTPS or localhost).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
