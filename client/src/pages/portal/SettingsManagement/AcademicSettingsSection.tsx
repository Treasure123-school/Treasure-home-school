import { useState, useEffect } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Settings, BarChart3, FileBarChart2, Save, Loader2, Edit, Info, Percent, X,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, SwitchRow, SectionSkeleton } from './components';
// SECTION: Academic Settings
// ─────────────────────────────────────────────
export default function AcademicSettingsSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [testWeight, setTestWeight] = useState(40);
  const [scoreAggregation, setScoreAggregation] = useState('last');
  const [autoCreateReportCard, setAutoCreateReportCard] = useState(true);
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(true);
  const [allowTeacherOverrides, setAllowTeacherOverrides] = useState(true);
  const [original, setOriginal] = useState({ testWeight: 40, scoreAggregation: 'last', autoCreateReportCard: true, showGradeBreakdown: true, allowTeacherOverrides: true });

  useEffect(() => {
    if (settings) {
      const vals = {
        testWeight: settings.testWeight ?? 40,
        scoreAggregation: settings.scoreAggregationMode || 'last',
        autoCreateReportCard: settings.autoCreateReportCard ?? true,
        showGradeBreakdown: settings.showGradeBreakdown ?? true,
        allowTeacherOverrides: settings.allowTeacherOverrides ?? true,
      };
      setTestWeight(vals.testWeight);
      setScoreAggregation(vals.scoreAggregation);
      setAutoCreateReportCard(vals.autoCreateReportCard);
      setShowGradeBreakdown(vals.showGradeBreakdown);
      setAllowTeacherOverrides(vals.allowTeacherOverrides);
      setOriginal(vals);
    }
  }, [settings]);

  const handleSave = async () => {
    await save.mutateAsync({
      testWeight,
      examWeight: 100 - testWeight,
      scoreAggregationMode: scoreAggregation,
      autoCreateReportCard,
      showGradeBreakdown,
      allowTeacherOverrides,
    });
    setOriginal({ testWeight, scoreAggregation, autoCreateReportCard, showGradeBreakdown, allowTeacherOverrides });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTestWeight(original.testWeight);
    setScoreAggregation(original.scoreAggregation);
    setAutoCreateReportCard(original.autoCreateReportCard);
    setShowGradeBreakdown(original.showGradeBreakdown);
    setAllowTeacherOverrides(original.allowTeacherOverrides);
    setIsEditing(false);
  };

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      {/* Action bar — top only, no duplicate at bottom */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isEditing ? 'Make your changes below, then save.' : 'Click Edit to update academic settings.'}
        </p>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={save.isPending} data-testid="button-cancel-academic">
                <X className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={save.isPending} data-testid="button-save-academic">
                {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin sm:mr-1.5" /> : <Save className="w-3.5 h-3.5 sm:mr-1.5" />}
                <span className="hidden sm:inline">Save Changes</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-academic">
              <Edit className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
        </div>
      </div>

      <SettingCard title="Assessment Weights" description="How CA (test) and examination scores are weighted for the final grade" icon={Percent}>
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-primary dark:text-primary/70">CA / Test: {testWeight}%</span>
            <span className="text-purple-600 dark:text-purple-400">Exam: {100 - testWeight}%</span>
          </div>
          <Slider
            value={[testWeight]}
            onValueChange={v => isEditing && setTestWeight(v[0])}
            min={0} max={100} step={5}
            disabled={!isEditing}
            data-testid="slider-test-weight"
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 dark:bg-primary/5 border border-primary/30 dark:border-primary/30">
              <div className="w-2.5 h-2.5 rounded-full bg-primary/85" />
              <span>CA Score carries <strong>{testWeight}%</strong> of total</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Exam Score carries <strong>{100 - testWeight}%</strong> of total</span>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Score Aggregation" description="When a student has multiple CA scores for the same subject, which score is used?" icon={BarChart3}>
        <div className="space-y-3">
          <Select value={scoreAggregation} onValueChange={setScoreAggregation} disabled={!isEditing}>
            <SelectTrigger data-testid="select-score-aggregation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Most Recent Score (Last submitted)</SelectItem>
              <SelectItem value="highest">Highest Score</SelectItem>
              <SelectItem value="average">Average of All Scores</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {scoreAggregation === 'last' && 'Only the most recently entered CA score is used for grading.'}
              {scoreAggregation === 'highest' && 'The highest CA score from all entries is used — benefits the student.'}
              {scoreAggregation === 'average' && 'All CA scores are averaged together for a balanced result.'}
            </span>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Report Card Behaviour" description="Control how report cards are created and displayed" icon={FileBarChart2}>
        <div className="space-y-1">
          <SwitchRow id="autoCreateReportCard" label="Auto-create Report Cards" description="Automatically generate a report card for each student when a term starts" checked={autoCreateReportCard} onCheckedChange={v => isEditing && setAutoCreateReportCard(v)} />
          <SwitchRow id="showGradeBreakdown" label="Show Grade Breakdown" description="Display CA and exam scores separately on the report card" checked={showGradeBreakdown} onCheckedChange={v => isEditing && setShowGradeBreakdown(v)} />
          <SwitchRow id="allowTeacherOverrides" label="Allow Teacher Score Overrides" description="Teachers can manually override auto-calculated scores on report cards" checked={allowTeacherOverrides} onCheckedChange={v => isEditing && setAllowTeacherOverrides(v)} />
        </div>
      </SettingCard>
    </div>
  );
}
