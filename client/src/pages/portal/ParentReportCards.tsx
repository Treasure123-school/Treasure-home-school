import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, TrendingUp, Award, Calendar, User, Clock, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

interface Child {
  id: string;
  name: string;
  admissionNumber: string;
  className: string;
}
interface ReportCard {
  id: number;
  studentId: string;
  studentName: string;
  className: string;
  termName: string;
  termYear: string;
  averagePercentage: number;
  overallGrade: string;
  teacherRemarks: string;
  status: string;
  generatedAt: string;
  items: ReportCardItem[];
}
interface ReportCardItem {
  subjectName: string;
  testScore: number;
  testMaxScore: number;
  testWeightedScore: number;
  examScore: number;
  examMaxScore: number;
  examWeightedScore: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  teacherRemarks: string;
}
export default function ParentReportCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChild, setSelectedChild] = useState<string>('');

  // Fetch parent's children
  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/parent/${user?.id}/children`);
      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch selected child's report cards
  const { data: reportCards = [], isLoading: loadingReports } = useQuery<ReportCard[]>({
    queryKey: ['/api/parent/child-reports', selectedChild],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/parent/child-reports/${selectedChild}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report cards');
      }
      return response.json();
    },
    enabled: !!selectedChild,
  });

  // Real-time subscription for when report cards are published for the selected child
  // The hook automatically invalidates the queryKey when events are received
  const { isConnected: realtimeConnected } = useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/parent/child-reports', selectedChild],
    enabled: !!selectedChild,
  });

  const handleDownloadPDF = async (reportId: number) => {
    try {
      const response = await apiRequest('GET', `/api/report-cards/${reportId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Report card downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download report card",
        variant: "destructive",
      });
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A' || grade === 'A+') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (grade === 'B' || grade === 'B+') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (grade === 'C' || grade === 'C+') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (!user) {
    return (
        <div className="text-center py-12">Please log in to access parent portal.</div>
    );
  }
  return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Report Cards</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">View your children's academic performance</p>
              {realtimeConnected && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>

          {children.length > 0 && (
            <div className="w-full md:w-64">
              <Select value={selectedChild} onValueChange={setSelectedChild}>
                <SelectTrigger data-testid="select-child">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} - {child.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loadingChildren ? (
          <div className="text-center py-12">Loading children...</div>
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No children found. Please contact the school administration.</p>
              </div>
            </CardContent>
          </Card>
        ) : !selectedChild ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Please select a child to view their report cards</p>
              </div>
            </CardContent>
          </Card>
        ) : loadingReports ? (
          <div className="text-center py-12">Loading report cards...</div>
        ) : reportCards.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                <h3 className="text-lg font-medium mb-2">No Published Report Cards Yet</h3>
                <p className="text-muted-foreground mb-2">
                  Report cards for this child haven't been published yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Report cards become available once teachers finalize and publish them. Please check back later.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {reportCards.map((report) => (
              <Card key={report.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl" data-testid={`text-report-title-${report.id}`}>
                        {report.studentName} - {report.className}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {report.termName} {report.termYear}
                        </span>
                        <span>•</span>
                        <Badge variant="outline" className={getGradeColor(report.overallGrade)}>
                          Grade: {report.overallGrade}
                        </Badge>
                        <Badge variant="outline">
                          Average: {report.averagePercentage}%
                        </Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDownloadPDF(report.id)}
                      className="gap-2"
                      data-testid={`button-download-pdf-${report.id}`}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {/* Subject Breakdown */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Subject Performance
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Subject</th>
                            <th className="text-center py-2 px-3 font-medium">Test (40)</th>
                            <th className="text-center py-2 px-3 font-medium">Exam (60)</th>
                            <th className="text-center py-2 px-3 font-medium">Total (100)</th>
                            <th className="text-center py-2 px-3 font-medium">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.items.map((item, index) => (
                            <tr key={index} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-3 font-medium">{item.subjectName}</td>
                              <td className="text-center py-3 px-3">
                                <div className="space-y-1">
                                  <div className="font-medium">{item.testWeightedScore}/40</div>
                                  <div className="text-xs text-muted-foreground">
                                    ({item.testScore}/{item.testMaxScore})
                                  </div>
                                </div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <div className="space-y-1">
                                  <div className="font-medium">{item.examWeightedScore}/60</div>
                                  <div className="text-xs text-muted-foreground">
                                    ({item.examScore}/{item.examMaxScore})
                                  </div>
                                </div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <div className="font-bold text-lg">{item.obtainedMarks}/100</div>
                                <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                              </td>
                              <td className="text-center py-3 px-3">
                                <Badge className={getGradeColor(item.grade)}>
                                  {item.grade}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Teacher's Remarks */}
                  {report.teacherRemarks && (
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <h4 className="font-semibold mb-2">Teacher's Remarks</h4>
                      <p className="text-sm text-muted-foreground">{report.teacherRemarks}</p>
                    </div>
                  )}

                  {/* Performance Summary */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Average Score</p>
                            <p className="text-xl font-bold">{report.averagePercentage}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Overall Grade</p>
                            <p className="text-xl font-bold">{report.overallGrade}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Subjects</p>
                            <p className="text-xl font-bold">{report.items.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}
