// POST /api/alerts
// Body: { email: string, items: [{ id, name }] }
// Stores one record per email in Netlify Blobs under the "alerts" store.
import { getStore } from '@netlify/blobs';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async (request) => {
  // CORS so the static page (same site, but be safe) can call it.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const email = (body.email || '').trim().toLowerCase();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: cors });
  }

  // Keep only id + name, dedupe by id.
  const seen = new Set();
  const cleanItems = [];
  for (const it of items) {
    const id = (it && it.id || '').toString();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleanItems.push({ id, name: (it.name || id).toString().slice(0, 200) });
  }

  const store = getStore('alerts');
  // Key by email (URL-encoded so odd characters are safe as a blob key).
  const key = encodeURIComponent(email);
  await store.setJSON(key, {
    email,
    items: cleanItems,
    updatedAt: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true, count: cleanItems.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};

export const config = { path: '/api/alerts' };
