import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  ShieldCheck, Receipt, GraduationCap, Calendar, DollarSign,
} from "lucide-react";

declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }): { openIframe: () => void };
      newTransaction(options: {
        key: string;
        access_code: string;
        onSuccess: (response: { reference: string }) => void;
        onCancel: () => void;
      }): { openIframe: () => void };
    };
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.getElementById("paystack-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-js";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });
}

export default function ExamFeePayment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<"check" | "paying" | "success" | "failed">("check");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["/api/exam-payments/status"],
  });

  const status: any = statusQuery.data;
  const isAlreadyPaid = status?.hasPaid;
  const feeAmount: number = status?.feeAmount ?? 0;
  const currentTerm: any = status?.currentTerm;
  const requirePayment: boolean = status?.requirePayment ?? false;

  const initiateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/exam-payments/initiate"),
    onSuccess: async (data: any) => {
      try {
        await loadPaystackScript();
      } catch {
        toast({ title: "Error", description: "Could not load payment gateway. Please try again.", variant: "destructive" });
        setStep("check");
        return;
      }

      if (!window.PaystackPop) {
        toast({ title: "Error", description: "Payment gateway failed to initialize.", variant: "destructive" });
        setStep("check");
        return;
      }

      setPaymentReference(data.reference);
      setStep("paying");

      const handler = window.PaystackPop.newTransaction({
        key: data.publicKey,
        access_code: data.accessCode,
        onSuccess: (response: { reference: string }) => {
          verifyMutation.mutate(response.reference);
        },
        onCancel: () => {
          setStep("check");
          toast({
            title: "Payment cancelled",
            description: "You closed the payment window. You can try again anytime.",
          });
        },
      });

      handler.openIframe();
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

  const verifyMutation = useMutation({
    mutationFn: (reference: string) =>
      apiRequest("POST", "/api/exam-payments/verify", { reference }),
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/exam-payments/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/exams"] });
    },
    onError: (error: any) => {
      setStep("failed");
      toast({
        title: "Verification failed",
        description: error.message || "Payment verification failed. If you were charged, please contact the administrator.",
        variant: "destructive",
      });
    },
  });

  const handlePayNow = () => {
    setStep("paying");
    initiateMutation.mutate();
  };

  const handleRetryVerify = () => {
    if (paymentReference) {
      verifyMutation.mutate(paymentReference);
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requirePayment) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">No Payment Required</p>
            <p className="text-muted-foreground text-sm">Exam fee payment is not currently required. You can access all exams freely.</p>
            <Button variant="outline" onClick={() => navigate("/portal/student/exams")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <p className="text-sm text-muted-foreground">Your exam access is unlocked for this term. You can now take all available exams.</p>
            <Button onClick={() => navigate("/portal/student/exams")}>
              <GraduationCap className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      {step === "success" && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-bold text-2xl text-green-700 dark:text-green-400">Payment Successful!</p>
              <p className="text-muted-foreground text-sm mt-2">Your exam access has been unlocked for this term.</p>
            </div>
            <Button onClick={() => navigate("/portal/student/exams")} data-testid="button-go-to-exams">
              <GraduationCap className="mr-2 h-4 w-4" /> Go to My Exams
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "failed" && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-bold text-lg text-red-700 dark:text-red-400">Payment Not Confirmed</p>
              <p className="text-muted-foreground text-sm mt-1">
                We could not confirm your payment. If you were charged, please contact your administrator with reference:{" "}
                <span className="font-mono font-semibold">{paymentReference}</span>
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              {paymentReference && (
                <Button variant="outline" onClick={handleRetryVerify} disabled={verifyMutation.isPending} data-testid="button-retry-verify">
                  {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Retry Verification
                </Button>
              )}
              <Button onClick={handlePayNow} disabled={initiateMutation.isPending} data-testid="button-try-again">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
            {currentTerm && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Current Term</p>
                  <p className="font-semibold text-sm">{currentTerm.name} {currentTerm.year}</p>
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
                <span>Payment is securely processed by Paystack. Your card details are never stored on our servers.</span>
              </div>
              <div className="flex items-start gap-2">
                <Receipt className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Your exam access is unlocked immediately after payment confirmation.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>This payment covers all exams for the current term. No duplicate charges.</span>
              </div>
            </div>

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
