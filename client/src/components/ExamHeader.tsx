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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import schoolLogo from "@assets/1000025432-removebg-preview (1)_1757796555126.png";

export function ExamHeader({
  subjectName,
  className: schoolClassName,
  currentQuestion,
  totalQuestions,
  timeRemaining,
  studentName,
  studentInitials,
  profileImageUrl
}: ExamHeaderProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining !== null && timeRemaining < 300; // 5 minutes
  const progress = (currentQuestion / totalQuestions) * 100;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-4 sm:py-6">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 flex items-center justify-between gap-4 sm:gap-8">
            {/* Left Side: Logo and School Info */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <div className="w-12 h-12 sm:w-20 sm:h-20 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-xl shrink-0 border border-slate-100 dark:border-slate-700">
                <img 
                  src={schoolLogo} 
                  alt="School Logo" 
                  className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1e40af] dark:text-blue-400 leading-tight truncate">
                  Treasure-Home School
                </h1>
                <p className="hidden sm:block text-xs sm:text-sm font-medium text-slate-400 italic">
                  Honesty and Success
                </p>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-base font-medium text-slate-500 dark:text-slate-400">
                  <span className="truncate">Subject: <span className="font-semibold text-slate-900 dark:text-slate-100">{subjectName}</span></span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{schoolClassName}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Timer and Student Avatar */}
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              {timeRemaining !== null && (
                <div className={cn(
                  "flex items-center gap-2 sm:gap-4 px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl text-base sm:text-2xl md:text-3xl font-bold transition-all duration-300 border shadow-sm",
                  isLowTime 
                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse" 
                    : "bg-blue-50/50 text-[#1e40af] border-blue-100 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-900/30"
                )}>
                  <Timer className={cn("w-5 h-5 sm:w-8 sm:h-8", isLowTime ? "text-red-500" : "text-[#1e40af] dark:text-blue-400")} />
                  <span className="font-mono tabular-nums tracking-tight">{formatTime(timeRemaining)}</span>
                </div>
              )}

              <Avatar className="h-10 w-10 sm:h-16 sm:w-16 border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                <AvatarImage src={profileImageUrl || undefined} alt={studentName} />
                <AvatarFallback className="bg-[#1e40af] text-white text-sm sm:text-xl font-bold">
                  {studentInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Integrated Progress Bar */}
          <div className="h-1 sm:h-1.5 w-full bg-slate-100 dark:bg-slate-800">
            <div 
              className="h-full bg-[#1e40af] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
