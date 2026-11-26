# Email templates

The HTML of the emails Supabase Auth sends (v0.52.1). Supabase does not read
these files: each one is pasted into the dashboard of the production project
(Authentication → Emails), with its subject. `supabase/config.toml` does not
use them either (local development only, and nothing sends email there).

| Dashboard template                      | File                                 | Subject                          |
| --------------------------------------- | ------------------------------------ | -------------------------------- |
| Invite user                             | `invite.html`                        | You're invited to Enough Money   |
| Reset password                          | `recovery.html`                      | Reset your Enough Money password |
| Change email address                    | `email_change.html`                  | Confirm your email change        |
| Password changed (security notice)      | `password_changed_notification.html` | Your password was changed        |
| Email address changed (security notice) | `email_changed_notification.html`    | Your email address was changed   |

The two security notices are sent only while they are turned on under
Authentication → Emails → Security notifications.

Not here, because they are never sent: Confirm sign up (public sign-up is
off, and the app does not handle a `type=signup` link), Magic link and
Reauthentication.

## Rules

- **Links.** The three emails with a link point to the app as
  `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=invite|recovery|email_change`,
  never `{{ .ConfirmationURL }}` (docs/SPEC.md → Sign in). The address is
  written twice in each: the button and the copyable fallback under it.
- **Built for email clients.** Tables for layout, every style inline, no
  `<style>` block, no web fonts, no scripts. Colours are the app's light
  theme (`src/styles/01-tokens.css`: brand `#4b2a68`, page `#ece7f2`,
  text `#281a35` / `#4b4256` / `#74677e`); the emails ask clients for light
  mode only. Outlook on Windows shows square corners and no shadows.
- **Pictures load from the live site**, so a new or changed one must be
  deployed before its template is pasted in: the logo is
  `https://enoughmoney.app/app/icons/icon-192.png` and the invite's picture
  is `https://enoughmoney.app/email/envelopes.jpg` (`landing/email/`). Email
  clients do not show SVG or WebP, so pictures are PNG or JPEG.
- **Greeting.** `{{ if .Data.display_name }}Hi {{ .Data.display_name }},{{ else }}Hi,{{ end }}`
  uses the display name from Manage → Account Info when there is one.
- **Wording** follows the landing page: money is assigned to envelopes;
  never "give every dollar a job".

To preview one, open it in a browser: the placeholders show as written.
