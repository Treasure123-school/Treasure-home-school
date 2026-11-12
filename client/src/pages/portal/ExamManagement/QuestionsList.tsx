import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical } from 'lucide-react';
import type { ExamManager } from './useExamManager';
import { QuestionOptions } from './QuestionOptions';

/** List of questions inside the manage-questions modal. */
export function QuestionsList({ m }: { m: ExamManager }) {
  const { setQuestionToDelete, examQuestions, loadingQuestions, deleteQuestionMutation, updateQuestionMutation, handleEditQuestion } = m;
  return (
              <div className="space-y-3">
                {loadingQuestions ? (
                  <div className="text-center py-8">Loading questions...</div>
                ) : examQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No questions added yet. Add your first question to get started.
                  </div>
                ) : (
                  examQuestions.map((question: any, index: number) => (
                    <Card key={question.id} data-testid={`card-question-${question.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline">Q{index + 1}</Badge>
                              <Badge variant={question.questionType === 'multiple_choice' ? 'secondary' : question.questionType === 'essay' ? 'default' : 'outline'}>
                                {question.questionType === 'multiple_choice' ? 'Multiple Choice' :
                                  question.questionType === 'essay' ? 'Essay' : 'Short Answer'}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{question.points} points</span>
                            </div>
                            <p className="mb-2 font-medium whitespace-pre-wrap">{question.questionText}</p>

                            {question.instructions && (
                              <div className="mb-2 p-2 bg-primary/5 rounded text-sm">
                                <span className="font-medium text-primary">Instructions: </span>
                                <span className="text-primary">{question.instructions}</span>
                              </div>
                            )}

                            {question.questionType === 'multiple_choice' && (
                              <div className="ml-4 space-y-1">
                                <QuestionOptions questionId={question.id} />
                              </div>
                            )}

                            {question.questionType === 'essay' && (
                              <div className="ml-4 text-sm text-muted-foreground">
                                <div className="flex items-center space-x-4">
                                  <span>📝 Essay question</span>
                                  {question.sampleAnswer && (
                                    <span className="text-green-600">✓ Sample answer provided</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                data-testid={`button-actions-question-${question.id}`}
                                aria-label={`Actions for question ${index + 1}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditQuestion(question)}
                                disabled={updateQuestionMutation.isPending}
                                data-testid={`button-edit-question-${question.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setQuestionToDelete(question.id)}
                                disabled={deleteQuestionMutation.isPending}
                                data-testid={`button-delete-question-${question.id}`}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
  );
}
