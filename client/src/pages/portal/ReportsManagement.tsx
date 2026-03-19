import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ROLE_IDS } from '@/lib/roles';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  Download, 
  FileText, 
  Calendar,
  School,
  UserCheck,
  Activity,
  Target
} from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ReportsManagement() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string>('overview');
  const [dateRange, setDateRange] = useState<string>('30');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Fetch overview statistics
  const { data: overviewStats, isLoading: loadingOverview } = useQuery({
    queryKey: ['/api/reports/overview'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/reports/overview');
      return await response.json();
    },
  });

  // Fetch trend analytics
  const { data: trendData, isLoading: loadingTrends } = useQuery({
    queryKey: ['/api/reports/trends', dateRange],
    queryFn: async () => {
      const months = Math.max(1, Math.round(parseInt(dateRange) / 30));
      const response = await apiRequest('GET', `/api/reports/trends?months=${months}`);
      return await response.json();
    },
  });

  // Fetch performance analytics
  const { data: performanceData, isLoading: loadingPerformance } = useQuery({
    queryKey: ['/api/reports/performance', selectedClass, selectedSubject],
    queryFn: async () => {
      let url = '/api/reports/performance';
      const params = new URLSearchParams();
      if (selectedClass) params.append('classId', selectedClass);
      if (selectedSubject) params.append('subjectId', selectedSubject);
      if (params.toString()) url += '?' + params.toString();
      
      const response = await apiRequest('GET', url);
      return await response.json();
    },
  });

  // Fetch attendance analytics
  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['/api/reports/attendance', selectedClass, dateRange],
    queryFn: async () => {
      let url = '/api/reports/attendance';
      const params = new URLSearchParams();
      if (selectedClass) params.append('classId', selectedClass);
      
      // Calculate date range for attendance
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
      
      if (params.toString()) url += '?' + params.toString();
      
      const response = await apiRequest('GET', url);
      return await response.json();
    },
  });

  // Fetch classes and subjects for filters
  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });

  // Fetch users data for detailed analytics
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return await response.json();
    },
  });

  // Process data for charts using real analytics data
  const getUsersByRole = () => {
    if (!overviewStats) return [];
    return [
      { name: 'Students', value: overviewStats.totalStudents || 0 },
      { name: 'Teachers', value: overviewStats.totalTeachers || 0 },
      { name: 'Parents', value: overviewStats.totalParents || 0 },
      { name: 'Admins', value: overviewStats.totalAdmins || 0 },
    ].filter(item => item.value > 0);
  };

  const getGradeDistributionData = () => {
    if (!overviewStats?.gradeDistribution) return [];
    return overviewStats.gradeDistribution.map((grade: any) => ({
      name: `Grade ${grade.grade}`,
      value: grade.count,
    }));
  };

  const getSubjectPerformanceData = () => {
    if (!overviewStats?.subjectPerformance) return [];
    return overviewStats.subjectPerformance.map((subject: any) => ({
      name: subject.subject,
      average: subject.average,
      examCount: subject.examCount,
    }));
  };

  const getClassesData = () => {
    return classes.map((cls: any) => ({
      name: cls.name,
      capacity: cls.capacity || 0,
      level: cls.level || 'N/A',
    }));
  };

  const getAttendanceBreakdown = () => {
    if (!attendanceData?.statusBreakdown) return [];
    const breakdown = attendanceData.statusBreakdown;
    return [
      { name: 'Present', value: breakdown.present || 0, color: '#00C49F' },
      { name: 'Absent', value: breakdown.absent || 0, color: '#FF8042' },
      { name: 'Late', value: breakdown.late || 0, color: '#FFBB28' },
      { name: 'Excused', value: breakdown.excused || 0, color: '#0088FE' },
    ].filter(item => item.value > 0);
  };

  const handleExport = (format: string) => {
    toast({
      title: "Export Started",
      description: `Generating ${format.toUpperCase()} report...`,
    });
    
    // In a real app, this would trigger a download
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: `${format.toUpperCase()} report has been generated.`,
      });
    }, 2000);
  };

  // Create overview data from real analytics
  const overviewData = [
    {
      title: "Total Students",
      value: overviewStats?.totalStudents || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Teachers", 
      value: overviewStats?.totalTeachers || 0,
      icon: GraduationCap,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Classes",
      value: overviewStats?.totalClasses || 0,
      icon: School,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Subjects",
      value: overviewStats?.totalSubjects || 0,
      icon: BookOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const performanceOverviewData = [
    {
      title: "Total Exams",
      value: performanceData?.totalExams || 0,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Average Score",
      value: performanceData?.averageScore ? `${performanceData.averageScore}%` : '0%',
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pass Rate",
      value: performanceData?.passRate ? `${performanceData.passRate}%` : '0%',
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Attendance Rate",
      value: attendanceData?.attendanceRate ? `${attendanceData.attendanceRate}%` : '0%',
      icon: UserCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6" data-testid="reports-management">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleExport('pdf')}
            data-testid="button-export-pdf"
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('csv')}
            data-testid="button-export-csv"
            className="flex-1 sm:flex-none"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Type Selector and Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 items-end">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger className="w-full" data-testid="select-report-type">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview Dashboard</SelectItem>
                  <SelectItem value="performance">Performance Analytics</SelectItem>
                  <SelectItem value="attendance">Attendance Reports</SelectItem>
                  <SelectItem value="students">Student Analytics</SelectItem>
                  <SelectItem value="teachers">Teacher Analytics</SelectItem>
                  <SelectItem value="classes">Class Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full" data-testid="select-date-range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 3 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(selectedReport === 'performance' || selectedReport === 'attendance') && (
              <div>
                <Label htmlFor="classFilter">Filter by Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-full" data-testid="select-class-filter">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Classes</SelectItem>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedReport === 'performance' && (
              <div>
                <Label htmlFor="subjectFilter">Filter by Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="w-full" data-testid="select-subject-filter">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subjects</SelectItem>
                    {subjects.map((subject: any) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Button 
                onClick={() => {
                  setSelectedClass('');
                  setSelectedSubject('');
                  setDateRange('30');
                }}
                variant="outline"
                data-testid="button-reset-filters"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedReport === 'overview' && (
        <>
          {/* Overview Statistics */}
          {loadingOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                      <Skeleton className="h-12 w-12 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {overviewData.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} data-testid={`card-stat-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {stat.title}
                          </p>
                          <p className="text-2xl font-bold" data-testid={`text-stat-value-${index}`}>
                            {stat.value}
                          </p>
                        </div>
                        <div className={`p-3 rounded-full ${stat.bgColor}`}>
                          <Icon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users by Role Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Users by Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOverview ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getUsersByRole()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getUsersByRole().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Trend Analytics ({dateRange} days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ) : trendData?.monthlyTrends ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="students" stroke="#8884d8" name="Students" />
                      <Line type="monotone" dataKey="exams" stroke="#82ca9d" name="Exams" />
                      <Line type="monotone" dataKey="averageScore" stroke="#ffc658" name="Avg Score" />
                      <Line type="monotone" dataKey="attendance" stroke="#ff7300" name="Attendance %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No trend data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution and Subject Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOverview ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                  </div>
                ) : getGradeDistributionData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getGradeDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getGradeDistributionData().map((entry: { name: string; value: number }, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No grade data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subject Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Subject Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOverview ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, index) => (
                      <Skeleton key={index} className="h-8 w-full" />
                    ))}
                  </div>
                ) : getSubjectPerformanceData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getSubjectPerformanceData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="average" fill="#8884d8" name="Average Score" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No subject performance data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {selectedReport === 'performance' && (
        <>
          {/* Performance Overview Statistics */}
          {loadingPerformance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                      <Skeleton className="h-12 w-12 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {performanceOverviewData.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} data-testid={`card-performance-stat-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {stat.title}
                          </p>
                          <p className="text-2xl font-bold" data-testid={`text-performance-stat-value-${index}`}>
                            {stat.value}
                          </p>
                        </div>
                        <div className={`p-3 rounded-full ${stat.bgColor}`}>
                          <Icon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Performance Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPerformance ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                  </div>
                ) : performanceData?.gradeDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={performanceData.gradeDistribution.map((grade: any) => ({
                          name: `Grade ${grade.grade}`,
                          value: grade.count
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {performanceData.gradeDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No performance data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPerformance ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, index) => (
                      <Skeleton key={index} className="h-8 w-full" />
                    ))}
                  </div>
                ) : performanceData?.performanceTrends?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceData.performanceTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="average" stroke="#8884d8" name="Average Score" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No performance trend data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top and Struggling Students */}
          {performanceData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceData.topPerformers?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Average Score</TableHead>
                          <TableHead>Exams Taken</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceData.topPerformers.map((student: any, index: number) => (
                          <TableRow key={student.studentId} data-testid={`row-top-performer-${index}`}>
                            <TableCell data-testid={`text-top-performer-id-${index}`}>
                              {student.studentId}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default">{student.average}%</Badge>
                            </TableCell>
                            <TableCell>{student.examCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No top performers data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Struggling Students */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Students Needing Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceData.strugglingStudents?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Average Score</TableHead>
                          <TableHead>Exams Taken</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceData.strugglingStudents.map((student: any, index: number) => (
                          <TableRow key={student.studentId} data-testid={`row-struggling-student-${index}`}>
                            <TableCell data-testid={`text-struggling-student-id-${index}`}>
                              {student.studentId}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">{student.average}%</Badge>
                            </TableCell>
                            <TableCell>{student.examCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No struggling students data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {selectedReport === 'attendance' && (
        <>
          {/* Attendance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-attendance-overview">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                    <p className="text-2xl font-bold" data-testid="text-attendance-rate">
                      {loadingAttendance ? '-' : `${attendanceData?.attendanceRate || 0}%`}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-green-50">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">
                      {loadingAttendance ? '-' : attendanceData?.totalRecords || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-50">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-green-600">
                      {loadingAttendance ? '-' : attendanceData?.statusBreakdown?.present || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-green-50">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-600">
                      {loadingAttendance ? '-' : attendanceData?.statusBreakdown?.absent || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-red-50">
                    <Users className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserCheck className="w-5 h-5 mr-2" />
                Attendance Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAttendance ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Skeleton className="h-48 w-48 rounded-full" />
                </div>
              ) : getAttendanceBreakdown().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getAttendanceBreakdown()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getAttendanceBreakdown().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No attendance data available for the selected period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedReport === 'students' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Student Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.filter((u: any) => u.roleId === ROLE_IDS.STUDENT).map((student: any) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-student-name-${student.id}`}>
                        {student.firstName} {student.lastName}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-student-email-${student.id}`}>
                      {student.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>
                      {student.createdAt ? 
                        new Date(student.createdAt).toLocaleDateString() : 
                        'Unknown'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedReport === 'teachers' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GraduationCap className="w-5 h-5 mr-2" />
              Teacher Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.filter((u: any) => u.roleId === ROLE_IDS.TEACHER).map((teacher: any) => (
                  <TableRow key={teacher.id} data-testid={`row-teacher-${teacher.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-teacher-name-${teacher.id}`}>
                        {teacher.firstName} {teacher.lastName}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-teacher-email-${teacher.id}`}>
                      {teacher.email}
                    </TableCell>
                    <TableCell>
                      {teacher.department || 'Not specified'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>
                      {teacher.createdAt ? 
                        new Date(teacher.createdAt).toLocaleDateString() : 
                        'Unknown'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedReport === 'classes' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <School className="w-5 h-5 mr-2" />
              Class Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Class Teacher</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls: any) => {
                  const teacher = users.find((u: any) => u.id === cls.classTeacherId);
                  return (
                    <TableRow key={cls.id} data-testid={`row-class-${cls.id}`}>
                      <TableCell>
                        <div className="font-medium" data-testid={`text-class-name-${cls.id}`}>
                          {cls.name}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-class-level-${cls.id}`}>
                        {cls.level || 'Not specified'}
                      </TableCell>
                      <TableCell data-testid={`text-class-capacity-${cls.id}`}>
                        {cls.capacity || 0}
                      </TableCell>
                      <TableCell>
                        {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Not assigned'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}