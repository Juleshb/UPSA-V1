import { useMemo, useState } from 'react'

const formatRwf = (value: number) =>
  new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value)

export function FeePreview() {
  const [students, setStudents] = useState(420)
  const [fee, setFee] = useState(185000)
  const terms = 3
  const annual = useMemo(() => students * fee * terms, [students, fee])

  return (
    <div className="fee-preview">
      <div className="fee-copy">
        <div className="section-label">05 / Planning view</div>
        <h2>Illustrative collections at school scale.</h2>
        <p>
          Adjust enrolment and a typical term fee to see an annual figure in
          RWF. This is a planning illustration only — not a quote, credit
          offer or guaranteed collection amount.
        </p>
      </div>

      <div className="fee-panel">
        <label>
          <span>Students</span>
          <b>{students.toLocaleString()}</b>
          <input
            type="range"
            min={80}
            max={2000}
            step={10}
            value={students}
            onChange={(event) => setStudents(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Average term fee</span>
          <b>{formatRwf(fee)}</b>
          <input
            type="range"
            min={50000}
            max={800000}
            step={5000}
            value={fee}
            onChange={(event) => setFee(Number(event.target.value))}
          />
        </label>
        <div className="fee-result">
          <span>Illustrative annual collections</span>
          <strong>{formatRwf(annual)}</strong>
          <small>{terms} terms · RWF · not a credit decision</small>
        </div>
      </div>
    </div>
  )
}
