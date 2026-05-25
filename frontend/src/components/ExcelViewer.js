/**
 * ExcelViewer — Upload, view, edit, and download multiple Excel spreadsheets.
 * Files stored in S3 as JSON. Manifest tracks all files with metadata.
 * Admin can edit, others view-only.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';

function ExcelViewer({ onBack, user }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin';

  useEffect(() => { loadManifest(); }, []);

  const loadManifest = async () => {
    setLoading(true);
    try {
      const { downloadUrl } = await api.getImageDownloadUrl('excel-sheets/manifest.json');
      const resp = await fetch(downloadUrl);
      if (resp.ok) {
        const data = await resp.json();
        setFiles(data.files || []);
      } else {
        // Try loading legacy single file
        const legacy = await api.getExcelData();
        if (legacy && legacy.workbook) {
          const legacyFile = { id: 'legacy', fileName: legacy.fileName || 'spreadsheet.xlsx', uploadedBy: 'System', uploadedAt: '', workbook: legacy.workbook, activeSheet: legacy.activeSheet };
          setFiles([legacyFile]);
          await saveManifest([legacyFile]);
        } else {
          setFiles([]);
        }
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const saveManifest = async (fileList) => {
    const manifest = { files: fileList.map(f => ({ id: f.id, fileName: f.fileName, uploadedBy: f.uploadedBy, uploadedAt: f.uploadedAt })) };
    const response = await fetch((await getUploadUrl('excel-sheets/manifest.json')).uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-amz-server-side-encryption': 'AES256' },
      body: JSON.stringify(manifest)
    });
    if (!response.ok) throw new Error('Failed to save manifest');
  };

  const getUploadUrl = async (fixedKey) => {
    const { API_BASE_URL } = await import('../config');
    const resp = await fetch(`${API_BASE_URL}/presigned-url-icsi-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'excel', imageNumber: 1, stageFolder: 'excel', fixedKey })
    });
    return resp.json();
  };

  const showStatus = useCallback((msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  }, []);

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    setUploading(true);

    try {
      const newFiles = [...files];
      for (const file of selectedFiles) {
        const data = await readFileAsArray(file);
        const wb = XLSX.read(data, { type: 'array' });
        const sheets = {};
        wb.SheetNames.forEach(name => {
          sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
        });
        const fileWorkbook = { sheets, sheetNames: wb.SheetNames };
        const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const fileData = { workbook: fileWorkbook, activeSheet: wb.SheetNames[0] || '', fileName: file.name };

        // Upload file data to S3
        const { uploadUrl } = await getUploadUrl(`excel-sheets/${fileId}.json`);
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-amz-server-side-encryption': 'AES256' },
          body: JSON.stringify(fileData)
        });

        newFiles.push({
          id: fileId,
          fileName: file.name,
          uploadedBy: user?.name || user?.email || 'Unknown',
          uploadedAt: new Date().toISOString()
        });
      }

      setFiles(newFiles);
      await saveManifest(newFiles);
      showStatus(`${selectedFiles.length} file(s) uploaded`);
    } catch (err) {
      showStatus('Error uploading file(s)');
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const readFileAsArray = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const handleOpenFile = async (file) => {
    setLoading(true);
    try {
      let fileData;
      if (file.workbook) {
        fileData = file;
      } else {
        const { downloadUrl } = await api.getImageDownloadUrl(`excel-sheets/${file.id}.json`);
        const resp = await fetch(downloadUrl);
        fileData = await resp.json();
      }
      setWorkbook(fileData.workbook);
      setActiveSheet(fileData.activeSheet || fileData.workbook.sheetNames[0] || '');
      setSelectedFile(file);
      setIsDirty(false);
    } catch (err) {
      showStatus('Error opening file');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    if (isDirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    setSelectedFile(null);
    setWorkbook(null);
    setActiveSheet('');
    setIsDirty(false);
  };

  const handleCellEdit = (rowIdx, colIdx, value) => {
    if (!isAdmin || !workbook || !activeSheet) return;
    const newWorkbook = { ...workbook, sheets: { ...workbook.sheets } };
    const sheetData = newWorkbook.sheets[activeSheet].map(row => [...row]);
    while (sheetData.length <= rowIdx) sheetData.push([]);
    while (sheetData[rowIdx].length <= colIdx) sheetData[rowIdx].push('');
    sheetData[rowIdx][colIdx] = value;
    newWorkbook.sheets[activeSheet] = sheetData;
    setWorkbook(newWorkbook);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!workbook || !selectedFile) return;
    try {
      const fileData = { workbook, activeSheet, fileName: selectedFile.fileName };
      const key = selectedFile.id === 'legacy' ? 'excel-sheets/shared-workbook.json' : `excel-sheets/${selectedFile.id}.json`;
      const { uploadUrl } = await getUploadUrl(key);
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-amz-server-side-encryption': 'AES256' },
        body: JSON.stringify(fileData)
      });
      setIsDirty(false);
      showStatus('Saved');
    } catch { showStatus('Error saving'); }
  };

  const handleDownload = () => {
    if (!workbook) return;
    const wb = XLSX.utils.book_new();
    workbook.sheetNames.forEach(name => {
      const ws = XLSX.utils.aoa_to_sheet(workbook.sheets[name]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, selectedFile?.fileName || 'spreadsheet.xlsx');
  };

  const handleDeleteFile = async (fileToDelete) => {
    if (!window.confirm(`Delete "${fileToDelete.fileName}"? This cannot be undone.`)) return;
    const newFiles = files.filter(f => f.id !== fileToDelete.id);
    setFiles(newFiles);
    await saveManifest(newFiles);
    showStatus('File deleted');
  };

  // ===== RENDER: Loading =====
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button onClick={onBack} style={styles.btnSecondary}>← Back</button>
          <h2 style={styles.title}>Data Sheets</h2>
          <div />
        </div>
        <div style={styles.uploadArea}><p style={{ color: '#666' }}>Loading...</p></div>
      </div>
    );
  }

  // ===== RENDER: File List =====
  if (!selectedFile) {
    return (
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button onClick={onBack} style={styles.btnSecondary}>← Back</button>
          <h2 style={styles.title}>Data Sheets</h2>
          <div style={styles.toolbarActions}>
            {statusMessage && <span style={styles.statusMsg}>{statusMessage}</span>}
            <button onClick={() => fileInputRef.current?.click()} style={styles.btnPrimary} disabled={uploading}>
              {uploading ? 'Uploading...' : '+ Upload Excel'}
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple onChange={handleFileUpload} style={{ display: 'none' }} />

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {files.length === 0 ? (
            <div style={styles.uploadArea}>
              <div style={styles.uploadBox}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="4" width="48" height="56" rx="4"/><line x1="20" y1="20" x2="44" y2="20"/><line x1="20" y1="30" x2="44" y2="30"/><line x1="20" y1="40" x2="44" y2="40"/><line x1="32" y1="4" x2="32" y2="60"/>
                </svg>
                <h3 style={{ margin: '16px 0 8px', color: '#333' }}>No Excel Files Uploaded</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>Upload .xlsx or .xls files to get started</p>
                <button onClick={() => fileInputRef.current?.click()} style={styles.btnPrimary}>Upload Files</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {files.map(file => (
                <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer' }} onClick={() => handleOpenFile(file)}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.92rem', color: '#1a202c' }}>{file.fileName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Uploaded by: {file.uploadedBy} {file.uploadedAt ? `· ${new Date(file.uploadedAt).toLocaleDateString()} ${new Date(file.uploadedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleOpenFile(file)} style={{ ...styles.btnSecondary, padding: '6px 12px', fontSize: '0.8rem' }}>Open</button>
                    {isAdmin && <button onClick={() => handleDeleteFile(file)} style={{ ...styles.btnDanger, padding: '6px 12px', fontSize: '0.8rem' }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== RENDER: Spreadsheet View =====
  const sheetData = workbook?.sheets?.[activeSheet] || [];
  const maxCols = sheetData.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button onClick={handleBackToList} style={styles.btnSecondary}>← Back to Files</button>
        <h2 style={styles.title}>{selectedFile.fileName}</h2>
        <div style={styles.toolbarActions}>
          {statusMessage && <span style={styles.statusMsg}>{statusMessage}</span>}
          {!isAdmin && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600, background: '#fffbeb', padding: '4px 10px', borderRadius: '6px' }}>View Only</span>}
          {isAdmin && <button onClick={handleSave} style={isDirty ? styles.btnPrimary : styles.btnSecondary}>{isDirty ? '● Save' : 'Save'}</button>}
          <button onClick={handleDownload} style={styles.btnSecondary}>Download</button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            {sheetData.length > 0 && (
              <tr>
                <th style={styles.rowNumHeader}>#</th>
                {Array.from({ length: maxCols }, (_, i) => (
                  <th key={i} style={styles.th}>{getColumnLabel(i)}</th>
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
                    {isAdmin ? (
                      <div contentEditable suppressContentEditableWarning style={styles.cell}
                        onBlur={(e) => {
                          const newVal = e.target.innerText;
                          const oldVal = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                          if (newVal !== oldVal) handleCellEdit(rowIdx, colIdx, newVal);
                        }}>
                        {row[colIdx] !== undefined ? String(row[colIdx]) : ''}
                      </div>
                    ) : (
                      <div style={styles.cell}>{row[colIdx] !== undefined ? String(row[colIdx]) : ''}</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {workbook?.sheetNames?.length > 1 && (
        <div style={styles.sheetTabs}>
          {workbook.sheetNames.map(name => (
            <button key={name} onClick={() => setActiveSheet(name)} style={name === activeSheet ? styles.activeTab : styles.tab}>{name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function getColumnLabel(idx) {
  let label = ''; let n = idx;
  while (n >= 0) { label = String.fromCharCode((n % 26) + 65) + label; n = Math.floor(n / 26) - 1; }
  return label;
}


const styles = {
  container: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', background: '#f8f9fa', overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e0e0e0', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '16px', fontWeight: 600, color: '#333' },
  toolbarActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  statusMsg: { fontSize: '13px', color: '#28a745', fontWeight: 500 },
  btnPrimary: { padding: '8px 16px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  btnDanger: { padding: '8px 16px', background: '#fff', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  uploadArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  uploadBox: { textAlign: 'center', padding: '60px', border: '2px dashed #ccc', borderRadius: '12px', background: '#fff' },
  tableWrapper: { flex: 1, overflow: 'auto', padding: '0' },
  table: { borderCollapse: 'collapse', minWidth: '100%', fontSize: '13px', background: '#fff' },
  th: { padding: '8px 12px', background: '#f0f2f5', borderBottom: '2px solid #ddd', borderRight: '1px solid #e8e8e8', fontWeight: 600, color: '#555', textAlign: 'center', position: 'sticky', top: 0, zIndex: 1, minWidth: '80px' },
  rowNumHeader: { padding: '8px 8px', background: '#f0f2f5', borderBottom: '2px solid #ddd', borderRight: '1px solid #ddd', fontWeight: 600, color: '#999', textAlign: 'center', position: 'sticky', top: 0, left: 0, zIndex: 2, width: '40px' },
  headerRow: { background: '#e8f0fe' },
  evenRow: { background: '#fafbfc' },
  rowNum: { padding: '4px 8px', background: '#f8f9fa', borderRight: '1px solid #ddd', color: '#999', textAlign: 'center', fontSize: '11px', position: 'sticky', left: 0, zIndex: 1 },
  td: { padding: 0, borderBottom: '1px solid #eee', borderRight: '1px solid #eee' },
  cell: { padding: '6px 10px', minHeight: '28px', outline: 'none', cursor: 'text', whiteSpace: 'nowrap' },
  sheetTabs: { display: 'flex', gap: '0', padding: '0 12px', background: '#fff', borderTop: '1px solid #e0e0e0', overflowX: 'auto' },
  tab: { padding: '10px 20px', background: 'transparent', border: 'none', borderTop: '2px solid transparent', cursor: 'pointer', fontSize: '13px', color: '#666' },
  activeTab: { padding: '10px 20px', background: 'transparent', border: 'none', borderTop: '2px solid #667eea', cursor: 'pointer', fontSize: '13px', color: '#667eea', fontWeight: 600 },
};

export default ExcelViewer;
