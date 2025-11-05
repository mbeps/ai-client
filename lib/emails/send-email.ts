import { ServerClient } from "postmark"

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!)

export function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}) {
  return postmarkClient.sendEmail({
    From: process.env.POSTMARK_FROM_EMAIL!,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
  })
}
