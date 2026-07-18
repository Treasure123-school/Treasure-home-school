/**
 * Attendance Management Routes
 *
 * Handles recording, updating, and querying attendance records.
 * Extracted from routes.ts for modularity.
 *
 * Routes:
 *   POST   /api/attendance               – record single attendance
 *   POST   /api/attendance/bulk          – bulk-record for a class
 *   GET    /api/attendance/student/:id   – student attendance history
 *   GET    /api/attendance/class/:id     – class attendance for a date
 *   GET    /api/attendance/class/:id/history – class attendance date range
 *   PUT    /api/attendance/:id           – update a single record
 *   GET    /api/attendance/overview      – school-wide summary (Admin)
 *   GET    /api/attendance/trends        – trend chart data (Admin/Teacher)
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { storage } from '../storage';
import { realtimeService } from '../realtime-service';

const router = Router();

// ─── Record single attendance ─────────────────────────────────────────────────
router.post('/api/attendance', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const { studentId, classId, date, status, notes } = req.body;

    if (!studentId || !classId || !date || !status) {
      return res.status(400).json({ message: 'studentId, classId, date, and status are required' });
    }

    const attendanceData = {
      studentId,
      classId,
      date,
      status,
      recordedBy: req.user!.id,
      notes: notes || null
    };

    const newAttendance = await storage.recordAttendance(attendanceData);
    realtimeService.emitAttendanceEvent(classId.toString(), 'marked', { ...newAttendance, recordedBy: req.user!.id });

    res.status(201).json(newAttendance);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to record attendance' });
  }
});

// ─── Bulk-record attendance for a class ───────────────────────────────────────
router.post('/api/attendance/bulk', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'classId, date, and records array are required' });
    }

    // Single batch operation — 1 SELECT + 1 UPDATE + 1 INSERT max (3 round-trips)
    await storage.batchUpsertAttendance(classId, date, req.user!.id, records);

    realtimeService.emitAttendanceEvent(classId.toString(), 'marked', {
      classId, date, count: records.length, recordedBy: req.user!.id,
    });

    res.status(201).json({
      message: `Successfully recorded ${records.length} attendance records`,
      records: [],
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to record bulk attendance' });
  }
});

// ─── Student attendance history ───────────────────────────────────────────────
router.get('/api/attendance/student/:studentId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const { date } = req.query;

    const attendance = await storage.getAttendanceByStudent(studentId, date as string);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student attendance' });
  }
});

// ─── Class attendance for a date ──────────────────────────────────────────────
router.get('/api/attendance/class/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    const { date } = req.query;

    if (isNaN(classId)) return res.status(400).json({ message: 'Invalid class ID' });
    if (!date) return res.status(400).json({ message: 'Date is required' });

    const attendance = await storage.getAttendanceByClass(classId, date as string);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch class attendance' });
  }
});

// ─── Class attendance history (date range) ────────────────────────────────────
router.get('/api/attendance/class/:classId/history', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    const { startDate, endDate } = req.query;

    if (isNaN(classId)) return res.status(400).json({ message: 'Invalid class ID' });
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate are required' });

    const records = await storage.getAttendanceByClassDateRange(classId, startDate as string, endDate as string);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance history' });
  }
});

// ─── Update a single attendance record ───────────────────────────────────────
router.put('/api/attendance/:id', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid attendance ID' });

    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });

    const updated = await storage.updateAttendance(id, { status, notes: notes || null });
    if (!updated) return res.status(404).json({ message: 'Attendance record not found' });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update attendance record' });
  }
});

// ─── School-wide attendance overview (Admin) ─────────────────────────────────
router.get('/api/attendance/overview', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const [allStudents, allClasses, allUsers] = await Promise.all([
      storage.getAllStudents(),
      storage.getAllClasses(),
      storage.getAllUsers(),
    ]);

    const userMap: Record<string, any> = {};
    allUsers.forEach((u: any) => { userMap[u.id] = u; });

    let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalExcused = 0;

    const classBreakdown = await Promise.all(
      allClasses.map(async (cls: any) => {
        const clsStudents = allStudents.filter((s: any) => s.classId === cls.id);
        const attendance = await storage.getAttendanceByClass(cls.id, date);

        const present = attendance.filter((a: any) => a.status === 'Present').length;
        const absent = attendance.filter((a: any) => a.status === 'Absent').length;
        const late = attendance.filter((a: any) => a.status === 'Late').length;
        const excused = attendance.filter((a: any) => a.status === 'Excused').length;

        totalPresent += present;
        totalAbsent += absent;
        totalLate += late;
        totalExcused += excused;

        const firstRecord = attendance[0] as any;
        const recorder = firstRecord?.recordedBy ? userMap[firstRecord.recordedBy] : null;

        return {
          classId: cls.id,
          className: cls.name,
          level: cls.level,
          totalStudents: clsStudents.length,
          present, absent, late, excused,
          attendancePercentage: clsStudents.length > 0
            ? Math.round(((present + late) / clsStudents.length) * 100)
            : 0,
          hasAttendance: attendance.length > 0,
          recordedBy: recorder ? `${recorder.firstName} ${recorder.lastName}` : null,
          recordedAt: firstRecord?.createdAt || null,
        };
      })
    );

    const totalStudents = allStudents.length;
    const attendancePercentage = totalStudents > 0
      ? Math.round(((totalPresent + totalLate) / totalStudents) * 100)
      : 0;

    res.json({
      date,
      totalStudents,
      totalPresent,
      totalAbsent,
      totalLate,
      totalExcused,
      attendancePercentage,
      classBreakdown: classBreakdown.sort((a, b) => a.className.localeCompare(b.className)),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch attendance overview' });
  }
});

// ─── Attendance trends chart data ─────────────────────────────────────────────
router.get('/api/attendance/trends', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const { classId, view = 'daily' } = req.query;
    const now = new Date();
    let startDate: string, endDate: string;

    endDate = now.toISOString().split('T')[0];
    if (view === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    } else if (view === 'weekly') {
      startDate = new Date(now.getTime() - 55 * 86400000).toISOString().split('T')[0];
    } else {
      startDate = new Date(now.getTime() - 13 * 86400000).toISOString().split('T')[0];
    }

    let allRecords: any[] = [];
    if (classId) {
      allRecords = await storage.getAttendanceByClassDateRange(parseInt(classId as string), startDate, endDate);
    } else {
      const allClasses = await storage.getAllClasses();
      const results = await Promise.all(
        allClasses.map((cls: any) => storage.getAttendanceByClassDateRange(cls.id, startDate, endDate))
      );
      allRecords = results.flat();
    }

    const grouped: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};

    allRecords.forEach((record: any) => {
      const d = new Date(record.date);
      let key: string;
      if (view === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (view === 'weekly') {
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        key = ws.toISOString().split('T')[0];
      } else {
        key = record.date;
      }
      if (!grouped[key]) grouped[key] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      const g = grouped[key];
      if (record.status === 'Present') g.present++;
      else if (record.status === 'Absent') g.absent++;
      else if (record.status === 'Late') g.late++;
      else if (record.status === 'Excused') g.excused++;
      g.total++;
    });

    const data = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({
        period,
        label: view === 'monthly'
          ? new Date(period + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          : view === 'weekly'
            ? `Wk ${new Date(period).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
            : new Date(period).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        ...counts,
        percentage: counts.total > 0 ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 0,
      }));

    res.json({ view, startDate, endDate, data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch attendance trends' });
  }
});

export default router;
