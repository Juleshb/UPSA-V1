import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Mark } from '../components/Mark'
import { Amount, Eyebrow, Notice, Screen, Sheet } from '../components/ui'
import { useFamily } from '../family'
import { firstName, initials, money, shortDate } from '../format'
import type { RootStackParamList, TabParamList } from '../navigation'
import { useSession } from '../session'
import { theme } from '../theme'

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>

export function HomeScreen({ navigation, route }: Props) {
  const { user } = useSession()
  const { family, loading, error, refresh } = useFamily()
  const name = firstName(family?.guardian?.fullName || user?.fullName || '')
  const outstanding = family?.outstanding ?? 0
  const recent = family?.receipts.slice(0, 3) ?? []
  const [showAll, setShowAll] = useState(false)
  const students = [...(family?.students ?? [])].sort((a, b) => b.outstanding - a.outstanding)
  const linkedId = route.params?.studentId
  const linkedIndex = linkedId ? students.findIndex((student) => student.studentId === linkedId) : -1
  const expanded = showAll || linkedIndex >= 4
  const visible = expanded ? students : students.slice(0, 4)
  const unread = family?.notifications.filter((item) => !item.read).length ?? 0

  return (
    <Screen onRefresh={() => void refresh()} refreshing={loading && !!family}>
      <View style={styles.header}>
        <Mark size={40} />
        <View style={styles.greeting}>
          <Text style={styles.hello}>{greeting()}</Text>
          <Text style={styles.name}>{name || 'Parent'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${unread} unread notices` : 'Notices'}
          onPress={() => navigation.navigate('AccountSection', { section: 'notices' })}
          style={styles.bell}
        >
          <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} color={theme.navy} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {error ? <Notice>{error}</Notice> : null}
      {route.params?.notice ? <Notice tone="info">{route.params.notice}</Notice> : null}
      {family?.childRecords === 'WITHHELD' ? (
        <Notice tone="info">Student records stay hidden until you authorize them under You.</Notice>
      ) : null}

      {family?.childRecords === 'WITHHELD' ? (
      <View style={styles.balance}>
        <View style={styles.shine} />
        <Text style={styles.balanceLabel}>Fees outstanding</Text>
        <Text style={styles.balanceHint}>Fees and receipts appear after authorization.</Text>
      </View>
      ) : (
      <View style={styles.balance}>
        <View style={styles.shine} />
        <Text style={styles.balanceLabel}>Fees outstanding</Text>
        <Amount light size="lg">{loading && !family ? '—' : money(outstanding, family?.currency)}</Amount>
        <Text style={styles.balanceHint}>
          {family
            ? `${money(family.totalPaid, family.currency)} paid of ${money(family.totalBilled, family.currency)} billed`
            : 'Loading your accounts'}
        </Text>
      </View>
      )}

      {family?.childRecords !== 'WITHHELD' ? (
        <View style={styles.actions}>
          <QuickAction icon="arrow-forward" label="Pay" onPress={() => navigation.navigate('Pay', {})} />
          <QuickAction icon="list" label="Activity" onPress={() => navigation.navigate('Activity')} />
          <QuickAction icon="link" label="Link" onPress={() => navigation.navigate('AccountSection', { section: 'link' })} />
        </View>
      ) : null}

      <View style={styles.block}>
        <Eyebrow>Accounts</Eyebrow>
        <Sheet>
          {family?.childRecords === 'WITHHELD' ? (
            <Text style={styles.empty}>Records are withheld until you authorize them.</Text>
          ) : family && family.students.length === 0 ? (
            <Text style={styles.empty}>No students are linked yet.</Text>
          ) : null}
          {visible.map((student, index) => (
            <Pressable
              key={student.studentId}
              accessibilityRole="button"
              onPress={() => navigation.navigate('Student', { studentId: student.studentId })}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowLine, student.studentId === linkedId && styles.rowLinked, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(student.studentName)}</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{student.studentName}</Text>
                <Text style={styles.rowMeta}>{student.classLevel} · {student.schoolName}</Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={styles.rowAmount}>{money(student.outstanding)}</Text>
                <Text style={styles.rowMeta}>Due</Text>
              </View>
            </Pressable>
          ))}
          {students.length > 4 ? (
            <Pressable accessibilityRole="button" onPress={() => {
              if (expanded) {
                setShowAll(false)
                if (linkedId) navigation.setParams({ notice: route.params?.notice, studentId: undefined })
              } else {
                setShowAll(true)
              }
            }} style={styles.more}>
              <Text style={styles.link}>{expanded ? 'Show less' : `Show all ${students.length}`}</Text>
            </Pressable>
          ) : null}
        </Sheet>
      </View>

      {recent.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Eyebrow>Recent</Eyebrow>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Activity')}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          </View>
          <Sheet>
            {recent.map((receipt, index) => (
              <View key={receipt.receiptId} style={[styles.row, index > 0 && styles.rowLine]}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{receipt.description}</Text>
                  <Text style={styles.rowMeta}>{receipt.studentName} · {shortDate(receipt.issuedAt)}</Text>
                </View>
                <Text style={styles.rowAmount}>{money(receipt.amount, receipt.currency)}</Text>
              </View>
            ))}
          </Sheet>
        </View>
      ) : null}
    </Screen>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={theme.navy} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { flex: 1, gap: 1 },
  hello: { color: theme.muted, fontSize: 13 },
  name: { color: theme.navy, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: theme.white, fontSize: 10, fontWeight: '700' },
  balance: {
    backgroundColor: 'rgba(9,43,60,0.9)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    padding: 20,
    gap: 8,
    overflow: 'hidden',
    shadowColor: '#092B3C',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  shine: { position: 'absolute', top: 0, left: 16, right: 16, height: 1, backgroundColor: 'rgba(255,255,255,0.55)' },
  balanceLabel: { color: theme.aqua, fontSize: 13, fontWeight: '600' },
  balanceHint: { color: '#C5D5DC', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 14,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.sky, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: theme.navy, fontSize: 13, fontWeight: '600' },
  block: { gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: theme.navy, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.sky, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.navy, fontSize: 12, fontWeight: '700' },
  rowLine: { borderTopWidth: 1, borderTopColor: theme.line },
  rowLinked: { backgroundColor: 'rgba(24,214,180,0.16)' },
  pressed: { backgroundColor: theme.paper },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: theme.navy, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: theme.muted, fontSize: 12, lineHeight: 16 },
  rowEnd: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { color: theme.navy, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { color: theme.ink, fontSize: 14, lineHeight: 20, padding: 16 },
  more: { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.line },
})
