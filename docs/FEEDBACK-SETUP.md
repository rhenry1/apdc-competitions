# Feedback widget — setup (about 15 minutes, one time, free)

The site has a **Feedback** button (bottom-right of every page). People tap it,
type an idea or bug, and hit send. Each submission becomes a **GitHub issue** in
this repo, and GitHub **emails you** automatically — so you get alerted and
Claude has an issue to work from.

The button stays **hidden** until you finish the steps below, so nothing looks
broken in the meantime.

The receiver is a tiny **Cloudflare Worker** (Cloudflare's free plan is far more
than enough — 100,000 requests/day). All the code is in `worker/`.

---

## What you'll set up

```
Feedback button  ──POST──▶  Cloudflare Worker  ──creates──▶  GitHub issue
 (on the site)               (holds your token)                (emails you)
```

The Worker holds a GitHub token so the website never has to — that's the whole
reason it exists (a public web page can't keep a secret).

---

## Step 1 — Create a GitHub token (scoped to just this repo)

1. Go to **https://github.com/settings/tokens?type=beta** → **Generate new token**.
2. Name: `apdc-feedback`. Expiration: your choice (you can regenerate later).
3. **Resource owner:** your account (`rhenry1`).
4. **Repository access:** *Only select repositories* → pick **`apdc-competitions`**.
5. **Permissions → Repository permissions → Issues:** set to **Read and write**.
   (Leave everything else as *No access*.)
6. Generate, then **copy the token** (`github_pat_…`). You won't see it again.

This token can *only* create issues on this one repo — nothing else.

## Step 2 — Deploy the Worker  (pick ONE path)

### Path A — no terminal (GitHub Actions) — recommended

1. Sign up for a free Cloudflare account (https://dash.cloudflare.com/sign-up).
2. Create a **Cloudflare API token**: dash → *My Profile* → *API Tokens* →
   *Create Token* → use the **"Edit Cloudflare Workers"** template → Create.
   Copy it.
3. Grab your **Account ID**: dash → *Workers & Pages* → it's in the right
   sidebar.
4. In GitHub, add three repository secrets (repo → *Settings* → *Secrets and
   variables* → *Actions* → *New repository secret*):
   - `CLOUDFLARE_API_TOKEN` — from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — from step 3
   - `FEEDBACK_GH_TOKEN` — the GitHub token from **Step 1** above
5. Run the deploy: repo → *Actions* → **Deploy feedback worker** → *Run
   workflow*. When it finishes, open the *Deploy* step's log and copy the
   `https://apdc-feedback.<your-subdomain>.workers.dev` URL.

### Path B — terminal (wrangler)

From this repo's `worker/` folder:

```bash
cd worker
npx wrangler login          # opens the browser; create a free Cloudflare account if needed
npx wrangler secret put GH_ISSUES_TOKEN   # paste the token from Step 1 when prompted
npx wrangler deploy
```

`wrangler deploy` prints the same `https://apdc-feedback.<…>.workers.dev` URL.

**Either path: copy that URL for Step 3.**

## Step 3 — Turn the widget on

Edit **`assets/feedback-config.js`** and paste your Worker URL:

```js
window.APDC_FEEDBACK_ENDPOINT = window.APDC_FEEDBACK_ENDPOINT || "https://apdc-feedback.<your-subdomain>.workers.dev";
```

Commit + push. Within a minute the **Feedback** button appears on the live site.

## Step 4 — Test it

Open the site, tap **Feedback**, send a test note. Within a few seconds you
should get a new GitHub issue (labeled `user-feedback`) and an email from
GitHub. Done.

---

## Notes

- **Privacy:** the widget intentionally collects *only* the message + which page
  it came from — no name or email — because issues in a **public** repo are
  public. If you'd rather keep feedback private, create a separate *private*
  repo, give the Step 1 token access to that repo instead, and set `GH_REPO`
  (and `GH_OWNER` if different) in `worker/wrangler.toml` to point at it. Claude
  can still read it if you grant access.
- **Spam:** the widget has a hidden honeypot field, the Worker drops
  too-fast/bot submissions, and it's rate-limited (20 requests/minute per
  visitor — a native Cloudflare Workers feature, no dashboard setup needed).
  If you ever get spammed anyway, a Turnstile challenge is the next step —
  ask Claude and it'll wire it in.
- **Cost:** $0 on Cloudflare's free tier and GitHub. No credit card needed.
- **Already deployed and updating this later?** Re-run **Actions → Deploy
  feedback worker → Run workflow** any time `worker/` changes (like the rate
  limit above) — it picks up the new config automatically.
- **Turning it off:** blank out the URL in `assets/feedback-config.js` and push;
  the button disappears.
