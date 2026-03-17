import http from 'http';

const BASE_URL = 'http://localhost:5000';

interface AuthToken {
  token: string;
  user: {
    id: string;
    username: string;
    roleId: number;
    roleName: string;
  };
}

interface TestCredentials {
  username: string;
  password: string;
  role: string;
  roleId: number;
}

export const TEST_USERS: TestCredentials[] = [
  { username: 'superadmin', password: 'SuperAdmin@123', role: 'Super Admin', roleId: 1 },
  { username: 'admin', password: 'Admin@123', role: 'Admin', roleId: 2 },
  { username: 'teacher', password: 'Teacher@123', role: 'Teacher', roleId: 3 },
  { username: 'student', password: 'Student@123', role: 'Student', roleId: 4 },
  { username: 'parent', password: 'Parent@123', role: 'Parent', roleId: 5 },
];

export async function login(username: string, password: string): Promise<AuthToken | null> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ identifier: username, password });
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            resolve({
              token: response.token,
              user: response.user,
            });
          } else {
            console.error(`Login failed for ${username}: ${res.statusCode}`);
            resolve(null);
          }
        } catch (e) {
          console.error(`Parse error for ${username}:`, e);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Request error for ${username}:`, e);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

export async function getAllTokens(): Promise<Map<string, AuthToken>> {
  const tokens = new Map<string, AuthToken>();
  
  console.log('\n🔐 Authenticating test users...\n');
  
  for (const user of TEST_USERS) {
    const authResult = await login(user.username, user.password);
    if (authResult) {
      tokens.set(user.role, authResult);
      console.log(`  ✅ ${user.role}: Authenticated successfully`);
    } else {
      console.log(`  ❌ ${user.role}: Authentication failed`);
    }
  }
  
  console.log(`\n📊 Total authenticated: ${tokens.size}/${TEST_USERS.length}\n`);
  
  return tokens;
}

export function getTokenForRole(tokens: Map<string, AuthToken>, role: string): string | null {
  const auth = tokens.get(role);
  return auth ? auth.token : null;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  getAllTokens().then((tokens) => {
    console.log('Tokens obtained:');
    tokens.forEach((auth, role) => {
      console.log(`  ${role}: ${auth.token.substring(0, 50)}...`);
    });
  });
}
