import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  API_GROUPS,
  SEEDED_ACCOUNTS,
  endpointById,
  endpoints,
  resolvePath,
  type Endpoint,
  type HttpMethod,
} from '../developers/catalog'
import { usePageTitle } from '../components/usePageTitle'

type SessionUser = {
  userId: string
  email: string
  fullName: string
  role: string
  permissions?: string[]
}

type ApiResponse = {
  ok: boolean
  status: number
  ms: number
  body: string
  headers: Record<string, string>
}

const TOKEN_KEY = 'rupsa.dev.token'
const USER_KEY = 'rupsa.dev.user'
const BASE_KEY = 'rupsa.dev.base'

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function newClientId() {
  return `rupsa-docs-${Math.random().toString(36).slice(2, 8)}`
}

function newRequestId() {
  return `REQ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()
}

function newIdempotencyKey() {
  return crypto.randomUUID()
}

function pretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function highlightJson(value: string) {
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return escaped.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let kind = 'number'
      if (match.startsWith('"')) kind = match.endsWith(':') ? 'key' : 'string'
      else if (match === 'true' || match === 'false') kind = 'boolean'
      else if (match === 'null') kind = 'null'
      return `<span class="tok-${kind}">${match}</span>`
    },
  )
}

function buildUrl(baseUrl: string, path: string, query: Record<string, string>) {
  const origin = baseUrl.replace(/\/$/, '')
  const url = new URL(`${origin || window.location.origin}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value.trim()) url.searchParams.set(key, value.trim())
  }
  const href = url.toString()
  return origin ? href : `${url.pathname}${url.search}`
}

async function sendRequest(input: {
  endpoint: Endpoint
  baseUrl: string
  token: string
  pathValues: Record<string, string>
  queryValues: Record<string, string>
  body: string
}): Promise<ApiResponse> {
  const path = resolvePath(input.endpoint.path, input.pathValues)
  const url = buildUrl(input.baseUrl, path, input.queryValues)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-ID': newClientId(),
    'X-Request-ID': newRequestId(),
    'X-Correlation-ID': newRequestId(),
  }
  if (input.endpoint.method !== 'GET') headers['Content-Type'] = 'application/json'
  if (input.endpoint.auth && input.token) headers.Authorization = `Bearer ${input.token}`
  if (input.endpoint.idempotent) headers['Idempotency-Key'] = newIdempotencyKey()

  const started = performance.now()
  const response = await fetch(url, {
    method: input.endpoint.method,
    headers,
    body: input.endpoint.method === 'GET' ? undefined : input.body,
  })
  const text = await response.text()
  const headerMap: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headerMap[key] = value
  })
  return {
    ok: response.ok,
    status: response.status,
    ms: Math.round(performance.now() - started),
    body: pretty(text || '{}'),
    headers: headerMap,
  }
}

function curlFor(endpoint: Endpoint, url: string, token: string, body: string) {
  const lines = [`curl -sS -X ${endpoint.method} '${url}'`]
  lines.push(`  -H 'Content-Type: application/json'`)
  lines.push(`  -H 'X-Client-ID: sandbox-console'`)
  if (endpoint.auth) lines.push(`  -H 'Authorization: Bearer ${token || '<access-token>'}'`)
  if (endpoint.idempotent) lines.push(`  -H 'Idempotency-Key: ${newIdempotencyKey()}'`)
  if (endpoint.method !== 'GET' && body.trim()) {
    lines.push(`  -d '${body.replaceAll("'", "'\\''")}'`)
  }
  return lines.join(' \\\n')
}

export function Developers() {
  usePageTitle('API sandbox — UPSA Next Payment')
  const [params, setParams] = useSearchParams()
  const selected = endpointById(params.get('try') || 'auth-login')

  const [query, setQuery] = useState('')
  const [baseUrl, setBaseUrl] = useState(() => sessionStorage.getItem(BASE_KEY) ?? (import.meta.env.PROD ? 'https://stackpay.online' : 'http://localhost:4000'))
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '')
  const [user, setUser] = useState<SessionUser | null>(() => readStore<SessionUser | null>(USER_KEY, null))
  const [email, setEmail] = useState<string>(SEEDED_ACCOUNTS[0].email)
  const [password, setPassword] = useState<string>(SEEDED_ACCOUNTS[0].password)
  const [health, setHealth] = useState<'checking' | 'up' | 'down'>('checking')
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryValues, setQueryValues] = useState<Record<string, string>>({})
  const [body, setBody] = useState(selected.body ?? '')
  const [busy, setBusy] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [codeTab, setCodeTab] = useState<'curl' | 'fetch'>('curl')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    sessionStorage.setItem(BASE_KEY, baseUrl)
  }, [baseUrl])

  useEffect(() => {
    const examples: Record<string, string> = {}
    for (const field of selected.pathParams ?? []) examples[field.name] = field.example
    const queries: Record<string, string> = {}
    for (const field of selected.queryParams ?? []) queries[field.name] = field.example
    setPathValues(examples)
    setQueryValues(queries)
    setBody(selected.body ?? '')
    setError('')
  }, [selected.id, selected.body, selected.pathParams, selected.queryParams])

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const origin = baseUrl.replace(/\/$/, '')
        const response = await fetch(`${origin}/health`)
        if (!cancelled) setHealth(response.ok ? 'up' : 'down')
      } catch {
        if (!cancelled) setHealth('down')
      }
    }
    void ping()
    const timer = window.setInterval(ping, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [baseUrl])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return endpoints.filter((item) => {
      if (!needle) return true
      return `${item.group} ${item.title} ${item.path} ${item.method}`.toLowerCase().includes(needle)
    })
  }, [query])

  const grouped = useMemo(() => {
    return API_GROUPS.map((group) => ({
      group,
      items: filtered.filter((item) => item.group === group),
    })).filter((entry) => entry.items.length > 0)
  }, [filtered])

  const resolvedPath = resolvePath(selected.path, pathValues)
  const previewUrl = buildUrl(baseUrl, resolvedPath, queryValues)
  const snippet = codeTab === 'curl'
    ? curlFor(selected, previewUrl.startsWith('http') ? previewUrl : `${baseUrl}${resolvedPath}`, token, body)
    : `const response = await fetch('${previewUrl}', {\n  method: '${selected.method}',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-Client-ID': 'sandbox-console',${selected.auth ? `\n    Authorization: 'Bearer ${token || '<access-token>'}',` : ''}${selected.idempotent ? `\n    'Idempotency-Key': crypto.randomUUID(),` : ''}\n  },${selected.method === 'GET' ? '' : `\n  body: \`${body}\`,`}\n})`

  function selectEndpoint(id: string) {
    setParams({ try: id }, { replace: true })
    setResult(null)
  }

  function persistSession(nextToken: string, nextUser: SessionUser) {
    setToken(nextToken)
    setUser(nextUser)
    sessionStorage.setItem(TOKEN_KEY, nextToken)
    sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser))
  }

  function clearSession() {
    setToken('')
    setUser(null)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  async function login(nextEmail: string = email, nextPassword: string = password) {
    setAuthBusy(true)
    setError('')
    try {
      const response = await sendRequest({
        endpoint: endpointById('auth-login'),
        baseUrl,
        token: '',
        pathValues: {},
        queryValues: {},
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      })
      const parsed = JSON.parse(response.body) as {
        accessToken?: string
        user?: SessionUser
        error?: { message: string }
      }
      if (!response.ok || !parsed.accessToken || !parsed.user) {
        throw new Error(parsed.error?.message || 'Login failed.')
      }
      persistSession(parsed.accessToken, parsed.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function run() {
    setBusy(true)
    setError('')
    try {
      if (selected.method !== 'GET' && body.trim()) JSON.parse(body)
      const response = await sendRequest({
        endpoint: selected,
        baseUrl,
        token,
        pathValues,
        queryValues,
        body,
      })
      setResult(response)
      if (selected.id === 'auth-login' && response.ok) {
        const parsed = JSON.parse(response.body) as { accessToken?: string; user?: SessionUser }
        if (parsed.accessToken && parsed.user) persistSession(parsed.accessToken, parsed.user)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(''), 1400)
  }

  return (
    <main className="dev-page">
      <section className="dev-hero">
        <div>
          <div className="eyebrow"><span /> Developers</div>
          <h1>API sandbox</h1>
          <p>Inspect every v1 route, authenticate as a seeded actor, and send live requests against the local UPSA Next Payment API.</p>
        </div>
        <dl className="dev-hero-meta">
          <div>
            <dt>Style</dt>
            <dd>REST · JSON · Bearer</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>/api/v1</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>RWF</dd>
          </div>
        </dl>
      </section>

      <section className="dev-shell" aria-label="API console">
        <header className="dev-toolbar">
          <div className="dev-toolbar-left">
            <span className={`dev-pulse ${health}`}>
              <i />
              {health === 'up' ? 'Sandbox live' : health === 'down' ? 'API unreachable' : 'Checking API'}
            </span>
            <label className="dev-base">
              <span>Base URL</span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
          <div className="dev-session">
            {user ? (
              <>
                <div>
                  <b>{user.fullName}</b>
                  <small>{user.role.replaceAll('_', ' ')}</small>
                </div>
                <button type="button" className="dev-ghost" onClick={() => void copy('token', token)}>
                  {copied === 'token' ? 'Copied' : 'Copy token'}
                </button>
                <button type="button" className="dev-ghost" onClick={clearSession}>Sign out</button>
              </>
            ) : (
              <form
                className="dev-login"
                onSubmit={(event) => {
                  event.preventDefault()
                  void login()
                }}
              >
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  aria-label="Email"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-label="Password"
                />
                <button type="submit" className="dev-send compact" disabled={authBusy}>
                  {authBusy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}
          </div>
        </header>

        {!user && (
          <div className="dev-accounts" aria-label="Seeded sandbox accounts">
            {SEEDED_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(account.password)
                  void login(account.email, account.password)
                }}
              >
                <b>{account.label}</b>
                <span>{account.email}</span>
              </button>
            ))}
          </div>
        )}

        <div className="dev-workspace">
          <aside className="dev-nav">
            <label className="dev-search">
              <span className="sr-only">Search endpoints</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search routes, methods, domains"
              />
            </label>
            <nav>
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <h2>{group}</h2>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === selected.id ? 'active' : undefined}
                      onClick={() => selectEndpoint(item.id)}
                    >
                      <MethodBadge method={item.method} />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <div className="dev-main">
            <header className="dev-endpoint">
              <div>
                <div className="dev-path">
                  <MethodBadge method={selected.method} />
                  <code>{selected.path}</code>
                </div>
                <h2>{selected.title}</h2>
                <p>{selected.description}</p>
              </div>
              <ul className="dev-chips">
                <li>{selected.auth ? 'Bearer token' : 'Public'}</li>
                {selected.permission && <li>{selected.permission}</li>}
                {selected.idempotent && <li>Idempotency-Key</li>}
                <li>X-Request-ID</li>
              </ul>
            </header>

            <div className="dev-split">
              <form
                className="dev-try"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run()
                }}
              >
                <div className="dev-panel-head">
                  <h3>Try it</h3>
                  <button type="submit" className="dev-send" disabled={busy}>
                    {busy ? 'Sending…' : 'Send request'}
                  </button>
                </div>

                {(selected.pathParams ?? []).map((field) => (
                  <label key={field.name} className="dev-field">
                    <span>:{field.name}</span>
                    <input
                      value={pathValues[field.name] ?? ''}
                      onChange={(event) => setPathValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      spellCheck={false}
                    />
                    <small>{field.description}</small>
                  </label>
                ))}

                {(selected.queryParams ?? []).map((field) => (
                  <label key={field.name} className="dev-field">
                    <span>?{field.name}</span>
                    <input
                      value={queryValues[field.name] ?? ''}
                      onChange={(event) => setQueryValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      spellCheck={false}
                    />
                    <small>{field.description}</small>
                  </label>
                ))}

                {selected.method !== 'GET' && (
                  <label className="dev-field">
                    <span>JSON body</span>
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      spellCheck={false}
                      rows={12}
                    />
                  </label>
                )}

                {error && <p className="dev-error" role="alert">{error}</p>}
                {selected.auth && !token && (
                  <p className="dev-hint">Sign in above first. Protected routes return 401 without a Bearer token.</p>
                )}
              </form>

              <div className="dev-result">
                <div className="dev-panel-head">
                  <h3>Response</h3>
                  {result && (
                    <div className="dev-status">
                      <b className={result.ok ? 'ok' : 'bad'}>{result.status}</b>
                      <span>{result.ms} ms</span>
                      <button type="button" className="dev-ghost" onClick={() => void copy('response', result.body)}>
                        {copied === 'response' ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                  )}
                </div>
                {result ? (
                  <>
                    <pre
                      className="dev-json"
                      tabIndex={0}
                      dangerouslySetInnerHTML={{ __html: highlightJson(result.body) }}
                    />
                    <dl className="dev-headers">
                      {Object.entries(result.headers).slice(0, 8).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <div className="dev-empty">
                    <p>Send a request to inspect status, latency, JSON and response headers.</p>
                    <code>{selected.method} {resolvedPath}</code>
                  </div>
                )}
              </div>
            </div>

            <div className="dev-code">
              <div className="dev-panel-head">
                <div className="dev-tabs">
                  <button type="button" className={codeTab === 'curl' ? 'active' : undefined} onClick={() => setCodeTab('curl')}>cURL</button>
                  <button type="button" className={codeTab === 'fetch' ? 'active' : undefined} onClick={() => setCodeTab('fetch')}>fetch</button>
                </div>
                <button type="button" className="dev-ghost" onClick={() => void copy('code', snippet)}>
                  {copied === 'code' ? 'Copied' : 'Copy snippet'}
                </button>
              </div>
              <pre>{snippet}</pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return <em className={`dev-method ${method.toLowerCase()}`}>{method}</em>
}
