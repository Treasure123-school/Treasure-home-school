import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { patch, snap, scalesCacheKey } from './scales-cache';

interface ScaleMutationUi {
  setCreateOpen: (v: boolean) => void;
  resetScaleForm: () => void;
  setExpandedScaleId: (id: number) => void;
  setDeleteScaleId: (id: number | null) => void;
}

/** Mutations for managing whole grade scales (activate/duplicate/create/update/delete). */
export function useScaleMutations({ setCreateOpen, resetScaleForm, setExpandedScaleId, setDeleteScaleId }: ScaleMutationUi) {
  const { toast } = useToast();

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/grade-scales/${id}/activate`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      patch(old => old.map(s => ({ ...s, isActive: s.id === id })));
      return { prev };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed to activate', description: e.message, variant: 'destructive' });
    },
    // Optimistic update is authoritative — just mark stale silently, no immediate refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Success', description: 'Grade scale activated' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/grade-scales/${id}/duplicate`).then(r => r.json()),
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: scalesCacheKey }); },
    onSuccess: (s: any) => {
      // Append the new duplicate directly — no refetch needed
      patch(old => [...old, { ...s, boundaries: s.boundaries ?? [] }]);
      setExpandedScaleId(s.id);
      toast({ title: 'Success', description: 'Grading scale duplicated.' });
    },
    onError: (e: any) => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    },
  });

  const deleteScaleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/grade-scales/${id}`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      patch(old => old.filter(s => s.id !== id));
      setDeleteScaleId(null);
      return { prev };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    },
    // Optimistic removal is authoritative — just mark stale, no refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Success', description: 'Grading scale deleted.' });
    },
  });

  const createScaleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/grade-scales', data).then(r => r.json()),
    onMutate: async () => { setCreateOpen(false); resetScaleForm(); },
    onSuccess: (s: any) => {
      // Add directly from server response — no refetch needed
      patch(old => [...old, { ...s, boundaries: s.boundaries ?? [] }]);
      setExpandedScaleId(s.id);
      toast({ title: 'Success', description: 'Grading scale created.' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateScaleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/grade-scales/${id}`, data),
    onMutate: async ({ id, data }: { id: number; data: any }) => {
      await queryClient.cancelQueries({ queryKey: scalesCacheKey });
      const prev = snap();
      patch(old => old.map(s => s.id === id ? { ...s, name: data.name, description: data.description ?? s.description } : s));
      return { prev };
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(scalesCacheKey, ctx.prev);
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    },
    // Optimistic update is authoritative — just mark stale, no refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scalesCacheKey, refetchType: 'none' });
      toast({ title: 'Success', description: 'Grading scale updated.' });
    },
  });

  return { activateMutation, duplicateMutation, deleteScaleMutation, createScaleMutation, updateScaleMutation };
}
