import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { DIFFICULTY, LANGUAGES, NEXT_STATUS } from './catalog'

export function CourseList() {
  usePageTitle('Courses — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.courses())
  const { error, busy, run } = useAction()

  return (
    <>
      <PageHeading kicker="Admin" title="Courses students can enrol on" lead="Add the modules, then open the course. A student enrols from the classroom and the system issues the certificate when every module is finished." icon="school" actions={<Link className="button primary" to="/app/literacy/courses/new">New course</Link>} />
      {(rows.error || error) && <Banner>{rows.error || error}</Banner>}
      <Panel icon="school" title="Courses">
        <Table
          columns={['Course', 'Programme', 'Pass mark', 'Status', '']}
          empty="No course yet."
          rows={(rows.data?.items ?? []).map((item) => [
            <span key={item.id}><b>{item.name}</b><br />{item.code} · {item.modules.length} modules</span>,
            item.programmeName,
            `${item.passMark}%`,
            <StatusPill key={`${item.id}-status`} value={item.status} />,
            item.status === 'DRAFT' || item.status === 'REVIEW' || item.status === 'APPROVED'
              ? <button key={`${item.id}-open`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.publishCourse(item.id); rows.reload() })}>Open for students</button>
              : NEXT_STATUS[item.status]
                ? <button key={`${item.id}-next`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.courseStatus(item.id, NEXT_STATUS[item.status]); rows.reload() })}>Move to {NEXT_STATUS[item.status].replaceAll('_', ' ').toLowerCase()}</button>
                : '—',
          ])}
        />
      </Panel>
    </>
  )
}

const STEPS = ['Course', 'Learning module']

export function CourseForm() {
  usePageTitle('New course — UPSA Next Payment')
  const navigate = useNavigate()
  const programmes = useLoad(() => api.literacy.programmes())
  const steps = useFormSteps()
  const { error, busy, run, setError } = useAction()
  const step = steps.step
  const [modules, setModules] = useState([{ title: '', objectives: '', content: '', minutes: '40' }])

  function form() {
    return document.getElementById('course-form') as HTMLFormElement
  }

  function submit() {
    const node = form()
    if (!node.reportValidity()) return
    if (modules.some((item) => item.title.trim().length < 3 || item.objectives.trim().length < 3 || item.content.trim().length < 3)) {
      setError('Each module needs a title, an objective, and the explanation the student will read.')
      return
    }
    const data = steps.collect(node)
    void run(async () => {
      await api.literacy.saveCourse({
        programmeId: data.programmeId,
        code: data.code,
        name: data.name,
        description: data.description,
        objectives: modules.map((item) => item.objectives.trim()).join(' '),
        audience: data.audience,
        difficulty: data.difficulty,
        duration: data.duration,
        assessmentRequired: true,
        certificateRequired: data.certificateRequired !== 'no',
        passMark: Number(data.passMark),
        materials: data.materials,
        openForEnrolment: data.openForEnrolment !== 'no',
        modules: modules.map((item) => ({
          title: item.title.trim(),
          description: item.objectives.trim(),
          objectives: item.objectives.trim(),
          content: item.content.trim(),
          durationMinutes: Number(item.minutes || 40),
          materials: data.materials || 'Worksheet',
        })),
      })
      navigate('/app/literacy/courses')
    })
  }

  function updateModule(index: number, field: 'title' | 'objectives' | 'content' | 'minutes', value: string) {
    setModules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  return (
    <>
      <PageHeading kicker="Admin" title="Add a course" lead="Write the modules a student will read. The system then asks multiple choice, matching, and true or false questions from that material, marks the answers, and issues the certificate at the pass mark." icon="school" />
      {(error || programmes.error) && <Banner>{error || programmes.error}</Banner>}
      <Panel icon="school" title="Course">
        <form id="course-form" className="form-wizard" onSubmit={onSubmit(submit)}>
          <FormSteps steps={STEPS} step={step} onPick={(index) => steps.move(form(), index > step ? step + 1 : index, STEPS.length)} />
          {step === 0 && (
            <div className="app-form" key="course">
              <Field label="Programme" note="required">
                <select name="programmeId" required defaultValue={kept(steps.values, 'programmeId')}>
                  <option value="">Choose a programme</option>
                  {(programmes.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Code" note="required"><input name="code" required defaultValue={kept(steps.values, 'code')} /></Field>
              <Field label="Name" note="required"><input name="name" required defaultValue={kept(steps.values, 'name')} /></Field>
              <Field label="Description" note="required" span="full"><textarea name="description" required defaultValue={kept(steps.values, 'description')} /></Field>
              <Field label="Audience" note="required"><input name="audience" required defaultValue={kept(steps.values, 'audience', 'SCHOOL,PARENT')} /></Field>
              <Field label="Difficulty" note="required"><select name="difficulty" defaultValue={kept(steps.values, 'difficulty', 'BASIC')}><Options options={DIFFICULTY} /></select></Field>
              <Field label="Duration" note="required"><input name="duration" required defaultValue={kept(steps.values, 'duration', '2 modules')} /></Field>
              <Field label="Language of delivery" note="required"><select name="language" defaultValue={kept(steps.values, 'language', 'English')}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Pass mark" note="required"><input name="passMark" type="number" min={1} max={100} required defaultValue={kept(steps.values, 'passMark', '70')} /></Field>
              <Field label="Certificate" note="required"><select name="certificateRequired" defaultValue={kept(steps.values, 'certificateRequired', 'yes')}><option value="yes">Issued by the system when the course is finished</option><option value="no">Not issued</option></select></Field>
              <Field label="Enrolment" note="required"><select name="openForEnrolment" defaultValue={kept(steps.values, 'openForEnrolment', 'yes')}><option value="yes">Open for students when saved</option><option value="no">Keep as a draft</option></select></Field>
            </div>
          )}
          {step === 1 && (
            <div key="module">
              {modules.map((item, index) => (
                <div className="app-form" key={index}>
                  <Field label={`Module ${index + 1} title`} note="required"><input required value={item.title} onChange={(event) => updateModule(index, 'title', event.target.value)} /></Field>
                  <Field label="Minutes" note="required"><input type="number" min={10} required value={item.minutes} onChange={(event) => updateModule(index, 'minutes', event.target.value)} /></Field>
                  <Field label="Objective" note="required" span="full"><textarea required value={item.objectives} onChange={(event) => updateModule(index, 'objectives', event.target.value)} /></Field>
                  <Field label="What the student reads" note="required" span="full"><textarea required value={item.content} onChange={(event) => updateModule(index, 'content', event.target.value)} /></Field>
                </div>
              ))}
              <div className="student-actions">
                <button className="button secondary" type="button" onClick={() => setModules((current) => [...current, { title: '', objectives: '', content: '', minutes: '40' }])}>Add another module</button>
                <Field label="Materials" note="optional"><input name="materials" defaultValue={kept(steps.values, 'materials', 'Worksheet')} /></Field>
              </div>
            </div>
          )}
          <StepNav step={step} count={STEPS.length} busy={busy} submitLabel="Save course" onBack={() => steps.move(form(), step - 1, STEPS.length)} onNext={() => steps.move(form(), step + 1, STEPS.length)} />
        </form>
      </Panel>
    </>
  )
}
