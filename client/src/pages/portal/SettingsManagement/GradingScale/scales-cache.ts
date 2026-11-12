import { queryClient } from '@/lib/queryClient';
import type { GradeScale } from '../types';

export const scalesCacheKey = ['/api/grade-scales'];

/** Read the current cached scale list. */
export const snap = () => queryClient.getQueryData<GradeScale[]>(scalesCacheKey);

/** Patch the cached scale list. */
export const patch = (fn: (old: GradeScale[]) => GradeScale[]) =>
  queryClient.setQueryData<GradeScale[]>(scalesCacheKey, old => fn(old ?? []));
