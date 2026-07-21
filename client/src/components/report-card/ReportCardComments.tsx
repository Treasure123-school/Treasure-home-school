/** Section 7 — teacher & principal comments with AI generate and save. */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Star, Loader2, Save, Lock } from 'lucide-react';

interface Props {
  reportCardId: number;
  teacherRemarks: string | null | undefined;
  principalRemarks: string | null | undefined;
  canEditTeacher: boolean;
  canEditPrincipal: boolean;
  onSaveRemarks?: (teacher: string, principal: string) => void;
  onGenerateDefaultComments?: () => Promise<{ teacherComment: string; principalComment: string }>;
  isLoading?: boolean;
}

export function ReportCardComments({
  reportCardId, teacherRemarks, principalRemarks,
  canEditTeacher, canEditPrincipal,
  onSaveRemarks, onGenerateDefaultComments, isLoading,
}: Props) {
  const [local, setLocal] = useState({ teacher: teacherRemarks || '', principal: principalRemarks || '' });
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync when switching to a different report card
  useEffect(() => {
    setLocal({ teacher: teacherRemarks || '', principal: principalRemarks || '' });
  }, [reportCardId, teacherRemarks, principalRemarks]);

  const handleGenerate = async () => {
    if (!onGenerateDefaultComments) return;
    setIsGenerating(true);
    try {
      const comments = await onGenerateDefaultComments();
      if (comments.teacherComment && canEditTeacher) setLocal(p => ({ ...p, teacher: comments.teacherComment }));
      if (comments.principalComment && canEditPrincipal) setLocal(p => ({ ...p, principal: comments.principalComment }));
    } catch (e) {
      console.error('Failed to generate comments:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="mb-4 print:shadow-none print:border-2">
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
        {(canEditTeacher || canEditPrincipal) && onGenerateDefaultComments && (
          <div className="flex justify-end print:hidden">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}
              data-testid="button-generate-comments">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
              Generate Default Comments
            </Button>
          </div>
        )}

        {/* Teacher comment */}
        <div>
          <Label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
            Class Teacher&apos;s Comment
            {!canEditTeacher && canEditPrincipal && (
              <Badge variant="secondary" className="text-xs font-normal">
                <Lock className="w-3 h-3 mr-1" /> View Only
              </Badge>
            )}
          </Label>
          {canEditTeacher ? (
            <Textarea value={local.teacher} onChange={e => setLocal(p => ({ ...p, teacher: e.target.value }))}
              placeholder="Enter class teacher's comment..." className="min-h-[80px]"
              data-testid="textarea-teacher-remarks" />
          ) : (
            <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
              <p className="text-sm" data-testid="text-teacher-remarks">{teacherRemarks || 'No comment provided.'}</p>
            </div>
          )}
        </div>

        {/* Principal comment */}
        <div>
          <Label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
            Principal&apos;s Comment
            {canEditTeacher && !canEditPrincipal && (
              <Badge variant="secondary" className="text-xs font-normal">
                <Lock className="w-3 h-3 mr-1" /> Admin Only
              </Badge>
            )}
          </Label>
          {canEditPrincipal ? (
            <Textarea value={local.principal} onChange={e => setLocal(p => ({ ...p, principal: e.target.value }))}
              placeholder="Enter principal's comment..." className="min-h-[80px]"
              data-testid="textarea-principal-remarks" />
          ) : (
            <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
              <p className="text-sm" data-testid="text-principal-remarks">{principalRemarks || 'No comment provided.'}</p>
            </div>
          )}
        </div>

        {(canEditTeacher || canEditPrincipal) && onSaveRemarks && (
          <div className="flex justify-end print:hidden">
            <Button onClick={() => onSaveRemarks(local.teacher, local.principal)} disabled={isLoading}
              data-testid="button-save-remarks">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Comments
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
