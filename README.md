# Sitecast

An AI-powered website auditor that scans a public URL for performance, SEO, accessibility, and mobile experience issues. It also includes competitor comparison, a copy tone check, a grounded report chat, and staged auto-fix views.

## Run locally

1. Create `server/.env` from `server/.env.example` and add your MongoDB connection string. An OpenAI key is optional; without one, Vibe Check and chat offer useful graceful fallback responses.
2. From the project root, run `npm run install:all`.
3. Run `npm run dev`, then open the client URL shown in the terminal (normally `http://localhost:5173`).

MongoDB is optional for a short demo: Sitecast temporarily stores audits in memory when it cannot connect. Puppeteer downloads its browser during dependency installation.
