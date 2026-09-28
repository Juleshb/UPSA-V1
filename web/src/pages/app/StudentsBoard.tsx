import { useState, type FormEvent } from 'react'
import { api, type StudentRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, FieldGroup, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, SearchSelect, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'create' } | { type: 'view' | 'edit' | 'delete'; record: StudentRow }

export function StudentsBoard() {
  usePageTitle('Students — UPSA Next Payment')
  const { can } = useAuth()
  const students = useLoad(() => api.students.list())
  const schools = useLoad(() => can('school.read') ? api.schools.list() : Promise.resolve({ items: [] }))
  const schoolName = (id: string) => schools.data?.items.find((school) => school.schoolId === id)?.schoolName ?? id
  const firstId = students.data?.items[0]?.studentId
  const summary = useLoad(
    () => firstId ? api.students.summary(firstId) : Promise.resolve(null),
    [firstId],
  )
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mode && mode.type !== 'create' ? mode.record : null
  const visible = (students.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.studentName, item.studentExternalId, schoolName(item.schoolId), item.classLevel, item.academicYear, item.status, item.feeCategory),
  )

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.students.create({
        schoolId: String(form.get('schoolId')),
        studentName: String(form.get('studentName')),
        studentExternalId: String(form.get('studentExternalId')),
        classLevel: String(form.get('classLevel')),
        academicYear: String(form.get('academicYear')),
        feeCategory: String(form.get('feeCategory') || '') || undefined,
      })
      setMode(null)
      students.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the student.')
    } finally {
      setBusy(false)
    }
  }

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.students.update(selected.studentId, {
        studentName: String(form.get('studentName')),
        studentExternalId: String(form.get('studentExternalId')),
        classLevel: String(form.get('classLevel')),
        academicYear: String(form.get('academicYear')),
        feeCategory: String(form.get('feeCategory') || ''),
        status: String(form.get('status')),
      })
      setMode(null)
      students.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the student.')
    } finally {
      setBusy(false)
    }
  }

  async function onDeactivate() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await api.students.remove(selected.studentId)
      setMode(null)
      students.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deactivate the student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Families"
        title="Students"
        lead="School relationship, class and the authoritative financial account."
        icon="family"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search students…" />
            {can('student.write') && <button className="button primary" type="button" onClick={() => setMode({ type: 'create' })}>Add student</button>}
          </>
        )}
      />
      {(students.error || error) && <Banner>{students.error || error}</Banner>}
      {summary.data && (
        <div className="app-stats">
          <Stat icon="ledger" label="Billed" value={money(summary.data.totalBilled)} />
          <Stat icon="pay" label="Paid" value={money(summary.data.totalPaid)} />
          <Stat icon="ledger" label="Outstanding" value={money(summary.data.outstanding)} />
        </div>
      )}
      <Panel icon="family" title="Roll">
        {students.loading ? <p className="app-empty">Loading students…</p> : (
          <Table
            columns={['Student', 'School', 'Class', 'Year', 'Status', 'Actions']}
            empty={query ? 'No students match that search.' : 'No students found.'}
            rows={visible.map((item) => [
              item.studentName,
              schoolName(item.schoolId),
              item.classLevel,
              item.academicYear,
              <StatusPill key={item.studentId} value={item.status} />,
              <RowActions key={`${item.studentId}-actions`}>
                <button type="button" onClick={() => setMode({ type: 'view', record: item })}>View</button>
                {can('student.write') && <button type="button" onClick={() => setMode({ type: 'edit', record: item })}>Edit</button>}
                {can('student.write') && item.status !== 'INACTIVE' && <button type="button" className="danger" onClick={() => setMode({ type: 'delete', record: item })}>Deactivate</button>}
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <Modal size="wide" open={mode?.type === 'create'} title="Add student" onClose={() => setMode(null)} footer={<button className="button primary" form="student-create" disabled={busy}>{busy ? 'Saving…' : 'Create student'}</button>}>
        <form id="student-create" className="app-form" onSubmit={onCreate}>
          <FieldGroup title="Student">
            <Field label="Student name" span="full">
              <input name="studentName" required placeholder="Aline Mukamana" />
            </Field>
            <Field label="School" span="full" hint="Search the member school">
              <SearchSelect
                name="schoolId"
                required
                placeholder="Search schools…"
                defaultValue={schools.data?.items[0]?.schoolId}
                options={(schools.data?.items ?? []).map((school) => ({
                  value: school.schoolId,
                  label: school.schoolName,
                  hint: `${school.address.district}, ${school.address.province}`,
                }))}
              />
            </Field>
            <Field label="External ID">
              <input name="studentExternalId" required placeholder="STD-2026-001" />
            </Field>
            <Field label="Class">
              <input name="classLevel" required placeholder="S3" />
            </Field>
            <Field label="Academic year">
              <input name="academicYear" required placeholder="2026" />
            </Field>
            <Field label="Fee category">
              <input name="feeCategory" placeholder="Boarding" />
            </Field>
          </FieldGroup>
        </form>
      </Modal>

      <Modal open={mode?.type === 'view'} title="Student record" onClose={() => setMode(null)}>
        {selected && (
          <dl className="app-dl">
            <div><dt>Name</dt><dd>{selected.studentName}</dd></div>
            <div><dt>Student ID</dt><dd>{selected.studentId}</dd></div>
            <div><dt>External ID</dt><dd>{selected.studentExternalId}</dd></div>
            <div><dt>School</dt><dd>{schoolName(selected.schoolId)}</dd></div>
            <div><dt>Class</dt><dd>{selected.classLevel}</dd></div>
            <div><dt>Year</dt><dd>{selected.academicYear}</dd></div>
            <div><dt>Status</dt><dd><StatusPill value={selected.status} /></dd></div>
          </dl>
        )}
      </Modal>

      <Modal open={mode?.type === 'edit'} title="Edit student" onClose={() => setMode(null)} footer={<button className="button primary" form="student-edit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}>
        {selected && (
          <form id="student-edit" className="app-form" onSubmit={onEdit}>
            <Field label="Student name" span="full">
              <input name="studentName" required defaultValue={selected.studentName} />
            </Field>
            <Field label="External ID">
              <input name="studentExternalId" required defaultValue={selected.studentExternalId} />
            </Field>
            <Field label="Class">
              <input name="classLevel" required defaultValue={selected.classLevel} />
            </Field>
            <Field label="Academic year">
              <input name="academicYear" required defaultValue={selected.academicYear} />
            </Field>
            <Field label="Fee category">
              <input name="feeCategory" defaultValue={selected.feeCategory ?? ''} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={selected.status}>
                {['ACTIVE', 'INACTIVE', 'GRADUATED'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={mode?.type === 'delete'}
        title="Deactivate student"
        onClose={() => setMode(null)}
        footer={(
          <>
            <button className="button secondary" type="button" onClick={() => setMode(null)}>Keep active</button>
            <button className="button primary" type="button" disabled={busy} onClick={onDeactivate}>{busy ? 'Updating…' : 'Deactivate'}</button>
          </>
        )}
      >
        <p className="app-empty">{selected?.studentName} will be marked inactive. Invoices already issued stay on the ledger.</p>
      </Modal>
    </div>
  )
}
