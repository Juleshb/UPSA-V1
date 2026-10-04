import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../components/usePageTitle'
import { ServiceApplyModal } from '../components/ServiceApplyModal'
import { onlineServices, serviceGroups, type OnlineService } from '../onlineServices'

export function OnlineServices() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [service, setService] = useState<OnlineService | null>(null)
  const [params, setParams] = useSearchParams()
  usePageTitle('Online services — UPSA Next Payment')

  useEffect(() => {
    const open = params.get('open')
    if (!open) return
    const match = onlineServices.find((item) => item.label === open)
    if (match) setService(match)
  }, [params])

  function closeService() {
    setService(null)
    if (!params.get('open')) return
    const next = new URLSearchParams(params)
    next.delete('open')
    setParams(next, { replace: true })
  }

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return serviceGroups
      .filter((name) => group === 'All' || name === group)
      .map((name) => ({
        name,
        items: onlineServices.filter((item) => {
          if (item.group !== name) return false
          if (!needle) return true
          return `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(needle)
        }),
      }))
      .filter((section) => section.items.length > 0)
  }, [group, query])

  return (
    <main className="services">
      <section className="services-hero">
        <h1>Online services</h1>
        <p>Choose a service and apply. Each one below can be started without a workspace.</p>
        <label className="services-search">
          <span className="sr-only">Search for a service</span>
          <input
            type="search"
            value={query}
            placeholder="Search for a service"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      <section className="services-body">
        <div className="services-filters" role="tablist" aria-label="Service groups">
          {['All', ...serviceGroups].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={group === name}
              onClick={() => setGroup(name)}
            >
              {name}
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <p className="services-empty">No service matches that search.</p>
        ) : (
          groups.map((section) => (
            <section key={section.name} className="services-group">
              <h2>{section.name}</h2>
              <div className="services-columns">
                {section.items.map((item) => (
                  <button key={item.label} type="button" onClick={() => setService(item)}>
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                    <em>{item.action}</em>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
      <ServiceApplyModal service={service} onClose={closeService} />
    </main>
  )
}
