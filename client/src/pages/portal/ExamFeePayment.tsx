import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  ShieldCheck, Receipt, GraduationCap, Calendar, DollarSign,
} from "lucide-react";

// ─── Paystack v2 inline type declarations ────────────────────────────────────
declare global {
  interface Window {
    PaystackPop: new () => {
      newTransaction(options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency?: string;
        metadata?: Record<string, unknown>;
        onSuccess: (transaction: { reference: string }) => void;
        onCancel: () => void;
      }): void;
      resumeTransaction(
        accessCode: string,
        onSuccess: (transaction: { reference: string }) => void,
        onCancel: () => void,
      ): void;
    };
  }
}

// ─── Utility: lazily load the Paystack v2 inline script ──────────────────────
function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();

    const existing = document.getElementById("paystack-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Paystack script failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "paystack-js";
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load payment gateway script"));
    document.head.appendChild(script);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExamFeePayment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"check" | "paying" | "success" | "failed">("check");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  // ── Status query ────────────────────────────────────────────────────────────
  const statusQuery = useQuery({ queryKey: ["/api/exam-payments/status"] });
  const status: any = statusQuery.data;
  const isAlreadyPaid: boolean = status?.hasPaid ?? false;
  const feeAmount: number = status?.feeAmount ?? 0;
  const currentTerm: any = status?.currentTerm;
  const requirePayment: boolean = status?.requirePayment ?? false;

  // ── Verify mutation ─────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: (reference: string) =>
      apiRequest("POST", "/api/exam-payments/verify", { reference }),
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
    },
    onError: (error: any) => {
      setStep("failed");
      toast({
        title: "Verification failed",
        description:
          error.message ||
          "Payment verification failed. If you were charged, please contact the administrator.",
        variant: "destructive",
      });
    },
  });

  // ── Initiate mutation ───────────────────────────────────────────────────────
  const initiateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/exam-payments/initiate"),
    onSuccess: async (data: any) => {
      // Load Paystack v2 script
      try {
        await loadPaystackScript();
      } catch {
        setStep("check");
        toast({
          title: "Payment gateway unavailable",
          description: "Could not load the payment gateway. Please check your connection and try again.",
          variant: "destructive",
        });
        return;
      }

      if (!window.PaystackPop) {
        setStep("check");
        toast({
          title: "Payment gateway error",
          description: "Payment gateway failed to initialize. Please refresh the page and try again.",
          variant: "destructive",
        });
        return;
      }

      setPaymentReference(data.reference);
      setStep("paying");

      try {
        const paystack = new window.PaystackPop();

        // Use resumeTransaction when we have a server-side access_code.
        // This is the correct Paystack v2 method for pre-initialized transactions.
        if (data.accessCode) {
          paystack.resumeTransaction(
            data.accessCode,
            (transaction: { reference: string }) => {
              verifyMutation.mutate(transaction.reference);
            },
            () => {
              setStep("check");
              toast({
                title: "Payment cancelled",
                description: "You closed the payment window. You can try again anytime.",
              });
            },
          );
        } else {
          // Fallback: initialize directly from the client using the public key
          paystack.newTransaction({
            key: data.publicKey,
            email: data.email,
            amount: data.amountKobo,
            ref: data.reference,
            onSuccess: (transaction: { reference: string }) => {
              verifyMutation.mutate(transaction.reference);
            },
            onCancel: () => {
              setStep("check");
              toast({
                title: "Payment cancelled",
                description: "You closed the payment window. You can try again anytime.",
              });
            },
          });
        }
      } catch (err: any) {
        setStep("check");
        toast({
          title: "Could not open payment window",
          description: err.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setStep("check");
      toast({
        title: "Could not start payment",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePayNow = () => {
    setStep("paying");
    initiateMutation.mutate();
  };

  const handleRetryVerify = () => {
    if (paymentReference) verifyMutation.mutate(paymentReference);
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Payment not required ─────────────────────────────────────────────────────
  if (!requirePayment) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">No Payment Required</p>
            <p className="text-muted-foreground text-sm">
              Exam fee payment is not currently required. You can access all exams freely.
            </p>
            <Button variant="outline" onClick={() => navigate("/portal/student/exams")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Already paid ─────────────────────────────────────────────────────────────
  if (isAlreadyPaid) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-bold text-xl text-green-700 dark:text-green-400">Exam Fee Paid</p>
              {currentTerm && (
                <p className="text-muted-foreground text-sm mt-1">
                  {currentTerm.name} {currentTerm.year}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Your exam access is unlocked for this term. You can now take all available exams.
            </p>
            <Button onClick={() => navigate("/portal/student/exams")}>
              <GraduationCap className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main payment view ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/portal/student/exams")}
        className="gap-2"
        data-testid="button-back-to-exams"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Exams
      </Button>

      {/* ── Success ── */}
      {step === "success" && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-bold text-2xl text-green-700 dark:text-green-400">
                Payment Successful!
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Your exam access has been unlocked for this term.
              </p>
            </div>
            <Button onClick={() => navigate("/portal/student/exams")} data-testid="button-go-to-exams">
              <GraduationCap className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Failed ── */}
      {step === "failed" && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-bold text-lg text-red-700 dark:text-red-400">
                Payment Not Confirmed
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                We could not confirm your payment. If you were charged, please contact your
                administrator with reference:{" "}
                <span className="font-mono font-semibold">{paymentReference}</span>
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              {paymentReference && (
                <Button
                  variant="outline"
                  onClick={handleRetryVerify}
                  disabled={verifyMutation.isPending}
                  data-testid="button-retry-verify"
                >
                  {verifyMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Retry Verification
                </Button>
              )}
              <Button
                onClick={handlePayNow}
                disabled={initiateMutation.isPending}
                data-testid="button-try-again"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pay / Paying ── */}
      {(step === "check" || step === "paying") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Exam Fee Payment
            </CardTitle>
            <CardDescription>
              Pay your exam fee to unlock access to all exams for this term.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Current term */}
            {currentTerm && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Current Term</p>
                  <p className="font-semibold text-sm">
                    {currentTerm.name} {currentTerm.year}
                  </p>
                </div>
              </div>
            )}

            {/* Fee amount */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Exam Fee</p>
                  <p className="font-bold text-2xl">₦{feeAmount.toLocaleString()}</p>
                </div>
              </div>
              <Badge variant="secondary">One-time payment</Badge>
            </div>

            {/* Trust indicators */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>
                  Payment is securely processed by Paystack. Your card details are never
                  stored on our servers.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Receipt className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Your exam access is unlocked immediately after payment confirmation.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  This payment covers all exams for the current term. No duplicate charges.
                </span>
              </div>
            </div>

            {/* Pay button */}
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handlePayNow}
              disabled={initiateMutation.isPending || step === "paying"}
              data-testid="button-pay-now"
            >
              {initiateMutation.isPending || step === "paying" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening Payment Gateway…
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ₦{feeAmount.toLocaleString()} Now
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Powered by Paystack • Secured with SSL
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
