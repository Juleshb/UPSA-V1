export type ServiceFlow = 'membership' | 'school' | 'training' | 'briefing' | 'verify'

export type OnlineService = {
  to: string
  label: string
  hint: string
  group: string
  action: string
  flow: ServiceFlow
  audience: string
  office: string
  fee: string
  interest?: string
}

export const onlineServices: OnlineService[] = [
  {
    group: 'Membership',
    to: '/membership?apply=1',
    label: 'Become a UPSA member',
    hint: 'A school submits a membership request. It stays in review until UPSA confirms it and signs the certificate.',
    action: 'Apply',
    flow: 'membership',
    audience: 'A school asking to join UPSA',
    office: 'UPSA',
    fee: 'Set by the membership category',
  },
  {
    group: 'Membership',
    to: '/membership/verify',
    label: 'Verify a membership',
    hint: 'Anyone can enter a certificate number and see whether that school is a confirmed member.',
    action: 'Check',
    flow: 'verify',
    audience: 'Anyone with a certificate number',
    office: 'UPSA',
    fee: 'No fee',
  },
  {
    group: 'School',
    to: '/register?apply=1',
    label: 'Register a school',
    hint: 'Send the school file. Approval waits until the school has a confirmed UPSA membership.',
    action: 'Apply',
    flow: 'school',
    audience: 'A school ready to be registered',
    office: 'UPSA',
    fee: 'No fee on this form',
  },
  {
    group: 'Training',
    to: '/training',
    label: 'Enrol in financial training',
    hint: 'A learner joins a public course. A completed course can carry its own certificate.',
    action: 'Apply',
    flow: 'training',
    audience: 'A learner',
    office: 'UPSA',
    fee: 'No fee',
  },
  {
    group: 'Briefings',
    to: '/contact',
    label: 'Request a briefing',
    hint: 'A school, UPSA board or licensed institution asks for a platform briefing.',
    action: 'Apply',
    flow: 'briefing',
    audience: 'A school, UPSA board, or licensed institution',
    office: 'UPSA',
    fee: 'No fee',
    interest: 'Platform briefing',
  },
  {
    group: 'Briefings',
    to: '/contact?interest=School%20onboarding',
    label: 'School onboarding',
    hint: 'Ask UPSA for help after a school is ready to be registered as a member.',
    action: 'Apply',
    flow: 'briefing',
    audience: 'A school ready to be registered',
    office: 'UPSA',
    fee: 'No fee',
    interest: 'School onboarding',
  },
  {
    group: 'Briefings',
    to: '/contact?interest=Financing%20partnership',
    label: 'Financing partnership',
    hint: 'A member school or licensed institution asks how a finance request is submitted.',
    action: 'Apply',
    flow: 'briefing',
    audience: 'A member school or licensed institution',
    office: 'UPSA',
    fee: 'No fee',
    interest: 'Financing partnership',
  },
  {
    group: 'Briefings',
    to: '/contact?interest=Guarantee%20facility',
    label: 'Guarantee facility',
    hint: 'Ask about guarantee support that can stand beside a lender’s own decision.',
    action: 'Apply',
    flow: 'briefing',
    audience: 'A member school or licensed institution',
    office: 'UPSA',
    fee: 'No fee',
    interest: 'Guarantee facility',
  },
  {
    group: 'Briefings',
    to: '/contact?interest=API%20integration',
    label: 'API integration',
    hint: 'A licensed institution asks to connect its own systems to the platform.',
    action: 'Apply',
    flow: 'briefing',
    audience: 'A licensed institution',
    office: 'UPSA',
    fee: 'No fee',
    interest: 'API integration',
  },
]

export const serviceGroups = [...new Set(onlineServices.map((item) => item.group))]
