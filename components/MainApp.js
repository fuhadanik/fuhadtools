import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function MainApp() {
  // Navigation state
  const [activePage, setActivePage] = useState('extractor');

  // Theme state
  const [darkMode, setDarkMode] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('sf-tools-theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sf-tools-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sf-tools-theme', 'light');
    }
  };

  // Session state
  const [instanceUrl, setInstanceUrl] = useState('');
  const [sid, setSid] = useState('');
  const [sessionActive, setSessionActive] = useState(false);

  // Data state
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [objectSearch, setObjectSearch] = useState('');
  const [recordTypes, setRecordTypes] = useState([]);
  const [selectedRecordType, setSelectedRecordType] = useState(null);
  const [pageLayouts, setPageLayouts] = useState([]);
  const [flexiPages, setFlexiPages] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [previewOrientation, setPreviewOrientation] = useState('horizontal');

  // Comparison state
  const [compareObject, setCompareObject] = useState('');
  const [compareObjectSearch, setCompareObjectSearch] = useState('');
  const [compareLayouts, setCompareLayouts] = useState({ pageLayouts: [], flexiPages: [] });
  const [compareLayout1, setCompareLayout1] = useState(null);
  const [compareLayout2, setCompareLayout2] = useState(null);
  const [compareData1, setCompareData1] = useState(null);
  const [compareData2, setCompareData2] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Mockup state
  const [mockupObject, setMockupObject] = useState('');
  const [mockupObjectSearch, setMockupObjectSearch] = useState('');
  const [mockupLayouts, setMockupLayouts] = useState({ pageLayouts: [], flexiPages: [] });
  const [mockupRecordTypes, setMockupRecordTypes] = useState([]);
  const [mockupSelectedRecordType, setMockupSelectedRecordType] = useState(null);
  const [mockupSelectedLayout, setMockupSelectedLayout] = useState(null);
  const [mockupData, setMockupData] = useState(null);
  const [mockupLoading, setMockupLoading] = useState(false);
  const [mockupCopySuccess, setMockupCopySuccess] = useState(false);

  // User Compare state
  const [userSearch1, setUserSearch1] = useState('');
  const [userSearch2, setUserSearch2] = useState('');
  const [userResults1, setUserResults1] = useState([]);
  const [userResults2, setUserResults2] = useState([]);
  const [selectedUser1, setSelectedUser1] = useState(null);
  const [selectedUser2, setSelectedUser2] = useState(null);
  const [userCompareData, setUserCompareData] = useState(null);
  const [userCompareLoading, setUserCompareLoading] = useState(false);

  // Flow Exporter state
  const [flowSearch, setFlowSearch] = useState('');
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [flowMetadata, setFlowMetadata] = useState(null);
  const [flowLoading, setFlowLoading] = useState(false);

  // Profile Compare state
  const [profileSearch1, setProfileSearch1] = useState('');
  const [profileSearch2, setProfileSearch2] = useState('');
  const [profileResults1, setProfileResults1] = useState([]);
  const [profileResults2, setProfileResults2] = useState([]);
  const [selectedProfile1, setSelectedProfile1] = useState(null);
  const [selectedProfile2, setSelectedProfile2] = useState(null);
  const [profileCompareData, setProfileCompareData] = useState(null);
  const [profileCompareLoading, setProfileCompareLoading] = useState(false);

  // Permission Set Analyzer state
  const [psSearch, setPsSearch] = useState('');
  const [permissionSets, setPermissionSets] = useState([]);
  const [selectedPermissionSet, setSelectedPermissionSet] = useState(null);
  const [psAnalysisData, setPsAnalysisData] = useState(null);
  const [psAnalysisLoading, setPsAnalysisLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Splash screen state - show on initial load, stays until user clicks
  const [showSplash, setShowSplash] = useState(true);
  const [splashMessage, setSplashMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Filter objects based on search
  const filteredObjects = useMemo(() => {
    if (!objectSearch.trim()) return objects;
    const search = objectSearch.toLowerCase();
    return objects.filter(obj =>
      obj.label.toLowerCase().includes(search) ||
      obj.name.toLowerCase().includes(search)
    );
  }, [objects, objectSearch]);

  const filteredMockupObjects = useMemo(() => {
    if (!mockupObjectSearch.trim()) return objects;
    const search = mockupObjectSearch.toLowerCase();
    return objects.filter(obj =>
      obj.label.toLowerCase().includes(search) ||
      obj.name.toLowerCase().includes(search)
    );
  }, [objects, mockupObjectSearch]);

  const filteredCompareObjects = useMemo(() => {
    if (!compareObjectSearch.trim()) return objects;
    const search = compareObjectSearch.toLowerCase();
    return objects.filter(obj =>
      obj.label.toLowerCase().includes(search) ||
      obj.name.toLowerCase().includes(search)
    );
  }, [objects, compareObjectSearch]);

  // Start Salesforce session
  const handleStartSession = async (e) => {
    e.preventDefault();
    setSplashMessage('Connecting to Salesforce...');
    setIsConnecting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceUrl, sid }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');

      setSplashMessage('Loading your data...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSessionActive(true);
      setSuccess('Connected to Salesforce!');
      loadObjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
      setSplashMessage('');
    }
  };

  // Load objects
  const loadObjects = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sf/objects');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load objects');
      setObjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load layouts when object is selected
  const handleObjectSelect = async (objectName) => {
    setSelectedObject(objectName);
    setObjectSearch('');
    setRecordTypes([]);
    setSelectedRecordType(null);
    setPageLayouts([]);
    setFlexiPages([]);
    setSelectedLayout(null);
    setPreviewData(null);
    setLoading(true);
    setError('');

    try {
      // Fetch both record types and layouts in parallel
      const [rtResponse, layoutResponse] = await Promise.all([
        fetch(`/api/sf/recordTypes?object=${objectName}`),
        fetch(`/api/sf/layouts?object=${objectName}`)
      ]);

      const rtData = await rtResponse.json();
      const layoutData = await layoutResponse.json();

      if (!rtResponse.ok) throw new Error(rtData.message || 'Failed to load record types');
      if (!layoutResponse.ok) throw new Error(layoutData.message || 'Failed to load layouts');

      // Set record types
      setRecordTypes(rtData.recordTypes || []);

      // Auto-select first/default record type if available
      if (rtData.recordTypes && rtData.recordTypes.length > 0) {
        const defaultRT = rtData.recordTypes.find(rt => rt.isDefault) || rtData.recordTypes[0];
        setSelectedRecordType(defaultRT);
      }

      setPageLayouts(layoutData.pageLayouts || []);
      setFlexiPages(layoutData.flexiPages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle record type selection
  const handleRecordTypeSelect = (recordType) => {
    setSelectedRecordType(recordType);
    setSelectedLayout(null);
    setPreviewData(null);
  };

  // Filter layouts based on selected record type
  const filteredPageLayouts = useMemo(() => {
    if (!selectedRecordType || !selectedRecordType.layoutId) {
      return pageLayouts;
    }
    // Show only the layout assigned to this record type
    return pageLayouts.filter(layout => layout.id === selectedRecordType.layoutId);
  }, [pageLayouts, selectedRecordType]);

  // For now, show all FlexiPages (Lightning pages can have record type assignments via App Builder)
  const filteredFlexiPages = useMemo(() => {
    // FlexiPages don't have direct record type assignments in the same way
    // They're assigned via Lightning App Builder, so we show all for now
    return flexiPages;
  }, [flexiPages]);

  // Select a layout
  const handleLayoutSelect = (layout) => {
    setSelectedLayout(layout);
    setPreviewData(null);
    setSuccess('');
  };

  // Preview layout data
  const handlePreview = async () => {
    if (!selectedObject || !selectedLayout) return;

    setPreviewLoading(true);
    setError('');

    try {
      // Build URL - pass record type ID so server can fetch picklist values
      let url = `/api/sf/preview?object=${selectedObject}&layoutId=${selectedLayout.id}&layoutType=${selectedLayout.type}`;

      // Add record type ID if selected (server will fetch picklist values)
      if (selectedRecordType?.id) {
        url += `&recordTypeId=${selectedRecordType.id}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Preview failed');
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    if (!previewData || !previewData.fields) return;

    const fields = previewData.fields;
    const columns = previewData.columns || ['Field Label', 'API Name', 'Type', 'Required'];

    let text = '';
    if (previewOrientation === 'horizontal') {
      text = columns.join('\t') + '\n';
      fields.forEach(field => {
        text += columns.map(col => field[col] || '-').join('\t') + '\n';
      });
    } else {
      columns.forEach(col => {
        text += col + '\t' + fields.map(field => field[col] || '-').join('\t') + '\n';
      });
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Export CSV
  const handleExport = async () => {
    if (!selectedObject || !selectedLayout) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Build URL - pass record type ID so server can fetch picklist values
      let url = `/api/sf/export?object=${selectedObject}&layoutId=${selectedLayout.id}&layoutType=${selectedLayout.type}&orientation=${previewOrientation}`;

      // Add record type ID if selected (server will fetch picklist values)
      if (selectedRecordType?.id) {
        url += `&recordTypeId=${selectedRecordType.id}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${selectedObject}_${selectedLayout.apiName || selectedLayout.id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setSuccess('CSV exported successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!previewData || !previewData.fields) {
      setError('Please preview the layout first');
      return;
    }

    try {
      const fields = previewData.fields;
      const columns = previewData.columns || ['Field Label', 'API Name', 'Type', 'Required'];

      let worksheetData;
      if (previewOrientation === 'horizontal') {
        // Standard format - columns as headers
        worksheetData = [columns];
        fields.forEach(field => {
          worksheetData.push(columns.map(col => field[col] || '-'));
        });
      } else {
        // Transposed format - attributes as rows
        worksheetData = columns.map(col => {
          return [col, ...fields.map(field => field[col] || '-')];
        });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Auto-size columns
      const colWidths = worksheetData[0].map((_, colIndex) => {
        const maxLength = Math.max(
          ...worksheetData.map(row => String(row[colIndex] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 50) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Layout Fields');

      // Count required fields
      const requiredCount = fields.filter(f => f['Required'] === 'Yes').length;
      const layoutRequiredCount = fields.filter(f => f['Layout Required'] === 'Yes').length;
      const fieldRequiredCount = fields.filter(f => f['Field Required'] === 'Yes').length;

      // Add metadata sheet
      const metaData = [
        ['Layout Export Report'],
        [''],
        ['Object', selectedObject],
        ['Layout', selectedLayout?.label || ''],
        ['Layout Type', selectedLayout?.type || ''],
        ['Total Fields', fields.length],
        ['Required Fields', requiredCount],
        ['Layout Required', layoutRequiredCount],
        ['Field Required', fieldRequiredCount],
        ['Exported At', new Date().toLocaleString()],
      ];
      const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
      metaSheet['!cols'] = [{ wch: 15 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, metaSheet, 'Info');

      const fileName = `${selectedObject}_${selectedLayout?.apiName || selectedLayout?.id}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setSuccess('Excel exported successfully!');
    } catch (err) {
      setError('Failed to export Excel: ' + err.message);
    }
  };

  // Compare - Load layouts for comparison
  const handleCompareObjectSelect = async (objectName) => {
    setCompareObject(objectName);
    setCompareObjectSearch('');
    setCompareLayouts({ pageLayouts: [], flexiPages: [] });
    setCompareLayout1(null);
    setCompareLayout2(null);
    setCompareData1(null);
    setCompareData2(null);
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/sf/layouts?object=${objectName}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load layouts');

      setCompareLayouts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Compare - Run comparison
  const handleRunComparison = async () => {
    if (!compareObject || !compareLayout1 || !compareLayout2) return;

    setCompareLoading(true);
    setError('');

    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/sf/preview?object=${compareObject}&layoutId=${compareLayout1.id}&layoutType=${compareLayout1.type}`),
        fetch(`/api/sf/preview?object=${compareObject}&layoutId=${compareLayout2.id}&layoutType=${compareLayout2.type}`)
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Failed to load layout data');

      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
      setCompareData1(data1);
      setCompareData2(data2);
    } catch (err) {
      setError(err.message);
    } finally {
      setCompareLoading(false);
    }
  };

  // Disconnect session
  const handleDisconnect = () => {
    setSessionActive(false);
    setInstanceUrl('');
    setSid('');
    setObjects([]);
    setSelectedObject('');
    setPageLayouts([]);
    setFlexiPages([]);
    setSelectedLayout(null);
    setPreviewData(null);
    setCompareObject('');
    setCompareLayouts({ pageLayouts: [], flexiPages: [] });
    setCompareLayout1(null);
    setCompareLayout2(null);
    setCompareData1(null);
    setCompareData2(null);
    setSuccess('');
    setError('');
  };

  const LayoutItem = ({ layout, isSelected, onClick }) => (
    <div
      onClick={onClick}
      className={`layout-item ${isSelected ? 'selected' : ''}`}
    >
      <div className="layout-item-label">{layout.label}</div>
      <div className="layout-item-api">{layout.apiName}</div>
    </div>
  );

  // Render preview table
  const renderPreviewTable = (data = previewData, orientation = previewOrientation) => {
    if (!data || !data.fields || data.fields.length === 0) {
      return <p className="text-muted">No fields found in this layout</p>;
    }

    const fields = data.fields;
    const columns = data.columns || ['Field Label', 'API Name', 'Type', 'Required'];

    // Helper to render cell with special formatting
    const renderCell = (col, value, field) => {
      // Required column - show combined status
      if (col === 'Required' && value === 'Yes') {
        const isLayoutRequired = field['Layout Required'] === 'Yes';
        const isFieldRequired = field['Field Required'] === 'Yes';

        if (isLayoutRequired && !isFieldRequired) {
          return <span className="badge badge-layout-required">Layout Required</span>;
        } else if (isFieldRequired) {
          return <span className="badge badge-required">Required</span>;
        }
        return <span className="badge badge-required">Required</span>;
      }
      if (col === 'Required' && value === 'No') {
        return <span className="badge badge-optional">Optional</span>;
      }

      // Layout Required column
      if (col === 'Layout Required' && value === 'Yes') {
        return <span className="badge badge-layout-required">Yes</span>;
      }
      if (col === 'Layout Required' && value === 'No') {
        return <span className="text-muted">No</span>;
      }

      // Field Required column
      if (col === 'Field Required' && value === 'Yes') {
        return <span className="badge badge-required">Yes</span>;
      }
      if (col === 'Field Required' && value === 'No') {
        return <span className="text-muted">No</span>;
      }

      // Read Only column
      if (col === 'Read Only' && value === 'Yes') {
        return <span className="badge badge-readonly">Read Only</span>;
      }

      return value || '-';
    };

    if (orientation === 'horizontal') {
      return (
        <div className="table-container">
          <table className="glass-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, rowIndex) => (
                <tr key={rowIndex} className={field['Required'] === 'Yes' ? 'required-row' : ''}>
                  {columns.map((col, colIndex) => (
                    <td key={colIndex}>{renderCell(col, field[col], field)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      return (
        <div className="table-container">
          <table className="glass-table">
            <tbody>
              {columns.map((col, rowIndex) => (
                <tr key={rowIndex}>
                  <th>{col}</th>
                  {fields.map((field, colIndex) => (
                    <td key={colIndex}>{renderCell(col, field[col], field)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  // Render comparison result
  const renderComparisonResult = () => {
    if (!compareData1 || !compareData2) return null;

    const fields1 = compareData1.fields || [];
    const fields2 = compareData2.fields || [];

    const apiNames1 = new Set(fields1.map(f => f['API Name']));
    const apiNames2 = new Set(fields2.map(f => f['API Name']));

    const onlyIn1 = fields1.filter(f => !apiNames2.has(f['API Name']));
    const onlyIn2 = fields2.filter(f => !apiNames1.has(f['API Name']));
    const inBoth = fields1.filter(f => apiNames2.has(f['API Name']));

    return (
      <div className="comparison-results">
        <div className="comparison-summary">
          <div className="summary-card">
            <div className="summary-number">{fields1.length}</div>
            <div className="summary-label">Fields in Layout 1</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{fields2.length}</div>
            <div className="summary-label">Fields in Layout 2</div>
          </div>
          <div className="summary-card highlight-green">
            <div className="summary-number">{inBoth.length}</div>
            <div className="summary-label">Common Fields</div>
          </div>
          <div className="summary-card highlight-red">
            <div className="summary-number">{onlyIn1.length + onlyIn2.length}</div>
            <div className="summary-label">Differences</div>
          </div>
        </div>

        <div className="comparison-grid">
          <div className="glass-card">
            <h3>Only in {compareLayout1.label}</h3>
            {onlyIn1.length > 0 ? (
              <ul className="field-list">
                {onlyIn1.map((f, i) => (
                  <li key={i} className="field-item diff-removed">
                    <span className="field-label">{f['Field Label']}</span>
                    <span className="field-api">{f['API Name']}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No unique fields</p>
            )}
          </div>

          <div className="glass-card">
            <h3>Only in {compareLayout2.label}</h3>
            {onlyIn2.length > 0 ? (
              <ul className="field-list">
                {onlyIn2.map((f, i) => (
                  <li key={i} className="field-item diff-added">
                    <span className="field-label">{f['Field Label']}</span>
                    <span className="field-api">{f['API Name']}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No unique fields</p>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ marginTop: '1rem' }}>
          <h3>Common Fields ({inBoth.length})</h3>
          {inBoth.length > 0 ? (
            <div className="common-fields-grid">
              {inBoth.map((f, i) => (
                <div key={i} className="common-field-item">
                  <span className="field-label">{f['Field Label']}</span>
                  <span className="field-api">{f['API Name']}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No common fields</p>
          )}
        </div>
      </div>
    );
  };

  // ========================================
  // LAYOUT MOCKUP FUNCTIONS
  // ========================================

  // Handle mockup object selection
  const handleMockupObjectSelect = async (objectName) => {
    setMockupObject(objectName);
    setMockupObjectSearch('');
    setMockupSelectedLayout(null);
    setMockupSelectedRecordType(null);
    setMockupData(null);
    setError('');

    try {
      // Fetch layouts and record types in parallel
      const [layoutsRes, rtRes] = await Promise.all([
        fetch(`/api/sf/layouts?object=${objectName}`),
        fetch(`/api/sf/recordTypes?object=${objectName}`),
      ]);

      if (layoutsRes.ok) {
        const data = await layoutsRes.json();
        setMockupLayouts(data);
      }

      if (rtRes.ok) {
        const rtData = await rtRes.json();
        setMockupRecordTypes(rtData.recordTypes || []);
        // Auto-select default record type
        const defaultRT = rtData.recordTypes?.find(rt => rt.isDefault);
        if (defaultRT) {
          setMockupSelectedRecordType(defaultRT);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle mockup record type selection
  const handleMockupRecordTypeSelect = (rt) => {
    setMockupSelectedRecordType(rt);
    setMockupData(null);
  };

  // Handle mockup layout selection
  const handleMockupLayoutSelect = (layout) => {
    setMockupSelectedLayout(layout);
    setMockupData(null);
  };

  // Generate mockup
  const handleGenerateMockup = async () => {
    if (!mockupObject || !mockupSelectedLayout) return;

    setMockupLoading(true);
    setError('');

    try {
      let url = `/api/sf/mockup?object=${mockupObject}&layoutId=${mockupSelectedLayout.id}&layoutType=${mockupSelectedLayout.type}`;
      if (mockupSelectedRecordType?.id) {
        url += `&recordTypeId=${mockupSelectedRecordType.id}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate mockup');
      }

      const data = await response.json();
      setMockupData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setMockupLoading(false);
    }
  };

  // Copy mockup to clipboard (tab-separated for Excel)
  // Layout sections on left, picklists on right side
  const handleCopyMockup = async () => {
    if (!mockupData) return;

    // Build left side (layout sections + related lists)
    const leftRows = [];

    mockupData.sections.forEach(section => {
      // Section header
      leftRows.push([section.heading, '', '', '', '', '', '']);

      // Column headers
      if (section.columns === 1) {
        leftRows.push(['Field Name', 'API Name', 'Type', '', '', '', '']);
      } else {
        leftRows.push(['Field Name', 'API Name', 'Type', '', 'Field Name', 'API Name', 'Type']);
      }

      // Rows
      section.rows.forEach(row => {
        const cells = [];
        row.items.forEach((item, idx) => {
          if (idx === 1) cells.push(''); // Divider
          if (item.isBlank) {
            cells.push('', '', '');
          } else {
            cells.push(item.label, item.fieldName || '', item.type);
          }
        });
        while (cells.length < 7) cells.push('');
        leftRows.push(cells);
      });

      leftRows.push(['', '', '', '', '', '', '']); // Empty row between sections
    });

    // Add related lists
    if (mockupData.relatedLists && mockupData.relatedLists.length > 0) {
      leftRows.push(['Related Lists - NOT ADJUSTABLE', '', '', '', '', '', '']);
      leftRows.push(['', '', '', '', '', '', '']);
      mockupData.relatedLists.forEach(rl => {
        leftRows.push([rl.label, '', '', '', '', '', '']);
        if (rl.columns && rl.columns.length > 0) {
          const colLabels = rl.columns.map(col => col.label);
          while (colLabels.length < 7) colLabels.push('');
          leftRows.push(colLabels);
        }
        leftRows.push(['', '', '', '', '', '', '']);
      });
    }

    // Build right side (picklist values)
    const rightRows = [];
    if (mockupData.picklistFields && mockupData.picklistFields.length > 0) {
      rightRows.push(['', 'Picklist Values']);
      rightRows.push(['', '']);

      mockupData.picklistFields.forEach(picklist => {
        rightRows.push(['', picklist.label]);
        picklist.values.forEach(value => {
          rightRows.push(['', value]);
        });
        rightRows.push(['', '']);
      });
    }

    // Merge left and right - picklists start at column 9 (after 2 empty columns)
    const maxRows = Math.max(leftRows.length, rightRows.length);
    const mergedRows = [];

    for (let i = 0; i < maxRows; i++) {
      const leftPart = leftRows[i] || ['', '', '', '', '', '', ''];
      const rightPart = rightRows[i] || ['', ''];
      // Add separator columns, then picklist columns
      mergedRows.push([...leftPart, '', ...rightPart]);
    }

    // Convert to tab-separated text
    const text = mergedRows.map(row => row.join('\t')).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setMockupCopySuccess(true);
      setTimeout(() => setMockupCopySuccess(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Export mockup to Excel
  const handleExportMockupExcel = () => {
    if (!mockupData) return;

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Layout Mockup
      const layoutData = [];

      mockupData.sections.forEach(section => {
        layoutData.push([section.heading]);
        if (section.columns === 1) {
          layoutData.push(['Field Name', 'API Name', 'Type']);
        } else {
          layoutData.push(['Field Name', 'API Name', 'Type', '', 'Field Name', 'API Name', 'Type']);
        }

        section.rows.forEach(row => {
          const cells = [];
          row.items.forEach((item, idx) => {
            if (idx === 1) cells.push('');
            if (item.isBlank) {
              cells.push('', '', '');
            } else {
              cells.push(item.label, item.fieldName || '', item.type);
            }
          });
          layoutData.push(cells);
        });

        layoutData.push([]);
      });

      // Add related lists
      if (mockupData.relatedLists && mockupData.relatedLists.length > 0) {
        layoutData.push(['Related Lists - NOT ADJUSTABLE']);
        layoutData.push([]);
        mockupData.relatedLists.forEach(rl => {
          layoutData.push([rl.label]);
          if (rl.columns && rl.columns.length > 0) {
            layoutData.push(rl.columns.map(col => col.label));
          }
          layoutData.push([]);
        });
      }

      const layoutSheet = XLSX.utils.aoa_to_sheet(layoutData);
      layoutSheet['!cols'] = [
        { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 3 },
        { wch: 30 }, { wch: 30 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(workbook, layoutSheet, 'Layout Mockup');

      // Sheet 2: Picklist Values
      if (mockupData.picklistFields && mockupData.picklistFields.length > 0) {
        const picklistData = [['Picklist Field', 'Available Values']];

        mockupData.picklistFields.forEach(picklist => {
          picklistData.push([picklist.label, '']);
          picklist.values.forEach(value => {
            picklistData.push(['', value]);
          });
          picklistData.push(['', '']);
        });

        const picklistSheet = XLSX.utils.aoa_to_sheet(picklistData);
        picklistSheet['!cols'] = [{ wch: 35 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, picklistSheet, 'Picklist Values');
      }

      // Sheet 3: Related Lists
      if (mockupData.relatedLists && mockupData.relatedLists.length > 0) {
        const relatedData = [['Related List', 'Columns']];

        mockupData.relatedLists.forEach(rl => {
          const columns = rl.columns?.map(c => c.label).join(', ') || '';
          relatedData.push([rl.label, columns]);
        });

        const relatedSheet = XLSX.utils.aoa_to_sheet(relatedData);
        relatedSheet['!cols'] = [{ wch: 35 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(workbook, relatedSheet, 'Related Lists');
      }

      const fileName = `${mockupObject}_${mockupSelectedLayout?.apiName || 'mockup'}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setSuccess('Excel exported successfully!');
    } catch (err) {
      setError('Failed to export Excel: ' + err.message);
    }
  };

  // ========================================
  // USER COMPARE FUNCTIONS
  // ========================================

  // Search users
  const handleUserSearch = async (searchTerm, userNumber) => {
    if (!searchTerm || searchTerm.length < 2) {
      if (userNumber === 1) setUserResults1([]);
      else setUserResults2([]);
      return;
    }

    try {
      const response = await fetch(`/api/sf/users?search=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        if (userNumber === 1) setUserResults1(data);
        else setUserResults2(data);
      }
    } catch (err) {
      console.error('User search error:', err);
    }
  };

  // Select user
  const handleUserSelect = (user, userNumber) => {
    if (userNumber === 1) {
      setSelectedUser1(user);
      setUserSearch1(user.name);
      setUserResults1([]);
    } else {
      setSelectedUser2(user);
      setUserSearch2(user.name);
      setUserResults2([]);
    }
    setUserCompareData(null);
  };

  // Run user comparison
  const handleUserCompare = async () => {
    if (!selectedUser1 || !selectedUser2) return;

    setUserCompareLoading(true);
    setError('');
    setUserCompareData(null);

    try {
      const response = await fetch(`/api/sf/userCompare?user1=${selectedUser1.id}&user2=${selectedUser2.id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Comparison failed');
      }

      const data = await response.json();
      setUserCompareData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUserCompareLoading(false);
    }
  };

  // ========================================
  // FLOW EXPORTER FUNCTIONS
  // ========================================

  // Load flows
  const loadFlows = async (searchTerm = '') => {
    setFlowLoading(true);
    setError('');

    try {
      let url = '/api/sf/flows';
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load flows');
      }

      const data = await response.json();
      setFlows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFlowLoading(false);
    }
  };

  // Select flow and load metadata
  const handleFlowSelect = async (flow) => {
    setSelectedFlow(flow);
    setFlowMetadata(null);
    setFlowLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/sf/flowMetadata?flowId=${flow.definitionId}&format=json`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load flow metadata');
      }

      const data = await response.json();
      setFlowMetadata(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFlowLoading(false);
    }
  };

  // Download flow XML
  const handleDownloadFlowXML = async () => {
    if (!selectedFlow) return;

    try {
      const response = await fetch(`/api/sf/flowMetadata?flowId=${selectedFlow.definitionId}&format=xml`);
      if (!response.ok) throw new Error('Failed to get flow XML');

      const data = await response.json();
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFlow.developerName}.flow-meta.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Flow XML downloaded!');
    } catch (err) {
      setError(err.message);
    }
  };

  // Copy flow XML to clipboard
  const handleCopyFlowXML = async () => {
    if (!selectedFlow) return;

    try {
      const response = await fetch(`/api/sf/flowMetadata?flowId=${selectedFlow.definitionId}&format=xml`);
      if (!response.ok) throw new Error('Failed to get flow XML');

      const data = await response.json();
      await navigator.clipboard.writeText(data.xml);
      setSuccess('Flow XML copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Render Mockup Page
  const renderMockupPage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Layout Mockup</h1>
        <p>Generate Excel-ready layout mockup with exact section and column structure</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="glass-card">
        <h2>Select Object</h2>
        <div className="form-group">
          <input
            type="text"
            className="glass-input"
            value={mockupObject ? `${objects.find(o => o.name === mockupObject)?.label || ''} (${mockupObject})` : mockupObjectSearch}
            onChange={(e) => {
              setMockupObjectSearch(e.target.value);
              if (mockupObject) {
                setMockupObject('');
                setMockupLayouts({ pageLayouts: [], flexiPages: [] });
                setMockupSelectedLayout(null);
                setMockupData(null);
              }
            }}
            onClick={() => {
              if (mockupObject) {
                setMockupObject('');
                setMockupObjectSearch('');
                setMockupLayouts({ pageLayouts: [], flexiPages: [] });
                setMockupSelectedLayout(null);
                setMockupData(null);
              }
            }}
            placeholder="Search objects..."
          />
        </div>

        {!mockupObject && objects.length > 0 && (
          <div className="object-list">
            {filteredMockupObjects.length === 0 ? (
              <div className="empty-state">No objects found</div>
            ) : (
              filteredMockupObjects.slice(0, 50).map((obj) => (
                <div
                  key={obj.name}
                  onClick={() => handleMockupObjectSelect(obj.name)}
                  className="object-item"
                >
                  <div className="object-label">{obj.label}</div>
                  <div className="object-api">{obj.name}</div>
                </div>
              ))
            )}
            {filteredMockupObjects.length > 50 && (
              <div className="list-footer">Showing first 50 results. Type to narrow search.</div>
            )}
          </div>
        )}
      </div>

      {mockupObject && mockupRecordTypes.length > 1 && (
        <div className="glass-card record-type-selector">
          <h2>Record Type</h2>
          <div className="record-type-list">
            {mockupRecordTypes.map((rt) => (
              <button
                key={rt.id}
                className={`record-type-item ${mockupSelectedRecordType?.id === rt.id ? 'selected' : ''}`}
                onClick={() => handleMockupRecordTypeSelect(rt)}
              >
                <div className="record-type-name">
                  {rt.name}
                  {rt.isDefault && <span className="badge badge-default">Default</span>}
                </div>
                {rt.layoutName && <div className="record-type-layout">Layout: {rt.layoutName}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {mockupObject && (mockupLayouts.pageLayouts?.length > 0 || mockupLayouts.flexiPages?.length > 0) && (
        <div className="glass-card">
          <h2>Select Layout</h2>

          {/* Page Layouts */}
          {mockupLayouts.pageLayouts?.length > 0 && (
            <>
              <h3 className="layout-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                Page Layouts (Classic)
              </h3>
              <div className="layout-list">
                {mockupLayouts.pageLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    className={`layout-item ${mockupSelectedLayout?.id === layout.id ? 'selected' : ''}`}
                    onClick={() => handleMockupLayoutSelect(layout)}
                  >
                    <div className="layout-item-label">{layout.label}</div>
                    <div className="layout-item-api">{layout.apiName}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Lightning Pages */}
          {mockupLayouts.flexiPages?.length > 0 && (
            <>
              <h3 className="layout-section-title" style={{ marginTop: 'var(--space-6)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Lightning Record Pages
              </h3>
              <div className="layout-list">
                {mockupLayouts.flexiPages.map((layout) => (
                  <div
                    key={layout.id}
                    className={`layout-item flexi ${mockupSelectedLayout?.id === layout.id ? 'selected' : ''}`}
                    onClick={() => handleMockupLayoutSelect(layout)}
                  >
                    <div className="layout-item-label">{layout.label}</div>
                    <div className="layout-item-api">{layout.apiName}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {mockupSelectedLayout && (
        <div className="glass-card">
          <div className="action-buttons">
            <button
              className="glass-button primary"
              onClick={handleGenerateMockup}
              disabled={mockupLoading}
            >
              {mockupLoading ? 'Generating...' : 'Generate Mockup'}
            </button>
            {mockupData && (
              <>
                <button
                  className={`glass-button ${mockupCopySuccess ? 'success' : 'secondary'}`}
                  onClick={handleCopyMockup}
                >
                  {mockupCopySuccess ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  className="glass-button excel"
                  onClick={handleExportMockupExcel}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Export Excel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {mockupData && (
        <div className="mockup-container">
          {/* Left side: Layout Sections */}
          <div className="glass-card mockup-preview">
            <h2>Layout Mockup Preview</h2>
            <p className="text-muted">Copy and paste into Excel - sections and columns are preserved</p>

            <div className="mockup-sections">
              {mockupData.sections.map((section, sIdx) => (
                <div key={sIdx} className="mockup-section">
                  <div className="mockup-section-header">
                    {section.heading}
                  </div>
                  <table className="mockup-table">
                    <thead>
                      <tr>
                        <th>Field Name</th>
                        <th>API Name</th>
                        <th>Type</th>
                        {section.columns >= 2 && (
                          <>
                            <th className="column-divider"></th>
                            <th>Field Name</th>
                            <th>API Name</th>
                            <th>Type</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.items.map((item, iIdx) => (
                            <React.Fragment key={iIdx}>
                              {iIdx === 1 && <td className="column-divider"></td>}
                              <td className={item.required ? 'required-field' : ''}>
                                {item.label}
                                {item.required && <span className="required-marker">*</span>}
                              </td>
                              <td className="api-name-cell">{item.fieldName || ''}</td>
                              <td>{item.type}</td>
                            </React.Fragment>
                          ))}
                          {/* Pad empty columns if needed */}
                          {row.items.length < section.columns && section.columns >= 2 && (
                            <>
                              <td className="column-divider"></td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Related Lists Section */}
            {mockupData.relatedLists && mockupData.relatedLists.length > 0 && (
              <div className="mockup-related-lists">
                <div className="related-lists-header">
                  Related Lists - NOT ADJUSTABLE
                </div>
                <div className="related-lists-content">
                  {mockupData.relatedLists.map((rl, rlIdx) => (
                    <div key={rlIdx} className="related-list-item">
                      <div className="related-list-name">{rl.label}</div>
                      {rl.columns && rl.columns.length > 0 && (
                        <div className="related-list-columns">
                          {rl.columns.map((col, colIdx) => (
                            <span key={colIdx} className="related-list-column">{col.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Picklist Values */}
          {mockupData.picklistFields && mockupData.picklistFields.length > 0 && (
            <div className="glass-card mockup-picklists">
              <h2>Picklist Values</h2>
              <p className="text-muted">{mockupData.picklistFields.length} picklist fields</p>

              <div className="picklist-tables">
                {mockupData.picklistFields.map((picklist, pIdx) => (
                  <div key={pIdx} className="picklist-table-wrapper">
                    <div className="picklist-header">{picklist.label}</div>
                    <table className="picklist-value-table">
                      <thead>
                        <tr>
                          <th>Available Values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {picklist.values.map((value, vIdx) => (
                          <tr key={vIdx}>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render User Compare Page
  const renderUserComparePage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>User Compare</h1>
        <p>Compare two users to find differences in access and permissions</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="comparison-select-grid">
        {/* User 1 Selection */}
        <div className="glass-card">
          <h2>User 1</h2>
          <div className="form-group">
            <input
              type="text"
              className="glass-input"
              value={userSearch1}
              onChange={(e) => {
                setUserSearch1(e.target.value);
                handleUserSearch(e.target.value, 1);
                if (selectedUser1) setSelectedUser1(null);
              }}
              placeholder="Search by name, email, or username..."
            />
          </div>

          {userResults1.length > 0 && !selectedUser1 && (
            <div className="user-results">
              {userResults1.map((user) => (
                <div
                  key={user.id}
                  className="user-item"
                  onClick={() => handleUserSelect(user, 1)}
                >
                  <div className="user-name">{user.name}</div>
                  <div className="user-details">
                    <span>{user.username}</span>
                    <span className="user-profile">{user.profile}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedUser1 && (
            <div className="selected-user-card">
              <div className="user-name">{selectedUser1.name}</div>
              <div className="user-email">{selectedUser1.email}</div>
              <div className="user-meta">
                <span className="badge">{selectedUser1.profile}</span>
                {selectedUser1.role && <span className="badge badge-secondary">{selectedUser1.role}</span>}
              </div>
            </div>
          )}
        </div>

        {/* User 2 Selection */}
        <div className="glass-card">
          <h2>User 2</h2>
          <div className="form-group">
            <input
              type="text"
              className="glass-input"
              value={userSearch2}
              onChange={(e) => {
                setUserSearch2(e.target.value);
                handleUserSearch(e.target.value, 2);
                if (selectedUser2) setSelectedUser2(null);
              }}
              placeholder="Search by name, email, or username..."
            />
          </div>

          {userResults2.length > 0 && !selectedUser2 && (
            <div className="user-results">
              {userResults2.map((user) => (
                <div
                  key={user.id}
                  className="user-item"
                  onClick={() => handleUserSelect(user, 2)}
                >
                  <div className="user-name">{user.name}</div>
                  <div className="user-details">
                    <span>{user.username}</span>
                    <span className="user-profile">{user.profile}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedUser2 && (
            <div className="selected-user-card">
              <div className="user-name">{selectedUser2.name}</div>
              <div className="user-email">{selectedUser2.email}</div>
              <div className="user-meta">
                <span className="badge">{selectedUser2.profile}</span>
                {selectedUser2.role && <span className="badge badge-secondary">{selectedUser2.role}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compare Button */}
      {selectedUser1 && selectedUser2 && (
        <div className="compare-action">
          <button
            className="glass-button primary large"
            onClick={handleUserCompare}
            disabled={userCompareLoading || selectedUser1.id === selectedUser2.id}
          >
            {userCompareLoading ? 'Comparing...' : 'Compare Users'}
          </button>
          {selectedUser1.id === selectedUser2.id && (
            <p className="text-muted">Please select two different users</p>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {userCompareData && (
        <div className="user-compare-results">
          {/* Summary */}
          <div className="comparison-summary">
            <div className={`summary-card ${!userCompareData.differences.profile ? 'highlight-green' : 'highlight-red'}`}>
              <div className="summary-label">Profile</div>
              <div className="summary-value">
                {userCompareData.differences.profile ? 'Different' : 'Same'}
              </div>
            </div>
            <div className={`summary-card ${!userCompareData.differences.role ? 'highlight-green' : 'highlight-red'}`}>
              <div className="summary-label">Role</div>
              <div className="summary-value">
                {userCompareData.differences.role ? 'Different' : 'Same'}
              </div>
            </div>
            <div className={`summary-card ${userCompareData.summary.totalDifferences === 0 ? 'highlight-green' : 'highlight-red'}`}>
              <div className="summary-number">{userCompareData.summary.totalDifferences}</div>
              <div className="summary-label">Total Differences</div>
            </div>
          </div>

          {/* Permission Sets Comparison */}
          <div className="glass-card">
            <h3>Permission Sets</h3>
            <div className="comparison-grid">
              <div className="compare-column">
                <h4>Only {userCompareData.user1.name} ({userCompareData.differences.permissionSets.onlyUser1.length})</h4>
                {userCompareData.differences.permissionSets.onlyUser1.length > 0 ? (
                  <ul className="diff-list diff-removed">
                    {userCompareData.differences.permissionSets.onlyUser1.map((ps, i) => (
                      <li key={i}>{ps.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
              <div className="compare-column">
                <h4>Only {userCompareData.user2.name} ({userCompareData.differences.permissionSets.onlyUser2.length})</h4>
                {userCompareData.differences.permissionSets.onlyUser2.length > 0 ? (
                  <ul className="diff-list diff-added">
                    {userCompareData.differences.permissionSets.onlyUser2.map((ps, i) => (
                      <li key={i}>{ps.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
            </div>
            {userCompareData.differences.permissionSets.common.length > 0 && (
              <div className="common-items">
                <h4>Common ({userCompareData.differences.permissionSets.common.length})</h4>
                <div className="common-tags">
                  {userCompareData.differences.permissionSets.common.map((ps, i) => (
                    <span key={i} className="tag">{ps.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Public Groups Comparison */}
          <div className="glass-card">
            <h3>Public Groups</h3>
            <div className="comparison-grid">
              <div className="compare-column">
                <h4>Only {userCompareData.user1.name} ({userCompareData.differences.groups.onlyUser1.length})</h4>
                {userCompareData.differences.groups.onlyUser1.length > 0 ? (
                  <ul className="diff-list diff-removed">
                    {userCompareData.differences.groups.onlyUser1.map((g, i) => (
                      <li key={i}>{g.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
              <div className="compare-column">
                <h4>Only {userCompareData.user2.name} ({userCompareData.differences.groups.onlyUser2.length})</h4>
                {userCompareData.differences.groups.onlyUser2.length > 0 ? (
                  <ul className="diff-list diff-added">
                    {userCompareData.differences.groups.onlyUser2.map((g, i) => (
                      <li key={i}>{g.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
            </div>
          </div>

          {/* Queues Comparison */}
          <div className="glass-card">
            <h3>Queues</h3>
            <div className="comparison-grid">
              <div className="compare-column">
                <h4>Only {userCompareData.user1.name} ({userCompareData.differences.queues.onlyUser1.length})</h4>
                {userCompareData.differences.queues.onlyUser1.length > 0 ? (
                  <ul className="diff-list diff-removed">
                    {userCompareData.differences.queues.onlyUser1.map((q, i) => (
                      <li key={i}>{q.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
              <div className="compare-column">
                <h4>Only {userCompareData.user2.name} ({userCompareData.differences.queues.onlyUser2.length})</h4>
                {userCompareData.differences.queues.onlyUser2.length > 0 ? (
                  <ul className="diff-list diff-added">
                    {userCompareData.differences.queues.onlyUser2.map((q, i) => (
                      <li key={i}>{q.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">None</p>
                )}
              </div>
            </div>
          </div>

          {/* Object Permissions Comparison */}
          {userCompareData.differences.objectPermissions && userCompareData.differences.objectPermissions.length > 0 && (
            <div className="glass-card">
              <h3>Object Permissions ({userCompareData.differences.objectPermissions.length} differences)</h3>
              <div className="object-perm-table-wrapper">
                <table className="object-perm-table">
                  <thead>
                    <tr>
                      <th>Object</th>
                      <th colSpan="6">{userCompareData.user1.name}</th>
                      <th colSpan="6">{userCompareData.user2.name}</th>
                    </tr>
                    <tr>
                      <th></th>
                      <th>Read</th>
                      <th>Create</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>View All</th>
                      <th>Modify All</th>
                      <th>Read</th>
                      <th>Create</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>View All</th>
                      <th>Modify All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCompareData.differences.objectPermissions.map((obj, i) => (
                      <tr key={i}>
                        <td className="object-name">{obj.object}</td>
                        <td className={obj.differences.read ? (obj.user1Permissions.read ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.read ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.create ? (obj.user1Permissions.create ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.create ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.edit ? (obj.user1Permissions.edit ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.edit ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.delete ? (obj.user1Permissions.delete ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.delete ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.viewAll ? (obj.user1Permissions.viewAll ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.viewAll ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.modifyAll ? (obj.user1Permissions.modifyAll ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user1Permissions.modifyAll ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.read ? (obj.user2Permissions.read ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.read ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.create ? (obj.user2Permissions.create ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.create ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.edit ? (obj.user2Permissions.edit ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.edit ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.delete ? (obj.user2Permissions.delete ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.delete ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.viewAll ? (obj.user2Permissions.viewAll ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.viewAll ? '✓' : '✗'}
                        </td>
                        <td className={obj.differences.modifyAll ? (obj.user2Permissions.modifyAll ? 'perm-yes' : 'perm-no') : ''}>
                          {obj.user2Permissions.modifyAll ? '✓' : '✗'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Field Permissions Comparison */}
          {userCompareData.differences.fieldPermissionsByObject && Object.keys(userCompareData.differences.fieldPermissionsByObject).length > 0 && (
            <div className="glass-card">
              <h3>Field-Level Security ({userCompareData.differences.fieldPermissions?.length || 0} differences)</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                Showing fields where users have different Read or Edit access
              </p>
              <div className="fls-accordion">
                {Object.entries(userCompareData.differences.fieldPermissionsByObject).map(([objectName, fields]) => (
                  <details key={objectName} className="fls-object-group">
                    <summary className="fls-object-header">
                      <span className="fls-object-name">{objectName}</span>
                      <span className="fls-field-count">{fields.length} field(s)</span>
                    </summary>
                    <div className="fls-fields">
                      <table className="fls-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th colSpan="2">{userCompareData.user1.name}</th>
                            <th colSpan="2">{userCompareData.user2.name}</th>
                          </tr>
                          <tr>
                            <th></th>
                            <th>Read</th>
                            <th>Edit</th>
                            <th>Read</th>
                            <th>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field, i) => (
                            <tr key={i}>
                              <td className="field-name">{field.field}</td>
                              <td className={field.user1.read !== field.user2.read ? (field.user1.read ? 'perm-yes' : 'perm-no') : ''}>
                                {field.user1.read ? '✓' : '✗'}
                              </td>
                              <td className={field.user1.edit !== field.user2.edit ? (field.user1.edit ? 'perm-yes' : 'perm-no') : ''}>
                                {field.user1.edit ? '✓' : '✗'}
                              </td>
                              <td className={field.user1.read !== field.user2.read ? (field.user2.read ? 'perm-yes' : 'perm-no') : ''}>
                                {field.user2.read ? '✓' : '✗'}
                              </td>
                              <td className={field.user1.edit !== field.user2.edit ? (field.user2.edit ? 'perm-yes' : 'perm-no') : ''}>
                                {field.user2.edit ? '✓' : '✗'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* No Differences Message */}
          {!userCompareData.summary.hasDifferences && (
            <div className="glass-card no-diff-message">
              <div className="no-diff-icon">✓</div>
              <h3>No Differences Found</h3>
              <p>Both users have identical access and permissions.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render Flow Exporter Page
  const renderFlowExporterPage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Flow Exporter</h1>
        <p>Export Flow metadata as XML for backup, review, or deployment</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="glass-card">
        <h2>Search Flows</h2>
        <div className="form-group search-with-button">
          <input
            type="text"
            className="glass-input"
            value={flowSearch}
            onChange={(e) => setFlowSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadFlows(flowSearch)}
            placeholder="Search flows by name..."
          />
          <button
            className="glass-button primary"
            onClick={() => loadFlows(flowSearch)}
            disabled={flowLoading}
          >
            {flowLoading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>

      {flows.length > 0 && (
        <div className="glass-card">
          <h2>Flows ({flows.length})</h2>
          <div className="flow-list">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className={`flow-item ${selectedFlow?.id === flow.id ? 'selected' : ''}`}
                onClick={() => handleFlowSelect(flow)}
              >
                <div className="flow-header">
                  <span className="flow-label">{flow.label}</span>
                  <span className={`flow-status ${flow.isActive ? 'active' : 'draft'}`}>
                    {flow.isActive ? 'Active' : 'Draft'}
                  </span>
                </div>
                <div className="flow-details">
                  <span className="flow-api">{flow.developerName}</span>
                  {flow.activeVersionNumber && (
                    <span className="flow-version">v{flow.activeVersionNumber}</span>
                  )}
                </div>
                {flow.description && (
                  <div className="flow-description">{flow.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFlow && flowMetadata && (
        <div className="glass-card">
          <h2>Flow Details</h2>
          <div className="flow-info">
            <div className="info-row">
              <span className="info-label">Name:</span>
              <span className="info-value">{flowMetadata.flowInfo.masterLabel}</span>
            </div>
            <div className="info-row">
              <span className="info-label">API Name:</span>
              <span className="info-value">{selectedFlow.developerName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Type:</span>
              <span className="info-value">{flowMetadata.flowInfo.processType}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status:</span>
              <span className="info-value">{flowMetadata.flowInfo.status}</span>
            </div>
            <div className="info-row">
              <span className="info-label">API Version:</span>
              <span className="info-value">{flowMetadata.flowInfo.apiVersion}</span>
            </div>
          </div>

          <div className="action-buttons" style={{ marginTop: 'var(--space-4)' }}>
            <button className="glass-button primary" onClick={handleDownloadFlowXML}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download XML
            </button>
            <button className="glass-button secondary" onClick={handleCopyFlowXML}>
              Copy XML to Clipboard
            </button>
          </div>

          {flowMetadata.metadata && (
            <div className="flow-metadata-summary" style={{ marginTop: 'var(--space-4)' }}>
              <h3>Flow Components</h3>
              <div className="metadata-tags">
                {flowMetadata.metadata.variables && (
                  <span className="tag">Variables: {flowMetadata.metadata.variables.length}</span>
                )}
                {flowMetadata.metadata.decisions && (
                  <span className="tag">Decisions: {flowMetadata.metadata.decisions.length}</span>
                )}
                {flowMetadata.metadata.assignments && (
                  <span className="tag">Assignments: {flowMetadata.metadata.assignments.length}</span>
                )}
                {flowMetadata.metadata.screens && (
                  <span className="tag">Screens: {flowMetadata.metadata.screens.length}</span>
                )}
                {flowMetadata.metadata.recordLookups && (
                  <span className="tag">Record Lookups: {flowMetadata.metadata.recordLookups.length}</span>
                )}
                {flowMetadata.metadata.recordCreates && (
                  <span className="tag">Record Creates: {flowMetadata.metadata.recordCreates.length}</span>
                )}
                {flowMetadata.metadata.recordUpdates && (
                  <span className="tag">Record Updates: {flowMetadata.metadata.recordUpdates.length}</span>
                )}
                {flowMetadata.metadata.loops && (
                  <span className="tag">Loops: {flowMetadata.metadata.loops.length}</span>
                )}
                {flowMetadata.metadata.subflows && (
                  <span className="tag">Subflows: {flowMetadata.metadata.subflows.length}</span>
                )}
                {flowMetadata.metadata.actionCalls && (
                  <span className="tag">Actions: {flowMetadata.metadata.actionCalls.length}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render Profile Compare Page
  const renderProfileComparePage = () => {
    const searchProfiles = async (search, resultSetter) => {
      if (!search || search.length < 2) {
        resultSetter([]);
        return;
      }
      try {
        const res = await fetch(`/api/sf/profiles?search=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          resultSetter(data);
        }
      } catch (err) {
        console.error('Profile search error:', err);
      }
    };

    const handleCompareProfiles = async () => {
      if (!selectedProfile1 || !selectedProfile2) return;

      setProfileCompareLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/sf/profileCompare?profile1=${selectedProfile1.id}&profile2=${selectedProfile2.id}`);
        if (!res.ok) throw new Error('Failed to compare profiles');
        const data = await res.json();
        setProfileCompareData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setProfileCompareLoading(false);
      }
    };

    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Profile Comparison</h1>
          <p>Compare object and field permissions between two profiles</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="glass-card">
          <h2>Select Profiles to Compare</h2>
          <div className="user-compare-grid">
            {/* Profile 1 */}
            <div className="user-select-column">
              <label>Profile 1</label>
              {selectedProfile1 ? (
                <div className="selected-user-card">
                  <div className="selected-user-info">
                    <strong>{selectedProfile1.name}</strong>
                    <span>{selectedProfile1.license}</span>
                  </div>
                  <button className="glass-button secondary small" onClick={() => {
                    setSelectedProfile1(null);
                    setProfileSearch1('');
                    setProfileCompareData(null);
                  }}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Search profiles..."
                    value={profileSearch1}
                    onChange={(e) => {
                      setProfileSearch1(e.target.value);
                      searchProfiles(e.target.value, setProfileResults1);
                    }}
                  />
                  {profileResults1.length > 0 && (
                    <div className="user-results">
                      {profileResults1.map(p => (
                        <div key={p.id} className="user-item" onClick={() => {
                          setSelectedProfile1(p);
                          setProfileResults1([]);
                        }}>
                          <strong>{p.name}</strong>
                          <span>{p.license}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Profile 2 */}
            <div className="user-select-column">
              <label>Profile 2</label>
              {selectedProfile2 ? (
                <div className="selected-user-card">
                  <div className="selected-user-info">
                    <strong>{selectedProfile2.name}</strong>
                    <span>{selectedProfile2.license}</span>
                  </div>
                  <button className="glass-button secondary small" onClick={() => {
                    setSelectedProfile2(null);
                    setProfileSearch2('');
                    setProfileCompareData(null);
                  }}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Search profiles..."
                    value={profileSearch2}
                    onChange={(e) => {
                      setProfileSearch2(e.target.value);
                      searchProfiles(e.target.value, setProfileResults2);
                    }}
                  />
                  {profileResults2.length > 0 && (
                    <div className="user-results">
                      {profileResults2.map(p => (
                        <div key={p.id} className="user-item" onClick={() => {
                          setSelectedProfile2(p);
                          setProfileResults2([]);
                        }}>
                          <strong>{p.name}</strong>
                          <span>{p.license}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            className="glass-button primary"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={handleCompareProfiles}
            disabled={!selectedProfile1 || !selectedProfile2 || profileCompareLoading}
          >
            {profileCompareLoading ? 'Comparing...' : 'Compare Profiles'}
          </button>
        </div>

        {/* Comparison Results */}
        {profileCompareData && (
          <div className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
            <h2>Comparison Results</h2>
            <div className="compare-summary" style={{ marginBottom: 'var(--space-4)' }}>
              <span className="tag">{profileCompareData.summary.objectPermissionDiffs} Object Differences</span>
              <span className="tag">{profileCompareData.summary.fieldPermissionDiffs} Field Differences</span>
            </div>

            {/* Object Permissions */}
            {profileCompareData.differences.objectPermissions.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h3>Object Permissions ({profileCompareData.differences.objectPermissions.length} differences)</h3>
                <div className="table-container">
                  <table className="object-perm-table">
                    <thead>
                      <tr>
                        <th>Object</th>
                        <th colSpan="6">{profileCompareData.profile1.name}</th>
                        <th colSpan="6">{profileCompareData.profile2.name}</th>
                      </tr>
                      <tr>
                        <th></th>
                        <th>R</th><th>C</th><th>E</th><th>D</th><th>VA</th><th>MA</th>
                        <th>R</th><th>C</th><th>E</th><th>D</th><th>VA</th><th>MA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileCompareData.differences.objectPermissions.map((diff, i) => (
                        <tr key={i}>
                          <td><strong>{diff.object}</strong></td>
                          <td className={diff.profile1Permissions.read ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.read ? '✓' : '✗'}</td>
                          <td className={diff.profile1Permissions.create ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.create ? '✓' : '✗'}</td>
                          <td className={diff.profile1Permissions.edit ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.edit ? '✓' : '✗'}</td>
                          <td className={diff.profile1Permissions.delete ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.delete ? '✓' : '✗'}</td>
                          <td className={diff.profile1Permissions.viewAll ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.viewAll ? '✓' : '✗'}</td>
                          <td className={diff.profile1Permissions.modifyAll ? 'perm-yes' : 'perm-no'}>{diff.profile1Permissions.modifyAll ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.read ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.read ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.create ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.create ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.edit ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.edit ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.delete ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.delete ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.viewAll ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.viewAll ? '✓' : '✗'}</td>
                          <td className={diff.profile2Permissions.modifyAll ? 'perm-yes' : 'perm-no'}>{diff.profile2Permissions.modifyAll ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Field Permissions */}
            {profileCompareData.differences.fieldPermissions.length > 0 && (
              <div>
                <h3>Field-Level Security ({profileCompareData.differences.fieldPermissions.length} differences)</h3>
                <div className="fls-accordion">
                  {Object.entries(profileCompareData.differences.fieldPermissionsByObject).map(([objName, fields]) => (
                    <details key={objName} className="fls-object-group">
                      <summary>{objName} ({fields.length} fields)</summary>
                      <table className="fls-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th colSpan="2">{profileCompareData.profile1.name}</th>
                            <th colSpan="2">{profileCompareData.profile2.name}</th>
                          </tr>
                          <tr>
                            <th></th>
                            <th>Read</th><th>Edit</th>
                            <th>Read</th><th>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f, i) => (
                            <tr key={i}>
                              <td>{f.field}</td>
                              <td className={f.profile1.read ? 'perm-yes' : 'perm-no'}>{f.profile1.read ? '✓' : '✗'}</td>
                              <td className={f.profile1.edit ? 'perm-yes' : 'perm-no'}>{f.profile1.edit ? '✓' : '✗'}</td>
                              <td className={f.profile2.read ? 'perm-yes' : 'perm-no'}>{f.profile2.read ? '✓' : '✗'}</td>
                              <td className={f.profile2.edit ? 'perm-yes' : 'perm-no'}>{f.profile2.edit ? '✓' : '✗'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {profileCompareData.summary.totalDifferences === 0 && (
              <p style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No differences found between these profiles.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Permission Set Analyzer Page
  const renderPSAnalyzerPage = () => {
    const searchPermissionSets = async (search) => {
      if (!search || search.length < 2) {
        setPermissionSets([]);
        return;
      }
      try {
        const res = await fetch(`/api/sf/permissionSets?search=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setPermissionSets(data);
        }
      } catch (err) {
        console.error('Permission set search error:', err);
      }
    };

    const handleAnalyze = async (ps) => {
      setSelectedPermissionSet(ps);
      setPsAnalysisLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/sf/permissionSetAnalyze?id=${ps.id}`);
        if (!res.ok) throw new Error('Failed to analyze permission set');
        const data = await res.json();
        setPsAnalysisData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setPsAnalysisLoading(false);
      }
    };

    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Permission Set Analyzer</h1>
          <p>View all permissions in a permission set</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="glass-card">
          <h2>Search Permission Sets</h2>
          <input
            type="text"
            className="glass-input"
            placeholder="Search permission sets..."
            value={psSearch}
            onChange={(e) => {
              setPsSearch(e.target.value);
              searchPermissionSets(e.target.value);
            }}
          />

          {permissionSets.length > 0 && !selectedPermissionSet && (
            <div className="user-results" style={{ marginTop: 'var(--space-2)' }}>
              {permissionSets.map(ps => (
                <div key={ps.id} className="user-item" onClick={() => handleAnalyze(ps)}>
                  <strong>{ps.label}</strong>
                  <span>{ps.license} {ps.isOwnedByProfile && `(Profile: ${ps.profileName})`}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {psAnalysisLoading && (
          <div className="glass-card" style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <span className="spinner"></span> Analyzing permission set...
          </div>
        )}

        {psAnalysisData && !psAnalysisLoading && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            {/* Permission Set Info */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>{psAnalysisData.permissionSet.label}</h2>
                  <p style={{ opacity: 0.7 }}>{psAnalysisData.permissionSet.description || 'No description'}</p>
                </div>
                <button className="glass-button secondary small" onClick={() => {
                  setSelectedPermissionSet(null);
                  setPsAnalysisData(null);
                  setPsSearch('');
                }}>Analyze Another</button>
              </div>
              <div className="metadata-tags" style={{ marginTop: 'var(--space-3)' }}>
                <span className="tag">License: {psAnalysisData.permissionSet.license}</span>
                {psAnalysisData.permissionSet.isOwnedByProfile && <span className="tag">Profile: {psAnalysisData.permissionSet.profileName}</span>}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
              <h3>Summary</h3>
              <div className="metadata-tags">
                <span className="tag">{psAnalysisData.summary.systemPermissionsCount} System Permissions</span>
                <span className="tag">{psAnalysisData.summary.objectPermissionsCount} Object Permissions</span>
                <span className="tag">{psAnalysisData.summary.fieldPermissionsCount} Field Permissions</span>
                {psAnalysisData.summary.tabSettingsCount > 0 && <span className="tag">{psAnalysisData.summary.tabSettingsCount} Tab Settings</span>}
                {psAnalysisData.summary.apexClassCount > 0 && <span className="tag">{psAnalysisData.summary.apexClassCount} Apex Classes</span>}
                {psAnalysisData.summary.vfPageCount > 0 && <span className="tag">{psAnalysisData.summary.vfPageCount} VF Pages</span>}
              </div>
            </div>

            {/* System Permissions */}
            {psAnalysisData.systemPermissions.length > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>System Permissions ({psAnalysisData.systemPermissions.length})</summary>
                <div className="metadata-tags" style={{ marginTop: 'var(--space-3)' }}>
                  {psAnalysisData.systemPermissions.map((sp, i) => (
                    <span key={i} className="tag" style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)' }}>{sp.label}</span>
                  ))}
                </div>
              </details>
            )}

            {/* Object Permissions */}
            {psAnalysisData.objectPermissions.all.length > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Object Permissions ({psAnalysisData.objectPermissions.count})</summary>
                <div className="table-container" style={{ marginTop: 'var(--space-3)' }}>
                  <table className="object-perm-table">
                    <thead>
                      <tr>
                        <th>Object</th>
                        <th>Read</th><th>Create</th><th>Edit</th><th>Delete</th><th>View All</th><th>Modify All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {psAnalysisData.objectPermissions.all.map((obj, i) => (
                        <tr key={i}>
                          <td><strong>{obj.object}</strong></td>
                          <td className={obj.read ? 'perm-yes' : 'perm-no'}>{obj.read ? '✓' : '✗'}</td>
                          <td className={obj.create ? 'perm-yes' : 'perm-no'}>{obj.create ? '✓' : '✗'}</td>
                          <td className={obj.edit ? 'perm-yes' : 'perm-no'}>{obj.edit ? '✓' : '✗'}</td>
                          <td className={obj.delete ? 'perm-yes' : 'perm-no'}>{obj.delete ? '✓' : '✗'}</td>
                          <td className={obj.viewAll ? 'perm-yes' : 'perm-no'}>{obj.viewAll ? '✓' : '✗'}</td>
                          <td className={obj.modifyAll ? 'perm-yes' : 'perm-no'}>{obj.modifyAll ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Field Permissions */}
            {psAnalysisData.fieldPermissions.count > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Field Permissions ({psAnalysisData.fieldPermissions.count} fields across {psAnalysisData.fieldPermissions.objectCount} objects)</summary>
                <div className="fls-accordion" style={{ marginTop: 'var(--space-3)' }}>
                  {Object.entries(psAnalysisData.fieldPermissions.byObject).map(([objName, fields]) => (
                    <details key={objName} className="fls-object-group">
                      <summary>{objName} ({fields.length} fields)</summary>
                      <table className="fls-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Read</th>
                            <th>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f, i) => (
                            <tr key={i}>
                              <td>{f.field}</td>
                              <td className={f.read ? 'perm-yes' : 'perm-no'}>{f.read ? '✓' : '✗'}</td>
                              <td className={f.edit ? 'perm-yes' : 'perm-no'}>{f.edit ? '✓' : '✗'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))}
                </div>
              </details>
            )}

            {/* Tab Settings */}
            {psAnalysisData.tabSettings.length > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Tab Settings ({psAnalysisData.tabSettings.length})</summary>
                <div className="metadata-tags" style={{ marginTop: 'var(--space-3)' }}>
                  {psAnalysisData.tabSettings.map((tab, i) => (
                    <span key={i} className="tag">{tab.name}: {tab.visibility}</span>
                  ))}
                </div>
              </details>
            )}

            {/* Apex Classes */}
            {psAnalysisData.apexClassAccess.length > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Apex Class Access ({psAnalysisData.apexClassAccess.length})</summary>
                <div className="metadata-tags" style={{ marginTop: 'var(--space-3)' }}>
                  {psAnalysisData.apexClassAccess.map((cls, i) => (
                    <span key={i} className="tag">{cls}</span>
                  ))}
                </div>
              </details>
            )}

            {/* VF Pages */}
            {psAnalysisData.visualforcePageAccess.length > 0 && (
              <details className="glass-card" style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Visualforce Page Access ({psAnalysisData.visualforcePageAccess.length})</summary>
                <div className="metadata-tags" style={{ marginTop: 'var(--space-3)' }}>
                  {psAnalysisData.visualforcePageAccess.map((pg, i) => (
                    <span key={i} className="tag">{pg}</span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Login Form - PREMIUM VERSION
  const renderLoginForm = () => (
    <div className="login-screen-v2">
      {/* Background effects */}
      <div className="login-orb login-orb-1"></div>
      <div className="login-orb login-orb-2"></div>
      <div className="login-grid-overlay"></div>

      <div className="login-content-v2">
        {/* Logo and title */}
        <div className="login-brand">
          <div className="login-logo-v2">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="url(#loginGradient)" strokeWidth="1.5">
              <defs>
                <linearGradient id="loginGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f5ff" />
                  <stop offset="100%" stopColor="#bf00ff" />
                </linearGradient>
              </defs>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="login-title-v2">
            <span className="title-cloud">CLOUD</span>
            <span className="title-forge">FORGE</span>
          </div>
        </div>

        {/* Login card */}
        <div className="login-card-v2">
          <div className="login-card-header">
            <h2>Connect to Salesforce</h2>
            <p>Enter your credentials to access the platform</p>
          </div>

          {error && <div className="error-message-v2">{error}</div>}
          {success && <div className="success-message-v2">{success}</div>}

          <form onSubmit={handleStartSession} className="login-form-v2">
            <div className="input-group-v2">
              <label>Instance URL</label>
              <div className="input-wrapper-v2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <input
                  type="url"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder="https://yourorg.my.salesforce.com"
                  required
                />
              </div>
            </div>

            <div className="input-group-v2">
              <label>Session ID (SID)</label>
              <div className="input-wrapper-v2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  placeholder="00D..."
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-btn-v2" disabled={loading}>
              {loading ? (
                <>
                  <span className="connecting-spinner-small"></span>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Connect</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-footer-v2">
            <div className="footer-divider"></div>
            <p className="footer-author">Engineered by <span>Fuhad Hossain</span></p>
            <a
              href="https://www.linkedin.com/in/fuhad-anik"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-linkedin"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
            <p className="footer-copyright">&copy; {new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Layout Extractor Page
  const renderExtractorPage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Layout Extractor</h1>
        <p>Select an object and layout to extract field metadata</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Object Selection */}
      <div className="glass-card">
        <h2>Select Object</h2>
        <div className="form-group">
          <input
            type="text"
            className="glass-input"
            value={selectedObject ? `${objects.find(o => o.name === selectedObject)?.label || ''} (${selectedObject})` : objectSearch}
            onChange={(e) => {
              setObjectSearch(e.target.value);
              if (selectedObject) {
                setSelectedObject('');
                setPageLayouts([]);
                setFlexiPages([]);
                setSelectedLayout(null);
                setPreviewData(null);
              }
            }}
            onClick={() => {
              if (selectedObject) {
                setSelectedObject('');
                setObjectSearch('');
                setPageLayouts([]);
                setFlexiPages([]);
                setSelectedLayout(null);
                setPreviewData(null);
              }
            }}
            placeholder="Search objects..."
          />
        </div>

        {!selectedObject && objects.length > 0 && (
          <div className="object-list">
            {filteredObjects.length === 0 ? (
              <div className="empty-state">No objects found</div>
            ) : (
              filteredObjects.slice(0, 50).map((obj) => (
                <div
                  key={obj.name}
                  onClick={() => handleObjectSelect(obj.name)}
                  className="object-item"
                >
                  <div className="object-label">{obj.label}</div>
                  <div className="object-api">{obj.name}</div>
                </div>
              ))
            )}
            {filteredObjects.length > 50 && (
              <div className="list-footer">Showing first 50 results. Type to narrow search.</div>
            )}
          </div>
        )}
      </div>

      {/* Record Type Selector */}
      {selectedObject && recordTypes.length > 1 && (
        <div className="glass-card record-type-selector">
          <h2>Record Type</h2>
          <p className="text-muted text-sm" style={{ marginBottom: '12px' }}>
            Select a record type to see its assigned layout
          </p>
          <div className="record-type-list">
            {recordTypes.map((rt) => (
              <button
                key={rt.id}
                className={`record-type-item ${selectedRecordType?.id === rt.id ? 'selected' : ''}`}
                onClick={() => handleRecordTypeSelect(rt)}
              >
                <div className="record-type-name">{rt.name}</div>
                {rt.isDefault && <span className="badge badge-default">Default</span>}
                {rt.layoutName && (
                  <div className="record-type-layout">Layout: {rt.layoutName}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layouts Grid */}
      {selectedObject && (
        <div className="layouts-grid">
          <div className="glass-card">
            <h2>
              Page Layouts
              {selectedRecordType && recordTypes.length > 1 && (
                <span className="layout-filter-badge">for {selectedRecordType.name}</span>
              )}
            </h2>
            {loading ? (
              <div className="loading-state"><span className="spinner"></span> Loading...</div>
            ) : filteredPageLayouts.length > 0 ? (
              <div className="layout-list">
                {filteredPageLayouts.map((layout) => (
                  <LayoutItem
                    key={layout.id}
                    layout={layout}
                    isSelected={selectedLayout?.id === layout.id}
                    onClick={() => handleLayoutSelect(layout)}
                  />
                ))}
              </div>
            ) : pageLayouts.length > 0 ? (
              <p className="text-muted">No layout assigned to this record type</p>
            ) : (
              <p className="text-muted">No page layouts found</p>
            )}
          </div>

          <div className="glass-card">
            <h2>Lightning Record Pages</h2>
            {loading ? (
              <div className="loading-state"><span className="spinner"></span> Loading...</div>
            ) : filteredFlexiPages.length > 0 ? (
              <div className="layout-list">
                {filteredFlexiPages.map((layout) => (
                  <LayoutItem
                    key={layout.id}
                    layout={layout}
                    isSelected={selectedLayout?.id === layout.id}
                    onClick={() => handleLayoutSelect(layout)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted">No Lightning pages found</p>
            )}
          </div>
        </div>
      )}

      {/* Preview & Export Section */}
      {selectedLayout && (
        <div className="glass-card">
          <div className="preview-header">
            <div>
              <h2>Preview & Export</h2>
              <p className="selected-layout">
                <strong>{selectedLayout.label}</strong>
                <span className="layout-type-badge">{selectedLayout.type}</span>
              </p>
            </div>

            <div className="orientation-toggle">
              <button
                className={`toggle-btn ${previewOrientation === 'horizontal' ? 'active' : ''}`}
                onClick={() => setPreviewOrientation('horizontal')}
              >
                Horizontal
              </button>
              <button
                className={`toggle-btn ${previewOrientation === 'vertical' ? 'active' : ''}`}
                onClick={() => setPreviewOrientation('vertical')}
              >
                Vertical
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="glass-button secondary"
              onClick={handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? 'Loading...' : 'Preview'}
            </button>
            <button
              className="glass-button primary"
              onClick={handleExport}
              disabled={loading}
            >
              {loading ? 'Exporting...' : 'Export CSV'}
            </button>
            {previewData && (
              <>
                <button
                  className="glass-button excel"
                  onClick={handleExportExcel}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Export Excel
                </button>
                <button
                  className={`glass-button ${copySuccess ? 'success' : ''}`}
                  onClick={handleCopyToClipboard}
                >
                  {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </>
            )}
          </div>

          {previewData && (
            <>
              <div className="preview-table-wrapper">
                {renderPreviewTable()}
              </div>
              <p className="field-count">{previewData.fields?.length || 0} fields found</p>
            </>
          )}
        </div>
      )}
    </div>
  );

  // Render Layout Comparison Page
  const renderComparisonPage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Layout Comparison</h1>
        <p>Compare two layouts side-by-side to identify differences</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Object Selection for Comparison */}
      <div className="glass-card">
        <h2>Select Object</h2>
        <div className="form-group">
          <input
            type="text"
            className="glass-input"
            value={compareObject ? `${objects.find(o => o.name === compareObject)?.label || ''} (${compareObject})` : compareObjectSearch}
            onChange={(e) => {
              setCompareObjectSearch(e.target.value);
              if (compareObject) {
                setCompareObject('');
                setCompareLayouts({ pageLayouts: [], flexiPages: [] });
                setCompareLayout1(null);
                setCompareLayout2(null);
                setCompareData1(null);
                setCompareData2(null);
              }
            }}
            onClick={() => {
              if (compareObject) {
                setCompareObject('');
                setCompareObjectSearch('');
              }
            }}
            placeholder="Search objects..."
          />
        </div>

        {!compareObject && objects.length > 0 && (
          <div className="object-list">
            {filteredCompareObjects.length === 0 ? (
              <div className="empty-state">No objects found</div>
            ) : (
              filteredCompareObjects.slice(0, 50).map((obj) => (
                <div
                  key={obj.name}
                  onClick={() => handleCompareObjectSelect(obj.name)}
                  className="object-item"
                >
                  <div className="object-label">{obj.label}</div>
                  <div className="object-api">{obj.name}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Layout Selection for Comparison */}
      {compareObject && (
        <div className="comparison-select-grid">
          <div className="glass-card">
            <h2>Layout 1</h2>
            {compareLayouts.pageLayouts.length + compareLayouts.flexiPages.length > 0 ? (
              <div className="layout-list">
                {[...compareLayouts.pageLayouts, ...compareLayouts.flexiPages].map((layout) => (
                  <LayoutItem
                    key={layout.id}
                    layout={layout}
                    isSelected={compareLayout1?.id === layout.id}
                    onClick={() => {
                      setCompareLayout1(layout);
                      setCompareData1(null);
                      setCompareData2(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted">No layouts found</p>
            )}
          </div>

          <div className="glass-card">
            <h2>Layout 2</h2>
            {compareLayouts.pageLayouts.length + compareLayouts.flexiPages.length > 0 ? (
              <div className="layout-list">
                {[...compareLayouts.pageLayouts, ...compareLayouts.flexiPages].map((layout) => (
                  <LayoutItem
                    key={layout.id}
                    layout={layout}
                    isSelected={compareLayout2?.id === layout.id}
                    onClick={() => {
                      setCompareLayout2(layout);
                      setCompareData1(null);
                      setCompareData2(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted">No layouts found</p>
            )}
          </div>
        </div>
      )}

      {/* Compare Button */}
      {compareLayout1 && compareLayout2 && (
        <div className="compare-action">
          <button
            className="glass-button primary large"
            onClick={handleRunComparison}
            disabled={compareLoading || compareLayout1.id === compareLayout2.id}
          >
            {compareLoading ? 'Comparing...' : 'Compare Layouts'}
          </button>
          {compareLayout1.id === compareLayout2.id && (
            <p className="text-muted">Please select two different layouts</p>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {renderComparisonResult()}
    </div>
  );

  // Render splash screen
  const renderSplashScreen = () => (
    <div className="splash-screen-v2">
      {/* Animated background particles */}
      <div className="splash-particles">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`
          }} />
        ))}
      </div>

      {/* Glowing orbs */}
      <div className="splash-orb splash-orb-1"></div>
      <div className="splash-orb splash-orb-2"></div>
      <div className="splash-orb splash-orb-3"></div>

      <div className="splash-content-v2">
        <div className="splash-logo-v2">
          <div className="logo-glow"></div>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="url(#logoGradient)" strokeWidth="1.5">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f5ff" />
                <stop offset="50%" stopColor="#bf00ff" />
                <stop offset="100%" stopColor="#ff006e" />
              </linearGradient>
            </defs>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>

        <div className="splash-title-v2">
          <span className="title-cloud">CLOUD</span>
          <span className="title-forge">FORGE</span>
        </div>
        <p className="splash-subtitle-v2">Ultimate Salesforce Admin Powerhouse</p>

        <div className="splash-features">
          <span className="feature-tag">Layout Extractor</span>
          <span className="feature-tag">User Compare</span>
          <span className="feature-tag">Flow Exporter</span>
          <span className="feature-tag">Profile Analyzer</span>
        </div>

        <button
          className="splash-enter-btn"
          onClick={() => setShowSplash(false)}
        >
          <span>Launch App</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="splash-branding-v2">
        <div className="branding-line"></div>
        <p className="splash-author-v2">Engineered by</p>
        <h2 className="splash-author-name-v2">Fuhad Hossain</h2>
        <a
          href="https://www.linkedin.com/in/fuhad-anik"
          target="_blank"
          rel="noopener noreferrer"
          className="linkedin-btn-v2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Connect on LinkedIn
        </a>
      </div>

      <p className="splash-copyright-v2">&copy; {new Date().getFullYear()} Fuhad Hossain. All rights reserved.</p>
    </div>
  );

  // Render footer
  const renderFooter = () => (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-author">
          Built with care by <span className="footer-author-name">Fuhad Hossain</span>
          <a
            href="https://www.linkedin.com/in/fuhad-anik"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: '8px',
              color: 'var(--primary-500)',
              textDecoration: 'none',
              verticalAlign: 'middle'
            }}
            title="Connect on LinkedIn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle' }}>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </p>
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} Fuhad Hossain. All rights reserved.
        </p>
      </div>
    </footer>
  );

  // Render connecting screen
  const renderConnectingScreen = () => (
    <div className="splash-screen-v2">
      <div className="splash-orb splash-orb-1"></div>
      <div className="splash-orb splash-orb-2"></div>

      <div className="splash-content-v2">
        <div className="splash-logo-v2" style={{ width: '100px', height: '100px', marginBottom: '30px' }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="url(#logoGradient2)" strokeWidth="1.5">
            <defs>
              <linearGradient id="logoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f5ff" />
                <stop offset="50%" stopColor="#bf00ff" />
                <stop offset="100%" stopColor="#ff006e" />
              </linearGradient>
            </defs>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>

        <div className="splash-title-v2" style={{ fontSize: '48px', marginBottom: '12px' }}>
          <span className="title-cloud">CLOUD</span>
          <span className="title-forge">FORGE</span>
        </div>

        <div style={{ marginTop: '40px' }}>
          <div className="connecting-spinner"></div>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '16px',
            marginTop: '20px',
            letterSpacing: '1px'
          }}>
            {splashMessage}
          </p>
        </div>
      </div>

      <p className="splash-copyright-v2">&copy; {new Date().getFullYear()} Fuhad Hossain</p>
    </div>
  );

  // Main render
  if (showSplash) {
    return renderSplashScreen();
  }

  if (isConnecting) {
    return renderConnectingScreen();
  }

  if (!sessionActive) {
    return renderLoginForm();
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h1>CloudForge</h1>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activePage === 'extractor' ? 'active' : ''}`}
            onClick={() => setActivePage('extractor')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Layout Extractor
          </button>

          <button
            className={`nav-item ${activePage === 'compare' ? 'active' : ''}`}
            onClick={() => setActivePage('compare')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Layout Comparison
          </button>

          <button
            className={`nav-item ${activePage === 'mockup' ? 'active' : ''}`}
            onClick={() => setActivePage('mockup')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="12" y1="9" x2="12" y2="21" />
            </svg>
            Layout Mockup
          </button>

          <div className="nav-divider"></div>

          <button
            className={`nav-item ${activePage === 'usercompare' ? 'active' : ''}`}
            onClick={() => setActivePage('usercompare')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            User Compare
          </button>

          <button
            className={`nav-item ${activePage === 'flowexporter' ? 'active' : ''}`}
            onClick={() => setActivePage('flowexporter')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Flow Exporter
          </button>

          <button
            className={`nav-item ${activePage === 'profilecompare' ? 'active' : ''}`}
            onClick={() => setActivePage('profilecompare')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              <line x1="18" y1="8" x2="18" y2="14" />
              <line x1="15" y1="11" x2="21" y2="11" />
            </svg>
            Profile Compare
          </button>

          <button
            className={`nav-item ${activePage === 'psanalyzer' ? 'active' : ''}`}
            onClick={() => setActivePage('psanalyzer')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            PS Analyzer
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="connection-status">
            <span className="status-dot"></span>
            Connected
          </div>
          <button className="glass-button small" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          {activePage === 'extractor' && renderExtractorPage()}
          {activePage === 'compare' && renderComparisonPage()}
          {activePage === 'mockup' && renderMockupPage()}
          {activePage === 'usercompare' && renderUserComparePage()}
          {activePage === 'flowexporter' && renderFlowExporterPage()}
          {activePage === 'profilecompare' && renderProfileComparePage()}
          {activePage === 'psanalyzer' && renderPSAnalyzerPage()}
        </div>
        {renderFooter()}
      </main>
    </div>
  );
}
