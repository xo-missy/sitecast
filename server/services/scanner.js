import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';

const impact = {
  'missing-title': 'Search engines and browser tabs cannot identify your page, costing you search rankings, search visibility, and organic visitor traffic.',
  'title-length': 'An improperly sized title will display truncated in search results, looking unprofessional and costing you clicks from potential buyers.',
  'missing-description': 'Search engines will display random page snippets instead of a compelling pitch, costing you search click-throughs and customer interest.',
  'missing-h1': 'Search bots and human readers cannot quickly identify the page purpose, costing you initial engagement and increasing immediate bounces.',
  'multiple-h1': 'Diluted search relevancy from competing headings confuses search engines, costing you organic keyword rankings.',
  'heading-skip': 'Disabled users lose clean section transitions, costing you sales from an accessible audience segment and risking compliance issues.',
  'missing-alt': 'Screen readers cannot describe images, costing you sales from visually impaired visitors and lowering search engine image discovery.',
  'missing-viewport': 'The page will look tiny and broken on phones, costing you mobile conversions as over 50% of web traffic is mobile.',
  'slow-load': 'Slow loads directly spike page bounces. A delay of just a few seconds costs you valuable leads and drives customers to competitors.',
  'large-images': 'Oversized images delay mobile page rendering and exhaust data limits, costing you page views from mobile visitors on slower networks.'
};
const issue = (category, severity, type, title, description, fixSuggestion, fixSnippet = null) => ({
  category, severity, title, description, businessImpact: impact[type], fixSuggestion, fixSnippet,
  quickWin: ['high', 'medium'].includes(severity) && Boolean(fixSnippet)
});
const score = (issues, base = 100) => Math.max(0, base - issues.reduce((n, i) => n + ({ high: 25, medium: 12, low: 5 }[i.severity]), 0));

export async function scanSite(url, light = false, onProgress = null) {
  let browser;
  let html;
  let text = '';
  let loadTime;
  let responseStatus;
  let useFallback = false;
  let fallbackError = null;
  const progress = async (id, text, level = 'ok') => {
    if (!onProgress) return;
    try { await onProgress(id, text, level); } catch (error) { console.warn('Could not save scan progress:', error.message); }
  };

  try {
    await progress('browser', 'Launching a clean browser session…');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH })
    });
    const page = await browser.newPage();

    // Masquerade as a standard browser to avoid bot detection/blocks
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    await page.setViewport({ width: 1440, height: 900, isMobile: false });
    await progress('request', `Requesting ${new URL(url).hostname}…`);
    const started = Date.now();
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    loadTime = Date.now() - started;
    html = await page.content();
    responseStatus = response?.status();
    await progress('load-time', `Measuring page load timing… [${(loadTime / 1000).toFixed(1)}s]`);
    
    try {
      text = (await page.locator('body').innerText()).slice(0, 12000);
    } catch {
      text = '';
    }

    if (!light) {
      if (!fs.existsSync('screenshots')) {
        fs.mkdirSync('screenshots');
      }
      await page.screenshot({ path: `screenshots/${Date.now()}.png`, fullPage: false }).catch(error => {
        console.error(`Site screenshot failed for ${url}:`, error);
      });
    }
  } catch (error) {
    console.warn(`Puppeteer scan failed, attempting fallback static scan:`, error.message);
    fallbackError = error;
    useFallback = true;
  } finally {
    if (browser) await browser.close();
  }

  if (useFallback) {
    try {
      await progress('fallback', 'Browser unavailable. Switching to static page inspection…', 'info');
      const started = Date.now();
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
      });
      loadTime = Date.now() - started;
      html = response.data;
      responseStatus = response.status;
      const $temp = cheerio.load(html);
      text = $temp('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
      await progress('load-time', `Measuring page load timing… [${(loadTime / 1000).toFixed(1)}s]`);
    } catch (err) {
      const isLaunchError = fallbackError && 
        (fallbackError.message.includes('Could not find Chrome') || 
         fallbackError.message.includes('Failed to launch the browser process') ||
         fallbackError.message.includes('ENOENT'));
         
      if (isLaunchError) {
        throw new Error(`Server failed to launch browser and fallback static fetch failed. Error: ${err.message}`);
      } else {
        throw new Error(`The site is unreachable or blocking visits: ${err.message}`);
      }
    }
  }

  const $ = cheerio.load(html); const seo = [], accessibility = [], mobile = [], performance = [];
  await progress('performance', 'Inspecting performance signals…');
  const large = $('img').filter((_, el) => Number($(el).attr('width')) > 1600).length;
  if (large) performance.push(issue('performance', 'medium', 'large-images', 'Potentially oversized images', `${large} image${large > 1 ? 's are' : ' is'} declared wider than 1600px.`, 'Serve responsive WebP/AVIF images at the rendered size.', '<img src="hero.webp" width="1200" alt="Descriptive image text">'));
  if (loadTime > 3000) performance.push(issue('performance', loadTime > 6000 ? 'high' : 'medium', 'slow-load', 'Page load is slow', `The page took ${(loadTime / 1000).toFixed(1)} seconds to load.`, 'Reduce render-blocking work, optimize images, and cache static assets.'));
  await progress('performance', `Performance signals checked… [${score(performance)} / 100]`);

  await progress('seo', 'Inspecting search visibility and page structure…');
  const title = $('title').text().trim();
  if (!title) seo.push(issue('seo', 'high', 'missing-title', 'Missing page title', 'No <title> tag was found.', 'Add a concise, descriptive title.', '<title>Your clear page title | Brand</title>'));
  else if (title.length < 20 || title.length > 60) seo.push(issue('seo', 'medium', 'title-length', 'Title length needs attention', `Your title is ${title.length} characters; aim for 20–60.`, 'Rewrite the title to make it concise and specific.'));
  if (!$('meta[name="description"]').attr('content')) seo.push(issue('seo', 'medium', 'missing-description', 'Missing meta description', 'No meta description was found.', 'Add a benefit-led summary under 160 characters.', '<meta name="description" content="A clear benefit-led summary of this page.">'));
  const h1 = $('h1').length; if (!h1) seo.push(issue('seo', 'high', 'missing-h1', 'Missing H1 heading', 'This page has no primary H1 heading.', 'Add one descriptive H1 near the start of the main content.', '<h1>Clear page headline</h1>'));
  if (h1 > 1) seo.push(issue('seo', 'medium', 'multiple-h1', 'Multiple H1 headings', `Found ${h1} H1 headings.`, 'Keep one H1 and make other headings H2s.'));
  let previous = 0, skipped = false; $('h1,h2,h3,h4,h5,h6').each((_, el) => { const level = Number(el.tagName[1]); if (previous && level > previous + 1) skipped = true; previous = level; });
  await progress('seo', `Search visibility checked… [${score(seo)} / 100]`);

  await progress('accessibility', 'Checking accessibility signals…');
  if (skipped) accessibility.push(issue('accessibility', 'low', 'heading-skip', 'Heading levels are skipped', 'The heading outline jumps between levels.', 'Use headings in sequence, without skipping levels.'));
  const missingAlt = $('img').filter((_, el) => !$(el).attr('alt')).length;
  if (missingAlt) accessibility.push(issue('accessibility', missingAlt > 2 ? 'high' : 'medium', 'missing-alt', `${missingAlt} image${missingAlt > 1 ? 's' : ''} missing alt text`, 'Images without an alt attribute were found.', 'Describe the image purpose in an alt attribute.', '<img src="product.jpg" alt="Customer using the product">'));
  await progress('accessibility', `Accessibility signals checked… [${score(accessibility)} / 100]`);

  await progress('mobile', 'Checking mobile experience signals…');
  if (!$('meta[name="viewport"]').length) mobile.push(issue('mobile', 'high', 'missing-viewport', 'Missing mobile viewport tag', 'The page does not declare a responsive viewport.', 'Add the viewport meta tag in <head>.', '<meta name="viewport" content="width=device-width, initial-scale=1">'));
  await progress('mobile', `Mobile experience checked… [${score(mobile)} / 100]`);

  const categories = { performance: { score: score(performance), issues: performance }, seo: { score: score(seo), issues: seo }, accessibility: { score: score(accessibility), issues: accessibility }, mobile: { score: score(mobile), issues: mobile } };
  return { categories, overallScore: Math.round(Object.values(categories).reduce((n, c) => n + c.score, 0) / 4), pageText: text, loadTime, statusCode: responseStatus };
}
