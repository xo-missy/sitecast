import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose';
import OpenAI from 'openai'; import Audit from './models/Audit.js'; import { scanSite } from './services/scanner.js';

const app = express(); app.use(cors()); app.use(express.json({ limit: '1mb' }));
const PORT = process.env.PORT || 5000; const memory = new Map(); let dbReady = false;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sitecast', { serverSelectionTimeoutMS: 15000 }).then(() => { dbReady = true; console.log('MongoDB connected'); }).catch(() => console.warn('MongoDB unavailable — using temporary in-memory audits.'));
const validUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
const save = async audit => { if (dbReady) return audit.save(); memory.set(String(audit._id), audit); return audit; };
const find = async id => dbReady ? Audit.findById(id) : memory.get(id);
const newAudit = data => dbReady ? new Audit(data) : { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), ...data };
const ai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.post('/api/audit', async (req, res) => {
  const url = validUrl(req.body.url);
  console.log(`[POST /api/audit] Received URL: "${req.body.url}" -> Validated URL: "${url}"`);
  if (!url) {
    console.warn(`[POST /api/audit] Invalid URL: "${req.body.url}"`);
    return res.status(400).json({ error: 'Enter a valid http(s) URL.' });
  }
  const audit = newAudit({
    url,
    status: 'pending',
    currentStep: 'Queueing audit…',
    scanUpdates: [{ id: 'queued', text: 'Audit queued. Preparing a clean browser session…', level: 'info' }]
  });
  await save(audit);
  console.log(`[POST /api/audit] Saved pending audit with ID: ${audit._id}`);
  res.status(202).json({ auditId: audit._id });
  const updateProgress = async (id, text, level = 'ok') => {
    audit.currentStep = text;
    audit.scanUpdates = [...(audit.scanUpdates || []).filter(update => update.id !== id), { id, text, level, createdAt: new Date() }].slice(-12);
    await save(audit);
  };
  console.log(`[POST /api/audit] Invoking scanSite for URL: "${url}"`);
  scanSite(url, false, updateProgress).then(async data => {
    console.log(`[POST /api/audit] scanSite finished for URL: "${url}". Overall Score: ${data.overallScore}, Categories:`, Object.keys(data.categories));
    await updateProgress('report', 'Compiling your audit report…');
    Object.assign(audit, data, { status: 'complete', currentStep: 'Audit complete' });
    await save(audit);
    console.log(`[POST /api/audit] Saved complete audit: ${audit._id}`);
  }).catch(async err => {
    console.error(`[POST /api/audit] scanSite failed for URL: "${url}":`, err);
    audit.status = 'failed';
    audit.error = err.message.includes('Timeout') ? 'The site took too long to respond. Try again or check the URL.' : `Scan failed: ${err.message}`;
    audit.currentStep = 'Audit failed';
    audit.scanUpdates = [...(audit.scanUpdates || []), { id: 'failed', text: audit.error, level: 'error', createdAt: new Date() }].slice(-12);
    await save(audit);
  });
});
app.get('/api/audit/:id', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); res.json(audit); });
app.post('/api/audit/:id/compare', async (req, res) => {
  const audit = await find(req.params.id), competitorUrl = validUrl(req.body.competitorUrl);
  if (!audit) return res.status(404).json({ error: 'Audit not found.' });
  if (!competitorUrl) return res.status(400).json({ error: 'Enter a valid competitor URL.' });
  
  try {
    const them = await scanSite(competitorUrl, true), you = audit;
    const metrics = {
      loadTime: { you: you.loadTime || 0, them: them.loadTime },
      mobileScore: { you: you.categories.mobile.score, them: them.categories.mobile.score },
      seoScore: { you: you.categories.seo.score, them: them.categories.seo.score },
      accessibilityScore: { you: you.categories.accessibility.score, them: them.categories.accessibility.score }
    };
    
    let battleCard = [];
    if (ai) {
      try {
        const systemPrompt = `You are the Sitecast Shadow Mode Battle Card generator. Compare our site audit with a competitor site audit.
        Our site URL is ${you.url}, Competitor site URL is ${them.url}.
        Our categories: ${JSON.stringify(you.categories)}.
        Competitor categories: ${JSON.stringify(them.categories)}.
        Return JSON format: { "battleCard": [{ "type": "winning" | "steal", "text": "plain-English battle card statement" }] }.
        'winning' represents where we outpace them. 'steal' represents opportunities where they are doing better or where we need to fix an issue.
        Keep texts concise, specific, business/cost-oriented, and professional. Make 4-6 points total.`;
        
        const response = await ai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }],
          response_format: { type: 'json_object' }
        });
        const parsed = JSON.parse(response.choices[0].message.content);
        battleCard = parsed.battleCard || [];
      } catch (err) {
        console.error("AI Shadow Mode Compare failed, using programmatic generation:", err);
      }
    }
    
    if (!battleCard.length) {
      if (you.loadTime && them.loadTime) {
        if (you.loadTime < them.loadTime) {
          battleCard.push({ type: 'winning', text: `Speed advantage: Your site loads in ${Math.round(you.loadTime)}ms, outpacing their ${Math.round(them.loadTime)}ms. This reduces immediate bounce risk.` });
        } else {
          battleCard.push({ type: 'steal', text: `Speed opportunity: They load in ${Math.round(them.loadTime)}ms while you take ${Math.round(you.loadTime)}ms. Optimize image sizes and cache assets to close the gap.` });
        }
      }
      
      const catNames = ['performance', 'seo', 'accessibility', 'mobile'];
      catNames.forEach(cat => {
        const youScore = you.categories[cat]?.score ?? 0;
        const themScore = them.categories[cat]?.score ?? 0;
        const displayName = cat === 'seo' ? 'SEO' : cat.charAt(0).toUpperCase() + cat.slice(1);
        if (youScore > themScore) {
          battleCard.push({ type: 'winning', text: `${displayName} superiority: You score ${youScore}/100 vs their ${themScore}/100, providing a more reliable user experience.` });
        } else if (youScore < themScore) {
          battleCard.push({ type: 'steal', text: `${displayName} catch-up: Competitor leads with ${themScore}/100 against your ${youScore}/100. Address outstanding ${displayName} signals.` });
        }
      });
      
      const youIssues = Object.values(you.categories).flatMap(c => c.issues || []);
      const themIssues = Object.values(them.categories).flatMap(c => c.issues || []);
      const youHasViewport = !youIssues.some(i => i.title.toLowerCase().includes('viewport'));
      const themHasViewport = !themIssues.some(i => i.title.toLowerCase().includes('viewport'));
      
      if (youHasViewport && !themHasViewport) {
        battleCard.push({ type: 'winning', text: 'Responsive Edge: Your site is mobile-configured. Competitor is failing mobile viewport check, costing them mobile conversions.' });
      } else if (!youHasViewport && themHasViewport) {
        battleCard.push({ type: 'steal', text: 'Mobile Penalty: Competitor has a responsive viewport tag while yours is missing. Fix this immediately to prevent mobile traffic loss.' });
      }
      
      if (battleCard.length === 0) {
        battleCard.push({ type: 'winning', text: 'Even field: Both sites share similar search and loading profiles. Continue optimization to pull ahead.' });
      }
    }
    
    audit.competitorComparison = { competitorUrl, metrics, battleCard };
    await save(audit);
    res.json(audit.competitorComparison);
  } catch (err) {
    res.status(422).json({ error: `We could not scan that competitor: ${err.message}` });
  }
});

app.post('/api/audit/:id/vibe-check', async (req, res) => {
  const audit = await find(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit not found.' });
  
  console.log(`[Vibe Check] Audit ID: ${audit._id}, URL: "${audit.url}". Page Copy Text Length: ${audit.pageText?.length || 0}. Extracted text preview: "${(audit.pageText || '').slice(0, 200).replace(/\s+/g, ' ')}..."`);
  
  if (ai) {
    try {
      const systemPrompt = `Analyze the website copy tone. Return JSON with keys: tone, summary, sampleRewrite.
      Make the rewrite friendlier, benefit-led, and punchy.
      Page Copy: ${audit.pageText || ''}`;
      
      const result = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: 'json_object' }
      });
      audit.vibeCheck = JSON.parse(result.choices[0].message.content);
      await save(audit);
      console.log(`[Vibe Check] OpenAI analysis succeeded. Verdict: ${audit.vibeCheck.tone}`);
      return res.json(audit.vibeCheck);
    } catch (err) {
      console.error("[Vibe Check] AI Vibe Check failed, falling back to programmatic:", err);
    }
  } else {
    console.log(`[Vibe Check] OpenAI client is not initialized (no key), using programmatic fallback.`);
  }
  
  // Programmatic fallback
  const text = (audit.pageText || '').toLowerCase();
  let tone = 'Clear & Direct';
  let summary = 'Your site copy is functional and straightforward. However, it leans towards generic statements instead of emphasizing user action and emotional connection.';
  let sampleRewrite = 'Turn technical details into visitor benefits. Start with what they get, then tell them exactly what to do next.';
  
  if (text.length > 30) {
    const companyWords = (text.match(/\b(we|us|our|company|team|enterprise)\b/g) || []).length;
    const userWords = (text.match(/\b(you|your|yours)\b/g) || []).length;
    const jargonWords = (text.match(/\b(framework|platform|synergy|leverage|utilize|maximize|optimize|solution|innovative)\b/g) || []).length;
    
    if (companyWords > userWords * 1.3) {
      tone = 'Corporate & Company-Centric';
      summary = `Your copy focuses heavily on your company (${companyWords} company references vs ${userWords} customer references). Visitors might struggle to see what's in it for them.`;
      sampleRewrite = 'Shift the focus from what you do to what they achieve. Try changing sentences starting with "We offer..." to "You can easily...".';
    } else if (jargonWords > 2) {
      tone = 'Technical & Jargon-Heavy';
      summary = 'Your copy uses abstract corporate words which increases cognitive load for first-time visitors.';
      sampleRewrite = 'Simplify the language. Instead of "leveraging advanced platforms", say "use a simple tool to get results instantly".';
    } else if (userWords > companyWords) {
      tone = 'Customer-Focused & Engaged';
      summary = 'Great job! Your copy speaks directly to the user, addressing their context and needs rather than just listing features.';
      sampleRewrite = 'Keep optimizing. Highlight your core call-to-action button and ensure the value proposition stands out within the first 3 seconds.';
    }
  }
  
  audit.vibeCheck = { tone, summary, sampleRewrite };
  await save(audit);
  res.json(audit.vibeCheck);
});

app.post('/api/audit/:id/ask', async (req, res) => {
  const audit = await find(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit not found.' });
  const question = String(req.body.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Ask a question first.' });
  const issues = Object.values(audit.categories || {}).flatMap(c => c.issues || []);
  
  if (ai) {
    try {
      const systemPrompt = `You are the Sitecast Chat Assistant, scoped to the user's specific audit results.
      Answer questions plainly, constructively, and grounded strictly in the audit data.
      If you don't know or if the question is unrelated, say so.
      Audit Issues: ${JSON.stringify(issues)}
      Overall Score: ${audit.overallScore}`;
      
      const completion = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ]
      });
      return res.json({ answer: completion.choices[0].message.content });
    } catch (err) {
      console.error("AI Chat Ask failed:", err);
      return res.status(500).json({ error: "AI Chat Assistant failed to generate a response.", details: err.message });
    }
  }
  
  // Programmatic fallback
  const q = question.toLowerCase();
  let response = '';
  
  if (q.includes('speed') || q.includes('load') || q.includes('slow') || q.includes('time')) {
    const speedIssues = issues.filter(i => i.category === 'performance');
    if (speedIssues.length > 0) {
      response = `Based on your audit, performance needs attention. We found: ${speedIssues.map(i => `"${i.title}" (${i.severity} severity) which costs you because ${i.businessImpact}`).join(' and ')}. Focus on: ${speedIssues[0].fixSuggestion}`;
    } else {
      response = `Your page load times look solid in this audit (${audit.loadTime ? Math.round(audit.loadTime) + 'ms' : 'fast'}). Keep images optimized and static files cached to stay fast.`;
    }
  } else if (q.includes('seo') || q.includes('google') || q.includes('search') || q.includes('title') || q.includes('h1') || q.includes('head')) {
    const seoIssues = issues.filter(i => i.category === 'seo');
    if (seoIssues.length > 0) {
      response = `Your SEO visibility has opportunities for improvement. The audit highlights: ${seoIssues.map(i => `"${i.title}" - ${i.businessImpact}`).join('. ')}. To fix it: ${seoIssues[0].fixSuggestion}`;
    } else {
      response = "Great job! No major SEO outline or title issues were identified. Your header structures are crawl-friendly.";
    }
  } else if (q.includes('access') || q.includes('alt') || q.includes('blind') || q.includes('screen') || q.includes('contrast')) {
    const accessIssues = issues.filter(i => i.category === 'accessibility');
    if (accessIssues.length > 0) {
      response = `Accessibility compliance is crucial. We flagged: ${accessIssues.map(i => `"${i.title}" (${i.severity} severity). ${i.businessImpact}`).join(' ')} To resolve, we recommend: ${accessIssues[0].fixSuggestion}`;
    } else {
      response = "Accessibility signals look strong! Your heading levels are clean and images are tagged.";
    }
  } else if (q.includes('mobile') || q.includes('phone') || q.includes('viewport') || q.includes('responsiv')) {
    const mobileIssues = issues.filter(i => i.category === 'mobile');
    if (mobileIssues.length > 0) {
      response = `Mobile responsiveness is critical since over 50% of traffic is mobile. ${mobileIssues.map(i => `We flagged "${i.title}": ${i.businessImpact}. ${i.fixSuggestion}`).join('. ')}`;
    } else {
      response = "Excellent! Your site is responsive and viewport settings are set properly for mobile screens.";
    }
  } else {
    const sorted = [...issues].sort((a, b) => {
      const prio = { high: 1, medium: 2, low: 3 };
      return prio[a.severity] - prio[b.severity];
    });
    if (sorted.length > 0) {
      const top = sorted[0];
      response = `Based on your audit results, the most critical issue is "${top.title}" (under ${top.category}, ${top.severity} severity). It costs you because: ${top.businessImpact}. The recommended fix is: "${top.fixSuggestion}" ${top.fixSnippet ? `(e.g., \`${top.fixSnippet}\`)` : ''}.`;
    } else {
      response = `Overall, your website scored an excellent ${audit.overallScore}/100. No major issues were detected. Keep up the high standard!`;
    }
  }
  
  res.json({ answer: response });
});
app.patch('/api/audit/:id/issues/:issueId', async (req, res) => { const audit = await find(req.params.id); if (!audit) return res.status(404).json({ error: 'Audit not found.' }); let found; Object.values(audit.categories || {}).forEach(c => (c.issues || []).forEach(i => { if (String(i._id) === req.params.issueId) { i.resolved = true; found = i; } })); if (!found) return res.status(404).json({ error: 'Issue not found.' }); await save(audit); res.json(found); });
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Sitecast API on ${PORT}`));
}
export default app;
