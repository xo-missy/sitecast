# Sitecast — AI Website Auditor

> Paste a URL. See what it's costing you — and the code to fix it.

---

## 🚀 Live Demo
 YouTube video link :

## 🔗 Links
- Live app: https://sitecast-mu.vercel.app/
- Repo: https://github.com/xo-missy/sitecast

---

## ✨ Features

- **🔍 Core Audit Engine**: Scans a live URL using Puppeteer + Cheerio and returns a prioritized report across performance, SEO, accessibility, and mobile responsiveness. Each issue includes a plain-English business-impact explanation.
- **⚔️ Shadow Mode**: Audits your site against a competitor's URL side-by-side and generates a "Battle Card" — what to fix to catch up, and where you're already winning. <!-- confirm this is working before submitting -->
- **🛠️ Auto-Surgeon**: Click "Auto-fix this" on any issue to see a staged, PR-style code diff — a preview of what a full GitHub-integrated auto-fix pipeline would generate.

---

## 🧠 How I Collaborated with Codex

I used Codex as my primary engineering partner throughout this build, from initial scaffolding through debugging a genuinely difficult deployment.

1. **Scaffolding**: Directed Codex to build a full MERN app — React (Vite) frontend, Node/Express backend, MongoDB — with the Audit/Issue data models and core API routes.
2. **The scanning engine**: Codex built the rule-based scanner, combining Puppeteer for real performance timing and Cheerio for SEO/accessibility/mobile checks. This is the core logic-heavy piece of the app.
3. **Infrastructure debugging, not just features**: A significant part of this project was environment and deployment debugging with Codex as a partner — a corrupted Puppeteer/Chrome install on Windows, a stuck port, a Vite dependency conflict, and — the hardest one — a Render-specific bug where Chrome downloaded during build but couldn't be found at runtime, caused by a build/runtime cache-path mismatch. I pasted raw error logs to Codex at each step, and it correctly diagnosed root causes I wouldn't have found alone — including eventually pointing to a `.puppeteerrc.cjs` config file as the standard fix for the Render path issue.
4. **Wiring the AI features**: Codex connected Vibe Check and Ask-Me-Anything to the OpenAI API, scoped to each audit's real extracted data so responses stay grounded rather than generic.
5. **Visual design pass**: Directed Codex to implement a glassmorphism-based UI — a Health Pulse score orb, animated bento grid for category scores, and a Ghost Comparison slider — in staged steps, verifying the real audit flow still worked after each change.

---

## 🔑 Key Engineering & Design Decisions

- **Why MongoDB over a relational DB?**: Audit results are naturally document-shaped — one audit, nested categories, nested issues — with no complex joins needed.
- **Why a rule-based scanner instead of LLM-generated findings?**: Deterministic, fast, and free to re-run. GPT-5.6 calls are reserved for the two features that genuinely need language understanding — Vibe Check and Ask-Me-Anything.
- **Why a staged Auto-Surgeon instead of live GitHub PRs?**: Given the timeline, a reliable staged preview of the generated fix was a safer MVP than a live OAuth + PR pipeline; real GitHub integration is the clear next step.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Scanning | Puppeteer, Cheerio |
| AI/LLM | OpenAI GPT-5.6 API |
| Agent | OpenAI Codex CLI |
| Deployment | Vercel (frontend), Render (backend) |

---

## 📦 Installation & Setup (For Judges)

### Prerequisites
- Node.js 18+
- A MongoDB connection string (Atlas or local)
- An OpenAI API key (only needed to re-enable Vibe Check/Ask-Me-Anything — core audit works without it)

### Steps

1. **Clone the repository**
```bash
   git clone https://github.com/xo-missy/sitecast.git
   cd sitecast
```

2. **Set up environment variables**
```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
```
   Fill in `MONGO_URI` and `OPENAI_API_KEY` in `server/.env`. `client/.env` should point to your backend, e.g. `VITE_API_URL=http://localhost:5000/api`.

3. **Install dependencies**
```bash
   npm run install:all
```

4. **Run the app**
```bash
   npm run dev
```
   Backend on `http://localhost:5000`, frontend on `http://localhost:5173`.

5. **Test it**: paste any public URL into the landing page input and click "Run audit."

---

## 📝 Codex Session

Core functionality session ID: 019f6748-af65-7b00-a53d-d858865e0393
