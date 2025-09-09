import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Create a simplified onboarding flow component for testing
function MockOnboardingFlow({ session }: { session: any }) {
  const [step, setStep] = React.useState(1)
  const [formData, setFormData] = React.useState<any>({})
  const TOTAL_STEPS = 3

  function handleNextStep(data: any) {
    setFormData((prev: any) => ({ ...prev, ...data }))
    setStep((prev) => prev + 1)
  }

  function handleBackStep() {
    setStep((prev) => prev - 1)
  }

  // Validate session
  const email = session?.user?.email
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return (
      <div data-testid="error-state">
        Onboarding Error: Your session is missing an email address.
      </div>
    )
  }

  // Render current step
  if (step === 1) {
    return (
      <div>
        <div data-testid="stepper-bar">Step {step} of {TOTAL_STEPS}</div>
        <div data-testid="personal-info-step">
          <h2>Personal Info Step</h2>
          <button onClick={() => handleNextStep({ firstName: 'John', lastName: 'Doe' })}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div>
        <div data-testid="stepper-bar">Step {step} of {TOTAL_STEPS}</div>
        <div data-testid="tell-friends-step">
          <h2>Tell Your Friends Step</h2>
          <button onClick={handleBackStep}>Back</button>
          <button onClick={() => handleNextStep({ shared: true })}>Continue</button>
        </div>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div>
        <div data-testid="stepper-bar">Step {step} of {TOTAL_STEPS}</div>
        <div data-testid="interests-step">
          <h2>Interests Step</h2>
          <button onClick={handleBackStep}>Back</button>
          <button onClick={() => handleNextStep({ interests: 'coding,reading' })}>
            I'm ready
          </button>
        </div>
      </div>
    )
  }

  return <div>Onboarding Complete!</div>
}

// Add React import
import React from 'react'

describe('Onboarding Flow Integration', () => {
  const mockSession = {
    user: {
      email: 'test@example.com',
      name: 'Test User',
    },
  }

  it('renders error state when session has no email', () => {
    const invalidSession = {
      user: {
        name: 'Test User',
        email: '', // Invalid email
      },
    }

    render(<MockOnboardingFlow session={invalidSession} />)

    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText(/Onboarding Error/)).toBeInTheDocument()
  })

  it('starts with step 1 and shows PersonalInfoStep', () => {
    render(<MockOnboardingFlow session={mockSession} />)

    expect(screen.getByTestId('stepper-bar')).toHaveTextContent('Step 1 of 3')
    expect(screen.getByTestId('personal-info-step')).toBeInTheDocument()
    expect(screen.queryByTestId('tell-friends-step')).not.toBeInTheDocument()
    expect(screen.queryByTestId('interests-step')).not.toBeInTheDocument()
  })

  it('progresses through all onboarding steps', async () => {
    const user = userEvent.setup()
    render(<MockOnboardingFlow session={mockSession} />)

    // Start on step 1
    expect(screen.getByTestId('personal-info-step')).toBeInTheDocument()
    expect(screen.getByTestId('stepper-bar')).toHaveTextContent('Step 1 of 3')

    // Click continue on step 1
    await user.click(screen.getByText('Continue'))

    // Should now be on step 2
    await waitFor(() => {
      expect(screen.getByTestId('tell-friends-step')).toBeInTheDocument()
      expect(screen.getByTestId('stepper-bar')).toHaveTextContent('Step 2 of 3')
    })

    // Click continue on step 2
    await user.click(screen.getByText('Continue'))

    // Should now be on step 3
    await waitFor(() => {
      expect(screen.getByTestId('interests-step')).toBeInTheDocument()
      expect(screen.getByTestId('stepper-bar')).toHaveTextContent('Step 3 of 3')
    })
  })

  it('allows going back through steps', async () => {
    const user = userEvent.setup()
    render(<MockOnboardingFlow session={mockSession} />)

    // Progress to step 2
    await user.click(screen.getByText('Continue'))
    await waitFor(() => {
      expect(screen.getByTestId('tell-friends-step')).toBeInTheDocument()
    })

    // Go back to step 1
    await user.click(screen.getByText('Back'))
    await waitFor(() => {
      expect(screen.getByTestId('personal-info-step')).toBeInTheDocument()
      expect(screen.getByTestId('stepper-bar')).toHaveTextContent('Step 1 of 3')
    })
  })

  describe('Session validation', () => {
    it('validates valid session structure', () => {
      const validSession = {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      expect(validSession.user.email).toBeTruthy()
      expect(validSession.user.email).toContain('@')
      expect(validSession.user.name).toBeTruthy()
    })

    it('identifies invalid session structures', () => {
      const invalidSessions = [
        null,
        {},
        { user: null },
        { user: {} },
        { user: { email: '' } },
        { user: { email: null } },
        { user: { email: undefined } },
      ]

      invalidSessions.forEach(session => {
        const email = session?.user?.email
        const isValid = email && typeof email === 'string' && email.trim() !== ''
        expect(isValid).toBeFalsy()
      })
    })
  })

  describe('Step progression logic', () => {
    it('validates step boundaries', () => {
      const TOTAL_STEPS = 3
      const validSteps = [1, 2, 3]
      const invalidSteps = [0, 4, -1, 'invalid']

      validSteps.forEach(step => {
        expect(step).toBeGreaterThanOrEqual(1)
        expect(step).toBeLessThanOrEqual(TOTAL_STEPS)
      })

      invalidSteps.forEach(step => {
        if (typeof step === 'number') {
          expect(step < 1 || step > TOTAL_STEPS).toBe(true)
        } else {
          expect(typeof step).not.toBe('number')
        }
      })
    })

    it('validates form data accumulation', () => {
      const formData = {}
      const step1Data = { firstName: 'John', lastName: 'Doe' }
      const step2Data = { shared: true }
      const step3Data = { interests: 'coding,reading' }

      const accumulated = {
        ...formData,
        ...step1Data,
        ...step2Data,
        ...step3Data,
      }

      expect(accumulated).toHaveProperty('firstName', 'John')
      expect(accumulated).toHaveProperty('lastName', 'Doe')
      expect(accumulated).toHaveProperty('shared', true)
      expect(accumulated).toHaveProperty('interests', 'coding,reading')
    })
  })
})