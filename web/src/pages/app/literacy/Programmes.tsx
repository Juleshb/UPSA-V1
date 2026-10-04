import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Check, FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { CATEGORIES, DELIVERY, LANGUAGES, LEARNER_TYPES, NEXT_STATUS, TOPICS } from './catalog'

export function ProgrammeList() {
  usePageTitle('Programmes — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.programmes())
  const { error, busy, run } = useAction()

  return (
    <>
      <PageHeading kicker="Programmes" title="What this platform teaches" lead="Publish a programme only after it has at least one course. The topic list is editable and is the training standard for this workspace." icon="report" actions={<Link className="button primary" to="/app/literacy/programmes/new">New programme</Link>} />
      {(rows.error || error) && <Banner>{rows.error || error}</Banner>}
      <Panel icon="report" title="Programmes">
        <Table
          columns={['Programme', 'Audience', 'Pass mark', 'Status', '']}
          empty="No programme yet. Install the core curriculum from the dashboard, or create one."
          rows={(rows.data?.items ?? []).map((item) => [
            <span key={item.id}><b>{item.name}</b><br />{item.code} · {item.id}</span>,
            item.audience.replaceAll(',', ', '),
            `${item.passMark}% · ${item.validityMonths} months`,
            <StatusPill key={`${item.id}-status`} value={item.status} />,
            NEXT_STATUS[item.status]
              ? <button key={`${item.id}-next`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.programmeStatus(item.id, NEXT_STATUS[item.status]); rows.reload() })}>Move to {NEXT_STATUS[item.status].replaceAll('_', ' ').toLowerCase()}</button>
              : item.courses.length ? `${item.courses.length} courses` : '—',
          ])}
        />
      </Panel>
    </>
  )
}

const STEPS = ['Programme', 'Audience and rules']

export function ProgrammeForm() {
  usePageTitle('New programme — UPSA Next Payment')
  const navigate = useNavigate()
  const steps = useFormSteps()
  const { error, busy, run, setError } = useAction()
  const [topics, setTopics] = useState<string[]>([TOPICS[0]])
  const [audience, setAudience] = useState<string[]>(['SCHOOL', 'PARENT'])
  const step = steps.step

  function form() {
    return document.getElementById('programme-form') as HTMLFormElement
  }

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  function submit() {
    const node = form()
    if (!node.reportValidity()) return
    if (!audience.length || !topics.length) {
      setError('Choose at least one audience and one topic.')
      return
    }
    const data = steps.collect(node)
    void run(async () => {
      await api.literacy.saveProgramme({
        code: data.code,
        name: data.name,
        description: data.description,
        audience: audience.join(','),
        category: data.category,
        language: data.language,
        deliveryMethod: data.deliveryMethod,
        duration: data.duration,
        certificationAvailable: data.certificationAvailable === 'yes',
        validityMonths: Number(data.validityMonths),
        passMark: Number(data.passMark),
        topics,
      })
      navigate('/app/literacy/programmes')
    })
  }

  return (
    <>
      <PageHeading kicker="Programmes" title="New training programme" lead="Name the audience, the language, the pass mark, and the topics this programme is accountable for." icon="report" />
      {error && <Banner>{error}</Banner>}
      <Panel icon="report" title="Programme">
        <form id="programme-form" className="form-wizard" onSubmit={onSubmit(submit)}>
          <FormSteps steps={STEPS} step={step} onPick={(index) => steps.move(form(), index > step ? step + 1 : index, STEPS.length)} />
          {step === 0 && (
            <div className="app-form" key="programme">
              <Field label="Code" note="required"><input name="code" required defaultValue={kept(steps.values, 'code')} /></Field>
              <Field label="Name" note="required"><input name="name" required defaultValue={kept(steps.values, 'name')} /></Field>
              <Field label="Description" note="required" span="full"><textarea name="description" required defaultValue={kept(steps.values, 'description')} /></Field>
              <Field label="Category" note="required"><select name="category" required defaultValue={kept(steps.values, 'category', 'CONSUMER_PROTECTION')}><Options options={CATEGORIES} /></select></Field>
              <Field label="Language" note="required"><select name="language" required defaultValue={kept(steps.values, 'language', 'English')}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Delivery" note="required"><select name="deliveryMethod" required defaultValue={kept(steps.values, 'deliveryMethod', 'BLENDED')}><Options options={DELIVERY} /></select></Field>
              <Field label="Duration" note="required"><input name="duration" required defaultValue={kept(steps.values, 'duration', '4 weeks')} /></Field>
            </div>
          )}
          {step === 1 && (
            <div className="app-form" key="rules">
              <Field label="Pass mark" note="required"><input name="passMark" type="number" min={1} max={100} required defaultValue={kept(steps.values, 'passMark', '70')} /></Field>
              <Field label="Certificate validity (months)" note="required"><input name="validityMonths" type="number" min={1} max={60} required defaultValue={kept(steps.values, 'validityMonths', '12')} /></Field>
              <Field label="Certificate available" note="required">
                <select name="certificationAvailable" defaultValue={kept(steps.values, 'certificationAvailable', 'yes')}><option value="yes">Yes</option><option value="no">No</option></select>
              </Field>
              <Field label="Audience" span="full" note="required">
                <div className="app-form">
                  {LEARNER_TYPES.map((item) => <Check key={item} label={item.replaceAll('_', ' ')} checked={audience.includes(item)} onChange={() => toggle(audience, item, setAudience)} />)}
                </div>
              </Field>
              <Field label="Topics" span="full" note="required">
                <div className="app-form">
                  {TOPICS.map((item) => <Check key={item} label={item} checked={topics.includes(item)} onChange={() => toggle(topics, item, setTopics)} />)}
                </div>
              </Field>
            </div>
          )}
          <StepNav step={step} count={STEPS.length} busy={busy} submitLabel="Save programme" onBack={() => steps.move(form(), step - 1, STEPS.length)} onNext={() => steps.move(form(), step + 1, STEPS.length)} />
        </form>
      </Panel>
    </>
  )
}
