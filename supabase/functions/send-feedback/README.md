# send-feedback

The Edge Function behind **Give Feedback** (v0.47.0). A signed-in user's
message is emailed to the owner through Bird's email API. Bird is the same
workspace that sends Supabase Auth's sign-in emails.

- `index.ts`: the function (Deno). It checks the sign-in with Supabase
  Auth, then sends through Bird.
- `email.ts`: the pure parts (checking the message, the Bird request, the
  allowed origins), unit-tested by `email.test.ts` with Vitest.

The browser never sees the Bird key. The app calls the function with
`supabase.functions.invoke("send-feedback", { body: { message } })`.

## Secrets

Set these on each project, either in the dashboard (Edge Functions →
Secrets) or with the CLI. Never commit them or give them a `VITE_` prefix.

| Name            | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `BIRD_API_KEY`  | A Bird workspace key with the `emails:write` scope (`bk_us1_…` or `bk_eu1_…`; the region picks the API host) |
| `FEEDBACK_TO`   | The inbox that receives feedback                                                                             |
| `FEEDBACK_FROM` | A sender on a domain verified in Bird, e.g. `Enough Money <feedback@enoughmoney.app>`                        |

Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` itself.

Until all three secrets are set, the function answers "Feedback isn't set
up yet". The test project can point `FEEDBACK_TO` at a test inbox, or have
no secrets at all.

## Deploy

The function is deployed by hand, not by `deploy.yml`. Deploy again only
when the function changes.

```bash
supabase functions deploy send-feedback --project-ref lkaurrcarzzkbqdwqfge
supabase functions deploy send-feedback --project-ref kiqbgjgvptgknmboazaq
```

JWT verification stays on (the default), so Supabase turns away calls with
no valid token before the function runs.

## What it sends

The body is plain text: the message, then `--`, the sender's email and the
time it was sent. The subject is always "Enough Money feedback", and
Reply-To is the sender. Problems go to the function's logs (Bird's status
and answer, never the message itself).
