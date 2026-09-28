import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AuthSessionError, getAccessToken } from './auth'
import './schedule.css'

type ScheduleCategory = 'work' | 'personal' | 'learning' | 'health' | 'travel' | 'other'
type ScheduleItem = {
  id: string
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  allDay: boolean
  kind: 'task' | 'event'
  category: ScheduleCategory
  location: string
  details: string
  url: string
  completed: boolean
}
type ScheduleState = { items: ScheduleItem[] }
type LocalRecord = { version: 1; state: ScheduleState; dirty: boolean; updatedAt: string | null }
type ScheduleProps = { apiUrl: string; userId: string; isDemo?: boolean; onSessionExpired: () => Promise<void> }
type FormState = Omit<ScheduleItem, 'id' | 'completed'>

const storagePrefix = 'personal-schedule:v1:'
const emptyState: ScheduleState = { items: [] }
const categoryLabels: Record<ScheduleCategory, string> = {
  work: 'Work', personal: 'Personal', learning: 'Learning', health: 'Health', travel: 'Travel', other: 'Other',
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function moveDate(value: string, amount: number): string {
  const date = fromDateKey(value)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-IN', options).format(fromDateKey(value))
}

function createId(): string { return crypto.randomUUID() }

function normalizeState(value: unknown): ScheduleState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState
  const rawItems = (value as { items?: unknown }).items
  if (!Array.isArray(rawItems)) return emptyState
  return {
    items: rawItems.filter((item): item is ScheduleItem => Boolean(item && typeof item === 'object'
      && typeof (item as ScheduleItem).id === 'string'
      && typeof (item as ScheduleItem).title === 'string'
      && typeof (item as ScheduleItem).date === 'string'
      && typeof (item as ScheduleItem).endDate === 'string'))
      .map((item) => ({ ...item, allDay: item.allDay === true, completed: item.completed === true })),
  }
}

function readLocal(userId: string): LocalRecord {
  try {
    const value = localStorage.getItem(`${storagePrefix}${userId}`)
    if (!value) return { version: 1, state: emptyState, dirty: false, updatedAt: null }
    const parsed = JSON.parse(value) as Partial<LocalRecord>
    return { version: 1, state: normalizeState(parsed.state), dirty: parsed.version === 1 && parsed.dirty === true, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null }
  } catch {
    return { version: 1, state: emptyState, dirty: false, updatedAt: null }
  }
}

function writeLocal(userId: string, state: ScheduleState, dirty: boolean, updatedAt: string | null) {
  localStorage.setItem(`${storagePrefix}${userId}`, JSON.stringify({ version: 1, state, dirty, updatedAt } satisfies LocalRecord))
}

const demoItems: ScheduleItem[] = [
  { id: 'demo-review', title: 'Project planning session', date: '2026-09-30', endDate: '2026-09-30', startTime: '10:30', endTime: '11:30', allDay: false, kind: 'event', category: 'work', location: 'Team room', details: 'Demo entry — replace it with your own schedule.', url: '', completed: false },
  { id: 'demo-study', title: 'Java practice block', date: '2026-10-03', endDate: '2026-10-03', startTime: '09:00', endTime: '10:00', allDay: false, kind: 'task', category: 'learning', location: '', details: 'Demo entry — replace it with your own schedule.', url: '', completed: false },
  { id: 'demo-doctor', title: 'Personal appointment', date: '2026-10-08', endDate: '2026-10-08', startTime: '', endTime: '', allDay: true, kind: 'event', category: 'health', location: '', details: 'Demo entry — replace it with your own schedule.', url: '', completed: false },
]

const demoState: ScheduleState = { items: demoItems }
const blankForm = (date: string): FormState => ({ title: '', date, endDate: date, startTime: '09:00', endTime: '10:00', allDay: false, kind: 'event', category: 'personal', location: '', details: '', url: '' })

export default function Schedule({ apiUrl, userId, isDemo = false, onSessionExpired }: ScheduleProps) {
  const localRecord = useRef<LocalRecord>(isDemo ? { version: 1, state: demoState, dirty: false, updatedAt: null } : readLocal(userId))
  const [state, setState] = useState<ScheduleState>(localRecord.current.state)
  const [dirty, setDirty] = useState(localRecord.current.dirty)
  const [hydrated, setHydrated] = useState(isDemo)
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'offline' | 'demo'>(isDemo ? 'demo' : 'loading')
  const [error, setError] = useState('')
  const [retryVersion, setRetryVersion] = useState(0)
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [viewDate, setViewDate] = useState(() => dateKey(new Date()).slice(0, 7) + '-01')
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all')
  const [form, setForm] = useState<FormState>(() => blankForm(dateKey(new Date())))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const serverUpdatedAt = useRef<string | null>(localRecord.current.updatedAt)
  const revision = useRef(0)

  const updateState = (updater: (current: ScheduleState) => ScheduleState) => {
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
        const response = await fetch(`${apiUrl}/schedule`, { headers: { Authorization: `Bearer ${token}` } })
        if (response.status === 401) { await onSessionExpired(); return }
        const payload = await response.json().catch(() => null) as { state?: unknown; updatedAt?: string | null; error?: string } | null
        if (!response.ok || !payload?.state) throw new Error(payload?.error || 'Your schedule could not load.')
        if (!cancelled) {
          if (localRecord.current.dirty) setStatus('saving')
          else {
            const remote = normalizeState(payload.state)
            serverUpdatedAt.current = payload.updatedAt ?? null
            setState(remote)
            writeLocal(userId, remote, false, serverUpdatedAt.current)
            setStatus('saved')
          }
        }
      } catch (loadError) {
        if (loadError instanceof AuthSessionError) { await onSessionExpired().catch(() => undefined); return }
        if (!cancelled) { setError('Your schedule is still available in this browser; it will sync when Neon reconnects.'); setStatus('offline') }
      } finally { if (!cancelled) setHydrated(true) }
    }
    void load()
    return () => { cancelled = true }
  }, [apiUrl, isDemo, onSessionExpired, userId])

  useEffect(() => {
    if (isDemo) return
    const retry = () => setRetryVersion((value) => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [isDemo])

  useEffect(() => {
    if (!hydrated || isDemo) return
    writeLocal(userId, state, dirty, serverUpdatedAt.current)
    if (!dirty) return
    const currentRevision = revision.current
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      try {
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/schedule`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) })
        if (response.status === 401) { await onSessionExpired(); return }
        const payload = await response.json().catch(() => null) as { updatedAt?: string; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'Your schedule could not save.')
        if (revision.current === currentRevision) {
          serverUpdatedAt.current = payload?.updatedAt ?? new Date().toISOString()
          writeLocal(userId, state, false, serverUpdatedAt.current)
          localRecord.current.dirty = false
          setDirty(false)
          setStatus('saved')
          setError('')
        }
      } catch (saveError) {
        if (saveError instanceof AuthSessionError) { await onSessionExpired().catch(() => undefined); return }
        setError('Your latest changes are safe in this browser and will sync when the connection returns.')
        setStatus('offline')
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [apiUrl, dirty, hydrated, isDemo, onSessionExpired, retryVersion, state, userId])

  const month = useMemo(() => fromDateKey(viewDate), [viewDate])
  const monthLabel = useMemo(() => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(month), [month])
  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const startOffset = (first.getDay() + 6) % 7
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - startOffset)
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + index)
      return dateKey(day)
    })
  }, [month])
  const itemsForDate = useMemo(() => state.items
    .filter((item) => item.date <= selectedDate && item.endDate >= selectedDate)
    .sort((a, b) => Number(a.allDay) - Number(b.allDay) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)), [selectedDate, state.items])
  const sortedItems = useMemo(() => [...state.items].sort((a, b) => a.date.localeCompare(b.date) || Number(a.allDay) - Number(b.allDay) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)), [state.items])
  const statusText = status === 'loading' ? 'Loading schedule' : status === 'saving' ? 'Saving changes' : status === 'saved' ? 'Saved to your account' : status === 'offline' ? 'Saved in this browser' : 'Demo schedule'

  const chooseDate = (date: string) => {
    setSelectedDate(date)
    setForm((current) => currentOpenOrBlank(current, date, formOpen))
  }

  const beginCreate = (date = selectedDate) => {
    setSelectedDate(date)
    setForm(blankForm(date))
    setEditingId(null)
    setFormOpen(true)
    window.setTimeout(() => { formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); formRef.current?.focus({ preventScroll: true }) }, 0)
  }

  const beginEdit = (item: ScheduleItem) => {
    setSelectedDate(item.date)
    setViewDate(`${item.date.slice(0, 7)}-01`)
    setForm({ title: item.title, date: item.date, endDate: item.endDate, startTime: item.startTime, endTime: item.endTime, allDay: item.allDay, kind: item.kind, category: item.category, location: item.location, details: item.details, url: item.url })
    setEditingId(item.id)
    setFormOpen(true)
    window.setTimeout(() => { formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); formRef.current?.focus({ preventScroll: true }) }, 0)
  }

  const saveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = form.title.trim()
    if (!title || form.endDate < form.date || (!form.allDay && form.startTime && form.endTime && form.date === form.endDate && form.endTime <= form.startTime)) return
    const existing = state.items.find((item) => item.id === editingId)
    const nextItem: ScheduleItem = { ...form, title, id: editingId ?? createId(), completed: existing?.completed ?? false }
    updateState((current) => ({ items: editingId ? current.items.map((item) => item.id === editingId ? nextItem : item) : [...current.items, nextItem] }))
    setSelectedDate(nextItem.date)
    setForm(blankForm(nextItem.date))
    setFormOpen(false)
    setEditingId(null)
  }

  const toggleDone = (id: string) => updateState((current) => ({ items: current.items.map((item) => item.id === id ? { ...item, completed: !item.completed } : item) }))
  const removeItem = (id: string) => {
    updateState((current) => ({ items: current.items.filter((item) => item.id !== id) }))
    if (editingId === id) { setEditingId(null); setFormOpen(false) }
  }

  const openMonth = (amount: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    const day = Math.min(fromDateKey(selectedDate).getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
    const nextDate = dateKey(new Date(next.getFullYear(), next.getMonth(), day))
    setViewDate(dateKey(next))
    chooseDate(nextDate)
  }

  const shownList = sortedItems.filter((item) => filter === 'all' || (filter === 'upcoming' && item.endDate >= dateKey(new Date()) && !item.completed) || (filter === 'completed' && item.completed))

  return (
    <section className="personal-schedule" aria-labelledby="schedule-title">
      <header className="schedule-heading">
        <div>
          <h2 id="schedule-title">My schedule</h2>
          <p>Appointments, plans, and tasks in one private calendar.</p>
        </div>
        <div className="schedule-heading-actions">
          <span className={`schedule-sync is-${status}`} role="status" aria-live="polite">{statusText}</span>
          <button type="button" className="schedule-primary-action" onClick={() => beginCreate()} disabled={!hydrated && !isDemo}>Add to schedule</button>
        </div>
      </header>

      {error && <p className="schedule-error" role="status">{error}</p>}
      {isDemo && <p className="schedule-demo-note">Sample entries are illustrative. Add your own dates here.</p>}

      <div className="schedule-toolbar">
        <div className="schedule-view-switch" aria-label="Schedule view">
          <button type="button" className={view === 'calendar' ? 'is-active' : ''} aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>All entries <span>{state.items.length}</span></button>
        </div>
        {view === 'calendar' ? (
          <div className="schedule-month-controls">
            <button type="button" aria-label="Previous month" onClick={() => openMonth(-1)}>←</button>
            <h3>{monthLabel}</h3>
            <button type="button" aria-label="Next month" onClick={() => openMonth(1)}>→</button>
            <button type="button" className="schedule-today" onClick={() => { const today = dateKey(new Date()); setViewDate(`${today.slice(0, 7)}-01`); chooseDate(today) }}>Today</button>
          </div>
        ) : (
          <label className="schedule-filter"><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Everything</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option></select></label>
        )}
      </div>

      {view === 'calendar' ? (
        <div className="schedule-workspace">
          <section className="schedule-calendar" aria-label={`${monthLabel} calendar`}>
            <div className="schedule-weekdays" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="schedule-calendar-grid">
              {calendarDays.map((day) => {
                const date = fromDateKey(day)
                const count = state.items.filter((item) => item.date <= day && item.endDate >= day).length
                const isSelected = day === selectedDate
                const isCurrentMonth = date.getMonth() === month.getMonth()
                const isToday = day === dateKey(new Date())
                return (
                  <button key={day} type="button" className={`schedule-calendar-day${isSelected ? ' is-selected' : ''}${isCurrentMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}${count ? ' has-items' : ''}`} aria-pressed={isSelected} aria-label={`${formatDate(day)}${count ? `, ${count} scheduled ${count === 1 ? 'item' : 'items'}` : ''}`} onClick={() => chooseDate(day)}>
                    <span>{date.getDate()}</span>{count > 0 && <small aria-hidden="true">{count}</small>}
                  </button>
                )
              })}
            </div>
            <div className="schedule-calendar-foot"><span>{state.items.length} saved {state.items.length === 1 ? 'entry' : 'entries'}</span><span>Select a date to see its plan</span></div>
          </section>

          <section className="schedule-day-panel" aria-labelledby="schedule-day-title">
            <header className="schedule-day-heading">
              <div><h3 id="schedule-day-title">{formatDate(selectedDate)}</h3><p>{itemsForDate.length ? `${itemsForDate.length} ${itemsForDate.length === 1 ? 'item' : 'items'} scheduled` : 'Nothing scheduled yet'}</p></div>
              <button type="button" onClick={() => beginCreate(selectedDate)} disabled={!hydrated && !isDemo}>+ Add</button>
            </header>
            {itemsForDate.length ? <ol className="schedule-entry-list">{itemsForDate.map((item) => <ScheduleRow key={item.id} item={item} onToggle={toggleDone} onEdit={beginEdit} onRemove={removeItem} />)}</ol> : (
              <div className="schedule-empty-day"><p>A clear day is a good place to start.</p><button type="button" onClick={() => beginCreate(selectedDate)} disabled={!hydrated && !isDemo}>Plan something for this date</button></div>
            )}
          </section>
        </div>
      ) : (
        <section className="schedule-all-list" aria-label="All scheduled entries">
          {shownList.length ? <ol className="schedule-entry-list">{shownList.map((item) => <ScheduleRow key={item.id} item={item} showDate onToggle={toggleDone} onEdit={beginEdit} onRemove={removeItem} />)}</ol> : <div className="schedule-empty-day"><p>{state.items.length ? 'No entries match this view.' : 'Your schedule is empty.'}</p><button type="button" onClick={() => beginCreate()} disabled={!hydrated && !isDemo}>Add your first entry</button></div>}
        </section>
      )}

      {formOpen && (
        <section className="schedule-editor" ref={formRef} tabIndex={-1} aria-labelledby="schedule-editor-title">
          <header><div><h3 id="schedule-editor-title">{editingId ? 'Edit entry' : 'New schedule entry'}</h3><p>Keep the details you’ll want to see when the date arrives.</p></div><button type="button" className="schedule-close-editor" onClick={() => { setFormOpen(false); setEditingId(null) }} aria-label="Close editor">×</button></header>
          <form onSubmit={saveItem}>
            <label className="schedule-field schedule-title-field"><span>What are you doing?</span><input autoFocus maxLength={160} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Submit project proposal" disabled={!hydrated && !isDemo} /></label>
            <div className="schedule-form-grid">
              <label className="schedule-field"><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as FormState['kind'] })}><option value="event">Event / appointment</option><option value="task">Task</option></select></label>
              <label className="schedule-field"><span>Area</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ScheduleCategory })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="schedule-field"><span>Starts</span><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value, endDate: form.endDate < event.target.value ? event.target.value : form.endDate })} /></label>
              <label className="schedule-field"><span>Ends</span><input type="date" required min={form.date} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
            </div>
            <label className="schedule-all-day"><input type="checkbox" checked={form.allDay} onChange={(event) => setForm({ ...form, allDay: event.target.checked, startTime: event.target.checked ? '' : form.startTime || '09:00', endTime: event.target.checked ? '' : form.endTime || '10:00' })} /><span>All day</span></label>
            {!form.allDay && <div className="schedule-form-grid schedule-time-grid"><label className="schedule-field"><span>Start time</span><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label className="schedule-field"><span>End time</span><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div>}
            <div className="schedule-form-grid"><label className="schedule-field"><span>Location</span><input maxLength={240} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Optional" /></label><label className="schedule-field"><span>Link</span><input type="url" maxLength={2048} value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://…" /></label></div>
            <label className="schedule-field"><span>Notes</span><textarea maxLength={3000} rows={3} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="What should you remember?" /></label>
            <div className="schedule-form-actions"><button type="button" className="schedule-cancel" onClick={() => { setFormOpen(false); setEditingId(null) }}>Cancel</button><button type="submit" className="schedule-primary-action" disabled={!hydrated && !isDemo}>{editingId ? 'Save changes' : 'Save to schedule'}</button></div>
          </form>
        </section>
      )}
    </section>
  )
}

function currentOpenOrBlank(current: FormState, date: string, isOpen: boolean): FormState {
  return isOpen && !current.title.trim() ? { ...current, date, endDate: current.endDate < date ? date : current.endDate } : current
}

function ScheduleRow({ item, showDate = false, onToggle, onEdit, onRemove }: { item: ScheduleItem; showDate?: boolean; onToggle: (id: string) => void; onEdit: (item: ScheduleItem) => void; onRemove: (id: string) => void }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  return (
    <li className={`schedule-entry${item.completed ? ' is-complete' : ''}`}>
      <label className="schedule-entry-check"><input type="checkbox" checked={item.completed} aria-label={item.completed ? `Mark ${item.title} as not complete` : `Mark ${item.title} complete`} onChange={() => onToggle(item.id)} /><span className="schedule-entry-marker" aria-hidden="true" /></label>
      <div className="schedule-entry-main">
        <div className="schedule-entry-title-line"><strong>{item.title}</strong><span>{item.kind === 'task' ? 'Task' : 'Event'} · {categoryLabels[item.category]}</span></div>
        <p className="schedule-entry-meta">{showDate && <time dateTime={item.date}>{formatDate(item.date, { weekday: 'short', day: 'numeric', month: 'short' })}{item.endDate !== item.date ? ` – ${formatDate(item.endDate, { day: 'numeric', month: 'short' })}` : ''}</time>}{showDate && <span>·</span>}{item.allDay ? 'All day' : item.startTime || item.endTime ? `${item.startTime || 'Time unset'}${item.endTime ? `–${item.endTime}` : ''}` : 'Time not set'}{item.location && <> · {item.location}</>}</p>
        {item.details && <p className="schedule-entry-details">{item.details}</p>}
        {item.url && <a className="schedule-entry-link" href={item.url} target="_blank" rel="noreferrer">Open link</a>}
      </div>
      <div className="schedule-entry-actions">
        {confirmingRemove ? <>
          <span role="status">Remove this entry?</span>
          <button type="button" onClick={() => setConfirmingRemove(false)}>Keep</button>
          <button type="button" className="schedule-remove" onClick={() => onRemove(item.id)}>Delete</button>
        </> : <>
          <button type="button" onClick={() => onEdit(item)}>Edit</button>
          <button type="button" className="schedule-remove" aria-label={`Remove ${item.title}`} onClick={() => setConfirmingRemove(true)}>Remove</button>
        </>}
      </div>
    </li>
  )
}
