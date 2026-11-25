import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { QuestionImageUpload } from '@/components/question/QuestionImageUpload';
import { QuestionRichTextEditor } from '@/components/question/QuestionRichText';
import type { ExamManager } from './useExamManager';

/** Add/edit question form dialog. */
export function QuestionFormDialog({ m }: { m: ExamManager }) {
  const { isQuestionDialogOpen, setIsQuestionDialogOpen, editingQuestion, setEditingQuestion, editingImageUrl, setEditingImageUrl, registerQuestion, handleQuestionSubmit, questionType, options, questionErrors, questionControl, setQuestionValue, resetQuestion, createQuestionMutation, updateQuestionMutation, onInvalidQuestion, onSubmitQuestion, addOption, removeOption, updateOption } = m;
  return (
                  <Dialog
                    open={isQuestionDialogOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingQuestion(null);
                        setEditingImageUrl(null);
                        resetQuestion({
                          questionType: 'multiple_choice',
                          points: 1,
                          questionText: '',
                          instructions: '',
                          sampleAnswer: '',
                          options: [
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                          ]
                        });
                      }
                      setIsQuestionDialogOpen(open);
                    }}
                  >
                    <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleQuestionSubmit(onSubmitQuestion, onInvalidQuestion)} className="space-y-4">
                        <div>
                          <Label htmlFor="questionText">Question Text</Label>
                          <Controller
                            name="questionText"
                            control={questionControl}
                            render={({ field }) => (
                              <QuestionRichTextEditor
                                id="questionText"
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Enter your question here..."
                                minHeight="96px"
                                disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                              />
                            )}
                          />
                          {questionErrors.questionText && <p className="text-sm text-red-500">{questionErrors.questionText.message}</p>}
                        </div>

                        {/* Instructions — shown for ALL question types */}
                        <div>
                          <Label htmlFor="instructions" className="text-xs font-semibold text-foreground/70">
                            Instructions{' '}
                            <span className="text-muted-foreground font-normal">(optional — shown to student above this question)</span>
                          </Label>
                          <Textarea
                            id="instructions"
                            {...registerQuestion('instructions')}
                            data-testid="textarea-question-instructions"
                            placeholder="e.g. Choose the best answer. / Study the diagram below. / Simplify the expression."
                            rows={2}
                            className="resize-none mt-1.5"
                          />
                        </div>

                        {/* Image upload — shown for ALL question types */}
                        <QuestionImageUpload
                          value={editingImageUrl}
                          onChange={setEditingImageUrl}
                          disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                        />

                        {/* Sample answer — essay only */}
                        {questionType === 'essay' && (
                          <div>
                            <Label htmlFor="sampleAnswer">Sample Answer (Optional)</Label>
                            <Textarea
                              id="sampleAnswer"
                              {...registerQuestion('sampleAnswer')}
                              data-testid="textarea-question-sample"
                              placeholder="Provide a sample or model answer for grading reference..."
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This will help with consistent grading and is not shown to students
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="questionType">Question Type</Label>
                            <Controller
                              name="questionType"
                              control={questionControl}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger data-testid="select-question-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                    <SelectItem value="essay">Essay</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div>
                            <Label htmlFor="points">Points</Label>
                            <Input
                              id="points"
                              type="number"
                              {...registerQuestion('points', { valueAsNumber: true })}
                              data-testid="input-question-points"
                              min="1"
                            />
                          </div>
                        </div>

                        {questionType === 'multiple_choice' && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Label>Answer Options</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {options?.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name="correctOption"
                                    checked={option.isCorrect}
                                    onChange={() => {
                                      // Uncheck all other options
                                      const newOptions = options.map((opt, i) => ({
                                        ...opt,
                                        isCorrect: i === index
                                      }));
                                      setQuestionValue('options', newOptions);
                                    }}
                                    data-testid={`radio-option-${index}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <QuestionRichTextEditor
                                      value={option.optionText || ''}
                                      onChange={(text) => updateOption(index, 'optionText', text)}
                                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                      minHeight="36px"
                                      compact
                                      disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                                    />
                                  </div>
                                  {options.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeOption(index)}
                                      data-testid={`button-remove-option-${index}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {questionErrors.options && (
                              <p className="text-sm text-red-500 mt-2">{questionErrors.options.message}</p>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                            data-testid="button-submit-question"
                          >
                            {editingQuestion
                              ? (updateQuestionMutation.isPending ? 'Saving...' : 'Save Changes')
                              : (createQuestionMutation.isPending ? 'Adding...' : 'Add Question')
                            }
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
  );
}
