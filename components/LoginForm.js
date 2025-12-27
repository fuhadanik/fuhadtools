import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
          marginTop: '40px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '24px'
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.8rem',
            marginBottom: '8px'
          }}>
            Created by
          </p>
          <p style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '1.1rem',
            fontWeight: '700',
            marginBottom: '12px'
          }}>
            Fuhad Hossain
          </p>
          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.7rem'
          }}>
            &copy; {new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
