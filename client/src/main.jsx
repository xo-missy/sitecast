import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './styles.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'https://sitecast-backend.onrender.com/api' });
const labels = { performance: 'Performance', seo: 'Search visibility', accessibility: 'Accessibility', mobile: 'Mobile experience' };
const Icon = ({ children }) => <span className="mono">{children}</span>;

function hostName(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function AmbientParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dots = Array.from({ length: 46 }, () => ({
      x: 0, y: 0,
      radius: Math.random() * 1.6 + 0.6,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      alpha: Math.random() * 0.22 + 0.06
    }));
    let width = 0;
    let height = 0;
    let frame;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots.forEach(dot => {
        if (!dot.x || dot.x > width) dot.x = Math.random() * width;
        if (!dot.y || dot.y > height) dot.y = Math.random() * height;
      });
      draw();
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      dots.forEach(dot => {
        context.beginPath();
        context.fillStyle = `rgba(143, 227, 239, ${dot.alpha})`;
        context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        context.fill();
      });
    };
    const animate = () => {
      dots.forEach(dot => {
        dot.x = (dot.x + dot.vx + width) % width;
        dot.y = (dot.y + dot.vy + height) % height;
      });
      draw();
      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    if (!motion.matches) frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas className="ambient-particles" ref={canvasRef} aria-hidden="true" />;
}

function HealthPulse({ score }) {
  const state = score >= 80 ? 'healthy' : score >= 50 ? 'watch' : 'critical';
  return <div className={`health-pulse ${state}`} role="img" aria-label={`Overall site health score: ${score} out of 100`}>
    <svg className="pulse-rings" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="ring ring-one" cx="100" cy="100" r="83" />
      <circle className="ring ring-two" cx="100" cy="100" r="69" />
    </svg>
    <div className="pulse-core">
      <b>{score}</b>
      <span>/ 100</span>
      <small>HEALTH PULSE</small>
    </div>
  </div>;
}

function CategoryVisual({ category, score }) {
  if (category === 'performance') {
    const needleAngle = -95 + score * 1.9;
    return <svg className="category-visual speedometer" viewBox="0 0 100 68" aria-label={`Performance score ${score}`}>
      <path d="M14 56 A36 36 0 0 1 86 56" className="meter-track" />
      <path d="M14 56 A36 36 0 0 1 86 56" className="meter-value" pathLength="100" style={{ strokeDasharray: `${score} 100` }} />
      <line className="needle" x1="50" y1="55" x2="50" y2="23" style={{ '--needle-angle': `${needleAngle}deg` }} />
      <circle className="needle-pin" cx="50" cy="55" r="4" />
    </svg>;
  }
  if (category === 'seo') {
    const bars = [0.42, 0.65, 0.5, 0.83, 0.72, 1].map((factor, index) => Math.max(14, Math.round((score / 100) * factor * 34)));
    return <div className="category-visual seo-sparkline" aria-label={`Search visibility score ${score}`}>
      {bars.map((height, index) => <i key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * 85}ms` }} />)}
    </div>;
  }
  if (category === 'accessibility') {
    const passed = Math.max(1, Math.round(score / 20));
    return <div className="category-visual access-dots" aria-label={`${passed} of 5 accessibility signal groups passed`}>
      {Array.from({ length: 5 }, (_, index) => <i className={index < passed ? 'filled' : ''} key={index} style={{ '--dot-delay': `${index * 90}ms` }} />)}
    </div>;
  }
  return <svg className="category-visual mobile-shield" viewBox="0 0 64 64" aria-label={`Mobile experience score ${score}`} style={{ '--shield-glow-opacity': `${0.18 + score / 125}` }}>
    <path d="M32 6 52 14v15c0 13-8.5 23.8-20 29C20.5 52.8 12 42 12 29V14l20-8Z" />
    <path className="shield-check" d="m22 32 7 7 14-16" />
  </svg>;
}

function CategoryCard({ category, data }) {
  const issueCount = data.issues?.length || 0;
  return <article className={`category-card ${category}`}>
    <div className="category-card-top"><span>{labels[category]}</span><b>{data.score}</b></div>
    <CategoryVisual category={category} score={data.score} />
    <div className="score-line"><i style={{ width: `${data.score}%` }} /></div>
    <small>{issueCount ? `${issueCount} signal${issueCount === 1 ? '' : 's'} found` : 'Looking strong'}</small>
  </article>;
}

function LayoutWireframe({ variant }) {
  return <div className={`layout-wireframe ${variant}`} aria-hidden="true">
    <div className="wire-nav"><i /><i /><i /></div>
    <div className="wire-hero"><i /><i /><i /></div>
    <div className="wire-row"><i /><i /><i /></div>
    <div className="wire-content"><i /><i /><i /><i /></div>
    <div className="wire-footer"><i /><i /></div>
  </div>;
}

function GhostComparison() {
  const [position, setPosition] = useState(52);
  return <section className="ghost-comparison glass-panel">
    <div className="comparison-copy">
      <div><p className="eyebrow">GHOST COMPARISON</p><h3>See the cleaner path.</h3></div>
      <p>A structural preview of how a more focused, conversion-ready layout could feel.</p>
    </div>
    <div className="comparison-stage">
      <div className="comparison-label current-label">CURRENT</div>
      <LayoutWireframe variant="current" />
      <div className="comparison-overlay" style={{ clipPath: `inset(0 0 0 ${100 - position}%)` }}>
        <LayoutWireframe variant="optimized" />
      </div>
      <div className="comparison-label optimized-label">OPTIMIZED</div>
      <div className="comparison-handle" style={{ left: `${position}%` }} aria-hidden="true"><i>↔</i></div>
      <input className="comparison-range" type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} aria-label="Reveal optimized layout" />
    </div>
    <div className="comparison-scale"><span>Current layout</span><span>Optimized mockup</span></div>
  </section>;
}

function Landing() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = useNavigate();
  const submit = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try { const { data } = await api.post('/audit', { url }); go(`/scan/${data.auditId}`); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Something went wrong.'); setBusy(false); }
  };
  return <main className="landing page-shell">
    <nav><div className="brand">site<span>cast</span></div><div className="navnote">AI WEBSITE AUDITOR <i>●</i> LIVE</div></nav>
    <section className="hero">
      <p className="eyebrow">YOUR SITE IS TALKING. ARE YOU LISTENING?</p>
      <h1>See what’s<br/><em>holding it back.</em></h1>
      <p className="lede">One URL. A practical, prioritized report on the leaks costing your website attention, trust, and conversion.</p>
      <form className="urlbar" onSubmit={submit}><Icon>›_</Icon><input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://yourwebsite.com" type="url" required/><button disabled={busy}>{busy ? 'PREPARING…' : 'RUN AUDIT ↗'}</button></form>
      {error && <p className="formerror">{error}</p>}
      <div className="trust"><span>NO CREDIT CARD</span><span>⌁</span><span>RESULTS IN ~30 SECONDS</span><span>⌁</span><span>BUILT FOR REAL TEAMS</span></div>
    </section>
    
    <section className="features-section">
      <p className="eyebrow section-eyebrow">FEATURES SHIELD</p>
      <h2 className="section-title">A complete site audit suite</h2>
      <div className="features-grid">
        <div className="feature-card glass-panel">
          <span className="feature-icon">🎯</span>
          <h3>Prioritized Cost Audit</h3>
          <p>Scans a URL and returns a prioritized list across performance, SEO, accessibility, and mobile — each issue paired with a plain-English explanation of what it is costing your business, not just a technical score.</p>
        </div>
        <div className="feature-card glass-panel">
          <span className="feature-icon">👤</span>
          <h3>Shadow Mode</h3>
          <p>Compares your site against a competitor's and generates a comprehensive "Battle Card" detailing exactly what to fix and where you are already winning.</p>
        </div>
        
        <div className="feature-card glass-panel">
          <span className="feature-icon">⚡</span>
          <h3>Auto-Surgeon Fixes</h3>
          <p>A staged preview of the generated code fix, the first step toward full GitHub PR automation. Mark issues as resolved with one click.</p>
        </div>
      </div>
    </section>
  </main>;
}

function Scan() {
  const { auditId } = useParams();
  const go = useNavigate();
  const [audit, setAudit] = useState();
  const streamRef = useRef(null);

  useEffect(() => {
    let redirect;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/audit/${auditId}`);
        if (!active) return;
        setAudit(data);
        if (data.status === 'complete') {
          window.clearInterval(timer);
          redirect = window.setTimeout(() => go(`/report/${auditId}`), 550);
        }
      } catch { window.clearInterval(timer); }
    };
    const timer = window.setInterval(poll, 950);
    poll();
    return () => { active = false; window.clearInterval(timer); window.clearTimeout(redirect); };
  }, [auditId, go]);

  const stream = (audit?.scanUpdates || []).slice(-7);
  useEffect(() => { if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight; }, [stream.length, audit?.currentStep]);

  if (audit?.status === 'failed') return <main className="scanpage page-shell"><Link to="/" className="brand scan-brand">site<span>cast</span></Link><div className="failure glass-panel"><p className="eyebrow">AUDIT INTERRUPTED</p><h2>Scan couldn’t finish.</h2><p>{audit.error}</p><Link className="button" to="/">TRY ANOTHER URL</Link></div></main>;
  return <main className="scanpage page-shell">
    <Link to="/" className="brand scan-brand">site<span>cast</span></Link>
    <section className="scan-layout">
      <div className="scanner">
        <div className="radar"><span>◌</span></div>
        <p className="eyebrow">AUDITING <b>{audit?.url ? hostName(audit.url) : 'YOUR WEBSITE'}</b></p>
        <h2>Looking beneath<br/>the <em>surface.</em></h2>
        <p className="scan-current">{audit?.currentStep || 'Connecting to the audit stream…'}</p>
      </div>
      <section className="audit-terminal glass-panel" aria-live="polite">
        <div className="terminal-top"><span><i /> LIVE AUDIT STREAM</span><b>{stream.length ? `${stream.length} EVENTS` : 'CONNECTING'}</b></div>
        <div className="terminal-feed" ref={streamRef}>
          {!stream.length && <p className="terminal-line pending"><span>$</span> Establishing secure audit stream<span className="cursor">_</span></p>}
          {stream.map((update, index) => <p className={`terminal-line ${update.level || 'ok'}`} key={`${update.id}-${update.createdAt || index}`}><span>$</span> {update.text} <b>[{update.level === 'error' ? 'ERR' : update.level === 'info' ? '…' : 'OK'}]</b></p>)}
        </div>
      </section>
    </section>
  </main>;
}

function Chat({ auditId }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([]);
  const ask = async event => {
    event.preventDefault();
    if (!q) return;
    const question = q;
    setMsgs(messages => [...messages, { who: 'you', text: question }]); setQ('');
    try { const { data } = await api.post(`/audit/${auditId}/ask`, { question }); setMsgs(messages => [...messages, { who: 'ai', text: data.answer }]); }
    catch { setMsgs(messages => [...messages, { who: 'ai', text: 'I could not answer that right now.' }]); }
  };
  return <><button className="chatbubble" onClick={() => setOpen(!open)}>✦ ASK SITECAST</button>{open && <aside className="drawer glass-panel"><div><b>Ask about this report</b><button onClick={() => setOpen(false)} aria-label="Close chat">×</button></div><p>Get a plain-English answer grounded in your audit.</p><section>{msgs.map((message, index) => <p className={`msg ${message.who}`} key={index}>{message.text}</p>)}</section><form onSubmit={ask}><input value={q} onChange={event => setQ(event.target.value)} placeholder="What should I fix first?"/><button aria-label="Send question">↑</button></form></aside>}</>;
}

function Report() {
  const { auditId } = useParams();
  const [audit, setAudit] = useState();
  const [vibe, setVibe] = useState(false);
  useEffect(() => { api.get(`/audit/${auditId}`).then(response => setAudit(response.data)); }, [auditId]);
  const loadVibe = async () => {
    setVibe(true);
    try { const { data } = await api.post(`/audit/${auditId}/vibe-check`); setAudit(current => ({ ...current, vibeCheck: data })); }
    finally { setVibe(false); }
  };
  if (!audit) return <main className="report loading page-shell">Loading report…</main>;
  const categories = audit.categories || {};
  const issues = Object.values(categories).flatMap(category => category.issues || []);
  
  // Sort issues by severity: high -> medium -> low
  const severityOrder = { high: 1, medium: 2, low: 3 };
  const sortedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  const quick = sortedIssues.filter(issue => issue.quickWin && !issue.resolved);
  const other = sortedIssues.filter(issue => !issue.quickWin && !issue.resolved);
  return <main className="report page-shell">
    <header><Link to="/" className="brand">site<span>cast</span></Link><span className="auditurl">AUDIT REPORT · {hostName(audit.url)}</span><Link to={`/report/${auditId}/compare`}>SHADOW MODE ↗</Link></header>
    <section className="summary">
      <HealthPulse score={audit.overallScore} />
      <div className="summary-copy"><p className="eyebrow">YOUR WEBSITE HEALTH</p><h2>A clear path to<br/><em>better signals.</em></h2><p>{issues.length} opportunities found. Start with high-impact fixes and build momentum.</p></div>
      <div className="summary-meta glass-panel"><span>LIVE AUDIT</span><b>{audit.statusCode ? `HTTP ${audit.statusCode}` : 'COMPLETE'}</b><small>{audit.loadTime ? `${(audit.loadTime / 1000).toFixed(1)}s response` : 'Signals captured'}</small></div>
    </section>
    <section className="categories" aria-label="Audit category scores">{Object.entries(categories).map(([category, data]) => <CategoryCard key={category} category={category} data={data} />)}</section>
    <GhostComparison />

    <IssueGroup title="Quick wins" copy="Small changes with immediate upside." list={quick} auditId={auditId}/>
    <IssueGroup title="Worth your attention" copy="Deeper improvements to plan next." list={other} auditId={auditId}/>
   
  </main>;
}

function IssueGroup({ title, copy, list, auditId }) {
  return <section className="issues"><div className="sectionhead"><div><p className="eyebrow">{title.toUpperCase()}</p><h3>{copy}</h3></div><span>{list.length} ITEMS</span></div>{!list.length ? <div className="empty glass-panel">Nothing here — you're in great shape.</div> : list.map(issue => <article className="issue glass-panel" key={issue._id}><div className={`severity ${issue.severity}`}/><div><div className="issuehead"><span>{issue.category}</span><b>{issue.title}</b><em>{issue.severity}</em></div><p>{issue.description}</p><p className="impact"><strong>Business impact:</strong> {issue.businessImpact}</p></div><Link className="fix" to={`/report/${auditId}/fix/${issue._id}`}>AUTO-FIX ↗</Link></article>)}</section>;
}

function Compare() {
  const { auditId } = useParams();
  const [audit, setAudit] = useState();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/audit/${auditId}`).then(response => setAudit(response.data)); }, [auditId]);
  const submit = async event => {
    event.preventDefault(); setLoading(true); setErr('');
    try { await api.post(`/audit/${auditId}/compare`, { competitorUrl: url }); setAudit((await api.get(`/audit/${auditId}`)).data); }
    catch (requestError) { setErr(requestError.response?.data?.error || 'Comparison failed.'); }
    setLoading(false);
  };
  if (!audit) return <main className="report loading page-shell">Loading…</main>;
  const comparison = audit.competitorComparison;
  return <main className="report page-shell">
    <header><Link to={`/report/${auditId}`} className="brand">site<span>cast</span></Link><Link to={`/report/${auditId}`}>← REPORT</Link></header>
    <section className="comparehero">
      <p className="eyebrow">SHADOW MODE</p>
      <h2>See where you<br/><em>outpace the field.</em></h2>
      <form className="compareform glass-panel" onSubmit={submit}>
        <input required type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://competitor.com"/>
        <button>{loading ? 'SCANNING…' : 'COMPARE ↗'}</button>
      </form>
      {err && <p className="formerror">{err}</p>}
    </section>
    {comparison && <>
      <section className="versus glass-panel">
        <div><small>YOU</small><b>{hostName(audit.url)}</b></div>
        <div className="vs">VS</div>
        <div><small>THEM</small><b>{hostName(comparison.competitorUrl)}</b></div>
      </section>
      <section className="metrics">
        {Object.entries(comparison.metrics).map(([key, value]) => (
          <article className="glass-panel" key={key}>
            <span>{key.replace(/([A-Z])/g, ' $1')}</span>
            <b>{key === 'loadTime' ? `${Math.round(value.you)}ms` : value.you}</b><i>YOU</i>
            <b>{key === 'loadTime' ? `${Math.round(value.them)}ms` : value.them}</b><i>THEM</i>
          </article>
        ))}
      </section>
      
      <section className="battle-container">
        <div className="battle-column winning-column glass-panel">
          <p className="eyebrow">✓ WHERE YOU'RE WINNING</p>
          <div className="battle-cards">
            {comparison.battleCard.filter(c => c.type === 'winning').map((card, index) => (
              <div key={index} className="battle-card winning-card">
                <span className="status-badge winning-badge">✓ WINNING</span>
                <p>{card.text}</p>
              </div>
            ))}
            {comparison.battleCard.filter(c => c.type === 'winning').length === 0 && (
              <p className="empty-message">No clear technical advantages found over the competitor yet.</p>
            )}
          </div>
        </div>
        <div className="battle-column opportunity-column glass-panel">
          <p className="eyebrow">↗ OPPORTUNITIES TO FIX</p>
          <div className="battle-cards">
            {comparison.battleCard.filter(c => c.type !== 'winning').map((card, index) => (
              <div key={index} className="battle-card opportunity-card">
                <span className="status-badge opportunity-badge">↗ OPPORTUNITY</span>
                <p>{card.text}</p>
              </div>
            ))}
            {comparison.battleCard.filter(c => c.type !== 'winning').length === 0 && (
              <p className="empty-message">Outstanding! No catch-up signals found relative to the competitor.</p>
            )}
          </div>
        </div>
      </section>
    </>}
    
  </main>;
}

function Fix() {
  const { auditId, issueId } = useParams();
  const [audit, setAudit] = useState();
  const [done, setDone] = useState(false);
  useEffect(() => { api.get(`/audit/${auditId}`).then(response => setAudit(response.data)); }, [auditId]);
  if (!audit) return <main className="report loading page-shell">Loading…</main>;
  const issue = Object.values(audit.categories || {}).flatMap(category => category.issues || []).find(item => item._id === issueId);
  if (!issue) return <main className="report page-shell">Issue not found.</main>;
  const merge = async () => { await api.patch(`/audit/${auditId}/issues/${issueId}`); setDone(true); };
  return <main className="report page-shell">
    <header><Link to={`/report/${auditId}`} className="brand">site<span>cast</span></Link><Link to={`/report/${auditId}`}>← REPORT</Link></header>
    <section className="surgeon">
      <p className="eyebrow">AUTO-SURGEON · STAGED CHANGE</p>
      <h2>{issue.title}</h2>
      <p className="surgeon-description">A staged preview of the generated code fix, the first step toward full GitHub PR automation.</p>
      <p className="surgeon-suggestion">{issue.fixSuggestion}</p>
      <div className="diff glass-panel">
        <div className="diff-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="filename">surgeon_patch.diff</span>
        </div>
        <div className="diff-body">
          <div className="diff-line removed">
            <span className="diff-sign">−</span>
            <code>&lt;!-- This signal is currently missing or needs adjustment --&gt;</code>
          </div>
          <div className="diff-line added">
            <span className="diff-sign">+</span>
            <code>{issue.fixSnippet || '/* Follow implementation suggestion to resolve this issue */'}</code>
          </div>
        </div>
      </div>
      {done ? <div className="merged glass-panel">✓ Fix marked as resolved in this report.</div> : <button className="merge" onClick={merge}>MERGE FIX ↗</button>}
    </section>
  </main>;
}

function App() {
  return <div className="app-shell"><div className="ambient-backdrop" aria-hidden="true"/><AmbientParticles/><Routes><Route path="/" element={<Landing/>}/><Route path="/scan/:auditId" element={<Scan/>}/><Route path="/report/:auditId" element={<Report/>}/><Route path="/report/:auditId/compare" element={<Compare/>}/><Route path="/report/:auditId/fix/:issueId" element={<Fix/>}/></Routes></div>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
