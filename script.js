"use strict";

const TOTAL_CHALLENGES = 7;
const MAX_SCORE = 700;
const welcomeScreen = document.querySelector("#welcomeScreen");
const missionScreen = document.querySelector("#missionScreen");
let challengeHost = document.querySelector("#challengeHost");
let progressFill = document.querySelector("#progressFill");
let progressLabel = document.querySelector("#progressLabel");
let scoreValue = document.querySelector("#scoreValue");
const helpDialog = document.querySelector("#helpDialog");
const toast = document.querySelector("#toast");

const titles = [
  "Le chemin secret",
  "La recette du dossier",
  "Construis ton arborescence",
  "Des noms qui parlent",
  "Enregistrer au bon endroit",
  "Retrouve le fichier",
  "Rangement express"
];

const helpTexts = [
  "<p>Un <strong>chemin</strong> se lit de gauche à droite, du plus grand espace vers le fichier ou dossier recherché.</p><p><code>P:\\Documents\\Technologie\\TICE\\Images</code> signifie : ouvre P:, puis Documents, puis Technologie, puis TICE, puis Images.</p>",
  "<ol><li>Va d’abord dans le dossier parent.</li><li>Fais un clic droit dans une zone vide.</li><li>Choisis <strong>Nouveau</strong>, puis <strong>Dossier</strong>.</li><li>Saisis le nom et valide avec Entrée.</li></ol>",
  "<p>Commence dans <code>P:\\Documents\\Technologie</code>. Crée <strong>TICE</strong>. La simulation l’ouvrira automatiquement. Crée ensuite les trois sous-dossiers demandés.</p>",
  "<p>Un bon nom indique le contenu sans devoir ouvrir le fichier. Utilise au moins deux mots utiles, séparés par un espace, <code>_</code> ou <code>-</code>. Évite <em>truc</em>, <em>document1</em> ou <em>nouveau dossier</em>.</p><p>Pour un fichier, conserve son extension : <code>.odt</code>, <code>.png</code>… Les majuscules dans l’extension sont acceptées.</p>",
  "<p>Avant de cliquer sur Enregistrer, vérifie le chemin affiché et le nom du fichier. Le dossier <strong>À rendre</strong> est réservé au travail à remettre au professeur.</p>",
  "<p>Transforme chaque indice en filtre : la matière donne le dossier, le type de contenu donne le sous-dossier, le prénom et les mots-clés donnent le nom du fichier.</p>",
  "<p>Les images vont dans <strong>Images</strong>. Les cours et fiches vont dans <strong>Documents</strong>. Les travaux portant un nom d’élève vont dans <strong>À rendre</strong>.</p><p>Tu peux glisser les fichiers ou sélectionner un fichier puis cliquer sur un dossier.</p>"
];

let state = {};
let toastTimer = null;

/*
 * Firefox peut agrandir uniquement le texte sans réduire la largeur CSS de la
 * fenêtre. Dans ce cas, les media queries classiques ne voient pas le zoom.
 * Cette sonde compare un texte HTML à la même mesure dans un canvas, puis
 * active une mise en page plus souple sans demander de réglage à l'élève.
 */
function installTextZoomDetection() {
  const probeText = "MMMMMMMMMM";
  const probe = document.createElement("span");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-10000px;top:-10000px;display:inline-block;width:max-content;white-space:nowrap;font:400 16px Arial,sans-serif;line-height:normal;visibility:hidden;pointer-events:none;";
  probe.textContent = probeText;
  document.body.appendChild(probe);

  if (context) context.font = "400 16px Arial, sans-serif";
  const expectedWidth = context ? context.measureText(probeText).width : 151;

  function updateTextZoomMode() {
    const measuredWidth = probe.getBoundingClientRect().width;
    const scale = expectedWidth > 0 ? measuredWidth / expectedWidth : 1;
    let mode = "normal";

    if (scale >= 1.45) mode = "very-high";
    else if (scale >= 1.14) mode = "high";

    document.documentElement.dataset.textZoom = mode;
    document.documentElement.style.setProperty("--detected-text-scale", Math.max(1, scale).toFixed(2));
  }

  updateTextZoomMode();
  window.addEventListener("resize", updateTextZoomMode, { passive: true });
  window.addEventListener("pageshow", updateTextZoomMode, { passive: true });

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(updateTextZoomMode);
    observer.observe(probe);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateTextZoomMode);
  }
}

installTextZoomDetection();

function freshState() {
  return {
    current: 0,
    score: 0,
    completed: new Set(),
    attempts: Array(TOTAL_CHALLENGES).fill(0),
    helpUsed: new Set(),
    sortOrder: ["name", "new", "location", "type", "enter"],
    explorer: { location: "tech", tech: ["Cours", "Ressources"], tice: [] },
    bonus: { running: false, seconds: 40, sorted: {}, selected: null, timer: null }
  };
}

function resetState() {
  if (state.bonus && state.bonus.timer) clearInterval(state.bonus.timer);
  state = freshState();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
}

function startMission() {
  if (!challengeHost || !challengeHost.isConnected) rebuildMissionShell();
  resetState();
  welcomeScreen.hidden = true;
  missionScreen.hidden = false;
  renderCurrent();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnHome() {
  if (state.bonus && state.bonus.timer) clearInterval(state.bonus.timer);
  if (!challengeHost || !challengeHost.isConnected) rebuildMissionShell();
  missionScreen.hidden = true;
  welcomeScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateMissionBar() {
  const completedCurrent = state.completed.has(state.current) ? 1 : 0;
  const progress = Math.round(((state.current + completedCurrent) / TOTAL_CHALLENGES) * 100);
  progressLabel.textContent = "Défi " + (state.current + 1) + " sur " + TOTAL_CHALLENGES;
  progressFill.style.width = Math.max(8, progress) + "%";
  scoreValue.textContent = state.score;
}

function challengeFrame(number, kicker, title, instruction, duration, body) {
  return [
    '<section class="challenge" data-challenge="' + number + '">',
      '<div class="challenge-heading">',
        '<div><p class="eyebrow">DÉFI ' + String(number).padStart(2, "0") + " · " + kicker + '</p><h1>' + title + '</h1></div>',
        '<button class="help-button" type="button" data-help>💡 Coup de pouce</button>',
      '</div>',
      '<div class="instruction-band">',
        '<span class="instruction-number">' + number + '</span>',
        '<p><strong>TA MISSION</strong>' + instruction + '</p>',
        '<span class="time-chip">≈ ' + duration + ' min</span>',
      '</div>',
      '<div class="challenge-card">' + body + '</div>',
      '<div class="challenge-footer">',
        '<button class="quit-button" type="button" data-home>Quitter la mission</button>',
        '<button class="next-button" id="nextButton" type="button" ' + (state.completed.has(number - 1) ? "" : "disabled") + '>' + (number === TOTAL_CHALLENGES ? "Voir mon bilan →" : "Défi suivant →") + '</button>',
      '</div>',
    '</section>'
  ].join("");
}

function feedbackHtml(text, type) {
  const icon = type === "good" ? "✓" : type === "bad" ? "✕" : "i";
  return '<div class="feedback ' + (type || "") + '" id="feedback" role="status" aria-live="polite"><strong>' + icon + '</strong><span>' + text + '</span></div>';
}

function finishChallenge(message, customPoints) {
  if (state.completed.has(state.current)) return;
  const earned = customPoints == null ? (state.helpUsed.has(state.current) ? 80 : state.attempts[state.current] ? 90 : 100) : customPoints;
  state.completed.add(state.current);
  state.score += earned;
  const feedback = document.querySelector("#feedback");
  if (feedback) {
    feedback.className = "feedback good";
    feedback.innerHTML = "<strong>✓</strong><span>" + message + " <strong>+" + earned + " points</strong></span>";
  }
  const next = document.querySelector("#nextButton");
  if (next) next.disabled = false;
  updateMissionBar();
  showToast("Défi réussi · +" + earned + " points");
}

function markWrong(message) {
  state.attempts[state.current] += 1;
  const feedback = document.querySelector("#feedback");
  if (feedback) {
    feedback.className = "feedback bad";
    feedback.innerHTML = "<strong>✕</strong><span>" + message + "</span>";
  }
}

function renderCurrent() {
  updateMissionBar();
  if (state.current === 0) renderChallenge1();
  if (state.current === 1) renderChallenge2();
  if (state.current === 2) renderChallenge3();
  if (state.current === 3) renderChallenge4();
  if (state.current === 4) renderChallenge5();
  if (state.current === 5) renderChallenge6();
  if (state.current === 6) renderChallenge7();
  wireCommonActions();
}

function wireCommonActions() {
  const help = document.querySelector("[data-help]");
  if (help) help.addEventListener("click", function () { openHelp(state.current); });
  document.querySelectorAll("[data-home]").forEach(function (button) { button.addEventListener("click", returnHome); });
  const next = document.querySelector("#nextButton");
  if (next) next.addEventListener("click", function () {
    if (!state.completed.has(state.current)) return;
    if (state.current === TOTAL_CHALLENGES - 1) {
      renderFinal();
      return;
    }
    state.current += 1;
    renderCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function renderChallenge1() {
  const body = [
    "<p><strong>Indice :</strong> Pixel cherche l’image du robot rangée dans le dossier Images de TICE, lui-même dans Technologie.</p>",
    '<div class="path-map" aria-label="Arborescence à lire">',
      '<span class="path-node"><span>💾</span>P:</span><span class="path-arrow">›</span>',
      '<span class="path-node"><span class="folder-icon">📁</span>Documents</span><span class="path-arrow">›</span>',
      '<span class="path-node"><span class="folder-icon">📁</span>Technologie</span>',
    '</div>',
    '<h2>Quel chemin faut-il suivre ?</h2>',
    '<div class="choice-grid" id="pathChoices">',
      choice("A", "P:\\Documents\\TICE\\Technologie\\Images", false),
      choice("B", "P:\\Documents\\Technologie\\TICE\\Images", true),
      choice("C", "P:\\Technologie\\Documents\\TICE\\Images", false),
      choice("D", "P:\\Documents\\Technologie\\Images\\TICE", false),
    '</div>',
    feedbackHtml("Clique sur le chemin qui respecte l’ordre des dossiers.", ""),
    '<p class="micro-tip"><strong>À retenir :</strong> le signe <code>\\</code> sépare les dossiers dans un chemin Windows.</p>'
  ].join("");
  challengeHost.innerHTML = challengeFrame(1, "CHEMIN SECRET", "Le chemin secret", "Lis l’arborescence puis choisis le seul chemin correct.", 5, body);
  document.querySelectorAll(".choice-button").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.dataset.correct === "true") {
        button.classList.add("is-correct");
        document.querySelectorAll(".choice-button").forEach(function (other) { other.disabled = true; });
        finishChallenge("Exact ! Tu as lu le chemin du plus grand espace vers le dossier final.");
      } else {
        button.classList.add("is-wrong");
        markWrong("Pas encore. Compare l’ordre après Documents : Technologie doit venir avant TICE.");
      }
    });
  });
}

function choice(letter, path, correct) {
  return '<button class="choice-button" type="button" data-correct="' + correct + '"><span class="choice-letter">' + letter + '</span><span class="path-code">' + path + '</span></button>';
}

const sortLabels = {
  location: "Ouvrir P: > Documents > Technologie",
  new: "Faire un clic droit dans une zone vide",
  type: "Choisir Nouveau, puis Dossier",
  name: "Saisir le nom TICE",
  enter: "Appuyer sur Entrée"
};

function renderChallenge2() {
  const body = [
    "<p>Les étapes sont mélangées. Glisse-les ou utilise les flèches pour les remettre dans l’ordre.</p>",
    '<ol class="sort-list" id="sortList"></ol>',
    '<button class="primary-button" id="checkOrder" type="button">Vérifier l’ordre</button>',
    feedbackHtml("Commence par te placer dans le bon dossier parent.", "")
  ].join("");
  challengeHost.innerHTML = challengeFrame(2, "MODE D’EMPLOI", "La recette du dossier", "Remets les cinq étapes dans le bon ordre.", 6, body);
  drawSortList();
  document.querySelector("#checkOrder").addEventListener("click", checkSortOrder);
}

function drawSortList() {
  const list = document.querySelector("#sortList");
  list.innerHTML = state.sortOrder.map(function (id, index) {
    return [
      '<li class="sort-item" draggable="true" data-id="' + id + '">',
        '<span class="sort-rank">' + (index + 1) + '</span>',
        '<span>' + sortLabels[id] + '</span>',
        '<span class="sort-controls">',
          '<button type="button" data-move="-1" aria-label="Monter cette étape">↑</button>',
          '<button type="button" data-move="1" aria-label="Descendre cette étape">↓</button>',
        '</span>',
      '</li>'
    ].join("");
  }).join("");
  wireSort();
}

function wireSort() {
  let dragged = null;
  document.querySelectorAll(".sort-item").forEach(function (item) {
    item.addEventListener("dragstart", function () { dragged = item.dataset.id; item.classList.add("dragging"); });
    item.addEventListener("dragend", function () { item.classList.remove("dragging"); dragged = null; });
    item.addEventListener("dragover", function (event) { event.preventDefault(); });
    item.addEventListener("drop", function (event) {
      event.preventDefault();
      if (!dragged || dragged === item.dataset.id) return;
      const from = state.sortOrder.indexOf(dragged);
      const to = state.sortOrder.indexOf(item.dataset.id);
      state.sortOrder.splice(from, 1);
      state.sortOrder.splice(to, 0, dragged);
      drawSortList();
    });
  });
  document.querySelectorAll("[data-move]").forEach(function (button) {
    button.addEventListener("click", function () {
      const id = button.closest(".sort-item").dataset.id;
      const from = state.sortOrder.indexOf(id);
      const to = from + Number(button.dataset.move);
      if (to < 0 || to >= state.sortOrder.length) return;
      const temp = state.sortOrder[to];
      state.sortOrder[to] = id;
      state.sortOrder[from] = temp;
      drawSortList();
    });
  });
}

function checkSortOrder() {
  const correct = ["location", "new", "type", "name", "enter"];
  if (state.sortOrder.join("|") === correct.join("|")) {
    finishChallenge("Bravo ! Tu connais la recette complète pour créer un dossier.");
  } else {
    markWrong("L’ordre n’est pas encore logique. Le nom se saisit après avoir choisi Nouveau > Dossier.");
  }
}

function renderChallenge3() {
  const body = [
    '<div class="checklist" id="folderChecklist"></div>',
    '<div class="explorer" aria-label="Simulation de l’explorateur Windows">',
      '<div class="explorer-title"><span>Explorateur de fichiers</span><span class="window-dots">— □ ×</span></div>',
      '<div class="explorer-toolbar">',
        '<button class="toolbar-button" type="button" id="backFolder">← Retour</button>',
        '<div class="breadcrumb" id="breadcrumb"></div>',
        '<button class="toolbar-button" type="button" id="newFolder">＋ Nouveau dossier</button>',
      '</div>',
      '<div class="explorer-main">',
        '<aside class="explorer-sidebar"><strong>Ce PC</strong><span class="tree-line">💾 Espace personnel (P:)</span><span class="tree-line">└─ 📁 Documents</span><span class="tree-line active">　└─ 📁 Technologie</span><span class="tree-line">　　 └─ 📁 TICE</span></aside>',
        '<div class="folder-area" id="folderArea"></div>',
      '</div>',
      '<form class="new-folder-row" id="folderForm" hidden>',
        '<input id="folderName" maxlength="24" autocomplete="off" aria-label="Nom du nouveau dossier" placeholder="Nom du nouveau dossier">',
        '<button type="submit">Créer</button>',
      '</form>',
    '</div>',
    feedbackHtml("Crée d’abord TICE dans Technologie.", "")
  ].join("");
  challengeHost.innerHTML = challengeFrame(3, "FAUX EXPLORATEUR", "Construis ton arborescence", "Dans l’explorateur, crée TICE puis Documents, Images et À rendre.", 15, body);
  drawExplorer();
  document.querySelector("#newFolder").addEventListener("click", function () {
    const form = document.querySelector("#folderForm");
    form.hidden = false;
    document.querySelector("#folderName").focus();
  });
  document.querySelector("#backFolder").addEventListener("click", function () {
    state.explorer.location = "tech";
    drawExplorer();
  });
  document.querySelector("#folderForm").addEventListener("submit", createFolder);
}

function normalize(value) {
  return value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function drawExplorer() {
  const inTice = state.explorer.location === "tice";
  const folders = inTice ? state.explorer.tice : state.explorer.tech;
  const breadcrumb = document.querySelector("#breadcrumb");
  const area = document.querySelector("#folderArea");
  const back = document.querySelector("#backFolder");
  if (!breadcrumb || !area) return;
  breadcrumb.innerHTML = '<span>💾 P:</span><span>›</span><span>Documents</span><span>›</span><button class="crumb-button" type="button" id="techCrumb">Technologie</button>' + (inTice ? "<span>›</span><strong>TICE</strong>" : "");
  back.disabled = !inTice;
  area.innerHTML = folders.map(function (folder) {
    const canOpen = !inTice && normalize(folder) === "tice";
    return '<button class="folder-tile" type="button" data-folder="' + folder + '" ' + (canOpen ? "" : 'aria-disabled="true"') + '><span class="folder-icon">📁</span><span>' + folder + '</span>' + (canOpen ? "<small>Ouvrir</small>" : "") + '</button>';
  }).join("");
  const techCrumb = document.querySelector("#techCrumb");
  if (techCrumb) techCrumb.addEventListener("click", function () { state.explorer.location = "tech"; drawExplorer(); });
  document.querySelectorAll(".folder-tile").forEach(function (button) {
    button.addEventListener("click", function () {
      if (normalize(button.dataset.folder) === "tice" && !inTice) {
        state.explorer.location = "tice";
        drawExplorer();
      }
    });
  });
  drawFolderChecklist();
}

function createFolder(event) {
  event.preventDefault();
  const input = document.querySelector("#folderName");
  const name = input.value.trim();
  const target = state.explorer.location === "tech" ? "TICE" : null;
  const allowedSub = ["Documents", "Images", "À rendre"];
  const normalized = normalize(name);
  if (!name) {
    markWrong("Saisis un nom avant de créer le dossier.");
    return;
  }
  if (target && normalized !== "tice") {
    markWrong("Dans Technologie, le dossier demandé s’appelle TICE.");
    return;
  }
  if (!target && !allowedSub.some(function (item) { return normalize(item) === normalized; })) {
    markWrong("Dans TICE, crée seulement Documents, Images ou À rendre.");
    return;
  }
  const list = target ? state.explorer.tech : state.explorer.tice;
  if (list.some(function (item) { return normalize(item) === normalized; })) {
    markWrong("Ce dossier existe déjà. Crée le prochain de la liste.");
    return;
  }
  const canonical = target || allowedSub.find(function (item) { return normalize(item) === normalized; });
  list.push(canonical);
  input.value = "";
  document.querySelector("#folderForm").hidden = true;
  if (target) state.explorer.location = "tice";
  drawExplorer();
  const allDone = state.explorer.tech.includes("TICE") && allowedSub.every(function (item) { return state.explorer.tice.includes(item); });
  if (allDone) {
    finishChallenge("Arborescence terminée ! Chaque type de travail possède maintenant sa place.");
  } else {
    const feedback = document.querySelector("#feedback");
    feedback.className = "feedback info";
    feedback.innerHTML = "<strong>✓</strong><span>" + canonical + " a été créé. Continue avec le dossier suivant.</span>";
  }
}

function drawFolderChecklist() {
  const required = [
    { label: "TICE", done: state.explorer.tech.includes("TICE") },
    { label: "Documents", done: state.explorer.tice.includes("Documents") },
    { label: "Images", done: state.explorer.tice.includes("Images") },
    { label: "À rendre", done: state.explorer.tice.includes("À rendre") }
  ];
  const list = document.querySelector("#folderChecklist");
  if (list) {
    list.innerHTML = required.map(function (item) {
      return '<span class="check-item ' + (item.done ? "done" : "") + '">' + (item.done ? "✓ " : "○ ") + item.label + '</span>';
    }).join("");
  }
}

function renderChallenge4() {
  const body = [
    '<div class="rules"><span class="rule-chip">✓ au moins 2 mots utiles</span><span class="rule-chip">✓ espace, _ ou - acceptés</span><span class="rule-chip">✓ pas de nom générique</span><span class="rule-chip">✓ extension conservée</span></div>',
    '<div class="rename-grid">',
      renameRow("folder", "📁", "nouveau dossier", "Ex. Cours_Tableur", ""),
      renameRow("odt", "📄", "document1.odt", "Ex. Compte_rendu_ordinateur.odt", ".odt"),
      renameRow("png", "🖼️", "photo123.png", "Ex. Photo_montage_robot.png", ".png"),
    '</div>',
    '<button class="primary-button" id="checkNames" type="button" style="margin-top:18px">Vérifier les noms</button>',
    feedbackHtml("Renomme les trois éléments avec des noms compréhensibles.", "")
  ].join("");
  challengeHost.innerHTML = challengeFrame(4, "NOMS CLAIRS", "Des noms qui parlent", "Remplace les noms vagues sans modifier les extensions.", 7, body);
  document.querySelector("#checkNames").addEventListener("click", checkNames);
}

function renameRow(id, icon, original, placeholder, extension) {
  return [
    '<label class="rename-row">',
      '<span class="file-original"><span>' + icon + '</span><span>' + original + '</span></span>',
      '<span class="rename-arrow" aria-hidden="true">→</span>',
      '<span class="rename-editor">',
        '<input class="rename-input" id="rename-' + id + '" data-extension="' + extension + '" autocomplete="off" placeholder="' + placeholder + '" aria-describedby="rename-' + id + '-help">',
        '<small class="field-feedback" id="rename-' + id + '-help">Saisis un nom précis.</small>',
      '</span>',
    '</label>'
  ].join("");
}

const genericNames = new Set([
  "document", "document 1", "dossier", "nouveau dossier", "fichier",
  "fichier 1", "image", "image 1", "photo", "photo 123",
  "sans titre", "test", "truc", "travail"
]);

const fillerWords = new Set([
  "de", "des", "du", "la", "le", "les", "mon", "ma", "mes",
  "un", "une", "nouveau", "nouvelle", "document", "dossier", "fichier"
]);

function inspectClearName(rawValue, requiredExtension) {
  const value = rawValue.trim();
  if (!value) return { ok: false, message: "Saisis un nouveau nom." };
  if (/[<>:"/\\|?*\u0000-\u001F]/.test(value)) {
    return { ok: false, message: "Retire les caractères interdits : < > : \" / \\ | ? *" };
  }
  if (/[. ]$/.test(value)) {
    return { ok: false, message: "Le nom ne doit pas finir par un point ou un espace." };
  }

  let baseName = value;
  if (requiredExtension) {
    if (!value.toLocaleLowerCase("fr").endsWith(requiredExtension)) {
      return { ok: false, message: "Conserve l’extension " + requiredExtension + "." };
    }
    baseName = value.slice(0, -requiredExtension.length);
  }

  if (/[_\-. ]$/.test(baseName)) {
    return { ok: false, message: "Place un mot avant l’extension." };
  }

  const separated = baseName
    .replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedBase = normalize(separated);
  const compactBase = normalizedBase.replace(/\s+/g, "");
  if (genericNames.has(normalizedBase) || /^(document|dossier|fichier|image|photo|truc|test)\d*$/.test(compactBase)) {
    return { ok: false, message: "Ce nom est trop vague : précise ce que contient l’élément." };
  }

  const usefulWords = separated.split(" ").filter(function (word) {
    const clean = normalize(word).replace(/[^a-z0-9]/g, "");
    return clean.length >= 2 && !fillerWords.has(clean);
  });
  if (usefulWords.length < 2) {
    return { ok: false, message: "Ajoute un deuxième mot utile pour décrire le contenu." };
  }

  return {
    ok: true,
    message: requiredExtension ? "Nom clair et extension conservée." : "Nom de dossier clair."
  };
}

function checkNames() {
  const folder = document.querySelector("#rename-folder");
  const odt = document.querySelector("#rename-odt");
  const png = document.querySelector("#rename-png");
  const checks = [
    { input: folder, extension: "" },
    { input: odt, extension: ".odt" },
    { input: png, extension: ".png" }
  ];
  let invalidCount = 0;
  checks.forEach(function (check) {
    const result = inspectClearName(check.input.value, check.extension);
    const detail = document.querySelector("#" + check.input.id + "-help");
    check.input.classList.toggle("valid", result.ok);
    check.input.classList.toggle("invalid", !result.ok);
    check.input.setAttribute("aria-invalid", String(!result.ok));
    detail.textContent = (result.ok ? "✓ " : "À corriger : ") + result.message;
    detail.classList.toggle("valid", result.ok);
    detail.classList.toggle("invalid", !result.ok);
    if (!result.ok) invalidCount += 1;
  });
  if (invalidCount === 0) {
    finishChallenge("Parfait ! Les noms indiquent le contenu et les extensions sont intactes.");
  } else {
    markWrong(invalidCount + " nom" + (invalidCount > 1 ? "s sont" : " est") + " encore à corriger. Lis l’indication sous chaque champ.");
  }
}

function renderChallenge5() {
  const body = [
    '<div class="student-card"><span class="avatar">CR</span><div><strong>Travail de Camille Roux</strong><br><small>Identité fictive pour la simulation</small></div></div>',
    '<div class="save-window" style="margin-top:18px">',
      '<div class="save-titlebar">Enregistrer sous</div>',
      '<div class="save-body">',
        '<div><label>1. Choisis le dossier de destination</label><div class="path-options">',
          savePath("docs", "P:\\Documents\\Technologie\\TICE\\Documents"),
          savePath("render", "P:\\Documents\\Technologie\\TICE\\À rendre"),
          savePath("images", "P:\\Documents\\Technologie\\TICE\\Images"),
        '</div></div>',
        '<label>2. Donne un nom clair au fichier<input class="save-input" id="saveName" value="document.odt" autocomplete="off"></label>',
        '<button class="primary-button" id="fakeSave" type="button">Enregistrer</button>',
      '</div>',
    '</div>',
    feedbackHtml("Le professeur attend ce fichier : Camille_Roux_Arborescence.odt", "")
  ].join("");
  challengeHost.innerHTML = challengeFrame(5, "ENREGISTRER SOUS", "Enregistrer au bon endroit", "Choisis le bon chemin et un nom de fichier adapté.", 6, body);
  document.querySelector("#fakeSave").addEventListener("click", checkSave);
}

function savePath(value, label) {
  return '<label class="path-option"><input type="radio" name="savePath" value="' + value + '"><span class="path-code">' + label + '</span></label>';
}

function checkSave() {
  const selected = document.querySelector('input[name="savePath"]:checked');
  const name = normalize(document.querySelector("#saveName").value);
  const goodName = name === "camille_roux_arborescence.odt";
  if (selected && selected.value === "render" && goodName) {
    finishChallenge("Document enregistré ! Tu as vérifié le chemin et choisi un nom utile.");
  } else if (!selected) {
    markWrong("Choisis d’abord un dossier de destination.");
  } else if (selected.value !== "render") {
    markWrong("Un travail à remettre va dans le sous-dossier À rendre.");
  } else {
    markWrong("Le chemin est bon. Corrige maintenant le nom : Camille_Roux_Arborescence.odt");
  }
}

function renderChallenge6() {
  const body = [
    '<div class="clue-grid">',
      '<aside class="clue-card"><h2>Les indices</h2><ul><li>travail de <strong>Lina Morel</strong></li><li>une <strong>affiche de sécurité</strong></li><li>format <strong>image PNG</strong></li><li>rangée dans <strong>TICE > Images</strong></li></ul></aside>',
      '<div><h2>Quel fichier faut-il ouvrir ?</h2><div class="file-list">',
        fileChoice("P:\\Documents\\Technologie\\TICE\\Documents", "Affiche_securite_Lina_Morel.odt", false),
        fileChoice("P:\\Documents\\Technologie\\TICE\\Images", "Affiche_securite_Lina_Morel.png", true),
        fileChoice("P:\\Documents\\Technologie\\TICE\\À rendre", "Affiche_securite_Lina_Morel.png", false),
        fileChoice("P:\\Documents\\Technologie\\TICE\\Images", "Photo_robot_Nino_Bernard.png", false),
      '</div></div>',
    '</div>',
    feedbackHtml("Croise tous les indices, pas seulement le prénom.", "")
  ].join("");
  challengeHost.innerHTML = challengeFrame(6, "ENQUÊTE", "Retrouve le fichier", "À partir des indices, sélectionne le bon fichier.", 6, body);
  document.querySelectorAll(".file-choice").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.dataset.correct === "true") {
        button.classList.add("is-correct");
        document.querySelectorAll(".file-choice").forEach(function (other) { other.disabled = true; });
        finishChallenge("Fichier retrouvé ! Le chemin, le nom et l’extension correspondaient.");
      } else {
        button.classList.add("is-wrong");
        markWrong("Ce fichier ne respecte pas tous les indices. Vérifie le dossier et l’extension.");
      }
    });
  });
}

function fileChoice(path, name, correct) {
  return '<button class="file-choice" type="button" data-correct="' + correct + '"><span>📄</span><span><strong>' + name + '</strong><small class="path-code">' + path + '</small></span></button>';
}

const bonusFiles = [
  { id: "cours", name: "Cours_reseau.odt", target: "Documents" },
  { id: "schema", name: "Schema_port_USB.svg", target: "Images" },
  { id: "lina", name: "Lina_Morel_Arborescence.odt", target: "À rendre" },
  { id: "capture", name: "Capture_ecran.png", target: "Images" },
  { id: "fiche", name: "Fiche_vocabulaire.pdf", target: "Documents" },
  { id: "noah", name: "Noah_Bernard_Arborescence.odt", target: "À rendre" }
];

function renderChallenge7() {
  const body = state.bonus.running || Object.keys(state.bonus.sorted).length ? bonusBoardHtml() : [
    '<div class="bonus-intro"><div class="timer-orb">40 s</div><div><h2>Prêt pour le rangement express ?</h2><p>Range six fichiers dans Documents, Images ou À rendre avant la fin du chrono. Les prénoms utilisés sont fictifs.</p></div></div>',
    '<button class="primary-button" id="startBonus" type="button" style="margin-top:18px">Lancer le chrono</button>',
    feedbackHtml("Astuce : commence par repérer les extensions des fichiers.", "info")
  ].join("");
  challengeHost.innerHTML = challengeFrame(7, "BONUS CHRONOMÉTRÉ", "Rangement express", "Range les six fichiers avant la fin du chrono.", 5, body);
  const start = document.querySelector("#startBonus");
  if (start) start.addEventListener("click", startBonus);
  if (state.bonus.running || Object.keys(state.bonus.sorted).length) wireBonusBoard();
}

function bonusBoardHtml() {
  const unsorted = bonusFiles.filter(function (file) { return !state.bonus.sorted[file.id]; });
  return [
    '<div class="bonus-intro"><div class="timer-orb" id="timerValue">' + state.bonus.seconds + ' s</div><div><h2>' + (state.bonus.running ? "Le chrono tourne !" : "Temps écoulé") + '</h2><p>Sélectionne un fichier puis un dossier, ou utilise le glisser-déposer.</p></div></div>',
    '<div class="bonus-board">',
      '<div class="file-pile" id="filePile"><strong>Fichiers à ranger</strong>',
        unsorted.map(function (file) { return '<button class="draggable-file" draggable="true" type="button" data-file="' + file.id + '">' + file.name + '</button>'; }).join(""),
      '</div>',
      '<div class="drop-grid">',
        ["Documents", "Images", "À rendre"].map(function (folder) {
          const dropped = bonusFiles.filter(function (file) { return state.bonus.sorted[file.id] === folder; });
          return '<div class="drop-zone" tabindex="0" role="button" data-target="' + folder + '"><strong>📁 ' + folder + '</strong>' + dropped.map(function (file) { return '<span class="dropped-file">' + file.name + '</span>'; }).join("") + '</div>';
        }).join(""),
      '</div>',
    '</div>',
    (!state.bonus.running && unsorted.length ? '<button class="secondary-button" id="retryBonus" type="button" style="margin-top:18px">Recommencer le chrono</button>' : ""),
    feedbackHtml(state.bonus.running ? "Choisis vite, mais vérifie avant de ranger." : (unsorted.length ? "Le temps est écoulé. Tu peux recommencer." : "Tous les fichiers sont rangés."), state.bonus.running ? "info" : ""),
  ].join("");
}

function startBonus() {
  clearInterval(state.bonus.timer);
  state.bonus.running = true;
  state.bonus.seconds = 40;
  state.bonus.sorted = {};
  state.bonus.selected = null;
  renderChallenge7();
  wireCommonActions();
  state.bonus.timer = setInterval(function () {
    state.bonus.seconds -= 1;
    const timer = document.querySelector("#timerValue");
    if (timer) timer.textContent = state.bonus.seconds + " s";
    if (state.bonus.seconds <= 0) {
      clearInterval(state.bonus.timer);
      state.bonus.running = false;
      renderChallenge7();
      wireCommonActions();
    }
  }, 1000);
}

function wireBonusBoard() {
  const retry = document.querySelector("#retryBonus");
  if (retry) retry.addEventListener("click", startBonus);
  document.querySelectorAll(".draggable-file").forEach(function (button) {
    button.addEventListener("click", function () {
      if (!state.bonus.running) return;
      state.bonus.selected = button.dataset.file;
      document.querySelectorAll(".draggable-file").forEach(function (item) { item.classList.toggle("selected", item === button); });
    });
    button.addEventListener("dragstart", function (event) {
      if (!state.bonus.running) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", button.dataset.file);
    });
  });
  document.querySelectorAll(".drop-zone").forEach(function (zone) {
    zone.addEventListener("dragover", function (event) {
      if (state.bonus.running) {
        event.preventDefault();
        zone.classList.add("drag-over");
      }
    });
    zone.addEventListener("dragleave", function () { zone.classList.remove("drag-over"); });
    zone.addEventListener("drop", function (event) {
      event.preventDefault();
      zone.classList.remove("drag-over");
      placeBonusFile(event.dataTransfer.getData("text/plain"), zone.dataset.target);
    });
    zone.addEventListener("click", function () {
      if (state.bonus.selected) placeBonusFile(state.bonus.selected, zone.dataset.target);
    });
    zone.addEventListener("keydown", function (event) {
      if ((event.key === "Enter" || event.key === " ") && state.bonus.selected) {
        event.preventDefault();
        placeBonusFile(state.bonus.selected, zone.dataset.target);
      }
    });
  });
}

function placeBonusFile(id, target) {
  if (!state.bonus.running) return;
  const file = bonusFiles.find(function (item) { return item.id === id; });
  if (!file) return;
  if (file.target !== target) {
    markWrong("Ce n’est pas le bon dossier pour " + file.name + ". Observe son nom et son extension.");
    return;
  }
  state.bonus.sorted[id] = target;
  state.bonus.selected = null;
  const done = Object.keys(state.bonus.sorted).length;
  if (done === bonusFiles.length) {
    clearInterval(state.bonus.timer);
    state.bonus.running = false;
    const points = Math.min(100, 70 + Math.floor(state.bonus.seconds / 4) * 5);
    renderChallenge7();
    wireCommonActions();
    finishChallenge("Rangement terminé avec " + state.bonus.seconds + " secondes restantes !", points);
    return;
  }
  renderChallenge7();
  wireCommonActions();
  showToast(done + " fichier" + (done > 1 ? "s" : "") + " sur 6 rangé" + (done > 1 ? "s" : ""));
}

function renderFinal() {
  if (state.bonus.timer) clearInterval(state.bonus.timer);
  const stars = state.score >= 620 ? 3 : state.score >= 500 ? 2 : 1;
  const starHtml = [1, 2, 3].map(function (number) {
    return '<span class="' + (number <= stars ? "earned" : "") + '">★</span>';
  }).join("");
  missionScreen.innerHTML = [
    '<section class="final-screen">',
      '<div class="final-burst" aria-hidden="true">📁</div>',
      '<p class="eyebrow">MISSION ACCOMPLIE</p>',
      '<h1>Arborescence validée !</h1>',
      '<p class="hero-lead">Pixel peut souffler : tes dossiers sont clairs, tes fichiers bien nommés et ton travail facile à retrouver.</p>',
      '<div class="star-row" aria-label="' + stars + ' étoiles sur 3">' + starHtml + '</div>',
      '<h2>' + state.score + ' / ' + MAX_SCORE + ' points</h2>',
      '<div class="badge-row">',
        '<div class="badge"><span>🧭</span>Lecteur de chemins</div>',
        '<div class="badge"><span>🏗️</span>Bâtisseur TICE</div>',
        '<div class="badge"><span>⚡</span>As du classement</div>',
      '</div>',
      '<section class="result-card"><p class="eyebrow">COMPÉTENCES ACQUISES</p><h2>Je sais maintenant…</h2><ul class="skill-grid">',
        '<li>✓ lire un chemin de dossiers</li>',
        '<li>✓ créer dossiers et sous-dossiers</li>',
        '<li>✓ choisir un nom de fichier clair</li>',
        '<li>✓ conserver la bonne extension</li>',
        '<li>✓ enregistrer au bon endroit</li>',
        '<li>✓ retrouver un travail avec des indices</li>',
      '</ul></section>',
      '<div class="final-actions"><button class="primary-button" id="printResult" type="button">Imprimer mon bilan</button><button class="secondary-button" id="restartMission" type="button">Rejouer la mission</button><button class="secondary-button" id="finalHome" type="button">Retour à l’accueil</button></div>',
    '</section>'
  ].join("");
  document.querySelector("#printResult").addEventListener("click", function () { window.print(); });
  document.querySelector("#restartMission").addEventListener("click", function () {
    rebuildMissionShell();
    startMission();
  });
  document.querySelector("#finalHome").addEventListener("click", function () {
    rebuildMissionShell();
    returnHome();
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function rebuildMissionShell() {
  missionScreen.innerHTML = '<div class="mission-bar" aria-label="Progression de la mission"><strong id="progressLabel">Défi 1 sur 7</strong><div class="progress-track"><span id="progressFill"></span></div><strong class="score"><span aria-hidden="true">★</span> <span id="scoreValue">0</span> pts</strong></div><div id="challengeHost"></div>';
  challengeHost = document.querySelector("#challengeHost");
  progressFill = document.querySelector("#progressFill");
  progressLabel = document.querySelector("#progressLabel");
  scoreValue = document.querySelector("#scoreValue");
}

function openHelp(index) {
  state.helpUsed.add(index);
  document.querySelector("#helpTitle").textContent = titles[index];
  document.querySelector("#helpContent").innerHTML = helpTexts[index];
  helpDialog.showModal();
}

document.querySelector("#startButton").addEventListener("click", startMission);
document.querySelector("#homeButton").addEventListener("click", returnHome);
document.querySelector("#helpButton").addEventListener("click", function () {
  document.querySelector("#helpTitle").textContent = "Comment réussir la mission ?";
  document.querySelector("#helpContent").innerHTML = "<p>Lis chaque consigne, essaie une réponse puis utilise le coup de pouce si tu bloques. Tu peux recommencer sans perdre de point.</p><p><strong>Sur un ordinateur :</strong> le glisser-déposer fonctionne. Si tu préfères, utilise aussi les boutons et le clavier.</p>";
  helpDialog.showModal();
});
document.querySelector("#closeHelp").addEventListener("click", function () { helpDialog.close(); });
helpDialog.addEventListener("click", function (event) {
  if (event.target === helpDialog) helpDialog.close();
});

if (document.modelContext && typeof document.modelContext.registerTool === "function") {
  document.modelContext.registerTool({
    name: "start_training_mission",
    title: "Commencer la mission",
    description: "Ouvre la séance Architecte des dossiers au premier défi.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: function () {
      startMission();
      return { challenge: 1, totalChallenges: TOTAL_CHALLENGES };
    }
  });
}
