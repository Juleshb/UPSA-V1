import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { AuthSession } from './api'

const KEY = 'rupsa.parent.session'

async function read(key: string) {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null
  return SecureStore.getItemAsync(key)
}

async function write(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function remove(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await read(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export async function saveSession(session: AuthSession) {
  await write(KEY, JSON.stringify(session))
}

export async function clearSession() {
  await remove(KEY)
}
