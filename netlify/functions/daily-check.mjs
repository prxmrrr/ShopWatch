// Scheduled daily (just after the shop resets at 00:00 UTC).
// Pulls today's shop, matches every stored wishlist, emails the hits via Resend.
import { getStore } from '@netlify/blobs';

const SHOP_URL = 'https://fortnite-api.com/v2/shop?language=en';
const RESEND_URL = 'https://api.resend.com/emails';

// Pull every item id present in today's shop (flat schema + legacy fallback).
async function getTodaysShopIds() {
  const res = await fetch(SHOP_URL);
  if (!res.ok) throw new Error('Shop fetch failed: HTTP ' + res.status);
  const data = await res.json();
  const d = data.data || {};
  const entries = Array.isArray(d.entries) && d.entries.length
    ? d.entries
    : [
        ...(d.featured?.entries || []),
        ...(d.daily?.entries || []),
        ...(d.specialFeatured?.entries || []),
        ...(d.specialDaily?.entries || []),
      ];

  const ids = new Set();
  for (const entry of entries) {
    const pieces = entry.brItems || entry.items || entry.tracks
      || entry.instruments || entry.cars || [];
    for (const p of pieces) if (p && p.id) ids.add(p.id);
  }
  return ids;
}

async function sendEmail(to, matched) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL; // e.g. "ShopWatch <alerts@yourdomain.com>"
  if (!apiKey || !from) throw new Error('Missing RESEND_API_KEY or ALERT_FROM_EMAIL');

  const list = matched.map(m => `<li>${m.name}</li>`).join('');
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>Your wishlisted items are in the shop today</h2>
      <ul>${list}</ul>
      <p>Grab them before the shop rotates at midnight UTC.</p>
      <p style="color:#888;font-size:12px">You're getting this because you set an alert on ShopWatch.</p>
    </div>`;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${matched.length} wishlisted item${matched.length > 1 ? 's are' : ' is'} in the Fortnite shop`,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend failed for ${to}: HTTP ${res.status} ${t}`);
  }
}

export default async () => {
  const shopIds = await getTodaysShopIds();
  const store = getStore('alerts');

  const { blobs } = await store.list();
  let sent = 0, checked = 0;

  for (const blob of blobs) {
    checked++;
    const record = await store.get(blob.key, { type: 'json' });
    if (!record || !Array.isArray(record.items)) continue;

    const matched = record.items.filter(it => shopIds.has(it.id));
    if (matched.length === 0) continue;

    try {
      await sendEmail(record.email, matched);
      sent++;
    } catch (e) {
      console.error(e.message);
    }
  }

  console.log(`Checked ${checked} subscribers, sent ${sent} emails.`);
  return new Response(`ok: checked ${checked}, sent ${sent}`, { status: 200 });
};

// Runs daily at 00:10 UTC — a few minutes after the shop resets.
export const config = { schedule: '10 0 * * *' };
