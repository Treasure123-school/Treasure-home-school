import autocannon from 'autocannon';
import { getAllTokens, getTokenForRole } from './auth-helper';

const BASE_URL = 'http://localhost:5000';

interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  name: string;
  roles: string[];
  body?: object;
  bodyGenerator?: () => object;
}

interface AuthTestResult {
  endpoint: string;
  method: string;
  role: string;
  duration: number;
  requests: {
    total: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    average: number;
  };
  errors: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
}

export const AUTHENTICATED_ENDPOINTS: EndpointConfig[] = [
  { path: '/api/auth/me', method: 'GET', name: 'Get Current User', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'] },
  
  { path: '/api/exams', method: 'GET', name: 'List Exams', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'] },
  
  { path: '/api/users', method: 'GET', name: 'List Users', roles: ['Super Admin', 'Admin', 'Teacher'] },
  
  { path: '/api/classes', method: 'GET', name: 'List Classes', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'] },
  
  { path: '/api/subjects', method: 'GET', name: 'List Subjects', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'] },
  
  { path: '/api/terms', method: 'GET', name: 'List Academic Terms', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'] },
  
  { path: '/api/admin/stats', method: 'GET', name: 'Admin Statistics', roles: ['Super Admin'] },
  
  { path: '/api/grading-config', method: 'GET', name: 'Grading Config', roles: ['Super Admin', 'Admin', 'Teacher'] },
  
  { path: '/api/performance/cache-stats', method: 'GET', name: 'Cache Statistics', roles: ['Super Admin', 'Admin'] },
  
  { path: '/api/performance/database-stats', method: 'GET', name: 'Database Stats', roles: ['Super Admin', 'Admin'] },
  
  { path: '/api/departments', method: 'GET', name: 'List Departments', roles: ['Super Admin', 'Admin', 'Teacher'] },
  
  { path: '/api/invites', method: 'GET', name: 'List Invites', roles: ['Super Admin', 'Admin'] },
  
  { path: '/api/audit-logs', method: 'GET', name: 'Audit Logs', roles: ['Super Admin', 'Admin'] },
  
  { path: '/api/realtime/sync', method: 'POST', name: 'Realtime Sync', roles: ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'], body: { tables: ['classes', 'subjects'] } },
];

async function runAuthenticatedTest(
  endpoint: EndpointConfig,
  token: string,
  role: string,
  options: { connections: number; duration: number }
): Promise<AuthTestResult> {
  return new Promise((resolve, reject) => {
    const requestConfig: any = {
      url: `${BASE_URL}${endpoint.path}`,
      connections: options.connections,
      duration: options.duration,
      pipelining: 1,
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (endpoint.body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      requestConfig.body = JSON.stringify(endpoint.body);
    }

    const instance = autocannon(requestConfig, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        role,
        duration: options.duration,
        requests: {
          total: result.requests.total,
          average: result.requests.average,
          p50: result.requests.p50,
          p95: result.requests.p95,
          p99: result.requests.p99,
        },
        latency: {
          average: result.latency.average,
          p50: result.latency.p50,
          p95: result.latency.p95,
          p99: result.latency.p99,
        },
        throughput: {
          average: result.throughput.average,
        },
        errors: result.errors,
        status2xx: result['2xx'] || 0,
        status4xx: result['4xx'] || 0,
        status5xx: result['5xx'] || 0,
      });
    });

    autocannon.track(instance, { renderProgressBar: false });
  });
}

export async function runAuthenticatedEndpointTests(
  connections: number = 50,
  duration: number = 10
): Promise<AuthTestResult[]> {
  const tokens = await getAllTokens();
  
  if (tokens.size === 0) {
    console.error('❌ No authentication tokens available. Cannot proceed with authenticated tests.');
    return [];
  }

  console.log('\n🔒 Testing Authenticated Endpoints\n');
  console.log(`   Connections: ${connections}`);
  console.log(`   Duration: ${duration}s per test\n`);
  console.log('─'.repeat(70));

  const results: AuthTestResult[] = [];

  for (const endpoint of AUTHENTICATED_ENDPOINTS) {
    console.log(`\n📍 ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    for (const role of endpoint.roles) {
      const token = getTokenForRole(tokens, role);
      
      if (!token) {
        console.log(`   ⚠️  Skipping ${role}: No token available`);
        continue;
      }

      try {
        console.log(`   Testing as ${role}...`);
        
        const result = await runAuthenticatedTest(endpoint, token, role, {
          connections: Math.min(connections, role === 'Student' ? connections : 25),
          duration: Math.min(duration, 5),
        });
        
        results.push(result);
        
        const status = result.status4xx > 0 || result.status5xx > 0 
          ? '⚠️ ' 
          : result.errors > 0 
            ? '❌' 
            : '✅';
        
        console.log(`   ${status} ${role}: ${result.requests.average.toFixed(0)} req/s, ${result.latency.average.toFixed(1)}ms avg`);
        
        if (result.status4xx > 0) {
          console.log(`      4xx responses: ${result.status4xx}`);
        }
        if (result.status5xx > 0) {
          console.log(`      5xx responses: ${result.status5xx}`);
        }
      } catch (error) {
        console.log(`   ❌ Error testing ${role}:`, error);
      }
    }
  }

  return results;
}

export async function runRoleBasedStressTest(
  role: string,
  maxConnections: number = 200,
  stepSize: number = 50
): Promise<AuthTestResult[]> {
  const tokens = await getAllTokens();
  const token = getTokenForRole(tokens, role);
  
  if (!token) {
    console.error(`❌ No token for role: ${role}`);
    return [];
  }

  console.log(`\n🔥 Role-Based Stress Test: ${role}`);
  console.log('─'.repeat(60));

  const results: AuthTestResult[] = [];
  const testEndpoint = AUTHENTICATED_ENDPOINTS.find(e => e.roles.includes(role) && e.method === 'GET');
  
  if (!testEndpoint) {
    console.error(`❌ No suitable endpoint for role: ${role}`);
    return [];
  }

  for (let connections = stepSize; connections <= maxConnections; connections += stepSize) {
    console.log(`\n   Testing ${testEndpoint.path} with ${connections} connections...`);
    
    try {
      const result = await runAuthenticatedTest(testEndpoint, token, role, {
        connections,
        duration: 5,
      });
      
      results.push(result);
      
      console.log(`   RPS: ${result.requests.average.toFixed(0)}`);
      console.log(`   p99 Latency: ${result.latency.p99.toFixed(2)}ms`);
      console.log(`   Errors: ${result.errors}`);
      
      if (result.errors > result.requests.total * 0.1) {
        console.log(`   ⚠️  Error rate exceeded 10%`);
        break;
      }
    } catch (error) {
      console.log(`   ❌ Error:`, error);
      break;
    }
  }

  return results;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runAuthenticatedEndpointTests(25, 5).then((results) => {
    console.log('\n📊 Authenticated Tests Summary:');
    const byEndpoint = new Map<string, AuthTestResult[]>();
    results.forEach((r) => {
      const key = `${r.method} ${r.endpoint}`;
      if (!byEndpoint.has(key)) byEndpoint.set(key, []);
      byEndpoint.get(key)!.push(r);
    });
    
    byEndpoint.forEach((tests, endpoint) => {
      console.log(`\n  ${endpoint}:`);
      tests.forEach((t) => {
        console.log(`    ${t.role}: ${t.requests.average.toFixed(0)} req/s, ${t.latency.average.toFixed(1)}ms`);
      });
    });
  });
}
