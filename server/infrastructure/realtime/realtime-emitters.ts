/** RealtimeEmitters — domain event emission methods, extracted from realtime-service.ts.
 *  RealtimeService extends this; the abstract core emitters are implemented there. */

export abstract class RealtimeEmitters {
  protected abstract emitEvent(eventType: string, data: any, rooms?: string | string[]): string | undefined;
  protected abstract emitTableChange(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', data: any, oldData?: any, userId?: string): string | undefined;

  emitToUser(userId: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `user:${userId}`);
  }

  emitToRole(role: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `role:${role}`);
  }

  emitToClass(classId: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `class:${classId}`);
  }

  emitToExam(examId: string | number, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `exam:${examId}`);
  }

  emitToReportCard(reportCardId: string | number, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `reportcard:${reportCardId}`);
  }


  emitExamEvent(examId: string | number, eventType: 'started' | 'submitted' | 'graded' | 'timer_tick' | 'auto_submitted', data: any) {
    const fullEventType = `exam.${eventType}`;
    this.emitToExam(examId, fullEventType, { ...data, examId });
    
    if (data.classId) {
      this.emitToClass(data.classId, fullEventType, { ...data, examId });
    }
  }

  // Dedicated method for exam publish/unpublish events
  emitExamPublishEvent(examId: string | number, isPublished: boolean, data: any, userId?: string) {
    const eventType = isPublished ? 'exam.published' : 'exam.unpublished';
    const operation = 'UPDATE';
    
    // Emit table change for cache invalidation
    this.emitTableChange('exams', operation, { ...data, id: examId, isPublished }, undefined, userId);
    
    // Emit specific publish event to exam room
    this.emitToExam(examId, eventType, { ...data, examId, isPublished });
    
    // Notify teachers and admins
    this.emitToRole('teacher', eventType, { ...data, examId, isPublished });
    this.emitToRole('admin', eventType, { ...data, examId, isPublished });
    this.emitToRole('super_admin', eventType, { ...data, examId, isPublished });
    
    // If published, also notify students in the class
    if (isPublished && data.classId) {
      this.emitToClass(data.classId.toString(), eventType, { ...data, examId, isPublished });
    }
    
    console.log(`📤 Emitted ${eventType} for exam ${examId}`);
  }

  emitReportCardEvent(reportCardId: string | number, eventType: 'created' | 'updated' | 'published' | 'finalized' | 'reverted', data: any, userId?: string) {
    const fullEventType = `reportcard.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : 'UPDATE';
    
    // Emit table change for cache invalidation across all subscribers
    this.emitTableChange('report_cards', operation, { ...data, id: reportCardId }, undefined, userId);
    
    // Emit to specific report card room
    this.emitToReportCard(reportCardId, fullEventType, data);
    
    // Always notify teachers and admins about all report card changes
    this.emitToRole('teacher', fullEventType, { ...data, reportCardId });
    this.emitToRole('admin', fullEventType, { ...data, reportCardId });
    this.emitToRole('super_admin', fullEventType, { ...data, reportCardId });
    
    // Notify the student directly
    if (data.studentId) {
      this.emitToUser(data.studentId, fullEventType, data);
    }
    
    // Notify class subscribers
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
    
    // For published reports, also notify parents of the student
    // This ensures parents see real-time updates when report cards become available
    if (eventType === 'published' && data.studentId && data.parentIds) {
      const parentIds = Array.isArray(data.parentIds) ? data.parentIds : [data.parentIds];
      parentIds.forEach((parentId: string) => {
        this.emitToUser(parentId, fullEventType, { 
          ...data, 
          message: 'A new report card has been published for your child'
        });
      });
    }
    
    console.log(`📤 Emitted reportcard.${eventType} for report card ${reportCardId} (student: ${data.studentId || 'unknown'})`);
  }
  
  // Bulk emit for status changes affecting multiple report cards
  emitBulkReportCardStatusChange(reportCardIds: (string | number)[], newStatus: 'finalized' | 'published' | 'draft', classId: string, termId: number, userId?: string) {
    const eventType = newStatus === 'published' ? 'bulk_published' : 
                      newStatus === 'finalized' ? 'bulk_finalized' : 'bulk_reverted';
    const fullEventType = `reportcard.${eventType}`;
    
    const data = {
      reportCardIds,
      newStatus,
      classId,
      termId,
      count: reportCardIds.length,
      timestamp: Date.now()
    };
    
    // Notify teachers and admins about bulk changes
    this.emitToRole('teacher', fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('super_admin', fullEventType, data);
    
    // Notify the class about bulk changes
    this.emitToClass(classId.toString(), fullEventType, data);
    
    // Emit table change for cache invalidation
    this.emitTableChange('report_cards', 'UPDATE', data, undefined, userId);
    
    console.log(`📤 Emitted ${fullEventType} for ${reportCardIds.length} report cards in class ${classId}`);
  }

  emitUserEvent(userId: string, eventType: 'created' | 'updated' | 'deleted', data: any, role?: string) {
    const fullEventType = `user.${eventType}`;
    
    this.emitTableChange('users', eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE', data, undefined, userId);
    
    if (role) {
      this.emitToRole('admin', fullEventType, data);
      this.emitToRole('super_admin', fullEventType, data);
    }
  }

  emitAttendanceEvent(classId: string, eventType: 'marked' | 'updated', data: any) {
    const fullEventType = `attendance.${eventType}`;
    this.emitToClass(classId, fullEventType, data);
    this.emitTableChange('attendance', eventType === 'marked' ? 'INSERT' : 'UPDATE', data);
  }

  emitNotification(userId: string, notification: { title: string; message: string; type?: string }) {
    this.emitToUser(userId, 'notification', notification);
  }

  emitUploadProgress(userId: string, uploadId: string, progress: number, status: 'uploading' | 'completed' | 'failed', url?: string) {
    this.emitToUser(userId, 'upload.progress', {
      uploadId,
      progress,
      status,
      url,
    });
  }

  // Enhanced helper methods for consistent event emission across all modules

  emitClassEvent(classId: string, eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `class.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('classes', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitSubjectEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `subject.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('subjects', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
  }

  emitAnnouncementEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `announcement.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('announcements', operation, data, undefined, userId);
    
    // Security: Define valid role mappings - only these roles can receive announcements
    // Map announcement targetRole strings to authoritative room names
    const VALID_ROLE_ROOMS: Record<string, string> = {
      'student': 'student',
      'teacher': 'teacher',
      'parent': 'parent',
      'admin': 'admin',
      'superadmin': 'superadmin',
      // Case variations for safety
      'Student': 'student',
      'Teacher': 'teacher',
      'Parent': 'parent',
      'Admin': 'admin',
      'SuperAdmin': 'superadmin'
    };
    
    // All valid authenticated role rooms
    const ALL_AUTHENTICATED_ROLES = ['admin', 'superadmin', 'teacher', 'student', 'parent'];
    
    // Broadcast to target roles only (no public broadcasts for security)
    if (data.targetRole && typeof data.targetRole === 'string') {
      // Map to authorized room name, reject if not in whitelist
      const targetRoom = VALID_ROLE_ROOMS[data.targetRole];
      if (targetRoom) {
        this.emitToRole(targetRoom, fullEventType, data);
        // Also emit to admin/superadmin so they always see all announcements
        this.emitToRole('admin', fullEventType, data);
        this.emitToRole('superadmin', fullEventType, data);
      }
      // If targetRole not in whitelist, don't emit (security: reject unknown roles)
    } else {
      // When no specific target role, broadcast to ALL authenticated roles (not public)
      // This ensures announcements reach all authenticated users but not unauthenticated ones
      ALL_AUTHENTICATED_ROLES.forEach(role => {
        this.emitToRole(role, fullEventType, data);
      });
    }
  }

  emitStudentEvent(classId: string | null, eventType: 'created' | 'updated' | 'deleted' | 'enrolled', data: any, userId?: string) {
    const fullEventType = `student.${eventType}`;
    const operation = eventType === 'created' || eventType === 'enrolled' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('students', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitGradingEvent(examId: string | number, eventType: 'reviewed' | 'score_updated' | 'completed', data: any, userId?: string) {
    const fullEventType = `grading.${eventType}`;
    
    this.emitTableChange('student_answers', 'UPDATE', data, undefined, userId);
    this.emitToExam(examId, fullEventType, data);
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitMessageEvent(senderId: string, recipientId: string, eventType: 'sent' | 'read', data: any) {
    const fullEventType = `message.${eventType}`;
    
    this.emitTableChange('messages', eventType === 'sent' ? 'INSERT' : 'UPDATE', data, undefined, senderId);
    this.emitToUser(recipientId, fullEventType, data);
    this.emitToUser(senderId, `message.${eventType === 'sent' ? 'delivered' : 'read_confirmation'}`, data);
  }

  emitHomepageContentEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `homepage.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('homepage_content', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    // Also emit publicly for frontend cache invalidation
    this.emitEvent(fullEventType, { id: data.id, contentType: data.contentType });
  }

  emitStudyResourceEvent(classId: string | null, eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `study_resource.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('study_resources', operation, data, undefined, userId);
    this.emitToRole('teacher', fullEventType, data);
    
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitExamSessionEvent(examId: string | number, sessionId: string | number, eventType: 'started' | 'progress' | 'completed' | 'auto_submitted', data: any, userId?: string) {
    const fullEventType = `examSession.${eventType}`;
    
    this.emitTableChange('exam_sessions', eventType === 'started' ? 'INSERT' : 'UPDATE', data, undefined, userId);
    this.emitToExam(examId, fullEventType, { sessionId, ...data });
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, { sessionId, ...data });
    }
  }

  emitExamResultEvent(examId: string | number, eventType: 'created' | 'updated' | 'graded', data: any, userId?: string) {
    const fullEventType = `examResult.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : 'UPDATE';
    
    this.emitTableChange('exam_results', operation, data, undefined, userId);
    this.emitToExam(examId, fullEventType, data);
    
    // Notify the student
    if (data.studentId) {
      this.emitToUser(data.studentId.toString(), fullEventType, data);
    }
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitTeacherAssignmentEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `teacherAssignment.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('teacher_assignments', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    
    if (data.teacherId) {
      this.emitToUser(data.teacherId.toString(), fullEventType, data);
    }
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitParentLinkEvent(parentId: string, studentId: string, eventType: 'linked' | 'unlinked', data: any, userId?: string) {
    const fullEventType = `parentLink.${eventType}`;
    const operation = eventType === 'linked' ? 'INSERT' : 'DELETE';
    
    this.emitTableChange('parent_student_links', operation, data, undefined, userId);
    this.emitToUser(parentId, fullEventType, data);
    this.emitToUser(studentId, fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
  }

  emitSystemSettingEvent(eventType: 'updated', data: any, userId?: string) {
    const fullEventType = `system.settings_${eventType}`;
    
    this.emitTableChange('system_settings', 'UPDATE', data, undefined, userId);
    this.emitToRole('super_admin', fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
    // Emit publicly for theme/branding changes
    if (data.key && ['schoolName', 'schoolLogo', 'primaryColor', 'secondaryColor'].includes(data.key)) {
      this.emitEvent(`system.branding_${eventType}`, { key: data.key, value: data.value });
    }
  }

  // Dashboard stats emission for real-time dashboard updates
  emitDashboardStats(role: string, stats: any) {
    this.emitToRole(role, 'dashboard.stats_updated', stats);
  }

  // Grading settings event for real-time config updates
  emitGradingSettingsEvent(eventType: 'updated', data: any, userId?: string) {
    const fullEventType = `grading_settings.${eventType}`;
    
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('super_admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
    
    this.emitEvent('grading_settings.changed', {
      testWeight: data.testWeight,
      examWeight: data.examWeight,
      gradingScale: data.gradingScale,
      timestamp: Date.now()
    });
    
    console.log(`📤 Emitted ${fullEventType} - Test: ${data.testWeight}%, Exam: ${data.examWeight}%`);
  }

  // Enhanced student-specific report card subscription
  emitStudentReportCardUpdate(studentId: string, reportCardId: number | string, eventType: string, data: any) {
    const fullEventType = `reportcard.${eventType}`;
    
    this.emitToUser(studentId, fullEventType, data);
    this.emitToReportCard(reportCardId, fullEventType, data);
    
    if (data.parentId) {
      this.emitToUser(data.parentId, fullEventType, data);
    }
    
    console.log(`📤 Emitted student report card update for student ${studentId}`);
  }

}
