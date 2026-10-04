export const LEARNER_TYPES = ['SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR', 'BORROWER', 'GROUP_MEMBER'] as const

export const LANGUAGES = ['Kinyarwanda', 'English', 'French'] as const

export const CATEGORIES = ['CONSUMER_PROTECTION', 'BUDGETING', 'SAVINGS', 'CREDIT', 'DIGITAL', 'SCHOOL_FINANCE', 'INVESTMENT'] as const

export const DELIVERY = ['CLASSROOM', 'ONLINE', 'BLENDED', 'WORKSHOP', 'MOBILE'] as const

export const DIFFICULTY = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const

export const SCORE_AREAS = ['budgeting', 'savings', 'credit', 'payments', 'investment', 'consumer', 'digital'] as const

export const TOPICS = [
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
] as const

export const NEXT_STATUS: Record<string, string> = {
  DRAFT: 'REVIEW',
  REVIEW: 'APPROVED',
  APPROVED: 'PUBLISHED',
  PUBLISHED: 'ACTIVE',
  ACTIVE: 'SUSPENDED',
  SUSPENDED: 'ACTIVE',
}

export const SIMULATORS = [
  ['BUDGET', 'Budget'],
  ['LOAN', 'Loan cost'],
  ['AFFORDABILITY', 'Affordability'],
  ['SAVINGS', 'Savings goal'],
  ['EMERGENCY', 'Emergency fund'],
  ['SPLIT', '40/60 explanation'],
  ['INVESTMENT', 'Investment result'],
] as const
