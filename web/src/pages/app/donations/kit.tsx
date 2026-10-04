import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../../../platform/api'
import { Field } from '../../../platform/ui'
import type { DonationDoc } from '../../../platform/donation'

export function useAction() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The request could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return { error, busy, run, setError }
}

export function Options({ options, labels }: { options: readonly string[]; labels?: boolean }) {
  return options.map((option) => (
    <option key={option} value={option}>{labels === false ? option : option.replaceAll('_', ' ')}</option>
  ))
}

export function DocFields({
  documents,
  onChange,
  types,
}: {
  documents: DonationDoc[]
  onChange: (documents: DonationDoc[]) => void
  types: readonly string[]
}) {
  return (
    <div className="app-form">
      {documents.map((document, index) => (
        <div key={`${document.documentType}-${index}`} className="app-form full">
          <Field label="Document type">
            <select value={document.documentType} onChange={(event) => onChange(documents.map((item, itemIndex) => itemIndex === index ? { ...item, documentType: event.target.value } : item))}>
              {types.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="File name" hint="Record the file that supports this record.">
            <input value={document.fileName} onChange={(event) => onChange(documents.map((item, itemIndex) => itemIndex === index ? { ...item, fileName: event.target.value } : item))} />
          </Field>
        </div>
      ))}
      <button className="button secondary" type="button" onClick={() => onChange([...documents, { documentType: types[0] ?? 'OTHER', fileName: '' }])}>Add document</button>
    </div>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="app-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function SaveBar({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <div className="app-inline-actions">{children}{busy ? <span className="app-note">Saving…</span> : null}</div>
}

export function onSubmit(run: (event: FormEvent<HTMLFormElement>) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(event)
  }
}

export function useFormSteps() {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})

  function collect(form: HTMLFormElement) {
    const next = { ...values }
    const present = new Set<string>()
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue
      if (!element.name || element.disabled) continue
      present.add(element.name)
    }
    const data = new FormData(form)
    for (const name of present) next[name] = data.has(name) ? String(data.get(name) ?? '') : ''
    setValues(next)
    return next
  }

  function move(form: HTMLFormElement, next: number, count: number) {
    const target = Math.max(0, Math.min(next, count - 1))
    if (target > step && !form.reportValidity()) return null
    const saved = collect(form)
    setStep(target)
    return saved
  }

  function reset() {
    setStep(0)
    setValues({})
  }

  return { step, values, collect, move, reset }
}

export function kept(values: Record<string, string>, name: string, fallback = '') {
  return name in values ? values[name] : fallback
}

export function FormSteps({
  steps,
  step,
  onPick,
}: {
  steps: readonly string[]
  step: number
  onPick: (index: number) => void
}) {
  return (
    <>
      <div className="form-steps" role="tablist" aria-label="Form steps">
        {steps.map((title, index) => (
          <button
            key={title}
            type="button"
            className={index === step ? 'current' : index < step ? 'done' : ''}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => onPick(index)}
          >
            <b>{index < step ? 'Done' : `Step ${index + 1}`}</b>
            <span>{title}</span>
          </button>
        ))}
      </div>
      <div className="form-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="form-step-label">Step {step + 1} of {steps.length} · {steps[step]}</p>
    </>
  )
}

export function StepNav({
  step,
  count,
  busy,
  onBack,
  onNext,
  submitLabel,
  extra,
}: {
  step: number
  count: number
  busy?: boolean
  onBack: () => void
  onNext: () => void
  submitLabel: string
  extra?: ReactNode
}) {
  return (
    <div className="student-actions">
      <button className="button secondary" type="button" disabled={step === 0 || busy} onClick={onBack}>Back</button>
      <div className="app-inline-actions">
        {extra}
        {step < count - 1
          ? <button className="button primary" type="button" onClick={onNext}>Continue</button>
          : <button className="button primary" type="submit" disabled={busy}>{submitLabel}</button>}
      </div>
    </div>
  )
}
