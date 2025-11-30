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
      picklistValues: field.picklistValues,
      length: field.length,
      required: field.required
    });
  });

  const isFlexiPage = layoutData.type === 'FlexiPage';

  const renderStandardLayout = () => {
    const sections = layoutData.layoutSections || [];

    return sections.map((section, idx) => {
      const sectionName = section.label || section.heading || 'Unnamed Section';
      const style = section.style;

      // Skip custom links sections
      if (style === 'CustomLinks') return null;

      // Determine if 2-column layout
      const isTwoColumn = style === 'TwoColumnsTopToBottom' || style === 'TwoColumnsLeftToRight';
      const columnCount = section.layoutColumns ? section.layoutColumns.length : 1;
      const layoutMode = isTwoColumn || columnCount === 2 ? '2 Column(s)' : '1 Column(s)';

      return (
        <div key={idx} className="analyzer-section">
          <div className="section-header">
            <h3>{sectionName}</h3>
            <span className="section-mode">{layoutMode}</span>
          </div>

          <div className={isTwoColumn || columnCount === 2 ? 'two-column-grid' : 'one-column-grid'}>
            {section.layoutColumns && section.layoutColumns.map((column, colIdx) => (
              <div key={colIdx} className="layout-column">
                {column.layoutItems && column.layoutItems.map((item, itemIdx) => {
                  if (item.field) {
                    const fieldName = item.field;
                    const meta = fieldMap.get(fieldName) || {};
                    const isRequired = meta.required || item.required;

                    return (
                      <div key={itemIdx} className="field-box">
                        <div className="field-label">
                          {meta.label || fieldName}
                          {isRequired && <span className="required-indicator">*</span>}
                        </div>
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
    // Group fields by section
    const sectionMap = new Map();
    fieldData.forEach(field => {
      const section = field.section || 'Main Section';
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section).push(field);
    });

    return Array.from(sectionMap.entries()).map(([sectionName, fields], idx) => (
      <div key={idx} className="analyzer-section">
        <div className="section-header">
          <h3>{sectionName}</h3>
          <span className="section-mode">FlexiPage</span>
        </div>
        <div className="one-column-grid">
          <div className="layout-column">
            {fields.map((field, fieldIdx) => (
              <div key={fieldIdx} className="field-box">
                <div className="field-label">
                  {field.label || field.apiName}
                  {field.required && <span className="required-indicator">*</span>}
                </div>
                <div className="field-api">{field.apiName}</div>
                <div className="field-type">{field.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <h2>Layout Analyzer</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="analyzer-content">
        {isFlexiPage ? renderFlexiPage() : renderStandardLayout()}
      </div>

      <style jsx>{`
        .analyzer-container {
          background: var(--card-bg);
          border: 1px solid var(--neon-green);
          padding: 20px;
          max-height: 90vh;
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
          font-size: 20px;
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
          padding: 0;
        }

        .close-btn:hover {
          border-color: var(--neon-pink);
          color: var(--neon-pink);
          box-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
        }

        .analyzer-content {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .analyzer-section {
          border: 1px solid #333;
          padding: 20px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--neon-green);
        }

        .section-header h3 {
          color: var(--neon-blue);
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .section-mode {
          font-size: 12px;
          color: var(--neon-cyan);
          padding: 4px 10px;
          border: 1px solid var(--neon-cyan);
          border-radius: 4px;
          background: rgba(0, 243, 255, 0.05);
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .one-column-grid {
          display: block;
        }

        .layout-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field-box {
          background: rgba(0, 255, 0, 0.03);
          border: 2px solid #333;
          padding: 12px;
          border-radius: 6px;
          transition: all 0.2s;
          min-height: 70px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .field-box:hover {
          border-color: var(--neon-green);
          background: rgba(0, 255, 0, 0.08);
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
          transform: translateY(-2px);
        }

        .field-label {
          font-size: 14px;
          color: var(--neon-cyan);
          font-weight: 600;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .required-indicator {
          color: var(--neon-pink);
          font-size: 16px;
          font-weight: bold;
        }

        .field-api {
          font-size: 12px;
          color: var(--neon-green);
          font-family: 'Courier New', monospace;
          margin-bottom: 4px;
        }

        .field-type {
          font-size: 10px;
          color: #888;
          text-align: right;
          font-style: italic;
        }

        .analyzer-empty {
          text-align: center;
          padding: 60px 20px;
          color: #666;
          font-size: 16px;
        }

        /* Scrollbar styling */
        .analyzer-container::-webkit-scrollbar {
          width: 8px;
        }

        .analyzer-container::-webkit-scrollbar-track {
          background: #000;
        }

        .analyzer-container::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }

        .analyzer-container::-webkit-scrollbar-thumb:hover {
          background: var(--neon-green);
        }
      `}</style>
    </div>
  );
}

