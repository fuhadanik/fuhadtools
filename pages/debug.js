// Debug page to check if environment variables are loaded
export default function Debug() {
  const envVars = {
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'NOT SET',
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
    sessionSecret: process.env.SESSION_SECRET ? 'SET (hidden)' : 'NOT SET',
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', color: '#00ffff', background: '#000' }}>
      <h1>Environment Variables Debug</h1>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
      <p style={{ marginTop: '20px', color: '#ff00ff' }}>
        If you see "NOT SET", environment variables are not loaded properly in Vercel.
      </p>
    </div>
  );
}
