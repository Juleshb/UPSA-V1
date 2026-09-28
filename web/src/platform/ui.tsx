import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GraphicIcon, type GraphicName } from '../components/Graphics'
import { statusLabel } from './format'

export function StatusPill({ value }: { value: string }) {
  const token = value.toUpperCase()
  const tone = token === 'INACTIVE' || /FAILED|DECLINED|OVERDUE|CANCELLED|SUSPENDED|REJECTED/.test(token)
    ? 'bad'
    : /PAID|ACTIVE|SUCCESS|APPROVED|MATCHED|VERIFIED|ACCEPTED|CONFIRMED/.test(token)
      ? 'ok'
      : /PENDING|ISSUED|SUBMITTED|REQUESTED|OFFER|PILOT|INITIATED|REVIEW/.test(token)
        ? 'wait'
        : 'neutral'
  return <em className={`app-pill ${tone}`}>{statusLabel(value)}</em>
}

export function PageHeading({
  kicker,
  title,
  lead,
  icon,
  actions,
}: {
  kicker: string
  title: string
  lead: string
  icon?: GraphicName
  actions?: ReactNode
}) {
  return (
    <header className="app-heading">
      <div>
        <div className="eyebrow"><span /> {kicker}</div>
        <h1>
          {icon && <span className="app-title-icon"><GraphicIcon name={icon} /></span>}
          {title}
        </h1>
        <p>{lead}</p>
      </div>
      {actions ? <div className="app-heading-actions">{actions}</div> : null}
    </header>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: GraphicName
}) {
  return (
    <article className="app-stat">
      <div className="app-stat-top">
        <span>{label}</span>
        {icon && <span className="app-stat-icon"><GraphicIcon name={icon} /></span>}
      </div>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </article>
  )
}

export function Panel({
  title,
  action,
  icon,
  wide,
  children,
}: {
  title: string
  action?: ReactNode
  icon?: GraphicName
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section className={`app-panel${wide ? ' wide' : ''}`}>
      <header>
        <h2>
          {icon && <GraphicIcon name={icon} />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Table({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  rows: ReactNode[][]
  empty: string
}) {
  if (!rows.length) return <p className="app-empty">{empty}</p>
  return (
    <div className="app-table-wrap">
      <table className="app-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Banner({ children }: { children: ReactNode }) {
  return <p className="app-banner" role="alert">{children}</p>
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'default',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'default' | 'wide'
}) {
  if (!open) return null
  return (
    <div className="app-modal-overlay" onClick={onClose} role="presentation">
      <div className={`app-modal${size === 'wide' ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="app-modal-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2 id="app-modal-title">{title}</h2>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="app-modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  span,
  children,
}: {
  label: string
  hint?: string
  span?: 'full'
  children: ReactNode
}) {
  return (
    <label className={`app-field${span === 'full' ? ' full' : ''}`}>
      <span className="app-field-label">{label}</span>
      {children}
      {hint ? <small className="app-field-hint">{hint}</small> : null}
    </label>
  )
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="app-field-group">
      <legend>{title}</legend>
      <div className="app-form">{children}</div>
    </fieldset>
  )
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="app-row-actions">{children}</div>
}

export function matchesQuery(query: string, ...parts: Array<string | number | null | undefined>) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return parts.some((part) => String(part ?? '').toLowerCase().includes(needle))
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="app-search-field">
      <GraphicIcon name="search" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

export type SearchOption = {
  value: string
  label: string
  hint?: string
}

export function SearchSelect({
  name,
  options,
  defaultValue,
  value: controlled,
  onChange,
  required,
  allowEmpty,
  placeholder = 'Search to select…',
  empty = 'No matching records.',
}: {
  name: string
  options: SearchOption[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  allowEmpty?: boolean
  placeholder?: string
  empty?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [internal, setInternal] = useState(defaultValue ?? (allowEmpty ? '' : options[0]?.value ?? ''))
  const value = controlled ?? internal

  function setValue(next: string) {
    if (controlled === undefined) setInternal(next)
    onChange?.(next)
  }

  useEffect(() => {
    if (controlled !== undefined || allowEmpty) return
    if (!value && options[0]) setInternal(options[0].value)
  }, [allowEmpty, controlled, options, value])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((option) => option.value === value)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) =>
      `${option.label} ${option.hint ?? ''} ${option.value}`.toLowerCase().includes(needle),
    )
  }, [options, query])

  return (
    <div className={`app-search-select${open ? ' open' : ''}`} ref={root}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        className="app-search-select-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((current) => !current)
          setQuery('')
        }}
      >
        <span>{selected?.label ?? placeholder}</span>
        <GraphicIcon name="search" />
      </button>
      {open && (
        <div className="app-search-select-menu" role="listbox">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label="Search options"
          />
          <ul>
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? 'selected' : undefined}
                  onClick={() => {
                    setValue(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <b>{option.label}</b>
                  {option.hint && <small>{option.hint}</small>}
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && <p>{empty}</p>}
        </div>
      )}
    </div>
  )
}
