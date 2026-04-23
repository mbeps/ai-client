/**
 * Postmark transactional email integration.
 * All outbound emails (verification, reset, welcome, deletion) are dispatched
 * through the single `sendEmail` helper exposed by this module.
 */

import { env } from "@/lib/env";
import { ServerClient } from "postmark";

/** Singleton Postmark server client initialised from `POSTMARK_SERVER_TOKEN`. */
const postmarkClient = new ServerClient(env.POSTMARK_SERVER_TOKEN);

/**
 * Sends a transactional email through the configured Postmark client.
 * The `From` address is read from `POSTMARK_FROM_EMAIL`; both HTML and
 * plain-text bodies should be supplied for maximum client compatibility.
 *
 * @param to - Recipient email address.
 * @param subject - Message subject line.
 * @param html - HTML body rendered in rich email clients.
 * @param text - Plain-text fallback for clients that do not render HTML.
 * @returns Promise resolving with Postmark's send response.
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
