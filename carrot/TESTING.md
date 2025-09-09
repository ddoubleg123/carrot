# Carrot Testing Documentation

## Overview

Comprehensive test suite for the Carrot social platform including unit tests, integration tests, and API endpoint validation.

## Test Structure

```
src/__tests__/
├── components/           # Component unit tests
│   ├── StepperBar.test.tsx
│   └── ProtectedRoute.test.tsx
├── utils/               # Utility function tests
│   └── crop.test.ts
├── api/                # API endpoint tests
│   └── posts.test.ts
└── pages/              # Integration tests
    └── onboarding.integration.test.tsx
```

## Test Categories

### 1. Component Tests
- **StepperBar**: Progress indicator with accessibility features
- **ProtectedRoute**: Authentication logic and redirection

### 2. Utility Tests
- **crop.ts**: Image cropping mathematics and canvas operations

### 3. API Tests
- **posts**: Request validation and business logic

### 4. Integration Tests
- **Onboarding Flow**: Multi-step user onboarding process

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- --testPathPatterns=StepperBar
```

## Test Framework

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **Testing Library Jest DOM**: Additional DOM matchers
- **User Event**: User interaction simulation

## Coverage Summary

Current test coverage focuses on critical user flows:
- ✅ Onboarding stepper component (100% coverage)
- ✅ Authentication protection logic
- ✅ Image processing utilities
- ✅ API request validation
- ✅ Multi-step form workflows

## Mock Strategy

Tests use minimal mocking to ensure reliability:
- Firebase services mocked globally
- Next.js navigation mocked
- Canvas API mocked for image processing
- Network requests isolated

## Continuous Integration

Tests are configured to run with:
- Node.js environment for API tests
- JSDOM environment for React components
- Proper TypeScript configuration
- ESLint integration

## Future Improvements

### Priority Test Areas
1. Database transaction tests
2. File upload functionality
3. Real-time features
4. Authentication flows
5. Mobile responsiveness
6. Performance benchmarks

### Test Infrastructure
1. E2E testing with Playwright
2. Visual regression testing
3. API contract testing
4. Load testing setup

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure 80%+ coverage for new code
3. Include both happy path and error cases
4. Test accessibility requirements
5. Update this documentation