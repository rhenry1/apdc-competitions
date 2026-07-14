// APDC feedback worker — a tiny Cloudflare Worker that receives feedback from
// the site's feedback widget and files a GitHub issue (which GitHub then emails
// to the repo owner). Setup: docs/FEEDBACK-SETUP.md
//
// Bindings (set in the Cloudflare dashboard or wrangler.toml):
//   Secret  GH_ISSUES_TOKEN  — fine-grained PAT with "Issues: Read and write" on
//                           the target repo. REQUIRED.
//   Var     GH_OWNER      — repo owner (default: rhenry1)
//   Var     GH_REPO       — repo name  (default: apdc-competitions)
//   Var     ALLOW_ORIGIN  — site origin allowed to POST
//                           (default: https://rhenry1.github.io)
//
// The pure helpers (validateFeedback, buildIssue) are exported so they can be
// unit-tested outside the Workers runtime.

const DEFAULTS = {
  owner: 'rhenry1',
  repo: 'apdc-competitions',
  allowOrigin: 'https://rhenry1.github.io'
};

// Returns null when the payload is acceptable, the string 'spam' when it should
// be silently dropped, or a human-readable reason string for a 400.
export function validateFeedback(body) {
  if (!body || typeof body !== 'object') return 'Invalid request.';
  if (body.hp) return 'spam';                                   // honeypot filled
  if (typeof body.elapsed === 'number' && body.elapsed < 1200) return 'spam'; // submitted implausibly fast
  const msg = (body.message == null ? '' : String(body.message)).trim();
  if (msg.length < 3) return 'Please add a little more detail.';
  if (msg.length > 4000) return 'That message is too long.';
  return null;
}

export function buildIssue(body) {
  const cat = ['idea', 'bug', 'other'].indexOf(body.category) >= 0 ? body.category : 'other';
  const msg = String(body.message).trim();
  const firstLine = msg.split('\n')[0].slice(0, 72).trim();
  const prefix = cat === 'bug' ? 'Bug' : cat === 'idea' ? 'Idea' : 'Feedback';
  const clip = (v, n) => (v == null ? 'n/a' : String(v)).slice(0, n);
  const bodyMd = [
    msg,
    '',
    '---',
    `- **Type:** ${cat}`,
    `- **Page:** ${clip(body.page, 300)}`,
    `- **Submitted:** ${clip(body.ts, 40)}`,
    `- **User agent:** ${clip(body.ua, 300)}`,
    '',
    '_Filed automatically from the site feedback widget._'
  ].join('\n');
  return { title: `${prefix}: ${firstLine || 'feedback'}`, body: bodyMd, labels: ['user-feedback', cat] };
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

async function createIssue(owner, repo, token, issue) {
  return fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'apdc-feedback-worker'
    },
    body: JSON.stringify(issue)
  });
}

export default {
  async fetch(request, env) {
    const owner = env.GH_OWNER || DEFAULTS.owner;
    const repo = env.GH_REPO || DEFAULTS.repo;
    const allowOrigin = env.ALLOW_ORIGIN || DEFAULTS.allowOrigin;
    const headers = corsHeaders(allowOrigin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, headers);

    // W3.2 — the honeypot + too-fast-submission checks below stop naive bots,
    // not a scripted attacker who just waits out the timer. Cap requests per
    // client IP well above any real person's usage (see wrangler.toml).
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ ok: false, error: 'Too many requests — please wait a moment.' }, 429, headers);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ ok: false, error: 'Invalid JSON' }, 400, headers); }

    const problem = validateFeedback(body);
    if (problem === 'spam') return json({ ok: true }, 200, headers); // accept + drop, don't tip off bots
    if (problem) return json({ ok: false, error: problem }, 400, headers);

    if (!env.GH_ISSUES_TOKEN) return json({ ok: false, error: 'Server not configured' }, 500, headers);

    const issue = buildIssue(body);
    let res = await createIssue(owner, repo, env.GH_ISSUES_TOKEN, issue);
    // If the labels don't exist yet, GitHub 422s — retry once without them so a
    // missing label never blocks real feedback.
    if (res.status === 422) {
      const { labels, ...noLabels } = issue;
      res = await createIssue(owner, repo, env.GH_ISSUES_TOKEN, noLabels);
    }
    if (!res.ok) return json({ ok: false, error: 'Could not file issue' }, 502, headers);

    const created = await res.json().catch(() => ({}));
    return json({ ok: true, url: created.html_url || null }, 200, headers);
  }
};
