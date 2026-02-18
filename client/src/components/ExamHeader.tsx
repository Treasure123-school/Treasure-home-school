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
  timeRemaining,
  studentName,
  studentInitials,
  profileImageUrl
}: ExamHeaderProps) {
  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/public/settings"],
  });

  const displayLogo = settings?.schoolLogo || schoolLogo;
  const schoolName = settings?.schoolName || "Treasure-Home School";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining !== null && timeRemaining < 300;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between min-h-[90px] py-3 gap-6">
          {/* Left Side: Logo and Info */}
          <div className="flex items-center gap-5 min-w-0">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-[var(--exam-blue-start)] to-[var(--exam-blue-end)] rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <img 
                src={displayLogo} 
                alt="School Logo" 
                className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 object-contain drop-shadow-md"
              />
            </div>
            
            <div className="flex flex-col min-w-0 space-y-0.5">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--exam-blue-main)] dark:text-blue-400 tracking-tight leading-none truncate">
                {schoolName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="opacity-70">Subject:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">{subjectName}</span>
                </div>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                <div className="flex items-center gap-1">
                  <span className="opacity-70">Student:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">{studentName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Timer and Profile */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            {timeRemaining !== null && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-500 border",
                isLowTime 
                  ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse shadow-md shadow-red-200/50" 
                  : "bg-slate-50 text-slate-900 border-slate-200 dark:bg-slate-800/50 dark:text-slate-100 dark:border-slate-700 shadow-sm"
              )}>
                <Timer className={cn("w-5 h-5 sm:w-6 sm:h-6", isLowTime ? "text-red-500" : "text-slate-500 dark:text-slate-400")} />
                <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tighter">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-[var(--exam-blue-start)] to-[var(--exam-blue-end)] rounded-full opacity-20 group-hover:opacity-40 transition duration-300"></div>
              <Avatar className="relative h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 border-2 border-white dark:border-slate-800 shadow-lg ring-1 ring-slate-100 dark:ring-slate-700">
                <AvatarImage src={profileImageUrl || undefined} alt={studentName} className="object-cover" />
                <AvatarFallback className="bg-[var(--exam-blue-main)] text-white text-lg sm:text-xl font-bold">
                  {studentInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
