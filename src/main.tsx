import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { initI18n } from '@/presentation/i18n'
import { SetupNotice } from '@/presentation/components/SetupNotice'
import { buildApp } from '@/shared/di/container'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

await initI18n()

const wiring = buildApp()

createRoot(root).render(
  <StrictMode>
    {'repo' in wiring ? (
      <App repo={wiring.repo} visited={wiring.visited} images={wiring.images} />
    ) : (
      <SetupNotice detail={wiring.error} />
    )}
  </StrictMode>,
)
