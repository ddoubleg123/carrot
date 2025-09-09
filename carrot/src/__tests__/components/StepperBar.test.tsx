import { render, screen } from '@testing-library/react'
import StepperBar from '@/app/onboarding/components/StepperBar'

describe('StepperBar', () => {
  it('renders current step and total steps correctly', () => {
    render(<StepperBar currentStep={2} totalSteps={3} />)
    
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('calculates progress percentage correctly', () => {
    render(<StepperBar currentStep={1} totalSteps={3} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '1')
    expect(progressBar).toHaveAttribute('aria-valuemax', '3')
    expect(progressBar).toHaveAttribute('aria-valuemin', '1')
    
    // Progress should be 33% (1/3 * 100, rounded)
    const progressFill = progressBar.querySelector('.bg-\\[\\#FF7A18\\]')
    expect(progressFill).toHaveStyle('width: 33%')
  })

  it('shows 100% progress when on final step', () => {
    render(<StepperBar currentStep={3} totalSteps={3} />)
    
    const progressBar = screen.getByRole('progressbar')
    const progressFill = progressBar.querySelector('.bg-\\[\\#FF7A18\\]')
    expect(progressFill).toHaveStyle('width: 100%')
  })

  it('has proper accessibility attributes', () => {
    render(<StepperBar currentStep={2} totalSteps={5} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', 'Progress bar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '2')
    expect(progressBar).toHaveAttribute('aria-valuemax', '5')
    expect(progressBar).toHaveAttribute('aria-valuemin', '1')
  })
})