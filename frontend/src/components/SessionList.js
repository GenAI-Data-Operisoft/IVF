/**
 * Session List — searchable list of all IVF witness capture sessions.
 * Non-admin users see only cases from their assigned centers.
 * Admin can filter by center.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

const CENTERS = [
  'Cloudnine Hospital Malleswaram',
  'Cloudnine Hospital Malad',
  'Cloudnine Hospital Ludhiana',
];

function SessionList({ onSelectSession, onStartNew, onBack, user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [centerFilter, setCenterFilter] = useState('');

  const isAdmin = user?.role === 'admin';
  const userCenter = user?.centers?.[0] || '';

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerFilter]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.listSessions(50, userCenter, isAdmin, centerFilter);
      setSessions(data.sessions || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) { loadSessions(); return; }
    setSearching(true);
    try {
      const data = await api.searchSessions(searchQuery, userCenter, isAdmin, centerFilter);
      setSessions(data.sessions || []);
    } catch (error) {
    } finally {
      setSearching(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
      case 'failed': return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
      case 'in_progress': return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
      default: return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/></svg>;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'failed': return '#f44336';
      case 'in_progress': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  return (
    <div className="session-list">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 style={{ margin: 0 }}>Previous Sessions</h2>
        {!isAdmin && userCenter && (
          <span style={{ marginLeft: '4px', background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
            {userCenter}
          </span>
        )}
      </div>

      <div className="search-section">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Search form */}
          <form onSubmit={handleSearch} className="search-form" style={{ flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              placeholder="Search by MPID, Patient Name, or Session ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn-primary" disabled={searching} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              {searching ? 'Searching...' : 'Search'}
            </button>
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); loadSessions(); }} className="btn-secondary">Clear</button>
            )}
          </form>

          {/* Center filter — admin only */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <select
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
                style={{ padding: '0.55rem 0.75rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', background: 'white', cursor: 'pointer', color: centerFilter ? '#1a202c' : '#94a3b8', minWidth: '220px' }}
              >
                <option value="">All Centers</option>
                {CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {centerFilter && (
                <button type="button" onClick={() => setCenterFilter('')} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Loading..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="no-sessions">
          <p>No sessions found.</p>
          {searchQuery && <p>Try a different search term.</p>}
          {centerFilter && <p>No cases for <strong>{centerFilter}</strong>.</p>}
        </div>
      ) : (
        <div className="sessions-grid">
          {sessions.map((session) => (
            <div key={session.sessionId} className="session-card" onClick={() => onSelectSession(session.sessionId)}>
              <div className="session-header">
                <span className="session-status-badge" style={{ backgroundColor: getStatusColor(session.overall_status) }}>
                  {getStatusIcon(session.overall_status)} {session.overall_status}
                </span>
                <span className="session-date">{new Date(session.procedure_start_date).toLocaleDateString()}</span>
              </div>

              {/* Center badge */}
              {session.center && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ background: '#f0f4ff', color: '#4338ca', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {session.center}
                  </span>
                </div>
              )}

              <div className="session-patients">
                <div className="patient-info-compact">
                  <strong>Male:</strong> {session.male_patient.name}
                  <br />
                  <span className="mpeid-badge">{session.male_patient.mpeid}</span>
                </div>
                <div className="patient-info-compact">
                  <strong>Female:</strong> {session.female_patient.name}
                  <br />
                  <span className="mpeid-badge">{session.female_patient.mpeid}</span>
                </div>
              </div>

              <div className="session-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(session.completed_stages / session.total_stages) * 100}%`, backgroundColor: getStatusColor(session.overall_status) }} />
                </div>
                <span className="progress-text">{session.completed_stages} / {session.total_stages} stages completed</span>
              </div>

              <div className="session-id-compact">
                Session: <code>{session.sessionId.substring(0, 8)}...</code>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="session-list-actions">
        <button onClick={onStartNew} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Start New Session
        </button>
      </div>
    </div>
  );
}

export default SessionList;
