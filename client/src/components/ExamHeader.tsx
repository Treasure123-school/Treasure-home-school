import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timer } from "lucide-react";
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-b shadow-sm h-28 flex items-center">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center justify-between">
          {/* Left Side: Logo and School Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shrink-0">
              <img 
                src={schoolLogo} 
                alt="School Logo" 
                className="w-14 h-14 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-[#1e40af] dark:text-blue-400 leading-tight">
                Treasure-Home School
              </h1>
              <p className="text-sm font-medium text-slate-500 italic">
                Honesty and Success
              </p>
              <div className="flex items-center gap-2 mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                <span>Subject: <span className="font-bold text-slate-900 dark:text-slate-100">{subjectName}</span></span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{schoolClassName}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Timer and Student Avatar */}
          <div className="flex items-center gap-4">
            {timeRemaining !== null && (
              <div className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-xl text-2xl font-bold transition-all duration-300 border shadow-sm",
                isLowTime 
                  ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse" 
                  : "bg-blue-50/50 text-[#1e40af] border-blue-100 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-900/30"
              )}>
                <Timer className={cn("w-7 h-7", isLowTime ? "text-red-500" : "text-[#1e40af]")} />
                <span className="font-mono tabular-nums">{formatTime(timeRemaining)}</span>
              </div>
            )}

            <Avatar className="h-14 w-14 border-2 border-white shadow-md ring-1 ring-slate-100 dark:ring-slate-800">
              <AvatarImage src={profileImageUrl || undefined} alt={studentName} />
              <AvatarFallback className="bg-[#1e40af] text-white text-xl font-bold">
                {studentInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Subtle Progress Bar attached to the bottom of the card */}
        <div className="mx-4 mt-[-2px] h-1.5 w-[calc(100%-32px)] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#1e40af] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
