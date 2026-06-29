// GET /api/unsubscribe?email=...&token=...
// Removes the stored alert record for an email. The token is a lightweight
// check so the link can't be guessed for arbitrary addresses.
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

// Same token recipe used when building the link in daily-check.
function tokenFor(email) {
  const secret = process.env.UNSUB_SECRET || 'shopwatch';
  return createHash('sha256').update(email.toLowerCase() + secret).digest('hex').slice(0, 16);
}

function page(title, message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body{font-family:sans-serif;background:#050c1a;color:#e8f0ff;display:flex;
        align-items:center;justify-content:center;min-height:100vh;margin:0}
      .box{max-width:420px;padding:32px;text-align:center;background:#0b1628;
        border:1px solid rgba(100,160,255,.15);border-radius:16px}
      h1{font-size:20px;margin:0 0 12px}
      p{color:#7a90b8;line-height:1.6;margin:0}
    </style></head>
    <body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const token = url.searchParams.get('token') || '';

  const html = (title, msg) =>
    new Response(page(title, msg), { status: 200, headers: { 'Content-Type': 'text/html' } });

  if (!email || !token) {
    return html('Invalid link', 'This unsubscribe link is missing information.');
  }
  if (token !== tokenFor(email)) {
    return html('Invalid link', 'This unsubscribe link could not be verified.');
  }

  const store = getStore('alerts');
  const key = encodeURIComponent(email);
  await store.delete(key);

  return html('Unsubscribed', `${email} will no longer receive shop alerts.`);
};

export const config = { path: '/api/unsubscribe' };
