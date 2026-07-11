# LaunchKit Codex Rules

## LP Creation And Deployment

- LaunchKit LP work is not complete when the page is copied or deployed. It is complete only after AutoStudio tracking registration, tracking tags, CTA attributes, deployment, and event verification all pass.
- Repository: `/Users/kudo/LaunchKit`.
- Content directory: `content/{slug}/`.
- Config file: `configs/{slug}.json`.
- Build command: `node scripts/build.js configs/{slug}.json`.
- Production public URL should use `https://lkit.jp/{slug}` unless the user explicitly says otherwise.
- Domain rule:
  - `https://lkit.jp/{slug}` is the LaunchKit LP public URL. Use this for newly created LPs and for `launchkit_lps.url`.
  - `https://asto.jp/l/{code}` is the AutoStudio short-link/redirect URL. This is the old/link-shortener flow and is not the LP public URL.
  - For new direct-LP tracking, do not create or rely on `asto.jp/l/{code}` unless the user explicitly asks for a short link.
- `copy_raw: true` means `scripts/build.js` copies the HTML as-is. It does not automatically inject LaunchKit tracking tags.

## Required Tracking Registration

Before building/deploying a new LP, always register it in AutoStudio tracking. Do not require the user to open the admin screen.

Important: production `POST https://autostudio-self.vercel.app/api/launchkit/lps` is protected by AutoStudio login middleware. An unauthenticated curl request redirects to `/login`, so do not assume plain curl can create the LP.

Preferred agent route: insert a row directly into BigQuery table `mark-454114.autostudio_links.launchkit_lps`, matching the same fields AutoStudio writes internally. This route has been verified with an INSERT -> SELECT -> DELETE self-test; the test row was removed.

Required row shape:

```json
{
  "id": "new UUID",
  "name": "LP name",
  "slug": "{slug}",
  "url": "https://lkit.jp/{slug}",
  "genre": "opt",
  "source": "threads",
  "line_cta_url": "https://liff.line.me/...",
  "is_active": true,
  "created_at": "current timestamp",
  "updated_at": "current timestamp"
}
```

- The inserted `id` is the `lpId` used in `window.LAUNCHKIT_TRACKING`.
- Choose `genre` from `opt`, `seminar`, `consult`, `other`.
- Choose `source` from `threads`, `instagram`, `ad`, `note`, `youtube`, `other`.
- If `genre`, `source`, or the LINE CTA URL cannot be inferred, ask the user before registering.
- Do not leave `genre`, `source`, or `line_cta_url` empty unless the user explicitly confirms it.
- If an authenticated API route or service token is later added, using that API is fine; until then, BigQuery direct insert is the reliable automation path.

## Required HTML Tracking

For every LP, ensure `content/{slug}/landing.html` contains the new LP's tracking config before `</body>`:

```html
<script>
  window.LAUNCHKIT_TRACKING = { lpId: "{AUTO_STUDIO_LP_UUID}", apiBase: "https://autostudio-self.vercel.app" };
</script>
<script src="/{slug}/launchkit-tracking.js" defer></script>
```

- Copy `launchkit-tracking.js` into `content/{slug}/`, usually from an existing tracked LP such as `content/opt-4/th/launchkit-tracking.js`.
- Ensure the build output contains `dist/{slug}/launchkit-tracking.js`.
- When cloning an existing tracked LP, replace the old `lpId` and old tracking script path with the new UUID and new slug.
- Run a grep check for `LAUNCHKIT_TRACKING` and `launchkit-tracking.js`; no old slug or old UUID may remain.

## LINE CTA Tracking

- Add `data-launchkit-line-cta` to every `liff.line.me` CTA link, including sticky/floating CTAs.
- Verify the counts match:

```bash
grep -c 'liff.line.me' content/{slug}/landing.html
grep -c 'data-launchkit-line-cta' content/{slug}/landing.html
```

- If the counts do not match, fix the missing CTA attributes before building.

## Verification Before Reporting Done

After deploy, verify tracking instead of assuming it works:

- Open `https://lkit.jp/{slug}`.
- Confirm a `page_view` request reaches `/api/launchkit/events` with status 200.
- Click a LINE CTA and confirm `line_cta_click` reaches `/api/launchkit/events` with status 200 before/while navigating to LIFF.
- Confirm the actual BigQuery event records, because AutoStudio `/launchkit` is login-protected:

```bash
bq query --project_id=mark-454114 --use_legacy_sql=false \
  "SELECT event_type, COUNT(*) AS cnt
   FROM \`mark-454114.autostudio_links.launchkit_events\`
   WHERE lp_id='<LP_UUID>'
   GROUP BY event_type"
```

- `page_view` and `line_cta_click` should both be present after the browser verification flow.

Do not report the LP as complete if tracking events are still zero or unverified.

## Completion Report

For LaunchKit LP work, include:

- Public URL.
- AutoStudio LP registration status and `lpId`.
- `genre`, `source`, and LINE CTA URL used.
- Number of `data-launchkit-line-cta` attributes added.
- Build/deploy result.
- Tracking verification result for `page_view` and `line_cta_click`.

## Deployment & Git — MANDATORY, DO NOT DEVIATE

- Just do the normal thing: commit and push to the GitHub `main` branch. That is the deploy.
- Do NOT create side branches (e.g. `codex/*`, throwaway feature branches) or extra git worktrees to ship or deploy work. Work on `main`.
- Do NOT hand-deploy production from the CLI (`vercel --prod`, manual wrangler prod pushes, etc.) as the normal flow. This project is connected to GitHub; pushing `main` is what deploys. Bypassing it desyncs `main` from what is actually live and is forbidden.
- If you find the repo checked out on a non-`main` branch, or production served from a non-`main` branch/worktree, stop and restore the main-only flow before anything else.
- Keep it simple. Push to GitHub `main` and let the connected pipeline deploy. Nothing extra.
