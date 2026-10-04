export type LiteracySummary = {
  learners: number
  programmes: number
  courses: number
  pending: number
  completed: number
  sessions: number
  certificates: number
  expiring: number
  retraining: number
  completionRate: number
  attendanceRate: number
  passRate: number
  averageScore: number
  consumer: number
  digital: number
  credit: number
  savings: number
}

export type ProgrammeRow = {
  id: string
  code: string
  name: string
  description: string
  audience: string
  category: string
  language: string
  deliveryMethod: string
  duration: string
  passMark: number
  validityMonths: number
  status: string
  topics: string[]
  courses: { id: string; name: string; status: string }[]
}

export type CourseModule = {
  title: string
  description: string
  objectives: string
  content: string
  durationMinutes: number
  materials: string
}

export type CourseRow = {
  id: string
  programmeId: string
  programmeName: string
  code: string
  name: string
  description: string
  objectives: string
  audience: string
  difficulty: string
  duration: string
  passMark: number
  status: string
  modules: CourseModule[]
}

export type LearnerRow = {
  id: string
  learnerType: string
  name: string
  phone: string
  email: string | null
  language: string
  district: string | null
  trainingNeeds: string
  status: string
  schoolName: string | null
}

export type EnrollmentRow = {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  status: string
  progress: number
  preScore: number | null
  postScore: number | null
  weakest: string | null
  strongest: string | null
  passMark: number
  certificateId: string | null
}

export type StudyModule = {
  title: string
  objectives: string
  content: string
  durationMinutes: number
  done: boolean
}

export type QuizQuestion =
  | { id: string; kind: 'MULTIPLE_CHOICE'; prompt: string; options: string[] }
  | { id: string; kind: 'TRUE_FALSE'; prompt: string }
  | { id: string; kind: 'MATCHING'; prompt: string; left: string[]; right: string[] }

export type QuizMark = {
  percentage: number
  passed: boolean
  correct: number
  total: number
  items: { prompt: string; correct: boolean }[]
}

export type StudyLesson = {
  enrollmentId: string
  courseId: string
  courseName: string
  status: string
  progress: number
  passMark: number
  certificateId: string | null
  current: number
  modules: StudyModule[]
  quiz: QuizQuestion[]
  mark: QuizMark | null
}

export type PublicCourse = {
  id: string
  name: string
  description: string
  duration: string
  moduleCount: number
}

export type PublicTraining = {
  learner: { id: string; name: string; phone: string; language: string; status: string }
  courses: PublicCourse[]
  lessons: StudyLesson[]
}

export type StudyDesk = {
  learner: LearnerFile | null
  courses: CourseRow[]
  students: { id: string; name: string; phone: string | null; detail: string | null }[]
  lessons: StudyLesson[]
}

export type LearnerFile = LearnerRow & {
  educationLevel: string | null
  occupation: string | null
  accessibility: string | null
  gender: string | null
  partyId: string | null
  enrollments: EnrollmentRow[]
  certificates: { id: string; courseName: string; score: number; certificateType: string; status: string; expiresAt: string | null }[]
  retrainings: { id: string; reason: string; previousCourse: string; modules: string; status: string }[]
  goals: { id: string; name: string; category: string; targetAmount: number; currentAmount: number; status: string }[]
  health: { id: string; budgetStatus: string; savingsStatus: string; debtStatus: string; resilience: string; recommendation: string }[]
  evidence: { id: string; productName: string; confirmed: boolean; reference: string }[]
}
