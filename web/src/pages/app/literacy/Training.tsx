import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Options, onSubmit, useAction } from '../donations/kit'
import { LANGUAGES } from './catalog'

export function TrainingBoard() {
  usePageTitle('Sessions — UPSA Next Payment')
  const sessions = useLoad(() => api.literacy.sessions())
  const courses = useLoad(() => api.literacy.courses())
  const learners = useLoad(() => api.literacy.learners())
  const trainers = useLoad(() => api.literacy.trainers())
  const { error, busy, run } = useAction()
  const openCourses = (courses.data?.items ?? []).filter((item) => item.status === 'PUBLISHED' || item.status === 'ACTIVE' || item.status === 'APPROVED')

  return (
    <>
      <PageHeading kicker="Sessions" title="Who taught, and who attended" lead="Attendance is recorded against the learner and the course. A present or partial mark moves an open enrolment forward." icon="school" />
      {(error || sessions.error) && <Banner>{error || sessions.error}</Banner>}
      <Panel icon="user" title="Trainer">
        <form className="app-form" onSubmit={onSubmit((event) => {
          const data = new FormData(event.currentTarget)
          void run(async () => {
            await api.literacy.saveTrainer({
              name: String(data.get('name') ?? ''),
              organization: String(data.get('organization') ?? ''),
              qualification: String(data.get('qualification') ?? ''),
              certification: String(data.get('certification') ?? ''),
              expertise: String(data.get('expertise') ?? ''),
              phone: String(data.get('phone') ?? ''),
              email: String(data.get('email') ?? ''),
            })
            trainers.reload()
            event.currentTarget.reset()
          })
        })}>
          <Field label="Name" note="required"><input name="name" required /></Field>
          <Field label="Organization" note="required"><input name="organization" required /></Field>
          <Field label="Qualification" note="required"><input name="qualification" required /></Field>
          <Field label="Certification" note="required"><input name="certification" required /></Field>
          <Field label="Expertise" note="required"><input name="expertise" required /></Field>
          <Field label="Phone" note="required"><input name="phone" required /></Field>
          <Field label="Email" note="required"><input name="email" type="email" required /></Field>
          <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Register trainer</button></div>
        </form>
        <Table
          columns={['Trainer', 'Organization', 'Status', '']}
          empty="No trainer yet."
          rows={(trainers.data?.items ?? []).map((item) => [
            item.name,
            item.organization,
            <StatusPill key={item.id} value={item.status} />,
            item.status === 'PENDING' ? <button key={`${item.id}-ok`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.approveTrainer(item.id); trainers.reload() })}>Approve</button> : '—',
          ])}
        />
      </Panel>
      <Panel icon="school" title="Schedule a session">
        <form className="app-form" onSubmit={onSubmit((event) => {
          const data = new FormData(event.currentTarget)
          const course = openCourses.find((item) => item.id === String(data.get('courseId') ?? ''))
          void run(async () => {
            await api.literacy.saveSession({
              courseId: String(data.get('courseId') ?? ''),
              trainerId: String(data.get('trainerId') ?? '') || undefined,
              moduleTitle: course?.modules[0]?.title || course?.name || 'Session',
              sessionDate: String(data.get('sessionDate') ?? ''),
              startTime: String(data.get('startTime') ?? ''),
              endTime: String(data.get('endTime') ?? ''),
              venue: String(data.get('venue') ?? '') || undefined,
              capacity: Number(data.get('capacity') ?? 30),
              language: String(data.get('language') ?? 'English'),
              audience: 'LEARNERS',
            })
            sessions.reload()
          })
        })}>
          <Field label="Course" note="required">
            <select name="courseId" required>
              <option value="">Choose a course</option>
              {openCourses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Trainer" note="optional">
            <select name="trainerId">
              <option value="">No named trainer</option>
              {(trainers.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Date" note="required"><input name="sessionDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Start" note="required"><input name="startTime" required defaultValue="09:00" /></Field>
          <Field label="End" note="required"><input name="endTime" required defaultValue="11:00" /></Field>
          <Field label="Venue" note="optional"><input name="venue" defaultValue="School hall" /></Field>
          <Field label="Capacity" note="required"><input name="capacity" type="number" min={1} required defaultValue={30} /></Field>
          <Field label="Language" note="required"><select name="language" defaultValue="English">{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Schedule</button></div>
        </form>
      </Panel>
      <Panel icon="user" title="Attendance">
        <form className="app-form" onSubmit={onSubmit((event) => {
          const data = new FormData(event.currentTarget)
          void run(async () => {
            await api.literacy.attendance(String(data.get('sessionId') ?? ''), {
              learnerId: String(data.get('learnerId') ?? ''),
              method: String(data.get('method') ?? 'MANUAL'),
              status: String(data.get('status') ?? 'PRESENT'),
              percent: Number(data.get('percent') ?? 100),
            })
            sessions.reload()
          })
        })}>
          <Field label="Session" note="required">
            <select name="sessionId" required>
              <option value="">Choose a session</option>
              {(sessions.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.courseName} · {item.moduleTitle}</option>)}
            </select>
          </Field>
          <Field label="Learner" note="required">
            <select name="learnerId" required>
              <option value="">Choose a learner</option>
              {(learners.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Method" note="required"><select name="method" defaultValue="MANUAL"><Options options={['MANUAL', 'ONLINE', 'PIN', 'QR', 'MOBILE']} labels={false} /></select></Field>
          <Field label="Result" note="required"><select name="status" defaultValue="PRESENT"><Options options={['PRESENT', 'PARTIAL', 'ABSENT']} /></select></Field>
          <Field label="Progress percent" note="required"><input name="percent" type="number" min={0} max={100} required defaultValue={100} /></Field>
          <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Record attendance</button></div>
        </form>
        <Table
          columns={['Session', 'Date', 'Attendance', 'Status']}
          empty="No session yet."
          rows={(sessions.data?.items ?? []).map((item) => [item.moduleTitle, item.sessionDate?.slice(0, 10) ?? '—', String(item.attendance), <StatusPill key={item.id} value={item.status} />])}
        />
      </Panel>
    </>
  )
}
