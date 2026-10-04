import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { FormSteps, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { GROUP_TYPES, checked, num, str, today } from './catalog'

export function GroupList() {
  usePageTitle('Groups — UPSA Next Payment')
  const data = useLoad(() => api.escrow.groups())
  return (
    <>
      <PageHeading kicker="Groups" title="Group register" lead="A group links existing schools. It does not create a second school record." icon="school" actions={<Link className="button primary" to="/app/escrow/groups/new">Register a group</Link>} />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Group', 'Type', 'School', 'Members', 'Accounts', 'Status']}
        empty="No group is registered yet."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.groupId} to={`/app/escrow/groups/${item.groupId}`}>{item.name}</Link>,
          item.groupType.replaceAll('_', ' '),
          item.schoolName ?? '—',
          item.members,
          item.accounts,
          <StatusPill key={`${item.groupId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

const STEPS = ['Group', 'Officers', 'School']

export function GroupForm() {
  usePageTitle('Register a group — UPSA Next Payment')
  const navigate = useNavigate()
  const schools = useLoad(() => api.schools.list())
  const form = useFormSteps()
  const action = useAction()
  return (
    <>
      <PageHeading kicker="Groups" title="Register a group" lead="Record the group, its officers and the member school already on the platform." icon="school" />
      <form className="form-wizard" onSubmit={onSubmit((event) => {
        const values = Object.fromEntries(Object.entries(form.collect(event.currentTarget)).filter(([, value]) => value !== ''))
        action.run(async () => {
          const created = await api.escrow.createGroup({
            name: values.name,
            groupType: values.groupType,
            registrationNumber: values.registrationNumber,
            formationDate: values.formationDate,
            purpose: values.purpose,
            address: values.address,
            district: values.district,
            sector: values.sector,
            contact: values.contact,
            chairperson: values.chairperson,
            secretary: values.secretary,
            treasurer: values.treasurer,
            representatives: values.representatives,
            schoolId: values.schoolId || undefined,
          })
          navigate(`/app/escrow/groups/${created.groupId}`)
        })
      })}>
        <FormSteps steps={STEPS} step={form.step} onPick={(index) => form.move(document.querySelector('.form-wizard') as HTMLFormElement, index, STEPS.length)} />
        {form.step === 0 && (
          <div className="app-form">
            <Field label="Group name"><input name="name" defaultValue={kept(form.values, 'name')} required /></Field>
            <Field label="Group type"><select name="groupType" defaultValue={kept(form.values, 'groupType', 'SCHOOL_GROUP')}>{GROUP_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Registration number" hint="optional"><input name="registrationNumber" defaultValue={kept(form.values, 'registrationNumber')} /></Field>
            <Field label="Formation date" hint="optional"><input name="formationDate" type="date" defaultValue={kept(form.values, 'formationDate', today())} /></Field>
            <Field label="Purpose"><textarea name="purpose" defaultValue={kept(form.values, 'purpose')} required /></Field>
            <Field label="Address" hint="optional"><input name="address" defaultValue={kept(form.values, 'address')} /></Field>
            <Field label="District" hint="optional"><input name="district" defaultValue={kept(form.values, 'district')} /></Field>
            <Field label="Sector" hint="optional"><input name="sector" defaultValue={kept(form.values, 'sector')} /></Field>
            <Field label="Contact" hint="optional"><input name="contact" defaultValue={kept(form.values, 'contact')} /></Field>
          </div>
        )}
        {form.step === 1 && (
          <div className="app-form">
            <Field label="Chairperson" hint="optional"><input name="chairperson" defaultValue={kept(form.values, 'chairperson')} /></Field>
            <Field label="Secretary" hint="optional"><input name="secretary" defaultValue={kept(form.values, 'secretary')} /></Field>
            <Field label="Treasurer" hint="optional"><input name="treasurer" defaultValue={kept(form.values, 'treasurer')} /></Field>
            <Field label="Authorized representatives" hint="optional"><textarea name="representatives" defaultValue={kept(form.values, 'representatives')} /></Field>
          </div>
        )}
        {form.step === 2 && (
          <div className="app-form">
            <Field label="Member school" hint="optional">
              <select name="schoolId" defaultValue={kept(form.values, 'schoolId')}>
                <option value="">No school link yet</option>
                {(schools.data?.items ?? []).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}
              </select>
            </Field>
          </div>
        )}
        {action.error && <p className="form-error">{action.error}</p>}
        <StepNav step={form.step} count={STEPS.length} busy={action.busy} submitLabel="Register group" onBack={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step - 1, STEPS.length)} onNext={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step + 1, STEPS.length)} />
      </form>
    </>
  )
}

export function GroupFilePage() {
  usePageTitle('Group — UPSA Next Payment')
  const { groupId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.escrow.group(groupId), [groupId])
  const exposure = useLoad(() => api.escrow.exposure(groupId), [groupId])
  const schools = useLoad(() => api.schools.list())
  const action = useAction()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the group.</p>
  const members = (file.members as { memberId: string; name: string; memberType: string; schoolName: string | null; status: string }[]) ?? []
  return (
    <>
      <PageHeading kicker="Group" title={String(file.name)} lead={String(file.purpose)} icon="school" />
      <div className="app-stats">
        <p><b>Members</b> {String(file.memberCount)}</p>
        <p><b>School</b> {String(file.schoolName ?? '—')}</p>
        <p><b>Exposure</b> {money(Number(exposure.data?.guaranteeExposure ?? 0))}</p>
        <p><b>Escrow available</b> {money(Number(exposure.data?.availableEscrow ?? 0))}</p>
        <p><b>Collateral</b> {money(Number(exposure.data?.eligibleCollateral ?? 0))}</p>
        <p><b>Coverage</b> {String(exposure.data?.coverageRatio ?? 0)}%</p>
      </div>
      <Panel title="Members" wide>
        <Table columns={['Member', 'Type', 'School', 'Status']} empty="Add the first member." rows={members.map((item) => [item.name, item.memberType, item.schoolName ?? '—', item.status])} />
      </Panel>
      {can('guarantee.write') && (
        <Panel title="Add a member" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const node = event.currentTarget
            const form = new FormData(node)
            action.run(async () => {
              await api.escrow.addMember(groupId, {
                memberType: str(form, 'memberType'),
                name: str(form, 'name'),
                schoolId: str(form, 'schoolId') || undefined,
                contributionPercent: num(form, 'contributionPercent'),
                contributionAmount: num(form, 'contributionAmount'),
                votingRights: checked(form, 'votingRights'),
                guaranteeParticipation: checked(form, 'guaranteeParticipation'),
                collateralParticipation: checked(form, 'collateralParticipation'),
              })
              data.reload()
              node.reset()
            })
          })}>
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Member type"><select name="memberType"><option>SCHOOL</option><option>INDIVIDUAL</option><option>BUSINESS</option></select></Field>
            <Field label="School" hint="optional"><select name="schoolId"><option value="">None</option>{(schools.data?.items ?? []).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></Field>
            <Field label="Contribution percentage"><input name="contributionPercent" type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <Field label="Contribution amount"><input name="contributionAmount" type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <label className="app-check"><input name="votingRights" type="checkbox" defaultChecked /> Voting rights</label>
            <label className="app-check"><input name="guaranteeParticipation" type="checkbox" defaultChecked /> Guarantee participation</label>
            <label className="app-check"><input name="collateralParticipation" type="checkbox" defaultChecked /> Collateral participation</label>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Save member</button>
          </form>
        </Panel>
      )}
    </>
  )
}
