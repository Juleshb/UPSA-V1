import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CourseQuiz } from '../components/CourseQuiz'
import { ApplySteps } from '../components/ApplySteps'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { ApiError, api } from '../platform/api'
import type { PublicCourse, PublicTraining } from '../platform/literacy'

const STORAGE_KEY = 'rupsa.public.training'

const TRAIN_STEPS = ['Your details', 'Choose a course', 'Study']

type SavedLearner = { learnerId: string; phone: string }

function readSaved(): SavedLearner | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedLearner
    if (!parsed.learnerId || !parsed.phone) return null
    return parsed
  } catch {
    return null
  }
}

function remember(desk: PublicTraining) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ learnerId: desk.learner.id, phone: desk.learner.phone }))
}

export function PublicTraining() {
  usePageTitle('Financial training — UPSA Next Payment')
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<PublicCourse[]>([])
  const [desk, setDesk] = useState<PublicTraining | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    const saved = readSaved()
    void (async () => {
      try {
        const catalogue = await api.literacy.publicCourses()
        if (!live) return
        setCourses(catalogue.courses)
        if (saved) {
          const next = await api.literacy.publicContinue(saved.phone)
          if (!live) return
          setDesk(next)
          setCourses(next.courses)
        }
      } catch (err) {
        if (!live) return
        if (saved) localStorage.removeItem(STORAGE_KEY)
        setError(err instanceof ApiError ? err.message : 'The courses could not be loaded.')
      } finally {
        if (live) setReady(true)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const learner = desk?.learner
  const lesson = desk?.lessons.find((item) => item.enrollmentId === enrollmentId)
  const enrolled = new Set((desk?.lessons ?? []).map((item) => item.courseId))
  const openCourses = (desk?.courses ?? courses).filter((course) => !enrolled.has(course.id))

  async function join(event: FormEvent<HTMLFormElement>) {
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
      remember(next)
      setDesk(next)
      setCourses(next.courses)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The training file could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  async function enrol(courseId: string) {
    if (!learner) {
      setError('Enter your name and phone, then enrol.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const next = await api.literacy.publicEnrol({ learnerId: learner.id, phone: learner.phone, courseId })
      remember(next)
      setDesk(next)
      const created = next.lessons.find((item) => item.courseId === courseId)
      if (created) navigate(`/training/${created.enrollmentId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enrolment could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function finish(moduleIndex: number) {
    if (!learner || !lesson) return
    setBusy(true)
    setError('')
    try {
      const next = await api.literacy.publicComplete({
        learnerId: learner.id,
        phone: learner.phone,
        enrollmentId: lesson.enrollmentId,
        moduleIndex,
      })
      remember(next)
      setDesk(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'This module could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <PageHero
        kicker="Public training"
        title="Read the course, then answer the questions."
        lead="Open courses are published by UPSA. You follow each module, then the system asks multiple choice, matching, and true or false questions. It marks the answers and issues the certificate when you reach the pass mark."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Training' }]}
        image="/images/scene-parents.png"
        imageAlt="A learner following a course on a phone"
      />
      <section className="page-block alt">
        <ApplySteps steps={TRAIN_STEPS} step={lesson ? 2 : learner ? 1 : 0} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {!ready && <p>Loading courses…</p>}
        {lesson && learner && (
          <article className="training-lesson">
            <p className="eyebrow"><span /> {learner.name}</p>
            <h2>{lesson.courseName}</h2>
            <div className="training-progress" aria-hidden="true"><span style={{ width: `${lesson.progress}%` }} /></div>
            <p>{lesson.current >= lesson.modules.length ? 'The reading is finished.' : `Module ${lesson.current + 1} of ${lesson.modules.length}`}</p>
            {lesson.current < lesson.modules.length && (
              <>
                <h3>{lesson.modules[lesson.current].title}</h3>
                <p>{lesson.modules[lesson.current].objectives}</p>
                <p>{lesson.modules[lesson.current].content}</p>
                <button className="button primary" type="button" disabled={busy} onClick={() => void finish(lesson.current)}>I have finished this module</button>
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
                    const next = await api.literacy.publicQuiz({ learnerId: learner.id, phone: learner.phone, enrollmentId: lesson.enrollmentId, answers })
                    remember(next)
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
            {lesson.status === 'FAILED' && lesson.mark && <p className="form-error">Mark: {lesson.mark.percentage}%. The pass mark is {lesson.passMark}%, and this attempt is closed.</p>}
            <Link to="/training">Back to courses</Link>
          </article>
        )}
        {ready && !lesson && !learner && (
          <form className="contact-form" onSubmit={(event) => void join(event)}>
            <h2>Start with your name and phone.</h2>
            <div className="field">
              <label htmlFor="training-name">Full name</label>
              <input id="training-name" name="name" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="training-phone">Phone</label>
              <input id="training-phone" name="phone" required autoComplete="tel" placeholder="+2507…" />
            </div>
            <div className="field">
              <label htmlFor="training-language">Language</label>
              <select id="training-language" name="language" defaultValue="English">
                <option>Kinyarwanda</option>
                <option>English</option>
                <option>French</option>
              </select>
            </div>
            <button className="button primary" type="submit" disabled={busy}>Continue</button>
          </form>
        )}
        {ready && !lesson && learner && desk && (
          <div className="training-board">
            <p>Signed in as {learner.name}. This phone keeps your courses: {learner.phone}</p>
            {desk.lessons.length > 0 && (
              <>
                <h2>My courses</h2>
                <div className="training-grid">
                  {desk.lessons.map((item) => (
                    <article key={item.enrollmentId} className="training-card">
                      <h3>{item.courseName}</h3>
                      <p>{item.certificateId ? `Certificate ${item.certificateId}` : `${item.progress}% complete`}</p>
                      <Link className="button secondary" to={`/training/${item.enrollmentId}`}>{item.certificateId ? 'View certificate' : 'Continue'}</Link>
                    </article>
                  ))}
                </div>
              </>
            )}
            <h2>Open courses</h2>
            <div className="training-grid">
              {openCourses.map((course) => (
                <article key={course.id} className="training-card">
                  <h3>{course.name}</h3>
                  <p>{course.description}</p>
                  <small>{course.moduleCount} modules · {course.duration}</small>
                  <button className="button primary" type="button" disabled={busy} onClick={() => void enrol(course.id)}>Enrol</button>
                </article>
              ))}
              {openCourses.length === 0 && <p>Every open course is already on your file.</p>}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
