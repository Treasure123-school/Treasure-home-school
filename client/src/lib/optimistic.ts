import { queryClient } from "./queryClient";
import { UseMutationOptions } from "@tanstack/react-query";

type OptimisticContext<T> = {
  previousData: T | undefined;
};

export function createOptimisticMutation<TData, TVariables>(
  queryKey: string[],
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData
): Partial<UseMutationOptions<any, Error, TVariables, OptimisticContext<TData>>> {
  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousData = queryClient.getQueryData<TData>(queryKey);
      
      queryClient.setQueryData<TData>(queryKey, (old) => updateFn(old, variables));
      
      return { previousData };
    },
    
    onError: (_error, _variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

export function optimisticAdd<T extends { id?: number | string }>(
  list: T[] | undefined,
  newItem: T,
  tempId: string = `temp-${Date.now()}`
): T[] {
  const itemWithId = { ...newItem, id: newItem.id || tempId };
  return [...(list || []), itemWithId as T];
}

export function optimisticUpdate<T extends { id: number | string }>(
  list: T[] | undefined,
  id: number | string,
  updates: Partial<T>
): T[] {
  if (!list) return [];
  return list.map(item => 
    item.id === id ? { ...item, ...updates } : item
  );
}

export function optimisticRemove<T extends { id: number | string }>(
  list: T[] | undefined,
  id: number | string
): T[] {
  if (!list) return [];
  return list.filter(item => item.id !== id);
}

export function optimisticToggle<T extends { id: number | string }>(
  list: T[] | undefined,
  id: number | string,
  field: keyof T
): T[] {
  if (!list) return [];
  return list.map(item => 
    item.id === id ? { ...item, [field]: !item[field] } : item
  );
}

export function createOptimisticListMutation<T extends { id: number | string }>(
  queryKey: string[],
  operation: 'add' | 'update' | 'remove',
  getItemFromVariables: (variables: any) => T | Partial<T> | number | string
) {
  return createOptimisticMutation<T[], any>(queryKey, (oldData, variables) => {
    const item = getItemFromVariables(variables);
    
    switch (operation) {
      case 'add':
        return optimisticAdd(oldData, item as T);
      case 'update':
        if (typeof item === 'object' && 'id' in item) {
          return optimisticUpdate(oldData, (item as T).id, item as Partial<T>);
        }
        return oldData || [];
      case 'remove':
        const id = typeof item === 'object' ? (item as T).id : item;
        return optimisticRemove(oldData, id as number | string);
      default:
        return oldData || [];
    }
  });
}

export const invalidateAfterMutation = (queryKeys: string[][]) => ({
  onSuccess: () => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }
});
