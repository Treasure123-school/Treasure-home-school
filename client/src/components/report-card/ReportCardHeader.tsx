/** School header — rendered for both screen and print views. */
import { Separator } from '@/components/ui/separator';

interface Props {
  schoolName: string;
  schoolAddress: string;
  schoolMotto: string;
  primaryPhone: string;
  primaryEmail: string;
  allPhones: string;
  phoneCount: number;
  termName: string;
  academicSession: string;
}

export function ReportCardHeader({
  schoolName, schoolAddress, schoolMotto, primaryPhone, primaryEmail,
  allPhones, phoneCount, termName, academicSession,
}: Props) {
  const termLabel = termName?.toUpperCase() || 'FIRST TERM';
  const session = academicSession || '2024/2025';

  return (
    <>
      {/* Screen header */}
      <div className="mb-4 p-4 bg-white rounded-md border print:hidden">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">{schoolName}</h1>
          <p className="text-sm font-medium">{schoolAddress}</p>
          <p className="text-xs text-muted-foreground mt-1">Contact: {primaryPhone}</p>
          {primaryEmail && <p className="text-xs text-muted-foreground">Email: {primaryEmail}</p>}
          <p className="text-xs italic mt-2">Motto: &ldquo;{schoolMotto}&rdquo;</p>
          <Separator className="my-3" />
          <h2 className="text-lg font-semibold">{termLabel} STUDENT&apos;S PERFORMANCE REPORT</h2>
          <p className="text-xs text-muted-foreground">Session: {session}</p>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b-2 border-primary pb-4">
          <h1 className="text-2xl font-bold text-primary">{schoolName}</h1>
          <p className="text-sm font-medium">{schoolAddress}</p>
          <p className="text-xs text-muted-foreground">
            {phoneCount > 1 ? `Contacts: ${allPhones}` : `Contact: ${primaryPhone}`}
          </p>
          {primaryEmail && <p className="text-xs text-muted-foreground">Email: {primaryEmail}</p>}
          <p className="text-xs italic mt-2">Motto: &ldquo;{schoolMotto}&rdquo;</p>
        </div>
        <h2 className="text-center text-lg font-semibold mt-4 mb-2">{termLabel} STUDENT&apos;S PERFORMANCE REPORT</h2>
        <p className="text-center text-xs text-muted-foreground mb-4">Session: {session}</p>
        <p className="text-center text-xs text-muted-foreground">Contact: {primaryPhone}</p>
        {primaryEmail && (
          <p className="text-center text-xs text-muted-foreground mb-4">Email: {primaryEmail}</p>
        )}
      </div>
    </>
  );
}
