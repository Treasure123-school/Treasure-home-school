import fs from 'fs';
import path from 'path';

interface TestResult {
  endpoint: string;
  method: string;
  role?: string;
  duration: number;
  requests: {
    total: number;
    average: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
  latency: {
    average: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
  throughput: {
    average: number;
  };
  errors: number;
  status2xx?: number;
  status4xx?: number;
  status5xx?: number;
}

interface WebSocketMetrics {
  role: string;
  connections: {
    attempted: number;
    successful: number;
    failed: number;
  };
  events: {
    sent: number;
    received: number;
    errors: number;
  };
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  duration: number;
}

interface LoadTestReport {
  timestamp: string;
  summary: {
    totalEndpointsTested: number;
    totalRequests: number;
    overallAverageLatency: number;
    overallErrorRate: number;
    maxRPS: number;
    websocketConnectionsAttempted: number;
    websocketConnectionsSuccessful: number;
  };
  publicEndpoints: TestResult[];
  authenticatedEndpoints: TestResult[];
  websocketTests: WebSocketMetrics[];
  bottlenecks: BottleneckInfo[];
  recommendations: string[];
}

interface BottleneckInfo {
  severity: 'critical' | 'warning' | 'info';
  endpoint: string;
  issue: string;
  metrics: {
    latency?: number;
    errorRate?: number;
    rps?: number;
  };
}

function identifyBottlenecks(
  publicResults: TestResult[],
  authResults: TestResult[],
  wsResults: WebSocketMetrics[]
): BottleneckInfo[] {
  const bottlenecks: BottleneckInfo[] = [];

  const allApiResults = [...publicResults, ...authResults];
  
  for (const result of allApiResults) {
    if (result.latency.average > 500) {
      bottlenecks.push({
        severity: result.latency.average > 1000 ? 'critical' : 'warning',
        endpoint: `${result.method} ${result.endpoint}`,
        issue: `High average latency: ${result.latency.average.toFixed(0)}ms`,
        metrics: { latency: result.latency.average },
      });
    }

    if (result.latency.p99 && result.latency.p99 > 2000) {
      bottlenecks.push({
        severity: 'warning',
        endpoint: `${result.method} ${result.endpoint}`,
        issue: `High p99 latency: ${result.latency.p99.toFixed(0)}ms`,
        metrics: { latency: result.latency.p99 },
      });
    }

    const errorRate = result.errors / (result.requests.total || 1);
    if (errorRate > 0.01) {
      bottlenecks.push({
        severity: errorRate > 0.05 ? 'critical' : 'warning',
        endpoint: `${result.method} ${result.endpoint}`,
        issue: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        metrics: { errorRate: errorRate * 100 },
      });
    }

    if (result.status5xx && result.status5xx > 0) {
      bottlenecks.push({
        severity: 'critical',
        endpoint: `${result.method} ${result.endpoint}`,
        issue: `Server errors detected: ${result.status5xx} responses`,
        metrics: {},
      });
    }
  }

  for (const ws of wsResults) {
    const failRate = ws.connections.failed / ws.connections.attempted;
    if (failRate > 0.1) {
      bottlenecks.push({
        severity: failRate > 0.25 ? 'critical' : 'warning',
        endpoint: `WebSocket (${ws.role})`,
        issue: `High connection failure rate: ${(failRate * 100).toFixed(1)}%`,
        metrics: { errorRate: failRate * 100 },
      });
    }

    if (ws.latency.average > 200) {
      bottlenecks.push({
        severity: 'warning',
        endpoint: `WebSocket (${ws.role})`,
        issue: `High WebSocket latency: ${ws.latency.average.toFixed(0)}ms`,
        metrics: { latency: ws.latency.average },
      });
    }
  }

  return bottlenecks.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function generateRecommendations(bottlenecks: BottleneckInfo[]): string[] {
  const recommendations: string[] = [];

  const hasHighLatency = bottlenecks.some(b => b.metrics.latency && b.metrics.latency > 500);
  const hasHighErrors = bottlenecks.some(b => b.metrics.errorRate && b.metrics.errorRate > 5);
  const hasWsIssues = bottlenecks.some(b => b.endpoint.includes('WebSocket'));
  
  if (hasHighLatency) {
    recommendations.push(
      'DATABASE: Add indexes to frequently queried columns. Review slow query logs.',
      'CACHING: Implement Redis/memory caching for frequently accessed data.',
      'QUERY OPTIMIZATION: Use pagination, limit result sets, avoid N+1 queries.',
      'CONNECTION POOLING: Increase database connection pool size if connections are saturated.'
    );
  }

  if (hasHighErrors) {
    recommendations.push(
      'ERROR HANDLING: Implement retry logic with exponential backoff.',
      'RATE LIMITING: Add rate limiting to prevent server overload.',
      'RESOURCE LIMITS: Increase server memory/CPU or implement horizontal scaling.',
      'TIMEOUT CONFIGURATION: Adjust request timeouts based on operation complexity.'
    );
  }

  if (hasWsIssues) {
    recommendations.push(
      'WEBSOCKET SCALING: Consider using Redis adapter for Socket.IO in multi-instance deployments.',
      'CONNECTION LIMITS: Implement per-user connection limits to prevent resource exhaustion.',
      'HEARTBEAT TUNING: Adjust ping/pong intervals for optimal connection stability.',
      'MESSAGE BATCHING: Batch multiple small messages to reduce overhead.'
    );
  }

  recommendations.push(
    'COMPRESSION: Enable gzip/brotli compression for API responses.',
    'CDN: Serve static assets through a CDN to reduce server load.',
    'MONITORING: Set up APM tools (DataDog, New Relic) for production monitoring.',
    'LOAD BALANCING: Deploy multiple instances behind a load balancer for 500+ concurrent users.'
  );

  return [...new Set(recommendations)];
}

export function generateReport(
  publicResults: TestResult[],
  authResults: TestResult[],
  wsResults: WebSocketMetrics[]
): LoadTestReport {
  const allResults = [...publicResults, ...authResults];
  
  const totalRequests = allResults.reduce((sum, r) => sum + r.requests.total, 0);
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors, 0);
  const avgLatencies = allResults.map(r => r.latency.average);
  const rpsValues = allResults.map(r => r.requests.average);

  const bottlenecks = identifyBottlenecks(publicResults, authResults, wsResults);
  const recommendations = generateRecommendations(bottlenecks);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalEndpointsTested: allResults.length,
      totalRequests,
      overallAverageLatency: avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length || 0,
      overallErrorRate: (totalErrors / totalRequests) * 100 || 0,
      maxRPS: Math.max(...rpsValues, 0),
      websocketConnectionsAttempted: wsResults.reduce((sum, w) => sum + w.connections.attempted, 0),
      websocketConnectionsSuccessful: wsResults.reduce((sum, w) => sum + w.connections.successful, 0),
    },
    publicEndpoints: publicResults,
    authenticatedEndpoints: authResults,
    websocketTests: wsResults,
    bottlenecks,
    recommendations,
  };
}

export function formatReportAsMarkdown(report: LoadTestReport): string {
  let md = `# Load Test Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;

  md += `## Executive Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Endpoints Tested | ${report.summary.totalEndpointsTested} |\n`;
  md += `| Total Requests | ${report.summary.totalRequests.toLocaleString()} |\n`;
  md += `| Average Latency | ${report.summary.overallAverageLatency.toFixed(2)}ms |\n`;
  md += `| Error Rate | ${report.summary.overallErrorRate.toFixed(4)}% |\n`;
  md += `| Max RPS Achieved | ${report.summary.maxRPS.toFixed(0)} |\n`;
  md += `| WebSocket Connections | ${report.summary.websocketConnectionsSuccessful}/${report.summary.websocketConnectionsAttempted} |\n\n`;

  md += `## Public Endpoints\n\n`;
  md += `| Endpoint | Method | RPS | Avg Latency | p99 Latency | Errors |\n`;
  md += `|----------|--------|-----|-------------|-------------|--------|\n`;
  for (const r of report.publicEndpoints) {
    md += `| ${r.endpoint} | ${r.method} | ${r.requests.average.toFixed(0)} | ${r.latency.average.toFixed(1)}ms | ${r.latency.p99?.toFixed(1) || 'N/A'}ms | ${r.errors} |\n`;
  }
  md += `\n`;

  md += `## Authenticated Endpoints\n\n`;
  const groupedByEndpoint = new Map<string, TestResult[]>();
  for (const r of report.authenticatedEndpoints) {
    const key = `${r.method} ${r.endpoint}`;
    if (!groupedByEndpoint.has(key)) groupedByEndpoint.set(key, []);
    groupedByEndpoint.get(key)!.push(r);
  }

  for (const [endpoint, results] of groupedByEndpoint) {
    md += `### ${endpoint}\n\n`;
    md += `| Role | RPS | Avg Latency | p99 Latency | Errors |\n`;
    md += `|------|-----|-------------|-------------|--------|\n`;
    for (const r of results) {
      md += `| ${r.role || 'N/A'} | ${r.requests.average.toFixed(0)} | ${r.latency.average.toFixed(1)}ms | ${r.latency.p99?.toFixed(1) || 'N/A'}ms | ${r.errors} |\n`;
    }
    md += `\n`;
  }

  md += `## WebSocket Performance\n\n`;
  md += `| Role | Connections | Success Rate | Avg Latency | p99 Latency |\n`;
  md += `|------|-------------|--------------|-------------|-------------|\n`;
  for (const ws of report.websocketTests) {
    const successRate = ((ws.connections.successful / ws.connections.attempted) * 100).toFixed(1);
    md += `| ${ws.role} | ${ws.connections.successful}/${ws.connections.attempted} | ${successRate}% | ${ws.latency.average.toFixed(1)}ms | ${ws.latency.p99.toFixed(1)}ms |\n`;
  }
  md += `\n`;

  if (report.bottlenecks.length > 0) {
    md += `## Identified Bottlenecks\n\n`;
    for (const b of report.bottlenecks) {
      const icon = b.severity === 'critical' ? '🔴' : b.severity === 'warning' ? '🟡' : '🔵';
      md += `- ${icon} **${b.endpoint}**: ${b.issue}\n`;
    }
    md += `\n`;
  }

  md += `## Recommendations\n\n`;
  for (const rec of report.recommendations) {
    md += `- ${rec}\n`;
  }
  md += `\n`;

  md += `## Test Environment\n\n`;
  md += `- **Date:** ${new Date().toLocaleDateString()}\n`;
  md += `- **Platform:** Node.js ${process.version}\n`;
  md += `- **Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\n`;

  return md;
}

export function saveReport(report: LoadTestReport, outputPath: string): void {
  const markdown = formatReportAsMarkdown(report);
  const jsonPath = outputPath.replace('.md', '.json');
  
  fs.writeFileSync(outputPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Report saved to: ${outputPath}`);
  console.log(`📊 JSON data saved to: ${jsonPath}`);
}
