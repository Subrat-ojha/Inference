import { useEffect, useMemo, useState } from 'react'
import './header-demo.css'

type Theme = 'light' | 'dark'
type Variant = 'signal' | 'roadmap' | 'pipeline' | 'birds'

const options: Array<{
  id: Variant
  name: string
  summary: string
  note: string
}> = [
  {
    id: 'signal',
    name: 'Inference signal trace',
    summary: 'A measured data path runs through the header while one packet advances toward the current stage.',
    note: 'Quietest · most faithful to the ledger',
  },
  {
    id: 'roadmap',
    name: 'Roadmap pulse field',
    summary: 'Twenty-eight sprint marks turn the background into a living map of the two learning tracks.',
    note: 'Most progress-focused',
  },
  {
    id: 'pipeline',
    name: 'Model pipeline',
    summary: 'A restrained input-to-output sequence makes the inference theme explicit without inventing metrics.',
    note: 'Most technical · strongest personality',
  },
  {
    id: 'birds',
    name: 'Flying birds',
    summary: 'A small flock crosses the header slowly, adding natural movement without covering the study record.',
    note: 'Most playful · calm motion',
  },
]

function SignalTrace() {
  return (
    <svg className="signal-field" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true">
      <path className="signal-baseline" d="M0 128 H1200" />
      <path
        className="signal-path signal-path-ghost"
        d="M0 116 L84 116 L116 82 L172 82 L204 128 L276 128 L314 62 L356 62 L402 112 L470 112 L506 94 L564 94 L606 40 L660 40 L704 116 L770 116 L810 76 L878 76 L916 126 L986 126 L1026 98 L1092 98 L1134 54 L1200 54"
      />
      <path
        className="signal-path signal-path-live"
        pathLength="100"
        d="M0 116 L84 116 L116 82 L172 82 L204 128 L276 128 L314 62 L356 62 L402 112 L470 112 L506 94 L564 94 L606 40 L660 40 L704 116 L770 116 L810 76 L878 76 L916 126 L986 126 L1026 98 L1092 98 L1134 54 L1200 54"
      />
      <g className="signal-nodes">
        <circle cx="116" cy="82" r="4" />
        <circle cx="314" cy="62" r="4" />
        <circle className="is-current" cx="606" cy="40" r="5" />
        <circle cx="810" cy="76" r="4" />
        <circle cx="1134" cy="54" r="4" />
      </g>
    </svg>
  )
}

function RoadmapPulse() {
  const marks = useMemo(
    () => Array.from({ length: 28 }, (_, index) => ({
      id: index + 1,
      height: 22 + ((index * 17) % 52),
    })),
    [],
  )

  return (
    <div className="roadmap-field" aria-hidden="true">
      {marks.map((mark) => (
        <span
          className={mark.id <= 2 ? 'is-complete' : mark.id === 3 ? 'is-current' : ''}
          key={mark.id}
          style={{ '--mark-height': `${mark.height}%` } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function ModelPipeline() {
  return (
    <div className="pipeline-field" aria-hidden="true">
      <div className="pipeline-line"><span /></div>
      {['Input', 'Encode', 'Serve', 'Output'].map((label, index) => (
        <div className="pipeline-node" key={label} style={{ '--node-index': index } as React.CSSProperties}>
          <span />
          <small>{label}</small>
        </div>
      ))}
    </div>
  )
}

function FlyingBirds() {
  return (
    <svg className="bird-flight-field" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true">
      <g className="demo-bird demo-bird-one">
        <path d="M-90 58 Q-78 44 -66 58 Q-54 44 -42 58" />
      </g>
      <g className="demo-bird demo-bird-two">
        <path d="M-150 104 Q-141 94 -132 104 Q-123 94 -114 104" />
      </g>
      <g className="demo-bird demo-bird-three">
        <path d="M-230 34 Q-222 25 -214 34 Q-206 25 -198 34" />
      </g>
      <path className="bird-horizon" d="M0 146 H1200" />
    </svg>
  )
}

function HeaderBackground({ variant }: { variant: Variant }) {
  return (
    <div className={`demo-header demo-header-${variant}`}>
      {variant === 'signal' && <SignalTrace />}
      {variant === 'roadmap' && <RoadmapPulse />}
      {variant === 'pipeline' && <ModelPipeline />}
      {variant === 'birds' && <FlyingBirds />}

      <div className="demo-header-grid">
        <div className="demo-brand-block">
          <h2>Inference Engineering</h2>
          <p>Inference + Java backend</p>
        </div>

        <div className="demo-overall-block">
          <span>8% complete</span>
          <progress value="8" max="100" aria-label="8% complete" />
        </div>

        <div className="demo-current-block">
          <p>Current · AI · stage 01</p>
          <div className="demo-account-controls">
            <span className="demo-email">learner@example.com</span>
            <button type="button" disabled>Sign out</button>
            <button className="demo-theme-preview" type="button" disabled aria-hidden="true">
              <span>Dark mode</span>
              <span className="demo-switch"><span /></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeaderBackgroundDemo() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem('inference-track:theme:v1')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Header background study · Inference Engineering'
    document.documentElement.dataset.theme = theme

    return () => {
      document.title = previousTitle
    }
  }, [theme])

  return (
    <main className={`header-demo-page ${motionEnabled ? '' : 'is-motion-paused'}`}>
      <header className="demo-intro">
        <div>
          <h1>Choose the header’s energy.</h1>
          <p>
            Same content, same layout, four theme-aware backgrounds. Compare the motion at full width before changing the tracker.
          </p>
          <p className="demo-disclosure">Progress, stage, and account values are illustrative preview data.</p>
        </div>

        <div className="demo-toolbar" aria-label="Preview controls">
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Show light theme' : 'Show dark theme'}
          </button>
          <button
            type="button"
            aria-pressed={!motionEnabled}
            onClick={() => setMotionEnabled((current) => !current)}
          >
            {motionEnabled ? 'Pause motion' : 'Resume motion'}
          </button>
          <a href="/">Back to tracker</a>
        </div>
      </header>

      <div className="demo-options">
        {options.map((option) => (
          <section className="demo-option" key={option.id} aria-labelledby={`${option.id}-title`}>
            <div className="demo-option-copy">
              <div>
                <h2 id={`${option.id}-title`}>{option.name}</h2>
                <p>{option.summary}</p>
              </div>
              <span>{option.note}</span>
            </div>
            <HeaderBackground variant={option.id} />
          </section>
        ))}
      </div>

      <footer className="demo-footer">
        <p>Nothing on the production tracker has changed. Pick a direction after comparing both themes and motion states.</p>
      </footer>
    </main>
  )
}
