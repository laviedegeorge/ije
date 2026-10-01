# Wedding website

An Astro site (server output, deployed on Vercel) for a couple's wedding: schedule, travel,
FAQ, things to do, asoebi, RSVP and a wedding-train sign-up. RSVPs and sign-ups are written to
a Google Sheet.

```sh
corepack enable pnpm   # once per machine; uses the pnpm version pinned in package.json
pnpm install
pnpm dev               # http://localhost:4321
pnpm test
pnpm build
```

pnpm is pinned to 11.x via `packageManager` in `package.json`. pnpm 12 ships as a native
binary that Corepack can't run yet (Corepack 0.36); revisit when Corepack supports it.
On Vercel, set `ENABLE_EXPERIMENTAL_COREPACK=1` so builds use the same pinned version.

## Setting the site up for a new couple

### 1. Identity and settings: `src/config/event.ts`

Names, dates, location, RSVP deadline, production URL, gift account details, Google Sheet tab names,
and which pages are switched on. Everything that repeats across the site reads from here.
Disabled pages return 404 and drop out of the nav (restart `pnpm dev` after toggling one).

### 2. Page content: `src/data/`

| File | Page |
|---|---|
| `site-nav.ts` | Home page intro and event previews |
| `schedule.ts` | Schedule: events, times, venues, map and calendar links |
| `travel-flights.ts`, `travel-hotels.ts`, `travel-visa.ts` | Travel |
| `things-to-do.ts` | Things to do |
| `faq.ts` | FAQ |
| `interestPages.ts` | Asoebi and Join / wedding train: tab text, fabric photos, form copy |
| `about-wedding-party.ts` | Wedding party |

Some copy still lives in the page descriptions in `src/pages/*.astro`. Search for the previous
couple's names, cities and dates before launch.

#### Personal-link pages: `/asoebi` and `/join`

Both pages open only through a personal link such as `/asoebi?n=ada&c=K7Q2M9`, for guests
ticked **Asoebi** or **Groomsmen** on the sheet's **Guests** tab (see step 4). The code `c` grants
access; the first name `n` only personalises the link. The sheet writes each guest's links for
you. Each page has Traditional and White Wedding tabs and an "I'm interested" form (name, email,
WhatsApp, Traditional / White / Both). Responses land on the **Asoebi** / **Groomsmen** tabs as
**Pending**. The pages are not in the nav.

#### Admin page: `/admin`

Signed in with `ADMIN_CODE`. Shows the Asoebi and Groomsmen responses with **Confirm** /
**Decline**, and the guest list from the **RSVPs** tab (totals, events, phone numbers and travel dates). Confirming a response
(here, or by setting its Status in the sheet) updates the guest on **Guests**: Source gains
"Asoebi" / "Groomsmen" and Plus One becomes at least 1.

**Invite** adds someone to **Guests** for asoebi and/or groomsmen (name, category, plus ones) and
shows their personal links to copy or share on WhatsApp. **RSVP link** builds a `/rsvp?n=…` link
that greets the guest by name. Both use the address the admin page is open on.

#### Page loaders

Pages choose a full-screen loader through `BaseLayout`'s `loader` prop
(`src/components/loader/PageLoader.astro`): `welcome` on Home, `seal` on RSVP and the invite
pages (the card greets the guest by first name), and `curtain` with a page title and photo
elsewhere. Home and the seal play once per visit; a tap or key press skips them, and visitors who
reduce motion never see them. Background photos are in `public/assets/loaders/`.

### 3. Images: `public/`

- `public/assets/couple/1.jpeg` (home hero) and `1–4.webp` (home marquee, gate background)
- `public/assets/monogram-*.webp` (header logo, password page) and the city `.webp` images
- Favicons (`favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`, `android-chrome-*.png`)
  and `site.webmanifest`

Files in `public/` are served directly and are **not** behind the password gate.

### 4. Backend: Google Sheets via Apps Script

The site never talks to Google directly. It calls an Apps Script web app attached to the
couple's workbook (`apps-script/Code.gs`), which reads and writes the tabs.

**Set up the workbook** (a new one per couple — never reuse the previous couple's, it holds
their guests' personal data): create an empty Google Sheet. The script's setup (below) creates
and formats every tab:

| Tab | Columns | Who fills it |
|---|---|---|
| **Guests** (the guest list) | Code, Name, Category, Source, Plus One, Asoebi ☐, Groomsmen ☐, Asoebi Link, Groomsmen Link | The couple adds rows (Name, Category, Plus One, ticks). The script fills Code and the links. |
| **Asoebi**, **Groomsmen** | Submitted At, Code, Name, Email, WhatsApp, Events, Status | The website. The couple changes Status (Pending → Confirmed / Declined). |
| **RSVPs** | RSVP answers | The website. |

Category is a dropdown: Friends of groom, Friends of bride, Family of groom, Family of bride,
Work colleagues, Others. Guests added directly have Source "Direct" (blank).

**Deploy the script:**

1. In the workbook: Extensions → Apps Script. Replace the editor's contents with
   `apps-script/Code.gs`, set `SITE_URL` at the top to the site's address, and save.
2. Project Settings (gear icon) → Script properties → add `SITE_SECRET` with a long random value
   (`openssl rand -base64 32`).
3. Reload the sheet. A **Wedding site** menu appears: run **Set up tabs & protections** and
   authorise when asked. It creates the tabs, dropdowns and checkboxes, locks the columns the
   website fills (only the sheet owner can edit them; Status stays editable), and installs the
   trigger that fills codes/links and updates Guests when a response is confirmed. It's safe to
   run again. **Generate missing codes & links** refreshes every row.
4. Deploy → New deployment → type **Web app**. Execute as **Me**, Who has access **Anyone**.
   Authorise when asked. Copy the web app URL (ends in `/exec`).
5. Set `APPS_SCRIPT_URL` (that URL) and `APPS_SCRIPT_SECRET` (the same `SITE_SECRET`) in `.env`
   and in Vercel.

"Anyone" only means the URL is callable without a Google login; every request must carry the
secret, and the script can only append rows, read the Guests / Asoebi / Groomsmen tabs, and
change a response's Status.

**After editing `Code.gs`:** Deploy → Manage deployments → edit (pencil) → Version: **New
version** → Deploy. This keeps the same URL; a brand-new deployment gets a new one.

**If the sheet can't be reached**, the site keeps using the last guest list it read (cached for
a minute). If it has never read one (e.g. just after a deploy during an outage), personal links
are trusted and show the first name from the link. Forms can't save until the sheet is
back and show a "try again" message. Errors are logged in Vercel as `[appsScript]` / `[guests]`.

### 5. Environment variables (Vercel → Project → Settings → Environment Variables)

See `.env.example`.

| Variable | Purpose |
|---|---|
| `SITE_GATE_PASSWORD` | Password for the whole site, used only when `passwordGate` is `true` in `src/config/event.ts`. Checked server-side only. |
| `APPS_SCRIPT_URL` | The Apps Script web app URL (ends in `/exec`) |
| `APPS_SCRIPT_SECRET` | Must match the script's `SITE_SECRET` property |
| `ADMIN_CODE` | Code for `/admin`. Empty = admin page off. Long, and different from the site password. |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather, for alerts. Empty = alerts off. |
| `TELEGRAM_CHAT_ID` | The chat the alerts go to (a group ID starts with `-`). |

Do not prefix secrets with `PUBLIC_`; Astro ships those to the browser.

### 6. Telegram alerts (optional)

Every saved RSVP, asoebi and groomsmen sign-up sends a message to a Telegram chat
(`src/util/notify.ts`). If Telegram can't be reached, the submission still succeeds.

1. In Telegram, message **@BotFather**, send `/newbot` and follow the prompts. Copy the token.
2. Create a group, add the bot, and send any message in it (or just message the bot directly).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `"chat":{"id": …}`. A group's
   ID is negative, e.g. `-1001234567890`.
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Vercel (and `.env` locally), then redeploy.

## How the password gate works

The gate is off while `passwordGate` is `false` in `src/config/event.ts` (the default for
Cynthia & Kelechi): the site is open, `/asoebi` and `/join` still need a valid invite code, and
`/admin` its `ADMIN_CODE`. Set it to `true` (and set `SITE_GATE_PASSWORD`) to turn it back on.

`src/middleware.ts` redirects every page request without a valid `site_gate` cookie to
`/unlock` (API routes get a 401). The form posts to `/api/unlock`, which compares the password
on the server and sets an HttpOnly cookie signed with the password (valid 36 hours). Changing
the password signs everyone out.

Pages must stay server-rendered for the gate to apply: don't add `export const prerender = true`
to a page that should be private.

## Known limitations

Open issues to keep in mind (or fix) before handing the site to a couple.

**Security and privacy**

- **Images are public.** Everything in `public/` (couple photos, logo) is served straight from
  Vercel's CDN, bypassing the middleware, so anyone with a direct URL can open it. To protect
  them, move them out of `public/` and serve them through a route the middleware covers.
- **No limit on password attempts.** `/api/unlock` accepts unlimited guesses. Use a password
  that isn't easy to guess. A fix
  would be rate limiting per IP (e.g. Vercel Firewall rules or Upstash Redis).
- **One shared password.** Every guest uses the same password, so it can be passed on freely,
  and revoking access means changing it, which signs everyone out.
- **Prerendered pages skip the gate.** Middleware only runs for server-rendered pages; adding
  `export const prerender = true` to a page makes it public.
- **Apps Script limits.** Google caps how many script runs happen at once (about 30 per
  account), so a large burst of simultaneous submissions could see some "try again" errors.
- **Form spam.** The RSVP and wedding-train forms only have a honeypot field: no captcha or
  rate limit. With the gate on, only visitors who know the password can submit.
- **New sheet-writing code must escape cells.** Values that start with `=`, `+`, `-` or `@`
  become formulas in Google Sheets. Pass every user-supplied cell through
  `sanitizeSheetCell` (`src/util/sheetCell.ts`), as `rsvpSheet.ts` and `interestSheet.ts` do.

**Development**

- `pnpm dev` doesn't hot-reload `src/middleware.ts` or config it imports: restart after
  toggling a page in `src/config/event.ts`.
- `astro check` needs `@astrojs/check`, which isn't installed. `tsc` also reports missing
  Node types (`@types/node`) and two existing type errors in the test files; the build is
  unaffected.
