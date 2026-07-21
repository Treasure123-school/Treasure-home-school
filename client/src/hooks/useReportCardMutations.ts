/**
 * All report-card mutations in one hook.
 * Accepts the minimal set of shared state needed for optimistic updates.
 */
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Deps {
  selectedClass: string;
  selectedTerm: string;
  getSelectedReportCard: () => any;
  setSelectedReportCard: (updater: any) => void;
  refetchReportCards: () => void;
  refetchFullReport: () => void;
}

export function useReportCardMutations({
  selectedClass, selectedTerm, getSelectedReportCard, setSelectedReportCard,
  refetchReportCards, refetchFullReport,
}: Deps) {
  const { toast } = useToast();

  // ── Bulk status update (finalize all / publish all) ─────────────────────
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ reportCardIds, status }: { reportCardIds: number[]; status: string }) => {
      return Promise.all(reportCardIds.map(async id => {
        const res = await apiRequest('PATCH', `/api/reports/${id}/status`, { status });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || `Failed to update ${id}`); }
        return res.json();
      }));
    },
    onSuccess: (_, { status }) => {
      toast({ title: 'Success', description: `Report cards ${status === 'published' ? 'published' : status === 'finalized' ? 'finalized' : 'reverted to draft'} successfully` });
      refetchReportCards();
    },
    onError: (err: any) => { toast({ title: 'Error', description: err.message || 'Failed to update report cards', variant: 'destructive' }); },
  });

  // ── Single status update with optimistic UI ──────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ reportCardId, status }: { reportCardId: number; status: string; classId: string; termId: string }) => {
      const res = await apiRequest('PATCH', `/api/reports/${reportCardId}/status`, { status });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to update status'); }
      return res.json();
    },
    onMutate: async ({ reportCardId, status, classId, termId }) => {
      queryClient.cancelQueries({ queryKey: ['/api/reports', reportCardId, 'full'] });
      queryClient.cancelQueries({ queryKey: ['/api/reports/class-term', classId, termId] });
      const previousFullReport   = queryClient.getQueryData(['/api/reports', reportCardId, 'full']);
      const previousReportCards  = queryClient.getQueryData(['/api/reports/class-term', classId, termId]);
      const previousSelected     = getSelectedReportCard();
      const locked = status !== 'draft';
      queryClient.setQueryData(['/api/reports', reportCardId, 'full'], (old: any) => old ? { ...old, status, locked } : old);
      queryClient.setQueryData(['/api/reports/class-term', classId, termId], (old: any) =>
        Array.isArray(old) ? old.map((rc: any) => rc.id === reportCardId ? { ...rc, status, locked } : rc) : old);
      setSelectedReportCard((prev: any) => prev?.id === reportCardId ? { ...prev, status, locked } : prev);
      const label = status === 'published' ? 'Published' : status === 'finalized' ? 'Finalized' : 'Reverted to Draft';
      toast({ title: 'Success', description: `Report card ${label.toLowerCase()} successfully` });
      return { previousFullReport, previousReportCards, previousSelected, classId, termId };
    },
    onSuccess: (data, { reportCardId, classId, termId }) => {
      const rc = data?.reportCard;
      if (rc) {
        queryClient.setQueryData(['/api/reports', reportCardId, 'full'], (old: any) => old ? { ...old, ...rc } : { ...rc });
        queryClient.setQueryData(['/api/reports/class-term', classId, termId], (old: any) =>
          Array.isArray(old) ? old.map((r: any) => r.id === reportCardId ? { ...r, ...rc } : r) : old);
        setSelectedReportCard((prev: any) => prev?.id === reportCardId ? { ...prev, ...rc } : prev);
      }
    },
    onError: (err: any, { reportCardId }, ctx: any) => {
      if (ctx?.previousFullReport) queryClient.setQueryData(['/api/reports', reportCardId, 'full'], ctx.previousFullReport);
      if (ctx?.previousReportCards && ctx?.classId && ctx?.termId)
        queryClient.setQueryData(['/api/reports/class-term', ctx.classId, ctx.termId], ctx.previousReportCards);
      if (ctx?.previousSelected) setSelectedReportCard(ctx.previousSelected);
      toast({ title: 'Error', description: err.message || 'Failed to update status', variant: 'destructive' });
    },
  });

  // ── Remarks ──────────────────────────────────────────────────────────────
  const updateRemarksMutation = useMutation({
    mutationFn: async (data: { reportCardId: number; teacherRemarks?: string; principalRemarks?: string }) => {
      const res = await apiRequest('PATCH', `/api/reports/${data.reportCardId}/remarks`, data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to update remarks'); }
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Remarks updated successfully' }); refetchFullReport(); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message || 'Failed to update remarks', variant: 'destructive' }); },
  });

  // ── Skills with optimistic update ─────────────────────────────────────────
  const saveSkillsMutation = useMutation({
    mutationFn: async ({ reportCardId, skills }: { reportCardId: number; skills: any }) => {
      const res = await apiRequest('POST', `/api/reports/${reportCardId}/skills`, skills);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to save skills'); }
      return res.json();
    },
    onMutate: async ({ reportCardId, skills }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/reports', reportCardId, 'full'] });
      const prev = queryClient.getQueryData<any>(['/api/reports', reportCardId, 'full']);
      const merge = (k: string, ex: number) => skills[k] !== undefined ? skills[k] : (ex ?? 0);
      queryClient.setQueryData(['/api/reports', reportCardId, 'full'], (old: any) => {
        if (!old) return old;
        const a = old.affectiveTraits || {}; const p = old.psychomotorSkills || {};
        return { ...old,
          affectiveTraits: { punctuality: merge('punctuality', a.punctuality), neatness: merge('neatness', a.neatness), attentiveness: merge('attentiveness', a.attentiveness), teamwork: merge('teamwork', a.teamwork), leadership: merge('leadership', a.leadership), assignments: merge('assignments', a.assignments), classParticipation: merge('classParticipation', a.classParticipation), honesty: merge('honesty', a.honesty ?? 0), politeness: merge('politeness', a.politeness ?? 0), selfControl: merge('selfControl', a.selfControl ?? 0), obedience: merge('obedience', a.obedience ?? 0), reliability: merge('reliability', a.reliability ?? 0), senseOfResponsibility: merge('senseOfResponsibility', a.senseOfResponsibility ?? 0), relationshipWithOthers: merge('relationshipWithOthers', a.relationshipWithOthers ?? 0) },
          psychomotorSkills: { sports: merge('sports', p.sports), handwriting: merge('handwriting', p.handwriting), musicalSkills: merge('musicalSkills', p.musicalSkills), creativity: merge('creativity', p.creativity), handlingOfTools: merge('handlingOfTools', p.handlingOfTools ?? 0), drawingPainting: merge('drawingPainting', p.drawingPainting ?? 0), publicSpeaking: merge('publicSpeaking', p.publicSpeaking ?? 0), speechFluency: merge('speechFluency', p.speechFluency ?? 0) },
        };
      });
      toast({ title: 'Saved', description: 'Skills updated' });
      return { previousFullReport: prev, reportCardId };
    },
    onSuccess: () => { /* optimistic update already applied */ },
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.previousFullReport && ctx?.reportCardId)
        queryClient.setQueryData(['/api/reports', ctx.reportCardId, 'full'], ctx.previousFullReport);
      toast({ title: 'Error', description: err.message || 'Failed to save skills', variant: 'destructive' });
    },
  });

  // ── Auto-populate (pull raw scores from exam records) ───────────────────
  // NOTE: Only use this intentionally (e.g. admin "sync from exams" action).
  // Do NOT use it for the teacher refresh icon — it can overwrite stored scores
  // with 0 when no matching exam record exists for a subject.
  const autoPopulateMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const res = await apiRequest('POST', `/api/reports/${reportCardId}/auto-populate`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to auto-populate scores'); }
      return res.json();
    },
    onSuccess: (data) => { toast({ title: 'Success', description: data.message || 'Scores populated successfully' }); refetchFullReport(); refetchReportCards(); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message || 'Failed to auto-populate scores', variant: 'destructive' }); },
  });

  // ── Individual recalculate (re-apply weights to stored scores) ───────────
  // This is the SAFE recalculate: it reads the existing testScore/examScore,
  // re-applies the current test/exam weight percentages, recalculates totals
  // and the overall grade, and re-ranks the class. It never zeroes raw scores.
  const recalculateMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const res = await apiRequest('POST', `/api/reports/${reportCardId}/recalculate`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to recalculate scores'); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Recalculated', description: 'Weighted scores, grade and class position updated' });
      refetchFullReport();
      refetchReportCards();
    },
    onError: (err: any) => { toast({ title: 'Recalculation failed', description: err.message || 'Failed to recalculate', variant: 'destructive' }); },
  });

  // ── Bulk recalculate ─────────────────────────────────────────────────────
  const bulkRecalculateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, number> = {};
      if (selectedClass) body.classId = Number(selectedClass);
      if (selectedTerm)  body.termId  = Number(selectedTerm);
      const res = await apiRequest('POST', '/api/admin/recalculate-all-report-cards', body);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Bulk recalculation failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Recalculation complete', description: data.message || 'All report cards recalculated' });
      refetchReportCards();
      const sel = getSelectedReportCard();
      if (sel) refetchFullReport();
    },
    onError: (err: any) => { toast({ title: 'Recalculation failed', description: err.message || 'Failed to recalculate', variant: 'destructive' }); },
  });

  return { bulkStatusMutation, updateStatusMutation, updateRemarksMutation, saveSkillsMutation, autoPopulateMutation, recalculateMutation, bulkRecalculateMutation };
}
