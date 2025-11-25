import { HashRouter, Routes, Route } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from 'react-error-boundary'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import fetch from './libs/fetch'
import './App.css'

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert" className="p-6 bg-red-100 text-red-900 rounded-lg m-6">
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <pre className="text-sm whitespace-pre-wrap">{error.message}</pre>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HelmetProvider>
        <ToastProvider>
          <SWRConfig
            value={{
              fetcher: fetch,
              revalidateOnFocus: false,
            }}
          >
            <HashRouter>
              <Routes>
                <Route path="/" element={<Dashboard />} />
              </Routes>
            </HashRouter>
            <ToastContainer />
          </SWRConfig>
        </ToastProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
