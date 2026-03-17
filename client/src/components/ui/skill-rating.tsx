export const RATING_SCALE = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
} as const;

export const RATING_SCALE_TEXT = '1 = Poor | 2 = Fair | 3 = Good | 4 = Very Good | 5 = Excellent';

interface SkillRatingItemProps {
  label: string;
  value: number;
  onRatingChange: (rating: number) => void;
  canEdit: boolean;
  skillKey: string;
  isLoading?: boolean;
}

export function SkillRatingItem({
  label,
  value,
  onRatingChange,
  canEdit,
  skillKey,
  isLoading = false
}: SkillRatingItemProps) {
  // Unified design for both edit and view modes
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
      <span className="text-sm font-medium text-foreground flex-shrink-0 min-w-[140px]">{label}</span>
      <div className="flex gap-2 items-center flex-wrap justify-end">
        {[1, 2, 3, 4, 5].map((rating) => {
          const isSelected = value === rating;
          const isDisabled = !canEdit || isLoading;
          
          return (
            <button
              key={rating}
              onClick={() => canEdit && !isLoading && onRatingChange(rating)}
              type="button"
              disabled={isDisabled}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                isDisabled
                  ? 'cursor-default'
                  : 'cursor-pointer'
              } ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-md scale-105'
                  : isDisabled
                    ? 'bg-muted text-muted-foreground/50'
                    : 'bg-background border-2 border-muted text-muted-foreground hover:border-primary/50 hover:bg-primary/5'
              }`}
              title={`Rate ${label} as ${rating}`}
              data-testid={`skill-${skillKey}-${rating}`}
            >
              {rating}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SkillsSectionProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ key: string; label: string }>;
  values: Record<string, number>;
  onRatingChange: (key: string, rating: number) => void;
  canEdit: boolean;
  bgColor?: string;
}

export function SkillsSection({
  title,
  icon,
  items,
  values,
  onRatingChange,
  canEdit,
  bgColor = 'purple'
}: SkillsSectionProps) {
  return (
    <div className="space-y-3">
      {items.map(({ key, label }) => (
        <SkillRatingItem
          key={key}
          label={label}
          value={values[key] || 0}
          onRatingChange={(rating) => onRatingChange(key, rating)}
          canEdit={canEdit}
          skillKey={key}
        />
      ))}

      <div className={`mt-4 p-3 bg-${bgColor}-50 dark:bg-${bgColor}-900/20 rounded-md`}>
        <p className="text-xs text-foreground font-semibold mb-1">Rating Scale:</p>
        <p className="text-xs text-muted-foreground">{RATING_SCALE_TEXT}</p>
      </div>
    </div>
  );
}
