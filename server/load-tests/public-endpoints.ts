import autocannon from 'autocannon';

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  endpoint: string;
  method: string;
  duration: number;
  requests: {
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  errors: number;
  timeouts: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
}

export const PUBLIC_ENDPOINTS = [
  { path: '/api/health', method: 'GET', name: 'Health Check' },
  { path: '/api/public/homepage-content', method: 'GET', name: 'Homepage Content' },
  { path: '/api/announcements', method: 'GET', name: 'Public Announcements' },
  { path: '/api/vacancies', method: 'GET', name: 'Job Vacancies' },
];

async function runEndpointTest(
  endpoint: { path: string; method: string; name: string },
  options: { connections: number; duration: number; pipelining: number }
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: `${BASE_URL}${endpoint.path}`,
      connections: options.connections,
      duration: options.duration,
      pipelining: options.pipelining,
      method: endpoint.method as 'GET',
    }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const testResult: TestResult = {
        endpoint: endpoint.path,
        method: endpoint.method,
        duration: options.duration,
        requests: {
          total: result.requests.total,
          average: result.requests.average,
          min: result.requests.min,
          max: result.requests.max,
          p50: result.requests.p50,
          p95: result.requests.p95,
          p99: result.requests.p99,
        },
        latency: {
          average: result.latency.average,
          min: result.latency.min,
          max: result.latency.max,
          p50: result.latency.p50,
          p95: result.latency.p95,
          p99: result.latency.p99,
        },
        throughput: {
          average: result.throughput.average,
          total: result.throughput.total,
        },
        errors: result.errors,
        timeouts: result.timeouts,
        status2xx: result['2xx'] || 0,
        status4xx: result['4xx'] || 0,
        status5xx: result['5xx'] || 0,
      };

      resolve(testResult);
    });

    autocannon.track(instance, { renderProgressBar: false });
  });
}

export async function runPublicEndpointTests(
  connections: number = 100,
  duration: number = 10
): Promise<TestResult[]> {
  console.log('\n📡 Testing Public Endpoints\n');
  console.log(`   Connections: ${connections}`);
  console.log(`   Duration: ${duration}s per endpoint\n`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (const endpoint of PUBLIC_ENDPOINTS) {
    console.log(`\n   Testing: ${endpoint.name} (${endpoint.path})`);
    
    try {
      const result = await runEndpointTest(endpoint, {
        connections,
        duration,
        pipelining: 1,
      });
      
      results.push(result);
      
      console.log(`   ✅ Completed: ${result.requests.total} requests`);
      console.log(`      Avg Latency: ${result.latency.average.toFixed(2)}ms`);
      console.log(`      Throughput: ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
      console.log(`      Errors: ${result.errors}`);
    } catch (error) {
      console.log(`   ❌ Error testing ${endpoint.name}:`, error);
    }
  }

  return results;
}

export async function runStressTest(
  endpoint: { path: string; method: string; name: string },
  maxConnections: number = 500,
  stepSize: number = 100,
  stepDuration: number = 5
): Promise<{ connectionLevel: number; result: TestResult }[]> {
  console.log(`\n🔥 Stress Test: ${endpoint.name}`);
  console.log(`   Max Connections: ${maxConnections}`);
  console.log(`   Step Size: ${stepSize}`);
  console.log('─'.repeat(60));

  const stressResults: { connectionLevel: number; result: TestResult }[] = [];

  for (let connections = stepSize; connections <= maxConnections; connections += stepSize) {
    console.log(`\n   Testing with ${connections} connections...`);
    
    try {
      const result = await runEndpointTest(endpoint, {
        connections,
        duration: stepDuration,
        pipelining: 1,
      });
      
      stressResults.push({ connectionLevel: connections, result });
      
      console.log(`   RPS: ${result.requests.average.toFixed(0)}`);
      console.log(`   p99 Latency: ${result.latency.p99.toFixed(2)}ms`);
      console.log(`   Errors: ${result.errors}`);
      
      if (result.errors > result.requests.total * 0.1) {
        console.log(`   ⚠️  Error rate exceeded 10%, stopping stress test`);
        break;
      }
    } catch (error) {
      console.log(`   ❌ Error at ${connections} connections:`, error);
      break;
    }
  }

  return stressResults;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runPublicEndpointTests(50, 5).then((results) => {
    console.log('\n📊 Test Summary:');
    results.forEach((r) => {
      console.log(`  ${r.endpoint}: ${r.requests.average.toFixed(0)} req/s, ${r.latency.average.toFixed(2)}ms avg`);
    });
  });
}
