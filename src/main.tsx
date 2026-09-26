import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/source-sans-3'
import './styles.css'
import App from './App'

const HeaderBackgroundDemo = React.lazy(() => import('./HeaderBackgroundDemo'))
const NotesDesignDemo = React.lazy(() => import('./NotesDesignDemo'))
const searchParams = new URLSearchParams(window.location.search)
const showHeaderDemo = searchParams.has('header-demo')
const showNotesDemo = searchParams.has('notes-demo')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {showNotesDemo ? (
      <Suspense fallback={<main className="header-demo-loading">Loading notes study…</main>}>
        <NotesDesignDemo />
      </Suspense>
    ) : showHeaderDemo ? (
      <Suspense fallback={<main className="header-demo-loading">Loading header study…</main>}>
        <HeaderBackgroundDemo />
      </Suspense>
    ) : <App />}
  </React.StrictMode>,
)
