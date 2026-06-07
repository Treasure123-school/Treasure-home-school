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
      className="mb-4 sm:mb-6 flex items-center gap-3 rounded-lg border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5 px-4 py-3"
      data-testid="profile-incomplete-banner"
    >
      <CircleAlert className="h-4 w-4 flex-shrink-0 text-primary dark:text-primary/70" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary dark:text-primary/30 leading-snug">
          {message}
          {percentage !== undefined && percentage > 0 && (
            <span className="ml-1 text-primary dark:text-primary/60">{percentage}% done.</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={() => navigate(profilePath)}
          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-white dark:bg-primary/85 dark:hover:bg-primary"
          data-testid="button-complete-profile"
        >
          Complete Profile
        </Button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            data-testid="button-dismiss-banner"
            className="rounded-full p-1 text-primary dark:text-primary/70 hover:bg-primary/10 dark:hover:bg-primary/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
