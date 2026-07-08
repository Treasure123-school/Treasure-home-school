import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_CATEGORIES, subjectFormSchema } from '../constants';
import type { SubjectForm } from '../constants';

interface SubjectFormDialogProps {
  open: boolean;
  editingSubject: any | null;
  onClose: () => void;
  onSubmit: (data: SubjectForm) => void;
  isPending: boolean;
}

const DEFAULT_VALUES: SubjectForm = { name: '', code: '', description: '', category: 'general' };

export function SubjectFormDialog({ open, editingSubject, onClose, onSubmit, isPending }: SubjectFormDialogProps) {
  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<SubjectForm>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (editingSubject) {
      reset({
        name: editingSubject.name,
        code: editingSubject.code,
        description: editingSubject.description || '',
        category: editingSubject.category || 'general',
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [open, editingSubject, reset]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="name">Subject Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...register('name')} placeholder="e.g. Mathematics" className="mt-1" data-testid="input-subject-name" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="code">Subject Code <span className="text-destructive">*</span></Label>
            <Input id="code" {...register('code')} placeholder="e.g. MATH101" className="mt-1" data-testid="input-subject-code" />
            {errors.code && <p className="text-xs text-destructive mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register('description')} placeholder="Brief description" className="mt-1" data-testid="input-description" />
          </div>
          <div>
            <Label>Category <span className="text-destructive">*</span></Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1" data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <c.icon className={`w-4 h-4 ${c.iconColor}`} />
                          <span>{c.label}</span>
                          <span className="text-muted-foreground text-xs">({c.description})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">
              General subjects are for all classes. Science/Art/Commercial are for SS1–SS3 only.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending} data-testid="button-save-subject">
              {isPending ? 'Saving…' : editingSubject ? 'Update Subject' : 'Add Subject'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
