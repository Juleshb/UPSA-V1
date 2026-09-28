import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { authenticate, requirePermission } from '../middleware/auth';
import * as students from '../services/students.service';

const createSchema = z.object({
  schoolId: z.string(),
  studentExternalId: z.string().min(1),
  studentName: z.string().min(2),
  academicYear: z.string().min(4),
  classLevel: z.string().min(1),
  guardianId: z.string().optional(),
  feeCategory: z.string().optional(),
});

const updateSchema = z.object({
  studentName: z.string().min(2).optional(),
  studentExternalId: z.string().min(1).optional(),
  academicYear: z.string().min(4).optional(),
  classLevel: z.string().min(1).optional(),
  feeCategory: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED']).optional(),
});

export const studentsRouter = Router();
studentsRouter.use(authenticate);

studentsRouter.post(
  '/',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    const created = await students.createStudent(createSchema.parse(req.body));
    res.status(201).json(created);
  }),
);

studentsRouter.get(
  '/',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    const schoolId = typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined;
    res.json({ items: await students.listStudents(schoolId, req.actor) });
  }),
);

studentsRouter.get(
  '/:studentId',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    res.json(await students.getStudent(req.params.studentId, req.actor));
  }),
);

studentsRouter.patch(
  '/:studentId',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    res.json(await students.updateStudent(req.params.studentId, updateSchema.parse(req.body)));
  }),
);

studentsRouter.delete(
  '/:studentId',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    res.json(await students.deactivateStudent(req.params.studentId));
  }),
);

studentsRouter.get(
  '/:studentId/financial-summary',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    res.json(await students.financialSummary(req.params.studentId, req.actor));
  }),
);
