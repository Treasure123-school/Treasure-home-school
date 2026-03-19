
export interface SendSmsOptions {
  to: string;
  message: string;
}

function normalizeSmsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return "+234" + digits.slice(1);
  }
  if (digits.startsWith("234") && digits.length === 13) {
    return "+" + digits;
  }
  if (digits.startsWith("7") || digits.startsWith("8") || digits.startsWith("9")) {
    if (digits.length === 10) return "+234" + digits;
  }
  return phone.startsWith("+") ? phone : "+" + digits;
}

export async function sendSms({ to, message }: SendSmsOptions): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return false;
  }

  const phone = normalizeSmsPhone(to);

  try {
    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: from,
      To: phone,
      Body: message,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data: any = await res.json();
    if (!res.ok) {
      console.error("[SMS] Twilio error:", data?.message || data);
      return false;
    }
    console.log("[SMS] Sent:", data.sid);
    return true;
  } catch (err) {
    console.error("[SMS] Failed to send:", err);
    return false;
  }
}

export function getPaymentConfirmationSms(
  studentName: string,
  amount: number,
  reference: string,
  termName: string,
  schoolName: string = "Treasure Home School",
): string {
  const formatted = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
  return `${schoolName}: Hi ${studentName}, your exam fee of ${formatted} for ${termName} is CONFIRMED.\n\nPaystack Ref: ${reference}\n\nKeep this as proof. Use it in "Restore Exam Access" if your exam isn't unlocked.`;
}
