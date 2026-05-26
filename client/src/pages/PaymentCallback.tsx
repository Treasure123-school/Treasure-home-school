import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * Paystack redirects here after a payment attempt:
 *   /payment/callback?reference=EP-xxx&trxref=EP-xxx
 *
 * Two cases:
 *  A) Popup flow  — window.opener exists → post message then close
 *  B) Redirect flow (mobile / new tab) → redirect back to the payment page
 *     with the reference so the payment page can verify automatically
 */
export default function PaymentCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"processing" | "done" | "error">("processing");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");

    if (!reference) {
      setStatus("error");
      setTimeout(() => navigate("/portal/student/exam-payment"), 3000);
      return;
    }

    if (window.opener && !window.opener.closed) {
      // Case A: we're in a popup — signal the parent and close
      window.opener.postMessage(
        { type: "PAYSTACK_PAYMENT_CALLBACK", reference },
        window.location.origin,
      );
      setStatus("done");
      setTimeout(() => window.close(), 1500);
    } else {
      // Case B: mobile / new-tab — redirect to payment page with reference
      setStatus("done");
      navigate(`/portal/student/exam-payment?verify=${encodeURIComponent(reference)}`);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-sm">
        {status === "processing" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="font-semibold text-lg">Processing your payment…</p>
            <p className="text-sm text-muted-foreground">Please wait, do not close this window.</p>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Payment received!</p>
            <p className="text-sm text-muted-foreground">Redirecting you back…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <p className="font-semibold text-lg">No payment reference found</p>
            <p className="text-sm text-muted-foreground">We couldn't find a payment reference. Redirecting you back to the payment page…</p>
          </>
        )}
      </div>
    </div>
  );
}
