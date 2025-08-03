"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import CarrotLogo from '@/components/CarrotLogo';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  // Step state: 1 = enter email, 2 = enter code
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // Handler: send code to email (real)
  const handleSendCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      console.log('[Signup] send-code response:', data);
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to send code. Please try again.');
        return;
      }
      setCodeSent(true);
      setStep(2);
    } catch (err) {
      setError('Failed to send code. Please try again.');
      console.error('[Signup] send-code error:', err);
    } finally {
      setIsLoading(false);
    }
  };



  // Handler: verify code (stub)
  const handleVerifyCode = async () => {
    setIsLoading(true);
    setError('');
    // TODO: Implement backend code verification logic
    setTimeout(() => {
      setIsLoading(false);
      // TODO: On success, proceed to 2FA setup step
      alert('Code verified! (2FA setup step next)');
    }, 1000);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      setIsLoading(true);
      setError('');
      // TODO: Implement signup logic with Firebase Auth
      console.log('Signup data:', data);
      // Redirect to home or dashboard after successful signup
    } catch (err) {
      setError('Failed to create an account. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <CarrotLogo />
        </div>
        <h2 className="mb-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mb-8 text-center text-sm text-gray-600">
          Or{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
            sign in to your existing account
          </Link>
        </p>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        {/* Custom passwordless signup UI */}
        <form className="space-y-6" onSubmit={e => e.preventDefault()}>
          <div className="rounded-md shadow-sm space-y-4">
            {/* Email address input */}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading || codeSent}
              />
            </div>

            {/* Send code button */}
            <div>
              <button
                type="button"
                className="mt-4 w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-bold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={handleSendCode}
                disabled={isLoading || !email || codeSent}
              >
                {isLoading ? 'Sending…' : 'Send Code'}
              </button>
              {codeSent && (
                <p className="mt-2 text-xs text-green-600 text-center">A code was sent to your email.</p>
              )}
            </div>

            {/* Code input */}
            <div>
              <input
                id="signup-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                placeholder="Enter 8-digit code"
                className="mt-6 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm tracking-widest text-center"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={!codeSent || isLoading}
              />
            </div>

            {/* Continue button */}
            <div>
              <button
                type="button"
                className={`mt-4 w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-bold text-white ${codeSent && code.length === 8 ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-300 cursor-not-allowed'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition`}
                onClick={handleVerifyCode}
                disabled={!codeSent || code.length !== 8 || isLoading}
              >
                Continue
              </button>
            </div>



            

           
          </div>

        </form>
      </div>
    </div>
  );
}
