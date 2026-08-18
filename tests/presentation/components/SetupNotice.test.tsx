import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupNotice } from '@/presentation/components/SetupNotice'

describe('SetupNotice', () => {
  it('says what is missing instead of leaving a blank page', () => {
    render(<SetupNotice detail="VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Agora no está configurada')
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument()
  })
})
