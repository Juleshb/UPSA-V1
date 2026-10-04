-- CreateTable
CREATE TABLE "LiteracyProgramme" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "moduleCount" INTEGER NOT NULL DEFAULT 1,
    "certificationAvailable" BOOLEAN NOT NULL DEFAULT true,
    "validityMonths" INTEGER NOT NULL DEFAULT 12,
    "passMark" DECIMAL(5,2) NOT NULL,
    "topics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteracyProgramme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyCourse" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "lessonCount" INTEGER NOT NULL DEFAULT 1,
    "assessmentRequired" BOOLEAN NOT NULL DEFAULT true,
    "certificateRequired" BOOLEAN NOT NULL DEFAULT true,
    "passMark" DECIMAL(5,2) NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "modules" JSONB NOT NULL,
    "materials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteracyCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyLearner" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "language" TEXT NOT NULL,
    "district" TEXT,
    "educationLevel" TEXT,
    "occupation" TEXT,
    "trainingNeeds" TEXT NOT NULL,
    "accessibility" TEXT,
    "gender" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "schoolId" TEXT,
    "guardianId" TEXT,
    "studentId" TEXT,
    "registrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteracyLearner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyTrainer" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "certification" TEXT NOT NULL,
    "expertise" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "validityMonths" INTEGER NOT NULL DEFAULT 12,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyEnrollment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "trainerName" TEXT,
    "deliveryMethod" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedCompletion" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "preScore" DECIMAL(5,2),
    "postScore" DECIMAL(5,2),
    "weakest" TEXT,
    "strongest" TEXT,
    "exercises" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteracyEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracySession" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "trainerId" TEXT,
    "moduleTitle" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT,
    "onlineLink" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "language" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "attendanceRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyAttendance" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyAssessment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "passMark" DECIMAL(5,2) NOT NULL,
    "result" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "reviewer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyCertificate" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "programmeName" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "certificateType" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verificationRef" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "LiteracyCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyRetraining" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousCourse" TEXT NOT NULL,
    "newCourseId" TEXT,
    "modules" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "trainerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyRetraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyGoal" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "currentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyHealth" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "income" DECIMAL(18,2) NOT NULL,
    "expenses" DECIMAL(18,2) NOT NULL,
    "savings" DECIMAL(18,2) NOT NULL,
    "emergency" DECIMAL(18,2) NOT NULL,
    "debt" DECIMAL(18,2) NOT NULL,
    "debtPayment" DECIMAL(18,2) NOT NULL,
    "insurance" BOOLEAN NOT NULL DEFAULT false,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "budgetStatus" TEXT NOT NULL,
    "savingsStatus" TEXT NOT NULL,
    "debtStatus" TEXT NOT NULL,
    "resilience" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyEvidence" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "productName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "trainerName" TEXT NOT NULL,
    "trainingDate" TIMESTAMP(3) NOT NULL,
    "attendance" BOOLEAN NOT NULL DEFAULT true,
    "materials" TEXT NOT NULL,
    "assessmentScore" DECIMAL(5,2),
    "productExplained" BOOLEAN NOT NULL,
    "costExplained" BOOLEAN NOT NULL,
    "contractExplained" BOOLEAN NOT NULL,
    "questions" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyFraud" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerName" TEXT NOT NULL,
    "accountRef" TEXT,
    "incidentType" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2),
    "reference" TEXT,
    "channel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "reportedTo" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyFraud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyFeedback" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "trainerName" TEXT NOT NULL,
    "contentRating" INTEGER NOT NULL,
    "trainerRating" INTEGER NOT NULL,
    "practicality" INTEGER NOT NULL,
    "clarity" INTEGER NOT NULL,
    "languageRating" INTEGER NOT NULL,
    "digitalRating" INTEGER NOT NULL,
    "useful" TEXT NOT NULL,
    "least" TEXT,
    "suggestions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyAudit" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "reference" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyMessage" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "learnerId" TEXT,
    "learnerName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyProgramme_publicId_key" ON "LiteracyProgramme"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyProgramme_code_key" ON "LiteracyProgramme"("code");

-- CreateIndex
CREATE INDEX "LiteracyProgramme_status_idx" ON "LiteracyProgramme"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyCourse_publicId_key" ON "LiteracyCourse"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyCourse_code_key" ON "LiteracyCourse"("code");

-- CreateIndex
CREATE INDEX "LiteracyCourse_programmeId_idx" ON "LiteracyCourse"("programmeId");

-- CreateIndex
CREATE INDEX "LiteracyCourse_status_idx" ON "LiteracyCourse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyLearner_publicId_key" ON "LiteracyLearner"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyLearner_learnerType_status_idx" ON "LiteracyLearner"("learnerType", "status");

-- CreateIndex
CREATE INDEX "LiteracyLearner_schoolId_idx" ON "LiteracyLearner"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyTrainer_publicId_key" ON "LiteracyTrainer"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyTrainer_status_idx" ON "LiteracyTrainer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyEnrollment_publicId_key" ON "LiteracyEnrollment"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyEnrollment_status_idx" ON "LiteracyEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyEnrollment_learnerId_courseId_key" ON "LiteracyEnrollment"("learnerId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracySession_publicId_key" ON "LiteracySession"("publicId");

-- CreateIndex
CREATE INDEX "LiteracySession_courseId_idx" ON "LiteracySession"("courseId");

-- CreateIndex
CREATE INDEX "LiteracySession_sessionDate_idx" ON "LiteracySession"("sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyAttendance_publicId_key" ON "LiteracyAttendance"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyAttendance_sessionId_learnerId_key" ON "LiteracyAttendance"("sessionId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyAssessment_publicId_key" ON "LiteracyAssessment"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyAssessment_enrollmentId_kind_idx" ON "LiteracyAssessment"("enrollmentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyCertificate_publicId_key" ON "LiteracyCertificate"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyCertificate_enrollmentId_key" ON "LiteracyCertificate"("enrollmentId");

-- CreateIndex
CREATE INDEX "LiteracyCertificate_status_idx" ON "LiteracyCertificate"("status");

-- CreateIndex
CREATE INDEX "LiteracyCertificate_expiresAt_idx" ON "LiteracyCertificate"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyRetraining_publicId_key" ON "LiteracyRetraining"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyRetraining_status_idx" ON "LiteracyRetraining"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyGoal_publicId_key" ON "LiteracyGoal"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyHealth_publicId_key" ON "LiteracyHealth"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyEvidence_publicId_key" ON "LiteracyEvidence"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyEvidence_learnerId_idx" ON "LiteracyEvidence"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyFraud_publicId_key" ON "LiteracyFraud"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyFraud_status_idx" ON "LiteracyFraud"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyFeedback_publicId_key" ON "LiteracyFeedback"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyAudit_publicId_key" ON "LiteracyAudit"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyAudit_createdAt_idx" ON "LiteracyAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyMessage_publicId_key" ON "LiteracyMessage"("publicId");

-- CreateIndex
CREATE INDEX "LiteracyMessage_sentAt_idx" ON "LiteracyMessage"("sentAt");

-- AddForeignKey
ALTER TABLE "LiteracyCourse" ADD CONSTRAINT "LiteracyCourse_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "LiteracyProgramme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyLearner" ADD CONSTRAINT "LiteracyLearner_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyLearner" ADD CONSTRAINT "LiteracyLearner_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyLearner" ADD CONSTRAINT "LiteracyLearner_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyLearner" ADD CONSTRAINT "LiteracyLearner_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEnrollment" ADD CONSTRAINT "LiteracyEnrollment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEnrollment" ADD CONSTRAINT "LiteracyEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LiteracyCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracySession" ADD CONSTRAINT "LiteracySession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LiteracyCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracySession" ADD CONSTRAINT "LiteracySession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "LiteracyTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyAttendance" ADD CONSTRAINT "LiteracyAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiteracySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyAttendance" ADD CONSTRAINT "LiteracyAttendance_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyAssessment" ADD CONSTRAINT "LiteracyAssessment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LiteracyEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyCertificate" ADD CONSTRAINT "LiteracyCertificate_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyCertificate" ADD CONSTRAINT "LiteracyCertificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LiteracyEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyRetraining" ADD CONSTRAINT "LiteracyRetraining_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyGoal" ADD CONSTRAINT "LiteracyGoal_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyHealth" ADD CONSTRAINT "LiteracyHealth_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEvidence" ADD CONSTRAINT "LiteracyEvidence_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEvidence" ADD CONSTRAINT "LiteracyEvidence_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LiteracyEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyFeedback" ADD CONSTRAINT "LiteracyFeedback_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "LiteracyLearner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

