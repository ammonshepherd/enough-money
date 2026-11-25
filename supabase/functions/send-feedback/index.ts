/**
 * Manage → Send feedback: emails a signed-in user's message to the owner
 * through Bird (the same Bird workspace that sends the sign-in emails).
 *
 * Runs on Supabase Edge Functions (Deno). The Bird key never reaches the
 * browser: it is a function secret, like the addresses.
 *
 *   BIRD_API_KEY   Bird workspace key with emails:write ("bk_us1_…")
 *   FEEDBACK_TO    where feedback goes (the owner's inbox)
 *   FEEDBACK_FROM  sender on a domain verified in Bird,
 *                  e.g. "Enough Money <feedback@enoughmoney.app>"
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.
 */
import { allowedOrigin, birdEmail, birdHost, FeedbackError, readMessage } from "./email.ts";

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigin(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

/** The signed-in user's email, checked with Supabase Auth, or null. */
async function signedInEmail(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") ?? request.headers.get("apikey");
  if (!authorization || !url || !apikey) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { email?: string };
  return user.email || null;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get("Origin"));
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });

  try {
    const userEmail = await signedInEmail(request);
    if (!userEmail) throw new FeedbackError("Sign in to send feedback.", 401);

    const message = readMessage(await request.json().catch(() => null));

    const apiKey = Deno.env.get("BIRD_API_KEY");
    const to = Deno.env.get("FEEDBACK_TO");
    const from = Deno.env.get("FEEDBACK_FROM");
    if (!apiKey || !to || !from) {
      console.error("send-feedback: BIRD_API_KEY, FEEDBACK_TO or FEEDBACK_FROM is not set");
      throw new FeedbackError("Feedback isn't set up yet. Please try again later.", 503);
    }

    const response = await fetch(`${birdHost(apiKey)}/v1/email/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(birdEmail({ from, to, userEmail, message, sentAt: new Date() })),
    });
    if (!response.ok) {
      // Bird's answer, never the user's message, goes to the function's logs.
      console.error(`send-feedback: Bird answered ${response.status}`, await response.text());
      throw new FeedbackError("Your feedback couldn't be sent. Please try again later.", 502);
    }
    return reply(200, { sent: true });
  } catch (error) {
    if (error instanceof FeedbackError) return reply(error.status, { error: error.message });
    console.error("send-feedback:", error);
    return reply(500, { error: "Your feedback couldn't be sent. Please try again later." });
  }
});
