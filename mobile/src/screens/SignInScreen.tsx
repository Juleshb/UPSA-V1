import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError } from '../api'
import { Mark } from '../components/Mark'
import { Button, Field, Notice } from '../components/ui'
import { useSession } from '../session'
import { theme } from '../theme'

const SANDBOX = { email: 'parent@example.rw', password: 'ChangeMe123!' }

export function SignInScreen() {
  const { signIn, signUp } = useSession()
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        if (!consent) {
          setError('Parental-responsibility consent is required before a parent account can be opened.')
          return
        }
        await signUp({ fullName, email, phone, password, nationalId, parentalConsent: true })
      } else {
        await signIn(nextEmail, nextPassword)
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.washAqua} />
      <View pointerEvents="none" style={styles.washNavy} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Mark size={56} />
          <View>
            <Text style={styles.wordmark}>UPSA <Text style={styles.wordmarkNext}>NEXT</Text></Text>
            <Text style={styles.wordmarkSub}>Payment</Text>
          </View>
          <Text style={styles.line}>{mode === 'register' ? 'Create a parent account' : 'Parent account'}</Text>
        </View>
        <View style={styles.form}>
          {error ? <Notice>{error}</Notice> : null}
          {mode === 'register' ? (
            <>
              <Field label="Full name" autoComplete="name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
              <Field label="Phone" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} placeholder="+250788000000" />
              <Field label="National ID" keyboardType="number-pad" value={nationalId} onChangeText={setNationalId} placeholder="16 digits, optional" />
            </>
          ) : null}
          <Field
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="name@email.com"
          />
          <Field
            label="Password"
            secureTextEntry
            autoComplete={mode === 'register' ? 'new-password' : 'password'}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
          />
          {mode === 'register' ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((value) => !value)} style={styles.consent}>
              <View style={[styles.box, consent && styles.boxOn]} />
              <Text style={styles.consentText}>
                I am the parent or legal guardian. I consent to UPSA Next Payment processing my children’s school and fee information for payment, receipts, and notices.
              </Text>
            </Pressable>
          ) : null}
          <Button label={mode === 'register' ? 'Create account' : 'Sign in'} busy={busy} onPress={() => void submit()} />
          {mode === 'sign-in' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEmail(SANDBOX.email)
                setPassword(SANDBOX.password)
                void submit(SANDBOX.email, SANDBOX.password)
              }}
              style={styles.demo}
            >
              <Text style={styles.demoLabel}>Use the sandbox parent account</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === 'register' ? 'sign-in' : 'register')
              setError('')
            }}
            style={styles.demo}
          >
            <Text style={styles.demoLabel}>{mode === 'register' ? 'I already have an account' : 'Create a parent account'}</Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F8F7', overflow: 'hidden' },
  washAqua: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(24,214,180,0.4)', top: -30, right: -60 },
  washNavy: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(9,43,60,0.12)', bottom: 20, left: -80 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28, gap: 28 },
  brand: { alignItems: 'flex-start', gap: 12 },
  wordmark: { color: theme.navy, fontSize: 20, fontWeight: '800', letterSpacing: 1.2 },
  wordmarkNext: { color: '#0E9E86', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  wordmarkSub: { marginTop: 2, color: '#0E9E86', fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase' },
  line: { color: theme.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  form: { gap: 14 },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: { width: 18, height: 18, marginTop: 2, borderRadius: 4, borderWidth: 1.5, borderColor: theme.navy },
  boxOn: { backgroundColor: theme.navy },
  consentText: { flex: 1, color: theme.ink, fontSize: 13, lineHeight: 19 },
  demo: { alignItems: 'center', paddingVertical: 8 },
  demoLabel: { color: theme.navy, fontSize: 14, fontWeight: '600' },
})
