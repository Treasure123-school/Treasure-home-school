/** Analytics tab — grade distribution bar chart + status summary. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, Send } from 'lucide-react';

interface Statistics {
  draftCount: number;
  finalizedCount: number;
  publishedCount: number;
}

interface Props {
  reportCards: any[];
  statistics: Statistics | null;
}

function gradeColor(g: string) {
  if (g === 'A') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (g === 'B') return 'bg-primary/10 text-primary';
  if (g === 'C') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (g === 'D' || g === 'E') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

function barColor(g: string) {
  if (g === 'A') return 'bg-green-500';
  if (g === 'B') return 'bg-primary/85';
  if (g === 'C') return 'bg-yellow-500';
  if (g === 'D' || g === 'E') return 'bg-orange-500';
  return 'bg-red-500';
}

export function ReportCardAnalyticsTab({ reportCards, statistics }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Grade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {reportCards.length > 0 && (
            <div className="space-y-3">
              {['A', 'B', 'C', 'D', 'E', 'F'].map(prefix => {
                const count = reportCards.filter((rc: any) => rc.overallGrade?.toUpperCase().startsWith(prefix)).length;
                const pct = reportCards.length > 0 ? Math.round((count / reportCards.length) * 100) : 0;
                return (
                  <div key={prefix} className="flex items-center gap-3">
                    <Badge className={`w-12 justify-center ${gradeColor(prefix)}`}>{prefix}</Badge>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4">
                      <div className={`h-4 rounded-full ${barColor(prefix)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {statistics && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> Draft</span>
                <span className="font-medium">{statistics.draftCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Finalized</span>
                <span className="font-medium">{statistics.finalizedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Send className="w-4 h-4 text-green-500" /> Published</span>
                <span className="font-medium">{statistics.publishedCount}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
