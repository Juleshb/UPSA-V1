import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { StyleSheet, Text, View } from 'react-native'
import { Mark } from '../components/Mark'
import { Button, RowLink, Screen, Sheet, type as typeScale } from '../components/ui'
import { useFamily } from '../family'
import { channelLabel, shortDate } from '../format'
import type { RootStackParamList, TabParamList } from '../navigation'
import { useSession } from '../session'
import { theme } from '../theme'

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Account'>,
  NativeStackScreenProps<RootStackParamList>
>

export function AccountScreen({ navigation }: Props) {
  const { user, signOut } = useSession()
  const { family } = useFamily()
  const guardian = family?.guardian
  const notices = family?.notifications.length ?? 0
  const unread = family?.notifications.filter((item) => !item.read).length ?? 0
  const identity = identityLabel(family?.identity.status ?? 'NOT_SUBMITTED')
  const rail = family?.preferences.paymentChannel ? channelLabel(family.preferences.paymentChannel) : 'Not set'

  return (
    <Screen>
      <View style={styles.header}>
        <Mark size={48} />
        <View style={styles.identity}>
          <Text style={typeScale.title}>{guardian?.fullName || user?.fullName}</Text>
          <Text style={typeScale.meta}>{guardian?.guardianId || 'Parent account'}</Text>
        </View>
      </View>

      <Sheet>
        <RowLink
          first
          title="Authorization"
          detail={family?.authorization ? `Active until ${shortDate(family.authorization.expiresAt)}` : 'Required before student records appear'}
          onPress={() => navigation.navigate('AccountSection', { section: 'authorization' })}
        />
        <RowLink
          title="Identity"
          detail={identity}
          onPress={() => navigation.navigate('AccountSection', { section: 'identity' })}
        />
        <RowLink
          title="Contact"
          detail={guardian?.email || user?.email || 'Add a phone and email'}
          onPress={() => navigation.navigate('AccountSection', { section: 'contact' })}
        />
        <RowLink
          title="Link a student"
          detail={family?.schools.length ? family.schools.map((school) => school.schoolName).join(', ') : 'Connect a school reference'}
          onPress={() => navigation.navigate('AccountSection', { section: 'link' })}
        />
        <RowLink
          title="Payment preferences"
          detail={rail}
          onPress={() => navigation.navigate('AccountSection', { section: 'preferences' })}
        />
        <RowLink
          title="Notices"
          detail={unread > 0 ? `${unread} unread` : notices === 0 ? 'None yet' : 'All read'}
          onPress={() => navigation.navigate('AccountSection', { section: 'notices' })}
        />
      </Sheet>

      <Button label="Sign out" tone="secondary" onPress={() => void signOut()} />
    </Screen>
  )
}

function identityLabel(status: string) {
  if (status === 'VERIFIED') return 'Verified'
  if (status === 'PENDING') return 'Pending review'
  if (status === 'REJECTED') return 'Rejected'
  return 'Not submitted'
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identity: { flex: 1, gap: 2 },
})
