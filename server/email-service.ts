
import { Resend } from 'resend';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.log(`[EMAIL] No RESEND_API_KEY configured — skipping email to ${to} (subject: "${subject}")`);
      return false;
    }
    const fromAddress = process.env.EMAIL_FROM || 'Treasure Home School <onboarding@resend.dev>';
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[EMAIL] Resend API error sending to ${to}:`, error);
      return false;
    }
    console.log(`[EMAIL] Successfully sent email to ${to} (ID: ${data?.id})`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL] Exception sending email to ${to}:`, error?.message || error);
    return false;
  }
}

// Email templates
export function getPasswordResetEmailHTML(userName: string, resetLink: string, resetCode?: string): string {
  // Extract the token from the reset link if resetCode not provided
  const token = resetCode || resetLink.split('token=')[1] || '';
  const shortCode = token.substring(0, 8).toUpperCase(); // First 8 chars as short code
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      background: #f3f4f6;
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { 
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
    .header p { font-size: 14px; opacity: 0.9; }
    .content { padding: 40px 30px; background: white; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #111827; }
    .message { color: #4b5563; margin-bottom: 24px; font-size: 15px; }
    .code-section { 
      background: #eff6ff; 
      border: 2px dashed #3b82f6; 
      padding: 24px; 
      text-align: center; 
      border-radius: 8px; 
      margin: 24px 0; 
    }
    .code-label { color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .code { 
      font-size: 32px; 
      font-weight: 700; 
      color: #1e40af; 
      letter-spacing: 4px; 
      font-family: 'Courier New', Courier, monospace;
      background: white;
      padding: 12px 20px;
      border-radius: 6px;
      display: inline-block;
    }
    .button-container { text-align: center; margin: 32px 0; }
    .button { 
      display: inline-block; 
      background: #1e40af; 
      color: white !important; 
      padding: 14px 36px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600;
      font-size: 15px;
      transition: background 0.3s ease;
    }
    .button:hover { background: #1e3a8a; }
    .alt-link { 
      margin-top: 20px; 
      padding: 16px; 
      background: #f9fafb; 
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .alt-link-label { font-size: 13px; color: #6b7280; margin-bottom: 8px; font-weight: 500; }
    .alt-link-url { 
      word-break: break-all; 
      color: #3b82f6; 
      font-size: 12px;
      font-family: monospace;
    }
    .warning { 
      background: #fef3c7; 
      border-left: 4px solid #f59e0b; 
      padding: 16px; 
      margin: 24px 0;
      border-radius: 4px;
    }
    .warning-title { color: #92400e; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .warning-text { color: #78350f; font-size: 14px; }
    .info-box { 
      background: #f0f9ff; 
      border: 1px solid #bfdbfe; 
      padding: 16px; 
      border-radius: 6px; 
      margin: 24px 0;
    }
    .info-title { color: #1e40af; font-weight: 600; margin-bottom: 12px; font-size: 15px; }
    .info-list { padding-left: 20px; color: #1e3a8a; }
    .info-list li { margin-bottom: 8px; font-size: 14px; }
    .footer { 
      background: #f9fafb; 
      padding: 24px 30px; 
      text-align: center; 
      border-top: 1px solid #e5e7eb;
    }
    .footer-text { color: #6b7280; font-size: 13px; line-height: 1.8; }
    .footer-link { color: #3b82f6; text-decoration: none; }
    .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
    @media only screen and (max-width: 600px) {
      .content { padding: 24px 20px; }
      .code { font-size: 24px; letter-spacing: 2px; }
      .button { padding: 12px 24px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <h1>🔐 Password Reset</h1>
      <p>School Management System Portal</p>
    </div>
    
    <div class="content">
      <div class="greeting">Hello ${userName},</div>
      
      <p class="message">
        We received a request to reset your password for your account. 
        Use the code or link below to create a new password.
      </p>
      
      <div class="code-section">
        <div class="code-label">Your Reset Code</div>
        <div class="code">${shortCode}</div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">Valid for 15 minutes</p>
      </div>
      
      <div class="button-container">
        <a href="${resetLink}" class="button">Reset Your Password</a>
      </div>
      
      <div class="alt-link">
        <div class="alt-link-label">Or copy this link:</div>
        <div class="alt-link-url">${resetLink}</div>
      </div>
      
      <div class="warning">
        <div class="warning-title">
          <span>⏰</span>
          <span>Time-Sensitive Request</span>
        </div>
        <div class="warning-text">
          This reset link expires in 15 minutes for your security. 
          If it expires, you'll need to request a new one.
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div class="info-box">
        <div class="info-title">🔒 Security Tips</div>
        <ul class="info-list">
          <li>Never share your password or reset code with anyone</li>
          <li>Create a strong password with uppercase, lowercase, numbers, and symbols</li>
          <li>Avoid using personal information in your password</li>
          <li>Don't reuse passwords from other accounts</li>
        </ul>
      </div>
      
      <p class="message" style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        If you didn't request this password reset, please ignore this email. 
        Your account remains secure and no changes were made.
      </p>
      
      <p class="message" style="font-size: 14px; color: #6b7280;">
        Need help? Contact our administrator at 
        <a href="mailto:admin@school.com" style="color: #3b82f6;">admin@school.com</a>
      </p>
    </div>
    
    <div class="footer">
      <div class="footer-text">
        <strong>School Management System</strong><br>
        "Excellence in Education"<br>
        School Address<br>
        <a href="mailto:admin@school.com" class="footer-link">admin@school.com</a>
      </div>
      <div style="margin-top: 12px; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} School Management System. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
export function getPaymentConfirmationEmailHTML(
  studentName: string,
  amount: number,
  reference: string,
  termName: string,
  paidAt: Date,
  schoolName: string = "Treasure Home School",
): string {
  const formattedAmount = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
  const formattedDate = paidAt.toLocaleString("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f3f4f6; padding: 20px; color: #1f2937; }
    .wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 36px 30px; text-align: center; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .checkmark { font-size: 48px; margin-bottom: 12px; }
    .content { padding: 36px 30px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 12px; color: #111827; }
    .intro { color: #4b5563; font-size: 15px; margin-bottom: 24px; }
    .ref-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0; }
    .ref-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 10px; }
    .ref-value { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #14532d; word-break: break-all; background: white; padding: 12px 16px; border-radius: 6px; border: 1px dashed #86efac; display: inline-block; margin-top: 4px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .details-table td { padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .details-table td:first-child { color: #6b7280; width: 40%; }
    .details-table td:last-child { font-weight: 600; color: #111827; }
    .warning-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 24px 0; }
    .warning-box p { color: #92400e; font-size: 14px; line-height: 1.6; }
    .warning-box strong { color: #78350f; }
    .footer { background: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.8; }
    @media (max-width: 600px) { .content { padding: 24px 16px; } .ref-value { font-size: 14px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="checkmark">✅</div>
      <h1>Payment Confirmed</h1>
      <p>${schoolName} — Exam Fee Receipt</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${studentName},</div>
      <p class="intro">Your exam fee payment has been successfully confirmed. Please keep this email as your official proof of payment.</p>

      <div class="ref-box">
        <div class="ref-label">Your Paystack Reference (Proof of Payment)</div>
        <div class="ref-value">${reference}</div>
      </div>

      <table class="details-table">
        <tr><td>Amount Paid</td><td>${formattedAmount}</td></tr>
        <tr><td>Academic Term</td><td>${termName}</td></tr>
        <tr><td>Payment Date</td><td>${formattedDate}</td></tr>
        <tr><td>Payment Method</td><td>Online (Paystack)</td></tr>
        <tr><td>Status</td><td style="color:#16a34a">✓ Confirmed</td></tr>
      </table>

      <div class="warning-box">
        <p><strong>⚠️ Important — Save This Reference:</strong><br>
        If your exam access was not unlocked automatically, use the reference above in the <em>Restore Exam Access</em> modal on your exam page. This reference proves your payment to the school system.</p>
      </div>

      <p style="font-size:14px;color:#6b7280;margin-top:16px;">
        If you have any issues, contact your school administrator and share this reference number: <strong>${reference}</strong>
      </p>
    </div>
    <div class="footer">
      <strong>${schoolName}</strong><br>
      "Excellence in Education"<br>
      © ${new Date().getFullYear()} ${schoolName}. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

export function getPasswordChangedEmailHTML(userName: string, ipAddress: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Changed</h1>
    </div>
    <div class="content">
      <h2>Password Successfully Changed</h2>
      <p>Hello ${userName},</p>
      <p>Your password was successfully changed on THS Portal.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Changed at: ${new Date().toLocaleString()}</li>
        <li>IP Address: ${ipAddress}</li>
      </ul>
      <div class="alert">
        <strong>⚠️ Didn't make this change?</strong><br>
        If you didn't change your password, contact the school administration immediately:<br>
        Email: admin@school.com
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} School Management System</p>
    </div>
  </div>
</body>
</html>
  `;
}
