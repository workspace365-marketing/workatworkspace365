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
// Het live adres van de site. Canonical, hreflang, sitemap en robots.txt verwijzen hiernaar.
const SITE = 'https://jobs.workspace365.net';
// Extra kopregels voor zoekmachines en social: x-default, Open Graph, Twitter en bedrijfsgegevens (schema.org).
const OG_IMG = '/assets/img/og-werkenbij.jpg';
const ORG = { '@type': 'Organization', '@id': 'https://workspace365.net/#organization', name: 'Workspace 365', url: 'https://workspace365.net', logo: SITE + '/favicon.png', sameAs: ['https://www.linkedin.com/company/new-day-at-work', 'https://www.instagram.com/workspace.365/', 'https://www.tiktok.com/@life.at.workspace365', 'https://www.youtube.com/@workspace_365'], address: { '@type': 'PostalAddress', streetAddress: 'Berencamperweg 6D', postalCode: '3861 MC', addressLocality: 'Nijkerk', addressCountry: 'NL' } };
const ldTag = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';
const seoExtra = (lang, url, alt, img, withLd) => [
  `<link rel="alternate" hreflang="x-default" href="${SITE}${lang === 'nl' ? url : alt}">`,
  `<meta property="og:url" content="${SITE}${url}">`,
  `<meta property="og:site_name" content="${lang === 'nl' ? 'Werken bij Workspace 365' : 'Careers at Workspace 365'}">`,
  `<meta property="og:locale" content="${lang === 'nl' ? 'nl_NL' : 'en_GB'}">`,
  `<meta property="og:image" content="${SITE}${img}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  withLd ? ldTag({ '@context': 'https://schema.org', '@graph': [ORG, { '@type': 'WebSite', '@id': SITE + '/#website', name: lang === 'nl' ? 'Werken bij Workspace 365' : 'Careers at Workspace 365', url: SITE + '/', inLanguage: lang, publisher: { '@id': 'https://workspace365.net/#organization' } }] }) : '',
].filter(Boolean).join('\n');
const LANGS = ['nl', 'en'];

const routes = json('data/routes.json');
const seo = json('data/seo.json');
const faq = json('data/faq.json');
const pitches = json('data/pitches.json');
const people = json('data/people.json');
const vacancyEn = process.env.VACANCY_EN_FILE ? JSON.parse(readFileSync(process.env.VACANCY_EN_FILE, 'utf8')) : json('data/vacancy-en.json');

// ---------- Vacatures (Recruitee) ----------
// Recruitee zelf, niet jobs.workspace365.net: dat domein is nu deze site.
const RECRUITEE_SITE = 'https://workspace365.recruitee.com';
const RECRUITEE = RECRUITEE_SITE + '/api/offers/';
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
    url: o.description ? routes[lang].vacatures + o.slug + '/' : RECRUITEE_SITE + '/o/' + o.slug,
    applyUrl: RECRUITEE_SITE + '/o/' + o.slug + '/c/new',
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
  nl: { back: '← Alle vacatures', apply: 'Solliciteer direct', facts: 'Kerngegevens', where: 'Locatie', hours: 'Uren', contract: 'Contract', salary: 'Salaris', work: 'Werkplek', askTitle: 'Eerst een vraag?', ask: 'Mail ons op', notice: '', titleSuffix: ' | Vacature Nijkerk | Workspace 365' },
  en: { back: '← All open roles', apply: 'Apply now', facts: 'Key facts', where: 'Location', hours: 'Hours', contract: 'Contract', salary: 'Salary', work: 'Workplace', askTitle: 'A question first?', ask: 'Email us at', notice: 'This text has not been translated into English yet, so you see the Dutch version.', titleSuffix: ' | Job in Nijkerk | Workspace 365' },
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
    hiringOrganization: { '@type': 'Organization', name: 'Workspace 365', sameAs: 'https://workspace365.net', logo: SITE + '/favicon.png' },
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
    const title = o.title + t.titleSuffix;
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
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="/favicon.png?v=2" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${seoExtra(lang, url, alt, r.img, false)}
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
    // Uitgesneden portretten (met wit randje) voor de hero staan in public/assets/img/hero/. Ontbreekt er een, dan de gewone foto.
    const heroImg = (img) => { const w = 'hero/' + img.replace(/\.[a-z]+$/i, '.webp'); return '/assets/img/' + (existsSync(join(ROOT, 'public/assets/img', w)) ? w : img); };
    // Hero homepage: wisselende portretten, alleen collega's met een echte foto.
    page = page.replace('<!--@hero-portraits-->', people[lang].filter((p) => p.img !== 'bb796b5947718e0024a48d8c4756b457.jpg').map((p) => '<figure aria-hidden="true"><img src="' + heroImg(p.img) + '" alt="" loading="lazy" width="960" height="1200"><figcaption>' + esc(p.name + ' \u00b7 ' + p.role) + '</figcaption></figure>').join('\n'));
    page = page.replace('<!--@roles-list-->', roles.map((r) => render(partial('role-card-list'), { r })).join('\n'));
    // Teamleden per team (veld "kk"), met de teamnaam als kopje. Het teamfilter verbergt of toont hele groepen.
    {
      const groups = [];
      people[lang].forEach((p, i) => {
        let g = groups[groups.length - 1];
        if (!g || g.kk !== p.kk) { g = { kk: p.kk, name: p.team, cards: [] }; groups.push(g); }
        g.cards.push(render(partial('person-card'), { p: { ...p, i, img: '/assets/img/' + p.img, alt: p.img === 'bb796b5947718e0024a48d8c4756b457.jpg' ? '' : p.name + ', ' + p.role } }));
      });
      page = page.replace('<!--@people-->', groups.map((g) => '<div class="zw-grp" data-kind="' + esc(g.kk) + '"><h3 class="zw-grp-h">' + esc(g.name) + '</h3><div class="zw-grp-grid">' + g.cards.join('\n') + '</div></div>').join('\n'));
      page = page.replace('<!--@team-filters-->', [['all', lang === 'nl' ? 'Alles' : 'All'], ...groups.map((g) => [g.kk, g.name])].map(([k, n], i) => '<button type="button" data-filter="' + esc(k) + '" aria-pressed="' + (i ? 'false' : 'true') + '" style="min-height:44px;padding:10px 20px;border-radius:999px;border:1.5px solid ' + (i ? '#EEE6ED' : '#540047') + ';background:' + (i ? '#ffffff' : '#540047') + ';color:' + (i ? '#540047' : '#ffffff') + ';font-weight:700;font-size:14.5px;cursor:pointer;font-family:\'Mulish\',Arial,sans-serif;">' + esc(n) + '</button>').join(''));
    }
    // Veelgestelde vragen (data/faq.json): zichtbare tekst plus FAQPage-gegevens voor Google.
    if (page.includes('<!--@faq-->')) {
      const f = faq[lang];
      const qs = f.groups.flatMap((g) => g.items);
      const groupsHtml = f.groups.map((g) => '        <h3>' + esc(g.title) + '</h3>\n' + g.items.map((it) => '        <details><summary>' + esc(it.q) + '</summary><p>' + esc(it.a) + '</p></details>').join('\n')).join('\n');
      page = page.replace('<!--@faq-->', '<!-- FAQ -->\n  <section id="faq" style="scroll-margin-top:80px;width:100%;background:#ffffff;">\n    <div data-reveal="true" style="max-width:1180px;margin:0 auto;padding:96px 40px;">\n      <p style="font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#DE0954;">' + esc(f.eyebrow) + '</p>\n      <h2 style="font-size:clamp(30px,3.6vw,42px);line-height:1.12;font-weight:900;color:#540047;padding-top:10px;">' + esc(f.title) + '</h2>\n      <div class="zw-faq" style="max-width:900px;">\n' + groupsHtml + '\n      </div>\n    </div>\n    ' + ldTag({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })) }) + '\n  </section>');
    }
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
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="/favicon.png?v=2" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${seoExtra(lang, url, alt, OG_IMG, true)}
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
// Oude Recruitee-links (jobs.workspace365.net/o/<vacature>) komen nu op deze site binnen.
// Stuur ze naar dezelfde vacature hier, of naar het overzicht als de vacature niet meer bestaat.
{
  const lines = [];
  const add = (from, key) => {
    for (const f of [from, from + '/*']) {
      lines.push(`${f}  ${key('en')}  302  Language=en`, `${f}  ${key('nl')}  302`);
    }
  };
  for (const o of live.filter((o) => o.description)) add('/o/' + o.slug, (l) => routes[l].vacatures + o.slug + '/');
  add('/o/open-sollicitatie-nijkerk', (l) => routes[l]['open-sollicitatie']);
  add('/o', (l) => routes[l].vacatures);
  writeFileSync(join(DIST, '_redirects'), lines.join('\n') + '\n');
}
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Klaar: ${urls.length} pagina's, ${live.length} vacatures.`);
