import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  ShieldCheck, Receipt, GraduationCap, Calendar, DollarSign,
  ExternalLink, KeyRound,
} from "lucide-react";

type PaymentStep = "recovering" | "check" | "paying" | "verifying" | "success" | "failed";

export default function ExamFeePayment() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<PaymentStep>("recovering");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [manualRef, setManualRef] = useState("");
  const [manualRefError, setManualRefError] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusQuery = useQuery({ queryKey: ["/api/exam-payments/status"] });
  const status: any = statusQuery.data;
  const isAlreadyPaid: boolean = status?.hasPaid ?? false;
  const feeAmount: number = status?.feeAmount ?? 0;
  const currentTerm: any = status?.currentTerm;
  const requirePayment: boolean = status?.requirePayment ?? false;

  // ── Auto-recover on every page load ─────────────────────────────────────────
  // Silently re-check Paystack for any pending payment from a previous session.
  // This handles: logout mid-flow, browser crash, redirect mishap, etc.
  const recoverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exam-payments/recover");
      if (!res.ok) throw new Error("Recovery call failed");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.recovered && data?.payment) {
        // Payment was found on Paystack and is now marked paid
        queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
        setStep("success");
      } else {
        // No previous payment to recover — show normal pay screen
        setStep("check");
      }
    },
    onError: () => {
      // Recovery failed silently — just show normal pay screen
      setStep("check");
    },
  });

  useEffect(() => {
    // Only run recovery once after status has loaded and payment is not already confirmed
    if (!statusQuery.isLoading && !isAlreadyPaid && step === "recovering") {
      recoverMutation.mutate();
    }
    // If already paid skip recovery entirely
    if (!statusQuery.isLoading && isAlreadyPaid && step === "recovering") {
      setStep("check");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.isLoading, isAlreadyPaid]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  // ── Mobile/redirect flow: ?verify=REF in URL ────────────────────────────────
  // When Paystack redirects to /payment/callback and no opener exists (mobile /
  // new tab), the callback page redirects here with ?verify=REF so we can
  // auto-trigger verification.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyRef = params.get("verify");
    if (verifyRef && step === "check") {
      // Remove the query param from URL without a reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      setPaymentReference(verifyRef);
      setStep("verifying");
      verifyMutation.mutate(verifyRef);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Listen for postMessage from the /payment/callback popup ─────────────────
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "PAYSTACK_PAYMENT_CALLBACK" && event.data?.reference) {
        const ref = event.data.reference as string;
        stopPolling();
        setPaymentReference(ref);
        setStep("verifying");
        verifyMutation.mutate(ref);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ── Poll /api/exam-payments/status every 3 s while popup is open ───────────
  const startPolling = (reference: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      // If popup was closed by user (not by callback redirect), trigger verify
      if (popupRef.current && popupRef.current.closed) {
        stopPolling();
        setStep("verifying");
        verifyMutation.mutate(reference);
        return;
      }

      // Poll status — include auth token so the request is authenticated
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/exam-payments/status", {
          headers: {
            "Cache-Control": "no-cache",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hasPaid) {
            stopPolling();
            if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
            queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
            queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
            setStep("success");
          }
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 3000);
  };

  // ── Verify mutation ─────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/exam-payments/verify", { reference });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Verification failed" }));
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        setStep("success");
        queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      } else {
        setStep("failed");
      }
    },
    onError: () => {
      setStep("failed");
      toast({
        title: "Payment not confirmed",
        description: "Could not verify your payment. If you were charged, please contact your school administrator.",
        variant: "destructive",
      });
    },
  });

  // ── Manual Reference Verification ──────────────────────────────────────────
  const verifyByRefMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/exam-payments/verify-by-ref", { reference });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Verification failed");
      return body;
    },
    onSuccess: (data: any) => {
      setManualRefError("");
      if (data?.success) {
        setStep("success");
        setShowManualInput(false);
        queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
        toast({
          title: "Access Restored!",
          description: "Your payment has been verified and your exam access is now unlocked.",
        });
      } else {
        setManualRefError("That reference was not found or was not successful on Paystack. Double-check it and try again.");
      }
    },
    onError: (error: any) => {
      setManualRefError(error.message || "Could not verify that reference. Please check and try again.");
    },
  });

  // ── Initiate mutation ───────────────────────────────────────────────────────
  const initiateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exam-payments/initiate");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Could not start payment" }));
        throw new Error(err.message || "Could not start payment");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      const { reference, authorizationUrl: url } = data;

      if (!url || !reference) {
        setStep("check");
        toast({
          title: "Payment error",
          description: "Could not get payment URL. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setPaymentReference(reference);
      setAuthorizationUrl(url);
      setStep("paying");

      // Try to open a popup; fall back gracefully if blocked
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        url,
        "paystack_payment",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      );

      if (!popup || popup.closed) {
        // Popup was blocked — let user open manually; polling not possible
        toast({
          title: "Popup blocked",
          description: "Your browser blocked the payment window. Use the button below to open it manually.",
          variant: "destructive",
        });
        return;
      }

      popupRef.current = popup;
      startPolling(reference);
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

  const handleOpenLink = () => {
    if (!authorizationUrl) return;
    // On mobile this opens in the same tab; the callback URL will bring them back
    const popup = window.open(authorizationUrl, "_blank", "noopener,noreferrer");
    if (popup && paymentReference) {
      popupRef.current = popup;
      startPolling(paymentReference);
    }
  };

  const handleVerifyManually = () => {
    if (!paymentReference) return;
    stopPolling();
    setStep("verifying");
    verifyMutation.mutate(paymentReference);
  };

  const handleRetry = () => {
    stopPolling();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStep("check");
    setPaymentReference(null);
    setAuthorizationUrl(null);
  };

  // ── Loading / recovering ─────────────────────────────────────────────────────
  if (statusQuery.isLoading || step === "recovering") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {step === "recovering" && !statusQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Checking for previous payment…</p>
        )}
      </div>
    );
  }

  // ── Payment not required ────────────────────────────────────────────────────
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

  // ── Already paid ────────────────────────────────────────────────────────────
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
            <Button onClick={() => navigate("/portal/student/exams")} data-testid="button-go-to-exams">
              <GraduationCap className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────
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
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-bold text-2xl text-green-700 dark:text-green-400">Payment Successful!</p>
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

      {/* ── Waiting for payment ── */}
      {step === "paying" && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-lg">Waiting for Payment</p>
              <p className="text-muted-foreground text-sm mt-1">
                Complete your payment in the Paystack window that just opened.
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <p>If the payment window did not open, click the button below.</p>
            </div>
            <div className="flex flex-col gap-2">
              {authorizationUrl && (
                <Button
                  onClick={handleOpenLink}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-open-payment"
                >
                  <ExternalLink className="h-4 w-4" /> Open Payment Window
                </Button>
              )}
              <Button
                onClick={handleVerifyManually}
                disabled={verifyMutation.isPending}
                variant="outline"
                className="gap-2"
                data-testid="button-verify-payment"
              >
                {verifyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                I've Completed Payment — Verify Now
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRetry} className="text-muted-foreground">
                Cancel and start over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Verifying ── */}
      {step === "verifying" && (
        <Card>
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="font-semibold text-lg">Verifying Payment…</p>
            <p className="text-muted-foreground text-sm">
              Please wait while we confirm your payment with Paystack.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Failed ── */}
      {step === "failed" && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-bold text-lg text-red-700 dark:text-red-400">Payment Not Confirmed</p>
                <p className="text-muted-foreground text-sm mt-1">
                  We could not automatically confirm your payment.
                  {paymentReference && (
                    <> Your reference was: <span className="font-mono font-semibold">{paymentReference}</span></>
                  )}
                </p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                {paymentReference && (
                  <Button
                    variant="outline"
                    onClick={handleVerifyManually}
                    disabled={verifyMutation.isPending || verifyByRefMutation.isPending}
                    data-testid="button-retry-verify"
                  >
                    {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Retry Verification
                  </Button>
                )}
                <Button
                  onClick={handleRetry}
                  disabled={verifyMutation.isPending || verifyByRefMutation.isPending}
                  data-testid="button-try-again"
                >
                  Try Again
                </Button>
              </div>
            </div>
            {/* Manual Reference Entry */}
            <div className="border-t pt-4">
              <button
                className="flex items-center gap-2 text-sm text-primary hover:underline mx-auto"
                onClick={() => { setShowManualInput((v) => !v); setManualRefError(""); }}
                data-testid="button-toggle-manual-ref"
              >
                <KeyRound className="h-4 w-4" />
                {showManualInput ? "Hide" : "Have a different Paystack reference? Enter it manually"}
              </button>
              {showManualInput && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-ref-input">Paystack Payment Reference</Label>
                    <Input
                      id="manual-ref-input"
                      placeholder="e.g. EP-abc123-… or any Paystack ref"
                      value={manualRef}
                      onChange={(e) => { setManualRef(e.target.value); setManualRefError(""); }}
                      disabled={verifyByRefMutation.isPending}
                      data-testid="input-manual-paystack-ref"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in your Paystack email receipt or the payment summary screen.
                    </p>
                  </div>
                  {manualRefError && (
                    <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{manualRefError}</span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!manualRef.trim()) { setManualRefError("Please enter your reference."); return; }
                      verifyByRefMutation.mutate(manualRef.trim());
                    }}
                    disabled={verifyByRefMutation.isPending || !manualRef.trim()}
                    data-testid="button-submit-manual-ref"
                  >
                    {verifyByRefMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify & Unlock Exams</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Initial pay screen ── */}
      {step === "check" && (
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

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handlePayNow}
              disabled={initiateMutation.isPending}
              data-testid="button-pay-now"
            >
              {initiateMutation.isPending ? (
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
