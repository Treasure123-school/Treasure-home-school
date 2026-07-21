/** Section 3 — subject performance table (desktop) + card list (mobile). */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { getGradeColor, formatPosition } from '@/lib/report-card-utils';
import type { SubjectScore } from './types';

interface Props {
  items: SubjectScore[];
  testWeight: number;
  examWeight: number;
  onEditSubject?: (item: SubjectScore) => void;
}

export function ReportCardSubjectTable({ items, testWeight, examWeight, onEditSubject }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <Card className="print:shadow-none print:border-2">
        <CollapsibleTrigger asChild className="print:hidden">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Subject Performance
                <span className="text-xs text-muted-foreground font-normal">(Test {testWeight}% | Exam {examWeight}%)</span>
              </CardTitle>
              <div className="flex items-center gap-2 sm:hidden">
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CardHeader className="hidden print:block pb-2 pt-3 px-4">
          <CardTitle className="text-base">
            Subject Performance (Test {testWeight}% | Exam {examWeight}%)
          </CardTitle>
        </CardHeader>

        <CollapsibleContent className="print:!block">
          <CardContent className="p-0 sm:p-3 print:p-3">
            {/* Desktop table */}
            <div className="hidden sm:block print:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-semibold border-b">Subject</th>
                    <th className="text-center p-2 font-semibold border-b">Test ({testWeight})</th>
                    <th className="text-center p-2 font-semibold border-b">Exam ({examWeight})</th>
                    <th className="text-center p-2 font-semibold border-b">Total (100)</th>
                    <th className="text-center p-2 font-semibold border-b">Grade</th>
                    <th className="text-center p-2 font-semibold border-b">Position</th>
                    <th className="text-left p-2 font-semibold border-b">Remarks</th>
                    <th className="text-center p-2 font-semibold border-b print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <td className="p-2 font-medium border-b">{item.subjectName}</td>
                      <td className="text-center p-2 border-b">
                        {item.testWeightedScore != null ? item.testWeightedScore : (item.testScore != null ? item.testScore : '-')}/{testWeight}
                      </td>
                      <td className="text-center p-2 border-b">
                        {item.examWeightedScore != null ? item.examWeightedScore : (item.examScore != null ? item.examScore : '-')}/{examWeight}
                      </td>
                      <td className="text-center p-2 font-semibold border-b">{item.obtainedMarks || 0}/100</td>
                      <td className="text-center p-2 border-b">
                        <Badge className={getGradeColor(item.grade || '-')}>{item.grade || '-'}</Badge>
                      </td>
                      <td className="text-center p-2 border-b text-muted-foreground">
                        {item.subjectPosition ? formatPosition(item.subjectPosition) : '-'}
                      </td>
                      <td className="p-2 text-xs border-b max-w-[120px]">{item.teacherRemarks || item.remarks || '-'}</td>
                      <td className="text-center p-2 border-b print:hidden">
                        {(item.canEditTest || item.canEditExam || item.canEditRemarks) && onEditSubject && (
                          <Button size="icon" variant="ghost" onClick={() => onEditSubject(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="block sm:hidden space-y-2 p-3 print:hidden">
              {(items ?? []).map((item) => (
                <div key={item.id} className="bg-muted/30 rounded-md p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{item.subjectName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${getGradeColor(item.grade || '-')} text-xs`}>{item.grade || '-'}</Badge>
                        {item.subjectPosition && (
                          <span className="text-xs text-muted-foreground">Pos: {formatPosition(item.subjectPosition)}</span>
                        )}
                      </div>
                    </div>
                    {(item.canEditTest || item.canEditExam || item.canEditRemarks) && onEditSubject && (
                      <Button size="icon" variant="ghost" onClick={() => onEditSubject(item)} className="h-8 w-8">
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-background p-2 rounded">
                      <p className="text-muted-foreground">Test</p>
                      <p className="font-medium">
                        {item.testWeightedScore != null ? item.testWeightedScore : (item.testScore != null ? item.testScore : '-')}/{testWeight}
                      </p>
                    </div>
                    <div className="bg-background p-2 rounded">
                      <p className="text-muted-foreground">Exam</p>
                      <p className="font-medium">
                        {item.examWeightedScore != null ? item.examWeightedScore : (item.examScore != null ? item.examScore : '-')}/{examWeight}
                      </p>
                    </div>
                    <div className="bg-background p-2 rounded">
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{item.obtainedMarks || 0}/100</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
