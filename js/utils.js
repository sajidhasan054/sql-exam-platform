// ExamUtils: shared helpers, no JSX, loaded before app.js
(function () {
  "use strict";

  const LS_KEYS = {
    PAT: "yassir_exam_admin_pat",
    ADMIN_SESSION: "yassir_exam_admin_session"
  };

  // ---------- Config ----------
  async function loadConfig() {
    const res = await fetch("./data/config.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load config.json");
    return res.json();
  }

  // ---------- Public JSON reads (same-origin, no auth needed) ----------
  async function loadQuestions() {
    const res = await fetch("./data/questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load questions.json");
    return res.json();
  }

  async function loadSchemas() {
    const res = await fetch("./data/schemas.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load schemas.json");
    return res.json();
  }

  async function loadExams() {
    const res = await fetch("./data/exams.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load exams.json");
    return res.json();
  }

  // ---------- GitHub Contents API (admin writes) ----------
  // Requires a fine-grained PAT with "Contents: Read and write" on the target repo.
  // The PAT is stored only in this browser's localStorage; it is never sent anywhere
  // except api.github.com, and is never bundled into files served to candidates.

  function getStoredPat() {
    return localStorage.getItem(LS_KEYS.PAT) || "";
  }

  function storePat(pat) {
    localStorage.setItem(LS_KEYS.PAT, pat);
  }

  function clearPat() {
    localStorage.removeItem(LS_KEYS.PAT);
  }

  async function githubGetFile(cfg, path) {
    const url = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}?ref=${cfg.githubBranch}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getStoredPat()}`,
        Accept: "application/vnd.github+json"
      }
    });
    if (!res.ok) throw new Error(`GitHub read failed (${res.status}) for ${path}`);
    const data = await res.json();
    const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
    return { sha: data.sha, json: JSON.parse(content) };
  }

  async function githubPutFile(cfg, path, jsonValue, sha, commitMessage) {
    const url = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}`;
    const pretty = JSON.stringify(jsonValue, null, 2) + "\n";
    const b64 = btoa(unescape(encodeURIComponent(pretty)));
    const body = {
      message: commitMessage || `Update ${path} via admin panel`,
      content: b64,
      branch: cfg.githubBranch
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getStoredPat()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub write failed (${res.status}): ${errText}`);
    }
    return res.json();
  }

  async function saveQuestionsToGithub(cfg, questions) {
    const current = await githubGetFile(cfg, "data/questions.json");
    return githubPutFile(cfg, "data/questions.json", questions, current.sha, "Update question bank");
  }

  async function saveExamsToGithub(cfg, exams) {
    const current = await githubGetFile(cfg, "data/exams.json");
    return githubPutFile(cfg, "data/exams.json", exams, current.sha, "Update exam templates");
  }

  async function saveConfigToGithub(cfg, newConfig) {
    const current = await githubGetFile(cfg, "data/config.json");
    return githubPutFile(cfg, "data/config.json", newConfig, current.sha, "Update platform config");
  }

  async function verifyPat(cfg) {
    const res = await fetch(`https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}`, {
      headers: {
        Authorization: `Bearer ${getStoredPat()}`,
        Accept: "application/vnd.github+json"
      }
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, permissions: data.permissions || {} };
  }

  // ---------- Google Form submission (candidate results) ----------
  // Submits via a hidden iframe POST so the candidate's browser is never navigated
  // away, and no CORS issues arise (Forms doesn't send CORS headers for no-cors POSTs).
  function submitToGoogleForm(cfg, payload) {
    return new Promise((resolve) => {
      const entries = cfg.googleFormEntryIds || {};
      const actionUrl = cfg.googleFormActionUrl;
      if (!actionUrl) {
        console.warn("Google Form action URL not configured; skipping result submission.");
        resolve({ skipped: true });
        return;
      }

      const iframeName = "hidden_result_submit_" + Date.now();
      const iframe = document.createElement("iframe");
      iframe.name = iframeName;
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const form = document.createElement("form");
      form.action = actionUrl;
      form.method = "POST";
      form.target = iframeName;

      Object.keys(payload).forEach((key) => {
        const entryId = entries[key];
        if (!entryId) return; // skip unmapped fields
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = entryId;
        input.value = String(payload[key]);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      // Best-effort: Forms doesn't give us a real completion signal cross-origin,
      // so we just wait briefly then clean up and resolve.
      setTimeout(() => {
        form.remove();
        iframe.remove();
        resolve({ skipped: false });
      }, 1200);
    });
  }

  // ---------- Scoring ----------
  function scoreMcqAnswers(questions, answers) {
    let total = 0;
    let correct = 0;
    questions.forEach((q) => {
      if (q.type !== "mcq") return;
      total += 1;
      if (answers[q.id] && answers[q.id] === q.correct) correct += 1;
    });
    return { correct, total };
  }

  // ---------- Anti-paste guard ----------
  // Blocks copy / cut / paste / context-menu inside a container, and warns on
  // Ctrl/Cmd+C / V / X. This deters casual copying; it cannot stop screenshots,
  // a second device, or a determined candidate, and that limitation should be
  // disclosed to candidates rather than relied on as real security.
  function installAntiCheatGuard(container, onViolation) {
    const block = (e) => {
      e.preventDefault();
      onViolation(e.type);
    };
    const keyHandler = (e) => {
      const key = (e.key || "").toLowerCase();
      const isCombo = (e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(key);
      if (isCombo) {
        e.preventDefault();
        onViolation("keyboard-shortcut");
      }
    };
    container.addEventListener("copy", block);
    container.addEventListener("cut", block);
    container.addEventListener("paste", block);
    container.addEventListener("contextmenu", block);
    container.addEventListener("keydown", keyHandler);

    return function uninstall() {
      container.removeEventListener("copy", block);
      container.removeEventListener("cut", block);
      container.removeEventListener("paste", block);
      container.removeEventListener("contextmenu", block);
      container.removeEventListener("keydown", keyHandler);
    };
  }

  // ---------- Repo auto-detection ----------
  // On GitHub Pages, project sites are served from https://OWNER.github.io/REPO/...
  // This lets Settings pre-fill correctly without the admin typing it in.
  function inferRepoFromLocation() {
    const host = window.location.hostname; // e.g. someuser.github.io
    const parts = host.split(".");
    let owner = "";
    if (host.endsWith("github.io") && parts.length >= 3) {
      owner = parts[0];
    }
    let repo = "";
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) repo = pathParts[0];
    return { owner, repo };
  }

  // ---------- Misc ----------
  function formatSeconds(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function uid(prefix) {
    return `${prefix || "id"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  window.ExamUtils = {
    LS_KEYS,
    loadConfig,
    loadQuestions,
    loadSchemas,
    loadExams,
    getStoredPat,
    storePat,
    clearPat,
    githubGetFile,
    githubPutFile,
    saveQuestionsToGithub,
    saveExamsToGithub,
    saveConfigToGithub,
    verifyPat,
    submitToGoogleForm,
    scoreMcqAnswers,
    installAntiCheatGuard,
    formatSeconds,
    uid,
    inferRepoFromLocation
  };
})();
