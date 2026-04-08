/**
 * Session List — searchable list of all IVF witness capture sessions, filterable by MPEID.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

function SessionList({ onSelectSession, onStartNew, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadSessions();
      return;
    }

    setSearching(true);
    try {
      const data = await api.searchSessions(searchQuery);
      setSessions(data.sessions || []);
    } catch (error) {
    } finally {
      setSearching(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
      case 'failed':
        return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
      case 'in_progress':
        return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
      default:
        return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/></svg>;
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h2 style={{ margin: 0 }}>Previous Sessions</h2>
      </div>
      
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by MPEID, Patient Name, or Session ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-primary" disabled={searching} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {searching ? 'Searching...' : 'Search'}
          </button>
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => { setSearchQuery(''); loadSessions(); }}
              className="btn-secondary"
            >
              Clear
            </button>
          )}
        </form>
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
        </div>
      ) : (
        <div className="sessions-grid">
          {sessions.map((session) => (
            <div 
              key={session.sessionId} 
              className="session-card"
              onClick={() => onSelectSession(session.sessionId)}
            >
              <div className="session-header">
                <span 
                  className="session-status-badge"
                  style={{ backgroundColor: getStatusColor(session.overall_status) }}
                >
                  {getStatusIcon(session.overall_status)} {session.overall_status}
                </span>
                <span className="session-date">
                  {new Date(session.procedure_start_date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="session-patients">
                <div className="patient-info-compact">
                  <strong>Male:</strong> {session.male_patient.name} {session.male_patient.last_name}
                  <br />
                  <span className="mpeid-badge">{session.male_patient.mpeid}</span>
                </div>
                <div className="patient-info-compact">
                  <strong>Female:</strong> {session.female_patient.name} {session.female_patient.last_name}
                  <br />
                  <span className="mpeid-badge">{session.female_patient.mpeid}</span>
                </div>
              </div>
              
              <div className="session-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${(session.completed_stages / session.total_stages) * 100}%`,
                      backgroundColor: getStatusColor(session.overall_status)
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  {session.completed_stages} / {session.total_stages} stages completed
                </span>
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
