import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, type PaymentChannel, type PaymentResult } from '../api'
import { Button, Eyebrow, Notice, Screen, Sheet } from '../components/ui'
import { useFamily } from '../family'
import { channelLabel, infrastructureLabel, money } from '../format'
import type { RootStackParamList } from '../navigation'
import { useSession } from '../session'
import { theme } from '../theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Pay'>

const CHANNELS: PaymentChannel[] = ['MOBILE_PAYMENT', 'BANK', 'CARD', 'PSP']

const ORIGINS = [
  { code: 'RW', label: 'Rwanda', hint: 'Domestic · RSwitch' },
  { code: 'TZ', label: 'Tanzania', hint: 'Pilot · RSwitch ↔ TIPS' },
  { code: 'UG', label: 'Uganda', hint: 'Planned' },
  { code: 'KE', label: 'Kenya', hint: 'Planned' },
  { code: 'BI', label: 'Burundi', hint: 'Planned' },
  { code: 'SS', label: 'South Sudan', hint: 'Planned' },
  { code: 'CD', label: 'DRC', hint: 'Planned' },
] as const

export function PayScreen({ navigation, route }: Props) {
  const { user } = useSession()
  const { family, refresh } = useFamily()
  const open = useMemo(() => {
    return (family?.students ?? []).flatMap((student) =>
      student.invoices
        .filter((invoice) => invoice.balance > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'WRITTEN_OFF')
        .map((invoice) => ({ student, invoice })),
    )
  }, [family])

  const preset = open.find((item) => item.invoice.invoiceId === route.params.invoiceId) ?? open[0]
  const [invoiceId, setInvoiceId] = useState(preset?.invoice.invoiceId ?? '')
  const selected = open.find((item) => item.invoice.invoiceId === invoiceId) ?? preset
  const [amount, setAmount] = useState('')
  const [channel, setChannel] = useState<PaymentChannel>('MOBILE_PAYMENT')
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]['code']>('RW')
  const [prefsReady, setPrefsReady] = useState(false)
  const [moreCountries, setMoreCountries] = useState(false)
  const [changeInvoice, setChangeInvoice] = useState(!route.params.invoiceId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)

  useEffect(() => {
    if (selected) setAmount(selected.invoice.balance.toLocaleString('en-US'))
  }, [selected])

  useEffect(() => {
    if (prefsReady || !family?.preferences) return
    const channelPref = family.preferences.paymentChannel
    const originPref = family.preferences.originCountry
    if (channelPref && CHANNELS.includes(channelPref)) setChannel(channelPref)
    if (ORIGINS.some((item) => item.code === originPref)) {
      setOrigin(originPref as (typeof ORIGINS)[number]['code'])
    }
    setPrefsReady(true)
  }, [family, prefsReady])

  function choose(nextId: string) {
    setInvoiceId(nextId)
  }

  async function pay() {
    if (!selected) return
    const value = Number(amount.replace(/,/g, ''))
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (value > selected.invoice.balance) {
      setError('That amount is higher than the remaining balance.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const started = await api.payments.initiate({
        invoiceId: selected.invoice.invoiceId,
        amount: value,
        paymentChannel: channel,
        payerReference: user?.userId,
        originCountry: origin,
        destinationCountry: 'RW',
      })
      const confirmed = await api.payments.confirm({
        paymentId: started.paymentId,
        invoiceId: selected.invoice.invoiceId,
        amount: value,
      })
      try {
        const settled = await api.payments.settle({
          paymentId: started.paymentId,
          invoiceId: selected.invoice.invoiceId,
          amount: value,
        })
        setResult(settled)
      } catch {
        setResult(confirmed)
        setError('The rail confirmed the payment. Settlement is still open.')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not be started.')
    } finally {
      setBusy(false)
    }
  }

  if (result && result.status === 'SUCCESS') {
    return (
      <Screen inset={false}>
        <View style={styles.receipt}>
          <Text style={styles.receiptKicker}>Receipt</Text>
          <Text style={styles.receiptTitle}>Payment received</Text>
          <Text style={styles.receiptAmount}>{money(result.amount, result.currency)}</Text>
        </View>
        <Sheet>
          <Line label="Student" value={selected?.student.studentName ?? '—'} first />
          <Line label="Invoice" value={selected?.invoice.description ?? '—'} />
          <Line label="Rail" value={railLine(result)} />
          <Line label="Corridor" value={result.corridor ? `${result.corridor.originLabel} ↔ ${result.corridor.destinationLabel}` : 'Domestic Rwanda'} />
          <Line label="Reference" value={result.paymentId} />
        </Sheet>
        {result.flow && result.flow.length > 0 ? (
          <View style={styles.block}>
            <Eyebrow>Payment flow</Eyebrow>
            <Sheet>
              {result.flow.map((step, index) => (
                <View key={`${step.code}-${step.createdAt}`} style={[styles.flow, index > 0 && styles.choiceLine]}>
                  <Text style={styles.flowCode}>{step.code}</Text>
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceTitle}>{step.label}</Text>
                    {step.detail ? <Text style={styles.meta}>{step.detail}</Text> : null}
                  </View>
                </View>
              ))}
            </Sheet>
          </View>
        ) : null}
        <Button label="Done" onPress={() => navigation.goBack()} />
      </Screen>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inset={false}>
        <View style={styles.amountBlock}>
          <Eyebrow>Amount</Eyebrow>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>RWF</Text>
            <TextInput
              accessibilityLabel="Amount"
              keyboardType="number-pad"
              value={amount}
              onChangeText={(text) => {
                const raw = text.replace(/[^\d]/g, '')
                setAmount(raw ? Number(raw).toLocaleString('en-US') : '')
              }}
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#8AA0AB"
            />
          </View>
          <Text style={styles.meta}>
            {selected ? `${money(selected.invoice.balance)} remaining on this invoice` : 'Select an invoice'}
          </Text>
        </View>

        {error ? <Notice tone={result ? 'info' : 'danger'}>{error}</Notice> : null}

        {!open.length ? (
          <Text style={styles.meta}>There are no open invoices on this account.</Text>
        ) : (
          <>
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Eyebrow>Pay toward</Eyebrow>
                {selected ? (
                  <Pressable accessibilityRole="button" onPress={() => setChangeInvoice((value) => !value)}>
                    <Text style={styles.change}>{changeInvoice ? 'Done' : 'Change'}</Text>
                  </Pressable>
                ) : null}
              </View>
              {selected && !changeInvoice ? (
                <Sheet>
                  <View style={styles.choice}>
                    <View style={styles.choiceCopy}>
                      <Text style={styles.choiceTitle}>{selected.student.studentName}</Text>
                      <Text style={styles.meta}>{selected.invoice.description}</Text>
                    </View>
                    <Text style={styles.choiceAmount}>{money(selected.invoice.balance)}</Text>
                  </View>
                </Sheet>
              ) : (
                <Sheet>
                  {open.map((item, index) => {
                    const active = item.invoice.invoiceId === selected?.invoice.invoiceId
                    return (
                      <Pressable
                        key={item.invoice.invoiceId}
                        accessibilityRole="button"
                        onPress={() => {
                          choose(item.invoice.invoiceId)
                          setChangeInvoice(false)
                        }}
                        style={[styles.choice, index > 0 && styles.choiceLine, active && styles.choiceActive]}
                      >
                        <View style={styles.choiceCopy}>
                          <Text style={styles.choiceTitle}>{item.student.studentName}</Text>
                          <Text style={styles.meta}>{item.invoice.description}</Text>
                        </View>
                        <Text style={styles.choiceAmount}>{money(item.invoice.balance)}</Text>
                      </Pressable>
                    )
                  })}
                </Sheet>
              )}
            </View>

            <View style={styles.block}>
              <Eyebrow>Where you pay from</Eyebrow>
              <View style={styles.rails}>
                {(moreCountries ? ORIGINS : ORIGINS.filter((item) => item.code === 'RW' || item.code === 'TZ' || item.code === origin)).map((item) => {
                  const active = item.code === origin
                  return (
                    <Pressable
                      key={item.code}
                      accessibilityRole="button"
                      onPress={() => setOrigin(item.code)}
                      style={[styles.origin, active && styles.railActive]}
                    >
                      <Text style={[styles.railText, active && styles.railTextActive]}>{item.label}</Text>
                      <Text style={[styles.originHint, active && styles.originHintActive]}>{item.hint}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <Pressable accessibilityRole="button" onPress={() => setMoreCountries((value) => !value)}>
                <Text style={styles.change}>{moreCountries ? 'Fewer countries' : 'Other EAC countries'}</Text>
              </Pressable>
            </View>

            <View style={styles.block}>
              <Eyebrow>Approved rail</Eyebrow>
              <View style={styles.rails}>
                {CHANNELS.map((item) => {
                  const active = item === channel
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => setChannel(item)}
                      style={[styles.rail, active && styles.railActive]}
                    >
                      <Text style={[styles.railText, active && styles.railTextActive]}>{channelLabel(item)}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <Text style={styles.note}>
              {origin === 'RW'
                ? 'UPSA Next Payment sends the instruction. An approved Rwandan rail moves the money.'
                : origin === 'TZ'
                  ? 'This uses the live pilot: Rwanda (RSwitch) ↔ Tanzania (TIPS).'
                  : 'This corridor is registered as planned. The instruction is rejected until it opens.'}
            </Text>
            <Button label="Confirm payment" busy={busy} disabled={!selected} onPress={() => void pay()} />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  )
}

function railLine(result: PaymentResult) {
  if (!result.rail) return 'Approved rail'
  const infrastructure = infrastructureLabel(result.rail.infrastructure)
  return infrastructure ? `${result.rail.name} · ${infrastructure}` : result.rail.name
}

function Line({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.line, !first && styles.lineRule]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.paper },
  amountBlock: { gap: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currency: { color: theme.muted, fontSize: 16, fontWeight: '600' },
  amountInput: {
    flex: 1,
    color: theme.navy,
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  meta: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  block: { gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  change: { color: theme.navy, fontSize: 13, fontWeight: '600' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  choiceLine: { borderTopWidth: 1, borderTopColor: theme.line },
  choiceActive: { backgroundColor: '#F3FBFA' },
  choiceCopy: { flex: 1, gap: 2 },
  choiceTitle: { color: theme.navy, fontSize: 15, fontWeight: '600' },
  choiceAmount: { color: theme.navy, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rail: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.line,
  },
  origin: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.line,
  },
  originHint: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  originHintActive: { color: theme.sky },
  railActive: { backgroundColor: theme.navy, borderColor: theme.navy },
  railText: { color: theme.navy, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  railTextActive: { color: theme.white },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  flowCode: { width: 56, color: theme.navy, fontSize: 12, fontWeight: '700' },
  note: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  receipt: { backgroundColor: theme.navy, borderRadius: 20, padding: 22, gap: 6 },
  receiptKicker: { color: theme.aqua, fontSize: 12, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase' },
  receiptTitle: { color: theme.white, fontSize: 26, fontWeight: '600' },
  receiptAmount: { color: theme.white, fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.6 },
  line: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  lineRule: { borderTopWidth: 1, borderTopColor: theme.line },
  lineLabel: { color: theme.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  lineValue: { color: theme.navy, fontSize: 15, fontWeight: '600' },
})
