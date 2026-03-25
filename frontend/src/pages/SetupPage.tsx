import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GalentixLogo from '../components/ui/GalentixLogo';

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);

  const score = [hasMinLength, hasUpper, hasLower, hasDigit].filter(Boolean).length;

  if (score <= 2) return 'weak';
  if (score === 3) return 'medium';
  return 'strong';
}

function meetsPolicy(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export default function SetupPage() {
  useEffect(() => { document.title = "Setup - Galentix AI"; }, []);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if setup is actually needed
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/auth/setup-status');
        if (response.ok) {
          const data = await response.json();
          if (!data.needs_setup) {
            navigate('/login', { replace: true });
            return;
          }
        }
      } catch {
        // If we can't determine, stay on setup page
      }
      setCheckingSetup(false);
    };

    checkSetupStatus();
  }, [navigate]);

  const strength = getPasswordStrength(password);
  const passwordValid = meetsPolicy(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    username.trim().length > 0 &&
    passwordValid &&
    passwordsMatch &&
    !isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim() || null,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: 'Setup failed' }));
        throw new Error(data.detail || 'Failed to create admin account');
      }

      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message.includes('fetch')) {
        setError('Server unreachable. Please check that Galentix AI is running.');
      } else {
        setError((err as Error).message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthColor = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  }[strength];

  const strengthWidth = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  }[strength];

  const strengthLabel = {
    weak: t('auth.passwordWeak'),
    medium: t('auth.passwordMedium'),
    strong: t('auth.passwordStrong'),
  }[strength];

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-galentix-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4">
              <GalentixLogo size="md" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('welcome.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('auth.createAdmin')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          )}

          {/* Setup Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.chooseUsername')}
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.email')} <span className="text-gray-500 dark:text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.createPassword')}
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor} ${strengthWidth}`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs ${
                      strength === 'weak' ? 'text-red-500' :
                      strength === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {strengthLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Password Policy */}
              <div className="mt-2 space-y-1">
                <PolicyCheck met={password.length >= 8} label={t('auth.policyMinLength')} />
                <PolicyCheck met={/[A-Z]/.test(password)} label={t('auth.policyUppercase')} />
                <PolicyCheck met={/[a-z]/.test(password)} label={t('auth.policyLowercase')} />
                <PolicyCheck met={/\d/.test(password)} label={t('auth.policyDigit')} />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirmYourPassword')}
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-500">{t('auth.passwordsMismatch')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-2.5 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                t('auth.createAdmin')
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('system.privacyFooter')}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function PolicyCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      )}
      <span className={`text-xs ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}
