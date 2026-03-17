#!/usr/bin/env npx tsx

import { runPublicEndpointTests, runStressTest, PUBLIC_ENDPOINTS } from './public-endpoints';
import { runAuthenticatedEndpointTests, runRoleBasedStressTest } from './authenticated-endpoints';
import { runWebSocketLoadTest, runWebSocketStressTest } from './websocket-tests';
import { generateReport, formatReportAsMarkdown, saveReport } from './report-generator';

interface LoadTestConfig {
  publicTest: {
    enabled: boolean;
    connections: number;
    duration: number;
  };
  authTest: {
    enabled: boolean;
    connections: number;
    duration: number;
  };
  websocketTest: {
    enabled: boolean;
    connectionsPerRole: number;
    duration: number;
  };
  stressTest: {
    enabled: boolean;
    maxConnections: number;
    stepSize: number;
  };
}

const DEFAULT_CONFIG: LoadTestConfig = {
  publicTest: {
    enabled: true,
    connections: 100,
    duration: 10,
  },
  authTest: {
    enabled: true,
    connections: 50,
    duration: 10,
  },
  websocketTest: {
    enabled: true,
    connectionsPerRole: 20,
    duration: 15000,
  },
  stressTest: {
    enabled: true,
    maxConnections: 500,
    stepSize: 100,
  },
};

async function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                    SCHOOL PORTAL LOAD TEST                        ║
║                   Comprehensive Performance Analysis              ║
╚═══════════════════════════════════════════════════════════════════╝
`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Target: http://localhost:5000`);
  console.log('─'.repeat(70));
}

async function runComprehensiveLoadTest(config: LoadTestConfig = DEFAULT_CONFIG) {
  await printBanner();

  const startTime = Date.now();
  
  let publicResults: any[] = [];
  let authResults: any[] = [];
  let wsResults: any[] = [];

  if (config.publicTest.enabled) {
    console.log('\n\n╔═══════════════════════════════════════╗');
    console.log('║      PHASE 1: PUBLIC ENDPOINTS        ║');
    console.log('╚═══════════════════════════════════════╝');
    
    publicResults = await runPublicEndpointTests(
      config.publicTest.connections,
      config.publicTest.duration
    );
  }

  if (config.authTest.enabled) {
    console.log('\n\n╔═══════════════════════════════════════╗');
    console.log('║   PHASE 2: AUTHENTICATED ENDPOINTS    ║');
    console.log('╚═══════════════════════════════════════╝');
    
    authResults = await runAuthenticatedEndpointTests(
      config.authTest.connections,
      config.authTest.duration
    );
  }

  if (config.websocketTest.enabled) {
    console.log('\n\n╔═══════════════════════════════════════╗');
    console.log('║     PHASE 3: WEBSOCKET CONNECTIONS    ║');
    console.log('╚═══════════════════════════════════════╝');
    
    wsResults = await runWebSocketLoadTest(
      config.websocketTest.connectionsPerRole,
      config.websocketTest.duration
    );
  }

  if (config.stressTest.enabled) {
    console.log('\n\n╔═══════════════════════════════════════╗');
    console.log('║        PHASE 4: STRESS TESTING        ║');
    console.log('╚═══════════════════════════════════════╝');

    console.log('\n📈 Public Endpoint Stress Test:');
    const healthEndpoint = PUBLIC_ENDPOINTS.find(e => e.path === '/api/health');
    if (healthEndpoint) {
      await runStressTest(
        healthEndpoint,
        config.stressTest.maxConnections,
        config.stressTest.stepSize,
        5
      );
    }

    console.log('\n📈 WebSocket Stress Test:');
    await runWebSocketStressTest(
      Math.floor(config.stressTest.maxConnections / 5),
      Math.floor(config.stressTest.stepSize / 5)
    );
  }

  const endTime = Date.now();
  const totalDuration = (endTime - startTime) / 1000;

  console.log('\n\n╔═══════════════════════════════════════╗');
  console.log('║          GENERATING REPORT            ║');
  console.log('╚═══════════════════════════════════════╝');

  const report = generateReport(publicResults, authResults, wsResults);
  
  const reportPath = `server/load-tests/reports/load-test-report-${Date.now()}.md`;
  const fs = await import('fs');
  const path = await import('path');
  
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  saveReport(report, reportPath);

  console.log('\n\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                       TEST COMPLETE                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`\nTotal Duration: ${totalDuration.toFixed(1)} seconds`);
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Endpoints Tested: ${report.summary.totalEndpointsTested}`);
  console.log(`   Total Requests: ${report.summary.totalRequests.toLocaleString()}`);
  console.log(`   Average Latency: ${report.summary.overallAverageLatency.toFixed(2)}ms`);
  console.log(`   Error Rate: ${report.summary.overallErrorRate.toFixed(4)}%`);
  console.log(`   Max RPS: ${report.summary.maxRPS.toFixed(0)}`);
  console.log(`   WebSocket Success: ${report.summary.websocketConnectionsSuccessful}/${report.summary.websocketConnectionsAttempted}`);

  if (report.bottlenecks.length > 0) {
    console.log(`\n⚠️  BOTTLENECKS IDENTIFIED: ${report.bottlenecks.length}`);
    const critical = report.bottlenecks.filter(b => b.severity === 'critical');
    const warnings = report.bottlenecks.filter(b => b.severity === 'warning');
    if (critical.length > 0) console.log(`   🔴 Critical: ${critical.length}`);
    if (warnings.length > 0) console.log(`   🟡 Warnings: ${warnings.length}`);
  }

  console.log(`\n📄 Full report: ${reportPath}`);

  return report;
}

async function runQuickTest() {
  console.log('\n🚀 Running Quick Load Test (reduced scope)...\n');
  
  return runComprehensiveLoadTest({
    publicTest: { enabled: true, connections: 50, duration: 5 },
    authTest: { enabled: true, connections: 25, duration: 5 },
    websocketTest: { enabled: true, connectionsPerRole: 10, duration: 10000 },
    stressTest: { enabled: false, maxConnections: 200, stepSize: 50 },
  });
}

async function runFullTest() {
  console.log('\n🔥 Running Full Load Test (comprehensive)...\n');
  
  return runComprehensiveLoadTest({
    publicTest: { enabled: true, connections: 200, duration: 15 },
    authTest: { enabled: true, connections: 100, duration: 15 },
    websocketTest: { enabled: true, connectionsPerRole: 50, duration: 30000 },
    stressTest: { enabled: true, maxConnections: 1000, stepSize: 200 },
  });
}

const args = process.argv.slice(2);
const mode = args[0] || 'quick';

if (mode === 'full') {
  runFullTest().catch(console.error);
} else if (mode === 'quick') {
  runQuickTest().catch(console.error);
} else {
  console.log('Usage: npx tsx server/load-tests/run-load-test.ts [quick|full]');
  console.log('  quick - Fast test with reduced scope (default)');
  console.log('  full  - Comprehensive test with stress testing');
}

export { runComprehensiveLoadTest, runQuickTest, runFullTest };
