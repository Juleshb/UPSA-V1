import { useState, type FormEvent } from 'react'
import type { QuizQuestion, StudyLesson } from '../platform/literacy'

const KIND_LABEL = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True or false',
  MATCHING: 'Matching',
} as const

export function CourseQuiz({
  lesson,
  busy,
  onSubmit,
}: {
  lesson: StudyLesson
  busy: boolean
  onSubmit: (answers: { id: string; choice?: string; value?: boolean; matches?: string[] }[]) => void
}) {
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [truth, setTruth] = useState<Record<string, boolean | undefined>>({})
  const [matches, setMatches] = useState<Record<string, string[]>>({})
  const [missing, setMissing] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const answers = lesson.quiz.map((question) => answerFor(question, choice, truth, matches))
    if (answers.some((answer) => !answered(answer))) {
      setMissing('Answer every question. The system marks the full set together.')
      return
    }
    setMissing('')
    onSubmit(answers)
  }

  return (
    <form className="course-quiz" onSubmit={submit}>
      <h3>Questions</h3>
      <p>The reading is finished. Answer the multiple choice, true or false, and matching questions. The system marks them and issues the certificate when the score reaches {lesson.passMark}%.</p>
      {lesson.mark && (
        <div className={lesson.mark.passed ? 'form-success' : 'form-error'} role="status">
          <p>Mark: {lesson.mark.correct} of {lesson.mark.total} correct · {lesson.mark.percentage}%. Pass mark {lesson.passMark}%.</p>
          {lesson.mark.items.map((item) => (
            <p key={item.prompt}>{item.correct ? 'Correct' : 'Not correct'} — {item.prompt}</p>
          ))}
          {!lesson.mark.passed && lesson.quiz.length > 0 && <p>Answer the questions again.</p>}
        </div>
      )}
      {missing && <p className="form-error" role="alert">{missing}</p>}
      {lesson.quiz.map((question, index) => (
        <fieldset key={question.id} className="quiz-question">
          <legend>{KIND_LABEL[question.kind]} · {index + 1}</legend>
          <p>{question.prompt}</p>
          {question.kind === 'MULTIPLE_CHOICE' && question.options.map((option) => (
            <label key={option} className="quiz-option">
              <input type="radio" name={question.id} checked={choice[question.id] === option} onChange={() => setChoice((current) => ({ ...current, [question.id]: option }))} />
              <span>{option}</span>
            </label>
          ))}
          {question.kind === 'TRUE_FALSE' && (
            <div className="quiz-options">
              <label className="quiz-option"><input type="radio" name={question.id} checked={truth[question.id] === true} onChange={() => setTruth((current) => ({ ...current, [question.id]: true }))} /> True</label>
              <label className="quiz-option"><input type="radio" name={question.id} checked={truth[question.id] === false} onChange={() => setTruth((current) => ({ ...current, [question.id]: false }))} /> False</label>
            </div>
          )}
          {question.kind === 'MATCHING' && question.left.map((left, leftIndex) => (
            <label key={left} className="quiz-match">
              <span>{left}</span>
              <select
                value={matches[question.id]?.[leftIndex] ?? ''}
                onChange={(event) => setMatches((current) => {
                  const next = [...(current[question.id] ?? question.left.map(() => ''))]
                  next[leftIndex] = event.target.value
                  return { ...current, [question.id]: next }
                })}
              >
                <option value="">Choose the match</option>
                {question.right.map((right) => <option key={right} value={right}>{right}</option>)}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
      {lesson.quiz.length > 0 && <button className="button primary" type="submit" disabled={busy}>Submit for marking</button>}
    </form>
  )
}

function answerFor(
  question: QuizQuestion,
  choice: Record<string, string>,
  truth: Record<string, boolean | undefined>,
  matches: Record<string, string[]>,
) {
  if (question.kind === 'MULTIPLE_CHOICE') return { id: question.id, choice: choice[question.id] }
  if (question.kind === 'TRUE_FALSE') return { id: question.id, value: truth[question.id] }
  return { id: question.id, matches: matches[question.id] ?? [] }
}

function answered(answer: { choice?: string; value?: boolean; matches?: string[] }) {
  if (answer.choice) return true
  if (typeof answer.value === 'boolean') return true
  return Boolean(answer.matches?.length && answer.matches.every((item) => item.length > 0))
}
