import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { patch, snap, scalesCacheKey } from './scales-cache';
import type React from 'react';
import type { GradingBoundary } from '../types';

const EMPTY_FORM = { grade: '', minScore: 0, maxScore: 100, remark: '', gradePoint: '' };

export type BoundaryForm = typeof EMPTY_FORM;

interface BoundaryMutationUi {
  setBoundaryDialogOpen: (v: boolean) => void;
  setBoundaryForm: React.Dispatch<React.SetStateAction<BoundaryForm>>;
  setEditingBoundary: React.Dispatch<React.SetStateAction<GradingBoundary | null>>;
  setBoundaryScaleId: (id: number | null) => void;
  setDeleteBoundaryId: (id: { scaleId: number; boundaryId: number } | null) => void;
}

/** Mutations for managing boundaries within a scale (add/update/delete). */
export function useBoundaryMutations({ setBoundaryDialogOpen, setBoundaryForm, setEditingBoundary, setBoundaryScaleId, setDeleteBoundaryId }: BoundaryMutationUi) {
  const { toast } = useToast();

  const resetBoundaryForm = () => {
    setBoundaryForm(EMPTY_FORM);
    setEditingBoundary(null);
    setBoundaryScaleId(null);
  };

  const addBoundaryMutation = useMutation<any, Error, { scaleId: number; data: any }>({
    mutationFn: ({ scaleId, data }) => apiRequest('POST', `/api/grade-scales/${scaleId}/boundaries`, data).then(r => r.json()),
    onMutate: async ({ scaleId, data }) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      const tempId = -Date.now();
      patch(old => old.map(s => s.id !== scaleId ? s : {
        ...s, boundaries: [...(s.boundaries ?? []), { id: tempId, scaleId, name: s.name, isDefault: s.isActive, ...data }]
      }));
      setBoundaryDialogOpen(false); resetBoundaryForm();
      return { prev, scaleId };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    },
    // Replace temp boundary (negative id) with real server boundary
    onSuccess: (b: any, { scaleId }: { scaleId: number }) => {
      patch(old => old.map(s => s.id !== scaleId ? s : {
        ...s, boundaries: (s.boundaries ?? []).map(x => x.id < 0 ? b : x)
      }));
      toast({ title: 'Success', description: 'Grade boundary added.' });
    },
  });

  const updateBoundaryMutation = useMutation({
    mutationFn: ({ scaleId, boundaryId, data }: { scaleId: number; boundaryId: number; data: any }) =>
      apiRequest('PATCH', `/api/grade-scales/${scaleId}/boundaries/${boundaryId}`, data),
    onMutate: async ({ scaleId, boundaryId, data }: { scaleId: number; boundaryId: number; data: any }) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      patch(old => old.map(s => s.id !== scaleId ? s : {
        ...s, boundaries: (s.boundaries ?? []).map(b => b.id !== boundaryId ? b : { ...b, ...data })
      }));
      setBoundaryDialogOpen(false); resetBoundaryForm();
      return { prev };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed to update boundary', description: e.message, variant: 'destructive' });
    },
    // Optimistic update is authoritative — just mark stale, no refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Success', description: 'Grade boundary updated.' });
    },
  });

  const deleteBoundaryMutation = useMutation({
    mutationFn: ({ scaleId, boundaryId }: { scaleId: number; boundaryId: number }) =>
      apiRequest('DELETE', `/api/grade-scales/${scaleId}/boundaries/${boundaryId}`),
    onMutate: async ({ scaleId, boundaryId }: { scaleId: number; boundaryId: number }) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      patch(old => old.map(s => s.id !== scaleId ? s : {
        ...s, boundaries: (s.boundaries ?? []).filter(b => b.id !== boundaryId)
      }));
      setDeleteBoundaryId(null);
      return { prev };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed to delete boundary', description: e.message, variant: 'destructive' });
    },
    // Optimistic removal is authoritative — mark stale silently, no immediate refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Success', description: 'Grade boundary deleted.' });
    },
  });

  return { addBoundaryMutation, updateBoundaryMutation, deleteBoundaryMutation, resetBoundaryForm };
}
