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
        <div className="flex items-center justify-between min-h-[90px] py-3 gap-4">
          {/* Left Side: Logo and Info */}
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <div className="shrink-0">
              <img 
                src={displayLogo} 
                alt="School Logo" 
                className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain"
              />
            </div>
            
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#0000FF] dark:text-blue-400 tracking-tight leading-none truncate mb-2">
                {schoolName}
              </h1>
              <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:text-sm font-medium overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Subject:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold truncate block">{subjectName || "—"}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Student:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold truncate block">{studentName || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Timer and Profile */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {timeRemaining !== null && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-500 border bg-slate-50/50 dark:bg-slate-800/30",
                isLowTime 
                  ? "text-red-600 border-red-200 dark:text-red-400 animate-pulse shadow-sm shadow-red-200/50" 
                  : "text-slate-900 border-slate-200 dark:text-slate-100 dark:border-slate-700 shadow-sm"
              )}>
                <Timer className={cn("w-4 h-4 sm:w-5 sm:h-5", isLowTime ? "text-red-500" : "text-slate-500 dark:text-slate-400")} />
                <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tighter">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}

            <div className="relative group">
              <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-white dark:border-slate-800 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                <AvatarImage src={profileImageUrl || undefined} alt={studentName} className="object-cover" />
                <AvatarFallback className="bg-[#0000FF] text-white text-lg font-bold">
                  {studentInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>
      {/* Animated Progress Line */}
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div 
          className="h-full bg-[#0000FF] dark:bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,0,255,0.4)]"
          style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
        />
      </div>
    </header>
  );
}
