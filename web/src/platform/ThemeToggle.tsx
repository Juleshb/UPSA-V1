import { GraphicIcon } from '../components/Graphics'
import { useTheme } from './ThemeContext'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`app-theme${compact ? ' compact' : ''}`} role="group" aria-label="Workspace appearance">
      <button
        type="button"
        className={theme === 'primary' ? 'active' : ''}
        aria-pressed={theme === 'primary'}
        aria-label="Primary UI"
        onClick={() => setTheme('primary')}
      >
        <GraphicIcon name="sun" />
        {compact ? null : 'Primary'}
      </button>
      <button
        type="button"
        className={theme === 'reversed' ? 'active' : ''}
        aria-pressed={theme === 'reversed'}
        aria-label="Reversed UI"
        onClick={() => setTheme('reversed')}
      >
        <GraphicIcon name="moon" />
        {compact ? null : 'Reversed'}
      </button>
    </div>
  )
}
