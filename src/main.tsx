import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { initI18n } from '@/presentation/i18n'
import { buildBoardRepository } from '@/shared/di/container'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

await initI18n()

createRoot(root).render(
  <StrictMode>
    <App repo={buildBoardRepository()} />
  </StrictMode>,
)
