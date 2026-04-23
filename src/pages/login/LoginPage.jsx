import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext.jsx';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAppContext();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter your email and password.'); return; }
    if (isLoading) return;
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      toast.error('Incorrect credentials. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Left panel: branding ── */}
      <div className="login-left">
        <div className="login-brand">
          <img src="/across_logo.png" alt="GSSA Logo" className="login-brand-logo" />
          <h1 className="login-brand-title">GSSA Cargo<br />Management</h1>
          <p className="login-brand-subtitle">
            Air cargo management platform for GSSA agents
          </p>
        </div>

        <div className="login-features">
          {[
            { icon: '✈️', text: 'Booking management and AWB issuance' },
            { icon: '📊', text: 'Revenue reporting and analytics' },
            { icon: '🧾', text: 'Per-agent billing' },
          ].map(({ icon, text }) => (
            <div key={text} className="login-feature">
              <div className="login-feature-icon" style={{ fontSize: '1.1rem' }}>{icon}</div>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="login-right">
        <div className="login-form-container">
          <h2 className="login-form-title">Welcome</h2>
          <p className="login-form-subtitle">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="form-group">
              <label htmlFor="email" className="form-label required">Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label required">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'transparent',
                    border: 'none', cursor: 'pointer', color: 'var(--color-gray-400)',
                    padding: '2px', display: 'flex',
                  }}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="button button-primary button-lg"
              disabled={isLoading}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p style={{
            marginTop: 'var(--space-8)', fontSize: 'var(--font-size-xs)',
            color: 'var(--color-gray-400)', textAlign: 'center',
          }}>
            © {new Date().getFullYear()} GSSA Cargo Management System
          </p>
        </div>
      </div>
    </div>
  );
}
