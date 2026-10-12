import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  registerWithEmailPassword,
  loginWithEmailPassword,
  signOutUser,
} from '../firebase';
import {
  ShieldCheck,
  Compass,
  Wind,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  LogOut,
  MapPin,
  HeartPulse,
} from 'lucide-react';

interface AuthViewProps {
  currentUser: User | null;
  onContinueToDashboard: () => void;
  onAuthSuccess?: () => void;
}

export function AuthView({
  currentUser,
  onContinueToDashboard,
  onAuthSuccess,
}: AuthViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, show friendly welcome card with action to enter dashboard
  if (currentUser) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8 animate-in fade-in duration-300">
        <div className="bg-surface-container rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-xl text-center">
          <div className="relative inline-block mb-4">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'User'}
                className="w-20 h-20 rounded-full border-4 border-primary/30 mx-auto shadow-md object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-3xl font-bold mx-auto border-4 border-primary/30">
                {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs shadow">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authenticated Commuter
          </span>

          <h2 className="text-2xl font-bold text-on-surface">
            Welcome back, {currentUser.displayName || currentUser.email?.split('@')[0] || 'Commuter'}!
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 mb-6">
            Connected via <span className="font-medium text-on-surface">{currentUser.email}</span>
          </p>

          <div className="bg-surface-container-high/60 rounded-2xl p-4 mb-6 border border-outline-variant/20 grid grid-cols-3 gap-2 text-center">
            <div className="p-2">
              <Wind className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xs text-on-surface-variant">Live AQI</div>
              <div className="font-bold text-sm text-on-surface">Protected</div>
            </div>
            <div className="p-2 border-x border-outline-variant/20">
              <MapPin className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-on-surface-variant">Cloud Sync</div>
              <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Active</div>
            </div>
            <div className="p-2">
              <HeartPulse className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="text-xs text-on-surface-variant">Sensitivity</div>
              <div className="font-bold text-sm text-on-surface">Personalized</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onContinueToDashboard}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>Enter Telemetry Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOutUser();
              }}
              className="py-3.5 px-5 rounded-2xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 border border-outline-variant/30"
            >
              <LogOut className="w-4 h-4 text-on-surface-variant" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      setSuccessMessage('Successfully signed in with Google!');
      if (onAuthSuccess) onAuthSuccess();
      setTimeout(() => {
        onContinueToDashboard();
      }, 500);
    } catch (err: unknown) {
      console.error('Google Sign-In error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setErrorMessage('Sign-in cancelled. Please try again when ready.');
      } else {
        setErrorMessage('Google Sign-In failed: ' + (msg.length > 80 ? msg.slice(0, 80) + '...' : msg));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'register') {
        await registerWithEmailPassword(email.trim(), password, displayName.trim() || undefined);
        setSuccessMessage('Account registered successfully! Redirecting...');
      } else {
        await loginWithEmailPassword(email.trim(), password);
        setSuccessMessage('Signed in successfully! Redirecting...');
      }

      if (onAuthSuccess) onAuthSuccess();
      setTimeout(() => {
        onContinueToDashboard();
      }, 500);
    } catch (err: unknown) {
      console.error('Email auth error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('user-not-found') || msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setErrorMessage('Invalid email or password. Please check credentials or switch to Register.');
      } else if (msg.includes('email-already-in-use')) {
        setErrorMessage('This email is already registered. Please sign in instead.');
      } else if (msg.includes('weak-password')) {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else if (msg.includes('invalid-email')) {
        setErrorMessage('Please provide a valid email address.');
      } else {
        setErrorMessage('Authentication notice: ' + (msg.length > 90 ? msg.slice(0, 90) + '...' : msg));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-3 shadow-inner">
          <Wind className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          EcoRoute Commuter Portal
        </h1>
        <p className="text-sm text-on-surface-variant max-w-sm mx-auto mt-1">
          Clean-air navigation, particulate exposure avoidance, and real-time corridor monitoring.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-surface-container rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-2xl backdrop-blur-sm">
        {/* Switcher Tabs: Sign In / Create Account */}
        <div className="flex bg-surface-container-high/80 p-1 rounded-2xl mb-6 border border-outline-variant/30">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              authMode === 'login'
                ? 'bg-surface text-on-surface shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              authMode === 'register'
                ? 'bg-surface text-on-surface shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{successMessage}</div>
          </div>
        )}

        {/* Quick Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full py-3.5 px-4 rounded-2xl bg-surface border border-outline-variant/40 hover:bg-surface-container-high text-on-surface font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60"
        >
          {googleLoading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.64v3h3.86c2.26-2.09 3.685-5.17 3.685-9.08z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-container px-3 text-on-surface-variant font-medium tracking-wider">
              or continue with email
            </span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                Full Name or Commuter Handle
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Chen"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-on-surface-variant/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-on-surface-variant">
                Password
              </label>
              {authMode === 'login' && (
                <span className="text-xs text-primary hover:underline cursor-pointer">
                  Forgot password?
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-surface border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-on-surface-variant/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{authMode === 'login' ? 'Sign In to EcoRoute' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Guest Skip Option */}
        <div className="mt-6 pt-5 border-t border-outline-variant/30 text-center">
          <button
            type="button"
            onClick={onContinueToDashboard}
            className="text-xs sm:text-sm font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1.5 transition-colors group"
          >
            <span>Explore EcoRoute Telemetry as Guest</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Feature highlights below the card */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-container-low/70 rounded-2xl p-3.5 border border-outline-variant/20 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Clean-Air Routing</div>
            <div className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
              Live Google Maps comparison of PM2.5 exposure along commuter paths.
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low/70 rounded-2xl p-3.5 border border-outline-variant/20 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Cloud Preferences</div>
            <div className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
              Saved corridors, bookmark routes, and threshold notifications synced via Firestore.
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low/70 rounded-2xl p-3.5 border border-outline-variant/20 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Pollution Hotspots</div>
            <div className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
              Urban industrial & traffic plume warnings with automatic bypass routes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
