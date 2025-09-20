# Design Token System

This document outlines the comprehensive design token system for the Carrot application, providing consistent design patterns and type-safe access to design values.

## Overview

The design token system consists of:
- **CSS Custom Properties** (`design-tokens.css`) - The source of truth for all design values
- **TypeScript Utilities** (`tokens.ts`) - Type-safe access to tokens in React components
- **Component Examples** - Demonstrating proper token usage

## File Structure

```
src/styles/
├── design-tokens.css    # CSS custom properties (design tokens)
├── tokens.ts           # TypeScript utilities for token access
└── README.md          # This documentation
```

## Token Categories

### 🎨 Colors

#### Primary Colors (Civic Blue System)
```css
--color-primary-600: #2563eb; /* Main Civic Blue */
--color-primary-500: #3b82f6; /* Lighter blue */
--color-primary-700: #1d4ed8; /* Darker blue */
```

#### Usage in TypeScript
```typescript
import { tokens } from '@/styles/tokens';

// In component styles
const buttonStyle = {
  backgroundColor: tokens.colors.primary[600],
  color: tokens.colors.white,
};
```

#### Usage in CSS
```css
.my-component {
  background-color: var(--color-primary-600);
  color: var(--color-white);
}
```

### 📝 Typography

#### Font Sizes
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
```

#### Usage
```typescript
const headingStyle = {
  fontSize: tokens.typography.fontSize.xl,
  fontWeight: tokens.typography.fontWeight.semibold,
  lineHeight: tokens.typography.lineHeight.tight,
};
```

### 📏 Spacing

#### Base Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
```

#### Semantic Spacing
```css
--gap-sm: var(--space-2);     /* 8px */
--gap-md: var(--space-3);     /* 12px */
--gap-lg: var(--space-4);     /* 16px */
```

#### Usage
```typescript
const containerStyle = {
  padding: tokens.spacing.padding.lg,
  gap: tokens.spacing.gap.md,
};
```

### 🔘 Border Radius
```css
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-full: 9999px;   /* Fully rounded */
```

### 🌟 Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-glow-blue: 0 0 20px rgb(59 130 246 / 0.3);
```

## Component Tokens

### 🔲 Button Tokens
```css
--button-height-md: 2.5rem;    /* 40px */
--button-padding-x-md: var(--space-4);
--button-radius: var(--radius-lg);
--button-font-weight: var(--font-medium);
```

### 📝 Input Tokens
```css
--input-height: var(--button-height-md);
--input-padding-x: var(--space-3);
--input-radius: var(--radius-md);
--input-border-color: var(--color-gray-300);
--input-border-color-focus: var(--color-primary-500);
```

### 🃏 Card Tokens
```css
--card-padding: var(--space-6);
--card-radius: var(--radius-xl);
--card-shadow: var(--shadow-md);
--card-border-color: var(--color-gray-200);
```

## Usage Patterns

### 1. CSS-in-JS (Recommended for React)
```typescript
import { tokens } from '@/styles/tokens';

const MyComponent = () => {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.white,
        padding: tokens.spacing.padding.lg,
        borderRadius: tokens.borderRadius.xl,
        boxShadow: tokens.shadows.md,
      }}
    >
      <h2
        style={{
          fontSize: tokens.typography.fontSize['2xl'],
          fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.colors.gray[900],
          marginBottom: tokens.spacing[4],
        }}
      >
        Card Title
      </h2>
      <p
        style={{
          fontSize: tokens.typography.fontSize.base,
          color: tokens.colors.gray[600],
          lineHeight: tokens.typography.lineHeight.relaxed,
        }}
      >
        Card content goes here.
      </p>
    </div>
  );
};
```

### 2. CSS Classes with Custom Properties
```css
.card {
  background-color: var(--color-white);
  padding: var(--card-padding);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  border: var(--card-border-width) solid var(--card-border-color);
}

.card-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-gray-900);
  margin-bottom: var(--space-4);
}
```

### 3. Styled Components
```typescript
import styled from 'styled-components';
import { tokens } from '@/styles/tokens';

const Card = styled.div`
  background-color: ${tokens.colors.white};
  padding: ${tokens.spacing.padding.lg};
  border-radius: ${tokens.borderRadius.xl};
  box-shadow: ${tokens.shadows.md};
`;
```

## Animation Tokens

### Duration
```css
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
```

### Easing
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
```

### Usage
```typescript
const animatedStyle = {
  transition: `all ${tokens.animation.duration[200]} ${tokens.animation.easing.inOut}`,
};
```

## Z-Index Scale

```css
--z-dropdown: 1000;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-tooltip: 1070;
```

## Layout Tokens

### Container Widths
```css
--container-lg: 1024px;
--container-xl: 1280px;
```

### Component Dimensions
```css
--sidebar-width: 272px;
--header-height: 4rem;
--chatbar-height: 4.5rem;
```

## Best Practices

### ✅ Do's
- **Use semantic tokens** when available (e.g., `--gap-md` instead of `--space-3`)
- **Use TypeScript utilities** for type safety and autocomplete
- **Maintain consistency** by always using tokens instead of hardcoded values
- **Use component tokens** for component-specific styling
- **Group related styles** using the token categories

### ❌ Don'ts
- **Don't hardcode values** - always use tokens
- **Don't create custom CSS properties** without adding them to the token system
- **Don't mix token systems** - stick to one approach per component
- **Don't override token values** in components - extend the token system instead

## Extending the Token System

### Adding New Tokens
1. Add the CSS custom property to `design-tokens.css`
2. Add the TypeScript reference to `tokens.ts`
3. Update this documentation
4. Test across components

### Example: Adding a New Color
```css
/* design-tokens.css */
--color-brand-purple: #8b5cf6;
```

```typescript
// tokens.ts
export const colors = {
  // ... existing colors
  brand: {
    purple: 'var(--color-brand-purple)',
  },
} as const;
```

## Migration Guide

### From Tailwind Classes to Tokens
```typescript
// Before (Tailwind)
<div className="bg-blue-600 text-white p-6 rounded-xl shadow-md">

// After (Tokens)
<div
  style={{
    backgroundColor: tokens.colors.primary[600],
    color: tokens.colors.white,
    padding: tokens.spacing.padding.lg,
    borderRadius: tokens.borderRadius.xl,
    boxShadow: tokens.shadows.md,
  }}
>
```

### From Hardcoded Values to Tokens
```typescript
// Before
const style = {
  fontSize: '16px',
  padding: '24px',
  borderRadius: '12px',
};

// After
const style = {
  fontSize: tokens.typography.fontSize.base,
  padding: tokens.spacing.padding.lg,
  borderRadius: tokens.borderRadius.xl,
};
```

## Utilities

### Getting CSS Variable Values
```typescript
import { getCSSVar } from '@/styles/tokens';

const primaryColor = getCSSVar('--color-primary-600');
```

### Setting CSS Variable Values
```typescript
import { setCSSVar } from '@/styles/tokens';

setCSSVar('--color-primary-600', '#1d4ed8');
```

## Integration with Existing Systems

The design token system is designed to work alongside:
- **Tailwind CSS** - Use tokens for custom components, Tailwind for utilities
- **Styled Components** - Import tokens for consistent styling
- **CSS Modules** - Reference tokens in CSS files
- **Emotion/Styled-system** - Use tokens as theme values

## Performance Considerations

- **CSS Custom Properties** are highly performant and cached by the browser
- **TypeScript utilities** have zero runtime overhead
- **Token changes** propagate instantly across the entire application
- **Bundle size** impact is minimal due to CSS custom property reuse

---

For questions or contributions to the design system, please refer to the development team.
