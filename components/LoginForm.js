import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  /**
   * Check if user is approved in Firestore
   * Creates user document if it doesn't exist
   */
  const checkApproval = async (user) => {
    try {
      const userRef = doc(db, 'users', user.email);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.approved === true) {
          // User is approved, proceed to app
          onLoginSuccess();
        } else {
          // User exists but not approved
          setStatusMessage('⚠️ Your account is awaiting approval. Please contact the administrator.');
          setLoading(false);
        }
      } else {
        // User document doesn't exist, create it with approved: false
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || '',
          createdAt: new Date().toISOString(),
          approved: false,
        });

        setStatusMessage('✓ Account registered. Awaiting administrator approval.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error checking approval:', err);
      setError('Failed to verify account approval status');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Check approval status before allowing access
      await checkApproval(userCredential.user);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      // Check approval status before allowing access
      await checkApproval(userCredential.user);
    } catch (err) {
      setError(err.message);
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

        {statusMessage && (
          <div style={{
            padding: '15px',
            marginBottom: '20px',
            border: '2px solid var(--neon-cyan)',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            color: 'var(--neon-cyan)',
            textAlign: 'center',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            {statusMessage}
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
