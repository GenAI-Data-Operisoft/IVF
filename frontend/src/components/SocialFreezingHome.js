/**
 * SocialFreezingHome — Landing page for Social Embryo Freezing.
 * Two sections: Register New Case | View All Registered Cases
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SocialFreezingRegistration from './SocialFreezingRegistration';
import SocialFreezingCase from './SocialFreezingCase';

function SocialFreezingHome({ onBack, user }) {
  const [view, setView] = useState('home'); // 'home' | 'register' | 'cases' | 'case'
  const [sessionId, setSessionId] = useState(null);
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const loadCases = async () => {
    setLoadingCases(true);
    try {
      const data = await api.listSocialFreezingCases();
      setCases(data.cases || []);
    } catch { setCases([]); }
    finally { setLoadingCases(false); }
  };

  const handleRegistrationComplete = (newSessionId) => {
    setSessionId(newSessionId);
    setView('case');
    loadCases();
  };

  const handleSelectCase = (sid) => {
    setSessionId(sid);
    setView('case');
  };

  if (view === 'register') {
    return <SocialFreezingRegistration onComplete={handleRegistrationComplete} onBack={() => setView('home')} user={user} />;
  }

  if (view === 'case' && sessionId) {
    return <SocialFreezingCase sessionId={sessionId} onBack={() => { setView('home'); }} />;
  }

  if (view === 'cases') {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('home')} className="btn-secondary" style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a202c' }}>🧊 All Social Freezing Cases</h2>
        </div>

        {loadingCases ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>
        ) : cases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #e2e8f0' }}>
            No cases registered yet.
          </div>
        ) : (
          <div className="sessions-grid">
            {cases.map(c => {
              const status = c.stages?.label_validation?.status === 'completed' ? 'completed' : 'in_progress';
              const statusColor = status === 'completed' ? '#4caf50' : '#ff9800';
              return (
                <div key={c.sessionId} className="session-card" onClick={() => handleSelectCase(c.sessionId)}>
                  <div className="session-header">
                    <span className="session-status-badge" style={{ backgroundColor: statusColor }}>
                      {status === 'completed' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      )}
                      {status === 'completed' ? 'verified' : 'in_progress'}
                    </span>
                    <span className="session-date">{c.procedure_start_date ? new Date(c.procedure_start_date).toLocaleDateString() : ''}</span>
                  </div>

                  {c.center && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ background: '#f0f4ff', color: '#4338ca', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {c.center}
                      </span>
                    </div>
                  )}

                  <div className="session-patients">
                    <div className="patient-info-compact">
                      <strong>Female:</strong> {c.female_patient?.name || 'N/A'}
                      <br />
                      <span className="mpeid-badge">{c.female_patient?.mpeid || ''}</span>
                    </div>
                  </div>

                  {c.doctor_name && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>
                      Dr. {c.doctor_name}
                    </div>
                  )}

                  <div className="session-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${c.completed_stages && c.total_stages ? (c.completed_stages / c.total_stages) * 100 : 0}%`, backgroundColor: statusColor }} />
                    </div>
                    <span className="progress-text">{c.completed_stages || 0} / {c.total_stages || 2} stages completed</span>
                  </div>

                  <div className="session-id-compact">
                    Session: <code>{c.sessionId.substring(0, 8)}...</code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Home view
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Home
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1a202c' }}>🧊 Social Embryo Freezing</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Embryo cryopreservation for future use</p>
        </div>
      </div>

      {/* Two action cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Register New Case */}
        <div onClick={() => setView('register')}
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '14px', padding: '1.75rem', cursor: 'pointer', color: 'white', boxShadow: '0 4px 15px rgba(102,126,234,0.4)', display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'transform 0.15s', userSelect: 'none' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>➕</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Register New Case</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', opacity: 0.85 }}>Start a new social embryo freezing case for a patient</p>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '1.5rem', opacity: 0.7 }}>→</div>
        </div>

        {/* View All Cases */}
        <div onClick={() => { loadCases(); setView('cases'); }}
          style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'border-color 0.15s', userSelect: 'none' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#667eea'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>📋</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1a202c' }}>View All Registered Cases</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>Search and manage existing social freezing cases</p>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
        </div>
      </div>
    </div>
  );
}

export default SocialFreezingHome;
