/**
 * User Management — create, edit, and assign roles to staff users. Admin only.
 */
import { useState, useEffect } from 'react';
import { api } from '../api';

const ROLES = ['admin', 'supervisor', 'viewer'];
const DEPARTMENTS = ['IVF Lab', 'Embryology', 'Nursing', 'Administration', 'IT', 'Other'];
const CENTERS = [
  'Cloudnine Hospital Malleswaram',
  'Cloudnine Hospital Malad',
  'Cloudnine Hospital Ludhiana',
];

// Module permission matrix — each module has view + edit
const MODULES = [
  { key: 'ivfCapture', label: 'IVF Witness Capture',   desc: 'Register cases & upload images' },
  { key: 'sessions',   label: 'View Witness Captures',  desc: 'Browse & search sessions' },
  { key: 'metrics',    label: 'Validation Metrics',     desc: 'Analytics & failure reports',    viewOnly: true },
  { key: 'auditLog',   label: 'Audit Log',              desc: 'System activity & compliance',   viewOnly: true },
  { key: 'userMgmt',   label: 'User Management',        desc: 'Create & manage users' },
];

const ROLE_MODULE_DEFAULTS = {
  admin:      { ivfCapture:{view:true,edit:true},  sessions:{view:true,edit:true},  metrics:{view:true,edit:true},  auditLog:{view:true,edit:true},  userMgmt:{view:true,edit:true}  },
  supervisor: { ivfCapture:{view:true,edit:true},  sessions:{view:true,edit:true},  metrics:{view:true,edit:true},  auditLog:{view:false,edit:false}, userMgmt:{view:false,edit:false} },
  viewer:     { ivfCapture:{view:false,edit:false}, sessions:{view:true,edit:false}, metrics:{view:false,edit:false}, auditLog:{view:false,edit:false}, userMgmt:{view:false,edit:false} },
};

// Legacy flat permissions for existing Perms modal
const PERMISSIONS = {
  admin:      { createCase: true,  processStages: true,  viewSessions: true,  viewMetrics: true,  viewAuditLog: true,  manageUsers: true  },
  supervisor: { createCase: true,  processStages: true,  viewSessions: true,  viewMetrics: true,  viewAuditLog: false, manageUsers: false },
  viewer:     { createCase: false, processStages: false, viewSessions: true,  viewMetrics: false, viewAuditLog: false, manageUsers: false },
};
const PERM_LABELS = {
  createCase:'Create Cases', processStages:'Process Stages', viewSessions:'View Sessions',
  viewMetrics:'View Metrics', viewAuditLog:'View Audit Log', manageUsers:'Manage Users',
};

const roleColor = (role) => ({ admin:'#dc3545', supervisor:'#fd7e14', viewer:'#6c757d' }[role] || '#6c757d');

const IcoUsers  = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoPlus   = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit   = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoTrash  = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcoShield = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoBack   = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IcoCheck  = () => <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoXIcon  = () => <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ── Custom Role Storage (localStorage) ───────────────────────────────────
const CUSTOM_ROLES_KEY = 'ivf_custom_roles';

function loadCustomRoles() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_ROLES_KEY) || '[]'); } catch { return []; }
}
function saveCustomRoles(roles) {
  localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(roles));
}

// ── Create Custom Role Modal ──────────────────────────────────────────────
function CreateRoleModal({ onClose, onCreated }) {
  const [roleName, setRoleName] = useState('');
  const [modulePerms, setModulePerms] = useState({
    ivfCapture: { view: false, edit: false },
    sessions:   { view: false, edit: false },
    metrics:    { view: false, edit: false },
    auditLog:   { view: false, edit: false },
    userMgmt:   { view: false, edit: false },
  });
  const [error, setError] = useState('');

  const togglePerm = (moduleKey, type) => {
    setModulePerms(p => {
      const updated = { ...p, [moduleKey]: { ...p[moduleKey], [type]: !p[moduleKey][type] } };
      if (type === 'edit' && updated[moduleKey].edit) updated[moduleKey].view = true;
      if (type === 'view' && !updated[moduleKey].view) updated[moduleKey].edit = false;
      return updated;
    });
  };

  const handleSave = () => {
    const name = roleName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) { setError('Role name is required'); return; }
    const existing = loadCustomRoles();
    if (existing.find(r => r.key === name)) { setError('A role with this name already exists'); return; }
    const newRole = { key: name, label: roleName.trim(), modulePerms };
    saveCustomRoles([...existing, newRole]);
    onCreated(newRole);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001, padding:'1rem' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'520px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontWeight:700, color:'#1a202c', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <IcoShield /> Create Custom Role
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding:'1.5rem 2rem' }}>
          {error && <div style={{ background:'#ffebee', color:'#c62828', padding:'0.6rem 0.9rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.85rem' }}>{error}</div>}
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>Role Name *</label>
            <input type="text" placeholder="e.g. Doctor, Lab Staff, Coordinator" value={roleName}
              onChange={e => setRoleName(e.target.value)}
              style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }} />
            <p style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.3rem' }}>This will appear as a base role option when creating users.</p>
          </div>
          <p style={{ fontSize:'0.82rem', color:'#64748b', marginBottom:'0.75rem' }}>
            Set default permissions for this role. <strong>View</strong> = read-only. <strong>Edit</strong> = full access.
          </p>
          <div style={{ border:'1px solid #e2e8f0', borderRadius:'10px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  <th style={{ padding:'0.7rem 1rem', textAlign:'left', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0' }}>Module</th>
                  <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>View</th>
                  <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod, i) => {
                  const p = modulePerms[mod.key];
                  return (
                    <tr key={mod.key} style={{ background: i%2===0 ? 'white' : '#fafbff', borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#1a202c' }}>{mod.label}</div>
                        <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{mod.desc}</div>
                      </td>
                      <td style={{ textAlign:'center', padding:'0.75rem' }}>
                        <input type="checkbox" checked={p.view} onChange={() => togglePerm(mod.key,'view')}
                          style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                      </td>
                      <td style={{ textAlign:'center', padding:'0.75rem' }}>
                        {mod.viewOnly ? (
                          <span style={{ fontSize:'0.72rem', color:'#94a3b8', fontStyle:'italic' }}>View only</span>
                        ) : (
                          <input type="checkbox" checked={p.edit} onChange={() => togglePerm(mod.key,'edit')}
                            style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding:'1rem 2rem 1.5rem', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
            <IcoShield /> Save Role
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Manage Roles Modal ────────────────────────────────────────────────────
function ManageRolesModal({ onClose, users }) {
  const [roles, setRoles] = useState(() => loadCustomRoles());
  const [editingRole, setEditingRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // role key

  const handleDelete = async (roleKey) => {
    const affected = users.filter(u => u.role === roleKey);
    for (const u of affected) {
      try { await api.updateUser(u.username, { role: 'viewer', permissions: {} }); } catch {}
    }
    const updated = roles.filter(r => r.key !== roleKey);
    saveCustomRoles(updated);
    setRoles(updated);
    setConfirmDelete(null);
  };

  if (editingRole) {
    return (
      <EditRoleModal
        role={editingRole}
        onClose={() => setEditingRole(null)}
        onSaved={(updated) => {
          const newRoles = roles.map(r => r.key === updated.key ? updated : r);
          saveCustomRoles(newRoles);
          setRoles(newRoles);
          setEditingRole(null);
        }}
      />
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001, padding:'1rem' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'540px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontWeight:700, color:'#1a202c', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <IcoShield /> Manage Roles
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding:'1.5rem 2rem' }}>
          {roles.length === 0 ? (
            <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem 0' }}>No custom roles created yet.</p>
          ) : roles.map(role => {
            const affected = users.filter(u => u.role === role.key);
            const isConfirming = confirmDelete === role.key;
            return (
              <div key={role.key} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'1rem', marginBottom:'0.75rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontWeight:700, color:'#1a202c', fontSize:'0.95rem' }}>{role.label}</span>
                    <span style={{ marginLeft:'8px', fontSize:'0.75rem', color:'#94a3b8' }}>({role.key})</span>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setEditingRole(role)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.8rem', color:'#475569' }}>
                      <IcoEdit /> Edit
                    </button>
                    <button onClick={() => setConfirmDelete(isConfirming ? null : role.key)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fecdd3', background:'#fff1f2', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.8rem', color:'#e11d48' }}>
                      <IcoTrash /> Delete
                    </button>
                  </div>
                </div>
                {isConfirming && (
                  <div style={{ marginTop:'0.75rem', background:'#fff8e1', border:'1px solid #ffe082', borderRadius:'8px', padding:'0.75rem 1rem' }}>
                    <p style={{ margin:'0 0 0.5rem', fontSize:'0.85rem', color:'#7c4a00' }}>
                      ⚠️ {affected.length} user(s) are assigned this role. Deleting will remove their custom permissions. Are you sure?
                    </p>
                    {affected.length > 0 && (
                      <ul style={{ margin:'0 0 0.5rem', paddingLeft:'1.2rem', fontSize:'0.82rem', color:'#7c4a00' }}>
                        {affected.map(u => <li key={u.username}>{u.name || u.email}</li>)}
                      </ul>
                    )}
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => handleDelete(role.key)} style={{ padding:'4px 12px', borderRadius:'6px', background:'#e11d48', color:'white', border:'none', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>
                        Yes, Delete
                      </button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding:'4px 12px', borderRadius:'6px', background:'white', color:'#475569', border:'1px solid #e2e8f0', cursor:'pointer', fontSize:'0.82rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding:'1rem 2rem 1.5rem', textAlign:'right' }}>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Role Modal (pre-filled) ──────────────────────────────────────────
function EditRoleModal({ role, onClose, onSaved }) {
  const [roleName, setRoleName] = useState(role.label);
  const [modulePerms, setModulePerms] = useState({ ...role.modulePerms });
  const [error, setError] = useState('');

  const togglePerm = (moduleKey, type) => {
    setModulePerms(p => {
      const updated = { ...p, [moduleKey]: { ...p[moduleKey], [type]: !p[moduleKey][type] } };
      if (type === 'edit' && updated[moduleKey].edit) updated[moduleKey].view = true;
      if (type === 'view' && !updated[moduleKey].view) updated[moduleKey].edit = false;
      return updated;
    });
  };

  const handleSave = () => {
    const name = roleName.trim();
    if (!name) { setError('Role name is required'); return; }
    onSaved({ ...role, label: name, modulePerms });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1002, padding:'1rem' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'520px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontWeight:700, color:'#1a202c', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <IcoEdit /> Edit Role: {role.label}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding:'1.5rem 2rem' }}>
          {error && <div style={{ background:'#ffebee', color:'#c62828', padding:'0.6rem 0.9rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.85rem' }}>{error}</div>}
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>Role Name *</label>
            <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)}
              style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ border:'1px solid #e2e8f0', borderRadius:'10px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  <th style={{ padding:'0.7rem 1rem', textAlign:'left', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0' }}>Module</th>
                  <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>View</th>
                  <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod, i) => {
                  const p = modulePerms[mod.key] || { view:false, edit:false };
                  return (
                    <tr key={mod.key} style={{ background: i%2===0 ? 'white' : '#fafbff', borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#1a202c' }}>{mod.label}</div>
                        <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{mod.desc}</div>
                      </td>
                      <td style={{ textAlign:'center', padding:'0.75rem' }}>
                        <input type="checkbox" checked={p.view} onChange={() => togglePerm(mod.key,'view')}
                          style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                      </td>
                      <td style={{ textAlign:'center', padding:'0.75rem' }}>
                        {mod.viewOnly ? (
                          <span style={{ fontSize:'0.72rem', color:'#94a3b8', fontStyle:'italic' }}>View only</span>
                        ) : (
                          <input type="checkbox" checked={p.edit} onChange={() => togglePerm(mod.key,'edit')}
                            style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding:'1rem 2rem 1.5rem', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
            <IcoEdit /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:'', email:'', role:'viewer', department:'', temporaryPassword:'IVFTemp123!' });
  const [modulePerms, setModulePerms] = useState({ ...ROLE_MODULE_DEFAULTS['viewer'] });
  const [selectedCenters, setSelectedCenters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customRoles] = useState(() => loadCustomRoles());

  const allRoles = [
    ...ROLES.map(r => ({ key: r, label: r, isCustom: false })),
    ...customRoles.map(r => ({ key: r.key, label: r.label, isCustom: true, modulePerms: r.modulePerms }))
  ];

  const handleRoleChange = (roleKey, customModulePerms) => {
    setForm(f => ({ ...f, role: roleKey }));
    if (customModulePerms) {
      setModulePerms({ ...customModulePerms });
    } else {
      setModulePerms({ ...(ROLE_MODULE_DEFAULTS[roleKey] || ROLE_MODULE_DEFAULTS['viewer']) });
    }
  };

  const togglePerm = (moduleKey, type) => {
    setModulePerms(p => {
      const updated = { ...p, [moduleKey]: { ...p[moduleKey], [type]: !p[moduleKey][type] } };
      if (type === 'edit' && updated[moduleKey].edit) updated[moduleKey].view = true;
      if (type === 'view' && !updated[moduleKey].view) updated[moduleKey].edit = false;
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return; }
    if (selectedCenters.length === 0) { setError('Please select a hospital center'); return; }
    const pwd = form.temporaryPassword;
    if (!pwd || pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      setError('Temporary password must be at least 8 characters with uppercase, lowercase and a number (e.g. IVFTemp123!)');
      return;
    }
    setSaving(true);
    try {
      const flatPerms = {
        createCase:    modulePerms.ivfCapture?.edit  ?? false,
        processStages: modulePerms.ivfCapture?.edit  ?? false,
        viewSessions:  modulePerms.sessions?.view    ?? false,
        viewMetrics:   modulePerms.metrics?.view     ?? false,
        viewAuditLog:  modulePerms.auditLog?.view    ?? false,
        manageUsers:   modulePerms.userMgmt?.edit    ?? false,
      };
      await api.createUser({ ...form, permissions: flatPerms, modulePermissions: modulePerms, centers: selectedCenters });
      onCreated(`User ${form.email} created. Temp password: ${form.temporaryPassword}`);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'560px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <div>
            <h3 style={{ margin:0, fontWeight:700, color:'#1a202c', display:'inline-flex', alignItems:'center', gap:'8px' }}>
              <IcoPlus /> Create Custom User
            </h3>
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              {[1,2].map(s => (
                <div key={s} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'0.78rem', color: step >= s ? '#667eea' : '#94a3b8', fontWeight: step === s ? 700 : 400 }}>
                  <div style={{ width:'20px', height:'20px', borderRadius:'50%', background: step >= s ? '#667eea' : '#e2e8f0', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700 }}>{s}</div>
                  {s === 1 ? 'User Details' : 'Permissions'}
                  {s < 2 && <div style={{ width:'24px', height:'2px', background: step > s ? '#667eea' : '#e2e8f0', marginLeft:'4px' }} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        {/* Step 1: User Details */}
        {step === 1 && (
          <div style={{ padding:'1.5rem 2rem' }}>
            {error && <div style={{ background:'#ffebee', color:'#c62828', padding:'0.6rem 0.9rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.85rem' }}>{error}</div>}
            <div style={{ display:'grid', gap:'1rem' }}>
              {[['Full Name *','name','text','Dr. Jane Smith'],['Email *','email','email','jane@hospital.com']].map(([label,key,type,ph]) => (
                <div key={key}>
                  <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>{label}</label>
                  <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}
                    style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>Temporary Password</label>
                <input type="text" placeholder="IVFTemp123!" value={form.temporaryPassword} onChange={e => setForm({...form, temporaryPassword: e.target.value})}
                  style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }} />
                <p style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.3rem' }}>Min 8 chars, must include uppercase, lowercase and a number. e.g. IVFTemp123!</p>
              </div>
              <div>
                <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>Department</label>
                <select value={form.department} onChange={e => setForm({...form,department:e.target.value})}
                  style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none' }}>
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', marginBottom:'0.4rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>
                  Hospital Center <span style={{ color:'#e11d48' }}>*</span>
                </label>
                <select
                  value={selectedCenters[0] || ''}
                  onChange={e => setSelectedCenters(e.target.value ? [e.target.value] : [])}
                  style={{ width:'100%', padding:'0.6rem 0.75rem', border:'2px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none' }}
                >
                  <option value="">Select center...</option>
                  {CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.3rem' }}>User will only see cases from this center. Admin sees all centers.</p>
              </div>

              <div>
                <label style={{ display:'block', marginBottom:'0.6rem', fontWeight:600, fontSize:'0.85rem', color:'#374151' }}>Base Role</label>                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                  {allRoles.map(r => (
                    <button key={r.key} onClick={() => handleRoleChange(r.key, r.modulePerms)} style={{
                      padding:'0.5rem 0.9rem', borderRadius:'8px',
                      border:`2px solid ${form.role===r.key ? (r.isCustom ? '#667eea' : roleColor(r.key)) : '#e2e8f0'}`,
                      background: form.role===r.key ? (r.isCustom ? '#667eea' : roleColor(r.key)) : 'white',
                      color: form.role===r.key ? 'white' : '#374151',
                      fontWeight:600, fontSize:'0.82rem', cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s',
                      display:'inline-flex', alignItems:'center', gap:'4px'
                    }}>
                      {r.isCustom && <IcoShield />}
                      {r.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'0.4rem' }}>Base role sets default permissions. You can customize in the next step.</p>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'1.5rem' }}>
              <button onClick={() => { setError(''); if (!form.name||!form.email){setError('Name and email required');return;} setStep(2); }}
                className="btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                Next: Set Permissions →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Permission Matrix */}
        {step === 2 && (
          <div style={{ padding:'1.5rem 2rem' }}>
            {error && <div style={{ background:'#ffebee', color:'#c62828', padding:'0.6rem 0.9rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.85rem' }}>{error}</div>}

            {/* User summary */}
            <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'0.75rem 1rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:`linear-gradient(135deg, ${roleColor(form.role)}, #764ba2)`, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.8rem' }}>
                {(form.name||'?').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, color:'#1a202c', fontSize:'0.9rem' }}>{form.name}</div>
                <div style={{ fontSize:'0.78rem', color:'#64748b' }}>{form.email}</div>
              </div>
              <span style={{ marginLeft:'auto', background:roleColor(form.role), color:'white', padding:'2px 10px', borderRadius:'10px', fontSize:'0.75rem', fontWeight:700 }}>{form.role}</span>
            </div>

            <p style={{ fontSize:'0.82rem', color:'#64748b', marginBottom:'1rem' }}>
              Customize module access. <strong>View</strong> = read-only. <strong>Edit</strong> = full access (includes view).
            </p>

            {/* Permission matrix table */}
            <div style={{ border:'1px solid #e2e8f0', borderRadius:'10px', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'0.7rem 1rem', textAlign:'left', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0' }}>Module</th>
                    <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>View</th>
                    <th style={{ padding:'0.7rem 0.75rem', textAlign:'center', fontSize:'0.8rem', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', width:'80px' }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod, i) => {
                    const p = modulePerms[mod.key] || { view:false, edit:false };
                    return (
                      <tr key={mod.key} style={{ background: i%2===0 ? 'white' : '#fafbff', borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'0.75rem 1rem' }}>
                          <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#1a202c' }}>{mod.label}</div>
                          <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{mod.desc}</div>
                        </td>
                        <td style={{ textAlign:'center', padding:'0.75rem' }}>
                          <label style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                            <input type="checkbox" checked={p.view} onChange={() => togglePerm(mod.key,'view')}
                              style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                          </label>
                        </td>
                        <td style={{ textAlign:'center', padding:'0.75rem' }}>
                          {mod.viewOnly ? (
                            <span style={{ fontSize:'0.72rem', color:'#94a3b8', fontStyle:'italic' }}>View only</span>
                          ) : (
                            <label style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                              <input type="checkbox" checked={p.edit} onChange={() => togglePerm(mod.key,'edit')}
                                style={{ width:'17px', height:'17px', accentColor:'#667eea', cursor:'pointer' }} />
                            </label>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display:'flex', gap:'10px', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              <button onClick={handleCreate} className="btn-primary" disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                {saving ? 'Creating...' : <><IcoPlus /> Create User</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserManagement({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterRoles, setFilterRoles] = useState([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [showRoleFilter, setShowRoleFilter] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showManageRoles, setShowManageRoles] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [permUser, setPermUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'viewer', department: '', temporaryPassword: 'IVFTemp123!' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
    } catch (e) { setError('Failed to load users'); }
    finally { setLoading(false); }
  };

  const notify = (msg, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3500);
  };

  const handleCreate = async () => {
    if (!form.name || !form.email) return notify('Name and email are required', true);
    setSaving(true);
    try {
      await api.createUser(form);
      notify(`User ${form.email} created. Temp password: ${form.temporaryPassword}`);
      setShowCreate(false);
      setForm({ name: '', email: '', role: 'nurse', department: '', temporaryPassword: 'IVFTemp123!' });
      loadUsers();
    } catch (e) { notify(e.message, true); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await api.updateUser(editUser.username, { role: editUser.role, department: editUser.department });
      notify('User updated successfully');
      setEditUser(null);
      loadUsers();
    } catch (e) { notify(e.message, true); }
    finally { setSaving(false); }
  };

  const handleToggleEnable = async (user) => {
    try {
      await api.updateUser(user.username, { enabled: !user.enabled });
      notify(`User ${user.enabled ? 'disabled' : 'enabled'}`);
      loadUsers();
    } catch (e) { notify(e.message, true); }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    try {
      await api.deleteUser(user.username);
      notify('User deleted');
      loadUsers();
    } catch (e) { notify(e.message, true); }
  };

  const customRoleKeys = loadCustomRoles().map(r => r.key);
  const allRoleOptions = [...ROLES, ...customRoleKeys];

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.role?.toLowerCase().includes(search.toLowerCase());
    const matchUser = !filterUser || u.name?.toLowerCase().includes(filterUser.toLowerCase()) || u.email?.toLowerCase().includes(filterUser.toLowerCase());
    const matchRole = filterRoles.length === 0 || filterRoles.includes(u.role);
    return matchSearch && matchUser && matchRole;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IcoBack /> Back
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <IcoUsers />
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1a202c' }}>User Management</h2>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{users.length} users total</span>
          <button onClick={() => setShowCreateRole(true)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IcoShield /> Create Custom Role
          </button>
          <button onClick={() => setShowManageRoles(true)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IcoEdit /> Manage Roles
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IcoPlus /> Add User
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error   && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '4px solid #f44336' }}>{error}</div>}
      {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '4px solid #4caf50' }}>{success}</div>}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><IcoSearch /></span>
        <input
          type="text"
          placeholder="Search by name, email or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Loading" style={{ width: '60px' }} />
          <p style={{ marginTop: '1rem' }}>Loading users...</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e8ecf4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', color: 'white', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.5px', textTransform: 'uppercase', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    User
                    <button onClick={() => { setShowUserFilter(v => !v); setShowRoleFilter(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', color: 'white', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center' }} title="Filter by user">
                      <IcoSearch />
                    </button>
                  </div>
                  {showUserFilter && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '200px' }}>
                      <input autoFocus type="text" placeholder="Filter by name/email..." value={filterUser} onChange={e => setFilterUser(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', outline: 'none', color: '#1a202c', boxSizing: 'border-box' }} />
                      {filterUser && <button onClick={() => setFilterUser('')} style={{ marginTop: '4px', fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
                    </div>
                  )}
                </th>
                <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', color: 'white', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.5px', textTransform: 'uppercase', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Role
                    <button onClick={() => { setShowRoleFilter(v => !v); setShowUserFilter(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', color: 'white', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center' }} title="Filter by role">
                      ▾
                    </button>
                    {filterRoles.length > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem' }}>{filterRoles.length}</span>}
                  </div>
                  {showRoleFilter && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '160px' }}>
                      {allRoleOptions.map(r => (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer', fontSize: '0.82rem', color: '#374151', textTransform: 'capitalize' }}>
                          <input type="checkbox" checked={filterRoles.includes(r)} onChange={() => setFilterRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                            style={{ accentColor: '#667eea' }} />
                          {r}
                        </label>
                      ))}
                      {filterRoles.length > 0 && <button onClick={() => setFilterRoles([])} style={{ marginTop: '4px', fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
                    </div>
                  )}
                </th>
                {['Department', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.9rem 1.25rem', textAlign: 'left', color: 'white', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No users found</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.username} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbff', transition: 'background 0.15s' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${roleColor(u.role)}, #764ba2)`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {(u.name || u.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1a202c', fontSize: '0.9rem' }}>{u.name || '—'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span style={{ background: roleColor(u.role), color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', color: '#475569', fontSize: '0.88rem' }}>{u.department || '—'}</td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, background: u.enabled ? '#e8f5e9' : '#ffebee', color: u.enabled ? '#2e7d32' : '#c62828' }}>
                      {u.enabled ? <IcoCheck /> : <IcoXIcon />}
                      {u.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => setEditUser({...u})} title="Edit" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#475569' }}>
                        <IcoEdit /> Edit
                      </button>
                      <button onClick={() => setPermUser(u)} title="Permissions" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#667eea' }}>
                        <IcoShield /> Perms
                      </button>
                      <button onClick={() => handleToggleEnable(u)} title={u.enabled ? 'Disable' : 'Enable'} style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${u.enabled ? '#fecdd3' : '#bbf7d0'}`, background: u.enabled ? '#fff1f2' : '#f0fdf4', cursor: 'pointer', fontSize: '0.8rem', color: u.enabled ? '#e11d48' : '#16a34a' }}>
                        {u.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => handleDelete(u)} title="Delete" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fecdd3', background: '#fff1f2', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#e11d48' }}>
                        <IcoTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showCreateRole && (
        <CreateRoleModal
          onClose={() => setShowCreateRole(false)}
          onCreated={(role) => {
            notify(`Custom role "${role.label}" created successfully`);
            setShowCreateRole(false);
          }}
        />
      )}

      {/* Manage Roles Modal */}
      {showManageRoles && (
        <ManageRolesModal
          onClose={() => setShowManageRoles(false)}
          users={users}
        />
      )}

      {/* Create Custom User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => { notify(msg); setShowCreate(false); loadUsers(); }}
        />
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#1a202c', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><IcoEdit /> Edit User</h3>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem 2rem', display: 'grid', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem', color: '#475569' }}>
                <strong>{editUser.name}</strong> — {editUser.email}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>Role</label>
                <select value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>Department</label>
                <select value={editUser.department || ''} onChange={e => setEditUser({...editUser, department: e.target.value})}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}>
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '1rem 2rem 1.5rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditUser(null)} className="btn-secondary" disabled={saving}>Cancel</button>
              <button onClick={handleUpdate} className="btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {saving ? 'Saving...' : <><IcoEdit /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions View Modal */}
      {permUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#1a202c', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><IcoShield /> Permissions</h3>
              <button onClick={() => setPermUser(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem 2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${roleColor(permUser.role)}, #764ba2)`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                  {(permUser.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a202c' }}>{permUser.name}</div>
                  <span style={{ background: roleColor(permUser.role), color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>{permUser.role}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>Permissions are based on role.</p>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const userPerms = permUser.permissions ? (() => { try { return JSON.parse(permUser.permissions); } catch { return null; } })() : null;
                  const flatPerms = userPerms || PERMISSIONS[permUser.role] || {};
                  const allowed = flatPerms[key] ?? false;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.9rem', borderRadius: '8px', background: allowed ? '#f0fdf4' : '#fafafa', border: `1px solid ${allowed ? '#bbf7d0' : '#e2e8f0'}` }}>
                      <span style={{ fontSize: '0.88rem', color: '#374151', fontWeight: 500 }}>{label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: allowed ? '#16a34a' : '#94a3b8' }}>
                        {allowed ? <IcoCheck /> : <IcoXIcon />}
                        {allowed ? 'Allowed' : 'Denied'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem', marginBottom: 0 }}>
                {permUser.permissions ? '🔒 Showing user-specific permissions' : '📋 Showing role defaults'}
              </p>
            </div>
            <div style={{ padding: '1rem 2rem 1.5rem', textAlign: 'right' }}>
              <button onClick={() => setPermUser(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
