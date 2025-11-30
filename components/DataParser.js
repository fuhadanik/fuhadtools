import { useState } from 'react';

export default function DataParser({ fieldData, onClose }) {
  const [viewMode, setViewMode] = useState('vertical'); // 'vertical' or 'horizontal'

  if (!fieldData || fieldData.length === 0) {
    return (
      <div className="parser-empty">
        <p>No field data available. Extract a layout first.</p>
      </div>
    );
  }

  const renderVerticalTable = () => {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Section</th>
            <th>Layout Mode</th>
            <th>Field Label (XML)</th>
            <th>Field API Name</th>
            <th>Label (Data)</th>
            <th>Type</th>
            <th>Length</th>
            <th>Required</th>
            <th>Read Only</th>
          </tr>
        </thead>
        <tbody>
          {fieldData.map((field, idx) => (
            <tr key={idx}>
              <td>{field.section || '-'}</td>
              <td>{field.layoutMode || 'FlexiPage'}</td>
              <td>{field.fieldLabelXml || field.apiName}</td>
              <td className="api-name">{field.apiName}</td>
              <td>{field.label || '-'}</td>
              <td>{field.type}</td>
              <td>{field.length || '-'}</td>
              <td>{field.required ? 'Yes' : 'No'}</td>
              <td>{field.readOnly ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderHorizontalTable = () => {
    const attributes = [
      { key: 'section', label: 'Section' },
      { key: 'layoutMode', label: 'Layout Mode' },
      { key: 'fieldLabelXml', label: 'Field Label (XML)' },
      { key: 'apiName', label: 'Field API Name' },
      { key: 'label', label: 'Label (Data)' },
      { key: 'type', label: 'Type' },
      { key: 'length', label: 'Length' },
      { key: 'required', label: 'Required' },
      { key: 'readOnly', label: 'Read Only' },
    ];

    return (
      <table className="data-table horizontal">
        <thead>
          <tr>
            <th>Attribute</th>
            {fieldData.map((_, idx) => (
              <th key={idx}>Field {idx + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr, idx) => (
            <tr key={idx}>
              <td className="attribute-name">{attr.label}</td>
              {fieldData.map((field, fieldIdx) => {
                let value = field[attr.key];
                if (typeof value === 'boolean') {
                  value = value ? 'Yes' : 'No';
                }
                return (
                  <td key={fieldIdx}>{value || '-'}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="parser-container">
      <div className="parser-header">
        <h2>Data Parser</h2>
        <div className="parser-controls">
          <button
            className={`view-toggle ${viewMode === 'vertical' ? 'active' : ''}`}
            onClick={() => setViewMode('vertical')}
          >
            Vertical
          </button>
          <button
            className={`view-toggle ${viewMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => setViewMode('horizontal')}
          >
            Horizontal
          </button>
          <button className="neon-button-small" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="parser-stats">
        <span>Total Fields: {fieldData.length}</span>
      </div>

      <div className="parser-content">
        {viewMode === 'vertical' ? renderVerticalTable() : renderHorizontalTable()}
      </div>

      <style jsx>{`
        .parser-container {
          background: var(--card-bg);
          border: 1px solid var(--neon-cyan);
          padding: 20px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .parser-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .parser-header h2 {
          color: var(--neon-cyan);
          margin: 0;
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
        }

        .parser-controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .view-toggle {
          padding: 8px 16px;
          font-size: 12px;
          background: transparent;
          border: 1px solid #555;
          color: #888;
          cursor: pointer;
          transition: all 0.3s;
          font-family: 'Orbitron', sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .view-toggle.active {
          border-color: var(--neon-cyan);
          color: var(--neon-cyan);
          background: rgba(0, 243, 255, 0.1);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }

        .view-toggle:hover {
          border-color: var(--neon-cyan);
          background: rgba(0, 243, 255, 0.05);
        }

        .neon-button-small {
          background: transparent;
          border: 1px solid #666;
          color: #666;
          font-size: 20px;
          width: 35px;
          height: 35px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .neon-button-small:hover {
          border-color: var(--neon-pink);
          color: var(--neon-pink);
          box-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
        }

        .parser-stats {
          margin-bottom: 20px;
          padding: 12px 15px;
          background: rgba(0, 255, 0, 0.05);
          border-left: 3px solid var(--neon-green);
          color: var(--neon-green);
          font-size: 14px;
          font-weight: 600;
          border-radius: 0 4px 4px 0;
        }

        .parser-content {
          overflow-x: auto;
          overflow-y: auto;
          max-height: calc(90vh - 180px);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table th,
        .data-table td {
          border: 1px solid #333;
          padding: 12px;
          text-align: left;
          white-space: nowrap;
        }

        .data-table th {
          background: rgba(0, 243, 255, 0.15);
          color: var(--neon-cyan);
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 10;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }

        .data-table td {
          color: #ccc;
        }

        .data-table tbody tr:hover {
          background: rgba(0, 255, 0, 0.08);
          cursor: pointer;
        }

        .api-name {
          color: var(--neon-green);
          font-family: 'Courier New', monospace;
          font-weight: 600;
        }

        .attribute-name {
          color: var(--neon-cyan);
          font-weight: 700;
          position: sticky;
          left: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 5;
        }

        .data-table.horizontal {
          display: table;
        }

        .parser-empty {
          text-align: center;
          padding: 60px 20px;
          color: #666;
          font-size: 16px;
        }

        /* Scrollbar styling */
        .parser-container::-webkit-scrollbar,
        .parser-content::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .parser-container::-webkit-scrollbar-track,
        .parser-content::-webkit-scrollbar-track {
          background: #000;
        }

        .parser-container::-webkit-scrollbar-thumb,
        .parser-content::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }

        .parser-container::-webkit-scrollbar-thumb:hover,
        .parser-content::-webkit-scrollbar-thumb:hover {
          background: var(--neon-cyan);
        }
      `}</style>
    </div>
  );
}
