import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { useAuth } from '../../../platform/AuthContext'
import { api } from '../../../platform/api'
import type { StudyDesk } from '../../../platform/literacy'
import { Banner, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { CourseQuiz } from '../../../components/CourseQuiz'
import { useAction } from '../donations/kit'

export function StudyRoom() {
  usePageTitle('Student classroom — UPSA Next Payment')
  const { can } = useAuth()
  const { learnerId, enrollmentId } = useParams()
  const navigate = useNavigate()
  const loaded = useLoad(() => api.literacy.study(learnerId), [learnerId])
  const [desk, setDesk] = useState<StudyDesk | null>(null)
  const { error, busy, run } = useAction()

  useEffect(() => {
    if (loaded.data) setDesk(loaded.data)
  }, [loaded.data])

  const learner = desk?.learner
  const lesson = desk?.lessons.find((item) => item.enrollmentId === enrollmentId)
  const enrolledCourseIds = new Set((desk?.lessons ?? []).map((item) => item.courseId))
  const openCourses = (desk?.courses ?? []).filter((course) => !enrolledCourseIds.has(course.id))

  function enrol(courseId: string) {
    if (!learner) return
    void run(async () => {
      const next = await api.literacy.studyEnrol({ learnerId: learner.id, courseId })
      setDesk(next)
      const created = next.lessons.find((item) => item.courseId === courseId)
      if (created) navigate(`/app/literacy/study/${learner.id}/${created.enrollmentId}`)
    })
  }

  function finish(moduleIndex: number) {
    if (!lesson) return
    void run(async () => {
      setDesk(await api.literacy.completeModule(lesson.enrollmentId, moduleIndex))
    })
  }

  return (
    <>
      <PageHeading
        kicker="Student"
        title={learner ? learner.name : 'Follow a course'}
        lead="Enrol on a course an administrator has opened. Finish each module in order. When the last module is done, the system issues the certificate."
        icon="family"
        actions={learnerId && can('literacy.write') ? <Link className="button secondary" to="/app/literacy/study">Choose another student</Link> : undefined}
      />
      {(loaded.error || error) && <Banner>{loaded.error || error}</Banner>}
      {!learner && (
        <Panel icon="family" title="Who is studying">
          {(desk?.students.length ?? 0) > 0 ? (
            <Table
              columns={['Student', 'School', '']}
              empty="No student is on file."
              rows={(desk?.students ?? []).map((student) => [
                <span key={student.id}><b>{student.name}</b><br />{student.phone || 'No phone on file'}</span>,
                student.detail || '—',
                <button key={`${student.id}-enter`} className="button primary" type="button" disabled={busy} onClick={() => void run(async () => {
                  const next = await api.literacy.enterStudy(student.id)
                  if (next.learner) {
                    setDesk(next)
                    navigate(`/app/literacy/study/${next.learner.id}`)
                  }
                })}>Enter classroom</button>,
              ])}
            />
          ) : (
            <div className="student-actions">
              <p>This sign-in follows courses as the linked parent.</p>
              <button className="button primary" type="button" disabled={busy || Boolean(loaded.error)} onClick={() => void run(async () => {
                const next = await api.literacy.enterStudy()
                if (next.learner) {
                  setDesk(next)
                  navigate(`/app/literacy/study/${next.learner.id}`)
                }
              })}>Start my courses</button>
            </div>
          )}
        </Panel>
      )}
      {learner && lesson && (
        <Panel icon="report" title={lesson.courseName}>
          <div className="lesson">
            <div className="lesson-progress" aria-hidden="true"><span style={{ width: `${lesson.progress}%` }} /></div>
            <p>{lesson.current >= lesson.modules.length ? 'The reading is finished.' : `Module ${lesson.current + 1} of ${lesson.modules.length}`}</p>
            {lesson.current < lesson.modules.length && (
              <>
                <h3>{lesson.modules[lesson.current].title}</h3>
                <p>{lesson.modules[lesson.current].objectives}</p>
                <p>{lesson.modules[lesson.current].content}</p>
                <button className="button primary" type="button" disabled={busy} onClick={() => finish(lesson.current)}>I have finished this module</button>
              </>
            )}
            {lesson.quiz.length > 0 && (
              <CourseQuiz
                key={lesson.mark?.percentage ?? 'quiz'}
                lesson={lesson}
                busy={busy}
                onSubmit={(answers) => void run(async () => { setDesk(await api.literacy.studyQuiz(lesson.enrollmentId, answers)) })}
              />
            )}
            {lesson.certificateId && (
              <p className="lesson-certificate"><StatusPill value="CERTIFIED" /> The system issued certificate {lesson.certificateId}{lesson.mark ? ` after a mark of ${lesson.mark.percentage}%` : ''}.</p>
            )}
            <Link to={`/app/literacy/study/${learner.id}`}>Back to my courses</Link>
          </div>
        </Panel>
      )}
      {learner && !lesson && (
        <>
          <Panel icon="report" title="My courses">
            <Table
              columns={['Course', 'Progress', 'Status', '']}
              empty="You have not enrolled yet. Choose a course below."
              rows={desk.lessons.map((item) => [
                <span key={item.enrollmentId}><b>{item.courseName}</b><br />{item.enrollmentId}</span>,
                `${item.progress}%`,
                <StatusPill key={`${item.enrollmentId}-status`} value={item.certificateId ? 'CERTIFIED' : item.status} />,
                <Link key={`${item.enrollmentId}-open`} to={`/app/literacy/study/${learner.id}/${item.enrollmentId}`}>{item.certificateId ? 'View certificate' : 'Continue'}</Link>,
              ])}
            />
          </Panel>
          <Panel icon="school" title="Open courses">
            <Table
              columns={['Course', 'Modules', '']}
              empty="An administrator has not opened a course yet."
              rows={openCourses.map((course) => [
                <span key={course.id}><b>{course.name}</b><br />{course.description}</span>,
                String(course.modules.length),
                <button key={`${course.id}-enrol`} className="button primary" type="button" disabled={busy} onClick={() => enrol(course.id)}>Enrol</button>,
              ])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
