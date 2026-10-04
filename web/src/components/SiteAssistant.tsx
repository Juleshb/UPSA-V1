import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { answerQuestion } from './assistantReply'

type Message = {
  id: number
  role: 'assistant' | 'user'
  text: string
  service?: string
  to?: string
  linkLabel?: string
}

const starters = ['Become a member', 'Register a school', 'Verify a certificate', 'What is the platform?']

export function Assistant() {
  const navigate = useNavigate()
  const titleId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const replyTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Hello. I can help you apply for a service or explain UPSA Next Payment. What do you need?',
    },
  ])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    return () => {
      if (replyTimer.current) window.clearTimeout(replyTimer.current)
    }
  }, [])

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || pending) return
    const previous = [...messages].reverse().find((item) => item.service)?.service
    const reply = answerQuestion(trimmed, previous)
    const nextId = messages.length + 1
    setMessages((current) => [...current, { id: nextId, role: 'user', text: trimmed }])
    setDraft('')
    setPending(true)
    if (replyTimer.current) window.clearTimeout(replyTimer.current)
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { id: nextId + 1, role: 'assistant', ...reply }])
      setPending(false)
    }, 700)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    ask(draft)
  }

  function openService(label: string) {
    setOpen(false)
    navigate(`/services?open=${encodeURIComponent(label)}`)
  }

  return (
    <>
    <span className="assistant-floor" aria-hidden="true" />
    <div className={`assistant${open ? ' is-open' : ''}`}>
      {open && (
        <div className="assistant-frame">
        <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header>
            <div>
              <p id={titleId}>UPSA assistant</p>
              <small>Answers from this platform</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </header>
          <div className="assistant-log" ref={listRef}>
            {messages.map((message) => (
              <article key={message.id} className={message.role === 'user' ? 'from-user' : 'from-assistant'}>
                <p>{message.text}</p>
                {message.service && (
                  <button type="button" onClick={() => openService(message.service!)}>{message.service}</button>
                )}
                {message.to && (
                  <button type="button" onClick={() => { setOpen(false); navigate(message.to!) }}>{message.linkLabel ?? 'Open'}</button>
                )}
              </article>
            ))}
            {pending && (
              <article className="from-assistant assistant-thinking" aria-label="Writing a reply">
                <span /><span /><span />
              </article>
            )}
          </div>
          <div className="assistant-starters">
            {starters.map((item) => (
              <button key={item} type="button" onClick={() => ask(item)}>{item}</button>
            ))}
          </div>
          <form onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="assistant-question">Message</label>
            <input
              ref={inputRef}
              id="assistant-question"
              value={draft}
              placeholder="Ask about a service"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="button primary" type="submit">Send</button>
          </form>
        </section>
        </div>
      )}
      <button className="assistant-launch" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="assistant-aura" aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className="assistant-mark">{open ? '×' : 'AI'}</span>
        <span className="assistant-label">{open ? 'Close' : 'Ask UPSA'}</span>
      </button>
    </div>
    </>
  )
}
