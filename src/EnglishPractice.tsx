import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthSessionError, getAccessToken } from './auth'
import { englishPracticeDays, practiceResources, type AccentModel, type EnglishPracticeDay } from './english-plan'
import './english-practice.css'

type EnglishPracticeState = {
  accent: AccentModel | null
  completed: string[]
  notes: Record<string, string>
  clips: Record<string, string>
}

type LocalPracticeRecord = {
  version: 2
  state: EnglishPracticeState
  dirty: boolean
  updatedAt: string | null
}

type EnglishPracticeProps = {
  apiUrl: string
  userId: string
  isDemo?: boolean
  onSessionExpired: () => Promise<void>
}

type SyncStatus = 'loading' | 'saving' | 'saved' | 'offline' | 'attention' | 'demo'

type PracticeTask = {
  id: 'listen' | 'mechanics' | 'shadow' | 'workplace'
  minutes: number
  title: string
  purpose: string
  steps: string[]
}

const START_YEAR = 2026
const START_MONTH = 8
const START_DAY = 26
const LOCAL_STORAGE_PREFIX = 'english-clarity:v1:'

const emptyState: EnglishPracticeState = {
  accent: null,
  completed: [],
  notes: {},
  clips: {},
}

const demoState: EnglishPracticeState = {
  accent: 'us',
  completed: ['day-1-listen', 'day-1-mechanics'],
  notes: { '1': 'ASR missed “progress” and “first part”. Slow the stressed syllable tomorrow.' },
  clips: {},
}

function dateForDay(day: number): Date {
  return new Date(START_YEAR, START_MONTH, START_DAY + day - 1)
}

function formatDayDate(day: number, long = false): string {
  return new Intl.DateTimeFormat(undefined, long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'short' }).format(dateForDay(day))
}

function todayIndex(): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const start = new Date(START_YEAR, START_MONTH, START_DAY).getTime()
  return Math.min(Math.max(Math.floor((today - start) / 86_400_000) + 1, 1), 30)
}

function normalizePracticeState(value: unknown): EnglishPracticeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState
  const parsed = value as Partial<EnglishPracticeState>
  return {
    accent: parsed.accent === 'us' || parsed.accent === 'uk' ? parsed.accent : null,
    completed: Array.isArray(parsed.completed) ? parsed.completed.filter((id): id is string => typeof id === 'string') : [],
    notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
    clips: parsed.clips && typeof parsed.clips === 'object' ? parsed.clips : {},
  }
}

function loadLocalRecord(userId: string): LocalPracticeRecord {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`)
    if (!raw) return { version: 2, state: emptyState, dirty: false, updatedAt: null }
    const parsed = JSON.parse(raw) as Partial<LocalPracticeRecord> & Partial<EnglishPracticeState>
    if (parsed.version === 2 && parsed.state) {
      return {
        version: 2,
        state: normalizePracticeState(parsed.state),
        dirty: parsed.dirty === true,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      }
    }
    return { version: 2, state: normalizePracticeState(parsed), dirty: true, updatedAt: null }
  } catch {
    return { version: 2, state: emptyState, dirty: false, updatedAt: null }
  }
}

function saveLocalRecord(userId: string, state: EnglishPracticeState, dirty: boolean, updatedAt: string | null) {
  const record: LocalPracticeRecord = { version: 2, state, dirty, updatedAt }
  localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(record))
}

function taskId(day: number, task: PracticeTask['id']): string {
  return `day-${day}-${task}`
}

function isValidWebUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function clipsAreValid(clips: Record<string, string>): boolean {
  return Object.values(clips).every(isValidWebUrl)
}

function tasksForDay(day: EnglishPracticeDay, clipBlock: number): PracticeTask[] {
  return [
    {
      id: 'listen',
      minutes: 10,
      title: 'Listen and dictate',
      purpose: day.listeningFocus,
      steps: [
        'Listen twice without reading. First catch the meaning; then listen for stress, pauses, and reductions.',
        'Write exactly what you hear from 20–30 seconds. Do not repair the grammar from memory.',
        'Open the transcript or captions. Circle missed words and mark whether sound, stress, or linking hid them.',
      ],
    },
    {
      id: 'mechanics',
      minutes: 10,
      title: day.mechanicsTitle,
      purpose: day.mechanicsCue,
      steps: [
        `Use today’s drill set: ${day.drillWords.join(' · ')}.`,
        'Listen first, identify what you heard, then produce it. Use a mirror for mouth position.',
        'Record one pass and verify difficult words with Cambridge audio or the minimal-pair list.',
      ],
    },
    {
      id: 'shadow',
      minutes: 15,
      title: `Shadowing · clip block ${clipBlock}`,
      purpose: day.shadowCue,
      steps: [
        'Listen silently twice. Read the transcript aloud slowly and clear any unknown words.',
        'Shadow sentence by sentence with text at a one-second lag; then repeat without text.',
        'Finish with one uninterrupted overlap pass. Record it and note only two differences.',
      ],
    },
    {
      id: 'workplace',
      minutes: 10,
      title: 'Workplace rehearsal and ASR check',
      purpose: day.speakingPrompt,
      steps: [
        'Say each corporate sentence once slowly, once with marked stress, and once at natural speed.',
        'Speak the daily prompt into phone or browser dictation. If a key word is wrong, change stress or articulation and retry.',
        'Record the final 60–120 second answer. Write one specific adjustment in the note field.',
      ],
    },
  ]
}

export default function EnglishPractice({ apiUrl, userId, isDemo = false, onSessionExpired }: EnglishPracticeProps) {
  const initialLocalRecord = useRef<LocalPracticeRecord>(isDemo
    ? { version: 2, state: demoState, dirty: false, updatedAt: null }
    : loadLocalRecord(userId))
  const [state, setState] = useState<EnglishPracticeState>(initialLocalRecord.current.state)
  const [isDirty, setIsDirty] = useState(initialLocalRecord.current.dirty)
  const [retryVersion, setRetryVersion] = useState(0)
  const [activeDay, setActiveDay] = useState(todayIndex)
  const [isHydrated, setIsHydrated] = useState(isDemo)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isDemo ? 'demo' : 'loading')
  const [error, setError] = useState('')
  const [copiedPhrase, setCopiedPhrase] = useState('')
  const activeSheetRef = useRef<HTMLElement>(null)
  const serverUpdatedAtRef = useRef<string | null>(initialLocalRecord.current.updatedAt)
  const revisionRef = useRef(0)

  const updatePracticeState = (updater: (current: EnglishPracticeState) => EnglishPracticeState) => {
    revisionRef.current += 1
    initialLocalRecord.current.dirty = true
    setIsDirty(true)
    setState(updater)
  }

  useEffect(() => {
    if (isDemo) return
    let cancelled = false

    const load = async () => {
      try {
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/speech`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status === 401) {
          await onSessionExpired()
          return
        }
        const payload = await response.json().catch(() => null) as { state?: EnglishPracticeState; updatedAt?: string | null; error?: string } | null
        if (!response.ok || !payload?.state) throw new Error(payload?.error || 'Your practice record could not be loaded.')
        if (!cancelled) {
          if (initialLocalRecord.current.dirty) {
            setSyncStatus('saving')
          } else {
            const remoteState = normalizePracticeState(payload.state)
            serverUpdatedAtRef.current = payload.updatedAt ?? null
            setState(remoteState)
            saveLocalRecord(userId, remoteState, false, serverUpdatedAtRef.current)
            setSyncStatus('saved')
          }
        }
      } catch (loadError) {
        if (loadError instanceof AuthSessionError) {
          await onSessionExpired().catch(() => undefined)
          return
        }
        if (!cancelled) {
          setError('Neon is unavailable. Your practice will remain saved in this browser until sync returns.')
          setSyncStatus('offline')
        }
      } finally {
        if (!cancelled) setIsHydrated(true)
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
    if (!isHydrated || isDemo) return
    saveLocalRecord(userId, state, isDirty, serverUpdatedAtRef.current)
    if (!isDirty) return
    if (!clipsAreValid(state.clips)) {
      setError('Finish the clip link with a full http:// or https:// address before it syncs to Neon.')
      setSyncStatus('attention')
      return
    }
    const revision = revisionRef.current
    const timer = window.setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/speech`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state }),
        })
        if (response.status === 401) {
          await onSessionExpired()
          return
        }
        const payload = await response.json().catch(() => null) as { updatedAt?: string; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'Practice could not sync.')
        if (revisionRef.current === revision) {
          serverUpdatedAtRef.current = payload?.updatedAt ?? new Date().toISOString()
          saveLocalRecord(userId, state, false, serverUpdatedAtRef.current)
          initialLocalRecord.current.dirty = false
          setIsDirty(false)
          setError('')
          setSyncStatus('saved')
        }
      } catch (saveError) {
        if (saveError instanceof AuthSessionError) {
          await onSessionExpired().catch(() => undefined)
          return
        }
        setError('Your latest changes are safe in this browser and will sync after the connection returns.')
        setSyncStatus('offline')
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [apiUrl, isDemo, isDirty, isHydrated, onSessionExpired, retryVersion, state, userId])

  const day = englishPracticeDays[activeDay - 1]
  const clipBlock = Math.ceil(activeDay / 5)
  const tasks = useMemo(() => tasksForDay(day, clipBlock), [clipBlock, day])
  const completedCount = state.completed.length
  const completedDays = englishPracticeDays.filter((item) =>
    (['listen', 'mechanics', 'shadow', 'workplace'] as const)
      .every((task) => state.completed.includes(taskId(item.day, task))),
  ).length
  const activeDayCompleted = tasks.filter((task) => state.completed.includes(taskId(activeDay, task.id))).length
  const progress = Math.round((completedCount / 120) * 100)
  const selectedSource = state.accent === 'uk' ? practiceResources.bbc : practiceResources.voa
  const clipUrl = state.clips[String(clipBlock)] ?? ''
  const clipUrlIsValid = isValidWebUrl(clipUrl)

  const selectDay = (nextDay: number) => {
    setActiveDay(nextDay)
    window.setTimeout(() => {
      const sheet = activeSheetRef.current
      if (!sheet) return
      if (window.matchMedia('(max-width: 760px)').matches) sheet.scrollIntoView({ block: 'start' })
      sheet.focus({ preventScroll: true })
    }, 0)
  }

  const toggleTask = (id: string) => {
    updatePracticeState((current) => ({
      ...current,
      completed: current.completed.includes(id)
        ? current.completed.filter((item) => item !== id)
        : [...current.completed, id],
    }))
  }

  const copyPhrase = async (phrase: string) => {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopiedPhrase(phrase)
      window.setTimeout(() => setCopiedPhrase(''), 1_400)
    } catch {
      setError('The browser could not copy the sentence. Select the text and copy it manually.')
    }
  }

  const syncLabels: Record<SyncStatus, string> = {
    loading: 'Loading record',
    saving: 'Saving practice',
    saved: 'Saved to Neon',
    offline: 'Saved in browser',
    attention: 'Check clip link',
    demo: 'Preview data',
  }

  return (
    <section className="english-practice" aria-labelledby="english-practice-title">
      <header className="speech-heading">
        <div>
          <h2 id="english-practice-title">English clarity</h2>
          <p>Thirty dated sessions for pronunciation, fluency, and workplace speech. Keep your accent; train first-listen understanding.</p>
        </div>
        <div className={`speech-sync is-${syncStatus}`} role="status" aria-live="polite">
          <span>{syncLabels[syncStatus]}</span>
          <b>{completedDays} / 30 days</b>
        </div>
      </header>

      {error && <div className="speech-error" role="alert">{error}</div>}

      <div className="speech-principle">
        <strong>Clear before native-like.</strong>
        <p>Listen first, train one feature, shadow one repeated clip, then test your own speech. This is a 30-day practice cycle—not a fluency guarantee or a seven-day accent fix.</p>
      </div>

      <div className="speech-progress" aria-label={`${progress}% of the 30-day practice plan completed`}>
        <div><span>26 Sep—25 Oct 2026</span><strong>{progress}% complete</strong></div>
        <progress value={completedCount} max={120} />
      </div>

      <div className="speech-desk">
        <aside className="speech-day-index" aria-label="Thirty-day practice index">
          <div className="speech-accent-choice">
            <strong>Accent model</strong>
            <p>Choose one model for this cycle. The goal is consistency, not imitation of identity.</p>
            <div role="group" aria-label="Choose pronunciation model">
              <button type="button" className={state.accent === 'us' ? 'is-selected' : ''} aria-pressed={state.accent === 'us'} onClick={() => updatePracticeState((current) => ({ ...current, accent: 'us' }))}>US · VOA</button>
              <button type="button" className={state.accent === 'uk' ? 'is-selected' : ''} aria-pressed={state.accent === 'uk'} onClick={() => updatePracticeState((current) => ({ ...current, accent: 'uk' }))}>UK · BBC</button>
            </div>
          </div>

          {[1, 2, 3, 4, 5].map((week) => {
            const weekDays = englishPracticeDays.slice((week - 1) * 7, Math.min(week * 7, 30))
            if (!weekDays.length) return null
            return (
              <section className="speech-week" key={week} aria-labelledby={`speech-week-${week}`}>
                <h3 id={`speech-week-${week}`}>Week {week} · {weekDays[0].week}</h3>
                <div>
                  {weekDays.map((item) => {
                    const count = (['listen', 'mechanics', 'shadow', 'workplace'] as const)
                      .filter((task) => state.completed.includes(taskId(item.day, task))).length
                    return (
                      <button
                        type="button"
                        className={`${activeDay === item.day ? 'is-active' : ''}${count === 4 ? ' is-complete' : ''}`}
                        aria-pressed={activeDay === item.day}
                        aria-controls="speech-active-run-sheet"
                        onClick={() => selectDay(item.day)}
                        key={item.day}
                      >
                        <span><b>Day {String(item.day).padStart(2, '0')}</b><small>{formatDayDate(item.day)}</small></span>
                        <em>{count}/4</em>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </aside>

        <article id="speech-active-run-sheet" ref={activeSheetRef} className="speech-run-sheet" tabIndex={-1} aria-labelledby={`speech-day-title-${activeDay}`}>
          <header className="speech-day-heading">
            <div>
              <span aria-live="polite" aria-atomic="true">Day {String(activeDay).padStart(2, '0')} · {formatDayDate(activeDay, true)}</span>
              <h3 id={`speech-day-title-${activeDay}`}>{day.title}</h3>
              <p>{day.focus}</p>
            </div>
            <div className="speech-day-measure">
              <strong>{activeDayCompleted}/4</strong>
              <span>45 minutes</span>
            </div>
          </header>

          {!state.accent && (
            <div className="speech-required-choice" role="note">
              Choose US or UK in the left column before selecting your first clip. Both are valid; consistency makes comparison useful.
            </div>
          )}

          <section className="speech-clip-field" aria-labelledby="speech-clip-title">
            <div>
              <h4 id="speech-clip-title">Clip block {clipBlock} · use this clip for Days {(clipBlock - 1) * 5 + 1}–{Math.min(clipBlock * 5, 30)}</h4>
              <p>Pick one 1–2 minute section you understand at least 70%. Repetition is the training.</p>
            </div>
            <label>
              <span>Paste the clip URL once</span>
              <input
                type="url"
                value={clipUrl}
                aria-invalid={!clipUrlIsValid}
                aria-describedby={!clipUrlIsValid ? 'speech-clip-error' : undefined}
                placeholder={state.accent ? `Choose from ${selectedSource.label}, then paste the exact episode` : 'Choose an accent model first'}
                onChange={(event) => updatePracticeState((current) => ({
                  ...current,
                  clips: { ...current.clips, [String(clipBlock)]: event.target.value },
                }))}
              />
              {!clipUrlIsValid && <small id="speech-clip-error" className="speech-clip-error">Use a complete link beginning with http:// or https://.</small>}
            </label>
            <div className="speech-clip-actions">
              {clipUrl && clipUrlIsValid && <a href={clipUrl} target="_blank" rel="noreferrer">Open saved clip</a>}
              {state.accent ? (
                <a href={selectedSource.url} target="_blank" rel="noreferrer">Browse {selectedSource.label}</a>
              ) : (
                <>
                  <a href={practiceResources.voa.url} target="_blank" rel="noreferrer">Browse US · VOA</a>
                  <a href={practiceResources.bbc.url} target="_blank" rel="noreferrer">Browse UK · BBC</a>
                </>
              )}
            </div>
          </section>

          <div className="speech-routine">
            {tasks.map((task, index) => {
              const id = taskId(activeDay, task.id)
              const checked = state.completed.includes(id)
              return (
                <section className={`speech-task${checked ? ' is-complete' : ''}`} key={task.id}>
                  <header>
                    <span>{String(index + 1).padStart(2, '0')} · {task.minutes} min</span>
                    <label>
                      <input type="checkbox" checked={checked} disabled={!isHydrated} onChange={() => toggleTask(id)} />
                      <span>{checked ? 'Completed' : 'Mark complete'}</span>
                    </label>
                  </header>
                  <h4>{task.title}</h4>
                  <p>{task.purpose}</p>
                  <ol>{task.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  {task.id === 'mechanics' && (
                    <div className="speech-resource-row">
                      <a href={practiceResources.minimalPairs.url} target="_blank" rel="noreferrer">Minimal-pair audio</a>
                      <a href={practiceResources.cambridge.url} target="_blank" rel="noreferrer">UK / US dictionary audio</a>
                      {activeDay === 8 && <a href={practiceResources.bbcSchwa.url} target="_blank" rel="noreferrer">BBC schwa lesson</a>}
                    </div>
                  )}
                  {task.id === 'shadow' && (
                    <div className="speech-resource-row">
                      <a href={clipUrlIsValid && clipUrl ? clipUrl : selectedSource.url} target="_blank" rel="noreferrer">{clipUrlIsValid && clipUrl ? 'Open this block’s clip' : `Choose a clip on ${selectedSource.label}`}</a>
                      <a href={practiceResources.youglish.url} target="_blank" rel="noreferrer">Hear a phrase on YouGlish</a>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <section className="speech-workplace" aria-labelledby="speech-workplace-title">
            <header>
              <div>
                <h4 id="speech-workplace-title">Today’s corporate English</h4>
                <p>Learn the complete sentence as one usable chunk. Stress meaning words; reduce the small words.</p>
              </div>
              <span>3 sentences</span>
            </header>
            <ol>
              {day.workplace.map((item) => (
                <li key={item.phrase}>
                  <div><strong>{item.phrase}</strong><span>{item.use}</span></div>
                  <button type="button" onClick={() => void copyPhrase(item.phrase)}>{copiedPhrase === item.phrase ? 'Copied' : 'Copy'}</button>
                </li>
              ))}
            </ol>
            <div className="speech-phrase-method">
              <strong>Three-pass rehearsal</strong>
              <span>Slow and precise → exaggerate stress and pauses → natural speed into dictation.</span>
            </div>
          </section>

          <section className="speech-daily-note">
            <label htmlFor={`speech-note-${activeDay}`}>Day {activeDay} voice note</label>
            <p>Record evidence: what ASR missed, which contrast failed, or what sounded clearer. One observation is enough.</p>
            <textarea
              id={`speech-note-${activeDay}`}
              maxLength={1_000}
              value={state.notes[String(activeDay)] ?? ''}
              placeholder="Example: dictation missed ‘thirteen’; I stressed the first syllable instead of the second."
              onChange={(event) => updatePracticeState((current) => ({
                ...current,
                notes: { ...current.notes, [String(activeDay)]: event.target.value },
              }))}
            />
            <span>{(state.notes[String(activeDay)] ?? '').length} / 1,000</span>
          </section>

          <footer className="speech-day-navigation">
            <button type="button" disabled={activeDay === 1} onClick={() => selectDay(activeDay - 1)}>Previous day</button>
            <span>Day {activeDay} of 30</span>
            <button type="button" disabled={activeDay === 30} onClick={() => selectDay(activeDay + 1)}>Next day</button>
          </footer>
        </article>
      </div>

      <details className="speech-method-note">
        <summary>Why this plan is ordered this way</summary>
        <div>
          <p><strong>Listen before speaking.</strong> Dictation and transcript comparison teach your ear what your mouth must later reproduce.</p>
          <p><strong>Prosody before perfection.</strong> Stress, rhythm, pauses, and intonation often determine whether a listener understands the sentence on the first attempt.</p>
          <p><strong>Explicit feedback.</strong> Mirror work, recordings, dictionary audio, and ASR make the correction visible. Passive exposure alone is not the plan.</p>
          <p><strong>Repeat the clip.</strong> One clip for five days lets attention move from meaning to sounds, then rhythm, then automatic delivery.</p>
        </div>
      </details>
    </section>
  )
}
