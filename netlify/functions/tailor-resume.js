<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Resume Tailor</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <style>
    :root {
      --bg: #0b1220;
      --panel: rgba(15, 23, 42, 0.92);
      --panel2: rgba(2, 6, 23, 0.55);
      --border: rgba(148, 163, 184, 0.22);
      --text: #e5e7eb;
      --muted: #9ca3af;
      --accent: #ff9900;
      --accent2: #f29100;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --shadow: 0 12px 40px rgba(0,0,0,0.5);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--sans);
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 10% 0%, rgba(255,153,0,0.13), transparent 60%),
        radial-gradient(900px 500px at 80% 10%, rgba(59,130,246,0.10), transparent 60%),
        radial-gradient(1000px 700px at 50% 100%, rgba(16,185,129,0.07), transparent 60%),
        linear-gradient(180deg, #050814 0%, #070b18 40%, #050814 100%);
      padding: 18px;
      display: flex;
      justify-content: center;
    }

    .container { width: 100%; max-width: 1200px; }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--panel);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow);
      margin-bottom: 14px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dot {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      background: var(--accent);
      box-shadow: 0 0 0 3px rgba(255,153,0,0.10);
    }

    .brand h1 {
      font-size: 14px;
      margin: 0;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .brand .sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }

    .badge {
      font-size: 12px;
      color: var(--muted);
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(2,6,23,0.35);
    }

    .layout {
      display: grid;
      gap: 14px;
    }

    @media (min-width: 980px) {
      .layout { grid-template-columns: 260px 1fr; }
    }

    .sidebar {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 12px;
      height: fit-content;
    }

    .navtitle {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 6px 10px 10px;
    }

    .navlink {
      display: block;
      padding: 10px 10px;
      border-radius: 12px;
      color: var(--muted);
      text-decoration: none;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease, border 150ms ease;
      border: 1px solid transparent;
      user-select: none;
    }

    .navlink:hover {
      color: var(--text);
      background: rgba(148,163,184,0.08);
      border-color: rgba(148,163,184,0.10);
    }

    .navlink.active {
      color: var(--text);
      background: rgba(255,153,0,0.10);
      border-color: rgba(255,153,0,0.22);
    }

    .main {
      display: grid;
      gap: 14px;
    }

    .card {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 16px;
    }

    .grid2 {
      display: grid;
      gap: 14px;
    }
    @media (min-width: 980px) {
      .grid2 { grid-template-columns: 1fr 1fr; }
    }

    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin: 2px 0 8px;
    }

    .title {
      font-size: 18px;
      margin: 0 0 6px;
    }

    .desc {
      margin: 0 0 12px;
      color: var(--muted);
      line-height: 1.35;
      font-size: 13px;
    }

    input, textarea, select {
      width: 100%;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(2,6,23,0.55);
      color: var(--text);
      padding: 12px 12px;
      outline: none;
      transition: box-shadow 120ms ease, border 120ms ease;
      font-size: 13px;
    }

    textarea {
      min-height: 360px;
      resize: vertical;
      font-family: var(--mono);
      line-height: 1.35;
      white-space: pre-wrap;
    }

    input:focus, textarea:focus, select:focus {
      border-color: rgba(255,153,0,0.55);
      box-shadow: 0 0 0 3px rgba(255,153,0,0.12);
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .radio {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.14);
      background: rgba(2,6,23,0.25);
    }

    .radio input { width: auto; accent-color: var(--accent); }

    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    button {
      border: none;
      cursor: pointer;
      border-radius: 999px;
      padding: 12px 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      font-size: 13px;
      transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease, border 120ms ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      user-select: none;
    }

    .primary {
      background: var(--accent);
      color: #111827;
      box-shadow: 0 14px 34px rgba(0,0,0,0.5);
      flex: 1 1 220px;
    }
    .primary:hover { background: var(--accent2); transform: translateY(-1px); }
    .primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .ghost {
      background: transparent;
      color: var(--muted);
      border: 1px solid rgba(148,163,184,0.28);
      flex: 0 0 auto;
    }
    .ghost:hover { color: var(--text); border-color: rgba(255,153,0,0.55); }

    .spinner {
      width: 16px;
      height: 16px;
      border-radius: 999px;
      border: 2px solid rgba(17,24,39,0.30);
      border-top-color: #111827;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .status {
      margin-top: 10px;
      min-height: 18px;
      color: var(--muted);
      font-size: 12px;
    }

    .splitHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .miniBtn {
      font-size: 12px;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.28);
      background: rgba(2,6,23,0.30);
      color: var(--muted);
    }
    .miniBtn:hover { border-color: rgba(255,153,0,0.55); color: var(--text); }

    .summaryBox {
      background: rgba(2,6,23,0.42);
      border: 1px solid rgba(148,163,184,0.18);
      border-radius: 14px;
      padding: 12px;
      font-size: 13px;
      color: var(--text);
      line-height: 1.35;
      white-space: pre-wrap;
      font-family: var(--sans);
    }

    .hidden { display: none; }
  </style>
</head>

<body>
  <div class="container">
    <div class="topbar">
      <div class="brand">
        <div class="dot"></div>
        <div>
          <h1>Resume Tailor</h1>
          <div class="sub">Baseline-only tailoring · No invented experience</div>
        </div>
      </div>
      <div class="badge">mjsmrh.netlify.app</div>
    </div>

    <div class="layout">
      <aside class="sidebar">
        <div class="navtitle">Navigation</div>
        <a id="navTailor" class="navlink active">Tailor Resume</a>
        <a id="navHistory" class="navlink">History (later)</a>
        <a class="navlink" style="opacity:.55; cursor:not-allowed;">Settings (later)</a>
      </aside>

      <main class="main">
        <section id="tailorView" class="card">
          <div class="label">Job Posting</div>
          <h2 class="title">Generate a tailored resume</h2>
          <p class="desc">Paste a job URL. The resume is generated using only your baseline resume as the source of truth.</p>

          <div class="label">Job Posting URL</div>
          <input id="jobUrl" type="url" placeholder="https://job-boards.greenhouse.io/company/jobs/..." />

          <div class="label" style="margin-top:12px;">Mode</div>
          <div class="row">
            <label class="radio">
              <input type="radio" name="mode" value="full" checked />
              Full resume
            </label>
            <label class="radio">
              <input type="radio" name="mode" value="one_page" />
              One-page condensed
            </label>
          </div>

          <div class="actions">
            <button id="runButton" class="primary">
              <span id="btnLabel">Generate</span>
              <span id="spinner" class="spinner hidden"></span>
            </button>
            <button id="copyResume" class="ghost">Copy resume</button>
            <button id="copySummary" class="ghost">Copy summary</button>
          </div>

          <div id="status" class="status"></div>
        </section>

        <section class="grid2">
          <section class="card">
            <div class="splitHeader">
              <div>
                <div class="label">Tailoring Summary</div>
                <div class="desc" style="margin:0;">What was emphasized (baseline-backed).</div>
              </div>
            </div>
            <div id="summaryBox" class="summaryBox">No summary yet. Generate a resume to see how it was tailored.</div>
          </section>

          <section class="card">
            <div class="splitHeader">
              <div>
                <div class="label">Resume Output</div>
                <div class="desc" style="margin:0;">ATS-friendly plain text.</div>
              </div>
            </div>
            <textarea id="output" placeholder="Your tailored resume will appear here."></textarea>
          </section>
        </section>

        <section id="historyView" class="card hidden">
          <div class="label">History</div>
          <h2 class="title">History</h2>
          <p class="desc">We can re-add history once your backend is stable. For now, this is disabled.</p>
        </section>
      </main>
    </div>
  </div>

  <script>
    // Basic view switching (history disabled for now)
    const navTailor = document.getElementById("navTailor");
    const navHistory = document.getElementById("navHistory");
    const tailorView = document.getElementById("tailorView");
    const historyView = document.getElementById("historyView");

    navTailor.addEventListener("click", () => {
      navTailor.classList.add("active");
      navHistory.classList.remove("active");
      tailorView.classList.remove("hidden");
      document.querySelector(".grid2").classList.remove("hidden");
      historyView.classList.add("hidden");
    });

    navHistory.addEventListener("click", () => {
      navHistory.classList.add("active");
      navTailor.classList.remove("active");
      tailorView.classList.add("hidden");
      document.querySelector(".grid2").classList.add("hidden");
      historyView.classList.remove("hidden");
    });

    const runButton = document.getElementById("runButton");
    const spinner = document.getElementById("spinner");
    const btnLabel = document.getElementById("btnLabel");
    const statusEl = document.getElementById("status");
    const outputEl = document.getElementById("output");
    const jobUrlInput = document.getElementById("jobUrl");
    const summaryBox = document.getElementById("summaryBox");
    const copyResumeBtn = document.getElementById("copyResume");
    const copySummaryBtn = document.getElementById("copySummary");

    function getSelectedMode() {
      const radios = document.querySelectorAll('input[name="mode"]');
      for (const r of radios) if (r.checked) return r.value;
      return "full";
    }

    function setLoading(isLoading) {
      if (isLoading) {
        runButton.disabled = true;
        btnLabel.textContent = "Generating...";
        spinner.classList.remove("hidden");
      } else {
        runButton.disabled = false;
        btnLabel.textContent = "Generate";
        spinner.classList.add("hidden");
      }
    }

    runButton.addEventListener("click", async () => {
      const jobUrl = jobUrlInput.value.trim();
      if (!jobUrl) {
        statusEl.textContent = "Enter a job posting URL.";
        return;
      }

      const mode = getSelectedMode();
      statusEl.textContent = "Generating resume + tailoring summary...";
      outputEl.value = "";
      summaryBox.textContent = "Generating tailoring summary...";
      setLoading(true);

      try {
        const response = await fetch("/.netlify/functions/tailor-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobUrl, mode }),
        });

        const rawText = await response.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { data = null; }

        if (!response.ok) {
          const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : response.statusText;
          statusEl.textContent = `Error (${response.status}): ${errMsg}`;
          summaryBox.textContent = data ? JSON.stringify(data, null, 2) : rawText;
          setLoading(false);
          return;
        }

        outputEl.value = data.resume || "";
        summaryBox.textContent = data.tailoringSummary || "No summary returned.";
        statusEl.textContent = `Done. ReqId: ${(data.meta && data.meta.reqId) ? data.meta.reqId : "n/a"} · Model: ${(data.meta && data.meta.modelUsed) ? data.meta.modelUsed : "n/a"}`;
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Unexpected error. Check browser console for details.";
        summaryBox.textContent = String(e);
      } finally {
        setLoading(false);
      }
    });

    copyResumeBtn.addEventListener("click", async () => {
      const t = outputEl.value.trim();
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t);
        statusEl.textContent = "Resume copied.";
      } catch {
        statusEl.textContent = "Copy failed. Select + copy manually.";
      }
    });

    copySummaryBtn.addEventListener("click", async () => {
      const t = summaryBox.textContent.trim();
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t);
        statusEl.textContent = "Summary copied.";
      } catch {
        statusEl.textContent = "Copy failed. Select + copy manually.";
      }
    });
  </script>
</body>
</html>
