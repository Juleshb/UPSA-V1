import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel } from '../../../platform/ui'
import { onSubmit, useAction } from '../donations/kit'
import { SIMULATORS } from './catalog'

const FIELDS: Record<string, string[]> = {
  BUDGET: ['monthlyIncome', 'schoolIncome', 'salary', 'business', 'otherIncome', 'rent', 'food', 'schoolFees', 'transport', 'airtime', 'utilities', 'otherExpenses'],
  LOAN: ['amount', 'months', 'annualRate', 'processing', 'insurance', 'guarantee', 'otherFees'],
  AFFORDABILITY: ['income', 'essential', 'existingDebt', 'other', 'newPayment'],
  SAVINGS: ['target', 'current'],
  EMERGENCY: ['essentials', 'months', 'current'],
  SPLIT: ['amount'],
  INVESTMENT: ['contributed', 'returned'],
}

export function PracticeBoard() {
  usePageTitle('Practice — UPSA Next Payment')
  const { error, busy, run } = useAction()
  const [kind, setKind] = useState<string>('SPLIT')
  const [result, setResult] = useState<Record<string, string | number> | null>(null)

  return (
    <>
      <PageHeading kicker="Practice" title="Illustrations, not decisions" lead="A budget, a loan cost, an affordability check, a savings goal, and the 40/60 explanation stay on this page. None of them posts a payment or approves credit." icon="ledger" />
      {error && <Banner>{error}</Banner>}
      <Panel icon="ledger" title="Calculator">
        <form className="app-form" onSubmit={onSubmit((event) => {
          const data = new FormData(event.currentTarget)
          const input: Record<string, number> = {}
          for (const field of FIELDS[kind] ?? []) input[field] = Number(data.get(field) ?? 0)
          void run(async () => {
            setResult(await api.literacy.simulate(kind, input))
          })
        })}>
          <Field label="Illustration" note="required">
            <select name="kind" value={kind} onChange={(event) => { setKind(event.target.value); setResult(null) }}>
              {SIMULATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          {(FIELDS[kind] ?? []).map((field) => (
            <Field key={field} label={field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()} note="required">
              <input name={field} type="number" min={0} step="0.01" required defaultValue={field === 'months' ? 12 : field === 'annualRate' ? 12 : 0} />
            </Field>
          ))}
          <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Calculate</button></div>
        </form>
        {result && (
          <div className="app-note">
            <b>{String(result.label ?? 'Result')}</b>
            <p>{String(result.disclaimer ?? '')}</p>
            <p>{Object.entries(result).filter(([key]) => !['kind', 'label', 'disclaimer'].includes(key)).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
          </div>
        )}
      </Panel>
    </>
  )
}
