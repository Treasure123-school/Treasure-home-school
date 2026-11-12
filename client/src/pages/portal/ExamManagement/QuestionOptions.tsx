import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { QuestionOption } from '@shared/schema';

// Component to display question options
export function QuestionOptions({ questionId }: { questionId: number }) {
  const { data: options = [], isLoading } = useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options', questionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/question-options/${questionId}`);
      if (!response.ok) throw new Error('Failed to fetch question options');
      return response.json();
    },
    enabled: !!questionId,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading options...</div>;
  }
  if (options.length === 0) {
    return <div className="text-sm text-muted-foreground">No options added yet</div>;
  }
  return (
    <div className="space-y-1">
      {options.map((option: any, index: number) => (
        <div key={option.id} className="flex items-center space-x-2">
          <span className="text-sm font-mono text-muted-foreground min-w-[20px]">
            {String.fromCharCode(65 + index)}.
          </span>
          <span className="text-sm">{option.optionText}</span>
          {option.isCorrect && (
            <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
