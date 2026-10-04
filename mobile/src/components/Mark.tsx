import { Image } from 'react-native'

export function Mark({ size = 44 }: { size?: number }) {
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="UPSA Next Payment"
      source={require('../../assets/mark.png')}
      style={{ width: size, height: size }}
    />
  )
}
