'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// Form validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPageV2() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      // TODO: Implement Google Sign-In logic
      console.log('Initiating Google Sign-In');
      // router.push('/');
    } catch (error) {
      console.error('Google Sign-In error:', error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      // TODO: Implement email/password login logic
      console.log('Login data:', data);
      // router.push('/');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F5EF] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/carrot-logo.png"
            alt="Carrot Logo"
            width={80}
            height={80}
            className="h-20 w-20"
            priority
          />
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#1F2C3A] mb-2">
                Welcome to Carrot
              </h1>
              <p className="text-gray-600">
                Sign in to continue to your account
              </p>
            </div>

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#1F2C3A] bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47C23] transition-colors mb-6"
            >
              {isGoogleLoading ? (
                'Signing in...'
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path
                        fill="#4285F4"
                        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.28426 53.749 C -8.52426 55.029 -9.21652 56.159 -10.0802 56.929 L -10.0922 56.929 L -4.10769 61.529 L -4.063 61.529 C -1.17 58.809 0.188 55.169 0.188 51.509 C 0.188 50.809 0.118 50.119 0 49.449 C -0.7 46.719 -2.13 44.229 -4.062 42.249 L -4.062 42.249 Z"
                      />
                      <path
                        fill="#34A853"
                        d="M -14.754 63.239 C -9.44395 63.239 -4.884 60.689 -2.851 56.929 L -10.0922 56.929 C -11.5022 59.989 -14.0039 61.989 -17.0039 62.839 L -17.0039 62.839 L -23.024 66.859 C -20.554 68.189 -17.537 69.009 -14.754 69.009 C -6.27395 69.009 0.745996 63.279 3.005 55.529 L -4.063 49.239 C -5.793 54.169 -9.87395 57.519 -14.754 57.519 C -17.214 57.519 -19.474 56.599 -21.234 55.069 L -21.234 55.069 L -25.454 59.109 C -22.884 61.499 -19.2839 63.239 -14.754 63.239 Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M -17.0039 39.239 L -17.0039 62.839 C -19.9139 61.799 -22.274 59.699 -23.474 57.089 L -23.484 57.089 L -17.464 53.069 C -16.284 54.429 -14.744 55.519 -13.004 55.999 L -13.004 55.999 L -13.004 48.999 C -11.224 49.479 -9.644 50.589 -8.524 51.999 L -8.534 51.999 L -2.524 47.999 C -0.564 44.429 1.516 39.239 1.516 39.239 L -13.004 39.239 L -17.0039 39.239 Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M -14.754 45.989 C -13.284 45.989 -11.904 46.429 -10.734 47.249 L -10.724 47.249 L -4.704 43.209 C -7.894 40.269 -12.284 38.749 -16.754 39.239 L -13.004 39.239 C -13.004 42.999 -10.504 45.989 -6.754 45.989 L -14.754 45.989 Z"
                      />
                    </g>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`w-full px-4 py-3 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-xl focus:ring-2 focus:ring-[#F47C23] focus:border-transparent transition-colors`}
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-sm font-medium text-[#E03D3D] hover:text-[#c23535]">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={`w-full px-4 py-3 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } rounded-xl focus:ring-2 focus:ring-[#F47C23] focus:border-transparent transition-colors`}
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#F47C23] focus:ring-[#F47C23] border-gray-300 rounded"
                  {...register('rememberMe')}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Keep me logged in
                </label>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-[#F47C23] hover:bg-[#e06d16] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47C23] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          </div>

          <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-[#F47C23] hover:text-[#e06d16]">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>By continuing, you agree to our</p>
          <div className="mt-1 space-x-4">
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
