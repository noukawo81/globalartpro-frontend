import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:5176';
  console.log('E2E Museum Globe: using base', base);
  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  try { fs.mkdirSync(artifactsDir, { recursive: true }); } catch (e) {}

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Intercept API requests and respond with a fixture so tests are isolated from backend availability
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/museum/globe')) {
      const body = JSON.stringify([
        { id: 1, circle: 'Racines', title: 'Item 1' },
        { id: 2, circle: 'Paroles', title: 'Item 2' },
        { id: 3, circle: 'Corps', title: 'Item 3' },
        { id: 4, circle: 'Terre', title: 'Item 4' },
        { id: 5, circle: 'Ciel', title: 'Item 5' },
        { id: 6, circle: 'Passage', title: 'Item 6' },
        { id: 7, circle: 'Futur', title: 'Item 7' }
      ]);
      req.respond({ status: 200, contentType: 'application/json', body });
      return;
    }
    req.continue();
  });

  // 1) Desktop: a11y (inject axe from CDN)
  await page.goto(`${base}/museum/globe`, { waitUntil: 'networkidle0' });
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.6.3/axe.min.js' });
  const axeResult = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } }));
  try {
    fs.writeFileSync(path.join(artifactsDir, 'axe-report.json'), JSON.stringify(axeResult, null, 2));
    // simple HTML report for quick viewing in artifacts
    const html = `<!doctype html><meta charset="utf-8"><title>Axe Report</title><h1>Axe Violations: ${axeResult.violations ? axeResult.violations.length : 0}</h1><pre>${JSON.stringify(axeResult.violations || [], null, 2)}</pre>`;
    fs.writeFileSync(path.join(artifactsDir, 'axe-report.html'), html);
  } catch (e) { console.warn('Failed to write artifacts', e); }

  console.log('axe violations:', (axeResult && axeResult.violations && axeResult.violations.length) || 0);
  if (axeResult.violations && axeResult.violations.length > 0) {
    console.error('A11y violations found:', axeResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })).slice(0,6));
    await browser.close();
    process.exit(1);
  }

  // 2) Keyboard interactions: focus first ring, Enter open modal, Escape close
  await page.waitForSelector('.globe-ring');
  // bring first globe ring into focus
  await page.evaluate(() => { const c = document.querySelector('.globe-ring'); if (c) c.focus(); });
  // press Enter
  await page.keyboard.press('Enter');
  await page.waitForSelector('.modal-card', { timeout: 3000 });
  console.log('Modal opened via Enter');
  // press Escape to close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const modalExists = await page.$('.modal-card');
  if (modalExists) {
    console.error('Modal did not close after Escape');
    await browser.close();
    process.exit(1);
  }
  console.log('Modal closed on Escape');

  // 3) Mobile fallback: small viewport should show .globe-card list
  await page.setViewport({ width: 400, height: 800 });
  await page.goto(`${base}/museum/globe`, { waitUntil: 'networkidle0' });
  const cards = await page.$$('.globe-card');
  if (!cards || cards.length === 0) {
    console.error('Mobile fallback list not rendered');
    await browser.close();
    process.exit(1);
  }
  console.log('Mobile fallback rendered, items:', cards.length);

  await browser.close();
  console.log('E2E museum globe checks passed');
})();