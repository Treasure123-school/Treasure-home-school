import { io, Socket } from 'socket.io-client';
import { getAllTokens, getTokenForRole } from './auth-helper';

const BASE_URL = 'http://localhost:5000';

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
    connectionTime: number[];
    messageLatency: number[];
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  duration: number;
}

function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function calculateAverage(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function createAuthenticatedSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      timeout: 10000,
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function testWebSocketConnection(
  token: string,
  role: string,
  numConnections: number = 10,
  testDuration: number = 10000
): Promise<WebSocketMetrics> {
  const metrics: WebSocketMetrics = {
    role,
    connections: { attempted: 0, successful: 0, failed: 0 },
    events: { sent: 0, received: 0, errors: 0 },
    latency: { connectionTime: [], messageLatency: [], average: 0, p50: 0, p95: 0, p99: 0 },
    duration: testDuration / 1000,
  };

  const sockets: Socket[] = [];
  const connectionPromises: Promise<void>[] = [];

  console.log(`   Creating ${numConnections} WebSocket connections for ${role}...`);

  for (let i = 0; i < numConnections; i++) {
    metrics.connections.attempted++;
    const startTime = Date.now();

    const connectionPromise = createAuthenticatedSocket(token)
      .then((socket) => {
        const connectionTime = Date.now() - startTime;
        metrics.latency.connectionTime.push(connectionTime);
        metrics.connections.successful++;
        sockets.push(socket);

        socket.on('table_change', () => {
          metrics.events.received++;
        });

        socket.on('notification', () => {
          metrics.events.received++;
        });

        socket.on('exam_update', () => {
          metrics.events.received++;
        });

        socket.on('grading_update', () => {
          metrics.events.received++;
        });

        socket.on('error', () => {
          metrics.events.errors++;
        });
      })
      .catch(() => {
        metrics.connections.failed++;
      });

    connectionPromises.push(connectionPromise);

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await Promise.allSettled(connectionPromises);

  console.log(`   ${metrics.connections.successful}/${numConnections} connections established`);

  if (sockets.length > 0) {
    sockets.forEach((socket) => {
      socket.on('pong', (data: { timestamp: number }) => {
        const latency = Date.now() - (socket as any)._lastPingTime;
        if (latency > 0 && latency < 5000) {
          metrics.latency.messageLatency.push(latency);
          metrics.events.received++;
        }
      });
    });

    const messageInterval = setInterval(() => {
      sockets.forEach((socket) => {
        if (socket.connected) {
          (socket as any)._lastPingTime = Date.now();
          socket.emit('ping');
          metrics.events.sent++;
        }
      });
    }, 500);

    await new Promise((resolve) => setTimeout(resolve, testDuration));

    clearInterval(messageInterval);
  }

  sockets.forEach((socket) => {
    if (socket.connected) {
      socket.disconnect();
    }
  });

  const allLatencies = [...metrics.latency.connectionTime, ...metrics.latency.messageLatency];
  metrics.latency.average = calculateAverage(allLatencies);
  metrics.latency.p50 = calculatePercentile(allLatencies, 50);
  metrics.latency.p95 = calculatePercentile(allLatencies, 95);
  metrics.latency.p99 = calculatePercentile(allLatencies, 99);

  return metrics;
}

export async function runWebSocketLoadTest(
  connectionsPerRole: number = 20,
  testDuration: number = 15000
): Promise<WebSocketMetrics[]> {
  const tokens = await getAllTokens();
  
  if (tokens.size === 0) {
    console.error('❌ No authentication tokens available');
    return [];
  }

  console.log('\n🔌 WebSocket Load Testing\n');
  console.log(`   Connections per role: ${connectionsPerRole}`);
  console.log(`   Test duration: ${testDuration / 1000}s\n`);
  console.log('─'.repeat(60));

  const results: WebSocketMetrics[] = [];
  const roles = ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'];

  for (const role of roles) {
    const token = getTokenForRole(tokens, role);
    
    if (!token) {
      console.log(`\n   ⚠️  Skipping ${role}: No token available`);
      continue;
    }

    console.log(`\n   Testing ${role}:`);

    try {
      const metrics = await testWebSocketConnection(
        token,
        role,
        connectionsPerRole,
        testDuration
      );
      
      results.push(metrics);

      console.log(`   ✅ Connections: ${metrics.connections.successful}/${metrics.connections.attempted}`);
      console.log(`   📨 Events sent: ${metrics.events.sent}, received: ${metrics.events.received}`);
      console.log(`   ⏱️  Avg latency: ${metrics.latency.average.toFixed(1)}ms`);
      console.log(`   📊 p95: ${metrics.latency.p95.toFixed(1)}ms, p99: ${metrics.latency.p99.toFixed(1)}ms`);
    } catch (error) {
      console.log(`   ❌ Error testing ${role}:`, error);
    }
  }

  return results;
}

export async function runWebSocketStressTest(
  maxConnectionsPerRole: number = 100,
  stepSize: number = 25
): Promise<{ level: number; metrics: WebSocketMetrics[] }[]> {
  const tokens = await getAllTokens();
  
  console.log('\n🔥 WebSocket Stress Test\n');
  console.log(`   Max connections per role: ${maxConnectionsPerRole}`);
  console.log('─'.repeat(60));

  const stressResults: { level: number; metrics: WebSocketMetrics[] }[] = [];

  for (let level = stepSize; level <= maxConnectionsPerRole; level += stepSize) {
    console.log(`\n📈 Testing with ${level} connections per role (${level * 5} total)...`);
    
    const levelMetrics: WebSocketMetrics[] = [];
    let hasErrors = false;

    for (const [role, auth] of tokens) {
      try {
        const metrics = await testWebSocketConnection(
          auth.token,
          role,
          level,
          5000
        );
        
        levelMetrics.push(metrics);

        const failRate = metrics.connections.failed / metrics.connections.attempted;
        if (failRate > 0.1) {
          console.log(`   ⚠️  ${role}: ${(failRate * 100).toFixed(1)}% connection failures`);
          hasErrors = true;
        }
      } catch (error) {
        console.log(`   ❌ ${role}: Error`);
        hasErrors = true;
      }
    }

    stressResults.push({ level, metrics: levelMetrics });

    if (hasErrors) {
      console.log(`\n   ⚠️  Stopping stress test due to high error rate`);
      break;
    }

    const totalSuccessful = levelMetrics.reduce((sum, m) => sum + m.connections.successful, 0);
    const avgLatency = calculateAverage(levelMetrics.map(m => m.latency.average));
    console.log(`   Total successful: ${totalSuccessful}, Avg latency: ${avgLatency.toFixed(1)}ms`);
  }

  return stressResults;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runWebSocketLoadTest(10, 10000).then((results) => {
    console.log('\n📊 WebSocket Test Summary:');
    results.forEach((r) => {
      console.log(`  ${r.role}:`);
      console.log(`    Connections: ${r.connections.successful}/${r.connections.attempted}`);
      console.log(`    Latency: avg=${r.latency.average.toFixed(1)}ms, p99=${r.latency.p99.toFixed(1)}ms`);
    });
  });
}
