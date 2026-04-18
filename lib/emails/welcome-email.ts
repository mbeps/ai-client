import { sendEmail } from "./send-email";

/**
 * Sends a welcome email to a newly registered user.
 * Triggered by the Better Auth `after` hook on user creation.
 *
 * @param user - Name and email of the newly registered user.
 * @author Maruf Bepary
 */
export async function sendWelcomeEmail(user: { name: string; email: string }) {
  await sendEmail({
    to: user.email,
    subject: "Welcome to Our App!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Our App!</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for signing up for our app! We're excited to have you on board.</p>
        <p>Best regards,
        <br>
        Your App Team</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nThank you for signing up for our app! We're excited to have you on board.\n\nBest regards,\nYour App Team`,
  });
}
