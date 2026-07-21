/** Section 1 — student photo, name, admission number, class, term, DOB, gender, dept. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import type { ReportCardData } from './types';

interface Props {
  reportCard: ReportCardData;
  photoSrc: string;
}

export function ReportCardStudentInfo({ reportCard, photoSrc }: Props) {
  const initials = reportCard.studentName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <Card className="mb-4 print:shadow-none print:border-2">
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <User className="w-4 h-4" />
          Student Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Photo */}
          <div className="flex justify-center sm:justify-start">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20 print:hidden">
              {photoSrc ? <AvatarImage src={photoSrc} alt={reportCard.studentName} /> : null}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xl">
                {initials || <User className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            {photoSrc ? (
              <img src={photoSrc} alt={reportCard.studentName}
                className="hidden print:block h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="hidden print:flex h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-primary bg-gray-100 items-center justify-center">
                <span className="text-primary font-bold text-xl">{initials}</span>
              </div>
            )}
          </div>
          {/* Details */}
          <div className="flex-1">
            <h3 className="font-bold text-lg sm:text-xl text-center sm:text-left mb-3" data-testid="text-student-name">
              {reportCard.studentName}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Admission No</span>
                <span className="font-medium" data-testid="text-admission-number">{reportCard.admissionNumber}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Class / Level</span>
                <span className="font-medium" data-testid="text-class-name">
                  {reportCard.className}{reportCard.classArm ? ` (${reportCard.classArm})` : ''}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Term</span>
                <span className="font-medium" data-testid="text-term">{reportCard.termName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Session</span>
                <span className="font-medium" data-testid="text-session">{reportCard.academicSession || '2024/2025'}</span>
              </div>
              {reportCard.dateOfBirth && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Date of Birth</span>
                  <span className="font-medium" data-testid="text-dob">{reportCard.dateOfBirth}</span>
                </div>
              )}
              {reportCard.gender && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Gender</span>
                  <span className="font-medium" data-testid="text-gender">{reportCard.gender}</span>
                </div>
              )}
              {reportCard.isSSS && reportCard.department && (
                <div className="flex flex-col col-span-2">
                  <span className="text-muted-foreground text-xs">Department</span>
                  <span className="font-medium capitalize" data-testid="text-department">{reportCard.department}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
