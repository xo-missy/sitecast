import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose';
import OpenAI from 'openai'; import Audit from './models/Audit.js'; import { scanSite } from './services/scanner.js';

const app = express(); app.use(cors()); app.use(express.json({ limit: '1mb' }));
const PORT = process.env.PORT || 5000; const memory = new Map(); let dbReady = false;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sitecast', { serverSelectionTimeoutMS: 2500 }).then(() => { dbReady = true; console.log('MongoDB connected'); }).catch(() => console.warn('MongoDB unavailable — using temporary in-memory audits.'));
const validUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
const save = async audit => { if (dbReady) return audit.save(); memory.set(String(audit._id), audit); return audit; };
const find = async id => dbReady ? Audit.findById(id) : memory.get(id);
const newAudit = data => dbReady ? new Audit(data) : { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), ...data };
const ai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.post('/api/audit', async (req, res) => {
  const url = validUrl(req.body.url); if (!url) return res.status(400).json({ error: 'Enter a valid http(s) URL.' });
  const audit = newAudit({ url, status: 'pending' }); await save(audit); res.status(202).json({ auditId: audit._id });
  scanSite(url).then(async data => { Object.assign(audit, data, { status: 'complete' }); await save(audit); }).catch(async err => { audit.status = 'failed'; audit.error = err.message.includes('Timeout') ? 'The site took too long to respond. Try again or check the URL.' : `Scan failed: ${err.message}`; await save(audit); });
});
app.get('/api/audit/:id', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); res.json(audit); });
app.post('/api/audit/:id/compare', async (req, res) => {
  const audit = await find(req.params.id), competitorUrl = validUrl(req.body.competitorUrl); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); if (!competitorUrl) return res.status(400).json({ error: 'Enter a valid competitor URL.' });
  try { const them = await scanSite(competitorUrl, true), you = audit; const metrics = { loadTime: { you: you.loadTime || 0, them: them.loadTime }, mobileScore: { you: you.categories.mobile.score, them: them.categories.mobile.score }, seoScore: { you: you.categories.seo.score, them: them.categories.seo.score }, accessibilityScore: { you: you.categories.accessibility.score, them: them.categories.accessibility.score } }; const battleCard = [];
    Object.entries(metrics).forEach(([name, pair]) => battleCard.push({ type: (name === 'loadTime' ? pair.you < pair.them : pair.you > pair.them) ? 'winning' : 'steal', text: `${name === 'loadTime' ? 'Speed' : name.replace('Score', '')}: ${name === 'loadTime' ? Math.round(pair.you) + 'ms vs ' + Math.round(pair.them) + 'ms' : pair.you + ' vs ' + pair.them}` }));
    audit.competitorComparison = { competitorUrl, metrics, battleCard }; await save(audit); res.json(audit.competitorComparison);
  } catch { res.status(422).json({ error: 'We could not scan that competitor. Check that it is publicly reachable.' }); }
});
app.post('/api/audit/:id/vibe-check', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' });
  if (!ai) { audit.vibeCheck = { tone: 'Clear and functional', summary: 'Add an OpenAI API key to unlock a deeper tone reading. The report remains fully available.', sampleRewrite: 'Start with the customer benefit, then make the next step unmistakably clear.' }; await save(audit); return res.json(audit.vibeCheck); }
  try { const result = await ai.chat.completions.create({ model: 'gpt-5.6', messages: [{ role: 'system', content: 'Return concise JSON with keys tone, summary, sampleRewrite. Analyze only supplied website copy.' }, { role: 'user', content: audit.pageText || '' }], response_format: { type: 'json_object' } }); audit.vibeCheck = JSON.parse(result.choices[0].message.content); await save(audit); res.json(audit.vibeCheck); } catch { res.status(503).json({ error: 'Vibe Check is unavailable right now.' }); }
});
app.post('/api/audit/:id/ask', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); const question = String(req.body.question || '').trim(); if (!question) return res.status(400).json({ error: 'Ask a question first.' }); const issues = Object.values(audit.categories || {}).flatMap(c => c.issues || []);
  if (!ai) return res.json({ answer: `Based on this audit, ${issues[0] ? 'start with “' + issues[0].title + '”: ' + issues[0].businessImpact : 'no issues were detected yet.'} Add an OpenAI API key for conversational answers.` });
  try { const completion = await ai.chat.completions.create({ model: 'gpt-5.6', messages: [{ role: 'system', content: 'Answer plainly and only from this Sitecast audit data. If unsupported, say so. Audit: ' + JSON.stringify(issues) }, { role: 'user', content: question }] }); res.json({ answer: completion.choices[0].message.content }); } catch { res.status(503).json({ error: 'Chat is temporarily unavailable.' }); }
});
app.patch('/api/audit/:id/issues/:issueId', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); let found; Object.values(audit.categories || {}).forEach(c => (c.issues || []).forEach(i => { if (String(i._id) === req.params.issueId) { i.resolved = true; found = i; } })); if (!found) return res.status(404).json({ error: 'Issue not found.' }); await save(audit); res.json(found); });
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Sitecast API on ${PORT}`));
}
export default app;
