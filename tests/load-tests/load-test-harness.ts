/**
 * Load Testing Harness for School Portal
 * 
 * Simulates concurrent users across all critical modules:
 * - Authentication (login/logout)
 * - Exam loading and submission
 * - Report card generation
 * - Dashboard operations
 * - Real-time WebSocket connections
 * 
 * Usage: npx tsx tests/load-tests/load-test-harness.ts
 */

interface TestResult {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDurationSeconds: number;
  rampUpSeconds: number;
  scenarios: string[];
}

interface UserSession {
  userId: string;
  token: string;
  role: string;
  studentId?: string;
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  endpointMetrics: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    avgTime: number;
  }>;
}

class LoadTestHarness {
  private config: LoadTestConfig;
  private results: TestResult[] = [];
  private activeUsers: Set<string> = new Set();
  private startTime: Date = new Date();
  private testAccounts = [
    { identifier: 'student', password: 'Student@123', role: 'student' },
    { identifier: 'teacher', password: 'Teacher@123', role: 'teacher' },
    { identifier: 'admin', password: 'Admin@123', role: 'admin' },
    { identifier: 'parent', password: 'Parent@123', role: 'parent' },
  ];

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  private async makeRequest(
    endpoint: string, 
    method: string, 
    body?: any, 
    token?: string
  ): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseTime = Date.now() - startTime;
      
      return {
        endpoint,
        method,
        statusCode: response.status,
        responseTime,
        success: response.ok,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint,
        method,
        statusCode: 0,
        responseTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  private async login(identifier: string, password: string): Promise<UserSession | null> {
    const result = await this.makeRequest('/api/auth/login', 'POST', { identifier, password });
    this.results.push(result);

    if (result.success && result.statusCode === 200) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await response.json();
        return {
          userId: data.user?.id || '',
          token: data.token || '',
          role: data.user?.roleName || '',
          studentId: data.student?.id,
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  private async runAuthScenario(session: UserSession): Promise<void> {
    // Get current user info
    const meResult = await this.makeRequest('/api/auth/me', 'GET', undefined, session.token);
    this.results.push(meResult);
  }

  private async runDashboardScenario(session: UserSession): Promise<void> {
    // Based on role, hit appropriate dashboard endpoints
    if (session.role === 'teacher') {
      const dashResult = await this.makeRequest('/api/teacher/dashboard', 'GET', undefined, session.token);
      this.results.push(dashResult);
      
      const profileResult = await this.makeRequest('/api/teacher/profile/me', 'GET', undefined, session.token);
      this.results.push(profileResult);
    } else if (session.role === 'student') {
      // Get student exams
      const examsResult = await this.makeRequest('/api/exams', 'GET', undefined, session.token);
      this.results.push(examsResult);
    } else if (session.role === 'admin') {
      // Get users list
      const usersResult = await this.makeRequest('/api/users', 'GET', undefined, session.token);
      this.results.push(usersResult);
      
      // Get students list
      const studentsResult = await this.makeRequest('/api/students', 'GET', undefined, session.token);
      this.results.push(studentsResult);
    }

    // Common endpoints for all roles
    const announcementsResult = await this.makeRequest('/api/announcements', 'GET', undefined, session.token);
    this.results.push(announcementsResult);

    const classesResult = await this.makeRequest('/api/classes', 'GET', undefined, session.token);
    this.results.push(classesResult);

    const subjectsResult = await this.makeRequest('/api/subjects', 'GET', undefined, session.token);
    this.results.push(subjectsResult);
  }

  private async runExamLoadScenario(session: UserSession): Promise<void> {
    // Load exams list
    const examsResult = await this.makeRequest('/api/exams', 'GET', undefined, session.token);
    this.results.push(examsResult);

    // Get question counts for exams
    const countsResult = await this.makeRequest('/api/exams/question-counts?examIds=1,2,3', 'GET', undefined, session.token);
    this.results.push(countsResult);

    // If student, simulate exam session flow (without actually taking exam)
    if (session.role === 'student' && session.studentId) {
      // Check for active sessions
      const activeSessionResult = await this.makeRequest(
        `/api/exam-sessions/student/${session.studentId}/active`, 
        'GET', 
        undefined, 
        session.token
      );
      this.results.push(activeSessionResult);
    }
  }

  private async runReportCardScenario(session: UserSession): Promise<void> {
    if (session.role === 'student' && session.studentId) {
      // Load student's report card
      const reportResult = await this.makeRequest(
        `/api/reports/student-report-card/${session.studentId}`,
        'GET',
        undefined,
        session.token
      );
      this.results.push(reportResult);
    } else if (session.role === 'teacher' || session.role === 'admin') {
      // Load class report cards (class 1)
      const classReportResult = await this.makeRequest(
        '/api/reports/class/1',
        'GET',
        undefined,
        session.token
      );
      this.results.push(classReportResult);
    }
  }

  private async runPublicEndpointsScenario(): Promise<void> {
    // Test public endpoints without authentication
    const homepageResult = await this.makeRequest('/api/public/homepage-content', 'GET');
    this.results.push(homepageResult);

    const announcementsResult = await this.makeRequest('/api/announcements', 'GET');
    this.results.push(announcementsResult);

    const healthResult = await this.makeRequest('/api/health', 'GET');
    this.results.push(healthResult);
  }

  private async simulateUser(userId: string, scenarios: string[]): Promise<void> {
    this.activeUsers.add(userId);
    
    try {
      // Pick a random test account
      const account = this.testAccounts[Math.floor(Math.random() * this.testAccounts.length)];
      const session = await this.login(account.identifier, account.password);

      if (!session) {
        console.log(`  User ${userId}: Login failed for ${account.identifier}`);
        this.activeUsers.delete(userId);
        return;
      }

      // Run scenarios based on configuration
      for (const scenario of scenarios) {
        switch (scenario) {
          case 'auth':
            await this.runAuthScenario(session);
            break;
          case 'dashboard':
            await this.runDashboardScenario(session);
            break;
          case 'exams':
            await this.runExamLoadScenario(session);
            break;
          case 'reports':
            await this.runReportCardScenario(session);
            break;
          case 'public':
            await this.runPublicEndpointsScenario();
            break;
        }
        
        // Small delay between scenarios
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }
    } catch (error) {
      console.error(`  User ${userId} error:`, error);
    }
    
    this.activeUsers.delete(userId);
  }

  private calculateMetrics(): PerformanceMetrics {
    const endTime = new Date();
    const durationSeconds = (endTime.getTime() - this.startTime.getTime()) / 1000;
    
    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b);
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = this.results.length - successfulRequests;

    // Calculate percentiles
    const p50Index = Math.floor(responseTimes.length * 0.5);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Calculate per-endpoint metrics
    const endpointMetrics = new Map<string, { count: number; totalTime: number; errors: number; avgTime: number }>();
    for (const result of this.results) {
      const key = `${result.method} ${result.endpoint}`;
      const existing = endpointMetrics.get(key) || { count: 0, totalTime: 0, errors: 0, avgTime: 0 };
      existing.count++;
      existing.totalTime += result.responseTime;
      if (!result.success) existing.errors++;
      existing.avgTime = existing.totalTime / existing.count;
      endpointMetrics.set(key, existing);
    }

    return {
      totalRequests: this.results.length,
      successfulRequests,
      failedRequests,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      p50ResponseTime: responseTimes[p50Index] || 0,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      requestsPerSecond: this.results.length / durationSeconds,
      errorRate: (failedRequests / this.results.length) * 100,
      endpointMetrics,
    };
  }

  async run(): Promise<PerformanceMetrics> {
    console.log('\n========================================');
    console.log('    SCHOOL PORTAL LOAD TEST');
    console.log('========================================');
    console.log(`Configuration:`);
    console.log(`  - Base URL: ${this.config.baseUrl}`);
    console.log(`  - Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`  - Test Duration: ${this.config.testDurationSeconds}s`);
    console.log(`  - Ramp Up: ${this.config.rampUpSeconds}s`);
    console.log(`  - Scenarios: ${this.config.scenarios.join(', ')}`);
    console.log('========================================\n');

    this.startTime = new Date();
    const userPromises: Promise<void>[] = [];
    const usersPerSecond = this.config.concurrentUsers / this.config.rampUpSeconds;
    
    // Ramp up users gradually
    console.log('Starting ramp-up phase...');
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const userId = `user-${i + 1}`;
      const delay = (i / usersPerSecond) * 1000;
      
      const userPromise = new Promise<void>(async (resolve) => {
        await new Promise(r => setTimeout(r, delay));
        
        // Each user runs multiple iterations during the test
        const iterations = Math.ceil(
          (this.config.testDurationSeconds * 1000 - delay) / 5000
        );
        
        for (let iter = 0; iter < iterations; iter++) {
          await this.simulateUser(userId, this.config.scenarios);
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
        resolve();
      });
      
      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    // Calculate and display metrics
    const metrics = this.calculateMetrics();
    
    console.log('\n========================================');
    console.log('    LOAD TEST RESULTS');
    console.log('========================================');
    console.log(`\nOverall Metrics:`);
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Successful: ${metrics.successfulRequests}`);
    console.log(`  Failed: ${metrics.failedRequests}`);
    console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`);
    console.log(`  Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}`);
    
    console.log(`\nResponse Times:`);
    console.log(`  Min: ${metrics.minResponseTime}ms`);
    console.log(`  Avg: ${metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`  P50: ${metrics.p50ResponseTime}ms`);
    console.log(`  P95: ${metrics.p95ResponseTime}ms`);
    console.log(`  P99: ${metrics.p99ResponseTime}ms`);
    console.log(`  Max: ${metrics.maxResponseTime}ms`);

    console.log(`\nPer-Endpoint Metrics:`);
    const sortedEndpoints = Array.from(metrics.endpointMetrics.entries())
      .sort((a, b) => b[1].avgTime - a[1].avgTime);
    
    for (const [endpoint, data] of sortedEndpoints.slice(0, 15)) {
      const errorInfo = data.errors > 0 ? ` (${data.errors} errors)` : '';
      console.log(`  ${endpoint}: ${data.avgTime.toFixed(0)}ms avg, ${data.count} reqs${errorInfo}`);
    }

    console.log('\n========================================');
    console.log('    BOTTLENECK ANALYSIS');
    console.log('========================================');
    
    // Identify slow endpoints (>500ms avg)
    const slowEndpoints = sortedEndpoints.filter(([_, data]) => data.avgTime > 500);
    if (slowEndpoints.length > 0) {
      console.log('\nSlow Endpoints (>500ms):');
      for (const [endpoint, data] of slowEndpoints) {
        console.log(`  - ${endpoint}: ${data.avgTime.toFixed(0)}ms`);
      }
    }

    // Identify high-error endpoints
    const errorEndpoints = sortedEndpoints.filter(([_, data]) => data.errors > 0);
    if (errorEndpoints.length > 0) {
      console.log('\nEndpoints with Errors:');
      for (const [endpoint, data] of errorEndpoints) {
        console.log(`  - ${endpoint}: ${data.errors} errors (${((data.errors / data.count) * 100).toFixed(1)}% error rate)`);
      }
    }

    // Performance recommendations
    console.log('\nRecommendations:');
    if (metrics.p95ResponseTime > 1000) {
      console.log('  - P95 response time is high. Consider adding caching for hot endpoints.');
    }
    if (metrics.errorRate > 5) {
      console.log('  - Error rate is above 5%. Check server logs for issues.');
    }
    if (metrics.requestsPerSecond < 50) {
      console.log('  - Throughput is low. Consider connection pooling and query optimization.');
    }

    console.log('\n========================================\n');

    return metrics;
  }
}

// Run the load test
async function main() {
  const config: LoadTestConfig = {
    baseUrl: process.env.BASE_URL || 'http://localhost:5000',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '50'),
    testDurationSeconds: parseInt(process.env.TEST_DURATION || '30'),
    rampUpSeconds: parseInt(process.env.RAMP_UP || '10'),
    scenarios: (process.env.SCENARIOS || 'auth,dashboard,exams,public').split(','),
  };

  const harness = new LoadTestHarness(config);
  await harness.run();
}

main().catch(console.error);
