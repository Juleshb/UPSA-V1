import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { api, type FamilyInvoice, type FamilySchool, type PaymentChannel, type StudentPreview } from '../api'
import { Button, Eyebrow, Field, Notice, Screen, Sheet, Steps } from '../components/ui'
import { useFamily } from '../family'
import { channelLabel, money, shortDate, statusLabel } from '../format'
import type { RootStackParamList } from '../navigation'
import { useSession } from '../session'
import { theme } from '../theme'

type Props = NativeStackScreenProps<RootStackParamList, 'AccountSection'>
type Section = Props['route']['params']['section']

const TITLES: Record<Section, string> = {
  authorization: 'Authorization',
  identity: 'Identity',
  contact: 'Contact',
  link: 'Link a student',
  preferences: 'Preferences',
  notices: 'Notices',
}

const RELATIONSHIPS = [
  { code: 'MOTHER', label: 'Mother' },
  { code: 'FATHER', label: 'Father' },
  { code: 'GUARDIAN', label: 'Guardian' },
] as const

const CHANNELS: PaymentChannel[] = ['MOBILE_PAYMENT', 'BANK', 'CARD', 'PSP']

const ORIGINS = [
  { code: 'RW', label: 'Rwanda' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'UG', label: 'Uganda' },
  { code: 'KE', label: 'Kenya' },
  { code: 'BI', label: 'Burundi' },
  { code: 'SS', label: 'South Sudan' },
  { code: 'CD', label: 'DRC' },
] as const

const NOTICES = [
  { code: 'IN_APP', label: 'In the app' },
  { code: 'EMAIL', label: 'Email' },
  { code: 'SMS', label: 'SMS' },
] as const

export function AccountSectionScreen({ navigation, route }: Props) {
  const section = route.params.section
  const { user } = useSession()
  const { family, refresh, markNoticesRead } = useFamily()
  const guardian = family?.guardian
  const [phone, setPhone] = useState(guardian?.phone ?? '')
  const [email, setEmail] = useState(guardian?.email ?? user?.email ?? '')
  const [nationalId, setNationalId] = useState('')
  const [schools, setSchools] = useState<FamilySchool[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [reference, setReference] = useState('')
  const [studentName, setStudentName] = useState('')
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]['code']>('GUARDIAN')
  const [channel, setChannel] = useState<PaymentChannel>(family?.preferences.paymentChannel ?? 'MOBILE_PAYMENT')
  const [origin, setOrigin] = useState(family?.preferences.originCountry ?? 'RW')
  const [notify, setNotify] = useState(family?.preferences.notifyChannel ?? 'IN_APP')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [identityStep, setIdentityStep] = useState(0)
  const [linkStep, setLinkStep] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({ title: TITLES[section] })
  }, [navigation, section])

  useEffect(() => {
    setPhone(guardian?.phone ?? '')
    setEmail(guardian?.email ?? user?.email ?? '')
    if (family?.preferences.paymentChannel) setChannel(family.preferences.paymentChannel)
    if (family?.preferences.originCountry) setOrigin(family.preferences.originCountry)
    if (family?.preferences.notifyChannel) setNotify(family.preferences.notifyChannel)
  }, [guardian?.phone, guardian?.email, user?.email, family?.preferences])

  useEffect(() => {
    if (section !== 'link') return
    void api.parent.schools().then((result) => {
      setSchools(result.items)
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Schools could not be loaded.')
    })
  }, [section])

  const unreadIds = family?.notifications.filter((item) => !item.read).map((item) => item.notificationId) ?? []
  const unreadRef = useRef(unreadIds)
  unreadRef.current = unreadIds
  useFocusEffect(useCallback(() => {
    if (section !== 'notices') return undefined
    const markOpen = setTimeout(() => {
      const ids = unreadRef.current
      if (ids.length > 0) void markNoticesRead(ids)
    }, 700)
    return () => {
      clearTimeout(markOpen)
      const ids = unreadRef.current
      if (ids.length > 0) void markNoticesRead(ids)
    }
  }, [section, markNoticesRead]))

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen inset={false}>
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      {section === 'authorization' ? (
        <Authorization
          active={Boolean(family?.authorization)}
          until={family?.authorization ? shortDate(family.authorization.expiresAt) : ''}
          available={family?.childRecords === 'AVAILABLE'}
          confirm={confirmWithdraw}
          busy={busy}
          onWithdraw={() => {
            if (!confirmWithdraw) {
              setConfirmWithdraw(true)
              setMessage('Withdrawing hides school and fee records on this account.')
              return
            }
            void run(async () => {
              await api.parent.withdrawAuthorization()
              setConfirmWithdraw(false)
              setMessage('Authorization withdrawn. Children’s records are hidden.')
            })
          }}
          onGrant={() => void run(async () => {
            await api.parent.grantAuthorization()
            setMessage('Authorization is active. Linked students can appear on this account.')
          })}
        />
      ) : null}
      {section === 'identity' ? (
        <IdentitySteps
          step={identityStep}
          status={identityLabel(family?.identity.status ?? 'NOT_SUBMITTED')}
          mask={family?.identity.nationalIdMask ?? 'Not submitted'}
          reference={guardian?.guardianId || 'Not linked'}
          nationalId={nationalId}
          onChangeId={setNationalId}
          busy={busy}
          onBack={() => { setError(''); setIdentityStep((value) => Math.max(0, value - 1)) }}
          onNext={() => {
            if (identityStep === 1 && !/^\d{16}$/.test(nationalId)) {
              setError('Enter the 16-digit national ID number.')
              return
            }
            setError('')
            setIdentityStep((value) => Math.min(2, value + 1))
          }}
          onSubmit={() => void run(async () => {
            await api.parent.submitIdentity(nationalId)
            setNationalId('')
            setIdentityStep(0)
            setMessage('Identity submitted. It stays pending until it is reviewed.')
          })}
        />
      ) : null}
      {section === 'contact' ? (
        <>
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Button
            label="Save contact"
            busy={busy}
            onPress={() => void run(async () => {
              await api.parent.updateContact({ email, phone })
              setMessage('Contact details saved.')
            })}
          />
        </>
      ) : null}
      {section === 'link' ? (
        <LinkSteps
          step={linkStep}
          schools={schools}
          schoolId={schoolId}
          onSchool={setSchoolId}
          reference={reference}
          onReference={setReference}
          studentName={studentName}
          onStudentName={setStudentName}
          relationship={relationship}
          onRelationship={setRelationship}
          busy={busy}
          onBack={() => { setError(''); setLinkStep((value) => Math.max(0, value - 1)) }}
          onNext={() => {
            if (linkStep === 0 && !schoolId) {
              setError('Choose the school that holds this student.')
              return
            }
            if (linkStep === 1 && studentName.trim().length < 3) {
              setError('Enter a student number that matches a school record.')
              return
            }
            setError('')
            setLinkStep((value) => Math.min(2, value + 1))
          }}
          onSubmit={() => void (async () => {
            setBusy(true)
            setError('')
            setMessage('')
            try {
              const linked = await api.parent.linkStudent({
                schoolId,
                studentReference: reference,
                studentName,
                relationship,
              })
              await refresh()
              navigation.navigate('Main', {
                screen: 'Home',
                params: {
                  notice: `Link completed. ${linked.studentName} at ${linked.schoolName} is now on your account.`,
                  studentId: linked.studentId,
                },
              })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'That could not be saved.')
            } finally {
              setBusy(false)
            }
          })()}
        />
      ) : null}
      {section === 'preferences' ? (
        <>
          <Text style={styles.note}>These choices are selected the next time you pay. You can still change them on the payment.</Text>
          <Eyebrow>Rail</Eyebrow>
          <View style={styles.chips}>
            {CHANNELS.map((item) => (
              <Pressable key={item} accessibilityRole="button" onPress={() => setChannel(item)} style={[styles.chip, channel === item && styles.chipOn]}>
                <Text style={[styles.chipLabel, channel === item && styles.chipLabelOn]}>{channelLabel(item)}</Text>
              </Pressable>
            ))}
          </View>
          <Eyebrow>Country</Eyebrow>
          <View style={styles.chips}>
            {ORIGINS.map((item) => (
              <Pressable key={item.code} accessibilityRole="button" onPress={() => setOrigin(item.code)} style={[styles.chip, origin === item.code && styles.chipOn]}>
                <Text style={[styles.chipLabel, origin === item.code && styles.chipLabelOn]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Eyebrow>Notices</Eyebrow>
          <View style={styles.chips}>
            {NOTICES.map((item) => (
              <Pressable key={item.code} accessibilityRole="button" onPress={() => setNotify(item.code)} style={[styles.chip, notify === item.code && styles.chipOn]}>
                <Text style={[styles.chipLabel, notify === item.code && styles.chipLabelOn]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="Save preferences"
            busy={busy}
            onPress={() => void run(async () => {
              await api.parent.updatePreferences({ paymentChannel: channel, originCountry: origin, notifyChannel: notify })
              setMessage('Payment preferences saved.')
            })}
          />
        </>
      ) : null}
      {section === 'notices' ? (
        <Sheet>
          {(family?.notifications.length ?? 0) === 0 ? <Text style={styles.empty}>No notices yet.</Text> : family?.notifications.map((notice, index) => (
            <View key={notice.notificationId} style={[styles.notice, index > 0 && styles.line]}>
              <View style={styles.noticeHead}>
                {!notice.read ? <View style={styles.unreadDot} /> : null}
                <Text style={styles.choiceTitle}>{notice.subject}</Text>
              </View>
              <Text style={styles.choiceMeta}>{notice.body}</Text>
              <Text style={styles.choiceMeta}>{shortDate(notice.createdAt)}</Text>
            </View>
          ))}
        </Sheet>
      ) : null}
    </Screen>
  )
}

function IdentitySteps({
  step,
  status,
  mask,
  reference,
  nationalId,
  onChangeId,
  busy,
  onBack,
  onNext,
  onSubmit,
}: {
  step: number
  status: string
  mask: string
  reference: string
  nationalId: string
  onChangeId: (value: string) => void
  busy: boolean
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  return (
    <>
      <Steps labels={['Record', 'Identity', 'Review']} index={step} />
      <Sheet>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{step === 0 ? 'Your record' : step === 1 ? 'National ID' : 'Review and send'}</Text>
          <Text style={styles.note}>
            {step === 0
              ? 'This is the identity held on your parent account. The next step asks for the 16-digit national ID.'
              : step === 1
                ? 'Enter the number exactly as it appears on the identity card. It is stored masked after you send it.'
                : 'Check the number, then send it for review. The account stays pending until it is verified.'}
          </Text>
          {step === 0 ? (
            <>
              <Info label="Status" value={status} first />
              <Info label="National ID" value={mask} />
              <Info label="Reference" value={reference} />
            </>
          ) : null}
          {step === 1 ? (
            <Field label="National ID" keyboardType="number-pad" value={nationalId} onChangeText={onChangeId} placeholder="16 digits" />
          ) : null}
          {step === 2 ? (
            <>
              <Info label="Number" value={nationalId.replace(/(\d{4})(?=\d)/g, '$1 ')} first />
              <Info label="Current status" value={status} />
            </>
          ) : null}
        </View>
      </Sheet>
      <View style={styles.actions}>
        {step > 0 ? <View style={styles.action}><Button label="Back" tone="secondary" onPress={onBack} /></View> : null}
        <View style={styles.action}>
          {step < 2 ? (
            <Button label="Continue" onPress={onNext} />
          ) : (
            <Button label="Submit for verification" busy={busy} onPress={onSubmit} />
          )}
        </View>
      </View>
    </>
  )
}

function LinkSteps({
  step,
  schools,
  schoolId,
  onSchool,
  reference,
  onReference,
  studentName,
  onStudentName,
  relationship,
  onRelationship,
  busy,
  onBack,
  onNext,
  onSubmit,
}: {
  step: number
  schools: { schoolId: string; schoolName: string; schoolCode?: string; district: string }[]
  schoolId: string
  onSchool: (id: string) => void
  reference: string
  onReference: (value: string) => void
  studentName: string
  onStudentName: (value: string) => void
  relationship: (typeof RELATIONSHIPS)[number]['code']
  onRelationship: (value: (typeof RELATIONSHIPS)[number]['code']) => void
  busy: boolean
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState<StudentPreview | null>(null)
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'miss'>('idle')
  const relation = RELATIONSHIPS.find((item) => item.code === relationship)?.label ?? 'Guardian'
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? schools.filter((item) => [item.schoolName, item.schoolCode, item.schoolId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle))
    : schools

  useEffect(() => {
    const studentNumber = reference.trim()
    if (!schoolId || studentNumber.length < 3) {
      setProfile(null)
      setLookup('idle')
      return
    }
    if (step !== 1) return
    let cancelled = false
    setProfile(null)
    setLookup('loading')
    const timer = setTimeout(() => {
      void api.parent.lookupStudent(schoolId, studentNumber).then((result) => {
        if (cancelled) return
        setProfile(result)
        onStudentName(result.studentName)
        setLookup('idle')
      }).catch(() => {
        if (cancelled) return
        setProfile(null)
        onStudentName('')
        setLookup('miss')
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reference, schoolId, step, onStudentName])

  return (
    <>
      <Steps labels={['School', 'Student', 'Confirm']} index={step} />
      <Sheet>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{step === 0 ? 'Choose the school' : step === 1 ? 'Student details' : 'Confirm the link'}</Text>
          <Text style={styles.note}>
            {step === 0
              ? 'Search by the school name or school code, then choose the one that issued the student number.'
              : step === 1
                ? 'Enter the student number. The school record appears when it matches.'
                : 'Check this is the right student, then link them to your account.'}
          </Text>
          {step === 0 ? (
            <>
              <Field label="Find a school" value={query} onChangeText={setQuery} placeholder="Name or school code" autoCapitalize="none" autoCorrect={false} />
              {matches.length === 0 ? (
                <Text style={styles.empty}>No school matches that name or code.</Text>
              ) : matches.map((item, index) => {
                const active = item.schoolId === schoolId
                return (
                  <Pressable
                    key={item.schoolId}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => onSchool(item.schoolId)}
                    style={[styles.choice, index > 0 && styles.line, active && styles.choiceOn]}
                  >
                    <View style={styles.choiceCopy}>
                      <Text style={styles.choiceTitle}>{item.schoolName}</Text>
                      <Text style={styles.choiceMeta}>{[item.schoolCode, item.district].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={theme.navy} /> : <View style={styles.checkSlot} />}
                  </Pressable>
                )
              })}
            </>
          ) : null}
          {step === 1 ? (
            <>
              <Field label="Student number" autoCapitalize="characters" value={reference} onChangeText={onReference} placeholder="School student number" />
              {lookup === 'loading' ? <Text style={styles.empty}>Looking up this student…</Text> : null}
              {lookup === 'miss' ? <Text style={styles.empty}>No student matched that number at this school.</Text> : null}
              {profile ? <StudentRecord student={profile} /> : null}
            </>
          ) : null}
          {step === 2 && profile ? (
            <>
              <View style={styles.chips}>
                {RELATIONSHIPS.map((item) => (
                  <Pressable key={item.code} accessibilityRole="button" onPress={() => onRelationship(item.code)} style={[styles.chip, relationship === item.code && styles.chipOn]}>
                    <Text style={[styles.chipLabel, relationship === item.code && styles.chipLabelOn]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <StudentRecord student={profile} />
              <Info label="Relationship" value={relation} first />
            </>
          ) : null}
        </View>
      </Sheet>
      <View style={styles.actions}>
        {step > 0 ? <View style={styles.action}><Button label="Back" tone="secondary" onPress={onBack} /></View> : null}
        <View style={styles.action}>
          {step < 2 ? (
            <Button label="Continue" disabled={step === 1 && !profile} onPress={onNext} />
          ) : (
            <Button label="Link student" busy={busy} disabled={!schoolId || !profile} onPress={onSubmit} />
          )}
        </View>
      </View>
    </>
  )
}

function StudentRecord({ student }: { student: StudentPreview }) {
  return (
    <View style={styles.record}>
      <Text style={styles.recordName}>{student.studentName}</Text>
      <Text style={styles.choiceMeta}>
        {student.classLevel} · {student.academicYear}{student.feeCategory ? ` · ${student.feeCategory.toLowerCase()}` : ''}
      </Text>
      <Text style={styles.choiceMeta}>
        {student.schoolName}{student.schoolCode ? ` · ${student.schoolCode}` : ''} · {student.district}
      </Text>
      <View style={styles.recordFacts}>
        <Fact label="Number" value={student.studentReference} />
        <Fact label="Status" value={statusLabel(student.status)} />
      </View>
      <View style={styles.figures}>
        <Fact label="Billed" value={money(student.totalBilled, student.currency)} />
        <Fact label="Paid" value={money(student.totalPaid, student.currency)} />
        <Fact label="Due" value={money(student.outstanding, student.currency)} emphasis />
      </View>
      <Text style={styles.recordHeading}>Invoices</Text>
      {student.invoices.length === 0 ? <Text style={styles.choiceMeta}>No invoices on this record.</Text> : student.invoices.map((invoice) => (
        <InvoiceLine key={invoice.invoiceId} invoice={invoice} />
      ))}
    </View>
  )
}

function Fact({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, emphasis && styles.factEmphasis]}>{value}</Text>
    </View>
  )
}

function InvoiceLine({ invoice }: { invoice: FamilyInvoice }) {
  return (
    <View style={styles.invoice}>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{invoice.description}</Text>
        <Text style={styles.choiceMeta}>Due {invoice.dueDate} · {statusLabel(invoice.status)}</Text>
      </View>
      <Text style={styles.invoiceAmount}>{money(invoice.balance, invoice.currency)}</Text>
    </View>
  )
}

function Authorization({
  active,
  until,
  available,
  confirm,
  busy,
  onWithdraw,
  onGrant,
}: {
  active: boolean
  until: string
  available: boolean
  confirm: boolean
  busy: boolean
  onWithdraw: () => void
  onGrant: () => void
}) {
  return (
    <>
      <Sheet>
        <Info label="Children’s data" value={available ? 'Available to this account' : 'Withheld'} first />
        <Info label="Consent" value={active ? `Active until ${until}` : 'Required'} />
      </Sheet>
      <Text style={styles.note}>
        A child’s school and fee records stay on this account only while parental-responsibility consent is active. That covers identity, enrolment, outstanding fees, payment history, receipts, and notices.
      </Text>
      {active ? (
        <Button label={confirm ? 'Withdraw authorization now' : 'Withdraw authorization'} tone="secondary" busy={busy} onPress={onWithdraw} />
      ) : (
        <Button label="Give parental authorization" busy={busy} onPress={onGrant} />
      )}
    </>
  )
}

function identityLabel(status: string) {
  if (status === 'VERIFIED') return 'Verified'
  if (status === 'PENDING') return 'Pending review'
  if (status === 'REJECTED') return 'Rejected'
  return 'Not submitted'
}

function Info({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.info, !first && styles.line]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  note: { color: theme.muted, fontSize: 14, lineHeight: 20 },
  cardBody: { padding: 16, gap: 12 },
  cardTitle: { color: theme.navy, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  info: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  line: { borderTopWidth: 1, borderTopColor: theme.line },
  infoLabel: { color: theme.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  infoValue: { color: theme.navy, fontSize: 16, fontWeight: '500' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  choiceCopy: { flex: 1, gap: 2 },
  choiceOn: { backgroundColor: 'rgba(24,214,180,0.16)' },
  checkSlot: { width: 22, height: 22 },
  choiceTitle: { color: theme.navy, fontSize: 15, fontWeight: '600' },
  choiceMeta: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  record: { gap: 8, paddingTop: 4 },
  recordName: { color: theme.navy, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  recordFacts: { flexDirection: 'row', gap: 12 },
  recordHeading: { color: theme.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 6 },
  figures: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, gap: 2 },
  factLabel: { color: theme.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  factValue: { color: theme.navy, fontSize: 14, fontWeight: '600' },
  factEmphasis: { color: '#0E8F78' },
  invoice: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.line },
  invoiceAmount: { color: theme.navy, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.navy, borderColor: theme.navy },
  chipLabel: { color: theme.navy, fontSize: 13, fontWeight: '600' },
  chipLabelOn: { color: theme.white },
  notice: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.aqua },
  empty: { color: theme.ink, fontSize: 14, padding: 16 },
})
