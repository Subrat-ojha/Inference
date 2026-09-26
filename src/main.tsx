import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/source-sans-3'
import './styles.css'
import App from './App'

const HeaderBackgroundDemo = React.lazy(() => import('./HeaderBackgroundDemo'))
const showHeaderDemo = new URLSearchParams(window.location.search).has('header-demo')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {showHeaderDemo ? (
      <Suspense fallback={<main className="header-demo-loading">Loading header study…</main>}>
        <HeaderBackgroundDemo />
      </Suspense>
    ) : <App />}
  </React.StrictMode>,
)
