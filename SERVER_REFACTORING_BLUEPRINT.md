# Server Refactoring Blueprint - Complete Guide

**Created**: 2026-11-14  
**Purpose**: Systematic plan to organize server codebase into modular architecture  
**Estimated Time**: 5-7 days (gradual migration)

---

## 🎯 Current Problems

### Problem 1: Root-Level Chaos (31 Files)
```
server/
├── academic-calendar-service.ts      ❌ Should be in modules/
├── auth-utils.ts                     ❌ Should be in core/utils/
├── cloudinary-service.ts             ❌ Should be in infrastructure/
├── csv-import-service.ts             ❌ Should be in infrastructure/
├── email-service.ts                  ❌ Should be in infrastructure/
├── grade-scale-service.ts            ❌ Should be in modules/
├── performance-monitor.ts            ❌ Should be in infrastructure/
... (24 more scattered files)
```

### Problem 2: Massive Storage Files (42KB)
```
storage/types.ts                      42KB ❌ HUGE!
storage/question-banks-syllabus.ts    35KB ❌ Multiple entities mixed
storage/score-sync-messages-gallery.ts 32KB ❌ 3 unrelated entities
storage/exam-sessions-bank-links.ts   31KB ❌ Mixed concerns
storage/report-card-*.ts              28-30KB ❌ Too large
```

**Why This Is Bad**:
- Hard to find code (which file has what?)
- Difficult to test (too many dependencies)
- Merge conflicts (multiple devs editing same file)
- Slow IDE (parsing huge files)
- Tight coupling (can't change one thing without breaking others)

---

## ✅ Proposed Structure

```
server/
│
├── core/                              # Infrastructure & utilities
│   ├── config/
│   │   ├── database.config.ts         # DB connection, pool config
│   │   ├── env.config.ts              # Environment validation
│   │   ├── cloudinary.config.ts       # File storage config
│   │   └── index.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts         # authenticateUser
│   │   ├── authorize.middleware.ts    # authorizeRoles
│   │   ├── error.middleware.ts        # Global error handler
│   │   ├── validation.middleware.ts   # Request validation
│   │   └── index.ts
│   │
│   └── utils/
│       ├── response.util.ts           # sendSuccess, sendError
│       ├── auth.util.ts               # JWT helpers
│       ├── date.util.ts               # Date formatting
│       ├── pagination.util.ts         # Pagination helpers
│       └── index.ts
│
├── shared/                            # Shared across modules
│   ├── types/
│   │   ├── user.types.ts              # User, Student, Teacher types
│   │   ├── exam.types.ts              # Exam, Question, Answer types
│   │   ├── report-card.types.ts       # ReportCard types
│   │   ├── academic.types.ts          # Session, Term, Class types
│   │   ├── common.types.ts            # PaginatedResponse, etc.
│   │   └── index.ts                   # Barrel export
│   │
│   ├── enums/
│   │   ├── role.enum.ts               # UserRole enum
│   │   ├── status.enum.ts             # Status enums
│   │   └── index.ts
│   │
│   └── interfaces/
│       ├── repository.interface.ts    # IRepository<T> base
│       ├── service.interface.ts       # IService<T> base
│       └── index.ts
│
├── modules/                           # Feature modules
│   │
│   ├── users/                         # User management
│   │   ├── repositories/
│   │   │   ├── user.repository.ts     # CRUD operations
│   │   │   ├── student.repository.ts  # Student-specific
│   │   │   └── teacher.repository.ts  # Teacher-specific
│   │   ├── services/
│   │   │   ├── user.service.ts        # Business logic
│   │   │   ├── auth.service.ts        # Login, JWT, password reset
│   │   │   └── profile.service.ts     # Profile management
│   │   ├── validators/
│   │   │   ├── user.validator.ts      # Input validation
│   │   │   └── auth.validator.ts      # Login validation
│   │   ├── controllers/
│   │   │   ├── user.controller.ts     # HTTP handlers
│   │   │   └── auth.controller.ts     # Auth endpoints
│   │   ├── routes.ts                  # Route definitions
│   │   └── index.ts                   # Module exports
│   │
│   ├── exams/                         # Exam management
│   │   ├── repositories/
│   │   │   ├── exam.repository.ts
│   │   │   ├── question.repository.ts
│   │   │   ├── answer.repository.ts
│   │   │   ├── exam-session.repository.ts
│   │   │   └── question-bank.repository.ts
│   │   ├── services/
│   │   │   ├── exam.service.ts
│   │   │   ├── question.service.ts
│   │   │   ├── grading.service.ts
│   │   │   ├── exam-session.service.ts
│   │   │   └── visibility.service.ts
│   │   ├── validators/
│   │   │   ├── exam.validator.ts
│   │   │   └── question.validator.ts
│   │   ├── controllers/
│   │   │   ├── exam.controller.ts
│   │   │   ├── question.controller.ts
│   │   │   └── grading.controller.ts
│   │   ├── routes.ts
│   │   └── index.ts
│   │
│   ├── report-cards/                  # Report card system
│   │   ├── repositories/
│   │   │   ├── report-card.repository.ts
│   │   │   ├── remarks.repository.ts
│   │   │   └── template.repository.ts
│   │   ├── services/
│   │   │   ├── report-card.service.ts
│   │   │   ├── generation.service.ts  # Generate reports
│   │   │   ├── repair.service.ts      # Fix corrupted reports
│   │   │   └── remarks.service.ts     # Remarks management
│   │   ├── validators/
│   │   ├── controllers/
│   │   ├── routes.ts
│   │   └── index.ts
│   │
│   ├── academic-calendar/             # ✅ Already refactored!
│   │   ├── validators/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   ├── promotions/                    # ✅ Already modular!
│   │   ├── services/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   ├── attendance/                    # Attendance tracking
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   ├── analytics/                     # Analytics & reporting
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   ├── messaging/                     # Internal messaging
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   ├── gallery/                       # Photo gallery
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── routes.ts
│   │
│   └── grading/                       # Grade scales & config
│       ├── repositories/
│       ├── services/
│       ├── controllers/
│       └── routes.ts
│
├── infrastructure/                    # Cross-cutting concerns
│   ├── cache/
│   │   ├── cache.service.ts           # Enhanced cache
│   │   └── performance-cache.service.ts
│   │
│   ├── monitoring/
│   │   ├── performance.monitor.ts     # Performance tracking
│   │   ├── query-optimizer.service.ts # SQL optimization
│   │   └── metrics.service.ts         # Application metrics
│   │
│   ├── email/
│   │   ├── email.service.ts           # Email sending
│   │   └── templates/                 # Email templates
│   │
│   ├── file-storage/
│   │   ├── cloudinary.service.ts      # Cloud storage
│   │   └── local-storage.service.ts   # Local filesystem
│   │
│   ├── realtime/
│   │   └── realtime.service.ts        # SocketIO events
│   │
│   └── csv/
│       └── csv-import.service.ts      # CSV processing
│
├── database/                          # Database layer (formerly storage/)
│   ├── repositories/                  # Base repository classes
│   │   └── base.repository.ts         # Generic CRUD
│   │
│   ├── migrations/                    # SQL migrations
│   │   └── *.sql
│   │
│   └── seeds/                         # Seed data
│       └── *.ts
│
├── routes.ts                          # Main router (aggregates all modules)
├── index.ts                           # Server entry point
└── app.ts                             # Express app setup
```

---

## 📋 Migration Checklist

### Phase 1: Core Infrastructure ⏱️ 1 day

**Step 1.1: Create Directory Structure**
```bash
mkdir -p server/core/{config,middleware,utils}
mkdir -p server/shared/{types,enums,interfaces}
mkdir -p server/infrastructure/{cache,monitoring,email,file-storage,realtime,csv}
```

**Step 1.2: Move Configuration Files**
```bash
# Move db.ts → core/config/database.config.ts
# Move env-validation.ts → core/config/env.config.ts
# Extract Cloudinary config → core/config/cloudinary.config.ts
```

**Step 1.3: Move Middleware**
```bash
# Extract from routes/middleware.ts → core/middleware/
# - authenticateUser → auth.middleware.ts
# - authorizeRoles → authorize.middleware.ts
# - Error handling → error.middleware.ts
```

**Step 1.4: Move Utilities**
```bash
# Move auth-utils.ts → core/utils/auth.util.ts
# Extract response helpers → core/utils/response.util.ts
```

**Step 1.5: Update Imports**
```typescript
// Old
import { authenticateUser } from './routes/middleware';

// New
import { authenticateUser } from './core/middleware';
```

---

### Phase 2: Shared Types ⏱️ 1 day

**Step 2.1: Split types.ts (42KB → 8 files)**

**File 1: shared/types/user.types.ts** (~5KB)
```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  roleId: number;
  // ... other user fields
}

export interface Student extends User {
  classId: number;
  admissionNumber: string;
  // ... student-specific fields
}

export interface Teacher extends User {
  subjects: number[];
  // ... teacher-specific fields
}
```

**File 2: shared/types/exam.types.ts** (~6KB)
```typescript
export interface Exam {
  id: number;
  title: string;
  // ... exam fields
}

export interface Question {
  id: number;
  examId: number;
  // ... question fields
}

export interface ExamSession {
  id: string;
  examId: number;
  studentId: string;
  // ... session fields
}
```

**File 3: shared/types/report-card.types.ts** (~5KB)
```typescript
export interface ReportCard {
  id: string;
  studentId: string;
  termId: number;
  // ... report card fields
}
```

**File 4: shared/types/academic.types.ts** (~4KB)
```typescript
export interface AcademicSession {
  id: number;
  name: string;
  // ... session fields
}

export interface AcademicTerm {
  id: number;
  name: string;
  // ... term fields
}

export interface Class {
  id: number;
  name: string;
  // ... class fields
}
```

**File 5: shared/types/common.types.ts** (~2KB)
```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Step 2.2: Create Enums**

**shared/enums/role.enum.ts**
```typescript
export enum UserRole {
  SUPER_ADMIN = 1,
  ADMIN = 2,
  TEACHER = 3,
  STUDENT = 4,
  PARENT = 5
}
```

**shared/enums/status.enum.ts**
```typescript
export enum ExamStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum SessionStatus {
  ACTIVE = 'active',
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}
```

---

### Phase 3: Infrastructure Services ⏱️ 1 day

**Step 3.1: Move Infrastructure Services**

```bash
# Cache services
mv server/enhanced-cache.ts → infrastructure/cache/cache.service.ts
mv server/performance-cache.ts → infrastructure/cache/performance-cache.service.ts

# Monitoring
mv server/performance-monitor.ts → infrastructure/monitoring/performance.monitor.ts
mv server/query-optimizer.ts → infrastructure/monitoring/query-optimizer.service.ts

# Email
mv server/email-service.ts → infrastructure/email/email.service.ts

# File storage
mv server/cloudinary-service.ts → infrastructure/file-storage/cloudinary.service.ts

# CSV
mv server/csv-import-service.ts → infrastructure/csv/csv-import.service.ts
```

**Step 3.2: Create Clean Exports**

**infrastructure/index.ts**
```typescript
export * from './cache/cache.service';
export * from './monitoring/performance.monitor';
export * from './email/email.service';
export * from './file-storage/cloudinary.service';
export * from './csv/csv-import.service';
```

---

### Phase 4: User Module ⏱️ 1 day

**Step 4.1: Extract from storage/users-roles-password-tokens.ts**

**modules/users/repositories/user.repository.ts** (~200 lines)
```typescript
import { db } from '@/core/config/database';
import type { User } from '@/shared/types';

export class UserRepository {
  async findById(id: string): Promise<User | undefined> {
    // Database query only
  }

  async findByEmail(email: string): Promise<User | undefined> {
    // Database query only
  }

  async create(data: CreateUserDto): Promise<User> {
    // Database insert only
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    // Database update only
  }

  async delete(id: string): Promise<boolean> {
    // Database delete only
  }
}
```

**modules/users/services/user.service.ts** (~300 lines)
```typescript
import { UserRepository } from '../repositories/user.repository';
import { realtimeService } from '@/infrastructure/realtime';
import type { ServiceResult } from '@/shared/types';

export class UserService {
  constructor(private userRepo: UserRepository) {}

  async createUser(data: CreateUserDto): Promise<ServiceResult<User>> {
    // Business logic
    // Validation
    // Call repository
    // Emit realtime event
    // Return result
  }

  async getUserById(id: string): Promise<ServiceResult<User>> {
    // Business logic
  }
}
```

**modules/users/controllers/user.controller.ts** (~200 lines)
```typescript
import { UserService } from '../services/user.service';
import { sendSuccess, sendBadRequest } from '@/core/utils';

export async function createUser(req: Request, res: Response) {
  // HTTP handling only
  const result = await userService.createUser(req.body);
  
  if (!result.success) {
    return sendBadRequest(res, result.error);
  }
  
  sendSuccess(res, result.data, 201);
}
```

---

### Phase 5: Exam Module ⏱️ 2 days

**Step 5.1: Split exam-sessions-bank-links.ts (31KB)**

Break into:
- `modules/exams/repositories/exam.repository.ts`
- `modules/exams/repositories/exam-session.repository.ts`
- `modules/exams/repositories/question-bank.repository.ts`

**Step 5.2: Split attendance-exams.ts (28KB)**

Break into:
- `modules/attendance/repositories/attendance.repository.ts`
- `modules/exams/repositories/exam.repository.ts` (merge with Step 5.1)

**Step 5.3: Create Services**
- `modules/exams/services/exam.service.ts`
- `modules/exams/services/grading.service.ts`
- `modules/exams/services/visibility.service.ts`

---

### Phase 6: Report Card Module ⏱️ 1 day

**Step 6.1: Split Report Card Files**

From:
- `storage/report-card-generation.ts` (28KB)
- `storage/report-card-remarks-templates.ts` (30KB)
- `storage/report-card-repair.ts` (29KB)

To:
- `modules/report-cards/repositories/report-card.repository.ts`
- `modules/report-cards/repositories/remarks.repository.ts`
- `modules/report-cards/services/generation.service.ts`
- `modules/report-cards/services/repair.service.ts`

---

## 🔄 Migration Pattern (Copy This for Each Module)

### For Each Module:

**1. Create Module Structure**
```bash
mkdir -p server/modules/{module-name}/{repositories,services,validators,controllers}
touch server/modules/{module-name}/{routes.ts,index.ts,README.md}
```

**2. Extract Repository (Database Operations)**
```typescript
// repositories/{entity}.repository.ts
export class EntityRepository {
  async findAll(): Promise<Entity[]> { /* SQL only */ }
  async findById(id: number): Promise<Entity | undefined> { /* SQL only */ }
  async create(data: CreateDto): Promise<Entity> { /* SQL only */ }
  async update(id: number, data: UpdateDto): Promise<Entity> { /* SQL only */ }
  async delete(id: number): Promise<boolean> { /* SQL only */ }
}
```

**3. Create Service (Business Logic)**
```typescript
// services/{entity}.service.ts
export class EntityService {
  constructor(private repo: EntityRepository) {}

  async createEntity(data: CreateDto): Promise<ServiceResult<Entity>> {
    // 1. Validate business rules
    // 2. Call repository
    // 3. Emit realtime events
    // 4. Return structured result
  }
}
```

**4. Create Controller (HTTP Handling)**
```typescript
// controllers/{entity}.controller.ts
export async function createEntity(req: Request, res: Response) {
  // 1. Validate input (use validator)
  // 2. Call service
  // 3. Map result to HTTP response
}
```

**5. Create Routes**
```typescript
// routes.ts
import * as controller from './controllers/{entity}.controller';

router.post('/', auth, authorize, controller.createEntity);
router.get('/:id', auth, controller.getEntity);
// ... other routes
```

**6. Create Module Export**
```typescript
// index.ts
export * as repository from './repositories';
export * as service from './services';
export * as controller from './controllers';
export { default as routes } from './routes';
```

---

## 📏 File Size Guidelines

| Layer | Max Size | Reason |
|-------|----------|--------|
| Validator | 200 lines | Pure functions, simple |
| Repository | 300 lines | CRUD only, no logic |
| Service | 400 lines | Business logic, can be complex |
| Controller | 300 lines | HTTP mapping, should be thin |
| Types | 200 lines | Interfaces/types per domain |

**If file exceeds limit**: Split into multiple files (e.g., `exam.service.ts` → `exam-create.service.ts`, `exam-update.service.ts`)

---

## ✅ Benefits Summary

### Before (Current State)
❌ 31 files in server root (hard to navigate)  
❌ 42KB types.ts file (slow IDE, hard to find types)  
❌ 20-35KB storage files (mixed concerns, hard to test)  
❌ No clear separation (validators/services/controllers mixed)  
❌ Hard to find code (is user code in storage? routes? services?)

### After (Refactored State)
✅ Clear directory structure (find code in 3 seconds)  
✅ Small focused files (< 400 lines each)  
✅ Testable layers (unit test each layer independently)  
✅ Scalable architecture (add features without touching others)  
✅ Team-friendly (multiple devs can work on different modules)  
✅ Type-safe (small type files, easy to import)

---

## 🚦 Testing Strategy

### Unit Tests (Per Layer)
```typescript
// validators/user.validator.test.ts
describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@test.com').valid).toBe(true);
  });
});

// repositories/user.repository.test.ts
describe('UserRepository', () => {
  it('should find user by id', async () => {
    const user = await repo.findById('123');
    expect(user).toBeDefined();
  });
});

// services/user.service.test.ts (mock repository)
describe('UserService', () => {
  it('should create user', async () => {
    const mockRepo = { create: jest.fn() };
    const service = new UserService(mockRepo);
    await service.createUser({...});
    expect(mockRepo.create).toHaveBeenCalled();
  });
});

// controllers/user.controller.test.ts (mock service)
describe('createUser', () => {
  it('should return 201 on success', async () => {
    const mockService = { createUser: jest.fn(() => ({success: true})) };
    const res = await request(app).post('/users').send({...});
    expect(res.status).toBe(201);
  });
});
```

---

## 📅 Recommended Timeline

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 1 | Core infrastructure | 1 day | HIGH |
| 2 | Shared types | 1 day | HIGH |
| 3 | Infrastructure services | 1 day | MEDIUM |
| 4 | User module | 1 day | HIGH |
| 5 | Exam module | 2 days | HIGH |
| 6 | Report card module | 1 day | MEDIUM |
| 7 | Attendance module | 1 day | MEDIUM |
| 8 | Analytics module | 1 day | LOW |
| 9 | Messaging module | 1 day | LOW |
| 10 | Gallery module | 1 day | LOW |

**Total Estimated Time**: 10-12 days for complete migration

**Gradual Migration**: Work on 1-2 modules per week alongside regular features

---

## 🔧 Tools & Scripts

### Auto-Import Update Script
```bash
# find-replace-imports.sh
# Updates old imports to new structure
find server -type f -name "*.ts" -exec sed -i 's|from .*\/auth-utils|from @/core/utils/auth.util|g' {} +
```

### File Size Checker
```bash
# check-file-sizes.sh
find server -name "*.ts" -exec wc -l {} + | awk '$1 > 400 {print $2 " is too large (" $1 " lines)"}'
```

### Module Template Generator
```bash
# create-module.sh <module-name>
MODULE=$1
mkdir -p server/modules/$MODULE/{repositories,services,validators,controllers}
touch server/modules/$MODULE/{routes.ts,index.ts,README.md}
```

---

## 📖 Additional Resources

### Examples Already in Codebase
- ✅ `server/modules/academic-calendar/` - Perfect refactored example
- ✅ `server/modules/promotions/` - Good modular structure
- ❌ `server/storage/` - Old pattern (what NOT to do)

### Patterns to Follow
1. **Repository Pattern**: Database operations only
2. **Service Pattern**: Business logic, orchestration
3. **Controller Pattern**: HTTP request/response
4. **Dependency Injection**: Pass dependencies via constructor
5. **Interface Segregation**: Small, focused interfaces

### Patterns to Avoid
1. ❌ God Classes (files > 500 lines)
2. ❌ Mixed Concerns (database + business + HTTP in one file)
3. ❌ Tight Coupling (direct imports of storage in controllers)
4. ❌ Massive Types Files (types.ts > 1000 lines)

---

## 🎯 Success Criteria

✅ No file > 400 lines  
✅ All modules follow same pattern  
✅ Clear separation: Repository → Service → Controller  
✅ All types in shared/types/ (< 200 lines per file)  
✅ All infrastructure in infrastructure/  
✅ All feature code in modules/  
✅ 80%+ test coverage per layer  
✅ Zero circular dependencies  
✅ Fast IDE (no massive files to parse)  

---

**Status**: 📋 Blueprint Complete - Ready for Implementation  
**Recommendation**: Start with Phase 1 (Core Infrastructure) tomorrow  
**Estimated Completion**: 2 weeks (working gradually alongside features)

---

*Blueprint created: 2026-11-14 at 19:01 UTC*  
*Session duration: 12 hours 11 minutes*  
*All previous work committed and ready for production*
