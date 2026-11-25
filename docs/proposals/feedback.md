# Proposal: a "Send feedback" link and form that emails the owner

Status: **built in v0.47.0** as the Edge Function + Bird option (see the
update below, `docs/SPEC.md` §5 Manage → Give Feedback, and
`supabase/functions/send-feedback/README.md`). Written 2026-11-25 against
v0.46.2; kept for the options weighed.

A signed-in user taps "Send feedback", writes a message, and the owner gets
it as an email they can reply to.

## Update 2026-11-25: use Bird, text only

The owner already sends Supabase Auth email through Bird (SMTP, an API key
scoped to `emails:write`, `enoughmoney.app` verified as a sending domain).
The form needs only the message text, with no app details.

- The browser cannot call Bird directly. That would put the Bird key in
  the public bundle, so anyone could send mail as `enoughmoney.app`.
  Supabase Auth's SMTP setting sends only its own sign-in templates, so it
  can't send this either.
- The smallest safe path: a Supabase Edge Function `send-feedback` of about
  30 lines. It requires a signed-in user, takes `{ message }` (1–5,000
  characters), and makes one `fetch` to Bird's email API (`POST
/v1/email/messages`; check the host and key format in the Bird
  dashboard). The Bird key and the To address are function secrets. Plain
  text, a fixed subject, Reply-To set to the user's email.
- No-function alternative: a `feedback` table whose insert trigger calls
  Bird through `pg_net`, with the key in Supabase Vault. This adds a
  migration, RLS, a backup decision and memory-store support, so it is more
  work than the function.

The rest of this document predates this update. Where they differ, this
section wins (no email-provider choice, no "app details").

## The parts

1. **A link** to the form. Best home: Manage → Household group, a row
   "Send feedback" (one line: "Report a problem or suggest an idea"),
   opening `#manage/feedback` (add `"feedback"` to `MANAGE_SECTIONS` in
   `src/models/routes.ts`). Optionally also in the phone page menu on every
   page, so a bug can be reported from where it happened.
2. **A form**: kind (Problem / Idea / Question), message (required), a
   ticked-by-default "Include app details" box, and Send. After sending:
   "Thanks — sent", and the field clears. On failure: the error, and the
   text stays.
3. **Something that sends the email.** A browser page cannot send email by
   itself, and the app has no server today (the Cloudflare Worker only
   serves static files; Supabase is the only backend). So something
   server-side must hold an email service's secret key. That is the main
   decision, below.

## Ways to send it

| Option                                                          | What it takes                                                                                          | Good                                                                                                       | Bad                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **A. `mailto:` link**                                           | A link `mailto:feedback@…?subject=…&body=…`                                                            | An hour's work, no service, no secret, nothing to break                                                    | Opens the user's mail app (none set up on some phones/desktops); shows your address; no form in the app  |
| **B. Supabase Edge Function + email API** (Resend, Postmark, …) | `supabase/functions/send-feedback/`, an email account, a verified sending domain, two function secrets | Real form, works on any device, reply goes straight to the user, stays inside the services you already use | First Edge Function in the repo: new deploy step, new thing to test                                      |
| **C. B plus a `feedback` table**                                | B, plus a migration with RLS (insert only, own household)                                              | A record survives even if the email fails; readable in the Supabase dashboard                              | A migration, backup decision, memory store support                                                       |
| **D. Cloudflare Worker `send_email`**                           | Make the Worker do more than serve files; Cloudflare Email Routing with your address verified          | No extra email company                                                                                     | The Worker must check the Supabase sign-in itself; breaks the "Worker only serves static files" decision |
| **E. Hosted form service** (Formspree etc.)                     | A third-party endpoint in the CSP                                                                      | No code server-side                                                                                        | Sends users' words from a money app to another company; new CSP entry; spam handling is theirs           |

**Recommendation:** start with **A** if you want something today, then
build **B** (add C only if you want a history). B keeps everything inside
Supabase, needs no Content Security Policy change (the function lives at
`https://<ref>.supabase.co/functions/v1/…`, already allowed in
`connect-src`; the email API is called from the server, not the browser),
and only signed-in household members can use it.

## Steps for B

1. **Email service.** Make an account (Resend is the simplest with
   Supabase), add `enoughmoney.app` as a sending domain, and add the DNS
   records it gives (SPF, DKIM, ideally DMARC) in Cloudflare DNS. Send from
   something like `feedback@enoughmoney.app`; it does not need a real inbox.
2. **Secrets.** On the Supabase project (not in the repo, never `VITE_`):
   `RESEND_API_KEY` and `FEEDBACK_TO` (your address, so it never ships in
   the app bundle). Same on the test project, with `FEEDBACK_TO` pointing at
   the provider's test address so tests never fill your inbox.
3. **The function** `supabase/functions/send-feedback/index.ts` (Deno):
   - keep JWT checking on (the default), and read the user from the token;
     reject anyone not signed in or not in a household;
   - validate: kind is one of three, message 1–5,000 characters, details
     a small known set of fields;
   - rate limit (e.g. 5 an hour per user; easiest with the table from C,
     counting rows);
   - send **plain text** (no HTML, so nothing the user types can inject
     markup); a fixed subject like `[Enough Money] Problem from <household>`
     with no user text in it; **Reply-To** set to the user's email so you
     can just hit Reply;
   - answer the browser's CORS preflight, allowing only
     `https://enoughmoney.app` and the local dev/preview origins.
4. **App code, kept MVC:**
   - `src/models/feedback.ts`: types, validation (`validateFeedback`),
     building the app details, the Supabase call
     (`supabase.functions.invoke("send-feedback", …)`) and a memory-store
     version that only records what was sent (UI tests must not need the
     network);
   - `src/controllers/useFeedback.ts`: sending state, errors, keeping the
     draft;
   - `src/views/…/FeedbackSection.tsx`: the form, reusing existing form
     styles; `role="status"` for "sent" so screen readers hear it.
5. **Deploy.** Decide whether functions deploy by hand (`supabase functions
deploy send-feedback --project-ref …`) or from `deploy.yml` (needs a
   `SUPABASE_ACCESS_TOKEN` secret and a pinned CLI version). By hand is
   fine for one function that rarely changes; write the command in
   `docs/testing.md` or a README.
6. **Tests.** Unit: validation and the details builder. UI (memory store):
   open Manage → Send feedback, send, see "sent"; an error keeps the text.
   Integration (test project): the function rejects no token, a too-long
   message, and too many sends.
7. **Docs and version.** A feature, so a y bump (v0.47.0). Update SPEC.md
   (Manage list, new section, §9 if anything is left for later) and
   CLAUDE.md (Stack: the email service and the Edge Function; the Manage
   list). Screenshot at phone width before the PR.

## Things to decide or keep in mind

- **Privacy (the big one).** This is a money app. Never attach budget data
  automatically: no balances, payees, amounts or envelope names. "App
  details" should be only: version, page (route without account ids, or
  with — your call; ids are meaningless UUIDs but still identify rows),
  screen size, browser, installed as an app or not, online or not. Show
  exactly what will be sent under the checkbox. Say on the form that the
  message goes by email to the owner.
- **Who can send.** Only signed-in users (public sign-up is off, so this is
  just your household plus anyone you invite). That makes spam a small
  risk; still rate-limit and cap length. Feedback from the **landing page**
  (not signed in) would need a CAPTCHA or similar — leave it as a `mailto:`
  there, or skip it.
- **Where replies go.** Reply-To = the user's sign-in email. Decide whether
  your own address should ever appear in the app (A shows it; B does not).
- **Offline.** It's a PWA. If sending fails offline, keep the text (and
  perhaps save the draft in localStorage per user, like other prefs) and
  say "You're offline — try again when connected". No background queue.
- **If C (the table):** CLAUDE.md says every new table goes into
  `export_backup` / `restore_backup` / `validateBackup`. Feedback is about
  the app, not the household's money, so you may prefer to leave it out of
  backups — that would be a stated exception. It also needs RLS, an entry in
  the memory store and `storeRules.shared.ts`, the advisors run, and the
  migration applied to test too.
- **Screenshots / attachments.** Useful for bugs but much more work
  (storage bucket, size limits, images may show balances). Suggest later.
- **Cost.** Resend's and Supabase's free tiers are far above a household's
  feedback volume; check current limits when signing up.
- **Failure you never see.** If the email service is down or the domain
  stops verifying, sends fail silently from your side. The table (C) or the
  function's logs in Supabase are the safety net.
- **Approval.** No budget math changes, so nothing in the decided math
  needs sign-off — but it adds an outside service, a new kind of server
  code and (with C) a table, so pick the option before any code.

## Open questions for the owner

1. A only, B, or B + C?
2. Which email service (Resend suggested), and which address receives it?
3. Where does the link live: Manage only, or also the page menu / the
   landing page?
4. With C: in backups or not?
