export function ApplySteps({ steps, step }: { steps: string[]; step: number }) {
  return (
    <ol className="apply-steps" aria-label="Application steps">
      {steps.map((label, index) => {
        const state = index === step ? 'current' : index < step ? 'done' : ''
        return (
          <li key={label} className={state}>
            <i aria-hidden="true">{state === 'done' ? '✓' : index + 1}</i>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
