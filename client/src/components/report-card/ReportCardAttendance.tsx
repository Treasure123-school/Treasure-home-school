/** Section 4 — attendance statistics. */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { AttendanceSummary } from './types';

interface Props {
  attendance: AttendanceSummary;
}

export function ReportCardAttendance({ attendance }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <Card className="print:shadow-none print:border-2">
        <CollapsibleTrigger asChild className="print:hidden">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Attendance &amp; Conduct
              </CardTitle>
              <div className="flex items-center gap-2 sm:hidden">
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CardHeader className="hidden print:block pb-2 pt-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Attendance &amp; Conduct
          </CardTitle>
        </CardHeader>

        <CollapsibleContent className="print:!block">
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-muted/50 p-3 rounded-md text-center">
                <p className="text-xs text-muted-foreground">School Days</p>
                <p className="text-xl font-bold">{attendance.timesSchoolOpened}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md text-center">
                <p className="text-xs text-muted-foreground">Days Present</p>
                <p className="text-xl font-bold text-green-600">{attendance.timesPresent}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-center">
                <p className="text-xs text-muted-foreground">Days Absent</p>
                <p className="text-xl font-bold text-red-600">{attendance.timesAbsent}</p>
              </div>
              <div className="bg-primary/5 p-3 rounded-md text-center">
                <p className="text-xs text-muted-foreground">Attendance %</p>
                <p className="text-xl font-bold text-primary">{attendance.attendancePercentage}%</p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
