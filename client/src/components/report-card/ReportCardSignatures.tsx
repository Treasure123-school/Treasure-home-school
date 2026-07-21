/** Section 8 — teacher & principal signatures, date issued, next term notice. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Pen } from 'lucide-react';
import { format } from 'date-fns';
import type { ReportCardData } from './types';

interface Props {
  reportCard: ReportCardData;
  teacherSigSrc: string;
  principalSigSrc: string;
}

export function ReportCardSignatures({ reportCard, teacherSigSrc, principalSigSrc }: Props) {
  const dateIssued = reportCard.dateIssued || reportCard.generatedAt
    ? format(new Date(reportCard.dateIssued || reportCard.generatedAt || new Date()), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  return (
    <Card className="print:shadow-none print:border-2">
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Pen className="w-4 h-4" />
          Signatures
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Teacher */}
          <div className="text-center">
            <div className="border-b-2 border-dashed border-muted-foreground/30 mb-2 h-16 flex items-end justify-center pb-1">
              {teacherSigSrc ? (
                <img src={teacherSigSrc} alt="Class Teacher's Signature"
                  className="h-14 max-w-full object-contain" data-testid="img-teacher-signature" />
              ) : (
                <span className="text-lg font-serif italic text-muted-foreground/50">________________</span>
              )}
            </div>
            <p className="text-sm font-medium">Class Teacher&apos;s Signature</p>
            {reportCard.teacherName && (
              <p className="text-xs font-semibold text-foreground mt-0.5" data-testid="text-teacher-name">
                {reportCard.teacherName}
              </p>
            )}
            {reportCard.teacherSignedAt && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-teacher-signed-date">
                Signed: {format(new Date(reportCard.teacherSignedAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          {/* Principal */}
          <div className="text-center">
            <div className="border-b-2 border-dashed border-muted-foreground/30 mb-2 h-16 flex items-end justify-center pb-1">
              {principalSigSrc ? (
                <img src={principalSigSrc} alt="Principal's Signature"
                  className="h-14 max-w-full object-contain" data-testid="img-principal-signature" />
              ) : (
                <span className="text-lg font-serif italic text-muted-foreground/50">________________</span>
              )}
            </div>
            <p className="text-sm font-medium">Principal&apos;s Signature</p>
            {reportCard.principalName && (
              <p className="text-xs font-semibold text-foreground mt-0.5" data-testid="text-principal-name">
                {reportCard.principalName}
              </p>
            )}
            {reportCard.principalSignedAt && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-principal-signed-date">
                Signed: {format(new Date(reportCard.principalSignedAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Date Issued:</span>
            <span className="font-medium text-foreground" data-testid="text-date-issued">{dateIssued}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Next Term Begins:</span>
            <span className="font-medium text-foreground">To be announced</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
