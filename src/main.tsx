import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// PixiJSとの互換性のため、開発モードでStrictModeを一時的に無効化
createRoot(document.getElementById('root')!).render(
  import.meta.env.PROD ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
)
