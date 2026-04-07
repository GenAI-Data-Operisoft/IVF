import { create } from 'zustand';

// Role-based default module permissions
const ROLE_DEFAULTS = {
  admin: {
    ivfCapture: { view: true,  edit: true  },
    sessions:   { view: true,  edit: true  },
    metrics:    { view: true,  edit: true  },
    auditLog:   { view: true,  edit: true  },
    userMgmt:   { view: true,  edit: true  },
  },
  supervisor: {
    ivfCapture: { view: true,  edit: true  },
    sessions:   { view: true,  edit: true  },
    metrics:    { view: true,  edit: true  },
    auditLog:   { view: false, edit: false },
    userMgmt:   { view: false, edit: false },
  },
  viewer: {
    ivfCapture: { view: false, edit: false },
    sessions:   { view: true,  edit: false },
    metrics:    { view: false, edit: false },
    auditLog:   { view: false, edit: false },
    userMgmt:   { view: false, edit: false },
  },
};

// Convert flat legacy permissions to module format
function flatToModule(flat) {
  return {
    ivfCapture: { view: flat.createCase    ?? false, edit: flat.createCase    ?? false },
    sessions:   { view: flat.viewSessions  ?? false, edit: false },
    metrics:    { view: flat.viewMetrics   ?? false, edit: false },
    auditLog:   { view: flat.viewAuditLog  ?? false, edit: false },
    userMgmt:   { view: flat.manageUsers   ?? false, edit: flat.manageUsers   ?? false },
  };
}

const usePermissionStore = create((set, get) => ({
  role: null,
  modulePerms: {
    ivfCapture: { view: false, edit: false },
    sessions:   { view: false, edit: false },
    metrics:    { view: false, edit: false },
    auditLog:   { view: false, edit: false },
    userMgmt:   { view: false, edit: false },
  },

  // Called on login with Cognito attributes
  setPermissions: (role, rawPermissions) => {
    let modulePerms;

    if (rawPermissions) {
      if (rawPermissions.ivfCapture !== undefined) {
        modulePerms = rawPermissions;
      } else {
        modulePerms = flatToModule(rawPermissions);
      }
    } else {
      modulePerms = ROLE_DEFAULTS[role] || ROLE_DEFAULTS['viewer'];
    }

    set({ role, modulePerms });
  },

  clearPermissions: () => set({ role: null, modulePerms: ROLE_DEFAULTS['viewer'] }),

  // Check if user can VIEW a module — always uses modulePerms (never null after setPermissions)
  canView: (module) => {
    const { modulePerms } = get();
    return modulePerms?.[module]?.view ?? false;
  },

  // Check if user can EDIT a module
  canEdit: (module) => {
    const { modulePerms } = get();
    return modulePerms?.[module]?.edit ?? false;
  },
}));

export default usePermissionStore;
export { ROLE_DEFAULTS };
