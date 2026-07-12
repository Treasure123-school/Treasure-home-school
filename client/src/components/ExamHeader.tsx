import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import schoolLogo from "@assets/file_00000000d62c71fdb9145647ea13c6bc(1)_1771427539120.png";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

interface ExamHeaderProps {
  subjectName: string;
  className: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number | null;
  studentName: string;
  studentInitials: string;
  profileImageUrl?: string | null;
}

interface SystemSettings {
  schoolName: string;
  schoolLogo?: string;
}

export function ExamHeader({
  subjectName,
  className: studentClassName,
  currentQuestion,
  totalQuestions,
  timeRemaining,
  studentName,
  studentInitials,
  profileImageUrl
}: ExamHeaderProps) {
  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/public/settings"],
  });

  const displayLogo = settings?.schoolLogo || schoolLogo;
  const schoolName = settings?.schoolName || "";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining !== null && timeRemaining < 300;

  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderHeight(el.offsetHeight);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [schoolName, subjectName, studentName]);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
      >
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between gap-2 py-1.5 sm:py-2.5">
            {/* Left Side: Logo and Info */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <img
                src={displayLogo}
                alt="School Logo"
                className="h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14 object-contain shrink-0"
              />

              <div className="flex flex-col min-w-0 gap-0.5">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-primary tracking-tight leading-tight truncate">
                  {schoolName}
                </h1>
                <div className="flex flex-col xs:flex-row xs:items-baseline xs:gap-3 gap-0 text-[11px] sm:text-xs font-medium leading-tight">
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Subject:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{subjectName || "—"}</span>
                  </div>
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Student:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{studentName || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Merged Avatar + Timer */}
            <div className="relative shrink-0 mr-0.5 sm:mr-1">
              <Avatar
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 shadow-md transition-all duration-500",
                  isLowTime
                    ? "border-[3px] border-red-400 dark:border-red-500 animate-pulse ring-2 ring-red-200/60 dark:ring-red-900/40"
                    : "border-[3px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700"
                )}
              >
                <AvatarImage src={profileImageUrl || undefined} alt={studentName} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {studentInitials}
                </AvatarFallback>
              </Avatar>

              {timeRemaining !== null && (
                <div
                  className={cn(
                    "absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-[1px] rounded-full border-2 border-white dark:border-slate-900 shadow-sm whitespace-nowrap transition-all duration-500",
                    isLowTime
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <Timer className="w-2.5 h-2.5" />
                  <span className="text-[10px] font-bold font-mono tabular-nums leading-none tracking-tighter">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Animated Progress Line */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
            style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
          />
        </div>
      </header>
      {/* Spacer: reserves exactly the header's real rendered height so content below never has a gap or overlap */}
      <div style={{ height: headerHeight }} aria-hidden="true" />
    </>
  );
}
