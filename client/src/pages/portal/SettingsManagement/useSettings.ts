import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Settings, Save,
} from 'lucide-react';
import { SystemSettings } from './types';
// ─────────────────────────────────────────────
// Shared save hook
// ─────────────────────────────────────────────
export function useAdminSettings() {
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/admin/settings'],
    staleTime: 30_000,
  });

  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => apiRequest('PUT', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/settings'] });
      toast({ title: 'Success', description: 'Settings updated successfully.' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return { settings, isLoading, save: mutation };
}
