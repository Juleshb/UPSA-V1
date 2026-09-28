import {
  AssessmentStatus,
  CorridorStatus,
  CreditDecision,
  KycKind,
  KycRecordStatus,
  GuaranteeDecision,
  GuaranteeStatus,
  InstitutionType,
  InvoiceStatus,
  KybStatus,
  LoanApplicationStatus,
  LoanStatus,
  PaymentChannel,
  PaymentInfrastructure,
  PaymentStatus,
  PrismaClient,
  RailKind,
  ReconciliationStatus,
  SchoolStatus,
  UserRole,
} from '@prisma/client';
import { hashPassword } from '../src/utils/auth';
import { invoiceStatusFor } from '../src/services/invoices.service';
import { refreshStudentAccount } from '../src/services/students.service';
import { nextPublicId } from '../src/utils/ids';
import { decimal, money } from '../src/utils/money';

const prisma = new PrismaClient();

async function upsertUser(input: {
  publicId: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  password: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: { role: input.role, fullName: input.fullName },
    create: {
      publicId: input.publicId,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
    },
  });
}

async function ensureSchool(input: {
  publicId: string;
  rupsaMemberId: string;
  schoolName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  province: string;
  district: string;
  sector: string;
}) {
  return prisma.school.upsert({
    where: { registrationNumber: input.registrationNumber },
    update: { schoolName: input.schoolName, status: SchoolStatus.ACTIVE, kybStatus: KybStatus.VERIFIED },
    create: {
      ...input,
      taxIdentificationNumber: `TIN-${input.registrationNumber}`,
      status: SchoolStatus.ACTIVE,
      kybStatus: KybStatus.VERIFIED,
    },
  });
}

async function ensureStudent(input: {
  publicId: string;
  schoolId: string;
  studentExternalId: string;
  studentName: string;
  classLevel: string;
  feeCategory: string;
  guardianId: string;
}) {
  return prisma.student.upsert({
    where: { schoolId_studentExternalId: { schoolId: input.schoolId, studentExternalId: input.studentExternalId } },
    update: { studentName: input.studentName, status: 'ACTIVE' },
    create: {
      publicId: input.publicId,
      schoolId: input.schoolId,
      studentExternalId: input.studentExternalId,
      studentName: input.studentName,
      academicYear: '2026',
      classLevel: input.classLevel,
      feeCategory: input.feeCategory,
      financialAccount: { create: {} },
      guardians: { create: { guardianId: input.guardianId, isPrimary: true } },
    },
  });
}

async function issueInvoice(input: {
  publicId: string;
  schoolId: string;
  studentId: string;
  amount: number;
  description: string;
  createdAt: Date;
  dueDate: Date;
}) {
  const existing = await prisma.invoice.findUnique({ where: { publicId: input.publicId } });
  if (existing) return existing;
  return prisma.invoice.create({
    data: {
      publicId: input.publicId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      currency: 'RWF',
      amount: decimal(input.amount),
      amountPaid: decimal(0),
      balance: decimal(input.amount),
      description: input.description,
      status: InvoiceStatus.ISSUED,
      dueDate: input.dueDate,
      createdAt: input.createdAt,
      lineItems: { create: [{ description: input.description, amount: decimal(input.amount) }] },
    },
  });
}

async function settleLikeApi(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: true },
  });
  if (payment.status !== PaymentStatus.SUCCESS) return;

  if (!await prisma.receipt.findFirst({ where: { paymentId: payment.id } })) {
    await prisma.receipt.create({
      data: {
        publicId: await nextPublicId('RCT'),
        invoiceId: payment.invoiceId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }

  if (!await prisma.reconciliation.findFirst({ where: { paymentId: payment.id } })) {
    await prisma.reconciliation.create({
      data: {
        publicId: await nextPublicId('REC'),
        invoiceId: payment.invoiceId,
        paymentId: payment.id,
        status: ReconciliationStatus.MATCHED,
      },
    });
  }

  if (!await prisma.webhookEvent.findFirst({ where: { paymentId: payment.id, event: 'PAYMENT.SUCCESS' } })) {
    await prisma.webhookEvent.create({
      data: {
        eventId: `EVT-${payment.publicId}`,
        event: 'PAYMENT.SUCCESS',
        paymentId: payment.id,
        invoiceId: payment.invoice.publicId,
        amount: payment.amount,
        currency: payment.currency,
        transactionReference: payment.transactionReference,
        payload: {
          event: 'PAYMENT.SUCCESS',
          paymentId: payment.publicId,
          invoiceId: payment.invoice.publicId,
        },
      },
    });
  }

  const collected = await prisma.payment.findMany({
    where: { invoiceId: payment.invoiceId, status: PaymentStatus.SUCCESS },
  });
  const amountPaid = collected.reduce((sum, row) => sum + money(row.amount), 0);
  const amount = money(payment.invoice.amount);
  await prisma.invoice.update({
    where: { id: payment.invoiceId },
    data: {
      amountPaid: decimal(amountPaid),
      balance: decimal(amount - amountPaid),
      status: invoiceStatusFor(amount, amountPaid),
    },
  });
}

async function initiateAndConfirmPayment(input: {
  publicId: string;
  invoiceId: string;
  amount: number;
  channel: PaymentChannel;
  createdAt: Date;
}) {
  const reference = `TXN-${input.publicId.slice(-6)}`;
  const existing = await prisma.payment.findUnique({ where: { publicId: input.publicId } });
  const payment = existing ?? await prisma.payment.create({
    data: {
      publicId: input.publicId,
      invoiceId: input.invoiceId,
      amount: decimal(input.amount),
      currency: 'RWF',
      paymentChannel: input.channel,
      payerReference: `PAYREF-${input.publicId.slice(-6)}`,
      status: PaymentStatus.PENDING,
      createdAt: input.createdAt,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.SUCCESS,
      transactionReference: payment.transactionReference ?? reference,
      settlementReference: payment.settlementReference ?? reference,
    },
  });
  await settleLikeApi(payment.id);
}

async function seedPaymentArchitecture() {
  const rails: Array<{
    code: string;
    name: string;
    kind: RailKind;
    country: string;
    infrastructure: PaymentInfrastructure;
    institutionName: string;
    priority: number;
  }> = [
    { code: 'BK-RSWITCH', name: 'Bank of Kigali', kind: RailKind.BANK, country: 'RW', infrastructure: PaymentInfrastructure.RSWITCH, institutionName: 'Bank of Kigali', priority: 10 },
    { code: 'EQUITY-RSWITCH', name: 'Equity Bank Rwanda', kind: RailKind.BANK, country: 'RW', infrastructure: PaymentInfrastructure.RSWITCH, institutionName: 'Equity Bank Rwanda', priority: 20 },
    { code: 'MTN-MOMO', name: 'MTN Mobile Money', kind: RailKind.MOBILE_MONEY, country: 'RW', infrastructure: PaymentInfrastructure.RSWITCH, institutionName: 'MTN Rwanda', priority: 10 },
    { code: 'AIRTEL-MONEY', name: 'Airtel Money', kind: RailKind.MOBILE_MONEY, country: 'RW', infrastructure: PaymentInfrastructure.RSWITCH, institutionName: 'Airtel Rwanda', priority: 20 },
    { code: 'RSWITCH-PSP', name: 'RSwitch', kind: RailKind.PSP, country: 'RW', infrastructure: PaymentInfrastructure.RSWITCH, institutionName: 'RSwitch', priority: 10 },
    { code: 'CARD-ACQUIRER', name: 'Approved card acquirer', kind: RailKind.CARD, country: 'RW', infrastructure: PaymentInfrastructure.NATIONAL, institutionName: 'Licensed card acquirer', priority: 10 },
    { code: 'TIPS-BANK', name: 'Tanzania bank rail', kind: RailKind.BANK, country: 'TZ', infrastructure: PaymentInfrastructure.TIPS, institutionName: 'Approved Tanzanian bank', priority: 10 },
    { code: 'TIPS-MOMO', name: 'Tanzania mobile money', kind: RailKind.MOBILE_MONEY, country: 'TZ', infrastructure: PaymentInfrastructure.TIPS, institutionName: 'Approved Tanzanian mobile-money issuer', priority: 10 },
    { code: 'TIPS-PSP', name: 'TIPS', kind: RailKind.PSP, country: 'TZ', infrastructure: PaymentInfrastructure.TIPS, institutionName: 'Tanzania Instant Payment System', priority: 10 },
  ];

  for (const rail of rails) {
    await prisma.paymentRail.upsert({
      where: { code: rail.code },
      update: {
        name: rail.name,
        kind: rail.kind,
        infrastructure: rail.infrastructure,
        institutionName: rail.institutionName,
        priority: rail.priority,
        status: 'APPROVED',
      },
      create: rail,
    });
  }

  const corridors = [
    { code: 'RW-TZ', originCountry: 'RW', destinationCountry: 'TZ', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.TIPS, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'Tanzania (TIPS)', status: CorridorStatus.PILOT },
    { code: 'RW-UG', originCountry: 'RW', destinationCountry: 'UG', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.NATIONAL, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'Uganda', status: CorridorStatus.PLANNED },
    { code: 'RW-KE', originCountry: 'RW', destinationCountry: 'KE', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.NATIONAL, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'Kenya', status: CorridorStatus.PLANNED },
    { code: 'RW-BI', originCountry: 'RW', destinationCountry: 'BI', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.NATIONAL, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'Burundi', status: CorridorStatus.PLANNED },
    { code: 'RW-SS', originCountry: 'RW', destinationCountry: 'SS', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.NATIONAL, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'South Sudan', status: CorridorStatus.PLANNED },
    { code: 'RW-CD', originCountry: 'RW', destinationCountry: 'CD', originInfrastructure: PaymentInfrastructure.RSWITCH, destinationInfrastructure: PaymentInfrastructure.NATIONAL, originLabel: 'Rwanda (RSwitch)', destinationLabel: 'DRC', status: CorridorStatus.PLANNED },
  ];

  for (const corridor of corridors) {
    await prisma.eacCorridor.upsert({
      where: { code: corridor.code },
      update: {
        status: corridor.status,
        originLabel: corridor.originLabel,
        destinationLabel: corridor.destinationLabel,
      },
      create: corridor,
    });
  }
}

async function backfillPaymentFlow() {
  const railByChannel: Partial<Record<PaymentChannel, string>> = {
    BANK: 'BK-RSWITCH',
    MOBILE_PAYMENT: 'MTN-MOMO',
    PSP: 'RSWITCH-PSP',
    CARD: 'CARD-ACQUIRER',
  };
  const payments = await prisma.payment.findMany({ include: { invoice: true, flowSteps: true } });
  for (const payment of payments) {
    if (payment.flowSteps.length > 0) continue;
    const rail = await prisma.paymentRail.findUnique({
      where: { code: railByChannel[payment.paymentChannel] ?? 'RSWITCH-PSP' },
    });
    const confirmed = payment.status === PaymentStatus.SUCCESS;
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        railId: rail?.id,
        originCountry: payment.originCountry || 'RW',
        destinationCountry: payment.destinationCountry || 'RW',
        instructionRef: payment.instructionRef ?? `INS-${payment.publicId}`,
        flowCode: confirmed ? 'PAY-05' : 'PAY-02',
      },
    });
    await prisma.paymentFlowStep.createMany({
      data: [
        { paymentId: payment.id, code: 'PAY-01', label: 'Payment Request', detail: `Request for invoice ${payment.invoice.publicId}`, status: 'RECORDED' },
        { paymentId: payment.id, code: 'PAY-02', label: 'Instruction', detail: rail ? `Routed to ${rail.name} (${rail.infrastructure})` : 'Instruction', status: 'RECORDED' },
        ...(confirmed ? [
          { paymentId: payment.id, code: 'PAY-03', label: 'Confirmation', detail: payment.transactionReference ?? 'Rail confirmation', status: 'RECORDED' },
          { paymentId: payment.id, code: 'PAY-04', label: 'Receipt', detail: 'Receipt issued to the school ledger', status: 'RECORDED' },
          { paymentId: payment.id, code: 'PAY-05', label: 'Reconciliation', detail: 'Matched to the school ledger', status: 'RECORDED' },
        ] : []),
      ],
    });
    if (confirmed) {
      const existing = await prisma.domainEvent.findFirst({
        where: { aggregateId: payment.publicId, eventType: 'PAYMENT.SUCCESS' },
      });
      if (!existing) {
        await prisma.domainEvent.create({
          data: {
            eventType: 'PAYMENT.SUCCESS',
            aggregateId: payment.publicId,
            payload: { paymentId: payment.publicId, flowCode: 'PAY-05', rail: rail?.code ?? null },
            processedAt: payment.updatedAt,
          },
        });
      }
    }
  }
}

async function raiseSequence(prefix: string, publicIds: string[]) {
  const max = publicIds.reduce((highest, publicId) => {
    const match = publicId.match(/(\d+)$/);
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  if (!max) return;
  const current = await prisma.idSequence.findUnique({ where: { prefix } });
  const value = Math.max(current?.value ?? 0, max);
  await prisma.idSequence.upsert({
    where: { prefix },
    create: { prefix, value },
    update: { value },
  });
}

async function syncIssuedIds() {
  const [payments, receipts, reconciliations] = await Promise.all([
    prisma.payment.findMany({ select: { publicId: true } }),
    prisma.receipt.findMany({ select: { publicId: true } }),
    prisma.reconciliation.findMany({ select: { publicId: true } }),
  ]);
  await raiseSequence('RUPSA-PAY', payments.map((row) => row.publicId));
  await raiseSequence('RUPSA-RCT', receipts.map((row) => row.publicId));
  await raiseSequence('RUPSA-REC', reconciliations.map((row) => row.publicId));
}

async function seedRegistrationDossier(schoolId: string) {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  if (!await prisma.schoolOwnership.findFirst({ where: { schoolId } })) {
    await prisma.schoolOwnership.create({
      data: { schoolId, ownerName: 'Jean Baptiste Habimana', ownershipPct: 100, nationalId: '1197080012345678' },
    });
  }
  if (!await prisma.schoolRepresentative.findFirst({ where: { schoolId, authorized: false } })) {
    await prisma.schoolRepresentative.create({
      data: { schoolId, fullName: 'Claudine Uwimana', title: 'Head teacher', phone: '+250788111001', email: 'head@example.rw', authorized: false },
    });
  }
  if (!await prisma.schoolRepresentative.findFirst({ where: { schoolId, authorized: true } })) {
    await prisma.schoolRepresentative.create({
      data: { schoolId, fullName: 'School Finance Officer', title: 'Authorized signatory', phone: '+250788000002', email: 'finance@example.rw', authorized: true },
    });
  }
  if (!await prisma.schoolBankAccount.findFirst({ where: { schoolId } })) {
    await prisma.schoolBankAccount.create({
      data: { schoolId, bankName: 'Bank of Kigali', accountName: 'Example Private School', accountNumber: '000123456789', isPrimary: true },
    });
  }
  if (!await prisma.schoolDocument.findFirst({ where: { schoolId } })) {
    await prisma.schoolDocument.createMany({
      data: [
        { schoolId, documentType: 'REGISTRATION_CERTIFICATE', fileRef: 'rdb-registration.pdf', status: 'ACCEPTED' },
        { schoolId, documentType: 'LICENSE', fileRef: 'operating-licence.pdf', status: 'ACCEPTED' },
        { schoolId, documentType: 'RUPSA_MEMBERSHIP', fileRef: 'rupsa-membership-letter.pdf', status: 'ACCEPTED' },
      ],
    });
  }
  if (!await prisma.kycRecord.findFirst({ where: { schoolId, kind: KycKind.KYB } })) {
    await prisma.kycRecord.create({
      data: {
        publicId: await nextPublicId('KYC'),
        kind: KycKind.KYB,
        subjectId: school.publicId,
        schoolId,
        status: KycRecordStatus.VERIFIED,
        notes: 'Registration certificate, licence and RUPSA membership letter checked.',
      },
    });
  }
}

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';

  const admin = await upsertUser({
    publicId: 'RUPSA-USR-000001',
    email: 'admin@rupsanext.rw',
    fullName: 'RUPSA Platform Administrator',
    role: UserRole.SYSTEM_ADMINISTRATOR,
    password,
  });

  const schoolOfficer = await upsertUser({
    publicId: 'RUPSA-USR-000002',
    email: 'finance@example.rw',
    fullName: 'School Finance Officer',
    role: UserRole.SCHOOL_USER,
    phone: '+250788000002',
    password,
  });

  const bankOfficer = await upsertUser({
    publicId: 'RUPSA-USR-000003',
    email: 'credit@bank.rw',
    fullName: 'Bank Credit Officer',
    role: UserRole.BANK_USER,
    password,
  });

  const parentUser = await upsertUser({
    publicId: 'RUPSA-USR-000004',
    email: 'parent@example.rw',
    fullName: 'Parent Guardian',
    role: UserRole.PARENT,
    phone: '+250788000004',
    password,
  });

  const institution = await prisma.financialInstitution.upsert({
    where: { publicId: 'FI-001' },
    update: {},
    create: {
      publicId: 'FI-001',
      name: 'Example Development Bank',
      type: InstitutionType.BANK,
      clientId: 'rupsa-fi-001',
      webhookUrl: 'https://example.rw/webhooks/rupsa',
    },
  });

  await prisma.institutionUser.upsert({
    where: { institutionId_userId: { institutionId: institution.id, userId: bankOfficer.id } },
    update: {},
    create: { institutionId: institution.id, userId: bankOfficer.id, title: 'Credit officer' },
  });

  const schools = [
    await ensureSchool({
      publicId: 'RUPSA-SCH-000123',
      rupsaMemberId: 'RUPSA-MEM-000123',
      schoolName: 'Example Private School',
      registrationNumber: 'SCH-12345',
      email: 'school@example.rw',
      phone: '+250788000100',
      province: 'Kigali',
      district: 'Gasabo',
      sector: 'Kacyiru',
    }),
    await ensureSchool({
      publicId: 'RUPSA-SCH-000201',
      rupsaMemberId: 'RUPSA-MEM-000201',
      schoolName: 'Green Hills Academy',
      registrationNumber: 'SCH-20126',
      email: 'finance@greenhills.rw',
      phone: '+250788000201',
      province: 'City Of Kigali',
      district: 'Kicukiro',
      sector: 'Gikondo',
    }),
    await ensureSchool({
      publicId: 'RUPSA-SCH-000202',
      rupsaMemberId: 'RUPSA-MEM-000202',
      schoolName: 'Lycée de Nyanza',
      registrationNumber: 'SCH-20226',
      email: 'accounts@lyceenyanza.rw',
      phone: '+250788000202',
      province: 'Southern',
      district: 'Nyanza',
      sector: 'Busasamana',
    }),
    await ensureSchool({
      publicId: 'RUPSA-SCH-000203',
      rupsaMemberId: 'RUPSA-MEM-000203',
      schoolName: 'Rubavu Lakeside College',
      registrationNumber: 'SCH-20326',
      email: 'bursar@lakeside.rw',
      phone: '+250788000203',
      province: 'Western',
      district: 'Rubavu',
      sector: 'Gisenyi',
    }),
  ];

  await prisma.schoolUser.upsert({
    where: { schoolId_userId: { schoolId: schools[0].id, userId: schoolOfficer.id } },
    update: {},
    create: { schoolId: schools[0].id, userId: schoolOfficer.id, title: 'Finance Officer' },
  });

  await seedRegistrationDossier(schools[0].id);
  await prisma.school.updateMany({
    where: { status: SchoolStatus.ACTIVE, membershipStatus: 'UNVERIFIED' },
    data: { membershipStatus: 'VERIFIED' },
  });

  const guardian = await prisma.guardian.upsert({
    where: { publicId: 'RUPSA-GRD-000123' },
    update: { userId: parentUser.id },
    create: {
      publicId: 'RUPSA-GRD-000123',
      userId: parentUser.id,
      fullName: 'Parent Guardian',
      phone: '+250788000004',
      email: 'parent@example.rw',
      preferredCountry: 'RW',
      notifyChannel: 'IN_APP',
    },
  });

  const existingConsent = await prisma.consent.findFirst({
    where: { subjectId: guardian.publicId, purpose: 'PARENTAL_RESPONSIBILITY', status: 'ACTIVE' },
  });
  if (!existingConsent) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);
    await prisma.consent.create({
      data: {
        publicId: 'RUPSA-CON-000123',
        subjectId: guardian.publicId,
        purpose: 'PARENTAL_RESPONSIBILITY',
        recipient: 'RUPSA NEXT',
        scope: ['student.identity', 'school.enrolment', 'fees.outstanding', 'payment.history', 'digital.receipts', 'notifications'],
        expiresAt,
        evidenceRef: 'seed',
      },
    });
  }

  const roster = [
    { publicId: 'RUPSA-STD-000123', school: schools[0], externalId: 'STU-10001', name: 'Aline Uwase', classLevel: 'S3', feeCategory: 'DAY' },
    { publicId: 'RUPSA-STD-000201', school: schools[0], externalId: 'STU-10002', name: 'Eric Niyonzima', classLevel: 'S5', feeCategory: 'BOARDING' },
    { publicId: 'RUPSA-STD-000202', school: schools[0], externalId: 'STU-10003', name: 'Divine Ingabire', classLevel: 'P6', feeCategory: 'DAY' },
    { publicId: 'RUPSA-STD-000203', school: schools[1], externalId: 'GHA-2201', name: 'Kevin Habimana', classLevel: 'S2', feeCategory: 'DAY' },
    { publicId: 'RUPSA-STD-000204', school: schools[1], externalId: 'GHA-2202', name: 'Sarah Mukamana', classLevel: 'S4', feeCategory: 'BOARDING' },
    { publicId: 'RUPSA-STD-000205', school: schools[2], externalId: 'LDN-3101', name: 'Patrick Iradukunda', classLevel: 'S1', feeCategory: 'DAY' },
    { publicId: 'RUPSA-STD-000206', school: schools[2], externalId: 'LDN-3102', name: 'Chantal Uwimana', classLevel: 'S6', feeCategory: 'BOARDING' },
    { publicId: 'RUPSA-STD-000207', school: schools[3], externalId: 'RLC-4101', name: 'Jean Claude Habimana', classLevel: 'S3', feeCategory: 'DAY' },
    { publicId: 'RUPSA-STD-000208', school: schools[3], externalId: 'RLC-4102', name: 'Ange Imanishimwe', classLevel: 'S5', feeCategory: 'BOARDING' },
  ];

  const students = [];
  for (const row of roster) {
    students.push(await ensureStudent({
      publicId: row.publicId,
      schoolId: row.school.id,
      studentExternalId: row.externalId,
      studentName: row.name,
      classLevel: row.classLevel,
      feeCategory: row.feeCategory,
      guardianId: guardian.id,
    }));
  }

  for (const school of schools) {
    const existingProfile = await prisma.financialProfile.findFirst({ where: { schoolId: school.id } });
    if (!existingProfile) {
      await prisma.financialProfile.create({
        data: {
          schoolId: school.id,
          profileStatus: 'VERIFIED',
          studentCount: school.publicId.endsWith('123') ? 850 : 420,
          averageMonthlyCollections: school.publicId.endsWith('123') ? 85_000_000 : 28_000_000,
          collectionRate: 91.4,
          existingLoanExposure: school.publicId.endsWith('123') ? 120_000_000 : 36_000_000,
          dataAsOf: new Date('2026-08-31'),
        },
      });
    }
  }

  await seedPaymentArchitecture();

  const book: Array<{
    publicId: string;
    studentIndex: number;
    amount: number;
    paid: number;
    description: string;
    month: number;
    day: number;
    channel?: PaymentChannel;
  }> = [
    { publicId: 'RUPSA-INV-000201', studentIndex: 0, amount: 8_400_000, paid: 8_400_000, description: 'Term 2 day fees — S1 to S3', month: 3, day: 4, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000202', studentIndex: 1, amount: 6_200_000, paid: 4_100_000, description: 'Term 2 boarding — S4 to S6', month: 3, day: 8, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000203', studentIndex: 3, amount: 5_800_000, paid: 5_800_000, description: 'April tuition intake', month: 3, day: 12, channel: PaymentChannel.PSP },
    { publicId: 'RUPSA-INV-000204', studentIndex: 0, amount: 9_150_000, paid: 7_600_000, description: 'May examination and laboratory fees', month: 4, day: 5, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000205', studentIndex: 4, amount: 7_250_000, paid: 7_250_000, description: 'May boarding settlement', month: 4, day: 11, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000206', studentIndex: 5, amount: 4_900_000, paid: 2_200_000, description: 'May day-scholar arrears', month: 4, day: 18, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000207', studentIndex: 2, amount: 10_400_000, paid: 10_400_000, description: 'June term-close collections', month: 5, day: 3, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000208', studentIndex: 6, amount: 6_750_000, paid: 6_750_000, description: 'June boarding top-up', month: 5, day: 14, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000209', studentIndex: 7, amount: 3_800_000, paid: 0, description: 'June transport levy', month: 5, day: 21 },
    { publicId: 'RUPSA-INV-000210', studentIndex: 1, amount: 12_600_000, paid: 9_800_000, description: 'July term 3 issue — boarding', month: 6, day: 2, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000211', studentIndex: 3, amount: 8_900_000, paid: 8_900_000, description: 'July term 3 issue — day', month: 6, day: 7, channel: PaymentChannel.PSP },
    { publicId: 'RUPSA-INV-000212', studentIndex: 8, amount: 5_450_000, paid: 1_800_000, description: 'July lakeside day fees', month: 6, day: 16, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000213', studentIndex: 0, amount: 11_200_000, paid: 11_200_000, description: 'August collection drive', month: 7, day: 6, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000214', studentIndex: 4, amount: 7_800_000, paid: 5_400_000, description: 'August boarding balance', month: 7, day: 13, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000215', studentIndex: 5, amount: 4_350_000, paid: 4_350_000, description: 'August Nyanza day fees', month: 7, day: 20, channel: PaymentChannel.PSP },
    { publicId: 'RUPSA-INV-000216', studentIndex: 2, amount: 13_500_000, paid: 8_250_000, description: 'September term 1 day fees', month: 8, day: 2, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000217', studentIndex: 6, amount: 9_600_000, paid: 9_600_000, description: 'September boarding intake', month: 8, day: 8, channel: PaymentChannel.BANK },
    { publicId: 'RUPSA-INV-000218', studentIndex: 7, amount: 6_150_000, paid: 0, description: 'September lakeside extras', month: 8, day: 12 },
    { publicId: 'RUPSA-INV-000219', studentIndex: 1, amount: 4_800_000, paid: 1_200_000, description: 'September laboratory fees', month: 8, day: 18, channel: PaymentChannel.MOBILE_PAYMENT },
    { publicId: 'RUPSA-INV-000220', studentIndex: 3, amount: 3_250_000, paid: 0, description: 'September sports levy', month: 8, day: 22 },
  ];

  for (const row of book) {
    const student = students[row.studentIndex];
    const createdAt = new Date(2026, row.month, row.day, 9, 30);
    const invoice = await issueInvoice({
      publicId: row.publicId,
      schoolId: student.schoolId,
      studentId: student.id,
      amount: row.amount,
      description: row.description,
      createdAt,
      dueDate: new Date(2026, row.month, Math.min(row.day + 18, 28)),
    });
    if (row.paid > 0 && row.channel) {
      await initiateAndConfirmPayment({
        publicId: row.publicId.replace('INV', 'PAY'),
        invoiceId: invoice.id,
        amount: row.paid,
        channel: row.channel,
        createdAt: new Date(2026, row.month, row.day + 2, 14, 10),
      });
    }
  }

  await backfillPaymentFlow();

  for (const student of students) {
    await refreshStudentAccount(student.id);
  }

  const facility = await prisma.guaranteeFacility.findFirst()
    ?? await prisma.guaranteeFacility.create({
      data: {
        name: 'RUPSA Member Guarantee Facility',
        maximumExposure: 5_000_000_000,
        availableCapacity: 5_000_000_000,
        outstandingGuarantees: 0,
      },
    });

  const creditBook = [
    {
      applicationId: 'RUPSA-LA-000201',
      loanId: 'RUPSA-LOAN-000201',
      guaranteeId: 'RUPSA-GUA-000201',
      school: schools[0],
      productCode: 'WORKING_CAPITAL',
      purpose: 'Term 3 payroll and boarding supplies',
      requested: 85_000_000,
      approved: 80_000_000,
      outstanding: 62_400_000,
      applicationStatus: LoanApplicationStatus.ACTIVE,
      loanStatus: LoanStatus.ACTIVE,
      guaranteeStatus: GuaranteeStatus.ACTIVE,
      guaranteeAmount: 48_000_000,
      createdAt: new Date('2026-05-12T10:00:00'),
    },
    {
      applicationId: 'RUPSA-LA-000202',
      loanId: 'RUPSA-LOAN-000202',
      guaranteeId: 'RUPSA-GUA-000202',
      school: schools[1],
      productCode: 'CAPEX',
      purpose: 'Science block completion',
      requested: 46_000_000,
      approved: 42_000_000,
      outstanding: 39_800_000,
      applicationStatus: LoanApplicationStatus.ACTIVE,
      loanStatus: LoanStatus.IN_ARREARS,
      guaranteeStatus: GuaranteeStatus.ACTIVE,
      guaranteeAmount: 25_200_000,
      createdAt: new Date('2026-06-20T10:00:00'),
    },
    {
      applicationId: 'RUPSA-LA-000203',
      loanId: 'RUPSA-LOAN-000203',
      guaranteeId: 'RUPSA-GUA-000203',
      school: schools[2],
      productCode: 'WORKING_CAPITAL',
      purpose: 'Fee-bridge for term opening',
      requested: 28_000_000,
      approved: 24_000_000,
      outstanding: 21_500_000,
      applicationStatus: LoanApplicationStatus.ACTIVE,
      loanStatus: LoanStatus.ACTIVE,
      guaranteeStatus: GuaranteeStatus.ACTIVE,
      guaranteeAmount: 14_400_000,
      createdAt: new Date('2026-07-28T10:00:00'),
    },
    {
      applicationId: 'RUPSA-LA-000204',
      school: schools[3],
      productCode: 'WORKING_CAPITAL',
      purpose: 'September intake working capital',
      requested: 18_000_000,
      applicationStatus: LoanApplicationStatus.SUBMITTED,
      createdAt: new Date('2026-09-08T10:00:00'),
    },
    {
      applicationId: 'RUPSA-LA-000205',
      school: schools[0],
      productCode: 'CAPEX',
      purpose: 'Bus fleet replacement',
      requested: 32_000_000,
      applicationStatus: LoanApplicationStatus.OFFER,
      createdAt: new Date('2026-09-16T10:00:00'),
    },
  ] as const;

  for (const row of creditBook) {
    const application = await prisma.loanApplication.upsert({
      where: { publicId: row.applicationId },
      update: {},
      create: {
        publicId: row.applicationId,
        schoolId: row.school.id,
        financialInstitutionId: institution.id,
        productCode: row.productCode,
        requestedAmount: row.requested,
        tenorMonths: 18,
        purpose: row.purpose,
        guaranteeRequested: true,
        guaranteeAmountRequested: Math.round(row.requested * 0.6),
        status: row.applicationStatus,
        decision: 'approved' in row ? CreditDecision.APPROVED : undefined,
        approvedAmount: 'approved' in row ? row.approved : undefined,
        interestRate: 14,
        createdAt: row.createdAt,
      },
    });

    if ('loanId' in row && row.loanId) {
      const loan = await prisma.loan.upsert({
        where: { publicId: row.loanId },
        update: {},
        create: {
          publicId: row.loanId,
          applicationId: application.id,
          principal: row.approved,
          tenorMonths: 18,
          interestRate: 14,
          principalOutstanding: row.approved,
          status: LoanStatus.OFFERED,
          createdAt: row.createdAt,
        },
      });

      if (!await prisma.creditAssessment.findFirst({ where: { applicationId: application.id } })) {
        await prisma.creditAssessment.create({
          data: {
            publicId: await nextPublicId('ASSESS'),
            applicationId: application.id,
            assessmentStatus: AssessmentStatus.COMPLETED,
            assessmentReference: `ASSESS-${row.loanId.slice(-6)}`,
            financialInstitutionDecisionRequired: true,
            summary: {
              note: 'RUPSA NEXT analytical assessment only. Final credit decision remains with the licensed institution.',
            },
          },
        });
      }

      if (!await prisma.loanDisbursement.findFirst({ where: { loanId: loan.id } })) {
        await prisma.loanDisbursement.create({
          data: {
            publicId: await nextPublicId('DISB'),
            loanId: loan.id,
            amount: row.approved,
            disbursementAccount: 'RW-SCHOOL-OPS-001',
            transactionReference: `DISB-${row.loanId.slice(-6)}`,
            createdAt: row.createdAt,
          },
        });
      }

      const repaid = row.approved - row.outstanding;
      if (repaid > 0 && !await prisma.loanRepayment.findFirst({ where: { loanId: loan.id } })) {
        await prisma.loanRepayment.create({
          data: {
            publicId: await nextPublicId('REP'),
            loanId: loan.id,
            amount: repaid,
            paymentReference: `REP-${row.loanId.slice(-6)}`,
            paymentDate: new Date(row.createdAt.getTime() + 21 * 24 * 60 * 60 * 1000),
            status: 'POSTED',
          },
        });
      }

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          principalOutstanding: row.outstanding,
          status: row.loanStatus,
        },
      });
      await prisma.loanApplication.update({
        where: { id: application.id },
        data: { status: LoanApplicationStatus.ACTIVE, decision: CreditDecision.APPROVED },
      });
    }

    if ('guaranteeId' in row && row.guaranteeId) {
      await prisma.guarantee.upsert({
        where: { publicId: row.guaranteeId },
        update: {
          decision: GuaranteeDecision.APPROVED,
          guaranteedAmount: row.guaranteeAmount,
          certificateRef: `RUPSA-GCT-${row.guaranteeId.slice(-6)}`,
          status: GuaranteeStatus.ACTIVE,
        },
        create: {
          publicId: row.guaranteeId,
          loanApplicationId: application.id,
          schoolId: row.school.id,
          financialInstitutionId: institution.id,
          facilityId: facility.id,
          loanAmount: row.approved,
          guaranteeAmount: row.guaranteeAmount,
          guaranteedAmount: row.guaranteeAmount,
          status: GuaranteeStatus.ACTIVE,
          decision: GuaranteeDecision.APPROVED,
          certificateRef: `RUPSA-GCT-${row.guaranteeId.slice(-6)}`,
          expiryDate: new Date('2028-12-31'),
          createdAt: row.createdAt,
        },
      });
    }
  }

  const successPayments = await prisma.payment.findMany({
    where: { status: PaymentStatus.SUCCESS },
    select: { id: true },
  });
  for (const payment of successPayments) {
    await settleLikeApi(payment.id);
  }

  const activeCover = await prisma.guarantee.aggregate({
    where: { status: { in: [GuaranteeStatus.ACTIVE, GuaranteeStatus.APPROVED] } },
    _sum: { guaranteedAmount: true, guaranteeAmount: true },
  });
  const outstanding = Number(activeCover._sum.guaranteedAmount ?? activeCover._sum.guaranteeAmount ?? 0);
  await prisma.guaranteeFacility.update({
    where: { id: facility.id },
    data: {
      outstandingGuarantees: outstanding,
      availableCapacity: 5_000_000_000 - outstanding,
    },
  });

  for (const [prefix, value] of [
    ['RUPSA-USR', 20],
    ['RUPSA-SCH', 300],
    ['RUPSA-STD', 300],
    ['RUPSA-GRD', 200],
    ['RUPSA-INV', 800],
    ['RUPSA-PAY', 900],
    ['RUPSA-LA', 220],
    ['RUPSA-LOAN', 220],
    ['RUPSA-GUA', 220],
    ['RUPSA-RCT', 200],
    ['RUPSA-REC', 200],
    ['RUPSA-DISB', 200],
    ['RUPSA-REP', 200],
    ['ASSESS', 200],
    ['FI', 4],
  ] as const) {
    await prisma.idSequence.upsert({
      where: { prefix },
      update: { value },
      create: { prefix, value },
    });
  }

  await syncIssuedIds();

  console.log('Seeded RUPSA NEXT sandbox data.');
  console.log('  Admin:  admin@rupsanext.rw');
  console.log('  School: finance@example.rw');
  console.log('  Bank:   credit@bank.rw');
  console.log('  Parent: parent@example.rw');
  console.log(`  Password: ${password}`);
  console.log(`  Schools: ${schools.length}`);
  console.log(`  Students: ${students.length}`);
  console.log(`  Admin user: ${admin.publicId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
