import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { GradeScale, GradingBoundary } from '../types';
import { useScaleMutations } from './useScaleMutations';
import { useBoundaryMutations } from './useBoundaryMutations';
import { useAdminSettings } from '../useSettings';

const EMPTY_SCALE_FORM = { name: '', description: '', copyFromId: '' };

/** All state + actions for the Grading Scale settings section. */
export function useGradingScaleManager() {
  const { settings, isLoading: settingsLoading, save } = useAdminSettings();
  const { toast } = useToast();
  const [positioningMethod, setPositioningMethod] = useState('average');
  const [expandedScaleId, setExpandedScaleId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<GradeScale | null>(null);
  const [scaleForm, setScaleForm] = useState(EMPTY_SCALE_FORM);
  const [boundaryDialogOpen, setBoundaryDialogOpen] = useState(false);
  const [boundaryScaleId, setBoundaryScaleId] = useState<number | null>(null);
  const [editingBoundary, setEditingBoundary] = useState<GradingBoundary | null>(null);
  const [boundaryForm, setBoundaryForm] = useState({ grade: '', minScore: 0, maxScore: 100, remark: '', gradePoint: '' });
  const [deleteScaleId, setDeleteScaleId] = useState<number | null>(null);
  const [deleteBoundaryId, setDeleteBoundaryId] = useState<{ scaleId: number; boundaryId: number } | null>(null);
  const [previewScore, setPreviewScore] = useState('');

  useEffect(() => {
    if (settings) setPositioningMethod(settings.positioningMethod || 'average');
  }, [settings]);

  const { data: scales = [], isLoading: scalesLoading } = useQuery<GradeScale[]>({
    queryKey: ['/api/grade-scales'],
  });

  const resetScaleForm = () => setScaleForm(EMPTY_SCALE_FORM);

  const { activateMutation, duplicateMutation, deleteScaleMutation, createScaleMutation, updateScaleMutation } =
    useScaleMutations({ setCreateOpen, resetScaleForm, setExpandedScaleId, setDeleteScaleId });

  const { addBoundaryMutation, updateBoundaryMutation, deleteBoundaryMutation, resetBoundaryForm } =
    useBoundaryMutations({ setBoundaryDialogOpen, setBoundaryForm, setEditingBoundary, setBoundaryScaleId, setDeleteBoundaryId });

  // Compute overlap warning for the boundary dialog
  const overlapWarning = (() => {
    if (!boundaryDialogOpen || !boundaryScaleId) return null;
    const scale = scales.find(s => s.id === boundaryScaleId);
    if (!scale) return null;
    const { minScore, maxScore } = boundaryForm;
    if (minScore > maxScore) return null;
    const overlapping = (scale.boundaries ?? []).find(b =>
      b.id !== editingBoundary?.id && minScore <= b.maxScore && maxScore >= b.minScore
    );
    if (!overlapping) return null;
    return `Overlaps grade "${overlapping.grade}" (${overlapping.minScore}–${overlapping.maxScore}%)`;
  })();

  const activeScale = scales.find(s => s.isActive);

  const previewResult = (() => {
    const score = parseInt(previewScore);
    if (isNaN(score) || !activeScale?.boundaries?.length) return null;
    const clamped = Math.max(0, Math.min(100, score));
    const sorted = [...activeScale.boundaries].sort((a, b) => b.minScore - a.minScore);
    return sorted.find(b => clamped >= b.minScore && clamped <= b.maxScore) ?? sorted[sorted.length - 1] ?? null;
  })();

  const openAddBoundary = (scaleId: number) => { resetBoundaryForm(); setBoundaryScaleId(scaleId); setBoundaryDialogOpen(true); };
  const openEditBoundary = (scaleId: number, b: GradingBoundary) => {
    setBoundaryForm({ grade: b.grade, minScore: b.minScore, maxScore: b.maxScore, remark: b.remark || '', gradePoint: b.gradePoint != null ? String(b.gradePoint) : '' });
    setEditingBoundary(b); setBoundaryScaleId(scaleId); setBoundaryDialogOpen(true);
  };

  const handleSaveBoundary = () => {
    if (!boundaryForm.grade.trim()) { toast({ title: 'Grade is required', variant: 'destructive' }); return; }
    if (boundaryForm.minScore > boundaryForm.maxScore) { toast({ title: 'Min score cannot exceed max score', variant: 'destructive' }); return; }
    const payload = {
      grade: boundaryForm.grade.trim(),
      minScore: boundaryForm.minScore,
      maxScore: boundaryForm.maxScore,
      remark: boundaryForm.remark || undefined,
      gradePoint: boundaryForm.gradePoint !== '' ? parseFloat(boundaryForm.gradePoint) : undefined,
    };
    if (editingBoundary && boundaryScaleId) {
      updateBoundaryMutation.mutate({ scaleId: boundaryScaleId, boundaryId: editingBoundary.id, data: payload });
    } else if (boundaryScaleId) {
      addBoundaryMutation.mutate({ scaleId: boundaryScaleId, data: payload });
    }
  };

  const openCreateScale = () => { resetScaleForm(); setCreateOpen(true); };

  return {
    // settings
    settings, settingsLoading, save, positioningMethod, setPositioningMethod, toast,
    // scales
    scales, scalesLoading, activeScale, expandedScaleId, setExpandedScaleId,
    createOpen, setCreateOpen, openCreateScale, scaleForm, setScaleForm,
    editingScale, setEditingScale, deleteScaleId, setDeleteScaleId,
    activateMutation, duplicateMutation, deleteScaleMutation, createScaleMutation, updateScaleMutation,
    // boundaries
    boundaryDialogOpen, setBoundaryDialogOpen, boundaryScaleId,
    editingBoundary, boundaryForm, setBoundaryForm, deleteBoundaryId, setDeleteBoundaryId,
    addBoundaryMutation, updateBoundaryMutation, deleteBoundaryMutation,
    resetBoundaryForm, openAddBoundary, openEditBoundary, handleSaveBoundary, overlapWarning,
    // preview
    previewScore, setPreviewScore, previewResult,
  };
}

export type GradingScaleManager = ReturnType<typeof useGradingScaleManager>;
