import { Ionicons } from '@expo/vector-icons'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { FamilyProvider } from './src/family'
import type { RootStackParamList, TabParamList } from './src/navigation'
import { AccountScreen } from './src/screens/AccountScreen'
import { AccountSectionScreen } from './src/screens/AccountSectionScreen'
import { ActivityScreen } from './src/screens/ActivityScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { PayScreen } from './src/screens/PayScreen'
import { SignInScreen } from './src/screens/SignInScreen'
import { StudentScreen } from './src/screens/StudentScreen'
import { SessionProvider, useSession } from './src/session'
import { theme } from './src/theme'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tabs = createBottomTabNavigator<TabParamList>()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.navy,
    background: theme.paper,
    card: theme.white,
    text: theme.navy,
    border: theme.line,
    notification: theme.aqua,
  },
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.paper },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', color: theme.navy },
        tabBarActiveTintColor: theme.navy,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.72)',
          borderTopColor: 'rgba(255,255,255,0.85)',
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const name = route.name === 'Home'
            ? (focused ? 'home' : 'home-outline')
            : route.name === 'Activity'
              ? (focused ? 'swap-vertical' : 'swap-vertical-outline')
              : (focused ? 'person' : 'person-outline')
          return <Ionicons name={name} color={color} size={size - 2} />
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity', headerShown: false }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'You', headerShown: false }} />
    </Tabs.Navigator>
  )
}

function Root() {
  const { ready, user } = useSession()
  if (!ready) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator color={theme.aqua} />
      </View>
    )
  }
  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <SignInScreen />
      </>
    )
  }
  return (
    <FamilyProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.paper },
            headerShadowVisible: false,
            headerTintColor: theme.navy,
            headerTitleStyle: { fontWeight: '600', fontSize: 17 },
            contentStyle: { backgroundColor: theme.paper },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Student" component={StudentScreen} options={{ title: 'Student' }} />
          <Stack.Screen name="Pay" component={PayScreen} options={{ title: 'Pay fees' }} />
          <Stack.Screen name="AccountSection" component={AccountSectionScreen} options={{ title: 'Account' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </FamilyProvider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.frame}>
        <View style={styles.shell}>
          <SessionProvider>
            <Root />
          </SessionProvider>
        </View>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#D7EEEA', alignItems: 'center' },
  shell: { flex: 1, width: '100%', maxWidth: 440, backgroundColor: '#F3F8F7' },
  boot: { flex: 1, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' },
})
