/**
 * ExcelViewer — Upload, view, edit, and download Excel spreadsheets.
 * Data is persisted in DynamoDB (shared across all users). Uses the 'xlsx' library for parsing/writing.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';

function ExcelViewer({ onBack, user }) {
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [fileName, setFileName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Load from server on mount
  useEffect(() => {
    loadFromServer();
  }, []);

  const loadFromServer = async () => {
    setLoading(true);
    try {
      const data = await api.getExcelData();
      if (data && data.workbook) {
        setWorkbook(data.workbook);
        setActiveSheet(data.activeSheet || data.workbook.sheetNames[0] || '');
        setFileName(data.fileName || 'spreadsheet.xlsx');
      }
    } catch (e) {
      console.error('Failed to load spreadsheet from server:', e);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = useCallback((msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const sheets = {};
        wb.SheetNames.forEach((name) => {
          const sheet = wb.Sheets[name];
          sheets[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        });

        const newWorkbook = { sheets, sheetNames: wb.SheetNames };
        setWorkbook(newWorkbook);
        setActiveSheet(wb.SheetNames[0] || '');
        setFileName(file.name);
        setIsDirty(false);

        // Save to server
        await api.saveExcelData({ workbook: newWorkbook, activeSheet: wb.SheetNames[0] || '', fileName: file.name });
        showStatus('File uploaded and saved');
      } catch (err) {
        console.error('Failed to parse Excel file:', err);
        showStatus('Error: Could not parse file. Please upload a valid .xlsx or .xls file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleCellEdit = (rowIdx, colIdx, value) => {
    if (!workbook || !activeSheet) return;
    const newWorkbook = { ...workbook, sheets: { ...workbook.sheets } };
    const sheetData = newWorkbook.sheets[activeSheet].map((row) => [...row]);

    // Ensure row exists
    while (sheetData.length <= rowIdx) {
      sheetData.push([]);
    }
    // Ensure columns exist
    while (sheetData[rowIdx].length <= colIdx) {
      sheetData[rowIdx].push('');
    }

    sheetData[rowIdx][colIdx] = value;
    newWorkbook.sheets[activeSheet] = sheetData;
    setWorkbook(newWorkbook);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!workbook) return;
    try {
      await api.saveExcelData({ workbook, activeSheet, fileName });
      setIsDirty(false);
      showStatus('Saved to server');
    } catch (err) {
      showStatus('Error: Failed to save');
    }
  };

  const handleDownload = () => {
    if (!workbook) return;
    const wb = XLSX.utils.book_new();
    workbook.sheetNames.forEach((name) => {
      const ws = XLSX.utils.aoa_to_sheet(workbook.sheets[name]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, fileName || 'spreadsheet.xlsx');
    showStatus('Downloaded');
  };

  const handleUploadNew = () => {
    fileInputRef.current?.click();
  };

  const handleClear = async () => {
    if (!window.confirm('Remove current spreadsheet? This cannot be undone.')) return;
    try {
      await api.saveExcelData({});
    } catch {}
    setWorkbook(null);
    setActiveSheet('');
    setFileName('');
    setIsDirty(false);
  };

  // Render loading
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button onClick={onBack} style={styles.btnSecondary}>← Back</button>
          <h2 style={styles.title}>Data Sheets</h2>
          <div />
        </div>
        <div style={styles.uploadArea}>
          <p style={{ color: '#666' }}>Loading spreadsheet...</p>
        </div>
      </div>
    );
  }

  // Render upload screen
  if (!workbook) {
    return (
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button onClick={onBack} style={styles.btnSecondary}>← Back</button>
          <h2 style={styles.title}>Data Sheets</h2>
          <div />
        </div>
        <div style={styles.uploadArea}>
          <div style={styles.uploadBox}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="4" width="48" height="56" rx="4"/>
              <line x1="20" y1="20" x2="44" y2="20"/>
              <line x1="20" y1="30" x2="44" y2="30"/>
              <line x1="20" y1="40" x2="44" y2="40"/>
              <line x1="32" y1="4" x2="32" y2="60"/>
            </svg>
            <h3 style={{ margin: '16px 0 8px', color: '#333' }}>Upload Excel Spreadsheet</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>Supports .xlsx and .xls files</p>
            <button onClick={() => fileInputRef.current?.click()} style={styles.btnPrimary}>
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    );
  }

  const sheetData = workbook.sheets[activeSheet] || [];
  // Determine max columns
  const maxCols = sheetData.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button onClick={onBack} style={styles.btnSecondary}>← Back</button>
        <h2 style={styles.title}>{fileName}</h2>
        <div style={styles.toolbarActions}>
          {statusMessage && <span style={styles.statusMsg}>{statusMessage}</span>}
          <button onClick={handleSave} style={isDirty ? styles.btnPrimary : styles.btnSecondary}>
            {isDirty ? '● Save' : 'Save'}
          </button>
          <button onClick={handleDownload} style={styles.btnSecondary}>Download</button>
          <button onClick={handleUploadNew} style={styles.btnSecondary}>Upload New</button>
          <button onClick={handleClear} style={styles.btnDanger}>Remove</button>
        </div>
      </div>

      {/* Hidden file input for Upload New */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            {sheetData.length > 0 && (
              <tr>
                <th style={styles.rowNumHeader}>#</th>
                {Array.from({ length: maxCols }, (_, i) => (
                  <th key={i} style={styles.th}>
                    {getColumnLabel(i)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {sheetData.map((row, rowIdx) => (
              <tr key={rowIdx} style={rowIdx === 0 ? styles.headerRow : (rowIdx % 2 === 0 ? styles.evenRow : {})}>
                <td style={styles.rowNum}>{rowIdx + 1}</td>
                {Array.from({ length: maxCols }, (_, colIdx) => (
                  <td key={colIdx} style={styles.td}>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      style={styles.cell}
                      onBlur={(e) => {
                        const newVal = e.target.innerText;
                        const oldVal = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                        if (newVal !== oldVal) {
                          handleCellEdit(rowIdx, colIdx, newVal);
                        }
                      }}
                    >
                      {row[colIdx] !== undefined ? String(row[colIdx]) : ''}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs */}
      {workbook.sheetNames.length > 1 && (
        <div style={styles.sheetTabs}>
          {workbook.sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveSheet(name)}
              style={name === activeSheet ? styles.activeTab : styles.tab}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Convert column index to letter (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
function getColumnLabel(idx) {
  let label = '';
  let n = idx;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    background: '#f8f9fa',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  },
  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  statusMsg: {
    fontSize: '13px',
    color: '#28a745',
    fontWeight: 500,
  },
  btnPrimary: {
    padding: '8px 16px',
    background: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#fff',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnDanger: {
    padding: '8px 16px',
    background: '#fff',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  uploadArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBox: {
    textAlign: 'center',
    padding: '60px',
    border: '2px dashed #ccc',
    borderRadius: '12px',
    background: '#fff',
  },
  tableWrapper: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
  },
  table: {
    borderCollapse: 'collapse',
    minWidth: '100%',
    fontSize: '13px',
    background: '#fff',
  },
  th: {
    padding: '8px 12px',
    background: '#f0f2f5',
    borderBottom: '2px solid #ddd',
    borderRight: '1px solid #e8e8e8',
    fontWeight: 600,
    color: '#555',
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    minWidth: '80px',
  },
  rowNumHeader: {
    padding: '8px 8px',
    background: '#f0f2f5',
    borderBottom: '2px solid #ddd',
    borderRight: '1px solid #ddd',
    fontWeight: 600,
    color: '#999',
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 2,
    width: '40px',
  },
  headerRow: {
    background: '#e8f0fe',
  },
  evenRow: {
    background: '#fafbfc',
  },
  rowNum: {
    padding: '4px 8px',
    background: '#f8f9fa',
    borderRight: '1px solid #ddd',
    color: '#999',
    textAlign: 'center',
    fontSize: '11px',
    position: 'sticky',
    left: 0,
    zIndex: 1,
  },
  td: {
    padding: 0,
    borderBottom: '1px solid #eee',
    borderRight: '1px solid #eee',
  },
  cell: {
    padding: '6px 10px',
    minHeight: '28px',
    outline: 'none',
    cursor: 'text',
    whiteSpace: 'nowrap',
  },
  sheetTabs: {
    display: 'flex',
    gap: '0',
    padding: '0 12px',
    background: '#fff',
    borderTop: '1px solid #e0e0e0',
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    borderTop: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#666',
  },
  activeTab: {
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    borderTop: '2px solid #667eea',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#667eea',
    fontWeight: 600,
  },
};

export default ExcelViewer;
