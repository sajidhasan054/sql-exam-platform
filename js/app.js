const { useState, useEffect, useRef, useMemo, useCallback } = React;
const U = window.ExamUtils;

// ============================================================
// Routing (hash-based: #/  #/admin  #/exam/EXAM_ID)
// ============================================================
function useHashRoute() {
  const parse = () => {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    const segments = hash.split("/").filter(Boolean);
    if (segments.length === 0) return { name: "home" };
    if (segments[0] === "admin") return { name: "admin" };
    if (segments[0] === "exam" && segments[1]) return { name: "exam", examId: decodeURIComponent(segments[1]) };
    return { name: "home" };
  };
  const [route, setRoute] = useState(parse());
  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

// ============================================================
// Toast system
// ============================================================
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind) => {
    const id = U.uid("toast");
    setToasts((t) => [...t, { id, message, kind: kind || "info" }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }) {
  const colors = {
    info: "bg-slate-800 border-slate-700 text-slate-100",
    success: "bg-emerald-950 border-emerald-700 text-emerald-200",
    warning: "bg-amber-950 border-amber-700 text-amber-200",
    error: "bg-rose-950 border-rose-700 text-rose-200"
  };
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className={`border rounded-lg px-4 py-3 text-sm shadow-lg ${colors[t.kind] || colors.info}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Shell / Nav
// ============================================================
function NavBar() {
  return (
    <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2 group">
          <span className="w-2 h-2 rounded-full bg-sky-400 group-hover:bg-sky-300 transition" />
          <span className="font-semibold tracking-tight text-slate-100">Yassir<span className="text-sky-400">SQL</span></span>
          <span className="text-xs text-slate-500 font-mono ml-1">assessments</span>
        </a>
        <a href="#/admin" className="text-sm text-slate-400 hover:text-slate-100 transition font-mono">admin →</a>
      </div>
    </div>
  );
}

// ============================================================
// Home
// ============================================================
function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <div className="text-xs font-mono text-sky-400 mb-4">SELECT * FROM candidates WHERE ready = true;</div>
      <h1 className="text-4xl font-bold tracking-tight text-slate-100 mb-4">SQL &amp; Data Analyst Interview Platform</h1>
      <p className="text-slate-400 leading-relaxed mb-8">
        This is a technical assessment tool for evaluating SQL and analytics skills. If you're a candidate,
        you should have received a direct exam link from your interviewer — that link takes you straight to
        your assessment, no account needed. This home page is just the front door.
      </p>
      <div className="flex gap-3">
        <a href="#/admin" className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-sm transition">
          Go to admin panel
        </a>
      </div>
      <div className="mt-10 border border-slate-800 rounded-xl p-5 bg-slate-900/40">
        <p className="text-sm text-slate-500 leading-relaxed">
          <span className="text-slate-300 font-medium">Didn't get a link but were expecting an exam? </span>
          Check with whoever invited you — exam links look like{" "}
          <code className="font-mono text-sky-400">{window.location.origin + window.location.pathname}#/exam/&lt;exam-id&gt;</code>.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Admin: Gate (PAT entry)
// ============================================================
function AdminGate({ config, push }) {
  const [patInput, setPatInput] = useState("");
  const [owner, setOwner] = useState(config.githubOwner);
  const [repo, setRepo] = useState(config.githubRepo);
  const [branch, setBranch] = useState(config.githubBranch || "main");
  const [checking, setChecking] = useState(false);
  const [session, setSession] = useState(!!U.getStoredPat());

  if (session) {
    return <AdminPanel config={{ ...config, githubOwner: owner, githubRepo: repo, githubBranch: branch }} push={push} onLogout={() => { U.clearPat(); setSession(false); }} />;
  }

  const handleConnect = async () => {
    if (!patInput.trim()) { push("Paste a GitHub token first.", "warning"); return; }
    if (!owner.trim() || !repo.trim()) { push("Repo owner and name are required.", "warning"); return; }
    setChecking(true);
    U.storePat(patInput.trim());
    try {
      const result = await U.verifyPat({ githubOwner: owner, githubRepo: repo, githubBranch: branch });
      if (!result.ok) {
        U.clearPat();
        push(`Couldn't access ${owner}/${repo} with that token (status ${result.status}). Check the token's repo access and try again.`, "error");
      } else {
        push("Connected to GitHub. You're in.", "success");
        setSession(true);
      }
    } catch (e) {
      U.clearPat();
      push("Connection failed: " + e.message, "error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-20">
      <h2 className="text-2xl font-semibold text-slate-100 mb-2">Admin access</h2>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">
        The admin panel writes directly to your GitHub repo (question bank, exam templates, settings), so it
        needs a personal access token scoped to <em>this repo only</em>. The token is stored solely in this
        browser's local storage — it is never written to any file or shared with candidates.
      </p>

      <div className="space-y-4 border border-slate-800 rounded-xl p-6 bg-slate-900/40">
        <div>
          <label className="text-xs font-mono text-slate-500 block mb-1">GitHub username / org</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="text-xs font-mono text-slate-500 block mb-1">Repository name</label>
          <input value={repo} onChange={(e) => setRepo(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="text-xs font-mono text-slate-500 block mb-1">Branch</label>
          <input value={branch} onChange={(e) => setBranch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="text-xs font-mono text-slate-500 block mb-1">Personal access token</label>
          <input type="password" value={patInput} onChange={(e) => setPatInput(e.target.value)} placeholder="github_pat_..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500" />
          <p className="text-xs text-slate-600 mt-1.5">
            Create one at github.com → Settings → Developer settings → Fine-grained tokens.
            Grant it <span className="text-slate-400">Contents: Read and write</span> on this one repo only.
          </p>
        </div>
        <button onClick={handleConnect} disabled={checking}
          className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-medium text-sm transition">
          {checking ? "Connecting…" : "Connect"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Admin: Panel with tabs
// ============================================================
function AdminPanel({ config, push, onLogout }) {
  const [tab, setTab] = useState("questions");
  const tabs = [
    { id: "questions", label: "Question Bank" },
    { id: "build", label: "Build Exam" },
    { id: "exams", label: "Manage Exams" },
    { id: "settings", label: "Settings" }
  ];
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Admin panel</h2>
        <button onClick={onLogout} className="text-xs font-mono text-slate-500 hover:text-rose-400 transition">disconnect →</button>
      </div>
      <div className="flex gap-1 border-b border-slate-800 mb-8">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? "border-sky-400 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "questions" && <QuestionBankTab config={config} push={push} />}
      {tab === "build" && <ExamBuilderTab config={config} push={push} />}
      {tab === "exams" && <ExamsListTab config={config} push={push} />}
      {tab === "settings" && <SettingsTab config={config} push={push} />}
    </div>
  );
}

// ---------- Question Bank tab ----------
function emptyQuestion() {
  return {
    id: U.uid("q"),
    schemaId: "",
    title: "",
    type: "mcq",
    difficulty: "Easy",
    question: "",
    options: [{ id: "A", text: "" }, { id: "B", text: "" }, { id: "C", text: "" }],
    correct: "A",
    explanation: "",
    buggySql: "",
    correctSql: ""
  };
}

function QuestionBankTab({ config, push }) {
  const [questions, setQuestions] = useState(null);
  const [schemas, setSchemas] = useState({});
  const [editing, setEditing] = useState(null); // question object being added/edited
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([U.loadQuestions(), U.loadSchemas()])
      .then(([q, s]) => { setQuestions(q); setSchemas(s); })
      .catch((e) => push("Failed to load question bank: " + e.message, "error"));
  }, []);

  const persist = async (nextQuestions) => {
    setSaving(true);
    try {
      await U.saveQuestionsToGithub(config, nextQuestions);
      setQuestions(nextQuestions);
      push("Question bank saved to GitHub.", "success");
      setEditing(null);
    } catch (e) {
      push("Save failed: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditing = () => {
    if (!editing.title.trim() || !editing.question.trim()) {
      push("Title and question text are required.", "warning");
      return;
    }
    const exists = questions.some((q) => q.id === editing.id);
    const next = exists ? questions.map((q) => (q.id === editing.id ? editing : q)) : [...questions, editing];
    persist(next);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this question? This also removes it from any exam that references it.")) return;
    persist(questions.filter((q) => q.id !== id));
  };

  if (questions === null) return <div className="text-slate-500 text-sm">Loading question bank…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-mono text-slate-500">{questions.length} question(s)</h3>
          <button onClick={() => setEditing(emptyQuestion())}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition">+ New question</button>
        </div>
        {questions.map((q) => (
          <div key={q.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.difficulty}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.type}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.schemaId}</span>
                </div>
                <p className="text-sm text-slate-200 font-medium">{q.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{q.question}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setEditing(q)} className="text-xs text-sky-400 hover:text-sky-300">edit</button>
                <button onClick={() => handleDelete(q.id)} className="text-xs text-rose-400 hover:text-rose-300">delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-2">
        {editing ? (
          <QuestionEditor value={editing} onChange={setEditing} onSave={handleSaveEditing} onCancel={() => setEditing(null)} schemas={schemas} saving={saving} />
        ) : (
          <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-sm text-slate-600">
            Select "+ New question" or "edit" on a question to open the editor here.
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({ value, onChange, onSave, onCancel, schemas, saving }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setOption = (idx, patch) => {
    const options = value.options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    set({ options });
  };
  const addOption = () => {
    const nextId = String.fromCharCode(65 + value.options.length);
    set({ options: [...value.options, { id: nextId, text: "" }] });
  };
  const removeOption = (idx) => {
    set({ options: value.options.filter((_, i) => i !== idx) });
  };

  return (
    <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 sticky top-20 space-y-3 max-h-[75vh] overflow-y-auto">
      <div className="flex gap-2">
        <select value={value.type} onChange={(e) => set({ type: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono">
          <option value="mcq">mcq</option>
          <option value="scenario">scenario</option>
        </select>
        <select value={value.difficulty} onChange={(e) => set({ difficulty: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono">
          <option>Easy</option><option>Medium</option><option>Hard</option>
        </select>
        <select value={value.schemaId} onChange={(e) => set({ schemaId: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono flex-1">
          <option value="">— schema —</option>
          {Object.keys(schemas).map((sid) => <option key={sid} value={sid}>{schemas[sid].name}</option>)}
        </select>
      </div>

      <input value={value.title} onChange={(e) => set({ title: e.target.value })} placeholder="Question title"
        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100" />

      <textarea value={value.question} onChange={(e) => set({ question: e.target.value })} placeholder="Question prompt" rows={3}
        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100" />

      {value.type === "mcq" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-mono">options (mark the correct one)</p>
          {value.options.map((o, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="radio" checked={value.correct === o.id} onChange={() => set({ correct: o.id })} />
              <span className="text-xs font-mono text-slate-500 w-4">{o.id}</span>
              <input value={o.text} onChange={(e) => setOption(idx, { text: e.target.value })}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-100" />
              <button onClick={() => removeOption(idx)} className="text-rose-400 text-xs">×</button>
            </div>
          ))}
          <button onClick={addOption} className="text-xs text-sky-400">+ add option</button>
        </div>
      )}

      {value.type === "scenario" && (
        <div className="space-y-2">
          <textarea value={value.buggySql} onChange={(e) => set({ buggySql: e.target.value })} placeholder="Buggy SQL shown to the candidate" rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100" />
          <textarea value={value.correctSql} onChange={(e) => set({ correctSql: e.target.value })} placeholder="Reference corrected SQL (for grading, not shown to candidate)" rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100" />
        </div>
      )}

      <textarea value={value.explanation} onChange={(e) => set({ explanation: e.target.value })} placeholder="Explanation / grading notes" rows={2}
        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100" />

      <div className="flex gap-2 pt-2">
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-sm font-medium transition">
          {saving ? "Saving…" : "Save to GitHub"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition">Cancel</button>
      </div>
    </div>
  );
}

// ---------- Build Exam tab ----------
function ExamBuilderTab({ config, push }) {
  const [questions, setQuestions] = useState(null);
  const [selected, setSelected] = useState({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  useEffect(() => {
    U.loadQuestions().then(setQuestions).catch((e) => push("Failed to load questions: " + e.message, "error"));
  }, []);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const handleSave = async () => {
    if (!title.trim()) { push("Give the exam a title.", "warning"); return; }
    if (selectedIds.length === 0) { push("Select at least one question.", "warning"); return; }
    setSaving(true);
    try {
      const current = await U.loadExams();
      const examId = U.uid("exam");
      const exam = {
        examId,
        title: title.trim(),
        description: description.trim(),
        questionIds: selectedIds,
        durationMinutes: Number(duration) || 30,
        createdAt: new Date().toISOString()
      };
      const next = [...current, exam];
      await U.saveExamsToGithub(config, next);
      const link = `${window.location.origin}${window.location.pathname}#/exam/${examId}`;
      setCreatedLink(link);
      push("Exam saved and published.", "success");
    } catch (e) {
      push("Could not save exam: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (questions === null) return <div className="text-slate-500 text-sm">Loading questions…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-2">
        <h3 className="text-sm font-mono text-slate-500 mb-2">select questions ({selectedIds.length} chosen)</h3>
        {questions.map((q) => (
          <label key={q.id} className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition ${selected[q.id] ? "border-sky-600 bg-sky-950/30" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}>
            <input type="checkbox" checked={!!selected[q.id]} onChange={() => toggle(q.id)} className="mt-1" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.difficulty}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.type}</span>
              </div>
              <p className="text-sm text-slate-200">{q.title}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="lg:col-span-2">
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 sticky top-20 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title (e.g. Data Analyst — Round 1)"
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description shown to candidates" rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100" />
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-slate-500">Duration (minutes)</label>
            <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm text-slate-100" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-medium text-sm transition">
            {saving ? "Publishing…" : "Save exam & get link"}
          </button>
          {createdLink && (
            <div className="mt-2 p-3 rounded-lg bg-emerald-950/50 border border-emerald-800">
              <p className="text-xs text-emerald-300 mb-1">Share this link with candidates:</p>
              <div className="flex gap-2">
                <input readOnly value={createdLink} className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-200" />
                <button onClick={() => { navigator.clipboard.writeText(createdLink); push("Link copied.", "success"); }}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200">copy</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Manage Exams tab ----------
function ExamsListTab({ config, push }) {
  const [exams, setExams] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => U.loadExams().then(setExams).catch((e) => push("Failed to load exams: " + e.message, "error"));
  useEffect(() => { refresh(); }, []);

  const handleDelete = async (examId) => {
    if (!window.confirm("Delete this exam? Existing shared links will stop working.")) return;
    setSaving(true);
    try {
      const next = exams.filter((e) => e.examId !== examId);
      await U.saveExamsToGithub(config, next);
      setExams(next);
      push("Exam deleted.", "success");
    } catch (e) {
      push("Delete failed: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (exams === null) return <div className="text-slate-500 text-sm">Loading exams…</div>;
  if (exams.length === 0) return <div className="text-slate-500 text-sm">No exams yet — build one in the "Build Exam" tab.</div>;

  return (
    <div className="space-y-3 max-w-3xl">
      {exams.map((ex) => {
        const link = `${window.location.origin}${window.location.pathname}#/exam/${ex.examId}`;
        return (
          <div key={ex.examId} className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-100">{ex.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{ex.questionIds.length} questions · {ex.durationMinutes} min · created {new Date(ex.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { navigator.clipboard.writeText(link); push("Link copied.", "success"); }}
                className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">copy link</button>
              <button onClick={() => handleDelete(ex.examId)} disabled={saving}
                className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-rose-900 text-rose-400">delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Settings tab ----------
function SettingsTab({ config, push }) {
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setEntry = (key, val) => setForm((f) => ({ ...f, googleFormEntryIds: { ...f.googleFormEntryIds, [key]: val } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await U.saveConfigToGithub(config, form);
      push("Settings saved to GitHub. They take effect once GitHub Pages redeploys (usually under a minute).", "success");
    } catch (e) {
      push("Save failed: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const entryFields = [
    ["candidateName", "Name"], ["candidateEmail", "Email"], ["examId", "Exam ID"], ["examTitle", "Exam title"],
    ["score", "Score (correct)"], ["totalQuestions", "Total MCQ questions"], ["pasteAttempts", "Paste/copy attempts"],
    ["timeTakenSeconds", "Time taken (seconds)"], ["answersJson", "Full answers (JSON)"]
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h3 className="text-sm font-mono text-slate-500 mb-3">Repository</h3>
        <div className="grid grid-cols-3 gap-2">
          <input value={form.githubOwner} onChange={(e) => set({ githubOwner: e.target.value })} placeholder="owner"
            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 font-mono" />
          <input value={form.githubRepo} onChange={(e) => set({ githubRepo: e.target.value })} placeholder="repo"
            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 font-mono" />
          <input value={form.githubBranch} onChange={(e) => set({ githubBranch: e.target.value })} placeholder="branch"
            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 font-mono" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-mono text-slate-500 mb-1">Google Form (results collection)</h3>
        <p className="text-xs text-slate-600 mb-3">
          Create a Google Form with a short-answer field for each row below, link it to a Google Sheet
          (Responses tab → green Sheets icon), then paste the form's pre-filled link details here.
          See the README for the exact steps to get the action URL and entry IDs.
        </p>
        <input value={form.googleFormActionUrl} onChange={(e) => set({ googleFormActionUrl: e.target.value })}
          placeholder="https://docs.google.com/forms/d/e/FORM_ID/formResponse"
          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 font-mono mb-3" />
        <div className="space-y-2">
          {entryFields.map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-40 shrink-0">{label}</span>
              <input value={form.googleFormEntryIds[key] || ""} onChange={(e) => setEntry(key, e.target.value)}
                placeholder="entry.123456789"
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-mono text-slate-500 mb-2">Results sheet (optional)</h3>
        <input value={form.resultsSheetViewUrl} onChange={(e) => set({ resultsSheetViewUrl: e.target.value })}
          placeholder="https://docs.google.com/spreadsheets/d/..." 
          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 font-mono" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-medium text-sm transition">
        {saving ? "Saving…" : "Save settings to GitHub"}
      </button>

      {config.resultsSheetViewUrl && (
        <a href={config.resultsSheetViewUrl} target="_blank" rel="noreferrer"
          className="block text-sm text-sky-400 hover:text-sky-300">Open results sheet →</a>
      )}
    </div>
  );
}

// ============================================================
// Candidate: Exam Runner
// ============================================================
function ExamRunner({ examId, config, push }) {
  const [phase, setPhase] = useState("loading"); // loading | intro | running | submitted | error
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [candidate, setCandidate] = useState({ name: "", email: "" });
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [result, setResult] = useState(null);
  const containerRef = useRef(null);
  const startTimeRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    Promise.all([U.loadExams(), U.loadQuestions(), U.loadSchemas()])
      .then(([exams, allQuestions, allSchemas]) => {
        const found = exams.find((e) => e.examId === examId);
        if (!found) { setPhase("error"); return; }
        const qs = found.questionIds.map((id) => allQuestions.find((q) => q.id === id)).filter(Boolean);
        setExam(found);
        setQuestions(qs);
        setSchemas(allSchemas);
        setSecondsLeft(found.durationMinutes * 60);
        setPhase("intro");
      })
      .catch(() => setPhase("error"));
  }, [examId]);

  const submitExam = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const { correct, total } = U.scoreMcqAnswers(questions, answers);
    const timeTaken = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    const payload = {
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      examId: exam.examId,
      examTitle: exam.title,
      score: correct,
      totalQuestions: total,
      pasteAttempts: violations,
      timeTakenSeconds: timeTaken,
      answersJson: JSON.stringify(answers)
    };
    try {
      await U.submitToGoogleForm(config, payload);
    } catch (e) {
      // Non-fatal: still show the candidate their completion screen.
    }
    setResult({ correct, total });
    setPhase("submitted");
  }, [questions, answers, candidate, exam, violations, config]);

  // Timer
  useEffect(() => {
    if (phase !== "running") return;
    if (secondsLeft <= 0) { submitExam(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft, submitExam]);

  // Anti-cheat guard + leave warning
  useEffect(() => {
    if (phase !== "running" || !containerRef.current) return;
    const uninstall = U.installAntiCheatGuard(containerRef.current, () => {
      setViolations((v) => v + 1);
      push("Copy / paste is disabled during the exam. This attempt has been logged.", "warning");
    });
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { uninstall(); window.removeEventListener("beforeunload", beforeUnload); };
  }, [phase]);

  const startExam = () => {
    if (!candidate.name.trim() || !candidate.email.trim()) { push("Enter your name and email to begin.", "warning"); return; }
    startTimeRef.current = Date.now();
    setPhase("running");
  };

  const setMcqAnswer = (qId, optionId) => setAnswers((a) => ({ ...a, [qId]: optionId }));
  const setScenarioAnswer = (qId, text) => setAnswers((a) => ({ ...a, [qId]: text }));

  if (phase === "loading") return <div className="max-w-2xl mx-auto px-6 py-24 text-slate-500 text-sm">Loading exam…</div>;
  if (phase === "error") return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      <h2 className="text-xl font-semibold text-slate-100 mb-2">Exam not found</h2>
      <p className="text-sm text-slate-500">This link may be broken, or the exam was removed. Contact your interviewer for a new link.</p>
    </div>
  );

  if (phase === "intro") {
    return (
      <div className="max-w-xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold text-slate-100 mb-1">{exam.title}</h2>
        {exam.description && <p className="text-sm text-slate-500 mb-6">{exam.description}</p>}
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40 mb-6 space-y-2 text-sm text-slate-400">
          <p>• {questions.length} question(s), {exam.durationMinutes} minutes total</p>
          <p>• The timer starts as soon as you click Start and auto-submits at zero</p>
          <p>• Copy / paste is disabled during the exam and attempts are logged</p>
          <p>• You can navigate between questions freely before submitting</p>
        </div>
        <div className="space-y-3 mb-6">
          <input value={candidate.name} onChange={(e) => setCandidate((c) => ({ ...c, name: e.target.value }))} placeholder="Full name"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100" />
          <input value={candidate.email} onChange={(e) => setCandidate((c) => ({ ...c, email: e.target.value }))} placeholder="Email address"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100" />
        </div>
        <button onClick={startExam} className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-sm transition">
          Start exam
        </button>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold text-slate-100 mb-2">Thanks, {candidate.name.split(" ")[0]}</h2>
        <p className="text-sm text-slate-500 mb-6">Your responses have been recorded. Your interviewer will follow up on next steps.</p>
        {result && result.total > 0 && (
          <div className="inline-block border border-slate-800 rounded-xl px-6 py-4 bg-slate-900/40">
            <p className="text-xs text-slate-500 font-mono mb-1">multiple-choice score</p>
            <p className="text-2xl font-semibold text-slate-100">{result.correct} / {result.total}</p>
            <p className="text-xs text-slate-600 mt-1">Scenario / written questions are reviewed manually.</p>
          </div>
        )}
      </div>
    );
  }

  // running
  const q = questions[current];
  const schema = schemas[q.schemaId];
  const timerLow = secondsLeft <= 60;

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 sticky top-16 bg-slate-950/95 backdrop-blur py-3 z-30">
        <div className="flex items-center gap-2">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-7 h-7 rounded-md text-xs font-mono transition ${i === current ? "bg-sky-500 text-slate-950" : answers[questions[i].id] ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className={`font-mono text-sm px-3 py-1.5 rounded-lg border ${timerLow ? "border-rose-700 text-rose-400 bg-rose-950/40" : "border-slate-800 text-slate-300 bg-slate-900/60"}`}>
          {U.formatSeconds(secondsLeft)}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{q.difficulty}</span>
        {schema && <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{schema.name}</span>}
      </div>
      <h3 className="text-lg font-semibold text-slate-100 mb-3">{q.title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed mb-5">{q.question}</p>

      {schema && (
        <div className="mb-5 border border-slate-800 rounded-lg p-4 bg-slate-900/40 text-xs font-mono text-slate-400 select-none">
          {schema.tables.map((t) => (
            <div key={t.name} className="mb-1.5">
              <span className="text-sky-400">{t.name}</span>: {t.cols.join(", ")}
            </div>
          ))}
        </div>
      )}

      {q.type === "mcq" && (
        <div className="space-y-2">
          {q.options.map((o) => (
            <label key={o.id} className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition ${answers[q.id] === o.id ? "border-sky-600 bg-sky-950/30" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}>
              <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setMcqAnswer(q.id, o.id)} className="mt-1" />
              <span className="text-sm font-mono text-slate-200">{o.text}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === "scenario" && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-mono text-slate-500 mb-1">buggy query</p>
            <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-amber-300 overflow-x-auto select-none">{q.buggySql}</pre>
          </div>
          <div>
            <p className="text-xs font-mono text-slate-500 mb-1">your analysis + corrected query</p>
            <textarea rows={8} value={answers[q.id] || ""} onChange={(e) => setScenarioAnswer(q.id, e.target.value)}
              placeholder="Explain the flaw(s) and write the corrected SQL here…"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500" />
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm transition">← previous</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition">next →</button>
        ) : (
          <button onClick={() => { if (window.confirm("Submit the exam? You can't change answers afterward.")) submitExam(); }}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition">Submit exam</button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// App root
// ============================================================
function App() {
  const route = useHashRoute();
  const { toasts, push } = useToasts();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    U.loadConfig().then(setConfig).catch(() => push("Could not load config.json", "error"));
  }, []);

  if (!config) return <div className="max-w-2xl mx-auto px-6 py-24 text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="min-h-screen">
      {route.name !== "exam" && <NavBar />}
      <ToastStack toasts={toasts} />
      {route.name === "home" && <HomePage />}
      {route.name === "admin" && <AdminGate config={config} push={push} />}
      {route.name === "exam" && <ExamRunner examId={route.examId} config={config} push={push} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
