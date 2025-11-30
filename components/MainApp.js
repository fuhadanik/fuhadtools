import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import LayoutAnalyzer from './LayoutAnalyzer';
import DataParser from './DataParser';

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

  // Export options
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportOrientation, setExportOrientation] = useState('vertical');

  // Extracted metadata storage
  const [extractedMetadata, setExtractedMetadata] = useState(null);
  const [extractedFields, setExtractedFields] = useState(null);

  // View state
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showParser, setShowParser] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

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

  // Export with metadata
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

      // First, get the metadata with fields
      const metadataResponse = await fetch(
        `/api/sf/export-metadata?object=${selectedObject}&layoutId=${selectedLayout}&layoutType=${selectedLayoutType}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!metadataResponse.ok) {
        const data = await metadataResponse.json();
        throw new Error(data.message || 'Failed to fetch metadata');
      }

      const metadataResult = await metadataResponse.json();

      // Store the metadata and fields for analyzer/parser
      setExtractedMetadata(metadataResult.layoutMetadata);
      setExtractedFields(metadataResult.fields);

      // Now download the file in the selected format
      const downloadUrl = `/api/sf/export?object=${selectedObject}&layoutId=${selectedLayout}&layoutType=${selectedLayoutType}&format=${exportFormat}&orientation=${exportOrientation}`;

      const downloadResponse = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!downloadResponse.ok) {
        const data = await downloadResponse.json();
        throw new Error(data.message || 'Export failed');
      }

      // Download the file
      const blob = await downloadResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const ext = exportFormat === 'json' ? 'json' : exportFormat === 'xml' ? 'xml' : 'csv';
      a.download = `${selectedObject}_${selectedLayoutType}_layout.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`File exported successfully in ${exportFormat.toUpperCase()} format!`);
      setShowResultsModal(true);
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
                <h2>Export Layout Data</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Export layout fields with metadata
                </p>

                <div className="form-group">
                  <label>Export Format</label>
                  <select
                    className="neon-select"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="csv">CSV (Excel Compatible)</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                  </select>
                </div>

                {exportFormat === 'csv' && (
                  <div className="form-group">
                    <label>CSV Orientation</label>
                    <select
                      className="neon-select"
                      value={exportOrientation}
                      onChange={(e) => setExportOrientation(e.target.value)}
                    >
                      <option value="vertical">Vertical (Standard)</option>
                      <option value="horizontal">Horizontal (Transposed)</option>
                    </select>
                  </div>
                )}

                <button
                  className="neon-button"
                  onClick={handleExport}
                  disabled={loading}
                >
                  {loading ? 'EXPORTING...' : `EXPORT ${exportFormat.toUpperCase()}`}
                </button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <div className="loading-spinner"></div>
              </div>
            )}

            {/* Results Modal */}
            {showResultsModal && (
              <div className="modal-overlay" onClick={() => setShowResultsModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>Export Complete</h2>
                    <button className="close-btn" onClick={() => setShowResultsModal(false)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <p style={{ color: 'var(--neon-green)', marginBottom: '20px', textAlign: 'center' }}>
                      ✓ Metadata extracted and file downloaded successfully!
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button
                        className="neon-button"
                        onClick={() => {
                          setShowResultsModal(false);
                          setShowAnalyzer(true);
                        }}
                      >
                        Analyze Layout
                      </button>
                      <button
                        className="neon-button"
                        onClick={() => {
                          setShowResultsModal(false);
                          setShowParser(true);
                        }}
                      >
                        View Data Table
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Analyzer */}
            {showAnalyzer && extractedMetadata && extractedFields && (
              <div className="modal-overlay" onClick={() => setShowAnalyzer(false)}>
                <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
                  <LayoutAnalyzer
                    layoutData={extractedMetadata}
                    fieldData={extractedFields}
                    onClose={() => setShowAnalyzer(false)}
                  />
                </div>
              </div>
            )}

            {/* Data Parser */}
            {showParser && extractedFields && (
              <div className="modal-overlay" onClick={() => setShowParser(false)}>
                <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
                  <DataParser
                    fieldData={extractedFields}
                    onClose={() => setShowParser(false)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }

        .modal-content {
          background: var(--card-bg);
          border: 2px solid var(--neon-cyan);
          box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
          padding: 30px;
          max-width: 500px;
          width: 90%;
          animation: slideIn 0.3s ease-out;
        }

        .modal-content-large {
          background: var(--card-bg);
          border: 2px solid var(--neon-green);
          box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
          padding: 0;
          max-width: 90%;
          width: 1200px;
          max-height: 90vh;
          overflow: hidden;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .modal-header h2 {
          color: var(--neon-cyan);
          margin: 0;
          font-family: 'Orbitron', sans-serif;
        }

        .close-btn {
          background: transparent;
          border: 1px solid #666;
          color: #666;
          font-size: 24px;
          width: 35px;
          height: 35px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          border-color: var(--neon-pink);
          color: var(--neon-pink);
          box-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
        }

        .modal-body {
          padding: 10px 0;
        }
      `}</style>
    </div>
  );
}
