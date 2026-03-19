
import { sendEmail, getPaymentConfirmationEmailHTML } from "./email-service";
import { sendSms, getPaymentConfirmationSms } from "./sms-service";
import { storage } from "./storage";

export interface PaymentNotificationData {
  studentId: string;
  amount: number;
  reference: string;
  termName: string;
  paidAt: Date;
}

export async function sendPaymentConfirmationNotifications(
  data: PaymentNotificationData,
): Promise<void> {
  try {
    const settings = await storage.getSystemSettings();
    const schoolName = settings?.schoolName || "Treasure Home School";

    const studentUser = await storage.getUser(data.studentId);
    if (!studentUser) return;

    const studentName = `${studentUser.firstName || ""} ${studentUser.lastName || ""}`.trim() || "Student";

    const emailEnabled = settings?.enableEmailNotifications ?? true;
    const smsEnabled = settings?.enableSmsNotifications ?? false;

    // Send email if enabled and student has an email address
    if (emailEnabled && studentUser.email) {
      const html = getPaymentConfirmationEmailHTML(
        studentName,
        data.amount,
        data.reference,
        data.termName,
        data.paidAt,
        schoolName,
      );
      const sent = await sendEmail({
        to: studentUser.email,
        subject: `Payment Confirmed — Exam Fee | Ref: ${data.reference}`,
        html,
      });
      if (sent) {
        console.log(`[PAYMENT NOTIFY] Email sent to ${studentUser.email} for ref ${data.reference}`);
      } else {
        console.warn(`[PAYMENT NOTIFY] Email failed for ${studentUser.email}`);
      }
    }

    // Send SMS if enabled and student has a phone number
    if (smsEnabled && studentUser.phone) {
      const message = getPaymentConfirmationSms(
        studentName,
        data.amount,
        data.reference,
        data.termName,
        schoolName,
      );
      const sent = await sendSms({ to: studentUser.phone, message });
      if (sent) {
        console.log(`[PAYMENT NOTIFY] SMS sent to ${studentUser.phone} for ref ${data.reference}`);
      } else {
        console.warn(`[PAYMENT NOTIFY] SMS failed for ${studentUser.phone}`);
      }
    }
  } catch (err) {
    // Notifications must never crash the payment flow
    console.error("[PAYMENT NOTIFY] Error sending notifications:", err);
  }
}
