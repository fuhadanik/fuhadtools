import { useState } from 'react';

export default function LayoutAnalyzer({ layoutData, fieldData, onClose }) {
  const [selectedLayout, setSelectedLayout] = useState(null);

  // Debug logging
  console.log('LayoutAnalyzer - layoutData:', layoutData);
  console.log('LayoutAnalyzer - fieldData:', fieldData);

  if (!layoutData || !fieldData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666', fontSize: '16px' }}>
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
  console.log('Is FlexiPage:', isFlexiPage);
  console.log('Layout sections:', layoutData.layoutSections);

  // Styles
  const styles = {
    container: {
      background: 'var(--card-bg)',
      border: '1px solid var(--neon-green)',
      padding: '20px',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '1px solid #333',
    },
    title: {
      color: 'var(--neon-green)',
      margin: 0,
      fontFamily: "'Orbitron', sans-serif",
      fontSize: '20px',
    },
    closeBtn: {
      background: 'transparent',
      border: '1px solid #666',
      color: '#666',
      fontSize: '24px',
      width: '35px',
      height: '35px',
      cursor: 'pointer',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '25px',
    },
    section: {
      border: '1px solid #333',
      padding: '20px',
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '4px',
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '12px',
      borderBottom: '2px solid var(--neon-green)',
    },
    sectionTitle: {
      color: 'var(--neon-blue)',
      margin: 0,
      fontSize: '18px',
      fontWeight: 600,
    },
    sectionMode: {
      fontSize: '12px',
      color: 'var(--neon-cyan)',
      padding: '4px 10px',
      border: '1px solid var(--neon-cyan)',
      borderRadius: '4px',
      background: 'rgba(0, 243, 255, 0.05)',
    },
    twoColumnGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      width: '100%',
    },
    oneColumnGrid: {
      display: 'block',
      width: '100%',
    },
    layoutColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
    },
    fieldBox: {
      background: 'rgba(0, 255, 0, 0.05)',
      border: '2px solid #444',
      padding: '14px',
      borderRadius: '6px',
      transition: 'all 0.2s',
      minHeight: '75px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)',
      marginBottom: '2px',
    },
    fieldLabel: {
      fontSize: '14px',
      color: 'var(--neon-cyan)',
      fontWeight: 600,
      marginBottom: '5px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    },
    required: {
      color: 'var(--neon-pink)',
      fontSize: '16px',
      fontWeight: 'bold',
    },
    fieldApi: {
      fontSize: '12px',
      color: 'var(--neon-green)',
      fontFamily: "'Courier New', monospace",
      marginBottom: '4px',
    },
    fieldType: {
      fontSize: '10px',
      color: '#888',
      textAlign: 'right',
      fontStyle: 'italic',
    },
  };

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
        <div key={idx} style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>{sectionName}</h3>
            <span style={styles.sectionMode}>{layoutMode}</span>
          </div>

          <div style={isTwoColumn || columnCount === 2 ? styles.twoColumnGrid : styles.oneColumnGrid}>
            {section.layoutColumns && section.layoutColumns.map((column, colIdx) => (
              <div key={colIdx} style={styles.layoutColumn}>
                {column.layoutItems && column.layoutItems.map((item, itemIdx) => {
                  if (item.field) {
                    const fieldName = item.field;
                    const meta = fieldMap.get(fieldName) || {};
                    const isRequired = meta.required || item.required;

                    return (
                      <div key={itemIdx} style={styles.fieldBox}>
                        <div style={styles.fieldLabel}>
                          {meta.label || fieldName}
                          {isRequired && <span style={styles.required}>*</span>}
                        </div>
                        <div style={styles.fieldApi}>{fieldName}</div>
                        <div style={styles.fieldType}>{meta.type || 'Unknown'}</div>
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
      <div key={idx} style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{sectionName}</h3>
          <span style={styles.sectionMode}>FlexiPage</span>
        </div>
        <div style={styles.oneColumnGrid}>
          <div style={styles.layoutColumn}>
            {fields.map((field, fieldIdx) => (
              <div key={fieldIdx} style={styles.fieldBox}>
                <div style={styles.fieldLabel}>
                  {field.label || field.apiName}
                  {field.required && <span style={styles.required}>*</span>}
                </div>
                <div style={styles.fieldApi}>{field.apiName}</div>
                <div style={styles.fieldType}>{field.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Layout Analyzer</h2>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.content}>
        {isFlexiPage ? renderFlexiPage() : renderStandardLayout()}
      </div>
    </div>
  );
}
