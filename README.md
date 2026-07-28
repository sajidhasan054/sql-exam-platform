# Yassir SQL — Interview & Assessment Platform

A static, GitHub Pages–hosted SQL/data-analyst interview platform:

- **Question bank** and **exam templates** live as JSON files in this repo and are edited from an in-app admin panel (writes go straight to GitHub via the Contents API — no server, no Apps Script).
- **Candidate results** are collected through a **Google Form linked to a Google Sheet** — also no Apps Script required.
- Candidates get a plain link (`#/exam/<id>`), enter their name and email, take a timed exam, and their answers land in your Sheet automatically.

---

## 1. Deploy to GitHub Pages

1. Create a new **public** GitHub repo (private repos work too, but candidates would need repo access to load the static files — public is simpler for sharing exam links).
2. Push all files in this folder to the repo root (`index.html`, `js/`, `data/`).
3. In the repo: **Settings → Pages → Source → Deploy from a branch → `main` / root**.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## 2. Create an admin access token

The admin panel needs permission to commit updated JSON files to your repo.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Restrict it to **this one repository**.
3. Under **Repository permissions**, set **Contents: Read and write**.
4. Generate, copy the token (starts with `github_pat_...`), and keep it somewhere safe — GitHub only shows it once.

Open `https://<your-username>.github.io/<repo-name>/#/admin`, paste the token in, confirm the owner/repo/branch fields (they're usually auto-correct), and click **Connect**. The token is stored only in that browser's local storage — never committed to the repo, never sent to candidates.

> Anyone with this token and a browser can edit your question bank and exams. Treat it like a password, and only share admin access with people you trust — this is a lightweight admin gate, not enterprise access control.

## 3. Set up results collection (Google Form → Google Sheet)

Since Apps Script is disabled on your account, use Forms' built-in Sheets link instead — no script required.

1. Go to **forms.google.com → Blank form**.
2. Add **one short-answer field per row below** (exact labels don't matter, order doesn't matter):
   - Candidate Name
   - Candidate Email
   - Exam ID
   - Exam Title
   - Score
   - Total Questions
   - Paste Attempts
   - Time Taken (seconds)
   - Answers JSON *(set this one to "Paragraph" instead of "Short answer" — answer payloads can be long)*
3. Click the **Responses** tab → click the green **Sheets icon** → **Create a new spreadsheet**. Every submission now appears as a new row automatically.
4. Get the form's submission URL and field IDs:
   - Open the live form (**Send → link icon**), open it in a new tab.
   - Right-click → **View Page Source** (or press `Ctrl+U`).
   - Search for `action="` — copy the URL, then **replace `/viewform` with `/formResponse`**. That's your `googleFormActionUrl`.
   - Search for `entry.` — each field has an ID like `entry.1234567890`. Match each one to the question you created it for (the surrounding text in the source usually names the field).
5. In the admin panel → **Settings** tab, paste the action URL and each `entry.XXXXXXXXX` ID into the matching box, then **Save settings to GitHub**.
6. Optional: paste the Sheet's URL into **Results sheet** so it's one click away from Settings.

Test it: build a one-question exam, take it yourself end-to-end, and confirm a row appears in the Sheet.

## 4. Build and share an exam

1. **Question Bank** tab — review the pre-loaded SQL questions, edit, or add your own (MCQ or open-ended "scenario" questions with a buggy query to debug).
2. **Build Exam** tab — check the questions you want, set a title, description, and time limit, then **Save exam & get link**.
3. Copy the generated link (`.../#/exam/<id>`) and send it to the candidate. That's the whole flow — no invite system, no accounts.
4. **Manage Exams** tab lets you copy links again later or delete an exam.

## What this platform can and can't do

- **Timer**: total exam countdown, auto-submits at zero. ✅
- **Copy/paste blocking**: copy, cut, paste, right-click, and Ctrl/Cmd+C/V/X are blocked during the exam, with a warning shown and a count logged to your results Sheet. This deters casual copying — it **cannot** stop a screenshot, a phone camera, or a second device, and candidates should be told plainly that the exam is proctored only in this limited sense.
- **Grading**: multiple-choice questions are scored instantly (the answer key ships to the browser to make this possible — don't reuse the same MCQ bank for take-home + on-site rounds if that matters to you). Scenario/written SQL answers are captured as free text for you to grade manually from the Sheet.
- **No login system for candidates** — the exam link itself is the access control. Anyone with the link can take the exam once your data is public on GitHub Pages; if that's a concern, consider a private repo + Pages behind an org, or add a shared passphrase gate (not included here, but straightforward to bolt on if you want it next).

## File map

```
index.html          entry point, loads Tailwind/React/Babel + the two JS files
js/utils.js          GitHub API read/write, Google Form submit, scoring, anti-cheat, timer helpers
js/app.js             the React app: routing, home, admin panel, candidate exam runner
data/questions.json  question bank (source of truth, edited via admin panel)
data/schemas.json    DB schema reference shown alongside each question
data/exams.json      saved exam templates (id, question list, duration)
data/config.json     repo target + Google Form field mapping (no secrets — PAT is never stored here)
```
