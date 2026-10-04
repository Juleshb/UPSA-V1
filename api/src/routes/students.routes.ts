import fs from 'fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async';
import { errors } from '../utils/errors';
import { authenticate, requirePermission } from '../middleware/auth';
import * as students from '../services/students.service';
import { acceptUpload, savePendingUpload, schoolUploadPath, uploadContentType } from '../services/uploads';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = z.string().trim().optional();
const studentStatus = z.enum(['APPLICANT', 'ACTIVE', 'TRANSFERRED', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN', 'INACTIVE']);

const guardianSchema = z.object({
  guardianId: optionalText,
  fullName: optionalText,
  phone: optionalText,
  email: z.union([z.string().email(), z.literal('')]).optional(),
  nationalId: optionalText,
  relationship: z.string().trim().min(2),
  primary: z.boolean().optional(),
  emergencyContact: z.boolean().optional(),
  financialResponsibility: z.boolean().optional(),
  communicationAuthorization: z.boolean().optional(),
  paymentAuthorization: z.boolean().optional(),
});

const documentSchema = z.object({
  documentType: z.enum([
    'BIRTH_CERTIFICATE',
    'STUDENT_ID',
    'PREVIOUS_SCHOOL_RECORDS',
    'TRANSFER_CERTIFICATE',
    'MEDICAL',
    'CUSTODY',
    'OTHER',
  ]),
  documentNumber: optionalText,
  issueDate: day.optional(),
  expiryDate: day.optional(),
  fileName: z.string().trim().min(1),
  uploadId: optionalText,
});

const createSchema = z.object({
  schoolId: z.string().min(1),
  studentExternalId: z.string().trim().min(1),
  studentName: z.string().trim().min(2).optional(),
  firstName: optionalText,
  middleName: optionalText,
  lastName: optionalText,
  dateOfBirth: day.optional(),
  gender: z.enum(['FEMALE', 'MALE']).optional(),
  nationality: optionalText,
  photoUploadId: optionalText,
  previousSchool: optionalText,
  admissionDate: day.optional(),
  academicYear: z.string().trim().min(4),
  classLevel: z.string().trim().min(1),
  stream: optionalText,
  grade: optionalText,
  status: studentStatus.optional(),
  feeCategory: optionalText,
  guardianId: optionalText,
  address: z.object({
    province: optionalText,
    district: optionalText,
    sector: optionalText,
    cell: optionalText,
    village: optionalText,
    physicalAddress: optionalText,
    telephone: optionalText,
    emergencyContact: optionalText,
  }).optional(),
  guardians: z.array(guardianSchema).optional(),
  documents: z.array(documentSchema).optional(),
  financial: z.object({
    feeStructure: optionalText,
    scholarship: optionalText,
    discount: z.number().nonnegative().optional(),
    paymentPlan: optionalText,
  }).optional(),
}).superRefine((value, context) => {
  const named = Boolean(value.firstName && value.lastName);
  if (!named && !value.studentName) {
    context.addIssue({ code: 'custom', message: 'Enter the student’s first and last name.', path: ['firstName'] });
  }
});

const updateSchema = z.object({
  studentName: z.string().trim().min(2).optional(),
  studentExternalId: z.string().trim().min(1).optional(),
  academicYear: z.string().trim().min(4).optional(),
  classLevel: z.string().trim().min(1).optional(),
  feeCategory: optionalText,
  status: studentStatus.optional(),
});

async function sendStored(res: import('express').Response, storedName: string, fileName: string) {
  const filePath = schoolUploadPath(storedName);
  if (!filePath) throw errors.notFound('FILE_NOT_STORED', 'This record names a file, but the file itself was not uploaded.');
  await fs.access(filePath);
  res.setHeader('Content-Type', uploadContentType(storedName));
  res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
  res.sendFile(filePath);
}

export const studentsRouter = Router();
studentsRouter.use(authenticate);

studentsRouter.post(
  '/uploads',
  requirePermission('student.write'),
  acceptUpload,
  asyncHandler(async (req, res) => {
    res.status(201).json(await savePendingUpload(req.file));
  }),
);

studentsRouter.post(
  '/',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const created = await students.createStudent({
      ...body,
      guardians: body.guardians?.map((guardian) => ({
        ...guardian,
        email: guardian.email || undefined,
      })),
    });
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
  '/:studentId/registration',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    res.json(await students.getStudentFile(req.params.studentId, req.actor));
  }),
);

studentsRouter.get(
  '/:studentId/photo',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    const storedName = await students.studentPhoto(req.params.studentId, req.actor);
    await sendStored(res, storedName, 'student-photo');
  }),
);

studentsRouter.get(
  '/:studentId/documents/:documentId/file',
  requirePermission('student.read'),
  asyncHandler(async (req, res) => {
    const file = await students.studentDocumentFile(req.params.studentId, req.params.documentId, req.actor);
    await sendStored(res, file.storedName, file.fileName);
  }),
);

studentsRouter.post(
  '/:studentId/guardians',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    const body = guardianSchema.parse(req.body);
    res.status(201).json(await students.addStudentGuardian(req.params.studentId, {
      ...body,
      email: body.email || undefined,
    }));
  }),
);

studentsRouter.post(
  '/:studentId/documents',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await students.addStudentDocument(req.params.studentId, documentSchema.parse(req.body)));
  }),
);

studentsRouter.post(
  '/:studentId/documents/:documentId/review',
  requirePermission('student.write'),
  asyncHandler(async (req, res) => {
    const body = z.object({ verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']) }).parse(req.body);
    res.json(await students.reviewStudentDocument(req.params.studentId, req.params.documentId, body.verificationStatus));
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
