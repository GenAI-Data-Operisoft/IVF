/**
 * Home screen — displays the 4 main navigation cards based on user role permissions.
 */
import React from 'react';
import usePermissionStore from '../store/permissionStore';

function Home({ onStartCapture, onViewSessions, onViewMetrics, onViewAuditLog, onViewUserManagement, userRole }) {
  const { canView, canEdit } = usePermissionStore();

  const canStartCapture  = canEdit('ivfCapture');
  const canViewSessions  = canView('sessions');
  const canViewMetrics   = canView('metrics');
  const canViewAuditLog  = canView('auditLog');
  const canManageUsers   = canView('userMgmt');

  return (
    <div className="home-screen">

      <div className="home-content">

        <p className="home-welcome">Fertility Management System</p>

        <div className="home-title-row">
          <h1 className="home-title">IVF Witness Capture</h1>
          <img
            src="https://d1nmtja0c4ok3x.cloudfront.net/hoempagebaby.png"
            alt="baby"
            className="home-baby-float"
          />
        </div>
        <p className="home-subtitle">Select an option below to get started</p>

        <div className="home-options">

          {canStartCapture && (
          <div className="home-card" onClick={onStartCapture}>
            <div className="home-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="32" cy="34" r="10"/>
                <path d="M22 18h-4a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h28a4 4 0 0 0 4-4V22a4 4 0 0 0-4-4h-4l-4-6H26l-4 6z"/>
                <circle cx="32" cy="34" r="4" fill="#667eea" stroke="none"/>
              </svg>
            </div>
            <h2>Start IVF Witness Capture</h2>
            <p>Register a new case and begin validation process</p>
            <div className="home-card-features">
              <span>✓ Patient Registration</span>
              <span>✓ Stage Validation</span>
              <span>✓ ICSI Documentation</span>
            </div>
          </div>
          )}

          {canViewSessions && (
          <div className="home-card" onClick={onViewSessions}>
            <div className="home-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="10" y="8" width="44" height="52" rx="4"/>
                <line x1="20" y1="22" x2="44" y2="22"/>
                <line x1="20" y1="32" x2="44" y2="32"/>
                <line x1="20" y1="42" x2="34" y2="42"/>
                <circle cx="42" cy="46" r="6"/>
                <line x1="46.2" y1="50.2" x2="52" y2="56"/>
              </svg>
            </div>
            <h2>View Witness Captures</h2>
            <p>Search and review previous validation sessions</p>
            <div className="home-card-features">
              <span>✓ Session History</span>
              <span>✓ Search by MPEID</span>
              <span>✓ View Details</span>
            </div>
          </div>
          )}

          {canViewMetrics && (
          <div className="home-card" onClick={onViewMetrics}>
            <div className="home-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="36" width="10" height="18" rx="2" fill="#667eea" fillOpacity="0.15"/>
                <rect x="22" y="24" width="10" height="30" rx="2" fill="#667eea" fillOpacity="0.15"/>
                <rect x="36" y="14" width="10" height="40" rx="2" fill="#667eea" fillOpacity="0.15"/>
                <rect x="8" y="36" width="10" height="18" rx="2"/>
                <rect x="22" y="24" width="10" height="30" rx="2"/>
                <rect x="36" y="14" width="10" height="40" rx="2"/>
                <line x1="6" y1="54" x2="58" y2="54"/>
              </svg>
            </div>
            <h2>Validation Metrics</h2>
            <p>View analytics and failure reports</p>
            <div className="home-card-features">
              <span>✓ Failure Analytics</span>
              <span>✓ Resolution Tracking</span>
              <span>✓ Export Reports</span>
            </div>
          </div>
          )}

          {canViewAuditLog && (
            <div className="home-card" onClick={onViewAuditLog}>
              <div className="home-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M32 8a24 24 0 1 1 0 48A24 24 0 0 1 32 8z"/>
                  <line x1="32" y1="28" x2="32" y2="44"/>
                  <circle cx="32" cy="22" r="2" fill="#667eea" stroke="none"/>
                </svg>
              </div>
              <h2>Audit Log</h2>
              <p>View system activity and compliance logs</p>
              <div className="home-card-features">
                <span>✓ Activity Tracking</span>
                <span>✓ User Actions</span>
                <span>✓ Export Logs</span>
              </div>
            </div>
          )}

          {canManageUsers && (
            <div className="home-card" onClick={onViewUserManagement}>
              <div className="home-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M40 42v-4a8 8 0 0 0-8-8H16a8 8 0 0 0-8 8v4"/>
                  <circle cx="24" cy="22" r="8"/>
                  <path d="M56 42v-4a8 8 0 0 0-6-7.74"/>
                  <path d="M42 10.26a8 8 0 0 1 0 15.48"/>
                </svg>
              </div>
              <h2>User Management</h2>
              <p>Create, manage and assign roles to staff</p>
              <div className="home-card-features">
                <span>✓ Create Users</span>
                <span>✓ Assign Roles</span>
                <span>✓ Manage Access</span>
              </div>
            </div>
          )}

        </div>

        <div className="home-footer">
          <p>© 2026 Cloudnine Hospital — Fertility Management System</p>
        </div>

      </div>
    </div>
  );
}

export default Home;
