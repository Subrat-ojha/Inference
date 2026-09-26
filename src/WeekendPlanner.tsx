import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AuthSessionError, getAccessToken } from './auth'
import { hyderabadWeekendEvents } from './weekend-events'
import './weekend-planner.css'

type PlannerItem = {
  id: string
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  location: string
  details: string
  url: string
  sourceUrl: string
  kind: 'task' | 'event'
  tentative: boolean
  completed: boolean
}

type PlannerState = { items: PlannerItem[] }
type LocalPlannerRecord = { version: 1; state: PlannerState; dirty: boolean; updatedAt: string | null }
type WeekendPlannerProps = {
  apiUrl: string
  userId: string
  isDemo?: boolean
  onSessionExpired: () => Promise<void>
}
type SyncStatus = 'loading' | 'saving' | 'saved' | 'offline' | 'demo'

const localPrefix = 'weekend-planner:v1:'
const emptyState: PlannerState = { items: [] }
function seededEvents(): PlannerItem[] {
  return hyderabadWeekendEvents.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    details: `${event.admission}. ${event.description}`,
    url: event.registrationUrl,
    sourceUrl: event.sourceUrl,
    kind: 'event',
    tentative: true,
    completed: false,
  }))
}

const demoState: PlannerState = { items: seededEvents() }

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function initialSaturday(): string {
  const now = new Date()
  const todayKey = dateKey(now)
  const nextEvent = hyderabadWeekendEvents
    .filter((event) => event.endDate >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (nextEvent) {
    const eventDate = dateFromKey(nextEvent.date)
    if (eventDate.getDay() === 0) eventDate.setDate(eventDate.getDate() - 1)
    else if (eventDate.getDay() !== 6) eventDate.setDate(eventDate.getDate() - ((eventDate.getDay() + 1) % 7))
    eventDate.setHours(0, 0, 0, 0)
    return dateKey(eventDate)
  }
  const day = now.getDay()
  const offset = day === 0 ? -1 : (6 - day + 7) % 7
  now.setDate(now.getDate() + offset)
  now.setHours(0, 0, 0, 0)
  return dateKey(now)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(key: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('en-IN', options).format(dateFromKey(key))
}

function normalizeState(value: unknown): PlannerState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return emptyState
  return {
    items: items.filter((item): item is PlannerItem => Boolean(item && typeof item === 'object'
      && typeof (item as PlannerItem).id === 'string'
      && typeof (item as PlannerItem).title === 'string'
      && typeof (item as PlannerItem).date === 'string'
      && typeof (item as PlannerItem).endDate === 'string'))
      .map((item) => ({ ...item, tentative: item.kind === 'event' ? item.tentative !== false : false, completed: item.completed === true })),
  }
}

function loadLocalRecord(userId: string): LocalPlannerRecord {
  try {
    const raw = localStorage.getItem(`${localPrefix}${userId}`)
    if (!raw) return { version: 1, state: emptyState, dirty: false, updatedAt: null }
    const parsed = JSON.parse(raw) as Partial<LocalPlannerRecord>
    return {
      version: 1,
      state: normalizeState(parsed.state),
      dirty: parsed.version === 1 && parsed.dirty === true,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch {
    return { version: 1, state: emptyState, dirty: false, updatedAt: null }
  }
}

function storeLocalRecord(userId: string, state: PlannerState, dirty: boolean, updatedAt: string | null) {
  const record: LocalPlannerRecord = { version: 1, state, dirty, updatedAt }
  localStorage.setItem(`${localPrefix}${userId}`, JSON.stringify(record))
}

function createId(): string {
  return crypto.randomUUID()
}

export default function WeekendPlanner({ apiUrl, userId, isDemo = false, onSessionExpired }: WeekendPlannerProps) {
  const localRecord = useRef<LocalPlannerRecord>(isDemo
    ? { version: 1, state: demoState, dirty: false, updatedAt: null }
    : loadLocalRecord(userId))
  const [state, setState] = useState<PlannerState>(localRecord.current.state)
  const [dirty, setDirty] = useState(localRecord.current.dirty)
  const [hydrated, setHydrated] = useState(isDemo)
  const [status, setStatus] = useState<SyncStatus>(isDemo ? 'demo' : 'loading')
  const [error, setError] = useState('')
  const [retryVersion, setRetryVersion] = useState(0)
  const [weekend, setWeekend] = useState(initialSaturday)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState(initialSaturday)
  const [taskTime, setTaskTime] = useState('')
  const [taskDetails, setTaskDetails] = useState('')
  const [taskUrl, setTaskUrl] = useState('')
  const agendaRef = useRef<HTMLElement>(null)
  const serverUpdatedAt = useRef<string | null>(localRecord.current.updatedAt)
  const revision = useRef(0)

  const updateState = (updater: (current: PlannerState) => PlannerState) => {
    revision.current += 1
    localRecord.current.dirty = true
    setDirty(true)
    setState(updater)
  }

  useEffect(() => {
    if (isDemo) return
    let cancelled = false
    const load = async () => {
      try {
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/planner`, { headers: { Authorization: `Bearer ${token}` } })
        if (response.status === 401) {
          await onSessionExpired()
          return
        }
        const payload = await response.json().catch(() => null) as { state?: unknown; updatedAt?: string | null; error?: string } | null
        if (!response.ok || !payload?.state) throw new Error(payload?.error || 'Your weekend plan could not load.')
        if (!cancelled) {
          if (localRecord.current.dirty) {
            setStatus('saving')
          } else {
            const remoteState = normalizeState(payload.state)
            serverUpdatedAt.current = payload.updatedAt ?? null
            if (payload.updatedAt === null && remoteState.items.length === 0) {
              const firstRunState = { items: seededEvents() }
              localRecord.current.dirty = true
              setState(firstRunState)
              setDirty(true)
              storeLocalRecord(userId, firstRunState, true, serverUpdatedAt.current)
              setStatus('saving')
            } else {
              setState(remoteState)
              storeLocalRecord(userId, remoteState, false, serverUpdatedAt.current)
              setStatus('saved')
            }
          }
        }
      } catch (loadError) {
        if (loadError instanceof AuthSessionError) {
          await onSessionExpired().catch(() => undefined)
          return
        }
        if (!cancelled) {
          setError('Neon is unavailable. Your weekend plan stays in this browser until sync returns.')
          setStatus('offline')
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [apiUrl, isDemo, onSessionExpired, userId])

  useEffect(() => {
    if (isDemo) return
    const retrySync = () => setRetryVersion((current) => current + 1)
    window.addEventListener('online', retrySync)
    return () => window.removeEventListener('online', retrySync)
  }, [isDemo])

  useEffect(() => {
    if (!hydrated || isDemo) return
    storeLocalRecord(userId, state, dirty, serverUpdatedAt.current)
    if (!dirty) return
    const currentRevision = revision.current
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      try {
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/planner`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        })
        if (response.status === 401) {
          await onSessionExpired()
          return
        }
        const payload = await response.json().catch(() => null) as { updatedAt?: string; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'Your weekend plan could not save.')
        if (revision.current === currentRevision) {
          serverUpdatedAt.current = payload?.updatedAt ?? new Date().toISOString()
          storeLocalRecord(userId, state, false, serverUpdatedAt.current)
          localRecord.current.dirty = false
          setDirty(false)
          setStatus('saved')
          setError('')
        }
      } catch (saveError) {
        if (saveError instanceof AuthSessionError) {
          await onSessionExpired().catch(() => undefined)
          return
        }
        setError('Your latest changes are safe in this browser and will sync when the connection returns.')
        setStatus('offline')
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [apiUrl, dirty, hydrated, isDemo, onSessionExpired, retryVersion, state, userId])

  const saturday = useMemo(() => dateFromKey(weekend), [weekend])
  const sunday = useMemo(() => dateKey(addDays(saturday, 1)), [saturday])
  const thisWeekendItems = useMemo(() => state.items
    .filter((item) => item.date <= sunday && item.endDate >= weekend)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)), [state.items, sunday, weekend])
  const upcomingEvents = hyderabadWeekendEvents.filter((event) => event.endDate >= dateKey(new Date()))
  const completedCount = state.items.filter((item) => item.completed).length

  const addEvent = (eventId: string) => {
    const event = hyderabadWeekendEvents.find((candidate) => candidate.id === eventId)
    if (!event || state.items.some((item) => item.id === event.id)) return
    updateState((current) => ({ items: [...current.items, ...seededEvents().filter((item) => item.id === event.id)] }))
    const eventDay = dateFromKey(event.date)
    const eventSaturday = dateKey(eventDay.getDay() === 0 ? addDays(eventDay, -1) : eventDay)
    setWeekend(eventSaturday)
    setTaskDate(eventSaturday)
    window.setTimeout(() => {
      agendaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      agendaRef.current?.focus({ preventScroll: true })
    }, 0)
  }

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = taskTitle.trim()
    if (!title || taskDate !== weekend && taskDate !== sunday) return
    updateState((current) => ({
      items: [...current.items, {
        id: createId(),
        title,
        date: taskDate,
        endDate: taskDate,
        startTime: taskTime,
        endTime: '',
        location: '',
        details: taskDetails.trim(),
        url: taskUrl.trim(),
        sourceUrl: '',
        kind: 'task',
        tentative: false,
        completed: false,
      }],
    }))
    setTaskTitle('')
    setTaskTime('')
    setTaskDetails('')
    setTaskUrl('')
  }

  const toggleComplete = (id: string) => updateState((current) => ({
    items: current.items.map((item) => item.id === id ? { ...item, completed: !item.completed } : item),
  }))

  const toggleTentative = (id: string) => updateState((current) => ({
    items: current.items.map((item) => item.id === id ? { ...item, tentative: !item.tentative } : item),
  }))

  const deleteItem = (id: string) => updateState((current) => ({ items: current.items.filter((item) => item.id !== id) }))

  const changeWeekend = (offset: number) => {
    const next = addDays(saturday, offset * 7)
    const nextKey = dateKey(next)
    setWeekend(nextKey)
    setTaskDate(nextKey)
  }

  const syncText: Record<SyncStatus, string> = {
    loading: 'Loading plan',
    saving: 'Saving plan',
    saved: 'Saved to Neon',
    offline: 'Saved in browser',
    demo: 'Preview data',
  }

  return (
    <section className="weekend-planner" aria-labelledby="weekend-planner-title">
      <header className="weekend-heading">
        <div>
          <h2 id="weekend-planner-title">Weekend planner</h2>
          <p>Free Saturdays and Sundays in Hyderabad, organized into one clear plan.</p>
        </div>
        <div className={`weekend-sync is-${status}`} role="status" aria-live="polite">
          <span>{syncText[status]}</span>
          <b>{completedCount} completed · {state.items.length} saved</b>
        </div>
      </header>

      {error && <p className="weekend-error" role="alert">{error}</p>}

      <div className="weekend-date-strip">
        <div>
          <span>Selected weekend</span>
          <strong>{formatDate(weekend, { day: 'numeric', month: 'long' })}–{formatDate(sunday, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        </div>
        <div className="weekend-arrows" aria-label="Choose weekend">
          <button type="button" onClick={() => changeWeekend(-1)} aria-label="Previous weekend">Previous</button>
          <button type="button" onClick={() => changeWeekend(1)} aria-label="Next weekend">Next</button>
        </div>
      </div>

      <div className="weekend-layout">
        <section className="weekend-events" aria-labelledby="weekend-events-title">
          <header>
            <div>
              <h3 id="weekend-events-title">Free Hyderabad events</h3>
              <p>Upcoming weekend picks · checked 26 Sep 2026</p>
            </div>
            <span>{upcomingEvents.length} listings</span>
          </header>
          {upcomingEvents.length ? (
            <ol>
              {upcomingEvents.map((event) => {
                const saved = state.items.some((item) => item.id === event.id)
                return (
                  <li key={event.id}>
                    <div className="weekend-event-date">
                      <b>{formatDate(event.date, { day: '2-digit' })}</b>
                      <small>{formatDate(event.date, { month: 'short' })}</small>
                    </div>
                    <div className="weekend-event-copy">
                      <strong>{event.title}</strong>
                      <span>{event.startTime ? `${event.startTime}–${event.endTime} · ` : 'Full day · '}{event.location}</span>
                      <span className="weekend-admission">{event.admission}</span>
                      <p>{event.description}</p>
                      <div className="weekend-event-links">
                        <a href={event.registrationUrl} target="_blank" rel="noreferrer">Registration details</a>
                        {event.sourceUrl !== event.registrationUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">Event source</a>}
                      </div>
                    </div>
                    <button type="button" className="weekend-add-event" disabled={saved || !hydrated && !isDemo} onClick={() => addEvent(event.id)}>
                      {saved ? 'Tentative in plan' : 'Add as tentative'}
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="weekend-empty-events">No upcoming picks are listed right now. Your saved weekend tasks stay here; check again for new local listings.</p>
          )}
          <p className="weekend-source-note">Listings can change. Check the organizer before travelling; saving an event here does not register you.</p>
        </section>

        <section className="weekend-agenda" ref={agendaRef} tabIndex={-1} aria-labelledby="weekend-agenda-title">
          <header>
            <div>
              <h3 id="weekend-agenda-title">My weekend plan</h3>
              <p>{thisWeekendItems.length ? `${thisWeekendItems.length} items · Saturday and Sunday only` : 'Nothing saved for this weekend yet.'}</p>
            </div>
            <span>{formatDate(weekend)} / {formatDate(sunday)}</span>
          </header>

          {(['Saturday', 'Sunday'] as const).map((dayName, index) => {
            const dayKey = index === 0 ? weekend : sunday
            const dayItems = thisWeekendItems.filter((item) => item.date <= dayKey && item.endDate >= dayKey)
            return (
              <section className="weekend-day" key={dayKey} aria-labelledby={`weekend-day-${dayKey}`}>
                <h4 id={`weekend-day-${dayKey}`}>{dayName} <time dateTime={dayKey}>{formatDate(dayKey, { day: 'numeric', month: 'long' })}</time></h4>
                {dayItems.length ? (
                  <ol>
                    {dayItems.map((item) => (
                      <li className={item.completed ? 'is-complete' : ''} key={item.id}>
                        <label className="weekend-item-title">
                          <input type="checkbox" checked={item.completed} disabled={!hydrated && !isDemo} onChange={() => toggleComplete(item.id)} />
                          <span className="weekend-item-body">
                            <strong>{item.title}</strong>
                            {item.kind === 'event' && <small className={`weekend-event-status${item.tentative ? ' is-tentative' : ' is-chosen'}`}>{item.tentative ? 'Tentative · not registered' : 'Chosen · registration still separate'}</small>}
                          </span>
                        </label>
                        <div className="weekend-item-meta">
                          {(item.startTime || item.endTime) && <small>{item.startTime}{item.endTime ? `–${item.endTime}` : ''}</small>}
                          {item.location && <small>{item.location}</small>}
                          {item.details && <span>{item.details}</span>}
                          {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.kind === 'event' ? 'Open registration' : 'Open link'}</a>}
                          {item.sourceUrl && item.sourceUrl !== item.url && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Verify event details</a>}
                        </div>
                        {item.kind === 'event' && <button type="button" className="weekend-tentative-toggle" disabled={!hydrated && !isDemo} onClick={() => toggleTentative(item.id)}>{item.tentative ? 'Mark chosen' : 'Mark tentative'}</button>}
                        <button type="button" className="weekend-delete" disabled={!hydrated && !isDemo} aria-label={`Remove ${item.title}`} onClick={() => deleteItem(item.id)}>Remove</button>
                      </li>
                    ))}
                  </ol>
                ) : <p className="weekend-day-empty">No plans yet</p>}
              </section>
            )
          })}

          <form className="weekend-task-form" onSubmit={addTask}>
            <h4>Add a task</h4>
            <label>
              <span>What do you want to do?</span>
              <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={160} placeholder="e.g. Practice Java interview questions" required disabled={!hydrated && !isDemo} />
            </label>
            <div className="weekend-form-row">
              <label>
                <span>Day</span>
                <select value={taskDate} onChange={(event) => setTaskDate(event.target.value)} disabled={!hydrated && !isDemo}>
                  <option value={weekend}>Saturday · {formatDate(weekend)}</option>
                  <option value={sunday}>Sunday · {formatDate(sunday)}</option>
                </select>
              </label>
              <label>
                <span>Time (optional)</span>
                <input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} disabled={!hydrated && !isDemo} />
              </label>
            </div>
            <label>
              <span>Notes or steps (optional)</span>
              <textarea value={taskDetails} onChange={(event) => setTaskDetails(event.target.value)} maxLength={3_000} rows={3} placeholder="Write the next action so you can start without planning again." disabled={!hydrated && !isDemo} />
            </label>
            <label>
              <span>Link (optional)</span>
              <input type="url" value={taskUrl} onChange={(event) => setTaskUrl(event.target.value)} placeholder="https://…" disabled={!hydrated && !isDemo} />
            </label>
            <button type="submit" className="weekend-submit" disabled={!hydrated && !isDemo}>Save to my weekend</button>
          </form>
        </section>
      </div>
    </section>
  )
}
