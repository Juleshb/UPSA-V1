import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import * as literacy from '../services/literacy.service';
import { asyncHandler } from '../utils/async';

const optionalText = z.string().trim().optional();
const learnerType = z.enum(['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR', 'BORROWER', 'GROUP_MEMBER']);
const scores = z.object({
  budgeting: z.number().min(0).max(100),
  savings: z.number().min(0).max(100),
  credit: z.number().min(0).max(100),
  payments: z.number().min(0).max(100),
  investment: z.number().min(0).max(100),
  consumer: z.number().min(0).max(100),
  digital: z.number().min(0).max(100),
});
const moduleRow = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional().default(''),
  objectives: z.string().trim().optional().default(''),
  content: z.string().trim().optional().default(''),
  durationMinutes: z.number().min(1).max(600).optional().default(30),
  materials: z.string().trim().optional().default(''),
});

function trace(req: { actor?: { id: string; publicId: string }; requestId?: string; ip?: string }) {
  return { actorId: req.actor?.id, actorPublicId: req.actor?.publicId, requestId: req.requestId, ip: req.ip };
}

const publicLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many training requests from this network. Try again shortly.', requestId: req.requestId },
    });
  },
});

const publicPhone = z.string().trim().min(8).max(20);
const publicLanguage = z.enum(['Kinyarwanda', 'English', 'French']);

export const literacyRouter = Router();

literacyRouter.get('/public/courses', asyncHandler(async (_req, res) => {
  res.json({ courses: await literacy.publicCatalogue() });
}));
literacyRouter.post('/public/join', publicLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2),
    phone: publicPhone,
    email: z.union([z.string().trim().email(), z.literal('')]).optional(),
    language: publicLanguage,
  }).parse(req.body);
  res.status(201).json(await literacy.publicJoin({ ...body, email: body.email || undefined }, trace(req)));
}));
literacyRouter.post('/public/continue', publicLimit, asyncHandler(async (req, res) => {
  const body = z.object({ phone: publicPhone }).parse(req.body);
  res.json(await literacy.publicContinue(body.phone));
}));
literacyRouter.post('/public/enrol', publicLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    phone: publicPhone,
    courseId: z.string().trim().min(3),
  }).parse(req.body);
  res.status(201).json(await literacy.publicEnrol(body, trace(req)));
}));
literacyRouter.post('/public/modules', publicLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    phone: publicPhone,
    enrollmentId: z.string().trim().min(3),
    moduleIndex: z.number().int().min(0),
  }).parse(req.body);
  res.json(await literacy.publicComplete(body, trace(req)));
}));
literacyRouter.post('/public/quiz', publicLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    phone: publicPhone,
    enrollmentId: z.string().trim().min(3),
    answers: z.array(z.object({
      id: z.string().trim().min(2),
      choice: z.string().trim().optional(),
      value: z.boolean().optional(),
      matches: z.array(z.string()).optional(),
    })).min(1),
  }).parse(req.body);
  res.json(await literacy.publicQuiz(body, trace(req)));
}));

literacyRouter.use(authenticate);

literacyRouter.get('/summary', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json(await literacy.summary(trace(req)));
}));
literacyRouter.get('/parties', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const query = z.object({ type: learnerType }).parse(req.query);
  res.json(await literacy.listParties(query.type));
}));
literacyRouter.post('/curriculum', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  res.status(201).json(await literacy.installCurriculum(trace(req)));
}));
literacyRouter.post('/simulate', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const body = z.object({ kind: z.string().trim().min(3), input: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])) }).parse(req.body);
  res.json(literacy.simulate(body.kind, body.input));
}));
literacyRouter.get('/reports/:type', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json({ items: await literacy.report(req.params.type) });
}));
literacyRouter.get('/audit', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listAudits() });
}));
literacyRouter.get('/messages', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listMessages() });
}));
literacyRouter.post('/messages', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: optionalText,
    kind: z.string().trim().min(2),
    channel: z.string().trim().min(2),
    subject: z.string().trim().min(2),
    message: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await literacy.sendMessage(body, trace(req)));
}));
literacyRouter.get('/checkpoints/:learnerId', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json(await literacy.checkpoint(req.params.learnerId));
}));

literacyRouter.get('/programmes', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listProgrammes() });
}));
literacyRouter.post('/programmes', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    code: z.string().trim().min(2),
    name: z.string().trim().min(3),
    description: z.string().trim().min(3),
    audience: z.string().trim().min(2),
    category: z.string().trim().min(2),
    language: z.string().trim().min(2),
    deliveryMethod: z.string().trim().min(2),
    duration: z.string().trim().min(1),
    certificationAvailable: z.boolean(),
    validityMonths: z.number().int().min(1).max(60),
    passMark: z.number().min(1).max(100),
    topics: z.array(z.string().trim().min(2)).min(1),
  }).parse(req.body);
  res.status(201).json(await literacy.saveProgramme(body, trace(req)));
}));
literacyRouter.post('/programmes/:id/status', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.string().trim().min(3) }).parse(req.body);
  res.json(await literacy.setProgrammeStatus(req.params.id, body.status, trace(req)));
}));

literacyRouter.get('/courses', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listCourses() });
}));
literacyRouter.post('/courses', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    programmeId: z.string().trim().min(3),
    code: z.string().trim().min(2),
    name: z.string().trim().min(3),
    description: z.string().trim().min(3),
    objectives: z.string().trim().min(3),
    audience: z.string().trim().min(2),
    difficulty: z.string().trim().min(2),
    duration: z.string().trim().min(1),
    assessmentRequired: z.boolean(),
    certificateRequired: z.boolean(),
    passMark: z.number().min(1).max(100),
    materials: optionalText,
    modules: z.array(moduleRow).min(1),
    openForEnrolment: z.boolean().optional(),
  }).parse(req.body);
  res.status(201).json(await literacy.saveCourse(body, trace(req)));
}));
literacyRouter.get('/courses/:id', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json(await literacy.getCourse(req.params.id));
}));
literacyRouter.post('/courses/:id/status', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.string().trim().min(3) }).parse(req.body);
  res.json(await literacy.setCourseStatus(req.params.id, body.status, trace(req)));
}));
literacyRouter.post('/courses/:id/publish', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  res.json(await literacy.publishCourse(req.params.id, trace(req)));
}));

literacyRouter.get('/study', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const query = z.object({ learnerId: optionalText }).parse(req.query);
  res.json(await literacy.studyDesk(req.actor?.id, query.learnerId));
}));
literacyRouter.post('/study/enter', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const body = z.object({ partyId: optionalText }).parse(req.body ?? {});
  res.status(201).json(await literacy.enterStudy(req.actor?.id, body.partyId, trace(req)));
}));
literacyRouter.post('/study/enrol', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const body = z.object({ learnerId: z.string().trim().min(3), courseId: z.string().trim().min(3) }).parse(req.body);
  res.status(201).json(await literacy.selfEnrol(req.actor?.id, body, trace(req)));
}));
literacyRouter.post('/study/enrollments/:id/modules', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const body = z.object({ moduleIndex: z.number().int().min(0) }).parse(req.body);
  res.json(await literacy.completeModule(req.actor?.id, req.params.id, body.moduleIndex, trace(req)));
}));
literacyRouter.post('/study/enrollments/:id/quiz', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const body = z.object({
    answers: z.array(z.object({
      id: z.string().trim().min(2),
      choice: z.string().trim().optional(),
      value: z.boolean().optional(),
      matches: z.array(z.string()).optional(),
    })).min(1),
  }).parse(req.body);
  res.json(await literacy.markQuiz(req.actor?.id, req.params.id, body.answers, trace(req)));
}));

literacyRouter.get('/learners', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  const query = z.object({ learnerType: optionalText, status: optionalText, q: optionalText }).parse(req.query);
  res.json({ items: await literacy.listLearners(query) });
}));
literacyRouter.post('/learners', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerType,
    partyId: optionalText,
    name: optionalText,
    phone: optionalText,
    email: z.union([z.string().trim().email(), z.literal('')]).optional(),
    language: z.string().trim().min(2),
    district: optionalText,
    educationLevel: optionalText,
    occupation: optionalText,
    trainingNeeds: z.string().trim().min(3),
    accessibility: optionalText,
    gender: optionalText,
  }).parse(req.body);
  res.status(201).json(await literacy.saveLearner({ ...body, email: body.email || undefined }, trace(req)));
}));
literacyRouter.get('/learners/:id', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json(await literacy.getLearner(req.params.id));
}));

literacyRouter.get('/trainers', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listTrainers() });
}));
literacyRouter.post('/trainers', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2),
    organization: z.string().trim().min(2),
    qualification: z.string().trim().min(2),
    certification: z.string().trim().min(2),
    expertise: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    email: z.string().trim().email(),
  }).parse(req.body);
  res.status(201).json(await literacy.saveTrainer(body, trace(req)));
}));
literacyRouter.post('/trainers/:id/approval', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  res.json(await literacy.approveTrainer(req.params.id, trace(req)));
}));

literacyRouter.get('/sessions', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listSessions() });
}));
literacyRouter.post('/sessions', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    courseId: z.string().trim().min(3),
    trainerId: optionalText,
    moduleTitle: z.string().trim().min(3),
    sessionDate: z.string().trim().min(8),
    startTime: z.string().trim().min(3),
    endTime: z.string().trim().min(3),
    venue: optionalText,
    onlineLink: optionalText,
    capacity: z.number().int().min(1).max(500),
    language: z.string().trim().min(2),
    audience: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await literacy.saveSession(body, trace(req)));
}));
literacyRouter.post('/sessions/:id/attendance', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    method: z.string().trim().min(2),
    status: z.string().trim().min(3),
    percent: z.number().min(0).max(100),
  }).parse(req.body);
  res.json(await literacy.markAttendance(req.params.id, body, trace(req)));
}));

literacyRouter.post('/enrollments', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    courseId: z.string().trim().min(3),
    deliveryMethod: z.string().trim().min(2),
    trainerName: optionalText,
    startDate: z.string().trim().min(8),
    expectedCompletion: optionalText,
  }).parse(req.body);
  res.status(201).json(await literacy.enrol(body, trace(req)));
}));
literacyRouter.post('/enrollments/:id/assessments', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ kind: z.enum(['PRE', 'POST', 'QUIZ']), scores }).parse(req.body);
  res.status(201).json(await literacy.assess(req.params.id, body, trace(req)));
}));
literacyRouter.post('/enrollments/:id/exercises', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ kind: z.string().trim().min(3), input: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])) }).parse(req.body);
  res.json(await literacy.recordExercise(req.params.id, body.kind, body.input, trace(req)));
}));
literacyRouter.post('/enrollments/:id/certificate', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ certificateType: optionalText }).parse(req.body ?? {});
  res.status(201).json(await literacy.issueCertificate(req.params.id, body, trace(req)));
}));

literacyRouter.get('/certificates', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listCertificates() });
}));
literacyRouter.get('/certificates/:id', requirePermission('literacy.read'), asyncHandler(async (req, res) => {
  res.json(await literacy.verifyCertificate(req.params.id));
}));
literacyRouter.post('/certificates/:id/revocation', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(5) }).parse(req.body);
  res.json(await literacy.revokeCertificate(req.params.id, body.reason, trace(req)));
}));

literacyRouter.get('/retraining', requirePermission('literacy.read'), asyncHandler(async (_req, res) => {
  res.json({ items: await literacy.listRetraining() });
}));
literacyRouter.post('/retraining/:id', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({ status: z.string().trim().min(3), trainerName: optionalText, deadline: optionalText }).parse(req.body);
  res.json(await literacy.assignRetraining(req.params.id, body, trace(req)));
}));

literacyRouter.post('/evidence', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    enrollmentId: optionalText,
    productName: z.string().trim().min(2),
    language: z.string().trim().min(2),
    trainerName: z.string().trim().min(2),
    trainingDate: z.string().trim().min(8),
    materials: z.string().trim().min(2),
    questions: z.string().trim().min(3),
    answers: z.string().trim().min(3),
    productExplained: z.boolean(),
    costExplained: z.boolean(),
    contractExplained: z.boolean(),
    confirmed: z.boolean(),
  }).parse(req.body);
  res.status(201).json(await literacy.saveEvidence(body, trace(req)));
}));
literacyRouter.post('/goals', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    name: z.string().trim().min(2),
    category: z.string().trim().min(2),
    targetAmount: z.number().positive(),
    currentAmount: z.number().min(0),
    monthlyContribution: z.number().min(0),
    targetDate: optionalText,
    priority: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await literacy.saveGoal(body, trace(req)));
}));
literacyRouter.post('/health', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    income: z.number().min(0),
    expenses: z.number().min(0),
    savings: z.number().min(0),
    emergency: z.number().min(0),
    debt: z.number().min(0),
    debtPayment: z.number().min(0),
    insurance: z.boolean(),
    goals: z.number().int().min(0),
  }).parse(req.body);
  res.status(201).json(await literacy.saveHealth(body, trace(req)));
}));
literacyRouter.post('/fraud', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerName: z.string().trim().min(2),
    accountRef: optionalText,
    incidentType: z.string().trim().min(2),
    incidentDate: z.string().trim().min(8),
    amount: z.number().min(0).optional(),
    reference: optionalText,
    channel: z.string().trim().min(2),
    description: z.string().trim().min(5),
    evidence: optionalText,
    reportedTo: z.string().trim().min(2),
    action: z.string().trim().min(2),
  }).parse(req.body);
  res.status(201).json(await literacy.saveFraud(body, trace(req)));
}));
literacyRouter.post('/feedback', requirePermission('literacy.write'), asyncHandler(async (req, res) => {
  const body = z.object({
    learnerId: z.string().trim().min(3),
    courseName: z.string().trim().min(2),
    trainerName: z.string().trim().min(2),
    contentRating: z.number().int().min(1).max(5),
    trainerRating: z.number().int().min(1).max(5),
    practicality: z.number().int().min(1).max(5),
    clarity: z.number().int().min(1).max(5),
    languageRating: z.number().int().min(1).max(5),
    digitalRating: z.number().int().min(1).max(5),
    useful: z.string().trim().min(2),
    least: optionalText,
    suggestions: optionalText,
  }).parse(req.body);
  res.status(201).json(await literacy.saveFeedback(body, trace(req)));
}));
