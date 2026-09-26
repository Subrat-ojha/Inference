import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AuthSessionError, getAccessToken } from './auth'
import './notes-vault.css'

export type PersonalNoteType = 'github' | 'prompt' | 'project' | 'text'

export type PersonalNote = {
  id: string
  type: PersonalNoteType
  title: string
  body: string
  url: string | null
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

type DraftNote = {
  type: PersonalNoteType
  title: string
  body: string
  url: string
  tags: string
  pinned: boolean
}

type NotesVaultProps = {
  apiUrl: string
  onSessionExpired: () => Promise<void>
  demoNotes?: PersonalNote[]
}

export const vaultDemoNotes: PersonalNote[] = [
  {
    id: 'demo-github',
    type: 'github',
    title: 'Inference server reference',
    body: 'A compact serving project to revisit when I reach the model-serving sprint. Pay attention to batching and the request queue.',
    url: 'https://github.com/vllm-project/vllm',
    tags: ['inference', 'serving'],
    pinned: true,
    createdAt: '2026-09-24T12:15:00.000Z',
    updatedAt: '2026-09-26T09:30:00.000Z',
  },
  {
    id: 'demo-prompt',
    type: 'prompt',
    title: 'Explain the bottleneck',
    body: 'Act as a senior inference engineer. Review this request path and explain the dominant latency bottleneck, the evidence you would collect, and the smallest experiment that could disprove your diagnosis.',
    url: null,
    tags: ['prompt', 'debugging'],
    pinned: false,
    createdAt: '2026-09-25T17:10:00.000Z',
    updatedAt: '2026-09-25T17:10:00.000Z',
  },
  {
    id: 'demo-project',
    type: 'project',
    title: 'Token latency dashboard',
    body: 'Build a tiny dashboard that compares time-to-first-token and inter-token latency across prompt lengths. Start with recorded JSON before wiring a live endpoint.',
    url: null,
    tags: ['project', 'metrics'],
    pinned: false,
    createdAt: '2026-09-23T07:45:00.000Z',
    updatedAt: '2026-09-23T07:45:00.000Z',
  },
]

const typeLabels: Record<PersonalNoteType, string> = {
  github: 'GitHub',
  prompt: 'Prompt',
  project: 'Project',
  text: 'Text',
}

const emptyDraft: DraftNote = {
  type: 'text',
  title: '',
  body: '',
  url: '',
  tags: '',
  pinned: false,
}

function formatSavedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
  if (day === today) return `Today · ${time}`
  if (day === today - 86_400_000) return `Yesterday · ${time}`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).format(date)
}

function TypeMark({ type }: { type: PersonalNoteType }) {
  return <span className={`vault-type vault-type-${type}`}>{typeLabels[type]}</span>
}

function noteToDraft(note: PersonalNote): DraftNote {
  return {
    type: note.type,
    title: note.title,
    body: note.body,
    url: note.url ?? '',
    tags: note.tags.join(', '),
    pinned: note.pinned,
  }
}

function sortNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

export default function NotesVault({ apiUrl, onSessionExpired, demoNotes }: NotesVaultProps) {
  const [notes, setNotes] = useState<PersonalNote[]>(demoNotes ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(demoNotes?.[0]?.id ?? null)
  const [filter, setFilter] = useState<'all' | PersonalNoteType>('all')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(!demoNotes)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [editorId, setEditorId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<DraftNote>(emptyDraft)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy URL')
  const detailRef = useRef<HTMLElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const revealDetail = () => {
    if (!window.matchMedia('(max-width: 700px)').matches) return
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ block: 'start' })
      detailRef.current?.focus({ preventScroll: true })
    })
  }

  const showEditorError = (message: string) => {
    setError(message)
  }

  useEffect(() => {
    if (editorId && error) errorRef.current?.focus()
  }, [editorId, error])

  useEffect(() => {
    let cancelled = false

    const loadNotes = async () => {
      if (demoNotes) return
      if (!apiUrl) {
        setError('The Neon notes API is not configured.')
        setIsLoading(false)
        return
      }

      try {
        setLoadFailed(false)
        const token = await getAccessToken()
        const response = await fetch(`${apiUrl}/notes`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status === 401) {
          await onSessionExpired()
          return
        }
        const payload = await response.json().catch(() => null) as { notes?: PersonalNote[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'Your notes could not be loaded.')
        if (!cancelled) {
          const nextNotes = sortNotes(Array.isArray(payload?.notes) ? payload.notes : [])
          setNotes(nextNotes)
          setSelectedId(nextNotes[0]?.id ?? null)
        }
      } catch (loadError) {
        if (loadError instanceof AuthSessionError) {
          await onSessionExpired().catch(() => undefined)
          return
        }
        if (!cancelled) {
          setLoadFailed(true)
          setError(loadError instanceof Error ? loadError.message : 'Your notes could not be loaded.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadNotes()
    return () => { cancelled = true }
  }, [apiUrl, demoNotes, onSessionExpired])

  const counts = useMemo(() => ({
    all: notes.length,
    github: notes.filter((note) => note.type === 'github').length,
    prompt: notes.filter((note) => note.type === 'prompt').length,
    project: notes.filter((note) => note.type === 'project').length,
    text: notes.filter((note) => note.type === 'text').length,
  }), [notes])

  const visibleNotes = useMemo(() => {
    const search = query.trim().toLowerCase()
    return notes.filter((note) => {
      if (filter !== 'all' && note.type !== filter) return false
      if (!search) return true
      return [note.title, note.body, note.url ?? '', ...note.tags]
        .some((value) => value.toLowerCase().includes(search))
    })
  }, [filter, notes, query])

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null

  useEffect(() => {
    if (editorId) return
    if (selectedId && visibleNotes.some((note) => note.id === selectedId)) return
    setSelectedId(visibleNotes[0]?.id ?? null)
  }, [editorId, selectedId, visibleNotes])

  const authorizedFetch = async (path: string, options: RequestInit) => {
    const token = await getAccessToken()
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    if (response.status === 401) {
      await onSessionExpired()
      throw new AuthSessionError('Your session has expired. Sign in again.')
    }
    return response
  }

  const openNewNote = () => {
    setDraft(emptyDraft)
    setEditorId('new')
    setDeleteArmed(false)
    setError('')
    revealDetail()
  }

  const openEditor = (note: PersonalNote) => {
    setDraft(noteToDraft(note))
    setEditorId(note.id)
    setDeleteArmed(false)
    setError('')
    revealDetail()
  }

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editorId || isSaving) return
    setError('')

    const title = draft.title.trim()
    const body = draft.body.trim()
    const url = draft.url.trim()
    if (!title || !body) {
      showEditorError('Add both a title and note content before saving.')
      return
    }
    if (draft.type === 'github' && !url) {
      showEditorError('GitHub notes need a complete URL.')
      return
    }

    const payload = {
      type: draft.type,
      title,
      body,
      url: url || null,
      tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      pinned: draft.pinned,
    }

    setIsSaving(true)
    try {
      const isNew = editorId === 'new'
      const response = await authorizedFetch(isNew ? '/notes' : `/notes/${editorId}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null) as { note?: PersonalNote; error?: string } | null
      if (!response.ok || !result?.note) throw new Error(result?.error || 'The note could not be saved.')
      const saved = result.note
      setNotes((current) => sortNotes([saved, ...current.filter((note) => note.id !== saved.id)]))
      setSelectedId(saved.id)
      setEditorId(null)
    } catch (saveError) {
      if (!(saveError instanceof AuthSessionError)) {
        showEditorError(saveError instanceof Error ? saveError.message : 'The note could not be saved.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const togglePinned = async (note: PersonalNote) => {
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const response = await authorizedFetch(`/notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          type: note.type,
          title: note.title,
          body: note.body,
          url: note.url,
          tags: note.tags,
          pinned: !note.pinned,
        }),
      })
      const result = await response.json().catch(() => null) as { note?: PersonalNote; error?: string } | null
      if (!response.ok || !result?.note) throw new Error(result?.error || 'The note could not be updated.')
      const saved = result.note
      setNotes((current) => sortNotes([saved, ...current.filter((item) => item.id !== note.id)]))
    } catch (pinError) {
      if (!(pinError instanceof AuthSessionError)) {
        setError(pinError instanceof Error ? pinError.message : 'The note could not be updated.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const deleteNote = async (note: PersonalNote) => {
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const response = await authorizedFetch(`/notes/${note.id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'The note could not be deleted.')
      setNotes((current) => current.filter((item) => item.id !== note.id))
      setSelectedId(null)
      setDeleteArmed(false)
    } catch (deleteError) {
      if (!(deleteError instanceof AuthSessionError)) {
        setError(deleteError instanceof Error ? deleteError.message : 'The note could not be deleted.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyLabel('Copied')
      window.setTimeout(() => setCopyLabel('Copy URL'), 1400)
    } catch {
      setError('The browser could not copy this URL. Select it from the note instead.')
    }
  }

  return (
    <section className="personal-vault" aria-labelledby="personal-vault-title">
      <header className="vault-heading">
        <div>
          <h2 id="personal-vault-title">Personal vault</h2>
          <p>Links, prompts, project ideas, and text saved privately to your Neon account.</p>
        </div>
        <div className="vault-heading-status" role="status" aria-live="polite">
          <span>{isSaving ? 'Saving…' : isLoading ? 'Loading…' : `${notes.length} saved`}</span>
          <button type="button" onClick={openNewNote}>New note</button>
        </div>
      </header>

      {error && !editorId && <div className="vault-error" role="alert">{error}</div>}

      <div className="vault-workspace">
        <aside className="vault-sidebar">
          <div className="vault-identity">
            <strong>My vault</strong>
            <span>Private knowledge space</span>
          </div>
          <nav aria-label="Filter saved notes">
            {(['all', 'github', 'prompt', 'project', 'text'] as const).map((type) => (
              <button
                type="button"
                className={filter === type ? 'is-active' : ''}
                aria-pressed={filter === type}
                key={type}
                onClick={() => { setFilter(type); setEditorId(null) }}
              >
                <span>{type === 'all' ? 'All notes' : typeLabels[type]}</span>
                <b>{String(counts[type]).padStart(2, '0')}</b>
              </button>
            ))}
          </nav>
          <div className="vault-sidebar-foot">
            <p>Your notes are scoped to the signed-in account.</p>
            <button type="button" onClick={openNewNote}>+ New note</button>
          </div>
        </aside>

        <section className="vault-results" aria-label="Saved notes">
          <label className="vault-search" htmlFor="vault-search-input">
            <span>Search</span>
            <input
              id="vault-search-input"
              type="search"
              value={query}
              placeholder="Titles, URLs, content, and tags"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="vault-results-label">
            <span>{filter === 'all' ? 'Updated recently' : typeLabels[filter]}</span>
            <span>{visibleNotes.length} {visibleNotes.length === 1 ? 'item' : 'items'}</span>
          </div>

          <div className="vault-result-list">
            {isLoading ? (
              <p className="vault-list-message">Loading your private notes…</p>
            ) : loadFailed ? (
              <div className="vault-empty-list">
                <strong>Your notes are unavailable.</strong>
                <p>Check your connection and refresh to try loading them again.</p>
              </div>
            ) : visibleNotes.length === 0 ? (
              <div className="vault-empty-list">
                <strong>{notes.length ? 'Nothing matches this view.' : 'Your vault is ready.'}</strong>
                <p>{notes.length ? 'Try another search or filter.' : 'Save a GitHub URL, reusable prompt, project idea, or plain text note.'}</p>
                {!notes.length && <button type="button" onClick={openNewNote}>Create the first note</button>}
              </div>
            ) : visibleNotes.map((note) => (
              <button
                type="button"
                className={`vault-result${selectedId === note.id && !editorId ? ' is-selected' : ''}`}
                aria-pressed={selectedId === note.id && !editorId}
                key={note.id}
                onClick={() => { setSelectedId(note.id); setEditorId(null); setDeleteArmed(false); revealDetail() }}
              >
                <span className="vault-result-meta"><TypeMark type={note.type} /><time>{formatSavedAt(note.updatedAt)}</time></span>
                <strong>{note.title}</strong>
                <span className="vault-result-body">{note.url || note.body}</span>
                <span className="vault-result-tags">
                  {note.pinned && <em className="is-pinned">Pinned</em>}
                  {note.tags.slice(0, 3).map((tag) => <em key={tag}>#{tag}</em>)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <article ref={detailRef} tabIndex={-1} className="vault-detail" aria-label={editorId ? 'Note editor' : 'Selected note'}>
          {editorId ? (
            <form className="vault-editor" noValidate onSubmit={(event) => void saveNote(event)}>
              <header>
                <div><strong>{editorId === 'new' ? 'New note' : 'Edit note'}</strong><span>Private to your account</span></div>
                <button type="button" onClick={() => setEditorId(null)}>Cancel</button>
              </header>

              {error && <div ref={errorRef} tabIndex={-1} className="vault-error vault-editor-error" role="alert">{error}</div>}

              <fieldset className="vault-kind-field">
                <legend>Note type</legend>
                <div>
                  {(Object.keys(typeLabels) as PersonalNoteType[]).map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="note-type"
                        value={type}
                        checked={draft.type === type}
                        onChange={() => setDraft((current) => ({ ...current, type }))}
                      />
                      <span>{typeLabels[type]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="vault-field">
                <span>Title</span>
                <input
                  type="text"
                  value={draft.title}
                  maxLength={160}
                  required
                  aria-invalid={Boolean(error && !draft.title.trim())}
                  placeholder={draft.type === 'prompt' ? 'What does this prompt do?' : 'A name you will recognize later'}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              {draft.type === 'github' && (
                <label className="vault-field">
                  <span>GitHub URL</span>
                  <input
                    type="url"
                    value={draft.url}
                    maxLength={2048}
                    required
                    aria-invalid={Boolean(error && draft.type === 'github' && !draft.url.trim())}
                    placeholder="https://github.com/owner/repository"
                    onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                  />
                </label>
              )}

              <label className="vault-field vault-body-field">
                <span>{draft.type === 'prompt' ? 'Prompt' : draft.type === 'project' ? 'Project notes' : 'Content'}</span>
                <textarea
                  value={draft.body}
                  maxLength={10_000}
                  required
                  aria-invalid={Boolean(error && !draft.body.trim())}
                  placeholder={draft.type === 'prompt' ? 'Paste the complete reusable prompt…' : 'Write what is useful and why you saved it…'}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                />
                <small>{draft.body.length} / 10,000</small>
              </label>

              <label className="vault-field">
                <span>Tags</span>
                <input
                  type="text"
                  value={draft.tags}
                  placeholder="backend, neon, remember"
                  onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                />
                <small>Separate tags with commas.</small>
              </label>

              <label className="vault-pin-field">
                <input
                  type="checkbox"
                  checked={draft.pinned}
                  onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))}
                />
                <span>Keep this note at the top of the vault</span>
              </label>

              <footer>
                <button type="button" onClick={() => setEditorId(null)}>Cancel</button>
                <button className="is-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save note'}</button>
              </footer>
            </form>
          ) : selectedNote ? (
            <>
              <header className="vault-detail-head">
                <TypeMark type={selectedNote.type} />
                <div>
                  <button type="button" disabled={isSaving} onClick={() => void togglePinned(selectedNote)}>
                    {selectedNote.pinned ? 'Unpin' : 'Pin note'}
                  </button>
                  <button type="button" onClick={() => openEditor(selectedNote)}>Edit</button>
                </div>
              </header>
              <div className="vault-detail-copy">
                <h3>{selectedNote.title}</h3>
                {selectedNote.url && <a href={selectedNote.url} target="_blank" rel="noreferrer">{selectedNote.url}</a>}
                <p>{selectedNote.body}</p>
              </div>
              <dl className="vault-note-data">
                <div><dt>Updated</dt><dd>{formatSavedAt(selectedNote.updatedAt)}</dd></div>
                <div><dt>Tags</dt><dd>{selectedNote.tags.length ? selectedNote.tags.map((tag) => `#${tag}`).join(' · ') : 'No tags'}</dd></div>
                <div><dt>Type</dt><dd>{typeLabels[selectedNote.type]}</dd></div>
              </dl>
              <footer className="vault-detail-actions">
                {selectedNote.url && (
                  <>
                    <a href={selectedNote.url} target="_blank" rel="noreferrer">Open link</a>
                    <button type="button" onClick={() => void copyUrl(selectedNote.url!)}>{copyLabel}</button>
                  </>
                )}
                <button className="is-danger" type="button" aria-expanded={deleteArmed} onClick={() => setDeleteArmed((value) => !value)}>Delete</button>
              </footer>
              {deleteArmed && (
                <div className="vault-delete-confirmation" role="alert">
                  <p>Delete “{selectedNote.title}”? This cannot be undone.</p>
                  <div><button type="button" onClick={() => setDeleteArmed(false)}>Keep note</button><button className="is-danger" type="button" disabled={isSaving} onClick={() => void deleteNote(selectedNote)}>Delete permanently</button></div>
                </div>
              )}
            </>
          ) : loadFailed ? (
            <div className="vault-empty-detail">
              <strong>The vault could not be opened.</strong>
              <p>Your saved notes were not replaced or cleared. Refresh when the connection is available.</p>
            </div>
          ) : (
            <div className="vault-empty-detail">
              <strong>{notes.length ? 'Select a note to open it.' : 'Make this space yours.'}</strong>
              <p>{notes.length ? 'The full content and actions will appear here.' : 'Start with the URL, prompt, project, or thought you do not want to lose.'}</p>
              <button type="button" onClick={openNewNote}>New note</button>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
