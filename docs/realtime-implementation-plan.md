# Real-Time Implementation Plan

## Executive Summary

This document outlines the implementation plan for making the entire Treasure-Home School Management System fully real-time using WebSockets (Socket.IO).

**Analysis Date:** November 29, 2025
**Status:** Phase 0 Complete - Ready for Implementation

---

## Phase 0: Discovery & Analysis Results

### 1. Current Realtime Infrastructure

#### Backend Service: `server/realtime-service.ts`
- **Technology:** Socket.IO with JWT authentication
- **Transport:** WebSocket with polling fallback
- **Authentication:** JWT token validation on connection handshake
- **Authorization:** Role-based channel access control

#### Existing Channel Architecture:
| Channel Pattern | Purpose | Access |
|----------------|---------|--------|
| `user:{userId}` | Private user events | Self only |
| `role:{role}` | Role-based broadcasts | Same role |
| `table:{tableName}` | Table-level CRUD events | Admin/appropriate roles |
| `class:{classId}` | Class-specific events | Admins, assigned teachers/students |
| `exam:{examId}` | Exam-specific events | Admins, assigned teachers/students |
| `reportcard:{reportCardId}` | Report card events | Admins, teachers, student/parent |

#### Existing Event Types:
```typescript
interface RealtimeEvent {
  eventId: string;         // UUID for deduplication
  eventType: string;       // e.g., "exam.submitted"
  table: string;           // Source table
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;               // New/updated data
  oldData?: any;           // Previous data (for updates)
  timestamp: number;       // Unix timestamp
  userId?: string;         // Actor who triggered event
}
```

### 2. Frontend Hook: `useSocketIORealtime`
- Global singleton socket connection
- Automatic reconnection (5 attempts)
- Fallback polling (30s default)
- Event deduplication via eventId tracking
- Query cache invalidation on events

### 3. Gap Analysis

#### Backend Event Emissions (Current: 5 locations)
| Endpoint | Event Emitted | Status |
|----------|--------------|--------|
| `/api/exams/:examId/submit` | `exam.submitted` | Implemented |
| User delete | `user.deleted` | Implemented |
| User create | `user.created` | Implemented |
| User update | `user.updated` | Implemented |
| Report card status change | `reportcard.*` | Implemented |

#### Missing Realtime Events (60+ endpoints):
- **Academic Management:** Classes, Subjects, Terms - 0% covered
- **Exam System:** Create/Update/Delete exams - 0% covered (only submit has event)
- **Attendance:** Mark/Update attendance - 0% covered
- **Announcements:** CRUD operations - 0% covered
- **Students:** CRUD operations - 0% covered
- **Vacancies/Applications:** CRUD operations - 0% covered
- **Homepage Content:** Updates - 0% covered
- **Study Resources:** Uploads - 0% covered
- **Grading:** AI review actions - 0% covered

#### Frontend Components With Realtime (14):
Already configured but backend doesn't emit events for most.

#### Dashboards Without Realtime (4 Critical):
| Dashboard | Current State | Impact |
|-----------|--------------|--------|
| TeacherDashboard | No realtime | Teachers don't see live exam submissions |
| StudentDashboard | No realtime | Students don't see grade updates |
| ParentDashboard | No realtime | Parents miss attendance/grade updates |
| AdminDashboard | 30s polling | Delayed system overview |

---

## Phase 1: Architecture Decision

### Selected Approach: Socket.IO Hub with Modular Event Registration

**Rationale:**
1. Socket.IO already implemented and working
2. JWT auth already integrated
3. Channel/room system already architected
4. Client hook with fallback already exists

**Architecture Pattern:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  API Endpoint   │────▶│  RealtimeService │────▶│  Socket.IO  │
│  (routes.ts)    │     │  (emit methods)  │     │  Clients    │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│  Database       │     │  Event Log       │
│  Commit         │     │  (for re-sync)   │
└─────────────────┘     └──────────────────┘
```

### Event Emission Strategy

**Rule 1:** Emit events ONLY after successful database transaction commit
**Rule 2:** Include minimal payload (IDs + operation + timestamp) - clients fetch full data
**Rule 3:** Use structured event types: `{domain}.{action}` (e.g., `exam.created`, `attendance.marked`)

---

## Phase 2: Core Implementation

### 2A: Modular Event Registration

Create a domain-event mapping for consistent emissions:

```typescript
// Event domains and their channels
const EVENT_DOMAINS = {
  user: { channels: ['table:users', 'role:admin', 'role:super_admin'] },
  student: { channels: ['table:students', 'role:admin', 'class:{classId}'] },
  class: { channels: ['table:classes', 'role:admin', 'role:teacher'] },
  subject: { channels: ['table:subjects', 'role:admin', 'role:teacher'] },
  exam: { channels: ['exam:{examId}', 'class:{classId}', 'role:teacher'] },
  attendance: { channels: ['class:{classId}', 'table:attendance'] },
  reportcard: { channels: ['reportcard:{id}', 'user:{studentId}', 'class:{classId}'] },
  announcement: { channels: ['table:announcements', 'role:{targetRole}'] },
  term: { channels: ['table:academic_terms', 'role:admin'] },
  vacancy: { channels: ['table:vacancies', 'role:admin'] },
};
```

### 2B: Channel Access Control (Already Implemented)
The current `handleTableSubscribe`, `handleClassSubscribe`, etc. enforce role-based access.

### 2C: Event Contracts & Re-sync

Add sync endpoint for reconnection recovery:
```typescript
GET /api/realtime/sync?since={timestamp}&tables={comma-separated}
```

---

## Phase 3: Module-by-Module Implementation

### Priority Order (Based on User Impact):

1. **Exam System** - Critical for live exam monitoring
   - `exam.created`, `exam.updated`, `exam.deleted`, `exam.published`
   - `exam.started`, `exam.submitted`, `exam.auto_submitted`, `exam.graded`
   - `examSession.started`, `examSession.progress`, `examSession.completed`

2. **Report Cards** - Enhanced (partially implemented)
   - Already has: `reportcard.updated`, `reportcard.published`, `reportcard.finalized`, `reportcard.reverted`
   - Add: `reportcard.created`, `reportcard.deleted`

3. **Attendance** - Parent/Teacher critical
   - `attendance.marked`, `attendance.updated`

4. **Users/Students** - Admin operations
   - Enhanced existing: `user.created`, `user.updated`, `user.deleted`
   - Add: `student.created`, `student.updated`, `student.deleted`, `student.enrolled`

5. **Academic Structure**
   - `class.created`, `class.updated`, `class.deleted`
   - `subject.created`, `subject.updated`, `subject.deleted`
   - `term.created`, `term.updated`, `term.deleted`, `term.activated`

6. **Announcements**
   - `announcement.created`, `announcement.updated`, `announcement.deleted`

7. **Vacancies/Applications**
   - `vacancy.created`, `vacancy.closed`
   - `application.submitted`, `application.statusChanged`

8. **Uploads**
   - `upload.started`, `upload.progress`, `upload.completed`, `upload.failed`

9. **Notifications**
   - `notification.created`, `notification.read`

### Dashboard Realtime Integration:

| Dashboard | Tables to Subscribe |
|-----------|---------------------|
| TeacherDashboard | exams, exam_sessions, classes, students, grading_tasks |
| StudentDashboard | exam_results, attendance, announcements, report_cards |
| ParentDashboard | linked_students, exam_results, attendance, report_cards |
| AdminDashboard | users, students, exams, classes, system_metrics |
| SuperAdminDashboard | all tables |

---

## Phase 4: Security & Auth

### Current State (Already Implemented):
- JWT validation on socket handshake
- Role-based channel authorization
- Rate limiting on connections

### Enhancements Needed:
1. Token refresh handling during long sessions
2. Connection logging for audit
3. IP-based rate limiting

---

## Phase 5: Testing Strategy

### Unit Tests:
- Event emission functions
- Channel authorization logic
- Event deduplication

### Integration Tests:
- Multi-client synchronization
- Reconnection and re-sync
- Event ordering

### E2E Tests:
- Student submits exam -> Teacher dashboard updates
- Admin creates user -> User list updates across sessions
- Teacher marks attendance -> Parent dashboard shows update

---

## Phase 6: Monitoring & Fallbacks

### Metrics to Track:
- Socket connections (active/total)
- Event emissions (per type/rate)
- Reconnection frequency
- Fallback polling activations

### Fallback Strategy (Already Implemented):
- Polling fallback after 5 reconnection failures
- 30-second default polling interval

---

## Implementation Checklist

### Phase 2A: Realtime Hub Refactor
- [ ] Add helper function for consistent event emission
- [ ] Create domain-event mapping
- [ ] Add event logging for re-sync support

### Phase 2B-2C: Channels & Contracts
- [ ] Verify all channel subscriptions are ACL-protected
- [ ] Add GET /api/realtime/sync endpoint
- [ ] Document event payload schemas

### Phase 3: Module Events
- [ ] Add events to all exam CRUD endpoints
- [ ] Add events to attendance endpoints
- [ ] Add events to class/subject/term endpoints
- [ ] Add events to announcement endpoints
- [ ] Add events to student/vacancy endpoints
- [ ] Enable realtime on all dashboards

### Phase 4: Security
- [ ] Add token refresh on socket reconnect
- [ ] Add connection audit logging

### Phase 5: Testing
- [ ] Write unit tests for event functions
- [ ] Write integration tests for multi-client sync
- [ ] Manual E2E validation

### Phase 6: Monitoring
- [ ] Add realtime stats endpoint
- [ ] Add logging for event emissions

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| High event volume overwhelms clients | Batch events, send IDs only |
| Missed events during disconnect | Re-sync endpoint with since timestamp |
| Token expiration during session | Token refresh mechanism |
| Duplicate events | eventId deduplication (already implemented) |

---

## Estimated Timeline

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 0: Analysis | 2 hours | COMPLETE |
| Phase 1: Architecture | 1 hour | IN PROGRESS |
| Phase 2: Core Implementation | 4 hours | PENDING |
| Phase 3: Module Events | 6 hours | PENDING |
| Phase 4: Security | 2 hours | PENDING |
| Phase 5: Testing | 3 hours | PENDING |
| Phase 6: Monitoring | 2 hours | PENDING |

**Total Estimated: 20 hours**

---

## Approval

This plan is ready for implementation. The current Socket.IO infrastructure is solid and requires primarily adding event emissions to existing endpoints plus enabling realtime subscriptions on dashboards.

**Key Principle:** Work incrementally - each endpoint modification should be atomic and testable independently.
