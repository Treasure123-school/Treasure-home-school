import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import schoolLogo from "@assets/file_00000000d62c71fdb9145647ea13c6bc(1)_1771427539120.png";
import { useQuery } from "@tanstack/react-query";

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between py-2.5 sm:py-3 gap-x-3 gap-y-1.5">
          {/* Left Side: Logo and Info */}
          <div className="flex items-center gap-2.5 sm:gap-6 min-w-0 flex-1 sm:flex-initial order-1">
            <div className="shrink-0">
              <img 
                src={displayLogo} 
                alt="School Logo" 
                className="h-9 w-9 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain"
              />
            </div>
            
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-xl md:text-2xl font-bold text-primary tracking-tight leading-none truncate mb-0.5 sm:mb-2">
                {schoolName}
              </h1>
              <div className="hidden sm:flex flex-col gap-x-4 gap-y-0.5 text-xs sm:text-sm font-medium">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Subject:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{subjectName || "—"}</span>
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Student:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{studentName || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Merged Avatar + Timer */}
          <div className="flex items-center shrink-0 order-2 sm:order-3">
            <div className="relative">
              <Avatar
                className={cn(
                  "h-11 w-11 sm:h-14 sm:w-14 shadow-md transition-all duration-500",
                  isLowTime
                    ? "border-[3px] border-red-400 dark:border-red-500 animate-pulse ring-2 ring-red-200/60 dark:ring-red-900/40"
                    : "border-[3px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700"
                )}
              >
                <AvatarImage src={profileImageUrl || undefined} alt={studentName} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-base sm:text-lg font-bold">
                  {studentInitials}
                </AvatarFallback>
              </Avatar>

              {timeRemaining !== null && (
                <div
                  className={cn(
                    "absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-[2px] rounded-full border-2 border-white dark:border-slate-900 shadow-sm whitespace-nowrap transition-all duration-500",
                    isLowTime
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <Timer className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="text-[10px] sm:text-xs font-bold font-mono tabular-nums leading-none tracking-tighter">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subject / Student info row — full width on mobile so text is never clipped */}
          <div className="flex flex-col gap-0.5 text-[11px] sm:hidden w-full order-3 min-w-0 pl-[46px]">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">Subject:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{subjectName || "—"}</span>
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">Student:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold break-words">{studentName || "—"}</span>
            </div>
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
  );
}
