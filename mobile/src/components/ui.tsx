import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../theme'

const frost = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as ViewStyle)
  : undefined

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  inset = true,
}: {
  children: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  inset?: boolean
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.washAqua} />
      <View pointerEvents="none" style={styles.washNavy} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: inset ? insets.top + 12 : 8, paddingBottom: 72 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.navy} />
        ) : undefined}
      >
        {children}
      </ScrollView>
    </View>
  )
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function Amount({ children, light = false, size = 'md' }: { children: string; light?: boolean; size?: 'md' | 'lg' }) {
  return <Text style={[styles.amount, size === 'lg' && styles.amountLg, light && styles.amountLight]}>{children}</Text>
}

export function Sheet({ children }: { children: ReactNode }) {
  return <View style={styles.sheet}>{children}</View>
}

export function Steps({ labels, index }: { labels: string[]; index: number }) {
  return (
    <View style={styles.stepCard}>
      {labels.map((label, item) => {
        const done = item < index
        const current = item === index
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepTrack}>
              <View style={[styles.stepLine, item === 0 && styles.stepLineHidden, (done || current) && styles.stepLineOn]} />
              <View style={[styles.stepDot, (done || current) && styles.stepDotOn]}>
                <Text style={[styles.stepNum, (done || current) && styles.stepNumOn]}>{done ? '✓' : item + 1}</Text>
              </View>
              <View style={[styles.stepLine, item === labels.length - 1 && styles.stepLineHidden, done && styles.stepLineOn]} />
            </View>
            <Text style={[styles.stepLabel, current && styles.stepLabelOn]} numberOfLines={1}>{label}</Text>
          </View>
        )
      })}
    </View>
  )
}

export function Button({
  label,
  onPress,
  busy = false,
  tone = 'primary',
  disabled = false,
}: {
  label: string
  onPress: () => void
  busy?: boolean
  tone?: 'primary' | 'accent' | 'secondary'
  disabled?: boolean
}) {
  const blocked = busy || disabled
  const lightLabel = tone !== 'secondary'
  return (
    <Pressable
      accessibilityRole="button"
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'accent' ? styles.buttonAccent : tone === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
        blocked && styles.buttonDisabled,
        pressed && !blocked && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={tone === 'accent' ? theme.navy : theme.white} /> : (
        <Text style={[styles.buttonLabel, lightLabel ? styles.buttonLabelLight : styles.buttonLabelDark, tone === 'accent' && styles.buttonLabelAccent]}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#8AA0AB" style={styles.input} {...input} />
    </View>
  )
}

export function Notice({ children, tone = 'danger' }: { children: string; tone?: 'danger' | 'info' }) {
  return (
    <View style={[styles.notice, tone === 'info' ? styles.noticeInfo : styles.noticeDanger]}>
      <Text style={[styles.noticeText, tone === 'info' ? styles.noticeTextInfo : styles.noticeTextDanger]}>{children}</Text>
    </View>
  )
}

export function RowLink({
  title,
  detail,
  onPress,
  first = false,
}: {
  title: string
  detail?: string
  onPress: () => void
  first?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menu, !first && styles.menuLine, pressed && styles.menuPressed]}
    >
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        {detail ? <Text style={styles.menuDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}
export function Pill({ value }: { value: string }) {
  const failed = value === 'FAILED' || value === 'OVERDUE' || value === 'CANCELLED'
  const settled = value === 'SUCCESS' || value === 'PAID' || value === 'MATCHED'
  return (
    <Text style={[styles.pill, failed && styles.pillFailed, settled && styles.pillSettled]}>
      {value.replaceAll('_', ' ').toLowerCase()}
    </Text>
  )
}

export const type = {
  title: { color: theme.navy, fontSize: 28, fontWeight: '600', letterSpacing: -0.4 } as TextStyle,
  body: { color: theme.ink, fontSize: 15, lineHeight: 22 } as TextStyle,
  meta: { color: theme.muted, fontSize: 13, lineHeight: 18 } as TextStyle,
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F8F7', overflow: 'hidden' },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  washAqua: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(24,214,180,0.45)',
    top: -40,
    right: -70,
    ...Platform.select({ web: { filter: 'blur(28px)' } as ViewStyle, default: {} }),
  },
  washNavy: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(9,43,60,0.16)',
    bottom: 40,
    left: -110,
    ...Platform.select({ web: { filter: 'blur(36px)' } as ViewStyle, default: {} }),
  },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 22 },
  eyebrow: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  amount: {
    color: theme.navy,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  amountLg: { fontSize: 34, letterSpacing: -0.8 },
  amountLight: { color: theme.white },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    shadowColor: '#092B3C',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    ...frost,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    ...frost,
  },
  step: { flex: 1, alignItems: 'center', gap: 8 },
  stepTrack: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(9,43,60,0.12)' },
  stepLineOn: { backgroundColor: theme.aqua },
  stepLineHidden: { backgroundColor: 'transparent' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(9,43,60,0.12)',
  },
  stepDotOn: { backgroundColor: theme.navy, borderColor: theme.navy },
  stepNum: { color: theme.navy, fontSize: 12, fontWeight: '700' },
  stepNumOn: { color: theme.white },
  stepLabel: { color: theme.muted, fontSize: 11, fontWeight: '600' },
  stepLabelOn: { color: theme.navy },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: { backgroundColor: theme.navy },
  buttonAccent: { backgroundColor: theme.aqua },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...frost,
  },
  buttonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.86 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  buttonLabelLight: { color: theme.white },
  buttonLabelDark: { color: theme.navy },
  buttonLabelAccent: { color: theme.navy },
  field: { gap: 8 },
  fieldLabel: { color: theme.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 14,
    color: theme.navy,
    fontSize: 16,
    ...frost,
  },
  notice: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  noticeDanger: { backgroundColor: theme.dangerBg },
  noticeInfo: { backgroundColor: theme.sky },
  noticeText: { fontSize: 14, lineHeight: 20 },
  noticeTextDanger: { color: theme.danger },
  noticeTextInfo: { color: theme.navy },
  pill: { color: theme.muted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  pillFailed: { color: theme.danger },
  pillSettled: { color: '#0E8F78' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  menuLine: { borderTopWidth: 1, borderTopColor: theme.line },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { color: theme.navy, fontSize: 16, fontWeight: '600' },
  menuDetail: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  chevron: { color: '#9AADB6', fontSize: 22, fontWeight: '400', marginTop: -2 },
  menuPressed: { backgroundColor: theme.paper },
})
