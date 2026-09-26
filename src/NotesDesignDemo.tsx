import { useEffect, useState } from 'react'
import './notes-demo.css'

type Theme = 'light' | 'dark'

const notes = [
  {
    type: 'GitHub',
    title: 'Neon serverless driver',
    body: 'github.com/neondatabase/serverless',
    meta: 'Saved today · 09:42',
    tags: ['postgres', 'backend'],
  },
  {
    type: 'Prompt',
    title: 'Staff-level Java review',
    body: 'Review this Java service like a staff engineer. Focus on concurrency, failure recovery, and observability.',
    meta: 'Saved today · 08:15',
    tags: ['java', 'review'],
  },
  {
    type: 'Project',
    title: 'Inference benchmark harness',
    body: 'Compare batching strategies, measure p95 latency, and publish the run configuration with every result.',
    meta: 'Saved yesterday',
    tags: ['inference', 'build'],
  },
  {
    type: 'Text',
    title: 'Connection note',
    body: 'Use pooled connections for request traffic. Keep direct connections for migrations and administrative work.',
    meta: 'Saved Sep 24',
    tags: ['neon', 'remember'],
  },
]

function TypeMark({ type }: { type: string }) {
  return <span className={`notes-type notes-type-${type.toLowerCase()}`}>{type}</span>
}

function WorkbenchPreview() {
  return (
    <div className="notes-preview workbench-preview">
      <div className="preview-topbar">
        <strong>Personal space</strong>
        <div><span>04 saved</span><button type="button">Search</button></div>
      </div>

      <div className="workbench-capture">
        <div className="capture-kinds" aria-label="Note type preview">
          <span className="is-active">Anything</span><span>URL</span><span>Prompt</span><span>Project</span>
        </div>
        <p>Paste a GitHub URL, save a prompt, or write a thought…</p>
        <button type="button">Save to today</button>
      </div>

      <div className="workbench-body">
        <section className="workbench-pinned">
          <div className="preview-section-title"><h3>Pinned to the desk</h3><span>02</span></div>
          {notes.slice(0, 2).map((note) => (
            <article className="workbench-sheet" key={note.title}>
              <div><TypeMark type={note.type} /><span>{note.meta}</span></div>
              <h4>{note.title}</h4>
              <p>{note.body}</p>
              <footer>{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</footer>
            </article>
          ))}
        </section>

        <section className="workbench-stack">
          <div className="preview-section-title"><h3>Recent stack</h3><span>Today</span></div>
          {notes.slice(2).map((note) => (
            <article className="stack-row" key={note.title}>
              <TypeMark type={note.type} />
              <div><h4>{note.title}</h4><p>{note.body}</p></div>
              <time>{note.meta.replace('Saved ', '')}</time>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}

function VaultPreview() {
  return (
    <div className="notes-preview vault-preview">
      <aside className="vault-sidebar">
        <div>
          <strong>My vault</strong>
          <span>Private · 04 items</span>
        </div>
        <nav aria-label="Vault filters preview">
          <button className="is-active" type="button"><span>All notes</span><b>04</b></button>
          <button type="button"><span>GitHub</span><b>01</b></button>
          <button type="button"><span>Prompts</span><b>01</b></button>
          <button type="button"><span>Projects</span><b>01</b></button>
          <button type="button"><span>Text</span><b>01</b></button>
        </nav>
        <button className="vault-new" type="button">+ New note</button>
      </aside>

      <section className="vault-list">
        <div className="vault-search">Search titles, URLs, and tags <kbd>⌘ K</kbd></div>
        <div className="vault-list-label"><span>Updated recently</span><span>04 items</span></div>
        {notes.map((note, index) => (
          <article className={index === 0 ? 'is-selected' : ''} key={note.title}>
            <div><TypeMark type={note.type} /><time>{note.meta.replace('Saved ', '')}</time></div>
            <h4>{note.title}</h4>
            <p>{note.body}</p>
          </article>
        ))}
      </section>

      <section className="vault-detail">
        <header><TypeMark type="GitHub" /><button type="button">•••</button></header>
        <div className="vault-detail-copy">
          <h3>Neon serverless driver</h3>
          <a href="https://github.com/neondatabase/serverless">github.com/neondatabase/serverless</a>
          <p>Keep this close while connecting the tracker’s serverless API to Postgres.</p>
        </div>
        <dl>
          <div><dt>Saved</dt><dd>Today, 09:42</dd></div>
          <div><dt>Tags</dt><dd>#postgres #backend</dd></div>
          <div><dt>Source</dt><dd>GitHub</dd></div>
        </dl>
        <footer><button type="button">Open link</button><button type="button">Copy URL</button></footer>
      </section>
    </div>
  )
}

function CommandDeckPreview() {
  return (
    <div className="notes-preview command-preview">
      <div className="command-head">
        <div><strong>Personal command deck</strong><span>Synced to your private account</span></div>
        <button type="button">New capture <kbd>N</kbd></button>
      </div>

      <div className="command-line">
        <span>&gt;</span>
        <p>Save anything… try “github.com/”, “prompt:”, or “project:”</p>
        <kbd>Enter</kbd>
      </div>

      <div className="command-filters">
        <button className="is-active" type="button">All / 04</button>
        <button type="button">Links / 01</button>
        <button type="button">Prompts / 01</button>
        <button type="button">Projects / 01</button>
        <button type="button">Text / 01</button>
        <span>Sort: newest</span>
      </div>

      <div className="command-table" role="table" aria-label="Saved notes preview">
        <div className="command-table-head" role="row">
          <span>Type</span><span>Saved item</span><span>Tags</span><span>When</span><span />
        </div>
        {notes.map((note, index) => (
          <article className={index === 0 ? 'is-active' : ''} role="row" key={note.title}>
            <TypeMark type={note.type} />
            <div><h4>{note.title}</h4><p>{note.body}</p></div>
            <div className="command-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <time>{note.meta.replace('Saved ', '')}</time>
            <button type="button" aria-label={`Open ${note.title}`}>↗</button>
          </article>
        ))}
      </div>

      <footer className="command-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>Enter</kbd> Open</span><span><kbd>/</kbd> Search</span>
      </footer>
    </div>
  )
}

const concepts = [
  {
    id: 'workbench',
    name: 'The Workbench',
    summary: 'A visual capture desk: quick entry at the top, important material pinned left, and a daily stack on the right.',
    fit: 'Best for browsing and building a personal collection.',
    preview: <WorkbenchPreview />,
  },
  {
    id: 'vault',
    name: 'The Vault',
    summary: 'A focused three-pane library with filters, a compact result list, and a full reading view for the selected note.',
    fit: 'Best for search, organization, and revisiting long notes.',
    preview: <VaultPreview />,
  },
  {
    id: 'command',
    name: 'The Command Deck',
    summary: 'A fast capture bar and dense keyboard-friendly archive designed for people who save many small technical references.',
    fit: 'Best for speed and high-volume daily capture.',
    preview: <CommandDeckPreview />,
  },
]

export default function NotesDesignDemo() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem('inference-track:theme:v1')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Personal notes design study · Inference Engineering'
    document.documentElement.dataset.theme = theme
    return () => { document.title = previousTitle }
  }, [theme])

  return (
    <main className="notes-demo-page">
      <header className="notes-demo-intro">
        <div>
          <h1>Where useful things wait.</h1>
          <p>Three ways to turn everyday links, prompts, project ideas, and text into a private personal space.</p>
          <span>Illustrative preview data · saving is not enabled on this page</span>
        </div>
        <div className="notes-demo-controls">
          <button type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Show light theme' : 'Show dark theme'}
          </button>
          <a href="/">Back to tracker</a>
        </div>
      </header>

      <div className="notes-demo-options">
        {concepts.map((concept, index) => (
          <section className="notes-concept" key={concept.id} aria-labelledby={`${concept.id}-heading`}>
            <header className="notes-concept-copy">
              <div>
                <h2 id={`${concept.id}-heading`}>{concept.name}</h2>
                <p>{concept.summary}</p>
              </div>
              <span>{index === 0 ? 'The roll · ' : ''}{concept.fit}</span>
            </header>
            {concept.preview}
          </section>
        ))}
      </div>

      <footer className="notes-demo-footer">
        <strong>Choose one direction:</strong> Workbench, Vault, or Command Deck. The real version will save privately to your Neon account.
      </footer>
    </main>
  )
}
