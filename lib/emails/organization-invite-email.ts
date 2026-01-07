import { ROUTES } from "../routes";
import { sendEmail } from "./send-email";

/**
 * Notifies a user that they have been invited to join an organization.
 * @param invitation Invitation payload supplied by Better Auth.
 * @param inviter User who initiated the invitation.
 * @param organization Organization that issued the invite.
 * @param email Recipient email address for the invitee.
 */
export async function sendOrganizationInviteEmail({
  invitation,
  inviter,
  organization,
  email,
}: {
  invitation: { id: string };
  inviter: { name: string };
  organization: { name: string };
  email: string;
}) {
  await sendEmail({
    to: email,
    subject: `You're invited to join the ${organization.name} organization`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You're invited to join ${
          organization.name
        }</h2>
        <p>Hello ${inviter.name},</p>
        <p>${inviter.name} invited you to join the ${
      organization.name
    } organization. Please click the button below to accept/reject the invitation:</p>
        <a href="${process.env.BETTER_AUTH_URL}${ROUTES.ORGANIZATIONS.INVITE(
      invitation.id
    )}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Manage Invitation</a>
        <p>Best regards,<br>Your App Team</p>
      </div>
    `,
    text: `You're invited to join the ${
      organization.name
    } organization\n\nHello ${inviter.name},\n\n${
      inviter.name
    } invited you to join the ${
      organization.name
    } organization. Please click the link below to accept/reject the invitation:\n\n${
      process.env.BETTER_AUTH_URL
    }${ROUTES.ORGANIZATIONS.INVITE(
      invitation.id
    )}\n\nBest regards,\nYour App Team`,
  });
}
