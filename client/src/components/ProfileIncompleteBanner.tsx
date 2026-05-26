import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CircleAlert, X } from 'lucide-react';

interface ProfileIncompleteBannerProps {
  message?: string;
  percentage?: number;
  profilePath: string;
  onDismiss?: () => void;
}

export default function ProfileIncompleteBanner({
  message = 'Complete your profile to unlock all features.',
  percentage,
  profilePath,
  onDismiss,
}: ProfileIncompleteBannerProps) {
  const [, navigate] = useLocation();

  return (
    <div
      className="mb-4 sm:mb-6 flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3"
      data-testid="profile-incomplete-banner"
    >
      <CircleAlert className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 leading-snug">
          {message}
          {percentage !== undefined && percentage > 0 && (
            <span className="ml-1 text-blue-700 dark:text-blue-300">{percentage}% done.</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={() => navigate(profilePath)}
          className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
          data-testid="button-complete-profile"
        >
          Complete Profile
        </Button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            data-testid="button-dismiss-banner"
            className="rounded-full p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
