/**
 * Validation Metrics — analytics dashboard showing failure rates, resolution tracking, and export.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

function Metrics({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState(null);
  const [filters, setFilters] = useState({
    stage: 'all',
    status: 'all',
    dateRange: '30', // days
    customStartDate: '',
    customEndDate: ''
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, [filters]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.getMetrics(filters);
      setMetricsData(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.exportMetrics(filters);
      // Create CSV and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-failures-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data');
    }
  };

  const handleDateRangeChange = (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      setFilters({...filters, dateRange: value, customStartDate: '', customEndDate: ''});
    }
  };

  const handleCustomDateApply = () => {
    if (filters.customStartDate && filters.customEndDate) {
      setFilters({...filters, dateRange: 'custom'});
      setShowCustomDatePicker(false);
    } else {
      alert('Please select both start and end dates');
    }
  };

  if (loading) {
    return (
      <div className="metrics-container">
        <div className="loading-spinner">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Loading..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="metrics-container">
        <div className="error-message">Failed to load metrics data</div>
      </div>
    );
  }

  const { overview, byStage, byReason, byResolution, failures } = metricsData;

  return (
    <div className="metrics-container">
      <div className="metrics-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
          <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Validation Metrics Dashboard
          </h1>
        </div>
        <button onClick={handleExport} className="btn-export" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export to CSV
        </button>
      </div>

      {/* Overview Cards */}
      <div className="metrics-overview">
        <div className="metric-card">
          <div className="metric-value">{overview.total}</div>
          <div className="metric-label">Total Failures</div>
        </div>
        <div className="metric-card active">
          <div className="metric-value">{overview.active}</div>
          <div className="metric-label">Active Failures</div>
        </div>
        <div className="metric-card resolved">
          <div className="metric-value">{overview.resolved}</div>
          <div className="metric-label">Resolved</div>
        </div>
        <div className="metric-card rate">
          <div className="metric-value">{overview.failureRate}%</div>
          <div className="metric-label">Failure Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="metrics-filters">
        <div className="filter-group">
          <label>Stage:</label>
          <select value={filters.stage} onChange={(e) => setFilters({...filters, stage: e.target.value})}>
            <option value="all">All Stages</option>
            <option value="label_validation">Patient Verification</option>
            <option value="oocyte_collection">Oocyte Collection</option>
            <option value="denudation">Oocyte Impression</option>
            <option value="male_sample_collection">Sperm Preparation</option>
            <option value="icsi">ICSI/IVF</option>
            <option value="fertilization_check">Fertilization Check (Day 1)</option>
            <option value="icsi_documentation">Cleavage (Day 3)</option>
            <option value="blastocyst">Blastocyst (Day 5/6)</option>
            <option value="culture">Frozen Embryo Transfer (FET)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Date Range:</label>
          <select value={filters.dateRange} onChange={handleDateRangeChange}>
            <optgroup label="Minutes">
              <option value="0.25">Last 15 Minutes</option>
              <option value="0.5">Last 30 Minutes</option>
            </optgroup>
            <optgroup label="Hours">
              <option value="0.042">Last 1 Hour</option>
              <option value="0.25">Last 6 Hours</option>
              <option value="0.5">Last 12 Hours</option>
              <option value="1">Last 24 Hours</option>
            </optgroup>
            <optgroup label="Days">
              <option value="3">Last 3 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
            </optgroup>
            <optgroup label="Other">
              <option value="all">All Time</option>
              <option value="custom">Custom Range...</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {showCustomDatePicker && (
        <div className="custom-date-picker">
          <div className="date-picker-inputs">
            <div className="date-input-group">
              <label>Start Date:</label>
              <input 
                type="datetime-local" 
                value={filters.customStartDate}
                onChange={(e) => setFilters({...filters, customStartDate: e.target.value})}
              />
            </div>
            <div className="date-input-group">
              <label>End Date:</label>
              <input 
                type="datetime-local" 
                value={filters.customEndDate}
                onChange={(e) => setFilters({...filters, customEndDate: e.target.value})}
              />
            </div>
            <button onClick={handleCustomDateApply} className="btn-apply-dates">
              Apply
            </button>
            <button onClick={() => setShowCustomDatePicker(false)} className="btn-cancel-dates">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="metrics-charts">
        {/* Failures by Stage */}
        <div className="chart-container">
          <h3>Failures by Stage</h3>
          <div className="bar-chart">
            {byStage.map((item, idx) => (
              <div key={idx} className="bar-item">
                <div className="bar-label">{item.stage}</div>
                <div className="bar-wrapper">
                  <div 
                    className="bar-fill" 
                    style={{width: `${(item.count / Math.max(...byStage.map(s => s.count))) * 100}%`}}
                  >
                    <span className="bar-value">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Mismatch Reasons */}
        <div className="chart-container">
          <h3>Top Mismatch Reasons</h3>
          <div className="pie-chart-legend">
            {byReason.map((item, idx) => (
              <div key={idx} className="legend-item">
                <span className="legend-color" style={{backgroundColor: getColor(idx)}}></span>
                <span className="legend-label">{item.reason}</span>
                <span className="legend-value">{item.count} ({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Categories */}
        <div className="chart-container">
          <h3>Resolution Methods</h3>
          <div className="bar-chart">
            {byResolution.map((item, idx) => (
              <div key={idx} className="bar-item">
                <div className="bar-label">{item.category}</div>
                <div className="bar-wrapper">
                  <div 
                    className="bar-fill resolution" 
                    style={{width: `${(item.count / Math.max(...byResolution.map(r => r.count))) * 100}%`}}
                  >
                    <span className="bar-value">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Failed Sessions Table */}
      <div className="metrics-table-container">
        <h3>Failed Validations</h3>
        <div className="table-wrapper">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Date/Time</th>
                <th>Stage</th>
                <th>Mismatch Reason</th>
                <th>Status</th>
                <th>Resolution Time</th>
                <th>Resolution Method</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure, idx) => (
                <tr key={idx}>
                  <td className="session-id">{failure.sessionId.substring(0, 8)}...</td>
                  <td>{new Date(failure.failed_at).toLocaleString()}</td>
                  <td>{formatStage(failure.stage)}</td>
                  <td>{failure.primary_mismatch_reason}</td>
                  <td>
                    <span className={`status-badge ${failure.status}`}>
                      {failure.status === 'resolved' ? (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'3px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Resolved</>
                      ) : (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'3px'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Active</>
                      )}
                    </span>
                  </td>
                  <td>
                    {failure.resolution_time_minutes !== undefined 
                      ? `${failure.resolution_time_minutes} min` 
                      : '-'}
                  </td>
                  <td>{failure.resolution_category || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getColor(index) {
  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
  return colors[index % colors.length];
}

function formatStage(stage) {
  const names = {
    'label_validation': 'Patient Verification',
    'oocyte_collection': 'Oocyte Collection',
    'denudation': 'Oocyte Impression',
    'male_sample_collection': 'Sperm Preparation',
    'icsi': 'ICSI/IVF',
    'fertilization_check': 'Fertilization Check',
    'icsi_documentation': 'Cleavage (Day 3)',
    'blastocyst': 'Blastocyst (Day 5/6)',
    'culture': 'FET',
  };
  return names[stage] || stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default Metrics;
