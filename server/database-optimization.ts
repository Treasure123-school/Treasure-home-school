/**
 * Database Performance Optimization Module
 * 
 * This module provides comprehensive database optimization for high-load scenarios:
 * - Additional indexes for hot paths
 * - Query monitoring and analysis
 * - Connection pool optimization
 * - Slow query detection and logging
 */

import { sql } from 'drizzle-orm';
import { db, getPgPool } from './storage';

interface QueryStats {
  query: string;
  avgDurationMs: number;
  totalCalls: number;
  slowestDurationMs: number;
  lastCalled: Date;
}

interface PerformanceMetrics {
  totalQueries: number;
  avgQueryTime: number;
  slowQueries: number;
  cacheHitRate: number;
  connectionPoolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
}

class DatabaseOptimizer {
  private queryStats: Map<string, QueryStats> = new Map();
  private slowQueryThreshold: number = 500; // 500ms
  private slowQueryLog: Array<{ query: string; duration: number; timestamp: Date }> = [];
  private maxSlowQueryLogSize: number = 100;
  
  constructor() {
    this.startPeriodicCleanup();
  }

  /**
   * Performance indexes creation script
   * Run this once to ensure all critical indexes exist
   */
  async createPerformanceIndexes(): Promise<{ created: string[]; errors: string[] }> {
    const created: string[] = [];
    const errors: string[] = [];
    
    const indexStatements = [
      // User hot paths
      { name: 'users_active_role_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS users_active_role_idx ON users(role_id, is_active)' },
      { name: 'users_last_login_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS users_last_login_idx ON users(last_login_at DESC NULLS LAST)' },
      { name: 'users_status_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS users_status_active_idx ON users(status, is_active) WHERE is_active = true' },
      
      // Exam sessions hot paths (critical for exam taking)
      { name: 'exam_sessions_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_status_idx ON exam_sessions(status)' },
      { name: 'exam_sessions_student_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_student_status_idx ON exam_sessions(student_id, status)' },
      { name: 'exam_sessions_started_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_started_idx ON exam_sessions(started_at DESC)' },
      { name: 'exam_sessions_submitted_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_submitted_idx ON exam_sessions(submitted_at DESC NULLS LAST)' },
      { name: 'exam_sessions_timeout_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_timeout_idx ON exam_sessions(is_completed, started_at) WHERE is_completed = false' },
      
      // Exam hot paths (for listing and filtering)
      { name: 'exams_published_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_published_idx ON exams(is_published) WHERE is_published = true' },
      { name: 'exams_created_by_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_created_by_idx ON exams(created_by)' },
      { name: 'exams_teacher_charge_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_teacher_charge_idx ON exams(teacher_in_charge_id)' },
      { name: 'exams_class_term_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_class_term_idx ON exams(class_id, term_id)' },
      { name: 'exams_subject_class_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_subject_class_idx ON exams(subject_id, class_id)' },
      { name: 'exams_date_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_date_idx ON exams(date DESC)' },
      { name: 'exams_time_window_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_time_window_idx ON exams(start_time, end_time)' },
      
      // Report cards hot paths
      { name: 'report_cards_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_status_idx ON report_cards(status)' },
      { name: 'report_cards_student_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_student_status_idx ON report_cards(student_id, status)' },
      { name: 'report_cards_published_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_published_idx ON report_cards(status, published_at DESC) WHERE status = \'published\'' },
      
      // Notifications hot paths
      { name: 'notifications_user_unread_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read) WHERE is_read = false' },
      { name: 'notifications_created_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_created_idx ON notifications(created_at DESC)' },
      { name: 'notifications_user_created_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC)' },
      
      // Teacher assignments hot paths
      { name: 'teacher_assign_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_active_idx ON teacher_class_assignments(teacher_id, is_active) WHERE is_active = true' },
      { name: 'teacher_assign_term_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_term_idx ON teacher_class_assignments(term_id)' },
      { name: 'teacher_assign_valid_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_valid_idx ON teacher_class_assignments(valid_until) WHERE valid_until IS NOT NULL' },
      
      // Attendance hot paths
      { name: 'attendance_student_date_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_student_date_idx ON attendance(student_id, date DESC)' },
      { name: 'attendance_class_date_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_class_date_idx ON attendance(class_id, date DESC)' },
      { name: 'attendance_date_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_date_status_idx ON attendance(date, status)' },
      
      // Messages hot paths
      { name: 'messages_recipient_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_recipient_idx ON messages(recipient_id, created_at DESC)' },
      { name: 'messages_sender_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_sender_idx ON messages(sender_id, created_at DESC)' },
      { name: 'messages_unread_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_unread_idx ON messages(recipient_id, is_read) WHERE is_read = false' },
      
      // Audit logs hot paths (for admin dashboards)
      { name: 'audit_logs_user_date_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_user_date_idx ON audit_logs(user_id, created_at DESC)' },
      
      // Students hot paths
      { name: 'students_parent_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS students_parent_idx ON students(parent_id)' },
      
      // Grading tasks hot paths
      { name: 'grading_tasks_pending_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS grading_tasks_pending_idx ON grading_tasks(teacher_id, status) WHERE status = \'pending\'' },
      { name: 'grading_tasks_priority_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS grading_tasks_priority_idx ON grading_tasks(priority DESC, created_at ASC)' },
      
      // Continuous assessment hot paths
      { name: 'ca_student_term_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS ca_student_term_idx ON continuous_assessment(student_id, term_id)' },
      
      // Announcements hot paths
      { name: 'announcements_published_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS announcements_published_idx ON announcements(is_published, published_at DESC) WHERE is_published = true' },
      
      // Homepage content hot paths
      { name: 'homepage_active_order_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS homepage_active_order_idx ON home_page_content(is_active, display_order) WHERE is_active = true' },
      
      // ==================== EXAM VISIBILITY OPTIMIZATION INDEXES ====================
      // Critical for student exam access performance (target: <100ms)
      
      // Students class-based lookup for visibility
      { name: 'students_class_dept_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS students_class_dept_idx ON students(class_id, department)' },
      { name: 'students_class_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS students_class_active_idx ON students(class_id)' },
      
      // Subject category for department filtering (SS1-SS3)
      { name: 'subjects_category_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS subjects_category_idx ON subjects(category) WHERE is_active = true' },
      { name: 'subjects_active_cat_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS subjects_active_cat_idx ON subjects(is_active, category)' },
      
      // Optimized exam visibility queries
      { name: 'exams_visibility_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_visibility_idx ON exams(is_published, class_id, subject_id)' },
      { name: 'exams_class_published_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_class_published_idx ON exams(class_id, is_published) WHERE is_published = true' },
      
      // Classes level lookup for SS detection
      { name: 'classes_level_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS classes_level_idx ON classes(level)' },
      
      // ==================== VACANCY OPTIMIZATION INDEXES ====================
      // Critical for public vacancy listing (target: <100ms)
      
      { name: 'vacancies_status_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_status_idx ON vacancies(status)' },
      { name: 'vacancies_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_active_idx ON vacancies(status, created_at DESC) WHERE status = \'open\'' },
      { name: 'vacancies_created_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_created_idx ON vacancies(created_at DESC)' },
      
      // ==================== EXAM RESULTS & SUBMISSIONS OPTIMIZATION ====================
      // Critical for real-time anti-cheat and grading
      
      { name: 'exam_results_exam_student_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_results_exam_student_idx ON exam_results(exam_id, student_id)' },
      { name: 'exam_results_student_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_results_student_idx ON exam_results(student_id)' },
      { name: 'student_answers_session_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS student_answers_session_idx ON student_answers(session_id)' },
      { name: 'student_answers_question_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS student_answers_question_idx ON student_answers(question_id)' },
      
      // ==================== SCALABILITY INDEXES ====================
      // For horizontal scaling support with 1000+ concurrent users
      
      // Session management
      { name: 'exam_sessions_exam_student_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_exam_student_idx ON exam_sessions(exam_id, student_id)' },
      { name: 'exam_sessions_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_active_idx ON exam_sessions(status, started_at) WHERE status = \'in_progress\'' },
      
      // User authentication hot paths
      { name: 'users_login_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS users_login_idx ON users(username, is_active) WHERE is_active = true' },
      { name: 'users_email_active_idx', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS users_email_active_idx ON users(email, is_active) WHERE is_active = true' },
    ];

    const pool = getPgPool();
    if (!pool) {
      errors.push('Database pool not available');
      return { created, errors };
    }

    for (const idx of indexStatements) {
      try {
        await pool.query(idx.sql);
        created.push(idx.name);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          // Index already exists, that's fine
          created.push(`${idx.name} (exists)`);
        } else {
          errors.push(`${idx.name}: ${error.message}`);
        }
      }
    }

    return { created, errors };
  }

  /**
   * Analyze table statistics and suggest optimizations
   */
  async analyzeTableStats(): Promise<Map<string, any>> {
    const pool = getPgPool();
    if (!pool) return new Map();

    const stats = new Map();
    
    const criticalTables = [
      'users', 'students', 'exams', 'exam_sessions', 'exam_results',
      'student_answers', 'report_cards', 'notifications', 'teacher_class_assignments'
    ];

    for (const table of criticalTables) {
      try {
        const result = await pool.query(`
          SELECT 
            relname as table_name,
            n_live_tup as row_count,
            n_dead_tup as dead_rows,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
          FROM pg_stat_user_tables 
          WHERE relname = $1
        `, [table]);

        if (result.rows.length > 0) {
          stats.set(table, result.rows[0]);
        }
      } catch (error) {
        // Skip this table
      }
    }

    return stats;
  }

  /**
   * Get slow query log
   */
  getSlowQueryLog(): Array<{ query: string; duration: number; timestamp: Date }> {
    return [...this.slowQueryLog];
  }

  /**
   * Log a slow query
   */
  logSlowQuery(query: string, durationMs: number): void {
    if (durationMs >= this.slowQueryThreshold) {
      this.slowQueryLog.push({
        query: query.substring(0, 500), // Truncate long queries
        duration: durationMs,
        timestamp: new Date()
      });

      // Keep log size manageable
      if (this.slowQueryLog.length > this.maxSlowQueryLogSize) {
        this.slowQueryLog.shift();
      }

      console.warn(`[SLOW QUERY ${durationMs}ms] ${query.substring(0, 100)}...`);
    }
  }

  /**
   * Record query execution stats
   */
  recordQueryStats(queryId: string, durationMs: number): void {
    const existing = this.queryStats.get(queryId);
    
    if (existing) {
      existing.totalCalls++;
      existing.avgDurationMs = (existing.avgDurationMs * (existing.totalCalls - 1) + durationMs) / existing.totalCalls;
      existing.slowestDurationMs = Math.max(existing.slowestDurationMs, durationMs);
      existing.lastCalled = new Date();
    } else {
      this.queryStats.set(queryId, {
        query: queryId,
        avgDurationMs: durationMs,
        totalCalls: 1,
        slowestDurationMs: durationMs,
        lastCalled: new Date()
      });
    }

    this.logSlowQuery(queryId, durationMs);
  }

  /**
   * Get top N slowest queries
   */
  getTopSlowQueries(n: number = 10): QueryStats[] {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
      .slice(0, n);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const pool = getPgPool();
    
    const totalQueries = Array.from(this.queryStats.values()).reduce((sum, s) => sum + s.totalCalls, 0);
    const avgQueryTime = totalQueries > 0 
      ? Array.from(this.queryStats.values()).reduce((sum, s) => sum + s.avgDurationMs * s.totalCalls, 0) / totalQueries 
      : 0;

    return {
      totalQueries,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      slowQueries: this.slowQueryLog.length,
      cacheHitRate: 0, // Will be populated from performanceCache
      connectionPoolStats: {
        total: pool?.totalCount || 0,
        idle: pool?.idleCount || 0,
        waiting: pool?.waitingCount || 0
      }
    };
  }

  /**
   * Run VACUUM ANALYZE on critical tables
   */
  async vacuumAnalyzeCriticalTables(): Promise<{ success: string[]; errors: string[] }> {
    const pool = getPgPool();
    if (!pool) return { success: [], errors: ['Database pool not available'] };

    const success: string[] = [];
    const errors: string[] = [];
    
    const criticalTables = [
      'exam_sessions', 'student_answers', 'exam_results', 
      'notifications', 'report_cards', 'audit_logs'
    ];

    for (const table of criticalTables) {
      try {
        await pool.query(`ANALYZE ${table}`);
        success.push(table);
      } catch (error: any) {
        errors.push(`${table}: ${error.message}`);
      }
    }

    return { success, errors };
  }

  /**
   * Periodic cleanup of stale stats
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Clean up old query stats
      for (const [key, stats] of this.queryStats.entries()) {
        if (stats.lastCalled < oneHourAgo) {
          this.queryStats.delete(key);
        }
      }
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.queryStats.clear();
    this.slowQueryLog = [];
  }
}

// Singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

// Export for testing
export { DatabaseOptimizer };
