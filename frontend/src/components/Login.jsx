import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Icon from './Icon';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isRegistering ? 'http://localhost:5000/api/register' : 'http://localhost:5000/api/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegistering) {
          setIsRegistering(false);
          setPassword('');
          setError('');
        } else {
          login(data.user, data.token);
          navigate('/profile');
        }
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      console.error(err);
      setError('Server is offline. Is your Node backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      {/* Background glows */}
      <div className="bg-glow-primary" />
      <div className="bg-glow-secondary" />

      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 16px 48px' }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="card" >
          {/* Gradient shield icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div className="bg-login-gradient" style={{
              width: 80, height: 80, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(170,199,255,0.3)'
            }}>
              <Icon name={isRegistering ? 'person_add' : 'shield'} fill size={36} style={{ color: 'var(--on-primary-container)' }} />
            </div>
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 14, margin: 0 }}>
              {isRegistering ? 'Join Drishti to personalize your assistant' : 'Sign in to access your visual assistant'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--danger-bg)', padding: '12px 16px',
              borderRadius: 12, color: 'var(--error)', fontSize: 14,
              textAlign: 'center', marginBottom: 24, animation: 'slideIn 0.3s ease-out'
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="input-group">
              <label htmlFor="email" className="input-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Icon name="mail" size={20} className="input-icon" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)' }} />
                <input
                  type="email" id="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 48 }}
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password" className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Icon name="lock" size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)' }} />
                <input
                  type={showPassword ? 'text' : 'password'} id="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 48, paddingRight: 48 }}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--outline)', cursor: 'pointer', padding: 4
                  }}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" style={{
                background: 'none', border: 'none', color: 'var(--primary)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>
                Forgot Password?
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.7 : 1, boxShadow: '0 8px 24px rgba(170,199,255,0.15)' }}
              >
                {isLoading ? 'Processing...' : (
                  <>
                    {isRegistering ? 'Create Account' : 'Sign In'}
                    <Icon name="arrow_forward" size={20} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn btn-outline btn-lg"
              >
                Cancel & Return
              </button>
            </div>
          </form>

          {/* Toggle link */}
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--on-surface-variant)', margin: 0 }}>
              {isRegistering ? 'Already have an account? ' : 'New to Drishti? '}
              <button
                onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary)',
                  fontWeight: 700, cursor: 'pointer', marginLeft: 4,
                  textDecoration: 'none', fontSize: 14
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                {isRegistering ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
