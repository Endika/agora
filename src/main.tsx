import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { initI18n } from '@/presentation/i18n'
import { ErrorBoundary } from '@/presentation/components/CrashScreen'
import { SetupNotice } from '@/presentation/components/SetupNotice'
import { buildApp } from '@/shared/di/container'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

await initI18n()

const wiring = buildApp()

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {'repo' in wiring ? <App {...wiring} /> : <SetupNotice detail={wiring.error} />}
    </ErrorBoundary>
  </StrictMode>,
)
