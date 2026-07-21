/** Sections 5 & 6 — cognitive/affective skills and psychomotor skills. */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { SkillsSection } from '@/components/ui/skill-rating';
import type { AffectiveTraits, PsychomotorSkills } from './types';
import type { SkillsState } from './useReportCardSkills';

const AFFECTIVE_LABELS: { key: keyof AffectiveTraits; label: string }[] = [
  { key: 'punctuality', label: 'Punctuality' }, { key: 'neatness', label: 'Neatness' },
  { key: 'attentiveness', label: 'Attentiveness' }, { key: 'teamwork', label: 'Teamwork' },
  { key: 'leadership', label: 'Leadership' }, { key: 'assignments', label: 'Assignments/Homework' },
  { key: 'classParticipation', label: 'Class Participation' }, { key: 'honesty', label: 'Honesty' },
  { key: 'politeness', label: 'Politeness' }, { key: 'selfControl', label: 'Self Control' },
  { key: 'obedience', label: 'Obedience' }, { key: 'reliability', label: 'Reliability' },
  { key: 'senseOfResponsibility', label: 'Sense of Responsibility' },
  { key: 'relationshipWithOthers', label: 'Relationship with Others' },
];

const PSYCHOMOTOR_LABELS: { key: keyof PsychomotorSkills; label: string }[] = [
  { key: 'sports', label: 'Sports' }, { key: 'handwriting', label: 'Handwriting' },
  { key: 'musicalSkills', label: 'Musical Skills' }, { key: 'creativity', label: 'Creativity / Craft' },
  { key: 'handlingOfTools', label: 'Handling of Tools' }, { key: 'drawingPainting', label: 'Drawing & Painting' },
  { key: 'publicSpeaking', label: 'Public Speaking' }, { key: 'speechFluency', label: 'Speech Fluency' },
];

interface Props {
  affectiveTraits: AffectiveTraits;
  psychomotorSkills: PsychomotorSkills;
  localSkills: SkillsState;
  canEditSkills: boolean;
  onSkillChange: (key: string, value: number) => void;
}

function CollapsibleSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <Card className="print:shadow-none print:border-2">
        <CollapsibleTrigger asChild className="print:hidden">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">{icon}{title}</CardTitle>
              <div className="flex items-center gap-2 sm:hidden">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CardHeader className="hidden print:block pb-2 pt-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
        </CardHeader>
        <CollapsibleContent className="print:!block">
          <CardContent className="p-3 sm:p-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ReportCardSkillsSections({ affectiveTraits, psychomotorSkills, localSkills, canEditSkills, onSkillChange }: Props) {
  return (
    <>
      <CollapsibleSection title="Cognitive & Affective Skills" icon={<Brain className="w-4 h-4" />}>
        <SkillsSection
          title="Affective Skills"
          icon={<Brain className="w-4 h-4" />}
          items={AFFECTIVE_LABELS}
          values={canEditSkills ? localSkills : (affectiveTraits as unknown as Record<string, number>)}
          onRatingChange={onSkillChange}
          canEdit={canEditSkills}
          bgColor="blue"
        />
      </CollapsibleSection>
      <CollapsibleSection title="Psychomotor Skills" icon={<Activity className="w-4 h-4" />}>
        <SkillsSection
          title="Psychomotor Skills"
          icon={<Activity className="w-4 h-4" />}
          items={PSYCHOMOTOR_LABELS}
          values={canEditSkills ? localSkills : (psychomotorSkills as unknown as Record<string, number>)}
          onRatingChange={onSkillChange}
          canEdit={canEditSkills}
          bgColor="purple"
        />
      </CollapsibleSection>
    </>
  );
}
