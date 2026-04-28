/**
 * Postmark transactional email integration.
 * All outbound emails (verification, reset, welcome, deletion) are dispatched through this single helper.
 * Requires `POSTMARK_SERVER_TOKEN` and `POSTMARK_FROM_EMAIL` environment variables.
 *
 * @see sendWelcomeEmail
 * @see sendEmailVerificationEmail
 * @see sendPasswordResetEmail
 * @see sendDeleteAccountVerificationEmail
 * @author Maruf Bepary
 */

import { env } from "@/lib/env";
import { ServerClient } from "postmark";

/** Singleton Postmark server client initialised from `POSTMARK_SERVER_TOKEN`. */
const postmarkClient = new ServerClient(env.POSTMARK_SERVER_TOKEN);

/**
 * Sends a transactional email through Postmark.
 * Used by all email templates to dispatch HTML and plain-text messages.
 * The sender address is read from `POSTMARK_FROM_EMAIL`; both HTML and plain-text bodies are sent for client compatibility.
 *
 * @param to - Recipient email address
 * @param subject - Message subject line (displayed in email client)
 * @param html - HTML body rendered in rich email clients
 * @param text - Plain-text fallback for text-only email clients
 * @returns Promise resolving with Postmark's send response (includes MessageID)
 * @throws {ServerError} When Postmark token is invalid or network fails
 * @author Maruf Bepary
 */
export function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return postmarkClient.sendEmail({
    From: env.POSTMARK_FROM_EMAIL,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
  });
}
