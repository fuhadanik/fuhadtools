import { useState } from 'react';

export default function LayoutAnalyzer({ layoutData, fieldData, onClose }) {
  const [selectedLayout, setSelectedLayout] = useState(null);

  if (!layoutData || !fieldData) {
    return (
      <div className="analyzer-empty">
        <p>No layout data available. Extract a layout first.</p>
      </div>
    );
  }

  // Create field map for quick lookup
  const fieldMap = new Map();
  fieldData.forEach(field => {
    fieldMap.set(field.apiName, {
      label: field.label,
      type: field.type,
      picklistValues: field.picklistValues
    });
  });

  const isFlexiPage = layoutData.type === 'FlexiPage';

  const renderStandardLayout = () => {
    const sections = layoutData.layoutSections || [];

    return sections.map((section, idx) => {
      const sectionName = section.label || section.heading || 'Unnamed Section';
      const columnCount = section.layoutColumns ? section.layoutColumns.length : 1;
      const layoutMode = columnCount === 2 ? '2 Column(s)' : '1 Column(s)';

      return (
        <div key={idx} className="analyzer-section">
          <div className="section-header">
            <h3>{sectionName}</h3>
            <span className="section-mode">{layoutMode}</span>
          </div>

          <div className={columnCount === 2 ? 'two-column-grid' : 'one-column-grid'}>
            {section.layoutColumns && section.layoutColumns.map((column, colIdx) => (
              <div key={colIdx} className="layout-column">
                {column.layoutItems && column.layoutItems.map((item, itemIdx) => {
                  if (item.field) {
                    const fieldName = item.field;
                    const meta = fieldMap.get(fieldName) || {};

                    return (
                      <div key={itemIdx} className="field-item">
                        <div className="field-label">{meta.label || fieldName}</div>
                        <div className="field-api">{fieldName}</div>
                        <div className="field-type">{meta.type || 'Unknown'}</div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  const renderFlexiPage = () => {
    // Simplified FlexiPage rendering - focuses on showing fields in sections
    return (
      <div className="analyzer-section">
        <div className="section-header">
          <h3>FlexiPage Layout</h3>
          <span className="section-mode">Dynamic Layout</span>
        </div>
        <div className="one-column-grid">
          <div className="layout-column">
            {fieldData.map((field, idx) => (
              <div key={idx} className="field-item">
                <div className="field-label">{field.label || field.apiName}</div>
                <div className="field-api">{field.apiName}</div>
                <div className="field-type">{field.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h2>Layout Analyzer</h2>
        <button className="neon-button-small" onClick={onClose}>Close</button>
      </div>

      <div className="analyzer-content">
        {isFlexiPage ? renderFlexiPage() : renderStandardLayout()}
      </div>

      <style jsx>{`
        .analyzer-container {
          background: var(--card-bg);
          border: 1px solid var(--neon-green);
          padding: 20px;
          max-height: 600px;
          overflow-y: auto;
        }

        .analyzer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .analyzer-header h2 {
          color: var(--neon-green);
          margin: 0;
          font-family: 'Orbitron', sans-serif;
        }

        .neon-button-small {
          padding: 8px 16px;
          font-size: 12px;
          background: transparent;
          border: 1px solid var(--neon-cyan);
          color: var(--neon-cyan);
          cursor: pointer;
          transition: all 0.3s;
        }

        .neon-button-small:hover {
          background: rgba(0, 255, 255, 0.1);
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        }

        .analyzer-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .analyzer-section {
          border: 1px solid #333;
          padding: 15px;
          background: rgba(0, 0, 0, 0.3);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid var(--neon-green);
        }

        .section-header h3 {
          color: var(--neon-blue);
          margin: 0;
          font-size: 18px;
        }

        .section-mode {
          font-size: 12px;
          color: #888;
          padding: 4px 8px;
          border: 1px solid #555;
          border-radius: 4px;
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .one-column-grid {
          display: block;
        }

        .layout-column {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .field-item {
          background: rgba(0, 255, 0, 0.05);
          border: 1px solid #333;
          padding: 10px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .field-item:hover {
          border-color: var(--neon-green);
          background: rgba(0, 255, 0, 0.1);
        }

        .field-label {
          font-size: 14px;
          color: var(--neon-cyan);
          font-weight: 500;
          margin-bottom: 4px;
        }

        .field-api {
          font-size: 12px;
          color: var(--neon-green);
          font-family: monospace;
          margin-bottom: 4px;
        }

        .field-type {
          font-size: 10px;
          color: #888;
          text-align: right;
        }

        .analyzer-empty {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  );
}
