import { SectionSkeleton } from '../components';
import { useGradingScaleManager } from './useGradingScaleManager';
import { PositionMethodCard, GradePreviewCard } from './GradePreviewCards';
import { ScalesList } from './ScalesList';
import { ScaleDialogs } from './ScaleDialogs';

export default function GradingScaleSection() {
  const m = useGradingScaleManager();

  if (m.settingsLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <PositionMethodCard m={m} />
      <ScalesList m={m} />
      <GradePreviewCard m={m} />
      <ScaleDialogs m={m} />
    </div>
  );
}
