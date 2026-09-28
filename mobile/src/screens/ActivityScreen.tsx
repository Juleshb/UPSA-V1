import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, type FamilyPayment } from '../api'
import { Notice, Pill, Screen, Sheet, type as typeScale } from '../components/ui'
import { useFamily } from '../family'
import { channelLabel, infrastructureLabel, money, shortDate } from '../format'
import { theme } from '../theme'

export function ActivityScreen() {
  const { family, loading, error, refresh } = useFamily()
  const [tab, setTab] = useState<'receipts' | 'payments'>('receipts')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const receipts = family?.receipts ?? []
  const payments = family?.payments ?? []

  async function retry(payment: FamilyPayment) {
    setRetrying(payment.paymentId)
    setActionError('')
    try {
      const started = await api.payments.retry(payment.paymentId)
      await api.payments.confirm({
        paymentId: started.paymentId,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
      })
      try {
        await api.payments.settle({
          paymentId: started.paymentId,
          invoiceId: payment.invoiceId,
          amount: payment.amount,
        })
      } catch {
        setActionError('The next rail confirmed the payment. Settlement is still open.')
      }
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The next rail could not take this payment.')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <Screen onRefresh={() => void refresh()} refreshing={loading && !!family}>
      <View style={styles.intro}>
        <Text style={typeScale.title}>Activity</Text>
        <Text style={typeScale.body}>Receipts and payments for the students on this account.</Text>
      </View>
      {error ? <Notice>{error}</Notice> : null}
      {actionError ? <Notice>{actionError}</Notice> : null}
      <View style={styles.switcher}>
        <Tab label="Receipts" active={tab === 'receipts'} onPress={() => setTab('receipts')} />
        <Tab label="Payments" active={tab === 'payments'} onPress={() => setTab('payments')} />
      </View>
      <Sheet>
        {tab === 'receipts' ? (
          receipts.length === 0 ? <Text style={styles.empty}>No receipts yet.</Text> : receipts.map((receipt, index) => (
            <View key={receipt.receiptId} style={[styles.row, index > 0 && styles.line]}>
              <View style={styles.copy}>
                <Text style={styles.title}>{receipt.studentName}</Text>
                <Text style={styles.meta}>{receipt.description}</Text>
                <Text style={styles.meta}>{shortDate(receipt.issuedAt)} · {receipt.receiptId}</Text>
              </View>
              <Text style={styles.amount}>{money(receipt.amount, receipt.currency)}</Text>
            </View>
          ))
        ) : payments.length === 0 ? <Text style={styles.empty}>No payments yet.</Text> : payments.map((payment, index) => (
          <View key={payment.paymentId} style={[styles.row, index > 0 && styles.line]}>
            <View style={styles.copy}>
              <Text style={styles.title}>{payment.studentName}</Text>
              <Text style={styles.meta}>{payment.description}</Text>
              <Text style={styles.meta}>{shortDate(payment.createdAt)}</Text>
              <Text style={styles.meta}>{paymentLine(payment)}</Text>
            </View>
            <View style={styles.end}>
              <Text style={styles.amount}>{money(payment.amount, payment.currency)}</Text>
              <Pill value={payment.status} />
              {payment.status === 'FAILED' ? (
                <Pressable accessibilityRole="button" disabled={retrying === payment.paymentId} onPress={() => void retry(payment)}>
                  <Text style={styles.retry}>{retrying === payment.paymentId ? 'Sending…' : 'Try next rail'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </Sheet>
      {tab === 'payments' ? <Text style={styles.caption}>Each row is a payment instruction sent to an approved rail.</Text> : null}
    </Screen>
  )
}

function paymentLine(payment: FamilyPayment) {
  const rail = payment.railName ?? channelLabel(payment.paymentChannel)
  const place = payment.corridorLabel ?? (payment.railInfrastructure ? infrastructureLabel(payment.railInfrastructure) : 'Domestic')
  return [payment.flowCode, rail, place].filter(Boolean).join(' · ')
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  intro: { gap: 6 },
  switcher: { flexDirection: 'row', backgroundColor: theme.white, borderRadius: 12, borderWidth: 1, borderColor: theme.line, padding: 4 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 8 },
  tabActive: { backgroundColor: theme.navy },
  tabLabel: { color: theme.navy, fontSize: 14, fontWeight: '600' },
  tabLabelActive: { color: theme.white },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  line: { borderTopWidth: 1, borderTopColor: theme.line },
  copy: { flex: 1, gap: 2 },
  title: { color: theme.navy, fontSize: 15, fontWeight: '600' },
  meta: { color: theme.muted, fontSize: 12, lineHeight: 16 },
  end: { alignItems: 'flex-end', gap: 4 },
  amount: { color: theme.navy, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { color: theme.ink, fontSize: 14, padding: 16 },
  caption: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  retry: { color: theme.navy, fontSize: 12, fontWeight: '700' },
})
