import React from 'react';
import { tokens } from '@/styles/tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    children, 
    loading = false,
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    ...props 
  }, ref) => {
    const baseStyles = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing.gap.sm,
      fontFamily: tokens.typography.fontFamily.sans,
      fontWeight: tokens.components.button.fontWeight,
      borderRadius: tokens.components.button.radius,
      border: 'none',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      transition: `all ${tokens.animation.duration[200]} ${tokens.animation.easing.inOut}`,
      textDecoration: 'none',
      outline: 'none',
      position: 'relative' as const,
      overflow: 'hidden',
    };

    const sizeStyles = {
      sm: {
        height: tokens.components.button.height.sm,
        paddingLeft: tokens.components.button.paddingX.sm,
        paddingRight: tokens.components.button.paddingX.sm,
        fontSize: tokens.typography.fontSize.sm,
      },
      md: {
        height: tokens.components.button.height.md,
        paddingLeft: tokens.components.button.paddingX.md,
        paddingRight: tokens.components.button.paddingX.md,
        fontSize: tokens.typography.fontSize.base,
      },
      lg: {
        height: tokens.components.button.height.lg,
        paddingLeft: tokens.components.button.paddingX.lg,
        paddingRight: tokens.components.button.paddingX.lg,
        fontSize: tokens.typography.fontSize.lg,
      },
    };

    const variantStyles = {
      primary: {
        backgroundColor: tokens.colors.primary[600],
        color: tokens.colors.white,
        boxShadow: tokens.shadows.md,
      },
      secondary: {
        backgroundColor: tokens.colors.gray[100],
        color: tokens.colors.gray[900],
        boxShadow: tokens.shadows.sm,
      },
      outline: {
        backgroundColor: tokens.colors.transparent,
        color: tokens.colors.primary[600],
        border: `1px solid ${tokens.colors.primary[600]}`,
      },
      ghost: {
        backgroundColor: tokens.colors.transparent,
        color: tokens.colors.gray[700],
      },
      danger: {
        backgroundColor: tokens.colors.error[500],
        color: tokens.colors.white,
        boxShadow: tokens.shadows.md,
      },
    };

    const hoverStyles = {
      primary: {
        backgroundColor: tokens.colors.primary[700],
        boxShadow: tokens.shadows.lg,
      },
      secondary: {
        backgroundColor: tokens.colors.gray[200],
      },
      outline: {
        backgroundColor: tokens.colors.primary[50],
      },
      ghost: {
        backgroundColor: tokens.colors.gray[100],
      },
      danger: {
        backgroundColor: tokens.colors.error[600],
      },
    };

    const disabledStyles = {
      opacity: '0.5',
      cursor: 'not-allowed',
    };

    const combinedStyles = {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(disabled || loading ? disabledStyles : {}),
    };

    return (
      <button
        ref={ref}
        style={combinedStyles}
        className={`button-${variant} button-${size} ${className}`}
        disabled={disabled || loading}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, hoverStyles[variant]);
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, variantStyles[variant]);
          }
        }}
        onFocus={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.outline = `2px solid ${tokens.colors.primary[500]}`;
            e.currentTarget.style.outlineOffset = '2px';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
        {...props}
      >
        {loading && (
          <div
            style={{
              width: '1rem',
              height: '1rem',
              border: `2px solid ${tokens.colors.transparent}`,
              borderTop: `2px solid currentColor`,
              borderRadius: tokens.borderRadius.full,
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
        {leftIcon && !loading && leftIcon}
        {children}
        {rightIcon && !loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Add the spin animation to global styles if not already present
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
