// Ontvangt een sollicitatie van de vacaturepagina en zet die in Recruitee (Careers Site API).
// Omgevingsvariabelen (alleen in Netlify, nooit in de repository):
//   RECRUITEE_CAREERS_TOKEN  Careers Site token uit Recruitee
//   RECRUITEE_API_BASE       optioneel, standaard https://jobs.workspace365.net
const MAX_FILE = 4 * 1024 * 1024; // Netlify Functions accepteren maximaal ongeveer 6 MB per aanvraag
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Een gewone formulierpost (zonder JavaScript, of met een oude gecachete site.js) sturen we terug naar de vacaturepagina.
const wantsJson = (req) => (req.headers.get('accept') || '').includes('application/json');
const back = (req, flag) => {
  let path = '/';
  try { path = new URL(req.headers.get('referer') || '').pathname; } catch {}
  return new Response(null, { status: 303, headers: { location: `${path}?${flag}=1#solliciteer` } });
};
const reply = (req, status, body) => (wantsJson(req) ? json(status, body) : back(req, status === 200 ? 'verzonden' : 'fout'));

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = process.env.RECRUITEE_CAREERS_TOKEN;
  if (!token) return json(503, { error: 'not-configured' });
  const base = (process.env.RECRUITEE_API_BASE || 'https://jobs.workspace365.net').replace(/\/$/, '');

  let form;
  try { form = await req.formData(); } catch { return reply(req, 400, { error: 'invalid' }); }

  if (form.get('bot-field')) return reply(req, 200, { ok: true }); // honeypot: doen alsof het gelukt is
  const slug = String(form.get('offer') || '');
  const name = String(form.get('name') || [form.get('first'), form.get('last')].filter(Boolean).join(' ')).trim();
  const email = String(form.get('email') || '').trim();
  const phone = String(form.get('phone') || '').trim();
  const cv = form.get('cv');
  const letter = form.get('letter');
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return reply(req, 400, { error: 'offer' });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return reply(req, 400, { error: 'fields' });
  if (!form.get('consent')) return reply(req, 400, { error: 'consent' });
  if (!(cv instanceof File) || cv.size === 0) return reply(req, 400, { error: 'cv' });
  if (cv.size > MAX_FILE || (letter instanceof File && letter.size > MAX_FILE)) return reply(req, 413, { error: 'size' });

  const out = new FormData();
  out.append('candidate[name]', name);
  out.append('candidate[email]', email);
  out.append('candidate[phone]', phone);
  out.append('candidate[cv]', cv, cv.name);
  if (letter instanceof File && letter.size > 0) out.append('candidate[cover_letter_file]', letter, letter.name);
  // Antwoorden op open vragen uit Recruitee: velden met de naam q_<vraag-id>. Een gekozen team gaat mee in het eerste antwoord.
  const team = String(form.get('team') || '').trim();
  let n = 0;
  for (const [key, value] of form.entries()) {
    const m = /^q_(\d{1,12})$/.exec(key);
    if (!m) continue;
    let text = String(value || '').trim();
    if (n === 0 && team) text = (text ? text + '\n\n' : '') + 'Voorkeursteam: ' + team;
    if (!text) continue;
    out.append(`candidate[open_question_answers_attributes][${n}][open_question_id]`, m[1]);
    out.append(`candidate[open_question_answers_attributes][${n}][content]`, text.slice(0, 10000));
    n++;
  }

  const res = await fetch(`${base}/api/offers/${slug}/candidates`, {
    method: 'POST',
    headers: { 'X-Careers-Sites-Token': token },
    body: out,
  });
  if (!res.ok) {
    console.error('Recruitee antwoordde', res.status, (await res.text()).slice(0, 300));
    return reply(req, 502, { error: 'recruitee' });
  }
  return reply(req, 200, { ok: true });
};
