import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: env.smtpUser && env.smtpPass
    ? { user: env.smtpUser, pass: env.smtpPass }
    : undefined,
});

type EmailContent = {
  subject: string
  text: string
  html: string
}

export function mailConfigured() {
  return Boolean(env.smtpUser && env.smtpPass);
}

export function membershipLink() {
  return `${env.publicWebUrl.replace(/\/$/, '')}/membership`;
}

export function membershipVerifyLink(code: string) {
  return `${env.publicWebUrl.replace(/\/$/, '')}/membership/verify/${encodeURIComponent(code)}`;
}

export function membershipTrackLink(applicationId: string, email: string) {
  const url = new URL(membershipLink());
  url.searchParams.set('reference', applicationId);
  url.searchParams.set('email', email);
  return url.toString();
}

export function deskAddress() {
  return env.smtpUser;
}

export async function sendEmail(input: EmailContent & { to: string }) {
  if (!mailConfigured()) {
    throw new Error('SMTP is not configured.');
  }
  await transporter.sendMail({
    from: env.mailFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function deliverEmail(input: EmailContent & { to: string }) {
  try {
    await sendEmail(input);
    return true;
  } catch (error) {
    console.error(`Email to ${input.to} failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ));
}

type Fact = { label: string; value: string }
type Action = { href: string; label: string }

function letter(input: {
  kicker: string
  title: string
  greeting?: string
  paragraphs: string[]
  facts?: Fact[]
  note?: string
  action?: Action
}) {
  const font = "Arial, Helvetica, sans-serif";
  const greeting = input.greeting
    ? `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:1.6;color:#243b46;">${escapeHtml(input.greeting)}</p>`
    : '';
  const copy = input.paragraphs.map((paragraph) => (
    `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:1.65;color:#334e59;">${escapeHtml(paragraph)}</p>`
  )).join('');
  const facts = (input.facts ?? []).map((fact) => `
    <tr>
      <td style="width:148px;padding:12px 14px;border-bottom:1px solid #e4eeeb;background:#f7faf9;font-family:${font};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#57717d;">${escapeHtml(fact.label)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e4eeeb;background:#ffffff;font-family:${font};font-size:15px;line-height:1.4;color:#092b3c;font-weight:700;">${escapeHtml(fact.value)}</td>
    </tr>`).join('');
  const factTable = facts
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border:1px solid #e4eeeb;border-collapse:collapse;">${facts}</table>`
    : '';
  const note = input.note
    ? `<p style="margin:0 0 8px;font-family:${font};font-size:14px;line-height:1.6;color:#57717d;">${escapeHtml(input.note)}</p>`
    : '';
  const button = input.action
    ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(input.action.href)}" style="display:inline-block;background:#092b3c;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-family:${font};font-size:14px;font-weight:700;">${escapeHtml(input.action.label)}</a></p>`
    : '';
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#e7eef0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7eef0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;">
            <tr>
              <td style="background:#092b3c;padding:26px 32px 22px;">
                <p style="margin:0;font-family:${font};font-size:24px;line-height:1;letter-spacing:-0.03em;color:#ffffff;"><b>UPSA</b> <span style="color:#18d6b4;font-weight:500;">Next</span></p>
                <p style="margin:8px 0 0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#8fb0b8;">Payment</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#18d6b4;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 10px;font-family:${font};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#0e7c72;">${escapeHtml(input.kicker)}</p>
                <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:500;color:#092b3c;">${escapeHtml(input.title)}</h1>
                ${greeting}
                ${copy}
                ${factTable}
                ${note}
                ${button}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;">
                <p style="margin:18px 0 0;padding-top:18px;border-top:1px solid #e4eeeb;font-family:${font};font-size:14px;line-height:1.6;color:#334e59;">With regards,<br><b style="color:#092b3c;">UPSA Next Payment</b><br>Rwanda Union of Private Schools Association<br>Kigali, Rwanda</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#6d8792;">This message was sent because a request was made on UPSA Next Payment.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    'UPSA Next Payment',
    input.kicker,
    input.title,
    '',
    input.greeting ?? '',
    ...input.paragraphs,
    '',
    ...(input.facts ?? []).map((fact) => `${fact.label}: ${fact.value}`),
    input.note ?? '',
    input.action ? `${input.action.label}: ${input.action.href}` : '',
    '',
    'With regards,',
    'UPSA Next Payment',
    'Rwanda Union of Private Schools Association',
    'Kigali, Rwanda',
  ].filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
  return { html, text };
}

export function schoolSubmittedEmail(input: {
  schoolName: string
  schoolId: string
  email: string
  membershipReference?: string
  membershipConfirmed?: boolean
}) {
  const membershipLine = input.membershipConfirmed
    ? `Confirmed membership ${input.membershipReference} is linked to this request.`
    : input.membershipReference
      ? `Membership ${input.membershipReference} is linked and still in review. This school can be approved after a UPSA reader confirms that membership.`
      : 'This request was sent without a membership reference. The school can be approved after it has a confirmed UPSA membership. You can add that reference when you check the application.';
  const message = letter({
    kicker: 'School registration',
    title: 'Your request was submitted',
    paragraphs: [
      `The registration request for ${input.schoolName} is now with UPSA Next Payment.`,
      'This message confirms that the request was sent. Keep the reference below with the school email when you check the status.',
      membershipLine,
    ],
    facts: [
      { label: 'School', value: input.schoolName },
      { label: 'Reference', value: input.schoolId },
      { label: 'Email', value: input.email },
      { label: 'Status', value: 'Submitted' },
    ],
    action: { href: membershipLink(), label: 'Become a UPSA member' },
  });
  return { subject: 'Your school registration request was submitted', ...message };
}

export function schoolSubmittedDeskEmail(input: {
  schoolName: string
  schoolId: string
  email: string
  phone: string
  location: string
  memberId?: string
}) {
  const message = letter({
    kicker: 'School registration',
    title: 'A school registration was submitted',
    greeting: 'Hello,',
    paragraphs: [
      `${input.schoolName} submitted a registration request. It is waiting for review.`,
    ],
    facts: [
      { label: 'School', value: input.schoolName },
      { label: 'Reference', value: input.schoolId },
      { label: 'Email', value: input.email },
      { label: 'Phone', value: input.phone },
      { label: 'Location', value: input.location },
      { label: 'Member ID', value: input.memberId || 'Not provided' },
    ],
  });
  return { subject: `School registration submitted — ${input.schoolName}`, ...message };
}

export function membershipSubmittedEmail(input: {
  contactName: string
  schoolName: string
  applicationId: string
  email: string
}) {
  const message = letter({
    kicker: 'UPSA membership',
    title: 'Your request was submitted',
    greeting: `Dear ${input.contactName},`,
    paragraphs: [
      `Thank you. The membership request for ${input.schoolName} has been submitted and is now in review.`,
      'An administrator will confirm or decline it. This letter is not an acceptance. You can follow the request at any time with the reference code and the email address below.',
    ],
    facts: [
      { label: 'School', value: input.schoolName },
      { label: 'Reference', value: input.applicationId },
      { label: 'Email', value: input.email },
      { label: 'Status', value: 'In review' },
    ],
    action: { href: membershipLink(), label: 'Track your request' },
  });
  return { subject: 'Your UPSA membership request was submitted', ...message };
}

export function membershipDecisionEmail(input: {
  contactName: string
  schoolName: string
  applicationId: string
  email: string
  decision: 'CONFIRMED' | 'REJECTED'
  note?: string
}) {
  const confirmed = input.decision === 'CONFIRMED';
  const message = letter({
    kicker: 'UPSA membership',
    title: confirmed ? 'Your membership was confirmed' : 'Your membership was not confirmed',
    greeting: `Dear ${input.contactName},`,
    paragraphs: [
      confirmed
        ? `A UPSA reader has confirmed the membership request for ${input.schoolName}. The certificate is signed and can be checked with the QR code on the certificate.`
        : `A UPSA administrator has reviewed the membership request for ${input.schoolName} and did not confirm it.`,
    ],
    facts: [
      { label: 'School', value: input.schoolName },
      { label: 'Reference', value: input.applicationId },
      { label: 'Status', value: confirmed ? 'Confirmed' : 'Not confirmed' },
    ],
    note: input.note,
    action: {
      href: membershipTrackLink(input.applicationId, input.email),
      label: confirmed ? 'View certificate' : 'Track your request',
    },
  });
  return {
    subject: confirmed
      ? 'Your UPSA membership request was confirmed'
      : 'Your UPSA membership request was not confirmed',
    ...message,
  };
}

export function membershipSubmittedDeskEmail(input: {
  contactName: string
  title: string
  schoolName: string
  applicationId: string
  email: string
  phone: string
  location: string
  registrationNumber?: string
  message?: string
}) {
  const message = letter({
    kicker: 'UPSA membership',
    title: 'A membership request is in review',
    greeting: 'Hello,',
    paragraphs: [
      `${input.schoolName} submitted a membership request. It is waiting for an administrator to confirm or decline it.`,
    ],
    facts: [
      { label: 'School', value: input.schoolName },
      { label: 'Reference', value: input.applicationId },
      { label: 'Contact', value: `${input.contactName}, ${input.title}` },
      { label: 'Email', value: input.email },
      { label: 'Phone', value: input.phone },
      { label: 'Location', value: input.location },
      { label: 'Registration', value: input.registrationNumber || 'Not provided' },
    ],
    note: input.message,
  });
  return { subject: `UPSA membership request submitted — ${input.schoolName}`, ...message };
}

export function briefingReceivedEmail(input: { name: string; organisation: string; interest: string }) {
  const message = letter({
    kicker: 'Briefing',
    title: 'Your briefing request was submitted',
    greeting: `Dear ${input.name},`,
    paragraphs: [
      `Thank you. The briefing request from ${input.organisation} has been submitted.`,
      'A representative may follow up at this email address.',
    ],
    facts: [
      { label: 'Organisation', value: input.organisation },
      { label: 'Topic', value: input.interest },
      { label: 'Status', value: 'Submitted' },
    ],
  });
  return { subject: 'Your briefing request was submitted', ...message };
}

export function briefingDeskEmail(input: {
  name: string
  organisation: string
  role: string
  interest: string
  email: string
  message: string
}) {
  const message = letter({
    kicker: 'Briefing',
    title: 'A briefing request was submitted',
    greeting: 'Hello,',
    paragraphs: [`${input.name} asked for a briefing on behalf of ${input.organisation}.`],
    facts: [
      { label: 'Name', value: input.name },
      { label: 'Organisation', value: input.organisation },
      { label: 'Role', value: input.role },
      { label: 'Interest', value: input.interest },
      { label: 'Email', value: input.email },
    ],
    note: input.message,
  });
  return { subject: `Briefing request — ${input.organisation}`, ...message };
}

export function noticeEmail(input: { subject: string; body: string }) {
  const message = letter({
    kicker: 'Notice',
    title: input.subject,
    paragraphs: [input.body],
  });
  return { subject: input.subject, ...message };
}
