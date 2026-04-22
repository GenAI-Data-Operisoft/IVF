import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import awsConfig from './aws-config';
import './App.css';
import { api } from './api';
import { STAGES } from './config';
import usePermissionStore from './store/permissionStore';
import Home from './components/Home';
import RegistrationForm from './components/RegistrationForm';
import StageCapture from './components/StageCapture';
import ICSIDocumentation from './components/ICSIDocumentation';
import OocyteImpression from './components/OocyteImpression';
import ICSIStage from './components/ICSIStage';
import FertilizationCheck from './components/FertilizationCheck';
import CleavageStage from './components/CleavageStage';
import BlastocystStage from './components/BlastocystStage';
import CaseStatus from './components/CaseStatus';
import SessionList from './components/SessionList';
import Metrics from './components/Metrics';
import Login from './components/Login';
import Signup from './components/Signup';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import Chatbot from './components/Chatbot';

// Configure Amplify
Amplify.configure(awsConfig);

function App() {
  const { canUseChatbot } = usePermissionStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home'); // home, registration, sessions, capture, status, metrics, auditlog
  const [sessionId, setSessionId] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    checkAuthStatus();
  }, []); // Only run once on mount

  const checkAuthStatus = async () => {
    try {
      const currentUser = await getCurrentUser();
      const { fetchAuthSession, fetchUserAttributes } = await import('aws-amplify/auth');

      // Force refresh to get latest Cognito attributes (picks up permission changes)
      await fetchAuthSession({ forceRefresh: true });
      // fetchUserAttributes after forceRefresh gets fresh data from Cognito
      const attributes = await fetchUserAttributes();

      const role = attributes['custom:role'] || 'viewer';

      // Parse custom permissions if set
      let rawPermissions = null;
      if (attributes['custom:permissions']) {
        try { rawPermissions = JSON.parse(attributes['custom:permissions']); } catch {}
      }

      // Populate Zustand permission store
      usePermissionStore.getState().setPermissions(role, rawPermissions);

      setUser({
        username: currentUser.username,
        email: attributes.email || currentUser.username,
        name: attributes.name || attributes.email || currentUser.username,
        role,
        department: attributes['custom:department'] || '',
        centers: (() => {
            try { return attributes['custom:centers'] ? JSON.parse(attributes['custom:centers']) : null; } catch { return null; }
          })(),
      });
      setIsAuthenticated(true);
    } catch (err) {
      // Only log errors that aren't "user not authenticated" (which is expected after logout)
      if (err.name !== 'UserUnAuthenticatedException') {
      }
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    // Load full user attributes first, then show dashboard
    await checkAuthStatus();
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    setLoading(true);
    try {
      // Sign out globally to clear all sessions
      await signOut({ global: true });
    } catch (err) {
    } finally {
      // Clear local state
      setIsAuthenticated(false);
      setUser(null);
      setSessionId(null);
      setCaseData(null);
      setCurrentView('home');
      usePermissionStore.getState().clearPermissions();
      setLoading(false);
      
      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Navigate to login (don't use window.location to avoid reload loop)
      window.location.replace('/login');
    }
  };

  const handleRegistrationComplete = async (registeredSessionId) => {
    setSessionId(registeredSessionId);
    const data = await api.getCase(registeredSessionId);
    setCaseData(data);
    // Show status overview instead of going directly to capture
    setCurrentView('status');
  };

  const handleStageComplete = async () => {
    // Refresh case data before moving to next stage
    const data = await api.getCase(sessionId);
    setCaseData(data);
    
    if (currentStageIndex < STAGES.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    } else {
      setCurrentView('status');
    }
  };

  const handleViewStatus = async () => {
    const data = await api.getCase(sessionId);
    setCaseData(data);
    setCurrentView('status');
  };

  const handleStartStage = async (stageId) => {
    // Refresh case data before starting stage
    const data = await api.getCase(sessionId);
    setCaseData(data);
    
    // Find the stage index from STAGES array
    const stageIndex = STAGES.findIndex(s => s.id === stageId);
    if (stageIndex !== -1) {
      setCurrentStageIndex(stageIndex);
      setCurrentView('capture');
    }
  };

  const handleStartOocyteImpression = async () => {
    const data = await api.getCase(sessionId);
    setCaseData(data);
    setCurrentView('oocyte-impression');
  };

  const handleViewSessions = () => {
    setCurrentView('sessions');
  };

  const handleViewMetrics = () => {
    setCurrentView('metrics');
  };

  const handleViewAuditLog = () => {
    setCurrentView('auditlog');
  };

  const handleViewUserManagement = () => {
    setCurrentView('usermanagement');
  };

  const handleStartCapture = () => {
    setCurrentView('registration');
  };

  const handleBackToHome = () => {
    setSessionId(null);
    setCaseData(null);
    setCurrentStageIndex(0);
    setCurrentView('home');
  };

  const handleSelectSession = async (selectedSessionId) => {
    setSessionId(selectedSessionId);
    const data = await api.getCase(selectedSessionId);
    setCaseData(data);
    setCurrentView('status');
  };

  const handleStartNewFromSessions = () => {
    setSessionId(null);
    setCaseData(null);
    setCurrentStageIndex(0);
    setCurrentView('registration');
  };

  // Helper function for role badge colors
  const getRoleBadgeColor = (role) => {
    const colors = {
      'admin': '#dc3545',
      'supervisor': '#fd7e14',
      'nurse': '#28a745',
      'viewer': '#6c757d'
    };
    return colors[role?.toLowerCase()] || '#6c757d';
  };

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h2>Loading...</h2>
          </div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    
    // User is authenticated, check auth status once
    if (isAuthenticated && !user) {
      checkAuthStatus();
    }
    
    return children;
  };

  // Main App Component (authenticated)
  const MainApp = () => {
    const initials = user?.name
      ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : '?';

    return (
    <div className="App">
      <header className="App-header">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%', 
          maxWidth: '1600px', 
          margin: '0 auto',
          padding: '0',
          gap: '20px'
        }}>
          {/* Logo */}
          <div style={{ cursor: 'pointer', flex: '0 0 auto' }} onClick={handleBackToHome}>
            <h1>
              <img
                src="https://d1nmtja0c4ok3x.cloudfront.net/cloudnine-logo.png"
                alt="Cloudnine Hospital"
                style={{ height: '42px', width: 'auto', objectFit: 'contain', verticalAlign: 'middle' }}
              />
            </h1>
          </div>
          
          {/* Right side */}
          <div className="header-right">
            {/* User info */}
            {user && (
              <div className="header-user-pill">
                {/* Avatar */}
                <div className="header-avatar">
                  {initials}
                </div>
                <div className="header-user-info">
                  <div className="header-user-name">{user.name}</div>
                  <div className="header-user-meta">
                    <span className="header-role-badge" style={{ background: getRoleBadgeColor(user.role) }}>
                      {user.role}
                    </span>
                    {user.centers?.[0] && (
                      <span className="header-dept" title={user.centers[0]}>
                        📍 {user.centers[0].replace('Cloudnine Hospital ', '')}
                      </span>
                    )}
                    {!user.centers?.[0] && user.department && (
                      <span className="header-dept">{user.department}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Home button */}
            {currentView !== 'home' && (
              <button onClick={handleBackToHome} className="btn-secondary header-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span className="header-btn-label">Home</span>
              </button>
            )}
            
            {/* Logout button */}
            <button onClick={handleLogout} className="header-logout-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="header-btn-label">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="App-main">
        {currentView === 'home' && (
          <Home
            onStartCapture={handleStartCapture}
            onViewSessions={handleViewSessions}
            onViewMetrics={handleViewMetrics}
            onViewAuditLog={handleViewAuditLog}
            onViewUserManagement={handleViewUserManagement}
            userRole={user?.role}
            user={user}
          />
        )}

        {currentView === 'registration' && (
          <RegistrationForm 
            onComplete={handleRegistrationComplete}
            onViewSessions={handleViewSessions}
            onBack={handleBackToHome}
            user={user}
          />
        )}

        {currentView === 'sessions' && (
          <SessionList
            onSelectSession={handleSelectSession}
            onStartNew={handleStartNewFromSessions}
            onBack={handleBackToHome}
            user={user}
          />
        )}

        {currentView === 'capture' && sessionId && (
          <>
            {STAGES[currentStageIndex].id === 'icsi_documentation' ? (
              <CleavageStage
                sessionId={sessionId}
                caseData={caseData}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            ) : STAGES[currentStageIndex].id === 'blastocyst' ? (
              <BlastocystStage
                sessionId={sessionId}
                caseData={caseData}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            ) : STAGES[currentStageIndex].id === 'fertilization_check' ? (
              <FertilizationCheck
                sessionId={sessionId}
                caseData={caseData}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            ) : STAGES[currentStageIndex].id === 'denudation' ? (
              <OocyteImpression
                sessionId={sessionId}
                caseData={caseData}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            ) : STAGES[currentStageIndex].id === 'icsi' ? (
              <ICSIStage
                sessionId={sessionId}
                caseData={caseData}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            ) : (
              <StageCapture
                sessionId={sessionId}
                caseData={caseData}
                stage={STAGES[currentStageIndex]}
                onComplete={handleStageComplete}
                onViewStatus={handleViewStatus}
              />
            )}
          </>
        )}

        {currentView === 'oocyte-impression' && sessionId && (
          <OocyteImpression
            sessionId={sessionId}
            caseData={caseData}
            onComplete={handleViewStatus}
            onViewStatus={handleViewStatus}
          />
        )}

        {currentView === 'status' && sessionId && (
          <CaseStatus
            sessionId={sessionId}
            caseData={caseData}
            userRole={user?.role}
            onBack={user?.role === 'viewer' ? () => setCurrentView('sessions') : handleBackToHome}
            onStartNew={() => {
              setSessionId(null);
              setCaseData(null);
              setCurrentStageIndex(0);
              setCurrentView('registration');
            }}
            onStartStage={handleStartStage}
            onStartOocyteImpression={handleStartOocyteImpression}
          />
        )}

        {currentView === 'metrics' && (
          <Metrics onBack={handleBackToHome} />
        )}

        {currentView === 'auditlog' && (
          <AuditLog onBack={handleBackToHome} />
        )}

        {currentView === 'usermanagement' && (
          <UserManagement onBack={handleBackToHome} />
        )}
      </main>

      {/* Chatbot hidden — {canUseChatbot() && <Chatbot />} */}

      <footer className="App-footer">
        <p>© 2026 Cloudnine Hospital — Fertility Management System</p>
      </footer>
    </div>
    );
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/signup" element={<Signup />} />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;