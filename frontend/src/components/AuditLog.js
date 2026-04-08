/**
 * Audit Log — displays filterable system activity log with LLM result indicators. Admin/Supervisor only.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AuditLog.css';

// SVG Icons
const IcoClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IcoDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IcoBarChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IcoCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IcoXCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);
const IcoFilePlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);
const IcoUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const IcoEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IcoTool = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const IcoTag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IcoSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const getSummaryIcon = (action) => {
  if (action.includes('VALIDATION_PASS')) return <IcoCheckCircle />;
  if (action.includes('VALIDATION_FAIL')) return <IcoXCircle />;
  if (action.includes('REGISTER'))        return <IcoFilePlus />;
  if (action.includes('UPLOAD'))          return <IcoUpload />;
  if (action.includes('EDIT'))            return <IcoEdit />;
  if (action.includes('RESOLVE'))         return <IcoTool />;
  return <IcoTag />;
};

function AuditLog({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    action: '',
    stage: '',
    userEmail: '',
    sessionId: ''
  });
  const [actionCounts, setActionCounts] = useState({});
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLogs(filters);
      setLogs(data.logs || []);
      setActionCounts(data.action_counts || {});
      setTotalCount(data.total_count || 0);
    } catch (err) {
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => { loadAuditLogs(); };

  const handleClearFilters = () => {
    setFilters({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      action: '', stage: '', userEmail: '', sessionId: ''
    });
  };

  const handleExportCSV = () => {
    if (logs.length === 0) { alert('No logs to export'); return; }
    const headers = ['Timestamp', 'Action', 'Stage', 'User', 'Email', 'Session ID', 'LLM Result', 'Details'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.stage || '-',
      log.user_name || log.userName || 'N/A',
      log.user_email || log.userEmail || 'N/A',
      log.session_id || log.sessionId || 'N/A',
      log.action === 'VALIDATION_PASS' ? 'SUCCESS' : log.action === 'VALIDATION_FAIL' ? 'FAILURE' : '-',
      (log.details || log.metadata) ? JSON.stringify(log.details || log.metadata).replace(/"/g, '""') : 'N/A'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getActionBadgeColor = (action) => {
    const colors = {
      'REGISTER_CASE':   '#2196f3',
      'UPLOAD_IMAGE':    '#4caf50',
      'EDIT_PATIENT':    '#ff9800',
      'VALIDATION_PASS': '#4caf50',
      'VALIDATION_FAIL': '#f44336',
      'RESOLVE_FAILURE': '#9c27b0',
      'LOGIN':           '#00bcd4',
      'LOGOUT':          '#607d8b'
    };
    return colors[action] || '#757575';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const formatDetails = (details) => {
    if (!details) return 'No details';
    if (typeof details === 'string') return details;
    return Object.entries(details).map(([key, value]) => {
      if (key === 'changes' && Array.isArray(value)) {
        return (
          <div key={key} style={{ marginTop: '0.5rem' }}>
            <strong>Changes:</strong>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem' }}>
              {value.map((change, idx) => <li key={idx}>{change}</li>)}
            </ul>
          </div>
        );
      }
      return <div key={key}><strong>{key}:</strong> {JSON.stringify(value)}</div>;
    });
  };

  if (loading && logs.length === 0) {
    return (
      <div className="audit-log-container">
        <div className="loading-spinner">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Loading..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-log-container">
      <div className="audit-header">
        <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <IcoClipboard /> Audit Log Viewer
        </h1>
        <div className="header-actions">
          <button onClick={handleExportCSV} className="btn-export" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IcoDownload /> Export CSV
          </button>
          <button onClick={onBack} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="audit-summary">
        <div className="summary-card">
          <div className="summary-icon"><IcoBarChart /></div>
          <div className="summary-content">
            <div className="summary-value">{totalCount}</div>
            <div className="summary-label">Total Events</div>
          </div>
        </div>
        {Object.entries(actionCounts).map(([action, count]) => (
          <div key={action} className="summary-card">
            <div className="summary-icon">{getSummaryIcon(action)}</div>
            <div className="summary-content">
              <div className="summary-value">{count}</div>
              <div className="summary-label">{action.replace(/_/g, ' ')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="audit-filters">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <IcoSearch /> Filters
        </h3>
        <div className="filter-grid">
          <div className="filter-group">
            <label>Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Action Type</label>
            <select value={filters.action} onChange={(e) => handleFilterChange('action', e.target.value)}>
              <option value="">All Actions</option>
              <option value="REGISTER_CASE">Register Case</option>
              <option value="UPLOAD_IMAGE">Upload Image</option>
              <option value="EDIT_PATIENT">Edit Patient</option>
              <option value="VALIDATION_PASS">Validation Pass</option>
              <option value="VALIDATION_FAIL">Validation Fail</option>
              <option value="RESOLVE_FAILURE">Resolve Failure</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Stage</label>
            <select value={filters.stage} onChange={(e) => handleFilterChange('stage', e.target.value)}>
              <option value="">All Stages</option>
              <option value="label_validation">Label Validation</option>
              <option value="oocyte_collection">Oocyte Collection</option>
              <option value="denudation">Denudation</option>
              <option value="male_sample_collection">Male Sample Collection</option>
              <option value="icsi">ICSI</option>
              <option value="culture">Culture</option>
            </select>
          </div>
          <div className="filter-group">
            <label>User Email</label>
            <input type="text" placeholder="Search by email..." value={filters.userEmail} onChange={(e) => handleFilterChange('userEmail', e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Session ID</label>
            <input type="text" placeholder="Search by session..." value={filters.sessionId} onChange={(e) => handleFilterChange('sessionId', e.target.value)} />
          </div>
        </div>
        <div className="filter-actions">
          <button onClick={handleApplyFilters} className="btn-primary">Apply Filters</button>
          <button onClick={handleClearFilters} className="btn-secondary">Clear Filters</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Audit Logs Table */}
      <div className="audit-logs-section">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <IcoList /> Audit Events ({logs.length})
        </h3>
        {logs.length === 0 ? (
          <div className="no-logs">
            <p>No audit logs found for the selected filters.</p>
          </div>
        ) : (
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Stage</th>
                  <th>User</th>
                  <th>Session ID</th>
                  <th>LLM Result</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.auditId || log.audit_id || index}>
                    <td className="timestamp-cell">{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <span className="action-badge" style={{ backgroundColor: getActionBadgeColor(log.action) }}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="stage-cell">
                      {log.stage ? <code>{log.stage.replace(/_/g, ' ')}</code> : <span style={{ color: '#999' }}>-</span>}
                    </td>
                    <td className="user-cell">
                      <div className="user-name">{log.user_name || log.userName || 'Unknown'}</div>
                      <div className="user-email">{log.user_email || log.userEmail || 'N/A'}</div>
                    </td>
                    <td className="session-cell">
                      <code>{log.session_id || log.sessionId || 'N/A'}</code>
                    </td>
                    <td className="llm-result-cell" style={{ textAlign: 'center' }}>
                      {log.action === 'VALIDATION_PASS' ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#4caf50" stroke="#4caf50" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                          </svg>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#4caf50', letterSpacing: '0.5px' }}>SUCCESS</span>
                        </div>
                      ) : log.action === 'VALIDATION_FAIL' ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#f44336" stroke="#f44336" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                          </svg>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#f44336', letterSpacing: '0.5px' }}>FAILURE</span>
                        </div>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '1rem' }}>—</span>
                      )}
                    </td>
                    <td className="details-cell">
                      {formatDetails(log.details || log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLog;
