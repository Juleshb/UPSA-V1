import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Check, FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { DELIVERY, LANGUAGES, LEARNER_TYPES, SCORE_AREAS } from './catalog'

export function LearnerList() {
  usePageTitle('Learners — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.learners())
  return (
    <>
      <PageHeading kicker="Learners" title="People already known to the platform" lead="Registering a learner links the training file to a school, parent, student, or registration. A second customer record is not created." icon="user" actions={<Link className="button primary" to="/app/literacy/learners/new">Register a learner</Link>} />
      {rows.error && <Banner>{rows.error}</Banner>}
      <Panel icon="user" title="Learners">
        <Table
          columns={['Learner', 'Type', 'Language', 'Status', '']}
          empty="No learner yet."
          rows={(rows.data?.items ?? []).map((item) => [
            <span key={item.id}><b>{item.name}</b><br />{item.id} · {item.phone}</span>,
            item.learnerType.replaceAll('_', ' '),
            item.language,
            <StatusPill key={`${item.id}-status`} value={item.status} />,
            <Link key={`${item.id}-open`} to={`/app/literacy/learners/${item.id}`}>Open</Link>,
          ])}
        />
      </Panel>
    </>
  )
}

const STEPS = ['Person', 'Training needs']

export function LearnerForm() {
  usePageTitle('Register a learner — UPSA Next Payment')
  const navigate = useNavigate()
  const steps = useFormSteps()
  const { error, busy, run } = useAction()
  const [learnerType, setLearnerType] = useState('SCHOOL')
  const [partyId, setPartyId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const parties = useLoad(() => api.literacy.parties(learnerType), [learnerType])
  const step = steps.step

  function form() {
    return document.getElementById('learner-form') as HTMLFormElement
  }

  function chooseParty(id: string) {
    setPartyId(id)
    const party = (parties.data?.parties ?? []).find((item) => item.id === id)
    if (!party) return
    setName(party.name)
    setPhone(party.phone ?? '')
  }

  function submit() {
    const node = form()
    if (!node.reportValidity()) return
    const data = steps.collect(node)
    void run(async () => {
      const created = await api.literacy.saveLearner({
        learnerType,
        partyId: partyId || undefined,
        name: name || data.name,
        phone: phone || data.phone,
        email: data.email || undefined,
        language: data.language,
        district: data.district || undefined,
        educationLevel: data.educationLevel || undefined,
        occupation: data.occupation || undefined,
        trainingNeeds: data.trainingNeeds,
        accessibility: data.accessibility || undefined,
        gender: data.gender || undefined,
      })
      navigate(`/app/literacy/learners/${created.id}`)
    })
  }

  return (
    <>
      <PageHeading kicker="Learners" title="Register a learner" lead="Choose the existing record. The name and phone come from that school, parent, student, or registration." icon="user" />
      {(error || parties.error) && <Banner>{error || parties.error}</Banner>}
      <Panel icon="user" title="Learner">
        <form id="learner-form" className="form-wizard" onSubmit={onSubmit(submit)}>
          <FormSteps steps={STEPS} step={step} onPick={(index) => steps.move(form(), index > step ? step + 1 : index, STEPS.length)} />
          {step === 0 && (
            <div className="app-form" key="person">
              <Field label="Learner type" note="required">
                <select name="learnerType" required value={learnerType} onChange={(event) => { setLearnerType(event.target.value); setPartyId(''); setName(''); setPhone('') }}>
                  <Options options={LEARNER_TYPES} />
                </select>
              </Field>
              <Field label="Existing record" note="optional" hint="Leave this empty only for a person who is not yet on the platform.">
                <select name="partyId" value={partyId} onChange={(event) => chooseParty(event.target.value)}>
                  <option value="">Not linked yet</option>
                  {(parties.data?.parties ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
                </select>
              </Field>
              <Field label="Name" note="required"><input name="name" required value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="Phone" note="required"><input name="phone" required value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
              <Field label="Email" note="optional"><input name="email" type="email" defaultValue={kept(steps.values, 'email')} /></Field>
              <Field label="Language" note="required"><select name="language" required defaultValue={kept(steps.values, 'language', 'English')}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Gender" note="optional"><input name="gender" defaultValue={kept(steps.values, 'gender')} /></Field>
            </div>
          )}
          {step === 1 && (
            <div className="app-form" key="needs">
              <Field label="District" note="optional"><input name="district" defaultValue={kept(steps.values, 'district')} /></Field>
              <Field label="Education level" note="optional"><input name="educationLevel" defaultValue={kept(steps.values, 'educationLevel')} /></Field>
              <Field label="Occupation" note="optional"><input name="occupation" defaultValue={kept(steps.values, 'occupation')} /></Field>
              <Field label="Training needs" note="required" span="full"><textarea name="trainingNeeds" required defaultValue={kept(steps.values, 'trainingNeeds')} /></Field>
              <Field label="Accessibility" note="optional" span="full"><input name="accessibility" defaultValue={kept(steps.values, 'accessibility')} /></Field>
            </div>
          )}
          <StepNav step={step} count={STEPS.length} busy={busy} submitLabel="Register learner" onBack={() => steps.move(form(), step - 1, STEPS.length)} onNext={() => steps.move(form(), step + 1, STEPS.length)} />
        </form>
      </Panel>
    </>
  )
}

export function LearnerFilePage() {
  const { learnerId = '' } = useParams()
  usePageTitle('Learner file — UPSA Next Payment')
  const file = useLoad(() => api.literacy.learner(learnerId), [learnerId])
  const courses = useLoad(() => api.literacy.courses())
  const { error, busy, run } = useAction()
  const learner = file.data
  const openCourses = (courses.data?.items ?? []).filter((item) => item.status === 'PUBLISHED' || item.status === 'ACTIVE')
  const [understood, setUnderstood] = useState({ product: false, cost: false, contract: false, confirmed: false })

  function reload() {
    file.reload()
  }

  return (
    <>
      <PageHeading kicker="Learner file" title={learner?.name ?? 'Learner'} lead={learner ? `${learner.learnerType.replaceAll('_', ' ')} · ${learner.language}${learner.schoolName ? ` · ${learner.schoolName}` : ''}` : 'Loading the training file.'} icon="user" actions={learner ? <StatusPill value={learner.status} /> : undefined} />
      {(file.error || courses.error || error) && <Banner>{file.error || courses.error || error}</Banner>}
      {learner && (
        <>
          <Panel icon="school" title="Enrol on a published course">
            <form className="app-form" onSubmit={onSubmit((event) => {
              const data = new FormData(event.currentTarget)
              void run(async () => {
                await api.literacy.enrol({
                  learnerId: learner.id,
                  courseId: String(data.get('courseId') ?? ''),
                  deliveryMethod: String(data.get('deliveryMethod') ?? ''),
                  trainerName: String(data.get('trainerName') ?? '') || undefined,
                  startDate: String(data.get('startDate') ?? ''),
                })
                reload()
              })
            })}>
              <Field label="Course" note="required">
                <select name="courseId" required>
                  <option value="">Choose a course</option>
                  {openCourses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Delivery" note="required"><select name="deliveryMethod" required defaultValue="CLASSROOM"><Options options={DELIVERY} /></select></Field>
              <Field label="Trainer" note="optional"><input name="trainerName" /></Field>
              <Field label="Start date" note="required"><input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
              <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Enrol</button></div>
            </form>
          </Panel>
          <Panel icon="report" title="Enrolments">
            <Table
              columns={['Course', 'Progress', 'Pre', 'Post', 'Status', '']}
              empty="Not enrolled yet."
              rows={learner.enrollments.map((item) => [
                <span key={item.id}><b>{item.courseName}</b><br />{item.id}</span>,
                `${item.progress}%`,
                item.preScore ?? '—',
                item.postScore ?? '—',
                <StatusPill key={`${item.id}-status`} value={item.status} />,
                item.status === 'COMPLETED' && !item.certificateId
                  ? <button key={`${item.id}-cert`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.certificate(item.id); reload() })}>Issue certificate</button>
                  : item.certificateId ?? '—',
              ])}
            />
          </Panel>
          <Panel icon="report" title="Assessment">
            <form className="app-form" onSubmit={onSubmit((event) => {
              const data = new FormData(event.currentTarget)
              const scores = Object.fromEntries(SCORE_AREAS.map((area) => [area, Number(data.get(area) ?? 0)]))
              void run(async () => {
                await api.literacy.assess(String(data.get('enrollmentId') ?? ''), { kind: String(data.get('kind') ?? 'PRE'), scores })
                reload()
              })
            })}>
              <Field label="Enrolment" note="required">
                <select name="enrollmentId" required>
                  <option value="">Choose an enrolment</option>
                  {learner.enrollments.map((item) => <option key={item.id} value={item.id}>{item.courseName}</option>)}
                </select>
              </Field>
              <Field label="Assessment" note="required">
                <select name="kind" required defaultValue="PRE"><option value="PRE">Pre-assessment</option><option value="POST">Post-assessment</option><option value="QUIZ">Quiz</option></select>
              </Field>
              {SCORE_AREAS.map((area) => (
                <Field key={area} label={area} note="required"><input name={area} type="number" min={0} max={100} required defaultValue={70} /></Field>
              ))}
              <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Record scores</button></div>
            </form>
          </Panel>
          <Panel icon="shield" title="Product understanding">
            <p className="app-note">Record that the product, its cost, and the contract were explained, plus the question the learner asked. This is education evidence. It does not approve credit.</p>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const data = new FormData(event.currentTarget)
              if (understood.confirmed && (!understood.product || !understood.cost || !understood.contract)) return
              void run(async () => {
                await api.literacy.evidence({
                  learnerId: learner.id,
                  enrollmentId: String(data.get('enrollmentId') ?? '') || undefined,
                  productName: String(data.get('productName') ?? ''),
                  language: learner.language,
                  trainerName: String(data.get('trainerName') ?? ''),
                  trainingDate: String(data.get('trainingDate') ?? ''),
                  materials: String(data.get('materials') ?? ''),
                  questions: String(data.get('questions') ?? ''),
                  answers: String(data.get('answers') ?? ''),
                  productExplained: understood.product,
                  costExplained: understood.cost,
                  contractExplained: understood.contract,
                  confirmed: understood.confirmed,
                })
                reload()
              })
            })}>
              <Field label="Product" note="required"><input name="productName" required defaultValue="School fee financing" /></Field>
              <Field label="Enrolment" note="optional">
                <select name="enrollmentId"><option value="">Not tied to one course</option>{learner.enrollments.map((item) => <option key={item.id} value={item.id}>{item.courseName}</option>)}</select>
              </Field>
              <Field label="Trainer" note="required"><input name="trainerName" required /></Field>
              <Field label="Date" note="required"><input name="trainingDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="Materials" note="required"><input name="materials" required defaultValue="Course worksheet" /></Field>
              <Field label="Question asked" note="required" span="full"><textarea name="questions" required /></Field>
              <Field label="Answer given" note="required" span="full"><textarea name="answers" required /></Field>
              <Check label="The product was explained" checked={understood.product} onChange={(product) => setUnderstood({ ...understood, product })} />
              <Check label="The cost was explained" checked={understood.cost} onChange={(cost) => setUnderstood({ ...understood, cost })} />
              <Check label="The contract was explained" checked={understood.contract} onChange={(contract) => setUnderstood({ ...understood, contract })} />
              <Check label="The learner confirmed they understood" checked={understood.confirmed} onChange={(confirmed) => setUnderstood({ ...understood, confirmed })} />
              <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Save evidence</button></div>
            </form>
            {learner.evidence.length > 0 && <p className="app-note">{learner.evidence.length} understanding record{learner.evidence.length === 1 ? '' : 's'} on file. Latest reference {learner.evidence[0].reference}.</p>}
          </Panel>
          {learner.retrainings.length > 0 && (
            <Panel icon="user" title="Retraining">
              <Table columns={['Course', 'Focus', 'Reason', 'Status']} empty="No retraining." rows={learner.retrainings.map((item) => [item.previousCourse, item.modules, item.reason, <StatusPill key={item.id} value={item.status} />])} />
            </Panel>
          )}
        </>
      )}
    </>
  )
}
