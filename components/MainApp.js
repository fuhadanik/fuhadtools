import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function MainApp({ firebaseUser }) {
  // Session state
  const [instanceUrl, setInstanceUrl] = useState('');
  const [sid, setSid] = useState('');
  const [sessionActive, setSessionActive] = useState(false);

  // Data state
  const [objects, setObjects] = useState([]);
  const [filteredObjects, setFilteredObjects] = useState([]);
  const [objectSearch, setObjectSearch] = useState('');
  const [selectedObject, setSelectedObject] = useState('');
  const [layouts, setLayouts] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState('');
  const [selectedLayoutType, setSelectedLayoutType] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get Firebase token for API calls
  const getAuthToken = async () => {
    if (firebaseUser) {
      return await firebaseUser.getIdToken();
    }
    return null;
  };

  // Start Salesforce session
  const handleStartSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await getAuthToken();

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ instanceUrl, sid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setSessionActive(true);
      setSuccess('Salesforce session created successfully!');
      loadObjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load objects
  const loadObjects = async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAuthToken();

      const response = await fetch('/api/sf/objects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load objects');
      }

      setObjects(data);
      setFilteredObjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter objects based on search
  useEffect(() => {
    if (!objectSearch) {
      setFilteredObjects(objects);
    } else {
      const search = objectSearch.toLowerCase();
      const filtered = objects.filter(obj =>
        obj.name.toLowerCase().includes(search) ||
        obj.label.toLowerCase().includes(search)
      );
      setFilteredObjects(filtered);
    }
  }, [objectSearch, objects]);

  // Load layouts when object is selected
  const handleObjectSelect = async (objectName) => {
    setSelectedObject(objectName);
    setLayouts([]);
    setSelectedLayout('');
    setSelectedLayoutType('');
    setLoading(true);
    setError('');

    try {
      const token = await getAuthToken();

      const response = await fetch(`/api/sf/layouts?object=${objectName}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load layouts');
      }

      setLayouts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    if (!selectedObject || !selectedLayout || !selectedLayoutType) {
      setError('Please select an object and layout first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await getAuthToken();

      const response = await fetch(
        `/api/sf/export?object=${selectedObject}&layoutId=${selectedLayout}&layoutType=${selectedLayoutType}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Export failed');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedObject}_${selectedLayoutType}_layout.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('CSV exported successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px'
        }}>
          <h1 className="glitch" data-text="SF LAYOUT CSV">SF LAYOUT CSV</h1>
          <button onClick={handleLogout} className="neon-button">
            LOGOUT
          </button>
        </div>

        {/* Session Setup */}
        {!sessionActive && (
          <div className="neon-card mb-3">
            <h2>Connect to Salesforce</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Enter your Salesforce Instance URL and Session ID (SID)
            </p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={handleStartSession}>
              <div className="form-group">
                <label>Instance URL</label>
                <input
                  type="url"
                  className="neon-input"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder="https://yourorg.my.salesforce.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Session ID (SID)</label>
                <input
                  type="text"
                  className="neon-input"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  placeholder="00D..."
                  required
                />
              </div>

              <button
                type="submit"
                className="neon-button"
                disabled={loading}
              >
                {loading ? 'CONNECTING...' : 'START SESSION'}
              </button>
            </form>
          </div>
        )}

        {/* Data Explorer */}
        {sessionActive && (
          <>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="neon-card mb-3">
              <h2>Select Object</h2>
              <div className="form-group">
                <label>Search Objects</label>
                <input
                  type="text"
                  className="neon-input"
                  value={objectSearch}
                  onChange={(e) => setObjectSearch(e.target.value)}
                  placeholder="Search by name or label (e.g., Account, Contact)"
                  style={{ marginBottom: '10px' }}
                />
              </div>
              <div className="form-group">
                <select
                  className="neon-select"
                  value={selectedObject}
                  onChange={(e) => handleObjectSelect(e.target.value)}
                >
                  <option value="">-- Select Object ({filteredObjects.length} found) --</option>
                  {filteredObjects.map((obj) => (
                    <option key={obj.name} value={obj.name}>
                      {obj.label} ({obj.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedObject && layouts.length > 0 && (
              <div className="neon-card mb-3">
                <h2>Select Layout</h2>
                <div className="form-group">
                  <select
                    className="neon-select"
                    value={selectedLayout}
                    onChange={(e) => {
                      const layoutId = e.target.value;
                      const layout = layouts.find(l => l.id === layoutId);
                      setSelectedLayout(layoutId);
                      setSelectedLayoutType(layout?.type || '');
                    }}
                  >
                    <option value="">-- Select Layout --</option>
                    {layouts.map((layout) => (
                      <option key={layout.id} value={layout.id}>
                        {layout.label} ({layout.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedObject && selectedLayout && (
              <div className="neon-card">
                <h2>Export CSV</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Export layout fields with metadata to CSV
                </p>
                <button
                  className="neon-button"
                  onClick={handleExport}
                  disabled={loading}
                >
                  {loading ? 'EXPORTING...' : 'EXPORT CSV'}
                </button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <div className="loading-spinner"></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
