import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="neon-card" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="text-center">
          <h1 className="glitch" data-text="SF LAYOUT CSV">SF LAYOUT CSV</h1>
          <p style={{ color: 'var(--neon-cyan)', marginBottom: '30px' }}>
            Cyberpunk Salesforce Layout Extractor
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="neon-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@domain.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="neon-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="neon-button"
            disabled={loading}
            style={{ width: '100%', marginBottom: '15px' }}
          >
            {loading ? 'LOGGING IN...' : 'LOGIN WITH EMAIL'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          margin: '20px 0',
          color: 'var(--neon-cyan)',
          fontSize: '0.9rem'
        }}>
          — OR —
        </div>

        <button
          onClick={handleGoogleLogin}
          className="neon-button"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'LOGGING IN...' : 'LOGIN WITH GOOGLE'}
        </button>

        <p style={{
          marginTop: '30px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.85rem'
        }}>
          Phase 1 MVP - Firebase Authentication Required
        </p>
      </div>
    </div>
  );
}
