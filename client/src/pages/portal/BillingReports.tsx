import { getApiUrl } from '@/config/api';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, CreditCard, BarChart3, PieChart } from 'lucide-react';
import { PageHeader, MiniStatCard, MiniStatGrid } from '@/components/shared';

interface Term { id: number; name: string; year: string; isCurrent: boolean; }
interface ReportData {
  totalRevenue: number;
  totalPayments: number;
  byItem: { billingItemId: number; name: string; category: string; count: number; total: number }[];
  byMethod: { method: string; count: number; total: number }[];
  byCategory: { category: string; count: number; total: number }[];
  monthlyTrend: { month: string; count: number; total: number }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', exam: 'Examination', registration: 'Registration',
  resources: 'Resources', cbt: 'CBT', result_checker: 'Result Checker',
  library: 'Library', excursion: 'Excursion', uniform: 'Uniform', pta: 'PTA', other: 'Other',
};

const fmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);

function BarBlock({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground truncate pr-2">{label}</span>
        <span className="font-medium shrink-0">{fmt(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingReports() {
  const [filterTerm, setFilterTerm] = useState('all');

  const { data: terms = [] } = useQuery<Term[]>({ queryKey: ['/api/terms'] });

  const params = filterTerm !== 'all' ? `?termId=${filterTerm}` : '';
  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ['/api/billing/reports', filterTerm],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/billing/reports${params}`), { credentials: 'include' });
      return res.json();
    },
  });

  const maxItem = Math.max(...(report?.byItem.map(i => i.total) || [1]));
  const maxCat = Math.max(...(report?.byCategory.map(c => c.total) || [1]));
  const maxMonth = Math.max(...(report?.monthlyTrend.map(m => m.total) || [1]));

  const ITEM_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-yellow-500'];
  const CAT_COLORS: Record<string, string> = {
    general: 'bg-blue-500', exam: 'bg-purple-500', registration: 'bg-green-500',
    resources: 'bg-yellow-500', cbt: 'bg-indigo-500', result_checker: 'bg-pink-500',
    library: 'bg-orange-500', excursion: 'bg-teal-500', uniform: 'bg-cyan-500', pta: 'bg-rose-500', other: 'bg-gray-500',
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Revenue analytics and payment trends"
        actions={
          <Select value={filterTerm} onValueChange={setFilterTerm}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              {terms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Loading financial data…</div>
      ) : !report ? (
        <div className="py-20 text-center text-muted-foreground">No data available.</div>
      ) : (
        <>
          <MiniStatGrid>
            <MiniStatCard label="Total Revenue" value={fmt(report.totalRevenue)} icon={DollarSign} />
            <MiniStatCard label="Total Transactions" value={report.totalPayments} icon={CreditCard} />
            <MiniStatCard label="Billing Items" value={report.byItem.length} icon={BarChart3} />
            <MiniStatCard label="Avg per Transaction" value={report.totalPayments ? fmt(Math.round(report.totalRevenue / report.totalPayments)) : '₦0'} icon={TrendingUp} />
          </MiniStatGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Billing Item */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Revenue by Billing Item
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.byItem.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data</p>
                ) : (
                  <div className="space-y-4">
                    {report.byItem
                      .sort((a, b) => b.total - a.total)
                      .map((item, i) => (
                        <div key={item.billingItemId}>
                          <BarBlock
                            label={`${item.name} (${item.count} payments)`}
                            value={item.total}
                            max={maxItem}
                            color={ITEM_COLORS[i % ITEM_COLORS.length]}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Revenue by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.byCategory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data</p>
                ) : (
                  <div className="space-y-4">
                    {report.byCategory
                      .sort((a, b) => b.total - a.total)
                      .map((cat) => (
                        <BarBlock
                          key={cat.category}
                          label={`${CATEGORY_LABELS[cat.category] || cat.category} (${cat.count} payments)`}
                          value={cat.total}
                          max={maxCat}
                          color={CAT_COLORS[cat.category] || 'bg-gray-500'}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.byMethod.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data</p>
                ) : (
                  <div className="space-y-3">
                    {report.byMethod.sort((a, b) => b.total - a.total).map((m) => (
                      <div key={m.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{m.method.replace('_', ' ')}</Badge>
                          <span className="text-sm text-muted-foreground">{m.count} transactions</span>
                        </div>
                        <span className="font-semibold text-sm">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Monthly Collection Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.monthlyTrend.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data</p>
                ) : (
                  <div className="space-y-3">
                    {report.monthlyTrend.map((m) => {
                      const [year, month] = m.month.split('-');
                      const label = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                      return (
                        <div key={m.month} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{label} <span className="text-xs">({m.count})</span></span>
                            <span className="font-medium">{fmt(m.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((m.total / maxMonth) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
