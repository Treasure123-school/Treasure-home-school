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
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-b shadow-md">
      <div className="container mx-auto px-4 h-24 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-4">
          {/* Left: School Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src={schoolLogo} 
              alt="School Logo" 
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400 leading-tight">
                Treasure-Home School
              </span>
              <span className="text-sm font-medium text-slate-500 truncate">
                {subjectName}
              </span>
            </div>
          </div>

          {/* Center: Timer */}
          <div className="flex items-center justify-center">
            {timeRemaining !== null && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-lg font-mono font-bold shadow-sm transition-colors",
                isLowTime 
                  ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse" 
                  : "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
              )}>
                <Timer className="w-5 h-5" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          {/* Right: Student Info */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {studentName}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                Question {currentQuestion} / {totalQuestions}
              </span>
            </div>
            <Avatar className="h-10 w-10 border-2 border-blue-100 dark:border-blue-800 shadow-sm">
              <AvatarImage src={profileImageUrl || undefined} alt={studentName} />
              <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                {studentInitials}
              </AvatarFallback>
            </Avatar>
          </div>
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
