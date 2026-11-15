/**
 * Load Testing Harness for School Portal
 * 
 * Comprehensive load testing framework for simulating concurrent users
 * performing typical actions like login, exam taking, viewing results, etc.
 * 
 * Usage:
 *   npx tsx server/load-test-harness.ts
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

interface TestResult {
  name: string;
  success: boolean;
  durationMs: number;
  statusCode: number;
  error?: string;
}

interface LoadTestScenario {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  expectedStatus?: number;
  weight?: number; // Probability weight for random selection
}

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDurationSeconds: number;
  rampUpSeconds: number;
  scenarios: LoadTestScenario[];
  authToken?: string;
}

interface LoadTestReport {
  startTime: Date;
  endTime: Date;
  totalDurationMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  slowestResponseTimeMs: number;
  fastestResponseTimeMs: number;
  errorsByType: Record<string, number>;
  resultsByEndpoint: Record<string, {
    count: number;
    avgMs: number;
    p95Ms: number;
    errors: number;
  }>;
}

class LoadTestHarness {
  private config: LoadTestConfig;
  private results: TestResult[] = [];
  private isRunning = false;
  private activeUsers = 0;
  private startTime: Date | null = null;
  
  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  /**
   * Execute HTTP request
   */
  private async makeRequest(scenario: LoadTestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const url = new URL(scenario.endpoint, this.config.baseUrl);
    
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: scenario.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(this.config.authToken ? { 'Authorization': `Bearer ${this.config.authToken}` } : {}),
        ...scenario.headers
      },
      timeout: 30000,
    };

    return new Promise((resolve) => {
      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const success = scenario.expectedStatus 
            ? res.statusCode === scenario.expectedStatus 
            : (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300;
          
          resolve({
            name: scenario.name,
            success,
            durationMs,
            statusCode: res.statusCode || 0,
            error: success ? undefined : `Status ${res.statusCode}`
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          name: scenario.name,
          success: false,
          durationMs: Date.now() - startTime,
          statusCode: 0,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name: scenario.name,
          success: false,
          durationMs: Date.now() - startTime,
          statusCode: 0,
          error: 'Timeout'
        });
      });

      if (scenario.body) {
        req.write(JSON.stringify(scenario.body));
      }
      
      req.end();
    });
  }

  /**
   * Select random scenario based on weights
   */
  private selectScenario(): LoadTestScenario {
    const scenarios = this.config.scenarios;
    const totalWeight = scenarios.reduce((sum, s) => sum + (s.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const scenario of scenarios) {
      random -= (scenario.weight || 1);
      if (random <= 0) {
        return scenario;
      }
    }
    
    return scenarios[0];
  }

  /**
   * Simulate single user behavior
   */
  private async simulateUser(userId: number): Promise<void> {
    this.activeUsers++;
    const testEndTime = this.startTime!.getTime() + (this.config.testDurationSeconds * 1000);
    
    while (this.isRunning && Date.now() < testEndTime) {
      const scenario = this.selectScenario();
      const result = await this.makeRequest(scenario);
      this.results.push(result);
      
      // Random delay between requests (100-500ms) to simulate real user behavior
      await this.delay(100 + Math.random() * 400);
    }
    
    this.activeUsers--;
  }

  /**
   * Run load test
   */
  async run(): Promise<LoadTestReport> {
    console.log('\n🚀 Starting Load Test');
    console.log(`   Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`   Duration: ${this.config.testDurationSeconds}s`);
    console.log(`   Ramp-up: ${this.config.rampUpSeconds}s`);
    console.log(`   Base URL: ${this.config.baseUrl}`);
    console.log(`   Scenarios: ${this.config.scenarios.length}`);
    console.log('');

    this.isRunning = true;
    this.startTime = new Date();
    this.results = [];

    // Ramp up users gradually
    const rampUpDelay = (this.config.rampUpSeconds * 1000) / this.config.concurrentUsers;
    const userPromises: Promise<void>[] = [];

    for (let i = 0; i < this.config.concurrentUsers; i++) {
      await this.delay(rampUpDelay);
      userPromises.push(this.simulateUser(i));
      
      if ((i + 1) % 10 === 0 || i === this.config.concurrentUsers - 1) {
        console.log(`   Started ${i + 1}/${this.config.concurrentUsers} virtual users`);
      }
    }

    console.log('\n📊 Test running...\n');

    // Progress updates
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime!.getTime()) / 1000;
      const progress = Math.min(100, (elapsed / this.config.testDurationSeconds) * 100);
      const successful = this.results.filter(r => r.success).length;
      const failed = this.results.filter(r => !r.success).length;
      console.log(`   Progress: ${progress.toFixed(1)}% | Requests: ${this.results.length} (${successful} OK, ${failed} ERR) | Active Users: ${this.activeUsers}`);
    }, 5000);

    // Wait for test duration
    await Promise.all(userPromises);
    
    clearInterval(progressInterval);
    this.isRunning = false;
    
    const endTime = new Date();
    return this.generateReport(endTime);
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(endTime: Date): LoadTestReport {
    const totalDurationMs = endTime.getTime() - this.startTime!.getTime();
    const responseTimes = this.results.map(r => r.durationMs).sort((a, b) => a - b);
    
    // Calculate percentiles
    const p50 = this.percentile(responseTimes, 50);
    const p95 = this.percentile(responseTimes, 95);
    const p99 = this.percentile(responseTimes, 99);
    
    // Calculate error breakdown
    const errorsByType: Record<string, number> = {};
    for (const result of this.results.filter(r => !r.success)) {
      const errorKey = result.error || 'Unknown';
      errorsByType[errorKey] = (errorsByType[errorKey] || 0) + 1;
    }

    // Calculate per-endpoint statistics
    const resultsByEndpoint: Record<string, { count: number; avgMs: number; p95Ms: number; errors: number }> = {};
    const endpointResults: Record<string, TestResult[]> = {};
    
    for (const result of this.results) {
      if (!endpointResults[result.name]) {
        endpointResults[result.name] = [];
      }
      endpointResults[result.name].push(result);
    }
    
    for (const [name, results] of Object.entries(endpointResults)) {
      const times = results.map(r => r.durationMs).sort((a, b) => a - b);
      resultsByEndpoint[name] = {
        count: results.length,
        avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        p95Ms: this.percentile(times, 95),
        errors: results.filter(r => !r.success).length
      };
    }

    const report: LoadTestReport = {
      startTime: this.startTime!,
      endTime,
      totalDurationMs,
      totalRequests: this.results.length,
      successfulRequests: this.results.filter(r => r.success).length,
      failedRequests: this.results.filter(r => !r.success).length,
      requestsPerSecond: Math.round((this.results.length / totalDurationMs) * 1000 * 100) / 100,
      avgResponseTimeMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      p50ResponseTimeMs: p50,
      p95ResponseTimeMs: p95,
      p99ResponseTimeMs: p99,
      slowestResponseTimeMs: responseTimes[responseTimes.length - 1] || 0,
      fastestResponseTimeMs: responseTimes[0] || 0,
      errorsByType,
      resultsByEndpoint
    };

    this.printReport(report);
    return report;
  }

  /**
   * Print formatted report
   */
  private printReport(report: LoadTestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('                    LOAD TEST REPORT');
    console.log('='.repeat(60) + '\n');

    console.log('📈 SUMMARY');
    console.log('─'.repeat(40));
    console.log(`  Duration:        ${(report.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`  Total Requests:  ${report.totalRequests}`);
    console.log(`  Successful:      ${report.successfulRequests} (${((report.successfulRequests / report.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Failed:          ${report.failedRequests} (${((report.failedRequests / report.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Requests/sec:    ${report.requestsPerSecond}`);

    console.log('\n⏱️  RESPONSE TIMES');
    console.log('─'.repeat(40));
    console.log(`  Average:         ${report.avgResponseTimeMs}ms`);
    console.log(`  P50 (Median):    ${report.p50ResponseTimeMs}ms`);
    console.log(`  P95:             ${report.p95ResponseTimeMs}ms`);
    console.log(`  P99:             ${report.p99ResponseTimeMs}ms`);
    console.log(`  Fastest:         ${report.fastestResponseTimeMs}ms`);
    console.log(`  Slowest:         ${report.slowestResponseTimeMs}ms`);

    if (Object.keys(report.errorsByType).length > 0) {
      console.log('\n❌ ERRORS');
      console.log('─'.repeat(40));
      for (const [error, count] of Object.entries(report.errorsByType)) {
        console.log(`  ${error}: ${count}`);
      }
    }

    console.log('\n📊 BY ENDPOINT');
    console.log('─'.repeat(40));
    const sortedEndpoints = Object.entries(report.resultsByEndpoint)
      .sort((a, b) => b[1].p95Ms - a[1].p95Ms);
    
    for (const [name, stats] of sortedEndpoints) {
      const errorRate = ((stats.errors / stats.count) * 100).toFixed(1);
      console.log(`  ${name}:`);
      console.log(`    Count: ${stats.count} | Avg: ${stats.avgMs}ms | P95: ${stats.p95Ms}ms | Errors: ${stats.errors} (${errorRate}%)`);
    }

    // Performance assessment
    console.log('\n🎯 PERFORMANCE ASSESSMENT');
    console.log('─'.repeat(40));
    
    const p95Target = 500; // 500ms target for P95
    const errorRateTarget = 1; // 1% error rate target
    
    const actualErrorRate = (report.failedRequests / report.totalRequests) * 100;
    
    if (report.p95ResponseTimeMs <= p95Target && actualErrorRate <= errorRateTarget) {
      console.log('  ✅ PASSED - System performs well under load');
    } else {
      console.log('  ⚠️  NEEDS OPTIMIZATION');
      if (report.p95ResponseTimeMs > p95Target) {
        console.log(`     - P95 response time (${report.p95ResponseTimeMs}ms) exceeds ${p95Target}ms target`);
      }
      if (actualErrorRate > errorRateTarget) {
        console.log(`     - Error rate (${actualErrorRate.toFixed(2)}%) exceeds ${errorRateTarget}% target`);
      }
    }

    // Identify slowest endpoints
    if (sortedEndpoints.length > 0) {
      console.log('\n  🐢 Top 5 Slowest Endpoints (by P95):');
      for (const [name, stats] of sortedEndpoints.slice(0, 5)) {
        console.log(`     - ${name}: ${stats.p95Ms}ms`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== PREDEFINED SCENARIOS ====================

const defaultScenarios: LoadTestScenario[] = [
  // High frequency endpoints
  { name: 'Health Check', endpoint: '/api/health', method: 'GET', weight: 5 },
  { name: 'Get Classes', endpoint: '/api/classes', method: 'GET', weight: 10 },
  { name: 'Get Subjects', endpoint: '/api/subjects', method: 'GET', weight: 10 },
  { name: 'Get Terms', endpoint: '/api/terms', method: 'GET', weight: 5 },
  
  // Auth endpoints (simulated - will return 401 without valid token)
  { name: 'Auth Me', endpoint: '/api/auth/me', method: 'GET', weight: 15, expectedStatus: 401 },
  
  // Dashboard data
  { name: 'Get Announcements', endpoint: '/api/announcements', method: 'GET', weight: 8 },
  { name: 'Homepage Content', endpoint: '/api/homepage', method: 'GET', weight: 8 },
  
  // Exam endpoints (will return 401 without auth)
  { name: 'Get Exams', endpoint: '/api/exams', method: 'GET', weight: 12, expectedStatus: 401 },
  
  // Report cards (will return 401 without auth)
  { name: 'Get Report Cards', endpoint: '/api/reports', method: 'GET', weight: 8, expectedStatus: 401 },
  
  // Notifications (will return 401 without auth)
  { name: 'Get Notifications', endpoint: '/api/notifications', method: 'GET', weight: 10, expectedStatus: 401 },
];

// ==================== MAIN EXECUTION ====================

async function runLoadTest() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const concurrentUsers = parseInt(process.env.LOAD_TEST_USERS || '50');
  const duration = parseInt(process.env.LOAD_TEST_DURATION || '60');
  
  const harness = new LoadTestHarness({
    baseUrl,
    concurrentUsers,
    testDurationSeconds: duration,
    rampUpSeconds: Math.min(10, duration / 3),
    scenarios: defaultScenarios
  });

  try {
    await harness.run();
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

// Export for use as module
export { LoadTestHarness, LoadTestConfig, LoadTestScenario, LoadTestReport };

// Run if executed directly
if (require.main === module) {
  runLoadTest();
}
