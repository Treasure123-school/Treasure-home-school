import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

/**
 * Optimistic Mutation Utilities
 * These utilities provide instant UI feedback for all mutations across the app
 */

export interface OptimisticContext {
  previousData: any;
  queryKey: string[];
}
/**
 * Creates an optimistic update for a single item modification (update, toggle, etc.)
 * Used for actions like verify, publish, activate, approve
 */
export async function optimisticUpdate<T = any>(
  queryKey: string[],
  id: string | number,
  updates: Partial<T>,
  loadingMessage?: string
): Promise<OptimisticContext> {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey });
  
  // Snapshot previous value
  const previousData = queryClient.getQueryData(queryKey);
  
  // Optimistically update the item
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((item: any) =>
        item.id === id ? { ...item, ...updates } : item
      );
    }
    // Single object
    return old.id === id ? { ...old, ...updates } : old;
  });
  
  // Show loading toast
  if (loadingMessage) {
    toast({
      title: loadingMessage,
      description: "Processing...",
    });
  }
  return { previousData, queryKey };
}
/**
 * Creates an optimistic deletion
 * Used for delete actions
 */
export async function optimisticDelete(
  queryKey: string[],
  id: string | number,
  loadingMessage?: string
): Promise<OptimisticContext> {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey });
  
  // Snapshot previous value
  const previousData = queryClient.getQueryData(queryKey);
  
  // Optimistically remove the item
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.filter((item: any) => item.id !== id);
    }
    return null; // Single object deleted
  });
  
  // Show loading toast
  if (loadingMessage) {
    toast({
      title: loadingMessage,
      description: "Processing...",
    });
  }
  return { previousData, queryKey };
}
/**
 * Creates an optimistic creation
 * Used for create/add actions
 */
export async function optimisticCreate<T = any>(
  queryKey: string[],
  newItem: T,
  loadingMessage?: string
): Promise<OptimisticContext> {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey });
  
  // Snapshot previous value
  const previousData = queryClient.getQueryData(queryKey);
  
  // Optimistically add the new item
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old) return [newItem];
    if (Array.isArray(old)) {
      return [...old, newItem];
    }
    return newItem; // Replace single object
  });
  
  // Show loading toast
  if (loadingMessage) {
    toast({
      title: loadingMessage,
      description: "Processing...",
    });
  }
  return { previousData, queryKey };
}
/**
 * Handles successful mutation
 * Shows success toast and invalidates queries
 */
export function handleMutationSuccess(
  successMessage: string,
  queryKeys: string[][],
  description?: string
) {
  toast({
    title: successMessage,
    description: description || "Changes saved successfully",
  });
  
  // Invalidate all related query keys
  queryKeys.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });
}
/**
 * Handles mutation error with rollback
 * Restores previous data and shows error toast
 */
export function handleMutationError(
  context: OptimisticContext | undefined,
  error: Error | any,
  errorMessage?: string
) {
  // Rollback optimistic update
  if (context?.previousData) {
    queryClient.setQueryData(context.queryKey, context.previousData);
  }
  // Show error toast
  toast({
    title: errorMessage || "Error",
    description: error?.message || "An error occurred. Please try again.",
    variant: "destructive",
  });
}
/**
 * Generic optimistic mutation hook factory
 * Creates a consistent mutation pattern for any operation
 */
export function createOptimisticMutationHandlers<TData = any, TVariables = any>(
  config: {
    queryKey: string[];
    relatedQueryKeys?: string[][];
    onMutateType: 'create' | 'update' | 'delete';
    getItemId?: (variables: TVariables) => string | number;
    getUpdates?: (variables: TVariables) => Partial<TData>;
    getNewItem?: (variables: TVariables) => TData;
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  }
) {
  return {
    onMutate: async (variables: TVariables) => {
      const { queryKey, onMutateType, getItemId, getUpdates, getNewItem, loadingMessage } = config;
      
      if (onMutateType === 'delete' && getItemId) {
        return await optimisticDelete(queryKey, getItemId(variables), loadingMessage);
      }
      if (onMutateType === 'update' && getItemId && getUpdates) {
        return await optimisticUpdate(queryKey, getItemId(variables), getUpdates(variables), loadingMessage);
      }
      if (onMutateType === 'create' && getNewItem) {
        return await optimisticCreate(queryKey, getNewItem(variables), loadingMessage);
      }
      return { previousData: null, queryKey };
    },
    
    onSuccess: (_data: any, _variables: TVariables) => {
      const allQueryKeys = [config.queryKey, ...(config.relatedQueryKeys || [])];
      handleMutationSuccess(
        config.successMessage || "Success",
        allQueryKeys
      );
    },
    
    onError: (error: Error, _variables: TVariables, context: any) => {
      handleMutationError(context, error, config.errorMessage);
    },
  };
}
