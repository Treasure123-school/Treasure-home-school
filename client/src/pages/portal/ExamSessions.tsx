
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { 
  Clock, 
  User, 
  BookOpen, 
  Play, 
  Pause, 
  CheckCircle,
  AlertTriangle,
  Search,
  Eye,
  Filter,
  Activity,
  Timer,
  Users
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ExamSession {
  id: number;
  examId: number;
  examTitle: string;
  studentId: string;
  studentName: string;
  startedAt: string;
  endTime?: string;
  isCompleted: boolean;
  timeRemaining?: number;
  status: 'in_progress' | 'submitted' | 'auto_scored' | 'grading' | 'finalized';
  score?: number;
  maxScore?: number;
  answeredQuestions: number;
  totalQuestions: number;
  lastActivity?: string;
}
export default function ExamSessions() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);

  // Fetch exam sessions
  const { data: sessions = [], isLoading, refetch } = useQuery<ExamSession[]>({
    queryKey: ['/api/exam-sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exam-sessions');
      if (!response.ok) throw new Error('Failed to fetch exam sessions');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time monitoring
  });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = searchTerm === '' || 
      session.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.examTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'in_progress': { label: 'In Progress', variant: 'default' as const, icon: Play },
      'submitted': { label: 'Submitted', variant: 'secondary' as const, icon: CheckCircle },
      'auto_scored': { label: 'Auto Scored', variant: 'default' as const, icon: CheckCircle },
      'grading': { label: 'Manual Grading', variant: 'destructive' as const, icon: Clock },
      'finalized': { label: 'Finalized', variant: 'default' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.in_progress;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="text-xs">
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Time up';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (answered: number, total: number) => {
    return total > 0 ? Math.round((answered / total) * 100) : 0;
  };

  const activeSessionsCount = sessions.filter(s => s.status === 'in_progress').length;
  const completedSessionsCount = sessions.filter(s => s.isCompleted).length;
  const averageProgress = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + getProgressPercentage(s.answeredQuestions, s.totalQuestions), 0) / sessions.length)
    : 0;

  if (!user) {
    return <div>Please log in to access exam sessions.</div>;
  }
  // Map roleId to role name - matches ROLE_IDS in lib/roles.ts
  const getRoleName = (roleId: number): 'admin' | 'teacher' | 'parent' | 'student' => {
    const roleMap: { [key: number]: 'admin' | 'teacher' | 'parent' | 'student' } = {
      1: 'admin',     // Super Admin
      2: 'admin',     // Admin
      3: 'teacher',   // Teacher
      4: 'student',   // Student
      5: 'parent'     // Parent
    };
    return roleMap[roleId] || 'admin';
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Active Exam Sessions</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Monitor ongoing and completed exam sessions in real-time</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="default" className="text-sm">
              <Activity className="w-4 h-4 mr-1" />
              Live Monitoring
            </Badge>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
                  <p className="text-2xl font-bold text-green-600">{activeSessionsCount}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold text-blue-600">{completedSessionsCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Progress</p>
                  <p className="text-2xl font-bold text-purple-600">{averageProgress}%</p>
                </div>
                <Timer className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="auto_scored">Auto Scored</SelectItem>
                    <SelectItem value="grading">Manual Grading</SelectItem>
                    <SelectItem value="finalized">Finalized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or exam title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Exam Sessions ({filteredSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading sessions...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No exam sessions found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Time Remaining</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{session.studentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span>{session.examTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(session.status)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {session.answeredQuestions}/{session.totalQuestions}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getProgressPercentage(session.answeredQuestions, session.totalQuestions)}%
                            </Badge>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full" 
                              style={{ 
                                width: `${getProgressPercentage(session.answeredQuestions, session.totalQuestions)}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span className={`text-sm ${
                            session.timeRemaining && session.timeRemaining < 300 
                              ? 'text-red-600 font-medium' 
                              : ''
                          }`}>
                            {formatTimeRemaining(session.timeRemaining)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.score !== undefined && session.maxScore ? (
                          <Badge variant="outline">
                            {session.score}/{session.maxScore}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(session.startedAt).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSession(session)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
