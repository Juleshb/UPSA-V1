import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ApiError, api, type MembershipVerification } from '../platform/api'
import type { PublicCourse, PublicTraining } from '../platform/literacy'
import type { OnlineService } from '../onlineServices'
import { CourseQuiz } from './CourseQuiz'
import { BecomeMember } from '../pages/BecomeMember'
import { RegisterSchool } from '../pages/RegisterSchool'

const ROLES = [
  'School administrator',
  'Parent or guardian',
  'Bank or MFI',
  'Payment service provider',
  'UPSA official',
  'Other',
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORAGE_KEY = 'rupsa.public.training'

type Briefing = {
  name: string
  organisation: string
  role: string
  email: string
  message: string
  consent: boolean
}

export function ServiceApplyModal({ service, onClose }: { service: OnlineService | null; onClose: () => void }) {
  const [phase, setPhase] = useState<'about' | 'steps'>('about')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [briefing, setBriefing] = useState<Briefing>({ name: '', organisation: '', role: '', email: '', message: '', consent: false })
  const [lookup, setLookup] = useState('')
  const [result, setResult] = useState<MembershipVerification | null>(null)
  const [learner, setLearner] = useState<PublicTraining['learner'] | null>(null)
  const [courses, setCourses] = useState<PublicCourse[]>([])
  const [desk, setDesk] = useState<PublicTraining | null>(null)
  const [enrollmentId, setEnrollmentId] = useState('')

  useEffect(() => {
    setPhase('about')
    setStep(0)
    setError('')
    setBusy(false)
    setSent(false)
    setBriefing({ name: '', organisation: '', role: '', email: '', message: '', consent: false })
    setLookup('')
    setResult(null)
    setLearner(null)
    setCourses([])
    setDesk(null)
    setEnrollmentId('')
  }, [service?.label])

  useEffect(() => {
    if (!service) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, service])

  if (!service) return null

  function start() {
    setError('')
    setPhase('steps')
  }

  function briefingProblem() {
    if (step === 0 && (!briefing.name.trim() || !briefing.organisation.trim() || !briefing.role)) {
      return 'Enter your name, organisation, and role.'
    }
    if (step === 1) {
      if (!briefing.email.trim() || !briefing.message.trim()) return 'Add your email and message.'
      if (!EMAIL.test(briefing.email.trim())) return 'Enter a work email.'
    }
    if (step === 2 && !briefing.consent) return 'Confirm that this request is made on behalf of a school, UPSA, or a regulated institution.'
    return ''
  }

  async function submitBriefing(event: FormEvent) {
    event.preventDefault()
    const issue = briefingProblem()
    if (issue) {
      setError(issue)
      return
    }
    if (step < 2) {
      setError('')
      setStep((current) => current + 1)
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.messages.submit({
        name: briefing.name.trim(),
        organisation: briefing.organisation.trim(),
        role: briefing.role,
        interest: service!.interest || 'Platform briefing',
        email: briefing.email.trim(),
        message: briefing.message.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The briefing request could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  async function checkCertificate(event: FormEvent) {
    event.preventDefault()
    const code = lookup.trim()
    if (!code) {
      setError('Enter the certificate or membership number.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.membershipApplications.verify(code))
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This certificate could not be checked.')
    } finally {
      setBusy(false)
    }
  }

  async function joinTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const next = await api.literacy.publicJoin({
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        language: String(form.get('language') ?? 'English'),
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ learnerId: next.learner.id, phone: next.learner.phone }))
      setLearner(next.learner)
      setCourses(next.courses)
      setDesk(next)
      setStep(1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The training file could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  async function enrol(courseId: string) {
    if (!learner) return
    setBusy(true)
    setError('')
    try {
      const next = await api.literacy.publicEnrol({ learnerId: learner.id, phone: learner.phone, courseId })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ learnerId: next.learner.id, phone: next.learner.phone }))
      const created = next.lessons.find((item) => item.courseId === courseId)
      setDesk(next)
      setLearner(next.learner)
      setCourses(next.courses)
      if (created) {
        setEnrollmentId(created.enrollmentId)
        setStep(2)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enrolment could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const lesson = desk?.lessons.find((item) => item.enrollmentId === enrollmentId)
  const steps = service.flow === 'verify'
    ? ['Certificate number', 'Result']
    : service.flow === 'training'
      ? ['Your details', 'Choose a course', 'Study']
      : ['Who is applying', 'The request', 'Confirm']

  if (phase === 'steps' && service.flow === 'membership') {
    return <BecomeMember embedded onDismiss={onClose} />
  }
  if (phase === 'steps' && service.flow === 'school') {
    return <RegisterSchool embedded onDismiss={onClose} />
  }

  return createPortal(
    <div className="service-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      {phase === 'about' ? (
        <div className="service-modal" role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
          <button className="service-modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
          <p className="service-modal-pill" id="service-modal-title">{service.label}</p>
          <h2>About this service</h2>
          <p>{service.hint}</p>
          <div className="service-modal-meta">
            <p><span>Fee</span> {service.fee}</p>
            <p><span>Issued by</span> {service.office}</p>
          </div>
          <h2>Who is applying?</h2>
          <p>{service.audience}</p>
          <div className="service-modal-foot">
            <button className="button primary" type="button" onClick={start}>{service.action}</button>
          </div>
        </div>
      ) : (
        <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="service-step-title">
          <div className="wizard-rail">
            <ol>
              {steps.map((label, index) => {
                const state = index === step ? 'current' : index < step ? 'done' : ''
                return (
                  <li key={label}>
                    <button className={state} type="button" onClick={() => { if (index <= step) { setError(''); setStep(index) } }}>
                      <i>{state === 'done' ? '✓' : index + 1}</i>
                      <span>{label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="wizard-main">
            <header>
              <div className="wizard-kicker">
                <p>Step {step + 1} of {steps.length}</p>
                <button className="text-action" type="button" onClick={onClose}>Close</button>
              </div>
              <h2 id="service-step-title">{service.label}</h2>
              <p>{steps[step]}</p>
            </header>
            <form className="wizard-body" onSubmit={(event) => {
              if (service.flow === 'briefing') void submitBriefing(event)
              else if (service.flow === 'verify') void checkCertificate(event)
              else if (service.flow === 'training' && step === 0) void joinTraining(event)
              else event.preventDefault()
            }}>
              {error && <p className="form-error" role="alert">{error}</p>}
              {sent && (
                <div className="form-success" role="status">
                  <h3>Briefing request received.</h3>
                  <p>A confirmation was sent to your email, and the briefing desk has the request.</p>
                </div>
              )}
              {!sent && service.flow === 'briefing' && step === 0 && (
                <>
                  <Field label="Full name" id="brief-name" value={briefing.name} onChange={(value) => setBriefing((current) => ({ ...current, name: value }))} />
                  <Field label="Organisation" id="brief-org" value={briefing.organisation} onChange={(value) => setBriefing((current) => ({ ...current, organisation: value }))} />
                  <div className="field">
                    <label htmlFor="brief-role">Role</label>
                    <select id="brief-role" value={briefing.role} onChange={(event) => setBriefing((current) => ({ ...current, role: event.target.value }))}>
                      <option value="">Select your role</option>
                      {ROLES.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </div>
                </>
              )}
              {!sent && service.flow === 'briefing' && step === 1 && (
                <>
                  <div className="field">
                    <label htmlFor="brief-topic">Topic</label>
                    <input id="brief-topic" value={service.interest || 'Platform briefing'} disabled />
                  </div>
                  <Field label="Work email" id="brief-email" type="email" value={briefing.email} onChange={(value) => setBriefing((current) => ({ ...current, email: value }))} />
                  <div className="field">
                    <label htmlFor="brief-message">Message</label>
                    <textarea id="brief-message" value={briefing.message} onChange={(event) => setBriefing((current) => ({ ...current, message: event.target.value }))} />
                  </div>
                </>
              )}
              {!sent && service.flow === 'briefing' && step === 2 && (
                <>
                  <dl className="wizard-summary">
                    <div><dt>Name</dt><dd>{briefing.name}</dd></div>
                    <div><dt>Organisation</dt><dd>{briefing.organisation}</dd></div>
                    <div><dt>Role</dt><dd>{briefing.role}</dd></div>
                    <div><dt>Topic</dt><dd>{service.interest || 'Platform briefing'}</dd></div>
                    <div><dt>Email</dt><dd>{briefing.email}</dd></div>
                    <div><dt>Message</dt><dd>{briefing.message}</dd></div>
                  </dl>
                  <label className="consent">
                    <input type="checkbox" checked={briefing.consent} onChange={(event) => setBriefing((current) => ({ ...current, consent: event.target.checked }))} />
                    I confirm this request is made on behalf of a school, UPSA or a regulated financial institution, and I consent to being contacted about this briefing.
                  </label>
                </>
              )}
              {service.flow === 'verify' && step === 0 && (
                <Field label="Certificate or membership number" id="verify-code" value={lookup} onChange={setLookup} placeholder="RUPSA-MCF-000002 or RUPSA-MBR-000001" />
              )}
              {service.flow === 'verify' && step === 1 && result && (
                <div className={result.verified ? 'form-success' : 'review-pending'} role="status">
                  <h3>{result.schoolName || 'Not verified.'}</h3>
                  <p>{result.verified ? 'This membership certificate is genuine and the membership is active.' : 'This number does not match a confirmed UPSA membership certificate.'}</p>
                </div>
              )}
              {service.flow === 'training' && step === 0 && (
                <>
                  <div className="field">
                    <label htmlFor="train-name">Full name</label>
                    <input id="train-name" name="name" required autoComplete="name" />
                  </div>
                  <div className="field">
                    <label htmlFor="train-phone">Phone</label>
                    <input id="train-phone" name="phone" required autoComplete="tel" placeholder="+2507…" />
                  </div>
                  <div className="field">
                    <label htmlFor="train-language">Language</label>
                    <select id="train-language" name="language" defaultValue="English">
                      <option>Kinyarwanda</option>
                      <option>English</option>
                      <option>French</option>
                    </select>
                  </div>
                </>
              )}
              {service.flow === 'training' && step === 1 && (
                <div className="training-grid">
                  {courses.map((course) => (
                    <article key={course.id} className="training-card">
                      <h3>{course.name}</h3>
                      <p>{course.description}</p>
                      <small>{course.moduleCount} modules · {course.duration}</small>
                      <button className="button primary" type="button" disabled={busy} onClick={() => void enrol(course.id)}>Enrol</button>
                    </article>
                  ))}
                  {courses.length === 0 && <p>No open course is available right now.</p>}
                </div>
              )}
              {service.flow === 'training' && step === 2 && lesson && learner && (
                <article className="training-lesson">
                  <p>{learner.name}</p>
                  <h3>{lesson.courseName}</h3>
                  <div className="training-progress" aria-hidden="true"><span style={{ width: `${lesson.progress}%` }} /></div>
                  <p>{lesson.current >= lesson.modules.length ? 'The reading is finished.' : `Module ${lesson.current + 1} of ${lesson.modules.length}`}</p>
                  {lesson.current < lesson.modules.length && (
                    <>
                      <h3>{lesson.modules[lesson.current].title}</h3>
                      <p>{lesson.modules[lesson.current].objectives}</p>
                      <p>{lesson.modules[lesson.current].content}</p>
                      <button className="button primary" type="button" disabled={busy} onClick={() => void (async () => {
                        setBusy(true)
                        setError('')
                        try {
                          const next = await api.literacy.publicComplete({
                            learnerId: learner.id,
                            phone: learner.phone,
                            enrollmentId: lesson.enrollmentId,
                            moduleIndex: lesson.current,
                          })
                          setDesk(next)
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : 'This module could not be saved.')
                        } finally {
                          setBusy(false)
                        }
                      })()}>I have finished this module</button>
                    </>
                  )}
                  {lesson.quiz.length > 0 && (
                    <CourseQuiz
                      key={lesson.mark?.percentage ?? 'quiz'}
                      lesson={lesson}
                      busy={busy}
                      onSubmit={(answers) => void (async () => {
                        setBusy(true)
                        setError('')
                        try {
                          const next = await api.literacy.publicQuiz({
                            learnerId: learner.id,
                            phone: learner.phone,
                            enrollmentId: lesson.enrollmentId,
                            answers,
                          })
                          setDesk(next)
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : 'The questions could not be marked.')
                        } finally {
                          setBusy(false)
                        }
                      })()}
                    />
                  )}
                  {lesson.certificateId && <p className="form-success">The system issued certificate {lesson.certificateId}{lesson.mark ? ` after a mark of ${lesson.mark.percentage}%` : ''}.</p>}
                </article>
              )}
              {!sent && (
                <div className="wizard-foot">
                  <button className="button secondary" type="button" onClick={() => {
                    setError('')
                    if (step === 0) setPhase('about')
                    else setStep((current) => current - 1)
                  }}>Back</button>
                  {service.flow === 'verify' && step === 1 ? null : service.flow === 'training' && step > 0 ? null : (
                    <button className="button primary" type="submit" disabled={busy}>
                      {busy ? 'Please wait…' : step === steps.length - 1 && service.flow === 'briefing' ? 'Submit briefing request' : 'Continue'}
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

function Field({ label, id, value, onChange, type = 'text', placeholder }: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
