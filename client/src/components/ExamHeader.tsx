import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timer, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import schoolLogo from "@assets/1000025432-removebg-preview (1)_1757796555126.png";

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
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-b shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: School Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <img 
            src={schoolLogo} 
            alt="School Logo" 
            className="w-8 h-8 object-contain shrink-0"
          />
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate hidden sm:inline">
            Treasure-Home School
          </span>
        </div>

        {/* Center: Exam Details & Timer */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-none">
              {subjectName}
            </h2>
            <span className="text-slate-400">|</span>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {schoolClassName}
            </span>
          </div>
          {timeRemaining !== null && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-0.5 rounded-full text-sm font-mono font-bold transition-colors",
              isLowTime 
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse" 
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            )}>
              <Timer className="w-4 h-4" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>

        {/* Right: Student Info & Progress Text */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Question {currentQuestion} of {totalQuestions}
            </span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {studentName}
            </span>
          </div>
          <Avatar className="h-9 w-9 border-2 border-slate-100 dark:border-slate-800">
            <AvatarImage src={profileImageUrl || undefined} alt={studentName} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {studentInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      
      {/* Progress Bar - Full Width below header */}
      <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
