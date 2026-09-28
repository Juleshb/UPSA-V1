import Svg, { Circle, Path, Rect } from 'react-native-svg'

export function Mark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image" accessibilityLabel="UPSA Next Payment">
      <Rect width="120" height="120" rx="28" fill="#092B3C" />
      <Path fill="#F7FAF9" d="M60 16 24 33v27c0 24 18 38 36 46V16Z" />
      <Path fill="#18D6B4" d="M60 16 96 33v27c0 24-18 38-36 46V16Z" />
      <Rect x="32" y="45" width="24" height="20" rx="3.5" fill="#092B3C" />
      <Path d="M38 46.5V39a6 6 0 0 1 12 0v7.5" fill="none" stroke="#092B3C" strokeWidth="4.2" strokeLinecap="round" />
      <Circle cx="44" cy="53" r="2.6" fill="#F7FAF9" />
      <Path d="M42.6 54.8h2.8l-.65 5.4h-1.5z" fill="#F7FAF9" />
      <Path d="M66 64.5 75 76.5 88 56" fill="none" stroke="#092B3C" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
