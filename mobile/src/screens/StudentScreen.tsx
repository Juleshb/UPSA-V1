import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useLayoutEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Eyebrow, Pill, Screen, Sheet } from '../components/ui'
import { useFamily } from '../family'
import { money } from '../format'
import type { RootStackParamList } from '../navigation'
import { theme } from '../theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Student'>

export function StudentScreen({ navigation, route }: Props) {
  const { family, refresh, loading } = useFamily()
  const student = family?.students.find((item) => item.studentId === route.params.studentId)

  useLayoutEffect(() => {
    navigation.setOptions({ title: student?.studentName ?? 'Account' })
  }, [navigation, student?.studentName])

  if (!student) {
    return (
      <Screen inset={false} onRefresh={() => void refresh()} refreshing={loading}>
        <Text style={styles.meta}>This student is not linked to your account.</Text>
      </Screen>
    )
  }

  return (
    <Screen inset={false} onRefresh={() => void refresh()} refreshing={loading}>
      <View style={styles.intro}>
        <Text style={styles.school}>{student.schoolName}</Text>
        <Text style={styles.meta}>
          {student.classLevel} · {student.academicYear}{student.feeCategory ? ` · ${student.feeCategory.toLowerCase()}` : ''}
        </Text>
      </View>
      <View style={styles.figures}>
        <Figure label="Billed" value={money(student.totalBilled)} />
        <Figure label="Paid" value={money(student.totalPaid)} />
        <Figure label="Due" value={money(student.outstanding)} emphasis />
      </View>
      {student.outstanding > 0 ? (
        <Button
          label="Pay fees"
          tone="accent"
          onPress={() => {
            const next = student.invoices.find((invoice) => invoice.balance > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'WRITTEN_OFF')
            navigation.navigate('Pay', { invoiceId: next?.invoiceId })
          }}
        />
      ) : null}
      <View style={styles.block}>
        <Eyebrow>Invoices</Eyebrow>
        <Sheet>
          {student.invoices.length === 0 ? <Text style={styles.empty}>No invoices yet.</Text> : null}
          {student.invoices.map((invoice, index) => {
            const payable = invoice.balance > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'WRITTEN_OFF'
            return (
              <Pressable
                key={invoice.invoiceId}
                accessibilityRole="button"
                disabled={!payable}
                onPress={() => navigation.navigate('Pay', { invoiceId: invoice.invoiceId })}
                style={({ pressed }) => [styles.row, index > 0 && styles.rowLine, pressed && payable && styles.pressed]}
              >
                <View style={styles.copy}>
                  <Text style={styles.title}>{invoice.description}</Text>
                  <Text style={styles.meta}>Due {invoice.dueDate} · {money(invoice.amountPaid)} of {money(invoice.amount)}</Text>
                </View>
                <View style={styles.end}>
                  <Text style={styles.amount}>{money(invoice.balance, invoice.currency)}</Text>
                  <Pill value={invoice.status} />
                </View>
              </Pressable>
            )
          })}
        </Sheet>
      </View>
    </Screen>
  )
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, emphasis && styles.figureEmphasis]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: { gap: 4 },
  school: { color: theme.navy, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  meta: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  figures: {
    flexDirection: 'row',
    backgroundColor: theme.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
  },
  figure: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  figureLabel: { color: theme.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  figureValue: { color: theme.navy, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  figureEmphasis: { color: '#0E8F78' },
  block: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: theme.line },
  pressed: { backgroundColor: theme.paper },
  copy: { flex: 1, gap: 4 },
  title: { color: theme.navy, fontSize: 15, fontWeight: '600' },
  end: { alignItems: 'flex-end', gap: 4 },
  amount: { color: theme.navy, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { color: theme.ink, fontSize: 14, padding: 16 },
})
