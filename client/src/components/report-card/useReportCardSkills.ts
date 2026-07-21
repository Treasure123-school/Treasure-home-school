/**
 * Manages skills (affective/psychomotor) local state with debounced auto-save.
 * Handles new-student detection, baseline snapshot, and diff-based payloads.
 */
import { useState, useRef, useEffect } from 'react';
import type { ReportCardData } from './types';

export type SkillsState = Record<string, number>;

function buildSkillsFromCard(rc: ReportCardData): SkillsState {
  return {
    punctuality: rc.affectiveTraits?.punctuality || 0,
    neatness: rc.affectiveTraits?.neatness || 0,
    attentiveness: rc.affectiveTraits?.attentiveness || 0,
    teamwork: rc.affectiveTraits?.teamwork || 0,
    leadership: rc.affectiveTraits?.leadership || 0,
    assignments: rc.affectiveTraits?.assignments || 0,
    classParticipation: rc.affectiveTraits?.classParticipation || 0,
    honesty: rc.affectiveTraits?.honesty || 0,
    politeness: rc.affectiveTraits?.politeness || 0,
    selfControl: rc.affectiveTraits?.selfControl || 0,
    obedience: rc.affectiveTraits?.obedience || 0,
    reliability: rc.affectiveTraits?.reliability || 0,
    senseOfResponsibility: rc.affectiveTraits?.senseOfResponsibility || 0,
    relationshipWithOthers: rc.affectiveTraits?.relationshipWithOthers || 0,
    sports: rc.psychomotorSkills?.sports || 0,
    handwriting: rc.psychomotorSkills?.handwriting || 0,
    musicalSkills: rc.psychomotorSkills?.musicalSkills || 0,
    creativity: rc.psychomotorSkills?.creativity || 0,
    handlingOfTools: rc.psychomotorSkills?.handlingOfTools || 0,
    drawingPainting: rc.psychomotorSkills?.drawingPainting || 0,
    publicSpeaking: rc.psychomotorSkills?.publicSpeaking || 0,
    speechFluency: rc.psychomotorSkills?.speechFluency || 0,
  };
}

export function useReportCardSkills(
  reportCard: ReportCardData,
  isFullReportReady: boolean,
  onSaveSkills?: (skills: any) => Promise<void>,
) {
  const [localSkills, setLocalSkills] = useState<SkillsState>(() => buildSkillsFromCard(reportCard));
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [isSavingSkills, setIsSavingSkills] = useState(false);

  const initialSkillsRef = useRef<SkillsState | null>(null);
  const isSavingRef = useRef(false);
  const pendingSkillsRef = useRef<SkillsState>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdRef = useRef<number>(reportCard.id);

  // Sync local state when the report card changes or full data loads
  useEffect(() => {
    const isNewCard = reportCard.id !== currentIdRef.current;
    if (isNewCard) {
      currentIdRef.current = reportCard.id;
      initialSkillsRef.current = null;
      setSkillsLoaded(false);
    }
    if (isSavingRef.current && !isNewCard) return;
    const loaded = buildSkillsFromCard(reportCard);
    setLocalSkills(loaded);
    if (isFullReportReady) {
      initialSkillsRef.current = { ...loaded };
      setSkillsLoaded(true);
    }
  }, [reportCard.id, reportCard.affectiveTraits, reportCard.psychomotorSkills, isFullReportReady]);

  const handleSkillChange = (key: string, value: number) => {
    setLocalSkills(prev => ({ ...prev, [key]: value }));
    if (!onSaveSkills || !initialSkillsRef.current || !skillsLoaded) return;
    pendingSkillsRef.current[key] = value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const changed: SkillsState = {};
      Object.entries(pendingSkillsRef.current).forEach(([k, v]) => {
        if (v !== (initialSkillsRef.current![k] ?? 0)) changed[k] = v;
      });
      pendingSkillsRef.current = {};
      if (Object.keys(changed).length === 0) return;
      isSavingRef.current = true;
      setIsSavingSkills(true);
      onSaveSkills(changed)
        .then(() => { if (initialSkillsRef.current) Object.assign(initialSkillsRef.current, changed); })
        .catch(() => {
          setLocalSkills(prev => {
            const reverted = { ...prev };
            Object.keys(changed).forEach(k => { reverted[k] = initialSkillsRef.current![k] ?? 0; });
            return reverted;
          });
        })
        .finally(() => { setTimeout(() => { isSavingRef.current = false; }, 300); setIsSavingSkills(false); });
    }, 350);
  };

  return { localSkills, isSavingSkills, handleSkillChange };
}
