import type { NavigatorScreenParams } from '@react-navigation/native'

export type TabParamList = {
  Home: { notice?: string; studentId?: string } | undefined
  Activity: undefined
  Account: undefined
}

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined
  Student: { studentId: string }
  Pay: { invoiceId?: string }
  AccountSection: { section: 'authorization' | 'identity' | 'contact' | 'link' | 'preferences' | 'notices' }
}
