import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { onSubmit, useAction } from '../donations/kit'
import { COLLATERAL_TYPES, VERIFY_RESULTS, checked, num, str, today } from './catalog'

export function CollateralList() {
  usePageTitle('Collateral — UPSA Next Payment')
  const data = useLoad(() => api.escrow.collateral())
  return (
    <>
      <PageHeading kicker="Collateral" title="Group collateral" lead="Eligible value is market value times the eligible share, minus an existing encumbrance. A deposit already held in escrow is not counted again." icon="shield" actions={<Link className="button primary" to="/app/escrow/collateral/new">Register collateral</Link>} />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Asset', 'Group', 'Type', 'Market', 'Eligible', 'Status']}
        empty="No collateral is registered."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.collateralId} to={`/app/escrow/collateral/${item.collateralId}`}>{item.description}</Link>,
          item.groupName,
          item.collateralType,
          money(item.marketValue),
          item.countsAsCollateral ? money(item.eligibleValue) : 'Held in escrow',
          <StatusPill key={`${item.collateralId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

export function CollateralForm() {
  usePageTitle('Register collateral — UPSA Next Payment')
  const navigate = useNavigate()
  const groups = useLoad(() => api.escrow.groups())
  const accounts = useLoad(() => api.escrow.accounts())
  const action = useAction()
  return (
    <>
      <PageHeading kicker="Collateral" title="Register group collateral" lead="Link the asset to a group. If the type is a deposit and you link an escrow account, the cash is not also counted as collateral." icon="shield" />
      <form className="app-form" onSubmit={onSubmit((event) => {
        const form = new FormData(event.currentTarget)
        action.run(async () => {
          const created = await api.escrow.registerAsset({
            groupId: str(form, 'groupId'),
            accountId: str(form, 'accountId') || undefined,
            collateralType: str(form, 'collateralType'),
            description: str(form, 'description'),
            owner: str(form, 'owner'),
            coOwners: str(form, 'coOwners'),
            ownershipPercent: num(form, 'ownershipPercent'),
            location: str(form, 'location'),
            registrationNumber: str(form, 'registrationNumber'),
            marketValue: num(form, 'marketValue'),
            forcedSaleValue: num(form, 'forcedSaleValue'),
            haircutPercent: num(form, 'haircutPercent'),
            valuer: str(form, 'valuer'),
            ownershipDocument: str(form, 'ownershipDocument'),
            insurance: str(form, 'insurance'),
            encumbrance: num(form, 'encumbrance'),
            securityRegistration: str(form, 'securityRegistration'),
          })
          navigate(`/app/escrow/collateral/${created.collateralId}`)
        })
      })}>
        <Field label="Group"><select name="groupId" required><option value="">Choose</option>{(groups.data?.items ?? []).map((group) => <option key={group.groupId} value={group.groupId}>{group.name}</option>)}</select></Field>
        <Field label="Escrow account" hint="Link a deposit only when the cash is already in escrow."><select name="accountId"><option value="">None</option>{(accounts.data?.items ?? []).map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></Field>
        <Field label="Collateral type"><select name="collateralType">{COLLATERAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Description"><input name="description" required /></Field>
        <Field label="Owner"><input name="owner" required /></Field>
        <Field label="Co-owners" hint="optional"><input name="coOwners" /></Field>
        <Field label="Ownership percentage"><input name="ownershipPercent" type="number" min="0" max="100" defaultValue="100" /></Field>
        <Field label="Location" hint="optional"><input name="location" /></Field>
        <Field label="Registration number" hint="optional"><input name="registrationNumber" /></Field>
        <Field label="Market value"><input name="marketValue" type="number" min="0" step="0.01" required /></Field>
        <Field label="Forced sale value"><input name="forcedSaleValue" type="number" min="0" step="0.01" required /></Field>
        <Field label="Eligible share %" hint="Eligible value = market value × this share, minus encumbrance."><input name="haircutPercent" type="number" min="0" max="100" defaultValue="80" /></Field>
        <Field label="Encumbrance"><input name="encumbrance" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Valuer" hint="optional"><input name="valuer" /></Field>
        <Field label="Ownership document" hint="optional"><input name="ownershipDocument" /></Field>
        <Field label="Insurance" hint="optional"><input name="insurance" /></Field>
        <Field label="Security registration" hint="optional"><input name="securityRegistration" /></Field>
        {action.error && <p className="form-error">{action.error}</p>}
        <button className="button primary" type="submit" disabled={action.busy}>Register collateral</button>
      </form>
    </>
  )
}

export function CollateralFilePage() {
  usePageTitle('Collateral file — UPSA Next Payment')
  const { assetId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.escrow.asset(assetId), [assetId])
  const action = useAction()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the collateral.</p>
  const write = can('guarantee.write')
  return (
    <>
      <PageHeading kicker="Collateral" title={String(file.description)} lead={`${file.collateralType} · ${file.owner}`} icon="shield" />
      <p><StatusPill value={String(file.status)} /> Eligible {file.countsAsCollateral ? money(Number(file.eligibleValue)) : 'not counted, because this cash is already in escrow'}</p>
      <p>Market {money(Number(file.marketValue))} · Forced sale {money(Number(file.forcedSaleValue))} · Eligible share {String(file.haircutPercent)}%</p>
      {action.error && <p className="form-error">{action.error}</p>}
      {write && (
        <>
          <Panel title="Verification" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.escrow.verifyAsset(assetId, {
                  ownershipVerified: checked(form, 'ownershipVerified'),
                  registrationVerified: checked(form, 'registrationVerified'),
                  physicalVerification: checked(form, 'physicalVerification'),
                  lienCheck: checked(form, 'lienCheck'),
                  insuranceVerified: checked(form, 'insuranceVerified'),
                  valuationVerified: checked(form, 'valuationVerified'),
                  legalVerified: checked(form, 'legalVerified'),
                  result: str(form, 'result'),
                  verificationDate: str(form, 'verificationDate'),
                  comments: str(form, 'comments'),
                })
                data.reload()
              })
            })}>
              {['ownershipVerified', 'registrationVerified', 'physicalVerification', 'lienCheck', 'insuranceVerified', 'valuationVerified', 'legalVerified'].map((name) => (
                <label key={name} className="app-check"><input name={name} type="checkbox" /> {name.replaceAll(/([A-Z])/g, ' $1')}</label>
              ))}
              <Field label="Result"><select name="result">{VERIFY_RESULTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Date"><input name="verificationDate" type="date" defaultValue={today()} required /></Field>
              <Field label="Comments" hint="optional"><input name="comments" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Save verification</button>
            </form>
          </Panel>
          <Panel title="Valuation" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.escrow.valueAsset(assetId, {
                  marketValue: num(form, 'marketValue'),
                  forcedSaleValue: num(form, 'forcedSaleValue'),
                  approvedValue: num(form, 'approvedValue'),
                  method: str(form, 'method'),
                  valuer: str(form, 'valuer'),
                  valuerRegistration: str(form, 'valuerRegistration'),
                  valuationDate: str(form, 'valuationDate'),
                  reviewDate: str(form, 'reviewDate') || undefined,
                  comments: str(form, 'comments'),
                })
                data.reload()
              })
            })}>
              <Field label="Market value"><input name="marketValue" type="number" min="0" step="0.01" required /></Field>
              <Field label="Forced sale value"><input name="forcedSaleValue" type="number" min="0" step="0.01" required /></Field>
              <Field label="Approved value"><input name="approvedValue" type="number" min="0" step="0.01" required /></Field>
              <Field label="Method"><input name="method" required defaultValue="Market comparison" /></Field>
              <Field label="Valuer"><input name="valuer" required /></Field>
              <Field label="Valuer registration" hint="optional"><input name="valuerRegistration" /></Field>
              <Field label="Valuation date"><input name="valuationDate" type="date" defaultValue={today()} required /></Field>
              <Field label="Review date" hint="optional"><input name="reviewDate" type="date" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Save valuation</button>
            </form>
          </Panel>
          <div className="app-inline-actions">
            <button className="button secondary" type="button" disabled={action.busy} onClick={() => action.run(async () => { await api.escrow.markAsset(assetId, 'REGISTERED'); data.reload() })}>Mark registered</button>
            <button className="button secondary" type="button" disabled={action.busy} onClick={() => action.run(async () => { await api.escrow.markAsset(assetId, 'ACTIVE'); data.reload() })}>Mark active</button>
          </div>
        </>
      )}
    </>
  )
}
