import { onlineServices } from '../onlineServices'

export type AssistantReply = {
  text: string
  service?: string
  to?: string
  linkLabel?: string
}

type Topic = {
  keys: string[]
  reply: AssistantReply
}

const topics: Topic[] = [
  {
    keys: ['hello', 'hi', 'hey', 'muraho', 'good morning', 'good afternoon'],
    reply: {
      text: 'Hello. I can open a service for you, or explain how UPSA Next Payment works. Membership, school registration, training, and briefings all start on Online services.',
    },
  },
  {
    keys: ['what is', 'platform', 'how does', 'how it work', 'about upsa', 'what can'],
    reply: {
      text: 'UPSA Next Payment is the proposed operating system for member schools in Rwanda. It covers school onboarding, family accounts, fee collection and receipts, reconciliation, financing requests, and guarantee records. Licensed institutions still make their own lending decisions.',
      to: '/platform',
      linkLabel: 'See the platform',
    },
  },
  {
    keys: ['payment', 'fee collection', 'receipt', 'invoice', 'reconcile'],
    reply: {
      text: 'Payments cover invoices, partial payments, plans, scholarships, and digital receipts. Each payment keeps a reference so the school ledger can match the bank or payment provider settlement.',
      to: '/platform/payments',
      linkLabel: 'Payments',
    },
  },
  {
    keys: ['member', 'membership', 'join upsa', 'become'],
    reply: {
      text: 'A school applies to become a UPSA member on Online services. The request stays in review until UPSA confirms it and signs the certificate. The fee is chosen with the membership category on the first step.',
      service: 'Become a UPSA member',
    },
  },
  {
    keys: ['verify', 'certificate', 'genuine', 'check membership'],
    reply: {
      text: 'Anyone can check a membership. Enter the certificate number or membership number printed on the UPSA certificate. There is no fee.',
      service: 'Verify a membership',
    },
  },
  {
    keys: ['register', 'school file', 'school id', 'register a school'],
    reply: {
      text: 'School registration sends the school profile, location, legal papers, representative, and bank account. Approval waits until the school has a confirmed UPSA membership. There is no fee on the form.',
      service: 'Register a school',
    },
  },
  {
    keys: ['training', 'course', 'enrol', 'enroll', 'learner', 'certificate course'],
    reply: {
      text: 'Financial training is open to a learner. You enter your name and phone, choose a course, then read each module and answer the questions. A completed course can carry its own certificate. There is no fee.',
      service: 'Enrol in financial training',
    },
  },
  {
    keys: ['onboarding'],
    reply: {
      text: 'School onboarding is a briefing for a school that is ready to be registered as a member. UPSA coordinates it from Kigali. There is no fee.',
      service: 'School onboarding',
    },
  },
  {
    keys: ['financing', 'finance', 'loan', 'lender', 'partnership', 'bank', 'mfi'],
    reply: {
      text: 'A financing partnership briefing is for a member school or a licensed institution that wants to know how a finance request is submitted. The lender keeps its own credit decision.',
      service: 'Financing partnership',
    },
  },
  {
    keys: ['guarantee', 'collateral'],
    reply: {
      text: 'The guarantee facility is support that can stand beside a lender’s own decision. You can ask UPSA about it from Online services. There is no fee for the briefing.',
      service: 'Guarantee facility',
    },
  },
  {
    keys: ['api', 'sandbox', 'integrat', 'developer'],
    reply: {
      text: 'A licensed institution can ask to connect its own systems. The API sandbox is also on the platform if you want to read the routes first.',
      service: 'API integration',
      to: '/developers',
      linkLabel: 'API sandbox',
    },
  },
  {
    keys: ['briefing', 'contact', 'talk', 'meeting'],
    reply: {
      text: 'A briefing is for a school, a UPSA board, or a licensed institution. You give your name, organisation, role, and the topic, then confirm. There is no fee.',
      service: 'Request a briefing',
    },
  },
]

function hasKey(text: string, key: string) {
  if (key.length <= 3) return new RegExp(`\\b${key}\\b`).test(text)
  return text.includes(key)
}

export function answerQuestion(question: string, previousService?: string): AssistantReply {
  const text = question.trim().toLowerCase()
  if (!text) {
    return { text: 'Ask about a service, or about how the platform works.' }
  }

  if (/^(yes|apply|open|start|continue|ok|okay)\b/.test(text) && previousService) {
    const service = onlineServices.find((item) => item.label === previousService)
    if (service) {
      return {
        text: `${service.label} is ready. ${service.hint}`,
        service: service.label,
      }
    }
  }

  const named = onlineServices.find((item) => text.includes(item.label.toLowerCase()))
  if (named) {
    return {
      text: `${named.hint} It is for ${named.audience.toLowerCase()}. Fee: ${named.fee}. Issued by ${named.office}.`,
      service: named.label,
    }
  }

  let best: Topic | null = null
  let score = 0
  for (const topic of topics) {
    const hits = topic.keys.reduce((count, key) => count + (hasKey(text, key) ? key.length : 0), 0)
    if (hits > score) {
      score = hits
      best = topic
    }
  }
  if (best && score > 0) return best.reply

  return {
    text: 'I can open membership, school registration, a certificate check, financial training, or a briefing. All of those start on Online services. You can also ask what the platform does.',
    to: '/services',
    linkLabel: 'Online services',
  }
}
