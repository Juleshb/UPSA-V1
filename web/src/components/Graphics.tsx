const icons = {
  school: 'M4 18V8.5L12 4l8 4.5V18h-5v-5H9v5H4Zm8-7.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z',
  family: 'M8.2 11a2.4 2.4 0 1 0-2.4-2.4A2.4 2.4 0 0 0 8.2 11Zm7.6 0a2.4 2.4 0 1 0-2.4-2.4A2.4 2.4 0 0 0 15.8 11ZM4 19v-1.3c0-2.2 2.3-3.5 4.2-3.5.7 0 1.5.1 2.1.4C9.4 15.4 9 16.4 9 17.5V19H4Zm6.2 0v-1.5c0-2 1.9-3.3 3.8-3.3s3.8 1.3 3.8 3.3V19h-7.6Z',
  pay: 'M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6A2.5 2.5 0 0 1 3.5 16.5v-9ZM6 8.2h12V10H6V8.2Zm0 4h5V14H6v-1.8Z',
  ledger: 'M6 4.5h12v15H6v-15Zm3 3h6V9H9V7.5Zm0 3.5h6V12.5H9V11Zm0 3.5h4V16H9v-1.5Z',
  dash: 'M4 5h7v6H4V5Zm9 0h7v4h-7V5ZM4 13h7v6H4v-6Zm9 6v-8h7v8h-7Z',
  loan: 'M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5ZM8.5 12.2 12 14.1l3.5-1.9V9.8L12 7.9 8.5 9.8v2.4Z',
  shield: 'M12 3.5 19 6.2v5.4c0 4.4-3 7.4-7 8.9-4-1.5-7-4.5-7-8.9V6.2L12 3.5Zm-1 10.7 4.8-4.8 1.2 1.2-6 6-3.2-3.2 1.2-1.2 2 2Z',
  api: 'M8 7H4v10h4v-2.2H6.2V9.2H8V7Zm8 0h4v10h-4v-2.2h1.8V9.2H16V7Zm-5.2 2.4h2.4v1.8h-2.4V9.4Zm0 3.4h2.4v1.8h-2.4v-1.8Z',
  report: 'M5 19V9h3.2v10H5Zm5.4 0V5H14v14h-3.6ZM16.8 19v-7H20v7h-3.2Z',
  user: 'M12 12.4a2.7 2.7 0 1 0-2.7-2.7A2.7 2.7 0 0 0 12 12.4ZM6.2 19v-1.1c0-2.4 2.6-3.8 5.8-3.8s5.8 1.4 5.8 3.8V19H6.2Z',
  logout: 'M5 4.6h7.2v2.1H7.2v10.6h5v2.1H5V4.6Zm8.1 3.8 3.4 3.4H10v2.1h6.5l-3.4 3.4 1.5 1.5L21 12l-6.4-6.4-1.5 1.5Z',
  menu: 'M4 6.4h16v2.1H4V6.4Zm0 4.6h16v2.1H4V11Zm0 4.6h16v2.1H4v-2.1Z',
  site: 'M12 3.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8Zm0 2.1c-1.3 1.5-2.1 3.6-2.3 6.1h4.6c-.2-2.5-1-4.6-2.3-6.1Zm-4.5 8.2c.2 2.5 1 4.6 2.3 6.1 1.3-1.5 2.1-3.6 2.3-6.1H7.5Zm6.7 0c-.2 2.5-1 4.6-2.3 6.1-1.3-1.5-2.1-3.6-2.3-6.1h4.6Z',
  sun: 'M12 7.2A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2ZM11 3h2v2.4h-2V3Zm0 15.6h2V21h-2v-2.4ZM3 11h2.4v2H3v-2Zm15.6 0H21v2h-2.4v-2ZM5.2 4.8l1.7-1.7 1.7 1.7-1.7 1.7-1.7-1.7Zm10.2 10.2 1.7-1.7 1.7 1.7-1.7 1.7-1.7-1.7ZM17.1 3.1l1.7 1.7-1.7 1.7-1.7-1.7 1.7-1.7ZM5.2 19.2l1.7-1.7 1.7 1.7-1.7 1.7-1.7-1.7Z',
  moon: 'M13.8 4.2A7.8 7.8 0 1 0 19.7 14 6.4 6.4 0 0 1 13.8 4.2Z',
  search: 'M10.4 4.2a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4Zm0 2.1a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2Zm6.3 8.1 4.3 4.3-1.5 1.5-4.3-4.3 1.5-1.5Z',
  chevron: 'M7.2 9.2 12 14l4.8-4.8 1.4 1.4L12 16.8 5.8 10.6l1.4-1.4Z',
} as const

export type GraphicName = keyof typeof icons

export function GraphicIcon({ name }: { name: GraphicName }) {
  return (
    <svg className="graphic-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  )
}

export function OrbitScene() {
  return (
    <div className="orbit-scene" aria-hidden="true">
      <span className="orbit-ring one" />
      <span className="orbit-ring two" />
      <span className="orbit-ring three" />
      <img className="orbit-core" src="/rupsa-next-icon.svg" alt="" />
      <span className="orbit-sat sat-a"><GraphicIcon name="school" /></span>
      <span className="orbit-sat sat-b"><GraphicIcon name="family" /></span>
      <span className="orbit-sat sat-c"><GraphicIcon name="loan" /></span>
    </div>
  )
}
