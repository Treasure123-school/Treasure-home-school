import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Exam, Class, Subject } from '@shared/schema.pg';
import type { ExamManager } from './useExamManager';
import { QuestionOptions } from './QuestionOptions';

/** Student-view preview dialog. */
export function PreviewDialog({ m }: { m: ExamManager }) {
  const { previewExam, setPreviewExam, previewQuestions, loadingPreviewQuestions, getClassNameById, getSubjectNameById } = m;
  return previewExam && (
        <Dialog open={!!previewExam} onOpenChange={(open) => { if (!open) setPreviewExam(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewExam.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">Student view of the exam</p>
            </DialogHeader>

            <div className="space-y-6">
              {/* Exam Info */}
              <Card className="bg-primary/5 dark:bg-primary/5">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Class:</span> {previewExam.classId ? getClassNameById(previewExam.classId) : '—'}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> {previewExam.subjectId ? getSubjectNameById(previewExam.subjectId) : '—'}
                    </div>
                    <div>
                      <span className="font-medium">Total Marks:</span> {previewExam.totalMarks}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {previewExam.timeLimit} minutes
                    </div>
                  </div>
                  {previewExam.instructions && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded">
                      <p className="text-sm font-medium mb-1">Instructions:</p>
                      <p className="text-sm">{previewExam.instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Questions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Questions ({previewQuestions.length})</h3>
                {loadingPreviewQuestions ? (
                  <div className="text-center py-8">Loading questions...</div>
                ) : previewQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No questions added to this exam yet.
                  </div>
                ) : (
                  previewQuestions.map((question: any, index: number) => (
                    <Card key={question.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-4">
                          <Badge variant="outline">Q{index + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-medium mb-2 whitespace-pre-wrap">{question.questionText}</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              {question.points} {question.points === 1 ? 'point' : 'points'}
                            </p>
                            {question.questionType === 'multiple_choice' && (
                              <div className="space-y-2">
                                <QuestionOptions questionId={question.id} />
                              </div>
                            )}
                            {question.questionType === 'essay' && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm text-muted-foreground">
                                Essay answer box would appear here
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setPreviewExam(null)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
  );
}
