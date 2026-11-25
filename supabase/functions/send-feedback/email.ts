/**
 * The pure parts of the send-feedback function: checking the request, the
 * Bird request it sends, and which browsers may call it. No Deno APIs here,
 * so the unit tests (Vitest) can import this file.
 */

/** Longest message accepted, in characters (src/models/feedback.ts has the same). */
export const MAX_FEEDBACK = 5000;

/** The function's answer to a bad request, in words a person can act on. */
export class FeedbackError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** The message from a request body ({ message: "…" }), trimmed. Throws FeedbackError. */
export function readMessage(body: unknown): string {
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? (body as { message: unknown }).message
      : undefined;
  if (typeof message !== "string") throw new FeedbackError("Write a message first.");
  const text = message.trim();
  if (!text) throw new FeedbackError("Write a message first.");
  if (text.length > MAX_FEEDBACK) {
    throw new FeedbackError(`Keep it under ${MAX_FEEDBACK.toLocaleString("en-US")} characters.`);
  }
  return text;
}

/**
 * Bird's API host for a key: workspace keys start with their region
 * ("bk_us1_…", "bk_eu1_…"); anything else uses the default region, us1.
 */
export function birdHost(apiKey: string): string {
  const region = /^b[km]_(us1|eu1)_/.exec(apiKey)?.[1] ?? "us1";
  return `https://${region}.platform.bird.com`;
}

/**
 * The body of Bird's POST /v1/email/messages: plain text only, a fixed
 * subject (nothing the user typed goes in a header), and Reply-To set to the
 * sender so the owner can just reply.
 */
export function birdEmail({
  from,
  to,
  userEmail,
  message,
  sentAt,
}: {
  from: string;
  to: string;
  userEmail: string;
  message: string;
  sentAt: Date;
}) {
  return {
    from,
    to: [to],
    subject: "Enough Money feedback",
    text: `${message}\n\n--\nFrom: ${userEmail}\nSent: ${sentAt.toISOString()}\n`,
    reply_to: [userEmail],
    category: "transactional",
    track_opens: false,
    track_clicks: false,
  };
}

/** Browsers allowed to call the function: the live site and local development. */
export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === "https://enoughmoney.app") return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}
