// Ontvangt een sollicitatie van de vacaturepagina en zet die in Recruitee (Careers Site API).
// Omgevingsvariabelen (alleen in Netlify, nooit in de repository):
//   RECRUITEE_CAREERS_TOKEN  Careers Site token uit Recruitee
//   RECRUITEE_API_BASE       optioneel, standaard https://jobs.workspace365.net
const MAX_FILE = 4 * 1024 * 1024; // Netlify Functions accepteren maximaal ongeveer 6 MB per aanvraag
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = process.env.RECRUITEE_CAREERS_TOKEN;
  if (!token) return json(503, { error: 'not-configured' });
  const base = (process.env.RECRUITEE_API_BASE || 'https://jobs.workspace365.net').replace(/\/$/, '');

  let form;
  try { form = await req.formData(); } catch { return json(400, { error: 'invalid' }); }

  if (form.get('bot-field')) return json(200, { ok: true }); // honeypot: doen alsof het gelukt is
  const slug = String(form.get('offer') || '');
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const phone = String(form.get('phone') || '').trim();
  const cv = form.get('cv');
  const letter = form.get('letter');
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return json(400, { error: 'offer' });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return json(400, { error: 'fields' });
  if (!form.get('consent')) return json(400, { error: 'consent' });
  if (!(cv instanceof File) || cv.size === 0) return json(400, { error: 'cv' });
  if (cv.size > MAX_FILE || (letter instanceof File && letter.size > MAX_FILE)) return json(413, { error: 'size' });

  const out = new FormData();
  out.append('candidate[name]', name);
  out.append('candidate[email]', email);
  out.append('candidate[phone]', phone);
  out.append('candidate[cv]', cv, cv.name);
  if (letter instanceof File && letter.size > 0) out.append('candidate[cover_letter_file]', letter, letter.name);

  const res = await fetch(`${base}/api/offers/${slug}/candidates`, {
    method: 'POST',
    headers: { 'X-Careers-Sites-Token': token },
    body: out,
  });
  if (!res.ok) {
    console.error('Recruitee antwoordde', res.status, (await res.text()).slice(0, 300));
    return json(502, { error: 'recruitee' });
  }
  return json(200, { ok: true });
};
