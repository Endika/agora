import { render, screen } from '@testing-library/react'
import { App } from '@/App'

it('renders the board shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agora')
})
