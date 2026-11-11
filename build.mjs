// Statische site generator voor Werken bij Workspace 365. Geen dependencies.
// Gebruik: node build.mjs   (Netlify draait dit bij elke deploy)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Hash achter site.js, want /assets/* wordt een jaar gecachet en een oude site.js laat formulieren stuk gaan.
const SITE_JS_VERSION = createHash('sha256').update(readFileSync(new URL('./public/assets/site.js', import.meta.url))).digest('hex').slice(0, 10);

const ROOT = new URL('.', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const SITE = process.env.SITE_URL || 'https://werkenbij.workspace365.net';
const LANGS = ['nl', 'en'];

const routes = json('data/routes.json');
const seo = json('data/seo.json');
const pitches = json('data/pitches.json');
const people = json('data/people.json');
const vacancyEn = process.env.VACANCY_EN_FILE ? JSON.parse(readFileSync(process.env.VACANCY_EN_FILE, 'utf8')) : json('data/vacancy-en.json');

// ---------- Vacatures (Recruitee) ----------
const RECRUITEE = 'https://jobs.workspace365.net/api/offers/';
// Deze twee zijn geen echte vacatures maar de open sollicitatie en kennismaking.
const SKIP = new Set(['open-sollicitatie-nijkerk', 'maak-kennis-met-workspace-365']);

async function loadOffers() {
  if (process.env.RECRUITEE_FILE) return JSON.parse(readFileSync(process.env.RECRUITEE_FILE, 'utf8'));
  try {
    const headers = process.env.RECRUITEE_TOKEN ? { Authorization: 'Bearer ' + process.env.RECRUITEE_TOKEN } : {};
    const res = await fetch(RECRUITEE, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const offers = (data.offers || []).filter((o) => (o.status || 'published') === 'published');
    if (!offers.length) throw new Error('lege lijst');
    console.log(`Recruitee: ${offers.length} vacatures geladen.`);
    return offers;
  } catch (e) {
    console.warn('Recruitee niet bereikbaar (' + e.message + '). Ik gebruik de laatste snapshot.');
    return json('data/vacancies.snapshot.json');
  }
}

const L = {
  nl: { job: 'Baan', int: 'Stage', hybrid: 'Hybride', remote: 'Remote', onsite: 'Op kantoor', fixed: 'Bepaalde tijd', hrs: 'uur per week', per: 'per maand', locale: 'nl-NL' },
  en: { job: 'Job', int: 'Internship', hybrid: 'Hybrid', remote: 'Remote', onsite: 'On site', fixed: 'Fixed-term', hrs: 'hrs/week', per: '/ month', locale: 'en-GB' },
};

function toRole(o, lang) {
  const t = L[lang];
  const pitch = pitches[o.slug];
  const kind = o.employment_type_code === 'internship' ? 'int' : 'job';
  const fmt = (n) => Number(n).toLocaleString(t.locale);
  const s = o.salary || {};
  let salary = '';
  if (s.min && s.currency === 'EUR') {
    salary = '€' + fmt(s.min) + (s.max && s.max !== s.min ? '–' + fmt(s.max) : '') + ' ' + t.per;
  }
  const hasHours = o.min_hours && o.max_hours;
  const hours = hasHours ? `${o.min_hours}–${o.max_hours} ${t.hrs}` : '';
  const job = kind === 'job';
  return {
    kind,
    title: o.title,
    pitch: pitch.pitch[lang],
    slug: o.slug,
    url: o.description ? routes[lang].vacatures + o.slug + '/' : 'https://jobs.workspace365.net/o/' + o.slug,
    applyUrl: o.careers_apply_url || 'https://jobs.workspace365.net/o/' + o.slug + '/c/new',
    img: '/assets/img/' + pitch.img,
    badge: job ? t.job : t.int,
    badgeBg: job ? '#540047' : '#FEEDE7',
    badgeColor: job ? '#ffffff' : '#A6124B',
    badgeBorder: job ? '#540047' : '#FEEDE7',
    work: o.remote ? t.remote : o.hybrid ? t.hybrid : t.onsite,
    hours,
    hasContract: /fixed_term/.test(o.employment_type_code || ''),
    contract: t.fixed,
    hasSalary: !!salary,
    salary,
  };
}

// ---------- Mini template ----------
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const get = (scope, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), scope);
function render(tpl, scope) {
  tpl = tpl.replace(/<sc-if value="\{\{\s*([\w.]+)\s*\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g, (m, p, inner) => (get(scope, p) ? inner : ''));
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => {
    const v = get(scope, p);
    if (v == null) throw new Error('Onbekende waarde in template: ' + p);
    return esc(v);
  });
}


// ---------- Vacaturepagina's ----------
const T365 = {
  nl: { back: '← Alle vacatures', apply: 'Solliciteer direct', facts: 'Kerngegevens', where: 'Locatie', hours: 'Uren', contract: 'Contract', salary: 'Salaris', work: 'Werkplek', askTitle: 'Eerst een vraag?', ask: 'Mail ons op', notice: '', titlePrefix: 'Workspace 365: ' },
  en: { back: '← All open roles', apply: 'Apply now', facts: 'Key facts', where: 'Location', hours: 'Hours', contract: 'Contract', salary: 'Salary', work: 'Workplace', askTitle: 'A question first?', ask: 'Email us at', notice: 'This text has not been translated into English yet, so you see the Dutch version.', titlePrefix: 'Workspace 365: ' },
};

function clean(html) {
  let h = String(html || '');
  h = h.replace(/<(script|style|iframe|object|embed|svg)[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<p[^>]*>\s*(?:<[^>]+>\s*)*(?:Onze gezellige club|De doorgroeimogelijkheden):?\s*(?:<\/[^>]+>\s*)*<\/p>/gi, '');
  h = h.replace(/<(?!\/?(?:h3|p|ul|ol|li|strong|em|b|i|a|br)\b)[^>]*>/gi, '');
  h = h.replace(/<(h3|p|ul|ol|li|strong|em|b|i|br)\b[^>]*?(\/?)>/gi, '<$1$2>');
  h = h.replace(/<a\b([^>]*)>/gi, (m, attrs) => {
    const mm = attrs.match(/href\s*=\s*"([^"]*)"/i);
    const href = mm && /^(https?:|mailto:|tel:)/i.test(mm[1]) ? mm[1] : null;
    return href ? `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener">` : '<a>';
  });
  h = h.replace(/<a>([\s\S]*?)<\/a>/gi, '$1');
  for (let k = 0; k < 3; k++) h = h.replace(/<(p|h3|li|ul|strong|em|b|i)>(?:\s|&nbsp;)*<\/\1>/gi, '');
  return h.trim();
}

const sourceHash = (o) => createHash('sha256').update(o.description + '\n' + (o.requirements || '')).digest('hex').slice(0, 12);

// Geeft de tekst voor de gevraagde taal. Engels komt uit Recruitee (translations.en) of uit data/vacancy-en.json.
function vacancyBody(o, lang) {
  const nl = clean(o.description) + '\n' + clean(o.requirements);
  if (lang === 'nl') return { html: nl, translated: true };
  const rt = o.translations && o.translations.en;
  if (rt && rt.description) return { html: clean(rt.description) + '\n' + clean(rt.requirements), translated: true };
  const tr = vacancyEn[o.slug];
  if (tr && tr.hash === sourceHash(o)) return { html: tr.description + '\n' + tr.requirements, translated: true };
  console.warn(`LET OP: Engelse tekst van "${o.title}" ontbreekt of is verouderd (${o.slug}). De site toont de Nederlandse tekst. Laat Claude de vertaling bijwerken.`);
  return { html: nl, translated: false };
}

function jobPosting(o, body, lang, pageUrl) {
  const s = o.salary || {};
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: o.title,
    description: body,
    datePosted: (o.published_at || '').slice(0, 10) || undefined,
    employmentType: o.employment_type_code === 'internship' ? 'INTERN' : /part/.test(o.employment_type_code || '') ? 'PART_TIME' : 'FULL_TIME',
    directApply: false,
    url: pageUrl,
    inLanguage: lang,
    hiringOrganization: { '@type': 'Organization', name: 'Workspace 365', sameAs: 'https://workspace365.net' },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', streetAddress: 'Berencamperweg 6D', postalCode: '3861 MC', addressLocality: 'Nijkerk', addressCountry: 'NL' } },
  };
  if (s.min && s.currency === 'EUR') {
    ld.baseSalary = { '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', minValue: Number(s.min), maxValue: Number(s.max || s.min), unitText: 'MONTH' } };
  }
  return '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
}

function buildVacancyPages(lang, offersForPages, vp) {
  const other = lang === 'nl' ? 'en' : 'nl';
  const tpl = read(`src/templates/vacancy-${lang}.html`);
  const style = vp.match(/<style>[\s\S]*?<\/style>/)[0];
  const font = vp.match(/<!--font:(.*?)-->/)[1];
  let header = vp.match(/<header[\s\S]*?<\/header>/)[0];
  const footer = vp.match(/<footer[\s\S]*?<\/footer>/)[0];
  const t = T365[lang];
  for (const o of offersForPages) {
    const r = toRole(o, lang);
    const url = routes[lang].vacatures + o.slug + '/';
    const alt = routes[other].vacatures + o.slug + '/';
    const body = vacancyBody(o, lang);
    const notice = body.translated ? '' : `<p style="margin:0 0 24px;padding:14px 18px;border-radius:14px;background:#FEEDE7;color:#A6124B;font-weight:700;font-size:15px;max-width:none!important;">${esc(t.notice)}</p>`;
    const hdr = header.replace(new RegExp(`<a href="[^"]*" lang="${other}"`), `<a href="${alt}" lang="${other}"`);
    let page = tpl
      .replace('<!--@style-->', style)
      .replace('<!--@header-->', hdr)
      .replace('<!--@footer-->', footer);
    page = render(page, { v: { ...r, city: o.city || 'Nijkerk', backUrl: routes[lang].vacatures } });
    page = page.replace('<!--@body-->', notice + body.html);
    const title = t.titlePrefix + o.title;
    const description = r.pitch;
    const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${url}">
<link rel="alternate" hreflang="${lang}" href="${SITE}${url}">
<link rel="alternate" hreflang="${other}" href="${SITE}${alt}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE}${r.img}">
${font}
${jobPosting(o, body.html, lang, SITE + url)}
</head>
<body>
${page}
<script src="/assets/site.js?v=${SITE_JS_VERSION}" defer></script>
</body>
</html>
`;
    const dir = join(DIST, url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    urls.push(url);
  }
}

// ---------- Bouwen ----------
const offers = await loadOffers();
const known = offers.filter((o) => !SKIP.has(o.slug));
const live = known.filter((o) => pitches[o.slug]);
const missing = known.filter((o) => !pitches[o.slug]);
if (missing.length) {
  console.warn('\nLET OP: nieuwe vacatures zonder pitch en beeld (nog niet op de site):');
  missing.forEach((o) => console.warn(`  - ${o.title} (${o.slug})  voeg toe in data/pitches.json`));
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });

const urls = [];
for (const lang of LANGS) {
  const other = lang === 'nl' ? 'en' : 'nl';
  const roles = live.map((o) => toRole(o, lang));
  const counts = { all: roles.length, job: roles.filter((r) => r.kind === 'job').length, int: roles.filter((r) => r.kind === 'int').length };
  const partial = (n) => read(`src/partials/${lang}/${n}.html`);
  for (const file of readdirSync(join(ROOT, 'src/pages', lang))) {
    const key = file.replace(/\.html$/, '');
    let page = read(`src/pages/${lang}/${file}`);
    const title = page.match(/<!--title:(.*?)-->/)[1];
    const font = page.match(/<!--font:(.*?)-->/)[1];
    page = page.replace(/<!--title:.*?-->\n?/, '').replace(/<!--font:.*?-->\n?/, '');
    page = page.replace('<!--@roles-home-->', roles.map((r) => render(partial('role-card-home'), { r })).join('\n'));
    page = page.replace('<!--@roles-list-->', roles.map((r) => render(partial('role-card-list'), { r })).join('\n'));
    page = page.replace('<!--@people-->', people[lang].map((p, i) => render(partial('person-card'), { p: { ...p, i, img: '/assets/img/' + p.img } })).join('\n'));
    page = page.replace(/\{\{\s*n\.(all|job|int)\s*\}\}/g, (m, k) => counts[k]);
    let extra = '';
    if (key === 'teams') extra = '<script>window.__PEOPLE=' + JSON.stringify(people[lang].map((p) => ({ ...p, img: '/assets/img/' + p.img }))) + ';</script>';
    const url = routes[lang][key];
    const alt = routes[other][key];
    const description = seo[lang][key];
    const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${url}">
<link rel="alternate" hreflang="${lang}" href="${SITE}${url}">
<link rel="alternate" hreflang="${other}" href="${SITE}${alt}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${font}
</head>
<body>
${page}${extra}
<script src="/assets/site.js?v=${SITE_JS_VERSION}" defer></script>
</body>
</html>
`;
    const dir = join(DIST, url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    urls.push(url);
  }
  buildVacancyPages(lang, live.filter((o) => o.description), read(`src/pages/${lang}/vacatures.html`));
}

// Taalkeuze op de hoofdingang (de Netlify redirects doen het eigenlijke werk)
writeFileSync(join(DIST, 'index.html'), `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/nl/"><title>Werken bij Workspace 365</title><link rel="canonical" href="${SITE}/nl/"></head><body><a href="/nl/">Nederlands</a> | <a href="/en/">English</a></body></html>`);
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Klaar: ${urls.length} pagina's, ${live.length} vacatures.`);
