import { Prisma } from '@prisma/client';
import { actorLabel, day, iso, queueNotice, type Trace } from './donations/shared';
import { errors } from '../utils/errors';
import { writeAudit } from '../utils/events';
import { nextPublicId } from '../utils/ids';
import { decimal, money } from '../utils/money';
import { prisma } from '../utils/prisma';

export const LEARNER_TYPES = ['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR', 'BORROWER', 'GROUP_MEMBER'] as const;
export const LANGUAGES = ['Kinyarwanda', 'English', 'French'] as const;
export const AREAS = ['budgeting', 'savings', 'credit', 'payments', 'investment', 'consumer', 'digital'] as const;
const OPEN_COURSE = ['PUBLISHED', 'ACTIVE'];
const FLOW = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
const NEXT: Record<string, string[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['ACTIVE', 'SUSPENDED'],
  ACTIVE: ['SUSPENDED', 'RETIRED'],
  SUSPENDED: ['ACTIVE', 'RETIRED'],
  RETIRED: [],
};

const TOPICS = [
  'Money and budgeting',
  'Savings and emergency funds',
  'Digital payments and banking',
  'Credit and the cost of borrowing',
  'Responsible borrowing and repayment',
  'Collateral, guarantees, and the 40/60 security explanation',
  'Investment education',
  'Insurance and financial resilience',
  'Consumer protection and complaints',
  'Fraud prevention',
  'School financial management',
  'Parent, student, teacher, and supplier capability',
];

type Scores = Record<(typeof AREAS)[number], number>;
type ModuleRow = { title: string; description: string; objectives: string; content: string; durationMinutes: number; materials: string };
type StoredQuestion =
  | { id: string; kind: 'MULTIPLE_CHOICE'; prompt: string; options: string[]; answer: string }
  | { id: string; kind: 'TRUE_FALSE'; prompt: string; answer: boolean }
  | { id: string; kind: 'MATCHING'; prompt: string; pairs: { left: string; right: string }[] };
type QuizAnswer = { id: string; choice?: string; value?: boolean; matches?: string[] };

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function readModules(value: unknown): ModuleRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    if (title.length < 3) return [];
    return [{
      title,
      description: String(row.description ?? '').trim(),
      objectives: String(row.objectives ?? '').trim(),
      content: String(row.content ?? '').trim(),
      durationMinutes: Number(row.durationMinutes ?? 30) || 30,
      materials: String(row.materials ?? '').trim(),
    }];
  });
}

function readQuestions(value: unknown): StoredQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StoredQuestion[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const prompt = String(row.prompt ?? '').trim();
    if (id.length < 2 || prompt.length < 3) return [];
    if (row.kind === 'MULTIPLE_CHOICE' && Array.isArray(row.options)) {
      const options = row.options.map((option) => String(option).trim()).filter((option) => option.length > 0);
      const answer = String(row.answer ?? '').trim();
      if (options.length < 2 || !options.includes(answer)) return [];
      return [{ id, kind: 'MULTIPLE_CHOICE' as const, prompt, options, answer }];
    }
    if (row.kind === 'TRUE_FALSE' && typeof row.answer === 'boolean') {
      return [{ id, kind: 'TRUE_FALSE' as const, prompt, answer: row.answer }];
    }
    if (row.kind === 'MATCHING' && Array.isArray(row.pairs)) {
      const pairs = row.pairs.flatMap((pair) => {
        if (!pair || typeof pair !== 'object') return [];
        const left = String((pair as { left?: unknown }).left ?? '').trim();
        const right = String((pair as { right?: unknown }).right ?? '').trim();
        if (left.length < 2 || right.length < 2) return [];
        return [{ left, right }];
      });
      if (pairs.length < 1) return [];
      return [{ id, kind: 'MATCHING' as const, prompt, pairs }];
    }
    return [];
  });
}

function buildQuiz(modules: ModuleRow[]): StoredQuestion[] {
  const first = modules[0];
  if (!first) return [];
  const second = modules[1];
  const wrong = [
    'Share a PIN or one-time code when a message asks for it.',
    'The certificate is issued before the questions are marked.',
    second && second.content !== first.content ? second.content : 'Skipping the modules still earns the certificate.',
  ].filter((option, index, all) => option !== first.content && all.indexOf(option) === index).slice(0, 2);
  const pairs = (modules.length > 1 ? modules : [first, { ...first, title: `${first.title} review`, objectives: first.content }]).slice(0, 3);
  return [
    {
      id: 'choice',
      kind: 'MULTIPLE_CHOICE',
      prompt: `Which statement belongs to “${first.title}”?`,
      options: [first.content, ...wrong],
      answer: first.content,
    },
    { id: 'true', kind: 'TRUE_FALSE', prompt: first.objectives, answer: true },
    { id: 'false', kind: 'TRUE_FALSE', prompt: 'The certificate is issued before the questions are marked.', answer: false },
    {
      id: 'match',
      kind: 'MATCHING',
      prompt: 'Match each part of the course with what it teaches.',
      pairs: pairs.map((module) => ({ left: module.title, right: module.objectives || module.content })),
    },
  ];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function presentQuiz(questions: StoredQuestion[]) {
  return questions.map((question) => {
    if (question.kind === 'MULTIPLE_CHOICE') {
      return { id: question.id, kind: question.kind, prompt: question.prompt, options: shuffle(question.options) };
    }
    if (question.kind === 'TRUE_FALSE') return { id: question.id, kind: question.kind, prompt: question.prompt };
    return {
      id: question.id,
      kind: question.kind,
      prompt: question.prompt,
      left: question.pairs.map((pair) => pair.left),
      right: shuffle(question.pairs.map((pair) => pair.right)),
    };
  });
}

function questionCorrect(question: StoredQuestion, answer: QuizAnswer | undefined) {
  if (!answer) return false;
  if (question.kind === 'MULTIPLE_CHOICE') return answer.choice?.trim() === question.answer;
  if (question.kind === 'TRUE_FALSE') return answer.value === question.answer;
  const chosen = answer.matches ?? [];
  return question.pairs.length > 0 && question.pairs.every((pair, index) => chosen[index]?.trim() === pair.right);
}

function readMark(exercises: unknown) {
  if (!Array.isArray(exercises)) return null;
  const marks = exercises.filter((item) => item && typeof item === 'object' && (item as { kind?: string }).kind === 'QUIZ_MARK');
  const last = marks.at(-1) as { percentage?: number; passed?: boolean; correct?: number; total?: number; items?: { prompt: string; correct: boolean }[] } | undefined;
  if (!last || typeof last.percentage !== 'number') return null;
  return {
    percentage: last.percentage,
    passed: Boolean(last.passed),
    correct: Number(last.correct ?? 0),
    total: Number(last.total ?? 0),
    items: Array.isArray(last.items) ? last.items : [],
  };
}

function readScores(value: Scores): Scores {
  const scores = {} as Scores;
  for (const area of AREAS) {
    const score = Number(value[area]);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw errors.unprocessable('SCORE_INVALID', 'Each area score is a number from 0 to 100.');
    }
    scores[area] = round2(score);
  }
  return scores;
}

function average(scores: Scores) {
  const total = AREAS.reduce((sum, area) => sum + scores[area], 0);
  return round2(total / AREAS.length);
}

function ends(scores: Scores) {
  const ranked = [...AREAS].sort((left, right) => scores[left] - scores[right]);
  return { weakest: ranked[0], strongest: ranked[ranked.length - 1] };
}

async function audit(trace: Trace, action: string, reference: string, detail?: string, learnerId?: string | null) {
  const actorName = await actorLabel(trace.actorId);
  await prisma.literacyAudit.create({
    data: {
      publicId: await nextPublicId('LAU'),
      learnerId: learnerId ?? null,
      action,
      actorId: trace.actorId ?? null,
      actorName,
      reference,
      detail: detail ?? null,
      ip: trace.ip ?? null,
    },
  });
  await writeAudit({
    actorId: trace.actorId,
    action,
    entityType: 'Literacy',
    entityId: reference,
    requestId: trace.requestId,
    metadata: detail ? { detail } : undefined,
  });
  return actorName;
}

async function learnerByPublicId(id: string) {
  const row = await prisma.literacyLearner.findUnique({ where: { publicId: id } });
  if (!row) throw errors.notFound('LEARNER_NOT_FOUND', 'Learner not found.');
  return row;
}

async function courseByPublicId(id: string) {
  const row = await prisma.literacyCourse.findUnique({ where: { publicId: id }, include: { programme: true } });
  if (!row) throw errors.notFound('COURSE_NOT_FOUND', 'Course not found.');
  return row;
}

function presentProgramme(row: {
  publicId: string; code: string; name: string; description: string; audience: string; category: string;
  language: string; deliveryMethod: string; duration: string; moduleCount: number; certificationAvailable: boolean;
  validityMonths: number; passMark: Prisma.Decimal; topics: Prisma.JsonValue; status: string; createdAt: Date;
  courses?: { publicId: string; name: string; status: string }[];
}) {
  return {
    id: row.publicId,
    code: row.code,
    name: row.name,
    description: row.description,
    audience: row.audience,
    category: row.category,
    language: row.language,
    deliveryMethod: row.deliveryMethod,
    duration: row.duration,
    moduleCount: row.moduleCount,
    certificationAvailable: row.certificationAvailable,
    validityMonths: row.validityMonths,
    passMark: money(row.passMark),
    topics: Array.isArray(row.topics) ? row.topics : [],
    status: row.status,
    createdAt: iso(row.createdAt),
    courses: row.courses?.map((course) => ({ id: course.publicId, name: course.name, status: course.status })) ?? [],
  };
}

function presentCourse(row: {
  publicId: string; code: string; name: string; description: string; objectives: string; audience: string;
  difficulty: string; duration: string; lessonCount: number; assessmentRequired: boolean; certificateRequired: boolean;
  passMark: Prisma.Decimal; version: string; effectiveDate: Date | null; reviewDate: Date | null; modules: Prisma.JsonValue;
  materials: string | null; status: string; programme: { publicId: string; name: string; validityMonths: number };
}) {
  return {
    id: row.publicId,
    programmeId: row.programme.publicId,
    programmeName: row.programme.name,
    validityMonths: row.programme.validityMonths,
    code: row.code,
    name: row.name,
    description: row.description,
    objectives: row.objectives,
    audience: row.audience,
    difficulty: row.difficulty,
    duration: row.duration,
    lessonCount: row.lessonCount,
    assessmentRequired: row.assessmentRequired,
    certificateRequired: row.certificateRequired,
    passMark: money(row.passMark),
    version: row.version,
    effectiveDate: iso(row.effectiveDate),
    reviewDate: iso(row.reviewDate),
    modules: readModules(row.modules),
    materials: row.materials,
    status: row.status,
  };
}

export async function summary(trace: Trace) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.literacyCertificate.updateMany({ where: { status: { in: ['ACTIVE', 'EXPIRING', 'ISSUED'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  await prisma.literacyCertificate.updateMany({ where: { status: { in: ['ACTIVE', 'ISSUED'] }, expiresAt: { gte: now, lte: soon } }, data: { status: 'EXPIRING' } });
  const [learners, programmes, courses, enrollments, sessions, attendance, certificates, retraining, posts] = await Promise.all([
    prisma.literacyLearner.count(),
    prisma.literacyProgramme.count(),
    prisma.literacyCourse.count({ where: { status: { in: OPEN_COURSE } } }),
    prisma.literacyEnrollment.groupBy({ by: ['status'], _count: true }),
    prisma.literacySession.count({ where: { status: 'SCHEDULED', sessionDate: { gte: now } } }),
    prisma.literacyAttendance.groupBy({ by: ['status'], _count: true }),
    prisma.literacyCertificate.count({ where: { status: { in: ['ACTIVE', 'ISSUED', 'EXPIRING'] } } }),
    prisma.literacyRetraining.count({ where: { status: { in: ['REQUIRED', 'ASSIGNED'] } } }),
    prisma.literacyAssessment.findMany({ where: { kind: 'POST' }, select: { percentage: true, scores: true, result: true } }),
  ]);
  const enrollmentCount = enrollments.reduce((sum, row) => sum + row._count, 0);
  const completed = enrollments.find((row) => row.status === 'COMPLETED')?._count ?? 0;
  const pending = enrollments.filter((row) => row.status === 'ENROLLED' || row.status === 'IN_PROGRESS').reduce((sum, row) => sum + row._count, 0);
  const present = attendance.filter((row) => row.status === 'PRESENT' || row.status === 'PARTIAL').reduce((sum, row) => sum + row._count, 0);
  const attendanceTotal = attendance.reduce((sum, row) => sum + row._count, 0);
  const passed = posts.filter((row) => row.result === 'PASSED').length;
  const areaAverage = (area: (typeof AREAS)[number]) => {
    if (!posts.length) return 0;
    const total = posts.reduce((sum, row) => sum + Number((row.scores as Scores)?.[area] ?? 0), 0);
    return round2(total / posts.length);
  };
  void trace;
  return {
    learners,
    programmes,
    courses,
    pending,
    completed,
    sessions,
    certificates,
    expiring: await prisma.literacyCertificate.count({ where: { status: 'EXPIRING' } }),
    retraining,
    completionRate: enrollmentCount ? round2((completed / enrollmentCount) * 100) : 0,
    attendanceRate: attendanceTotal ? round2((present / attendanceTotal) * 100) : 0,
    passRate: posts.length ? round2((passed / posts.length) * 100) : 0,
    averageScore: posts.length ? round2(posts.reduce((sum, row) => sum + money(row.percentage), 0) / posts.length) : 0,
    consumer: areaAverage('consumer'),
    digital: areaAverage('digital'),
    credit: areaAverage('credit'),
    savings: areaAverage('savings'),
  };
}

export async function listParties(type: string) {
  if (!LEARNER_TYPES.includes(type as (typeof LEARNER_TYPES)[number])) {
    throw errors.unprocessable('LEARNER_TYPE_INVALID', 'Choose a learner type that already exists on the platform.');
  }
  if (type === 'PARENT') {
    const guardians = await prisma.guardian.findMany({ orderBy: { fullName: 'asc' }, take: 200, select: { publicId: true, fullName: true, phone: true, email: true } });
    return { parties: guardians.map((row) => ({ id: row.publicId, name: row.fullName, phone: row.phone, email: row.email, detail: 'Parent' })) };
  }
  if (type === 'STUDENT') {
    const students = await prisma.student.findMany({
      orderBy: { studentName: 'asc' },
      take: 200,
      select: { publicId: true, studentName: true, telephone: true, school: { select: { schoolName: true } } },
    });
    return { parties: students.map((row) => ({ id: row.publicId, name: row.studentName, phone: row.telephone, email: null, detail: row.school.schoolName })) };
  }
  if (type === 'TEACHER' || type === 'SUPPLIER' || type === 'INVESTOR' || type === 'DONOR') {
    const registrations = await prisma.registration.findMany({
      where: { kind: type },
      orderBy: { displayName: 'asc' },
      take: 200,
      select: { publicId: true, displayName: true, phone: true, email: true, kind: true },
    });
    return { parties: registrations.map((row) => ({ id: row.publicId, name: row.displayName, phone: row.phone, email: row.email, detail: row.kind })) };
  }
  const schools = await prisma.school.findMany({
    orderBy: { schoolName: 'asc' },
    take: 200,
    select: { publicId: true, schoolName: true, phone: true, email: true, district: true },
  });
  return { parties: schools.map((row) => ({ id: row.publicId, name: row.schoolName, phone: row.phone, email: row.email, detail: row.district })) };
}

async function linkedParty(type: string, partyId?: string) {
  if (!partyId) return { schoolId: undefined as string | undefined, guardianId: undefined as string | undefined, studentId: undefined as string | undefined, registrationId: undefined as string | undefined, name: '', phone: '', email: '', district: '' };
  if (type === 'PARENT') {
    const guardian = await prisma.guardian.findUnique({ where: { publicId: partyId } });
    if (!guardian) throw errors.notFound('PARTY_NOT_FOUND', 'Parent not found.');
    return { guardianId: guardian.id, name: guardian.fullName, phone: guardian.phone, email: guardian.email ?? '', district: '' };
  }
  if (type === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { publicId: partyId }, include: { school: true } });
    if (!student) throw errors.notFound('PARTY_NOT_FOUND', 'Student not found.');
    return { studentId: student.id, schoolId: student.schoolId, name: student.studentName, phone: student.telephone ?? '', email: '', district: student.school.district ?? '' };
  }
  if (type === 'TEACHER' || type === 'SUPPLIER' || type === 'INVESTOR' || type === 'DONOR') {
    const registration = await prisma.registration.findUnique({ where: { publicId: partyId } });
    if (!registration || registration.kind !== type) throw errors.notFound('PARTY_NOT_FOUND', 'Registration not found for this learner type.');
    return { registrationId: registration.id, schoolId: registration.schoolId ?? undefined, name: registration.displayName, phone: registration.phone, email: registration.email ?? '', district: '' };
  }
  const school = await prisma.school.findUnique({ where: { publicId: partyId } });
  if (!school) throw errors.notFound('PARTY_NOT_FOUND', 'School not found.');
  return { schoolId: school.id, name: school.schoolName, phone: school.phone ?? '', email: school.email ?? '', district: school.district ?? '' };
}

export async function saveLearner(input: {
  learnerType: string;
  partyId?: string;
  name?: string;
  phone?: string;
  email?: string;
  language: string;
  district?: string;
  educationLevel?: string;
  occupation?: string;
  trainingNeeds: string;
  accessibility?: string;
  gender?: string;
}, trace: Trace) {
  if (!LEARNER_TYPES.includes(input.learnerType as (typeof LEARNER_TYPES)[number])) {
    throw errors.unprocessable('LEARNER_TYPE_INVALID', 'Choose a learner type that already exists on the platform.');
  }
  if (!LANGUAGES.includes(input.language as (typeof LANGUAGES)[number])) {
    throw errors.unprocessable('LANGUAGE_INVALID', 'Language is Kinyarwanda, English, or French.');
  }
  const party = await linkedParty(input.learnerType, input.partyId);
  const name = (input.name || party.name || '').trim();
  const phone = (input.phone || party.phone || '').trim();
  if (name.length < 2 || phone.length < 6) throw errors.unprocessable('LEARNER_INCOMPLETE', 'Name and phone are required.');
  const where = {
    learnerType: input.learnerType,
    schoolId: party.schoolId ?? null,
    guardianId: party.guardianId ?? null,
    studentId: party.studentId ?? null,
    registrationId: party.registrationId ?? null,
  };
  const existing = input.partyId
    ? await prisma.literacyLearner.findFirst({ where })
    : null;
  const data = {
    name,
    phone,
    email: input.email?.trim() || party.email || null,
    language: input.language,
    district: input.district?.trim() || party.district || null,
    educationLevel: input.educationLevel?.trim() || null,
    occupation: input.occupation?.trim() || null,
    trainingNeeds: input.trainingNeeds.trim(),
    accessibility: input.accessibility?.trim() || null,
    gender: input.gender?.trim() || null,
  };
  const row = existing
    ? await prisma.literacyLearner.update({ where: { id: existing.id }, data })
    : await prisma.literacyLearner.create({
      data: { publicId: await nextPublicId('LLN'), status: 'REGISTERED', ...where, ...data },
    });
  await audit(trace, existing ? 'LEARNER_UPDATED' : 'LEARNER_REGISTERED', row.publicId, input.learnerType, row.id);
  return getLearner(row.publicId);
}

function presentLearner(row: {
  publicId: string; learnerType: string; name: string; phone: string; email: string | null; language: string;
  district: string | null; educationLevel: string | null; occupation: string | null; trainingNeeds: string;
  accessibility: string | null; gender: string | null; status: string; createdAt: Date;
  school: { publicId: string; schoolName: string } | null;
  guardian: { publicId: string } | null;
  student: { publicId: string } | null;
  registration: { publicId: string } | null;
}) {
  return {
    id: row.publicId,
    learnerType: row.learnerType,
    name: row.name,
    phone: row.phone,
    email: row.email,
    language: row.language,
    district: row.district,
    educationLevel: row.educationLevel,
    occupation: row.occupation,
    trainingNeeds: row.trainingNeeds,
    accessibility: row.accessibility,
    gender: row.gender,
    status: row.status,
    createdAt: iso(row.createdAt),
    partyId: row.school?.publicId ?? row.guardian?.publicId ?? row.student?.publicId ?? row.registration?.publicId ?? null,
    schoolName: row.school?.schoolName ?? null,
  };
}

const learnerInclude = {
  school: { select: { publicId: true, schoolName: true } },
  guardian: { select: { publicId: true } },
  student: { select: { publicId: true } },
  registration: { select: { publicId: true } },
} as const;

export async function listLearners(query: { learnerType?: string; status?: string; q?: string }) {
  const rows = await prisma.literacyLearner.findMany({
    where: {
      learnerType: query.learnerType || undefined,
      status: query.status || undefined,
      OR: query.q ? [
        { name: { contains: query.q, mode: 'insensitive' } },
        { publicId: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
      ] : undefined,
    },
    include: learnerInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(presentLearner);
}

export async function getLearner(id: string) {
  const row = await prisma.literacyLearner.findUnique({
    where: { publicId: id },
    include: {
      ...learnerInclude,
      enrollments: { include: { course: { include: { programme: true } }, certificate: true }, orderBy: { createdAt: 'desc' } },
      certificates: { orderBy: { issuedAt: 'desc' } },
      retrainings: { orderBy: { createdAt: 'desc' } },
      goals: { orderBy: { createdAt: 'desc' } },
      healthChecks: { orderBy: { createdAt: 'desc' }, take: 5 },
      evidence: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!row) throw errors.notFound('LEARNER_NOT_FOUND', 'Learner not found.');
  return {
    ...presentLearner(row),
    enrollments: row.enrollments.map((item) => ({
      id: item.publicId,
      courseId: item.course.publicId,
      courseName: item.course.name,
      courseCode: item.course.code,
      status: item.status,
      progress: money(item.progress),
      preScore: item.preScore == null ? null : money(item.preScore),
      postScore: item.postScore == null ? null : money(item.postScore),
      weakest: item.weakest,
      strongest: item.strongest,
      passMark: money(item.course.passMark),
      deliveryMethod: item.deliveryMethod,
      trainerName: item.trainerName,
      certificateId: item.certificate?.publicId ?? null,
    })),
    certificates: row.certificates.map(presentCertificate),
    retrainings: row.retrainings.map((item) => ({
      id: item.publicId, reason: item.reason, previousCourse: item.previousCourse, modules: item.modules,
      deadline: iso(item.deadline), trainerName: item.trainerName, status: item.status,
    })),
    goals: row.goals.map((item) => ({
      id: item.publicId, name: item.name, category: item.category, targetAmount: money(item.targetAmount),
      currentAmount: money(item.currentAmount), monthlyContribution: money(item.monthlyContribution),
      targetDate: iso(item.targetDate), priority: item.priority, status: item.status,
    })),
    health: row.healthChecks.map((item) => ({
      id: item.publicId, income: money(item.income), expenses: money(item.expenses), savings: money(item.savings),
      emergency: money(item.emergency), debt: money(item.debt), budgetStatus: item.budgetStatus,
      savingsStatus: item.savingsStatus, debtStatus: item.debtStatus, resilience: item.resilience, recommendation: item.recommendation,
    })),
    evidence: row.evidence.map((item) => ({
      id: item.publicId, productName: item.productName, language: item.language, trainerName: item.trainerName,
      trainingDate: iso(item.trainingDate), confirmed: item.confirmed, reference: item.reference,
      productExplained: item.productExplained, costExplained: item.costExplained, contractExplained: item.contractExplained,
    })),
  };
}

export async function saveProgramme(input: {
  code: string; name: string; description: string; audience: string; category: string; language: string;
  deliveryMethod: string; duration: string; certificationAvailable: boolean; validityMonths: number; passMark: number; topics: string[];
}, trace: Trace) {
  if (input.passMark < 1 || input.passMark > 100) throw errors.unprocessable('PASS_MARK_INVALID', 'Pass mark is between 1 and 100.');
  const row = await prisma.literacyProgramme.create({
    data: {
      publicId: await nextPublicId('LPR'),
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description.trim(),
      audience: input.audience,
      category: input.category,
      language: input.language,
      deliveryMethod: input.deliveryMethod,
      duration: input.duration.trim(),
      certificationAvailable: input.certificationAvailable,
      validityMonths: input.validityMonths,
      passMark: decimal(input.passMark),
      topics: asJson(input.topics),
      status: 'DRAFT',
    },
  });
  await audit(trace, 'PROGRAMME_CREATED', row.publicId, row.name);
  return presentProgramme(row);
}

export async function listProgrammes() {
  const rows = await prisma.literacyProgramme.findMany({ include: { courses: { select: { publicId: true, name: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  return rows.map(presentProgramme);
}

export async function setProgrammeStatus(id: string, status: string, trace: Trace) {
  if (!FLOW.includes(status as (typeof FLOW)[number])) throw errors.unprocessable('STATUS_INVALID', 'That programme status is not used.');
  const row = await prisma.literacyProgramme.findUnique({ where: { publicId: id }, include: { courses: true } });
  if (!row) throw errors.notFound('PROGRAMME_NOT_FOUND', 'Programme not found.');
  if (!NEXT[row.status]?.includes(status)) throw errors.unprocessable('STATUS_INVALID', `A ${row.status.toLowerCase().replaceAll('_', ' ')} programme cannot move to ${status.toLowerCase().replaceAll('_', ' ')}.`);
  if ((status === 'PUBLISHED' || status === 'ACTIVE') && !row.courses.length) {
    throw errors.unprocessable('COURSES_REQUIRED', 'Add at least one course before publishing the programme.');
  }
  const saved = await prisma.literacyProgramme.update({ where: { id: row.id }, data: { status }, include: { courses: { select: { publicId: true, name: true, status: true } } } });
  await audit(trace, 'PROGRAMME_STATUS', saved.publicId, status);
  return presentProgramme(saved);
}

export async function saveCourse(input: {
  programmeId: string; code: string; name: string; description: string; objectives: string; audience: string;
  difficulty: string; duration: string; assessmentRequired: boolean; certificateRequired: boolean; passMark: number;
  materials?: string; modules: ModuleRow[]; questions?: unknown; openForEnrolment?: boolean;
}, trace: Trace) {
  const programme = await prisma.literacyProgramme.findUnique({ where: { publicId: input.programmeId } });
  if (!programme) throw errors.notFound('PROGRAMME_NOT_FOUND', 'Programme not found.');
  const modules = readModules(input.modules);
  if (!modules.length) throw errors.unprocessable('MODULES_REQUIRED', 'Add at least one learning module with a title.');
  const questions = readQuestions(input.questions).length ? readQuestions(input.questions) : buildQuiz(modules);
  const row = await prisma.literacyCourse.create({
    data: {
      publicId: await nextPublicId('LCR'),
      programmeId: programme.id,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description.trim(),
      objectives: input.objectives.trim(),
      audience: input.audience,
      difficulty: input.difficulty,
      duration: input.duration.trim(),
      lessonCount: modules.length,
      assessmentRequired: input.assessmentRequired,
      certificateRequired: input.certificateRequired,
      passMark: decimal(input.passMark || money(programme.passMark)),
      modules: asJson(modules),
      questions: asJson(questions),
      materials: input.materials?.trim() || null,
      status: input.openForEnrolment === false ? 'DRAFT' : 'PUBLISHED',
      effectiveDate: input.openForEnrolment === false ? null : new Date(),
    },
    include: { programme: true },
  });
  await prisma.literacyProgramme.update({ where: { id: programme.id }, data: { moduleCount: { increment: modules.length } } });
  await audit(trace, 'COURSE_CREATED', row.publicId, row.name);
  return presentCourse(row);
}

export async function listCourses() {
  const rows = await prisma.literacyCourse.findMany({ include: { programme: true }, orderBy: { createdAt: 'desc' } });
  return rows.map(presentCourse);
}

export async function getCourse(id: string) {
  return presentCourse(await courseByPublicId(id));
}

export async function setCourseStatus(id: string, status: string, trace: Trace) {
  if (!FLOW.includes(status as (typeof FLOW)[number])) throw errors.unprocessable('STATUS_INVALID', 'That course status is not used.');
  const row = await courseByPublicId(id);
  if (!NEXT[row.status]?.includes(status)) throw errors.unprocessable('STATUS_INVALID', `A ${row.status.toLowerCase().replaceAll('_', ' ')} course cannot move to ${status.toLowerCase().replaceAll('_', ' ')}.`);
  if ((status === 'PUBLISHED' || status === 'ACTIVE') && !readModules(row.modules).length) {
    throw errors.unprocessable('MODULES_REQUIRED', 'A published course needs at least one module.');
  }
  const saved = await prisma.literacyCourse.update({ where: { id: row.id }, data: { status }, include: { programme: true } });
  await audit(trace, 'COURSE_STATUS', saved.publicId, status);
  return presentCourse(saved);
}

export async function installCurriculum(trace: Trace) {
  const existing = await prisma.literacyProgramme.count();
  if (existing) throw errors.unprocessable('CURRICULUM_EXISTS', 'A programme is already on file. Add courses to it, or retire it before installing the core curriculum again.');
  const programme = await prisma.literacyProgramme.create({
    data: {
      publicId: await nextPublicId('LPR'),
      code: 'FL-CORE',
      name: 'Financial capability and consumer protection',
      description: 'Core curriculum for schools, parents, students, teachers, suppliers, investors, and borrowers. Topics are the platform training standard and can be edited. Illustrations do not replace a product contract or a lender decision.',
      audience: 'SCHOOL,PARENT,STUDENT,TEACHER,SUPPLIER,INVESTOR,DONOR,BORROWER',
      category: 'CONSUMER_PROTECTION',
      language: 'English',
      deliveryMethod: 'BLENDED',
      duration: '6 courses',
      moduleCount: 12,
      certificationAvailable: true,
      validityMonths: 12,
      passMark: decimal(70),
      topics: asJson(TOPICS),
      status: 'ACTIVE',
    },
  });
  const courses = [
    course('FL-MONEY', 'Understanding money and budgeting', 'How money comes in, how it goes out, and how a simple budget is built.', [
      module('Needs and wants', 'Separate a need from a want before spending.', 'A need is required for school, food, or housing. A want can wait.'),
      module('Building a budget', 'List income, essential costs, and what remains.', 'Income minus essential costs is the amount available for savings or a goal.'),
    ]),
    course('FL-SAVE', 'Savings and emergency funds', 'Why a reserve exists and how a savings goal is tracked.', [
      module('Emergency reserve', 'A reserve covers an unexpected school or household cost.', 'A practical target is three months of essential costs.'),
      module('Savings goals', 'Name the goal, the amount, and the date.', 'A monthly contribution is the target divided by the months remaining.'),
    ]),
    course('FL-DIGITAL', 'Digital payments and banking safety', 'How to use mobile money and banking without sharing a secret.', [
      module('PIN, OTP, and passwords', 'A PIN, one-time code, or password is never shared.', 'RUPSA Next, a bank, or mobile money will not ask for these by phone or message.'),
      module('Checking a payment', 'Confirm the recipient, the amount, and the reference before confirming.', 'Keep the receipt and report a wrong transfer immediately.'),
    ]),
    course('FL-CREDIT', 'Credit, cost, and responsible borrowing', 'What a loan costs, how repayment works, and how security is explained.', [
      module('Cost of credit', 'Interest, fees, and the repayment period all change the total.', 'The periodic repayment is the total divided by the number of periods.'),
      module('The 40/60 explanation', 'For a term-fee illustration, 40% is shown as security and 60% as school funds.', 'Legal ownership and release follow the approved product. This illustration is not a new balance.'),
    ]),
    course('FL-PROTECT', 'Consumer protection, fraud, and complaints', 'How to recognise a scam and where a complaint goes.', [
      module('Fraud signs', 'Urgency, a request for a PIN, or a changed account number are warning signs.', 'Stop, verify the official channel, and report the incident.'),
      module('How to complain', 'A complaint names the product, the date, the amount, and what should happen next.', 'Keep the reference and follow the published complaint path.'),
    ]),
    course('FL-SCHOOL', 'School financial management', 'How a school reads fees, invoices, and a simple cash view.', [
      module('Reading an invoice', 'An invoice shows what was billed, what was paid, and what is still outstanding.', 'A partial payment leaves the remainder on the same invoice.'),
      module('School cash view', 'Separate fees received, costs due, and amounts held under a product rule.', 'A training figure is an illustration until the ledger posts it.'),
    ]),
  ];
  for (const item of courses) {
    await prisma.literacyCourse.create({
      data: {
        publicId: await nextPublicId('LCR'),
        programmeId: programme.id,
        code: item.code,
        name: item.name,
        description: item.description,
        objectives: item.objectives,
        audience: programme.audience,
        difficulty: 'BASIC',
        duration: '2 modules',
        lessonCount: item.modules.length,
        assessmentRequired: true,
        certificateRequired: true,
        passMark: decimal(70),
        modules: asJson(item.modules),
        questions: asJson(buildQuiz(item.modules)),
        materials: 'Trainer notes and learner worksheet',
        status: 'PUBLISHED',
        effectiveDate: new Date(),
      },
    });
  }
  await audit(trace, 'CURRICULUM_INSTALLED', programme.publicId, programme.name);
  return presentProgramme({ ...programme, courses: [] });
}

function course(code: string, name: string, description: string, modules: ModuleRow[]) {
  return { code, name, description, objectives: modules.map((item) => item.objectives).join(' '), modules };
}

function module(title: string, objectives: string, content: string): ModuleRow {
  return { title, description: objectives, objectives, content, durationMinutes: 40, materials: 'Worksheet' };
}

export async function enrol(input: { learnerId: string; courseId: string; deliveryMethod: string; trainerName?: string; startDate: string; expectedCompletion?: string }, trace: Trace) {
  const learner = await learnerByPublicId(input.learnerId);
  const course = await courseByPublicId(input.courseId);
  if (!OPEN_COURSE.includes(course.status)) throw errors.unprocessable('COURSE_CLOSED', 'Enrolment is open on a published or active course.');
  const duplicate = await prisma.literacyEnrollment.findFirst({ where: { learnerId: learner.id, courseId: course.id } });
  if (duplicate) throw errors.unprocessable('ALREADY_ENROLLED', 'This learner is already enrolled on that course.');
  const row = await prisma.literacyEnrollment.create({
    data: {
      publicId: await nextPublicId('LEN'),
      learnerId: learner.id,
      courseId: course.id,
      trainerName: input.trainerName?.trim() || null,
      deliveryMethod: input.deliveryMethod,
      startDate: day(input.startDate) ?? new Date(),
      expectedCompletion: input.expectedCompletion ? day(input.expectedCompletion) : null,
      status: 'ENROLLED',
    },
  });
  if (learner.status === 'REGISTERED') {
    await prisma.literacyLearner.update({ where: { id: learner.id }, data: { status: 'ENROLLED' } });
  }
  await queueNotice({ channel: 'IN_APP', subject: 'Training enrolment', body: `${learner.name} is enrolled on ${course.name}.` });
  await audit(trace, 'ENROLLED', row.publicId, course.name, learner.id);
  return getLearner(learner.publicId);
}

export async function assess(id: string, input: { kind: 'PRE' | 'POST' | 'QUIZ'; scores: Scores }, trace: Trace) {
  const enrollment = await prisma.literacyEnrollment.findUnique({ where: { publicId: id }, include: { course: true, learner: true, assessments: true } });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  if (enrollment.status === 'WITHDRAWN' || enrollment.status === 'EXPIRED') {
    throw errors.unprocessable('ENROLLMENT_CLOSED', 'This enrolment is closed.');
  }
  const scores = readScores(input.scores);
  const percentage = average(scores);
  const { weakest, strongest } = ends(scores);
  const passMark = money(enrollment.course.passMark);
  const attempt = enrollment.assessments.filter((row) => row.kind === input.kind).length + 1;
  let result = 'RECORDED';
  if (input.kind === 'POST') result = percentage >= passMark ? 'PASSED' : attempt < 3 ? 'RETAKE_REQUIRED' : 'FAILED';
  const reviewer = await actorLabel(trace.actorId);
  const assessment = await prisma.literacyAssessment.create({
    data: {
      publicId: await nextPublicId('LAS'),
      enrollmentId: enrollment.id,
      kind: input.kind,
      scores: asJson(scores),
      percentage: decimal(percentage),
      passMark: decimal(passMark),
      result,
      attempt,
      reviewer,
    },
  });
  if (input.kind === 'PRE') {
    await prisma.literacyEnrollment.update({
      where: { id: enrollment.id },
      data: { preScore: decimal(percentage), weakest, strongest, status: enrollment.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', progress: decimal(Math.max(money(enrollment.progress), 25)) },
    });
    if (enrollment.learner.status === 'REGISTERED' || enrollment.learner.status === 'ENROLLED') {
      await prisma.literacyLearner.update({ where: { id: enrollment.learnerId }, data: { status: 'IN_PROGRESS' } });
    }
  }
  if (input.kind === 'POST') {
    const passed = result === 'PASSED';
    await prisma.literacyEnrollment.update({
      where: { id: enrollment.id },
      data: {
        postScore: decimal(percentage),
        weakest,
        strongest,
        status: passed ? 'COMPLETED' : result === 'FAILED' ? 'FAILED' : 'IN_PROGRESS',
        progress: decimal(passed ? 100 : Math.max(money(enrollment.progress), 60)),
      },
    });
    if (passed && enrollment.learner.status !== 'CERTIFIED') {
      await prisma.literacyLearner.update({ where: { id: enrollment.learnerId }, data: { status: 'COMPLETED' } });
    }
    if (!passed) {
      const open = await prisma.literacyRetraining.findFirst({ where: { learnerId: enrollment.learnerId, previousCourse: enrollment.course.name, status: { in: ['REQUIRED', 'ASSIGNED'] } } });
      if (!open) {
        await prisma.literacyRetraining.create({
          data: {
            publicId: await nextPublicId('LRT'),
            learnerId: enrollment.learnerId,
            reason: `Post-assessment score ${percentage} is below the pass mark of ${passMark}.`,
            previousCourse: enrollment.course.name,
            modules: weakest,
            status: 'REQUIRED',
          },
        });
      }
    }
  }
  await audit(trace, `ASSESSMENT_${input.kind}`, assessment.publicId, result, enrollment.learnerId);
  return { id: assessment.publicId, kind: input.kind, percentage, result, attempt, weakest, strongest, passMark, learnerId: enrollment.learner.publicId };
}

export async function issueCertificate(id: string, input: { certificateType?: string }, trace: Trace) {
  const enrollment = await prisma.literacyEnrollment.findUnique({
    where: { publicId: id },
    include: { course: { include: { programme: true } }, learner: true, certificate: true, assessments: { where: { kind: 'POST' }, orderBy: { createdAt: 'desc' } } },
  });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  const passed = enrollment.assessments.some((row) => row.result === 'PASSED');
  if (enrollment.status !== 'COMPLETED' || !passed) {
    throw errors.unprocessable('ASSESSMENT_REQUIRED', 'A certificate is issued after the post-assessment is passed.');
  }
  if (enrollment.certificate) throw errors.unprocessable('CERTIFICATE_EXISTS', 'This enrolment already has a certificate.');
  const score = money(enrollment.postScore);
  const certificateType = input.certificateType || (score >= 90 ? 'COMPETENCY' : 'COMPLETION');
  const expires = new Date();
  expires.setMonth(expires.getMonth() + enrollment.course.programme.validityMonths);
  const actorName = await actorLabel(trace.actorId);
  const row = await prisma.literacyCertificate.create({
    data: {
      publicId: await nextPublicId('LCF'),
      learnerId: enrollment.learnerId,
      enrollmentId: enrollment.id,
      courseName: enrollment.course.name,
      programmeName: enrollment.course.programme.name,
      score: decimal(score),
      certificateType,
      expiresAt: expires,
      verificationRef: '',
      issuedBy: actorName,
      status: 'ACTIVE',
    },
  });
  await prisma.literacyCertificate.update({ where: { id: row.id }, data: { verificationRef: row.publicId } });
  await prisma.literacyLearner.update({ where: { id: enrollment.learnerId }, data: { status: 'CERTIFIED' } });
  await queueNotice({ channel: 'IN_APP', subject: 'Training certificate', body: `${enrollment.learner.name} received ${certificateType.replaceAll('_', ' ').toLowerCase()} certificate ${row.publicId} for ${enrollment.course.name}.` });
  await audit(trace, 'CERTIFICATE_ISSUED', row.publicId, enrollment.course.name, enrollment.learnerId);
  return getLearner(enrollment.learner.publicId);
}

export async function publishCourse(id: string, trace: Trace) {
  const row = await courseByPublicId(id);
  if (OPEN_COURSE.includes(row.status)) return presentCourse(row);
  if (row.status === 'SUSPENDED' || row.status === 'RETIRED') {
    throw errors.unprocessable('COURSE_CLOSED', 'A suspended or retired course is not opened for students from here.');
  }
  if (!readModules(row.modules).length) throw errors.unprocessable('MODULES_REQUIRED', 'A published course needs at least one module.');
  const saved = await prisma.literacyCourse.update({
    where: { id: row.id },
    data: { status: 'PUBLISHED', effectiveDate: row.effectiveDate ?? new Date() },
    include: { programme: true },
  });
  await audit(trace, 'COURSE_PUBLISHED', saved.publicId, saved.name);
  return presentCourse(saved);
}

const STUDY_NEEDS = 'Follow published courses and receive a certificate when every module is complete.';

function isStudyOfficer(role: string) {
  return role === 'SYSTEM_ADMINISTRATOR' || role === 'RUPSA_USER' || role === 'SCHOOL_USER' || role === 'PSP_USER';
}

async function loadStudyUser(actorId?: string) {
  if (!actorId) throw errors.unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    include: { guardian: { select: { id: true, publicId: true, phone: true } }, schoolLinks: { select: { schoolId: true } } },
  });
  if (!user) throw errors.notFound('USER_NOT_FOUND', 'The requested user could not be found.');
  return user;
}

async function assertStudyLearner(
  user: { role: string; guardian: { id: string } | null; schoolLinks: { schoolId: string }[] },
  learner: { guardianId: string | null; studentId: string | null; schoolId: string | null },
) {
  if (user.role === 'SYSTEM_ADMINISTRATOR' || user.role === 'RUPSA_USER' || user.role === 'PSP_USER') return;
  if (user.role === 'PARENT') {
    if (!user.guardian || learner.guardianId !== user.guardian.id) {
      throw errors.forbidden('This training file belongs to another person.');
    }
    return;
  }
  if (user.role === 'SCHOOL_USER') {
    const schoolIds = new Set(user.schoolLinks.map((link) => link.schoolId));
    if (learner.schoolId && schoolIds.has(learner.schoolId)) return;
    if (learner.studentId) {
      const student = await prisma.student.findUnique({ where: { id: learner.studentId }, select: { schoolId: true } });
      if (student && schoolIds.has(student.schoolId)) return;
    }
    throw errors.forbidden('This student is outside your school.');
  }
  throw errors.forbidden('This sign-in can read courses and cannot follow one.');
}

function completedModules(exercises: unknown, count: number, finished: boolean) {
  const done = new Set<number>();
  if (Array.isArray(exercises)) {
    for (const item of exercises) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (row.kind === 'MODULE' && Number.isInteger(row.index)) done.add(Number(row.index));
    }
  }
  if (finished) {
    for (let index = 0; index < count; index += 1) done.add(index);
  }
  return [...done].sort((left, right) => left - right);
}

async function ensureQuestions(course: { id: string; questions: Prisma.JsonValue; modules: Prisma.JsonValue }) {
  const stored = readQuestions(course.questions);
  if (stored.length) return stored;
  const built = buildQuiz(readModules(course.modules));
  if (!built.length) return [];
  await prisma.literacyCourse.update({ where: { id: course.id }, data: { questions: asJson(built) } });
  return built;
}

async function presentLessons(learnerId: string) {
  const rows = await prisma.literacyEnrollment.findMany({
    where: { learnerId },
    include: { course: true, certificate: true },
    orderBy: { createdAt: 'desc' },
  });
  const lessons = [];
  for (const row of rows) {
    const modules = readModules(row.course.modules);
    const certified = Boolean(row.certificate);
    const completed = completedModules(row.exercises, modules.length, certified || row.status === 'COMPLETED');
    const pendingIndex = modules.findIndex((_, index) => !completed.includes(index));
    const current = pendingIndex === -1 ? modules.length : pendingIndex;
    const readyForQuiz = current >= modules.length && !certified && row.status !== 'FAILED';
    const questions = readyForQuiz ? await ensureQuestions(row.course) : [];
    const reading = modules.length ? round2((completed.length / modules.length) * 80) : 0;
    lessons.push({
      enrollmentId: row.publicId,
      courseId: row.course.publicId,
      courseName: row.course.name,
      status: row.status,
      progress: certified ? 100 : reading,
      passMark: money(row.course.passMark),
      certificateId: row.certificate?.publicId ?? null,
      current,
      modules: modules.map((module, index) => ({
        title: module.title,
        objectives: module.objectives,
        content: module.content,
        durationMinutes: module.durationMinutes,
        done: completed.includes(index),
      })),
      quiz: presentQuiz(questions),
      mark: readMark(row.exercises),
    });
  }
  return lessons;
}

async function studyStudents(user: { role: string; schoolLinks: { schoolId: string }[] }) {
  if (user.role === 'SCHOOL_USER') {
    const schoolIds = user.schoolLinks.map((link) => link.schoolId);
    const students = await prisma.student.findMany({
      where: { schoolId: { in: schoolIds } },
      orderBy: { studentName: 'asc' },
      take: 200,
      select: { publicId: true, studentName: true, telephone: true, school: { select: { schoolName: true } } },
    });
    return students.map((row) => ({ id: row.publicId, name: row.studentName, phone: row.telephone, detail: row.school.schoolName }));
  }
  const listed = await listParties('STUDENT');
  return listed.parties;
}

export async function studyDesk(actorId: string | undefined, learnerId?: string) {
  const user = await loadStudyUser(actorId);
  let learnerPublicId: string | null = null;
  if (learnerId) {
    const learner = await learnerByPublicId(learnerId);
    await assertStudyLearner(user, learner);
    learnerPublicId = learner.publicId;
  } else if (user.role === 'PARENT' && user.guardian) {
    const learner = await prisma.literacyLearner.findFirst({ where: { guardianId: user.guardian.id } });
    learnerPublicId = learner?.publicId ?? null;
  }
  const courses = (await listCourses()).filter((course) => OPEN_COURSE.includes(course.status));
  const offerStudents = !learnerPublicId && isStudyOfficer(user.role);
  if (!learnerPublicId) {
    return { learner: null, courses, students: offerStudents ? await studyStudents(user) : [], lessons: [] };
  }
  const learner = await learnerByPublicId(learnerPublicId);
  return {
    learner: await getLearner(learner.publicId),
    courses,
    students: [],
    lessons: await presentLessons(learner.id),
  };
}

export async function enterStudy(actorId: string | undefined, partyId: string | undefined, trace: Trace) {
  const user = await loadStudyUser(actorId);
  if (user.role === 'PARENT') {
    if (!user.guardian) throw errors.unprocessable('LEARNER_UNLINKED', 'This parent sign-in is not linked to a guardian record.');
    const file = await saveLearner({
      learnerType: 'PARENT',
      partyId: user.guardian.publicId,
      phone: user.guardian.phone || undefined,
      language: 'English',
      trainingNeeds: STUDY_NEEDS,
    }, trace);
    return studyDesk(actorId, file.id);
  }
  if (!isStudyOfficer(user.role)) throw errors.forbidden('This sign-in can read courses and cannot follow one.');
  if (!partyId) throw errors.unprocessable('STUDENT_REQUIRED', 'Choose the student who will follow the course.');
  const student = await prisma.student.findUnique({ where: { publicId: partyId }, include: { school: { select: { id: true, phone: true } } } });
  if (!student) throw errors.notFound('PARTY_NOT_FOUND', 'Student not found.');
  if (user.role === 'SCHOOL_USER' && !user.schoolLinks.some((link) => link.schoolId === student.school.id)) {
    throw errors.forbidden('This student is outside your school.');
  }
  const phone = student.telephone && student.telephone.trim().length >= 6 ? student.telephone : student.school.phone ?? undefined;
  const file = await saveLearner({
    learnerType: 'STUDENT',
    partyId,
    phone,
    language: 'English',
    trainingNeeds: STUDY_NEEDS,
  }, trace);
  return studyDesk(actorId, file.id);
}

export async function selfEnrol(actorId: string | undefined, input: { learnerId: string; courseId: string }, trace: Trace) {
  const user = await loadStudyUser(actorId);
  const learner = await learnerByPublicId(input.learnerId);
  await assertStudyLearner(user, learner);
  const today = new Date().toISOString().slice(0, 10);
  await enrol({ learnerId: learner.publicId, courseId: input.courseId, deliveryMethod: 'ONLINE', startDate: today }, trace);
  return studyDesk(actorId, learner.publicId);
}

async function issueSystemCertificate(enrollmentId: string, trace: Trace, score = 100) {
  const enrollment = await prisma.literacyEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: { programme: true } }, learner: true, certificate: true },
  });
  if (!enrollment || enrollment.certificate || !enrollment.course.certificateRequired) return enrollment?.certificate?.publicId ?? null;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + enrollment.course.programme.validityMonths);
  const row = await prisma.literacyCertificate.create({
    data: {
      publicId: await nextPublicId('LCF'),
      learnerId: enrollment.learnerId,
      enrollmentId: enrollment.id,
      courseName: enrollment.course.name,
      programmeName: enrollment.course.programme.name,
      score: decimal(score),
      certificateType: score >= 90 ? 'COMPETENCY' : 'COMPLETION',
      expiresAt: expires,
      verificationRef: '',
      issuedBy: 'System',
      status: 'ACTIVE',
    },
  });
  await prisma.literacyCertificate.update({ where: { id: row.id }, data: { verificationRef: row.publicId } });
  await prisma.literacyEnrollment.update({
    where: { id: enrollment.id },
    data: { postScore: decimal(score), status: 'COMPLETED', progress: decimal(100) },
  });
  await prisma.literacyLearner.update({ where: { id: enrollment.learnerId }, data: { status: 'CERTIFIED' } });
  await queueNotice({
    channel: 'IN_APP',
    subject: 'Training certificate',
    body: `${enrollment.learner.name} completed ${enrollment.course.name}. The system issued certificate ${row.publicId}.`,
  });
  await audit(trace, 'CERTIFICATE_ISSUED', row.publicId, enrollment.course.name, enrollment.learnerId);
  return row.publicId;
}

async function advanceModule(enrollmentId: string, moduleIndex: number, trace: Trace) {
  const enrollment = await prisma.literacyEnrollment.findUnique({
    where: { publicId: enrollmentId },
    include: { course: true, learner: true, certificate: true },
  });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  if (enrollment.status === 'WITHDRAWN' || enrollment.status === 'EXPIRED' || enrollment.status === 'FAILED') {
    throw errors.unprocessable('ENROLLMENT_CLOSED', 'This enrolment is closed.');
  }
  const modules = readModules(enrollment.course.modules);
  if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex >= modules.length) {
    throw errors.unprocessable('MODULE_INVALID', 'That module is not part of this course.');
  }
  const finishedAlready = enrollment.status === 'COMPLETED' || Boolean(enrollment.certificate);
  if (!finishedAlready) {
    const completed = completedModules(enrollment.exercises, modules.length, false);
    if (moduleIndex > 0 && !completed.includes(moduleIndex - 1)) {
      throw errors.unprocessable('MODULE_ORDER', 'Finish the earlier module first.');
    }
    const log: unknown[] = Array.isArray(enrollment.exercises) ? [...enrollment.exercises] : [];
    if (!completed.includes(moduleIndex)) {
      log.push({ kind: 'MODULE', index: moduleIndex, at: new Date().toISOString() });
      completed.push(moduleIndex);
    }
    const progress = modules.length ? round2((completed.length / modules.length) * 80) : 0;
    await prisma.literacyEnrollment.update({
      where: { id: enrollment.id },
      data: {
        exercises: asJson(log),
        progress: decimal(progress),
        status: 'IN_PROGRESS',
      },
    });
    if (enrollment.learner.status === 'REGISTERED' || enrollment.learner.status === 'ENROLLED') {
      await prisma.literacyLearner.update({ where: { id: enrollment.learnerId }, data: { status: 'IN_PROGRESS' } });
    }
    await audit(trace, 'MODULE_COMPLETED', enrollment.publicId, modules[moduleIndex]?.title ?? String(moduleIndex), enrollment.learnerId);
  }
  return enrollment.learner.publicId;
}

export async function completeModule(actorId: string | undefined, enrollmentId: string, moduleIndex: number, trace: Trace) {
  const user = await loadStudyUser(actorId);
  const enrollment = await prisma.literacyEnrollment.findUnique({
    where: { publicId: enrollmentId },
    include: { learner: true },
  });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  await assertStudyLearner(user, enrollment.learner);
  const learnerId = await advanceModule(enrollmentId, moduleIndex, trace);
  return studyDesk(actorId, learnerId);
}

function presentCertificate(row: {
  publicId: string; courseName: string; programmeName: string; score: Prisma.Decimal; certificateType: string;
  issuedAt: Date; expiresAt: Date; verificationRef: string; issuedBy: string; status: string;
  learner?: { publicId: string; name: string };
}) {
  return {
    id: row.publicId,
    learnerId: row.learner?.publicId,
    learnerName: row.learner?.name,
    courseName: row.courseName,
    programmeName: row.programmeName,
    score: money(row.score),
    certificateType: row.certificateType,
    issuedAt: iso(row.issuedAt),
    expiresAt: iso(row.expiresAt),
    verificationRef: row.verificationRef || row.publicId,
    issuedBy: row.issuedBy,
    status: row.status,
  };
}

export async function listCertificates() {
  const rows = await prisma.literacyCertificate.findMany({ include: { learner: true }, orderBy: { issuedAt: 'desc' }, take: 200 });
  return rows.map(presentCertificate);
}

export async function verifyCertificate(id: string) {
  const row = await prisma.literacyCertificate.findUnique({ where: { publicId: id }, include: { learner: true } });
  if (!row) throw errors.notFound('CERTIFICATE_NOT_FOUND', 'Certificate not found.');
  return presentCertificate(row);
}

export async function revokeCertificate(id: string, reason: string, trace: Trace) {
  const row = await prisma.literacyCertificate.findUnique({ where: { publicId: id }, include: { learner: true } });
  if (!row) throw errors.notFound('CERTIFICATE_NOT_FOUND', 'Certificate not found.');
  await prisma.literacyCertificate.update({ where: { id: row.id }, data: { status: 'REVOKED' } });
  await audit(trace, 'CERTIFICATE_REVOKED', row.publicId, reason, row.learnerId);
  return verifyCertificate(id);
}

export async function saveTrainer(input: { name: string; organization: string; qualification: string; certification: string; expertise: string; phone: string; email: string }, trace: Trace) {
  const row = await prisma.literacyTrainer.create({
    data: { publicId: await nextPublicId('LTR'), ...input, status: 'PENDING' },
  });
  await audit(trace, 'TRAINER_REGISTERED', row.publicId, row.name);
  return { id: row.publicId, name: row.name, organization: row.organization, status: row.status };
}

export async function listTrainers() {
  const rows = await prisma.literacyTrainer.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row) => ({
    id: row.publicId, name: row.name, organization: row.organization, qualification: row.qualification,
    certification: row.certification, expertise: row.expertise, phone: row.phone, email: row.email, status: row.status,
  }));
}

export async function approveTrainer(id: string, trace: Trace) {
  const row = await prisma.literacyTrainer.findUnique({ where: { publicId: id } });
  if (!row) throw errors.notFound('TRAINER_NOT_FOUND', 'Trainer not found.');
  const actorName = await actorLabel(trace.actorId);
  await prisma.literacyTrainer.update({ where: { id: row.id }, data: { status: 'APPROVED', approvedBy: actorName, approvedAt: new Date() } });
  await audit(trace, 'TRAINER_APPROVED', row.publicId, row.name);
  return { id: row.publicId, status: 'APPROVED' };
}

export async function saveSession(input: {
  courseId: string; trainerId?: string; moduleTitle: string; sessionDate: string; startTime: string; endTime: string;
  venue?: string; onlineLink?: string; capacity: number; language: string; audience: string;
}, trace: Trace) {
  const course = await courseByPublicId(input.courseId);
  const trainer = input.trainerId ? await prisma.literacyTrainer.findUnique({ where: { publicId: input.trainerId } }) : null;
  if (input.trainerId && !trainer) throw errors.notFound('TRAINER_NOT_FOUND', 'Trainer not found.');
  const row = await prisma.literacySession.create({
    data: {
      publicId: await nextPublicId('LSS'),
      courseId: course.id,
      trainerId: trainer?.id,
      moduleTitle: input.moduleTitle.trim(),
      sessionDate: day(input.sessionDate) ?? new Date(),
      startTime: input.startTime,
      endTime: input.endTime,
      venue: input.venue?.trim() || null,
      onlineLink: input.onlineLink?.trim() || null,
      capacity: input.capacity,
      language: input.language,
      audience: input.audience,
      status: 'SCHEDULED',
    },
  });
  await audit(trace, 'SESSION_SCHEDULED', row.publicId, course.name);
  return { id: row.publicId, moduleTitle: row.moduleTitle, status: row.status };
}

export async function listSessions() {
  const rows = await prisma.literacySession.findMany({ include: { course: true, trainer: true, attendances: true }, orderBy: { sessionDate: 'desc' }, take: 200 });
  return rows.map((row) => ({
    id: row.publicId,
    courseId: row.course.publicId,
    courseName: row.course.name,
    trainerName: row.trainer?.name ?? null,
    moduleTitle: row.moduleTitle,
    sessionDate: iso(row.sessionDate),
    startTime: row.startTime,
    endTime: row.endTime,
    venue: row.venue,
    language: row.language,
    status: row.status,
    attendance: row.attendances.length,
  }));
}

export async function markAttendance(id: string, input: { learnerId: string; method: string; status: string; percent: number }, trace: Trace) {
  const session = await prisma.literacySession.findUnique({ where: { publicId: id } });
  if (!session) throw errors.notFound('SESSION_NOT_FOUND', 'Session not found.');
  const learner = await learnerByPublicId(input.learnerId);
  if (!['PRESENT', 'ABSENT', 'PARTIAL'].includes(input.status)) throw errors.unprocessable('ATTENDANCE_INVALID', 'Attendance is present, absent, or partial.');
  const actorName = await actorLabel(trace.actorId);
  const existing = await prisma.literacyAttendance.findUnique({ where: { sessionId_learnerId: { sessionId: session.id, learnerId: learner.id } } });
  const row = existing
    ? await prisma.literacyAttendance.update({ where: { id: existing.id }, data: { method: input.method, status: input.status, percent: decimal(input.percent), confirmedBy: actorName } })
    : await prisma.literacyAttendance.create({
      data: {
        publicId: await nextPublicId('LAT'),
        sessionId: session.id,
        learnerId: learner.id,
        method: input.method,
        status: input.status,
        percent: decimal(input.percent),
        confirmedBy: actorName,
      },
    });
  if (session.status === 'SCHEDULED') await prisma.literacySession.update({ where: { id: session.id }, data: { status: 'HELD' } });
  const enrollment = await prisma.literacyEnrollment.findFirst({ where: { learnerId: learner.id, courseId: session.courseId, status: { in: ['ENROLLED', 'IN_PROGRESS'] } } });
  if (enrollment && input.status !== 'ABSENT') {
    await prisma.literacyEnrollment.update({ where: { id: enrollment.id }, data: { status: 'IN_PROGRESS', progress: decimal(Math.max(money(enrollment.progress), input.percent)) } });
  }
  await audit(trace, 'ATTENDANCE', row.publicId, input.status, learner.id);
  return { id: row.publicId, status: row.status };
}

const ILLUSTRATIVE = 'This figure is an education illustration. It does not post a payment, create a balance, or decide credit.';

export function simulate(kind: string, input: Record<string, number | string | boolean>) {
  const num = (key: string) => Number(input[key] ?? 0) || 0;
  if (kind === 'BUDGET') {
    const income = num('monthlyIncome') + num('schoolIncome') + num('salary') + num('business') + num('otherIncome');
    const expenses = num('rent') + num('food') + num('schoolFees') + num('transport') + num('airtime') + num('utilities') + num('otherExpenses');
    const surplus = round2(income - expenses);
    return { kind, label: 'Educational budget', disclaimer: ILLUSTRATIVE, income: round2(income), expenses: round2(expenses), surplus, status: surplus >= 0 ? 'WITHIN_INCOME' : 'ABOVE_INCOME' };
  }
  if (kind === 'LOAN') {
    const amount = num('amount');
    const months = Math.max(1, num('months'));
    const interest = round2(amount * (num('annualRate') / 100) * (months / 12));
    const fees = round2(num('processing') + num('insurance') + num('guarantee') + num('otherFees'));
    const total = round2(amount + interest + fees);
    return { kind, label: 'Educational loan cost', disclaimer: ILLUSTRATIVE, interest, fees, total, periodic: round2(total / months) };
  }
  if (kind === 'AFFORDABILITY') {
    const income = num('income');
    const disposable = round2(income - num('essential') - num('existingDebt') - num('other'));
    const remaining = round2(disposable - num('newPayment'));
    const ratio = income > 0 ? num('newPayment') / income : 1;
    const result = remaining < 0 ? 'NOT_AFFORDABLE' : ratio > 0.35 ? 'NEEDS_REVIEW' : 'AFFORDABLE';
    return { kind, label: 'Educational affordability', disclaimer: 'This result helps a learner see room in a budget. It does not approve or refuse credit.', disposable, remaining, result };
  }
  if (kind === 'SAVINGS' || kind === 'EMERGENCY') {
    const target = kind === 'EMERGENCY' ? round2(num('essentials') * (num('months') || 3)) : num('target');
    const current = num('current');
    return { kind, label: kind === 'EMERGENCY' ? 'Educational emergency fund' : 'Educational savings goal', disclaimer: ILLUSTRATIVE, target: round2(target), current: round2(current), gap: round2(Math.max(0, target - current)), progress: target > 0 ? round2((current / target) * 100) : 0 };
  }
  if (kind === 'SPLIT') {
    const amount = num('amount');
    return {
      kind,
      label: 'Educational 40/60 explanation',
      disclaimer: 'For this term-fee illustration, 40% is shown as security and 60% as school funds. Legal ownership and release follow the approved product. This is not a ledger posting.',
      security: round2(amount * 0.4),
      schoolFunds: round2(amount * 0.6),
    };
  }
  if (kind === 'INVESTMENT') {
    const contributed = num('contributed');
    const returned = num('returned');
    return { kind, label: 'Educational investment result', disclaimer: ILLUSTRATIVE, gain: round2(returned - contributed), returnPercent: contributed > 0 ? round2(((returned - contributed) / contributed) * 100) : 0 };
  }
  throw errors.unprocessable('SIMULATOR_INVALID', 'Choose a budget, loan, affordability, savings, emergency, split, or investment illustration.');
}

export async function recordExercise(id: string, kind: string, input: Record<string, number | string | boolean>, trace: Trace) {
  const enrollment = await prisma.literacyEnrollment.findUnique({ where: { publicId: id } });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  const result = simulate(kind, input);
  const current = Array.isArray(enrollment.exercises) ? enrollment.exercises : [];
  await prisma.literacyEnrollment.update({
    where: { id: enrollment.id },
    data: { exercises: asJson([...current, { kind, at: new Date().toISOString(), result }]) },
  });
  await audit(trace, 'EXERCISE', enrollment.publicId, kind, enrollment.learnerId);
  return result;
}

export async function saveEvidence(input: {
  learnerId: string; enrollmentId?: string; productName: string; language: string; trainerName: string; trainingDate: string;
  materials: string; questions: string; answers: string; productExplained: boolean; costExplained: boolean; contractExplained: boolean; confirmed: boolean;
}, trace: Trace) {
  const learner = await learnerByPublicId(input.learnerId);
  const enrollment = input.enrollmentId ? await prisma.literacyEnrollment.findUnique({ where: { publicId: input.enrollmentId } }) : null;
  if (input.confirmed && (!input.productExplained || !input.costExplained || !input.contractExplained)) {
    throw errors.unprocessable('UNDERSTANDING_INCOMPLETE', 'Confirmation requires the product, the cost, and the contract to be explained.');
  }
  if (input.questions.trim().length < 3 || input.answers.trim().length < 3) {
    throw errors.unprocessable('QUESTIONS_REQUIRED', 'Record the question the learner asked and the answer given.');
  }
  const row = await prisma.literacyEvidence.create({
    data: {
      publicId: await nextPublicId('LEV'),
      learnerId: learner.id,
      enrollmentId: enrollment?.id,
      productName: input.productName.trim(),
      language: input.language,
      trainerName: input.trainerName.trim(),
      trainingDate: day(input.trainingDate) ?? new Date(),
      materials: input.materials.trim(),
      questions: input.questions.trim(),
      answers: input.answers.trim(),
      productExplained: input.productExplained,
      costExplained: input.costExplained,
      contractExplained: input.contractExplained,
      confirmed: input.confirmed,
      reference: '',
    },
  });
  await prisma.literacyEvidence.update({ where: { id: row.id }, data: { reference: row.publicId } });
  await audit(trace, 'UNDERSTANDING', row.publicId, input.productName, learner.id);
  return { id: row.publicId, confirmed: input.confirmed };
}

export async function saveGoal(input: { learnerId: string; name: string; category: string; targetAmount: number; currentAmount: number; monthlyContribution: number; targetDate?: string; priority: string }, trace: Trace) {
  const learner = await learnerByPublicId(input.learnerId);
  const row = await prisma.literacyGoal.create({
    data: {
      publicId: await nextPublicId('LGL'),
      learnerId: learner.id,
      name: input.name.trim(),
      category: input.category,
      targetAmount: decimal(input.targetAmount),
      currentAmount: decimal(input.currentAmount),
      monthlyContribution: decimal(input.monthlyContribution),
      targetDate: input.targetDate ? day(input.targetDate) : null,
      priority: input.priority,
      status: 'ACTIVE',
    },
  });
  await audit(trace, 'GOAL', row.publicId, input.name, learner.id);
  return { id: row.publicId };
}

export async function saveHealth(input: { learnerId: string; income: number; expenses: number; savings: number; emergency: number; debt: number; debtPayment: number; insurance: boolean; goals: number }, trace: Trace) {
  const learner = await learnerByPublicId(input.learnerId);
  const budgetStatus = input.expenses > input.income ? 'STRESSED' : input.expenses > input.income * 0.9 ? 'TIGHT' : 'STABLE';
  const savingsStatus = input.savings <= 0 ? 'NONE' : input.savings >= input.income * 0.1 ? 'BUILDING' : 'STARTED';
  const debtStatus = input.income <= 0 ? 'UNKNOWN' : input.debtPayment > input.income * 0.3 ? 'HIGH' : 'MANAGEABLE';
  const resilience = input.emergency >= input.expenses * 3 ? 'RESILIENT' : input.emergency > 0 ? 'PARTIAL' : 'LOW';
  const recommendation = budgetStatus === 'STRESSED'
    ? 'Review essential costs before taking on a new payment.'
    : resilience === 'LOW'
      ? 'Build an emergency reserve before increasing a savings goal.'
      : 'Keep the budget, the reserve, and the next goal visible.';
  const row = await prisma.literacyHealth.create({
    data: {
      publicId: await nextPublicId('LHV'),
      learnerId: learner.id,
      income: decimal(input.income),
      expenses: decimal(input.expenses),
      savings: decimal(input.savings),
      emergency: decimal(input.emergency),
      debt: decimal(input.debt),
      debtPayment: decimal(input.debtPayment),
      insurance: input.insurance,
      goals: input.goals,
      budgetStatus,
      savingsStatus,
      debtStatus,
      resilience,
      recommendation,
    },
  });
  await audit(trace, 'HEALTH_CHECK', row.publicId, recommendation, learner.id);
  return { id: row.publicId, budgetStatus, savingsStatus, debtStatus, resilience, recommendation };
}

export async function saveFraud(input: { learnerName: string; accountRef?: string; incidentType: string; incidentDate: string; amount?: number; reference?: string; channel: string; description: string; evidence?: string; reportedTo: string; action: string }, trace: Trace) {
  const row = await prisma.literacyFraud.create({
    data: {
      publicId: await nextPublicId('LFR'),
      learnerName: input.learnerName.trim(),
      accountRef: input.accountRef?.trim() || null,
      incidentType: input.incidentType,
      incidentDate: day(input.incidentDate) ?? new Date(),
      amount: input.amount == null ? null : decimal(input.amount),
      reference: input.reference?.trim() || null,
      channel: input.channel,
      description: input.description.trim(),
      evidence: input.evidence?.trim() || null,
      reportedTo: input.reportedTo.trim(),
      action: input.action.trim(),
      status: 'REPORTED',
    },
  });
  await audit(trace, 'FRAUD_REPORTED', row.publicId, input.incidentType);
  return { id: row.publicId, status: row.status };
}

export async function saveFeedback(input: { learnerId: string; courseName: string; trainerName: string; contentRating: number; trainerRating: number; practicality: number; clarity: number; languageRating: number; digitalRating: number; useful: string; least?: string; suggestions?: string }, trace: Trace) {
  const learner = await learnerByPublicId(input.learnerId);
  const ratings = [input.contentRating, input.trainerRating, input.practicality, input.clarity, input.languageRating, input.digitalRating];
  if (ratings.some((value) => value < 1 || value > 5)) throw errors.unprocessable('RATING_INVALID', 'Each rating is from 1 to 5.');
  const { learnerId: _learnerId, ...feedback } = input;
  const row = await prisma.literacyFeedback.create({
    data: { publicId: await nextPublicId('LFB'), learnerId: learner.id, ...feedback },
  });
  await audit(trace, 'FEEDBACK', row.publicId, input.courseName, learner.id);
  return { id: row.publicId };
}

export async function listRetraining() {
  const rows = await prisma.literacyRetraining.findMany({ include: { learner: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({
    id: row.publicId, learnerId: row.learner.publicId, learnerName: row.learner.name, reason: row.reason,
    previousCourse: row.previousCourse, modules: row.modules, status: row.status, deadline: iso(row.deadline),
  }));
}

export async function assignRetraining(id: string, input: { trainerName?: string; deadline?: string; status: string }, trace: Trace) {
  const row = await prisma.literacyRetraining.findUnique({ where: { publicId: id } });
  if (!row) throw errors.notFound('RETRAINING_NOT_FOUND', 'Retraining record not found.');
  if (!['ASSIGNED', 'COMPLETED', 'CANCELLED'].includes(input.status)) throw errors.unprocessable('STATUS_INVALID', 'Retraining can be assigned, completed, or cancelled.');
  await prisma.literacyRetraining.update({
    where: { id: row.id },
    data: { status: input.status, trainerName: input.trainerName?.trim() || row.trainerName, deadline: input.deadline ? day(input.deadline) : row.deadline },
  });
  await audit(trace, 'RETRAINING', row.publicId, input.status, row.learnerId);
  return { id: row.publicId, status: input.status };
}

export async function sendMessage(input: { learnerId?: string; kind: string; channel: string; subject: string; message: string }, trace: Trace) {
  const learner = input.learnerId ? await learnerByPublicId(input.learnerId) : null;
  const actorName = await actorLabel(trace.actorId);
  const row = await prisma.literacyMessage.create({
    data: {
      publicId: await nextPublicId('LMS'),
      learnerId: learner?.id,
      learnerName: learner?.name ?? 'Training group',
      kind: input.kind,
      channel: input.channel,
      subject: input.subject.trim(),
      message: input.message.trim(),
      sentBy: actorName,
      status: 'QUEUED',
    },
  });
  await queueNotice({ channel: input.channel, subject: input.subject, body: input.message });
  await audit(trace, 'MESSAGE', row.publicId, input.subject, learner?.id);
  return { id: row.publicId, status: row.status };
}

export async function listMessages() {
  const rows = await prisma.literacyMessage.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
  return rows.map((row) => ({ id: row.publicId, learnerName: row.learnerName, kind: row.kind, channel: row.channel, subject: row.subject, status: row.status, sentAt: iso(row.sentAt) }));
}

export async function listAudits() {
  const rows = await prisma.literacyAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({ id: row.publicId, action: row.action, actorName: row.actorName, reference: row.reference, detail: row.detail, createdAt: iso(row.createdAt) }));
}

export async function report(type: string) {
  if (type === 'certificates') return listCertificates();
  if (type === 'retraining') return listRetraining();
  if (type === 'evidence') {
    const rows = await prisma.literacyEvidence.findMany({ include: { learner: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((row) => ({ id: row.publicId, learnerName: row.learner.name, productName: row.productName, language: row.language, confirmed: row.confirmed, reference: row.reference }));
  }
  if (type === 'completion') {
    const rows = await prisma.literacyEnrollment.findMany({ include: { learner: true, course: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((row) => ({ id: row.publicId, learnerName: row.learner.name, courseName: row.course.name, status: row.status, progress: money(row.progress), preScore: row.preScore == null ? null : money(row.preScore), postScore: row.postScore == null ? null : money(row.postScore) }));
  }
  return listLearners({});
}

export async function checkpoint(learnerId: string) {
  const learner = await learnerByPublicId(learnerId);
  const [enrollments, evidence] = await Promise.all([
    prisma.literacyEnrollment.findMany({ where: { learnerId: learner.id }, include: { course: true } }),
    prisma.literacyEvidence.count({ where: { learnerId: learner.id, confirmed: true } }),
  ]);
  const creditReady = enrollments.some((row) => (row.status === 'COMPLETED' || row.course.code === 'FL-CREDIT') && row.status === 'COMPLETED' && /credit|borrow/i.test(`${row.course.code} ${row.course.name}`));
  return {
    learnerId: learner.publicId,
    creditReady,
    understandingConfirmed: evidence > 0,
    evidenceCount: evidence,
    note: 'A completed credit course and a confirmed understanding record are education evidence. They do not approve credit.',
  };
}

function normalizePhone(phone: string) {
  return phone.replace(/[\s()-]/g, '');
}

function presentPublicCourse(course: { id: string; name: string; description: string; duration: string; modules: { title: string }[] }) {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    duration: course.duration,
    moduleCount: course.modules.length,
  };
}

async function publicDesk(learnerPublicId: string) {
  const learner = await learnerByPublicId(learnerPublicId);
  const courses = (await listCourses()).filter((course) => OPEN_COURSE.includes(course.status));
  return {
    learner: {
      id: learner.publicId,
      name: learner.name,
      phone: learner.phone,
      language: learner.language,
      status: learner.status,
    },
    courses: courses.map(presentPublicCourse),
    lessons: await presentLessons(learner.id),
  };
}

async function learnerForPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const rows = await prisma.literacyLearner.findMany({
    where: { phone: { contains: normalized.slice(-9) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.find((row) => normalizePhone(row.phone) === normalized) ?? null;
}

export async function publicCatalogue() {
  const courses = (await listCourses()).filter((course) => OPEN_COURSE.includes(course.status));
  return courses.map(presentPublicCourse);
}

export async function publicJoin(input: { name: string; phone: string; email?: string; language: string }, trace: Trace) {
  const phone = normalizePhone(input.phone);
  if (phone.length < 8) throw errors.unprocessable('PHONE_INVALID', 'Enter a phone number with at least 8 digits.');
  const existing = await learnerForPhone(phone);
  if (existing) return publicDesk(existing.publicId);
  const tail = phone.slice(-9);
  const students = await prisma.student.findMany({
    where: { telephone: { contains: tail } },
    select: { publicId: true, telephone: true },
    take: 20,
  });
  const student = students.find((row) => row.telephone && normalizePhone(row.telephone) === phone);
  const guardians = student ? [] : await prisma.guardian.findMany({
    where: { phone: { contains: tail } },
    select: { publicId: true, phone: true },
    take: 20,
  });
  const guardian = guardians.find((row) => row.phone && normalizePhone(row.phone) === phone);
  const file = await saveLearner({
    learnerType: student ? 'STUDENT' : guardian ? 'PARENT' : 'STUDENT',
    partyId: student?.publicId ?? guardian?.publicId,
    name: input.name.trim(),
    phone,
    email: input.email,
    language: input.language,
    trainingNeeds: 'Public training. The learner follows open courses on the public site and receives a certificate from the system.',
  }, trace);
  return publicDesk(file.id);
}

export async function publicContinue(phone: string) {
  const learner = await learnerForPhone(phone);
  if (!learner) throw errors.notFound('LEARNER_NOT_FOUND', 'No training file uses that phone. Start with your name and phone.');
  return publicDesk(learner.publicId);
}

async function assertPublicLearner(learnerId: string, phone: string) {
  const learner = await learnerByPublicId(learnerId);
  if (normalizePhone(learner.phone) !== normalizePhone(phone)) {
    throw errors.forbidden('Use the phone number on this training file.');
  }
  return learner;
}

export async function publicEnrol(input: { learnerId: string; phone: string; courseId: string }, trace: Trace) {
  const learner = await assertPublicLearner(input.learnerId, input.phone);
  const today = new Date().toISOString().slice(0, 10);
  await enrol({ learnerId: learner.publicId, courseId: input.courseId, deliveryMethod: 'ONLINE', startDate: today }, trace);
  return publicDesk(learner.publicId);
}

async function gradeQuiz(enrollmentId: string, answers: QuizAnswer[], trace: Trace) {
  const enrollment = await prisma.literacyEnrollment.findUnique({
    where: { publicId: enrollmentId },
    include: { course: true, learner: true, certificate: true, assessments: { where: { kind: 'QUIZ' } } },
  });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  if (enrollment.certificate) return enrollment.learner.publicId;
  if (enrollment.status === 'FAILED' || enrollment.status === 'WITHDRAWN' || enrollment.status === 'EXPIRED') {
    throw errors.unprocessable('ENROLLMENT_CLOSED', 'This enrolment is closed.');
  }
  const modules = readModules(enrollment.course.modules);
  const completed = completedModules(enrollment.exercises, modules.length, false);
  if (modules.some((_, index) => !completed.includes(index))) {
    throw errors.unprocessable('MODULES_REQUIRED', 'Finish every module before the questions.');
  }
  const questions = await ensureQuestions(enrollment.course);
  if (!questions.length) throw errors.unprocessable('QUESTIONS_REQUIRED', 'This course has no questions yet.');
  const items = questions.map((question) => ({
    prompt: question.prompt,
    correct: questionCorrect(question, answers.find((answer) => answer.id === question.id)),
  }));
  const correct = items.filter((item) => item.correct).length;
  const percentage = round2((correct / questions.length) * 100);
  const passMark = money(enrollment.course.passMark);
  const attempt = enrollment.assessments.length + 1;
  const passed = percentage >= passMark;
  const result = passed ? 'PASSED' : attempt >= 3 ? 'FAILED' : 'RETAKE_REQUIRED';
  const scores = Object.fromEntries(AREAS.map((area) => [area, percentage])) as Scores;
  await prisma.literacyAssessment.create({
    data: {
      publicId: await nextPublicId('LAS'),
      enrollmentId: enrollment.id,
      kind: 'QUIZ',
      scores: asJson(scores),
      percentage: decimal(percentage),
      passMark: decimal(passMark),
      result,
      attempt,
      reviewer: 'System',
    },
  });
  const log: unknown[] = Array.isArray(enrollment.exercises) ? [...enrollment.exercises] : [];
  log.push({ kind: 'QUIZ_MARK', percentage, passed, correct, total: questions.length, items });
  await prisma.literacyEnrollment.update({
    where: { id: enrollment.id },
    data: {
      exercises: asJson(log),
      postScore: decimal(percentage),
      progress: decimal(passed ? 100 : 80),
      status: passed ? 'COMPLETED' : result === 'FAILED' ? 'FAILED' : 'IN_PROGRESS',
    },
  });
  if (passed) {
    await issueSystemCertificate(enrollment.id, trace, percentage);
  } else if (result === 'FAILED') {
    const open = await prisma.literacyRetraining.findFirst({
      where: { learnerId: enrollment.learnerId, previousCourse: enrollment.course.name, status: { in: ['REQUIRED', 'ASSIGNED'] } },
    });
    if (!open) {
      await prisma.literacyRetraining.create({
        data: {
          publicId: await nextPublicId('LRT'),
          learnerId: enrollment.learnerId,
          reason: `Quiz score ${percentage} is below the pass mark of ${passMark}.`,
          previousCourse: enrollment.course.name,
          modules: 'Questions',
          status: 'REQUIRED',
        },
      });
    }
  }
  await audit(trace, 'QUIZ_MARKED', enrollment.publicId, `${percentage}`, enrollment.learnerId);
  return enrollment.learner.publicId;
}

export async function markQuiz(actorId: string | undefined, enrollmentId: string, answers: QuizAnswer[], trace: Trace) {
  const user = await loadStudyUser(actorId);
  const enrollment = await prisma.literacyEnrollment.findUnique({ where: { publicId: enrollmentId }, include: { learner: true } });
  if (!enrollment) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  await assertStudyLearner(user, enrollment.learner);
  const learnerId = await gradeQuiz(enrollmentId, answers, trace);
  return studyDesk(actorId, learnerId);
}

export async function publicComplete(input: { learnerId: string; phone: string; enrollmentId: string; moduleIndex: number }, trace: Trace) {
  const learner = await assertPublicLearner(input.learnerId, input.phone);
  const enrollment = await prisma.literacyEnrollment.findUnique({ where: { publicId: input.enrollmentId }, select: { learnerId: true } });
  if (!enrollment || enrollment.learnerId !== learner.id) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  await advanceModule(input.enrollmentId, input.moduleIndex, trace);
  return publicDesk(learner.publicId);
}

export async function publicQuiz(input: { learnerId: string; phone: string; enrollmentId: string; answers: QuizAnswer[] }, trace: Trace) {
  const learner = await assertPublicLearner(input.learnerId, input.phone);
  const enrollment = await prisma.literacyEnrollment.findUnique({ where: { publicId: input.enrollmentId }, select: { learnerId: true } });
  if (!enrollment || enrollment.learnerId !== learner.id) throw errors.notFound('ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  await gradeQuiz(input.enrollmentId, input.answers, trace);
  return publicDesk(learner.publicId);
}
