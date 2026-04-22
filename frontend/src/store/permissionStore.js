/**
 * permissionStore.js
 *
 * Global state store for role-based access control using Zustand.
 * Controls which modules each user role can view or edit.
 * Called once on login with the user's Cognito role attribute.
 */

import { create } from 'zustand';

// Default module permissions for each role.
// Each module has a view flag (can the user see it) and an edit flag
// (can the user make changes). Roles not listed here fall back to viewer.
const ROLE_DEFAULTS = {
  admin: {
    ivfCapture:  { view: true,  edit: true  },
    sessions:    { view: true,  edit: true  },
    metrics:     { view: true,  edit: true  },
    auditLog:    { view: true,  edit: true  },
    userMgmt:    { view: true,  edit: true  },
    uploadImage: true,
    chatbot:     true,
  },
  supervisor: {
    ivfCapture:  { view: true,  edit: true  },
    sessions:    { view: true,  edit: true  },
    metrics:     { view: true,  edit: true  },
    auditLog:    { view: false, edit: false },
    userMgmt:    { view: false, edit: false },
    uploadImage: true,
    chatbot:     true,
  },
  viewer: {
    ivfCapture:  { view: false, edit: false },
    sessions:    { view: true,  edit: false },
    metrics:     { view: false, edit: false },
    auditLog:    { view: false, edit: false },
    userMgmt:    { view: false, edit: false },
    uploadImage: false,
    chatbot:     false,
  },
};

// Converts the older flat permission format (createCase, viewSessions, etc.)
// to the current module-based format. Kept for backward compatibility with
// any existing Cognito user attributes that use the old format.
function flatToModule(flat) {
  return {
    ivfCapture:  { view: flat.createCase    ?? false, edit: flat.createCase    ?? false },
    sessions:    { view: flat.viewSessions  ?? false, edit: false },
    metrics:     { view: flat.viewMetrics   ?? false, edit: false },
    auditLog:    { view: flat.viewAuditLog  ?? false, edit: false },
    userMgmt:    { view: flat.manageUsers   ?? false, edit: flat.manageUsers   ?? false },
    uploadImage: flat.uploadImage ?? false,
    chatbot:     flat.chatbot     ?? false,
  };
}

const usePermissionStore = create((set, get) => ({
  role: null,

  // All modules default to no access until setPermissions is called after login
  modulePerms: {
    ivfCapture:  { view: false, edit: false },
    sessions:    { view: false, edit: false },
    metrics:     { view: false, edit: false },
    auditLog:    { view: false, edit: false },
    userMgmt:    { view: false, edit: false },
    uploadImage: false,
    chatbot:     false,
  },

  // Called on login with the user's Cognito role and optional custom permissions.
  // If rawPermissions is provided in module format, use it directly.
  // If it is in the old flat format, convert it first.
  // If no permissions are provided, fall back to the role defaults above.
  setPermissions: (role, rawPermissions) => {
    let modulePerms;

    // Admin always gets full defaults — never restrict admin via stored permissions
    if (role === 'admin') {
      modulePerms = ROLE_DEFAULTS['admin'];
    } else if (rawPermissions) {
      if (rawPermissions.ivfCapture !== undefined) {
        // Already in module format — merge uploadImage/chatbot if present
        modulePerms = {
          ...rawPermissions,
          uploadImage: rawPermissions.uploadImage ?? (ROLE_DEFAULTS[role]?.uploadImage ?? false),
          chatbot:     rawPermissions.chatbot     ?? (ROLE_DEFAULTS[role]?.chatbot     ?? false),
        };
      } else {
        // Old flat format — convert it
        modulePerms = flatToModule(rawPermissions);
      }
    } else {
      // No custom permissions — use the role defaults
      modulePerms = ROLE_DEFAULTS[role] || ROLE_DEFAULTS['viewer'];
    }

    set({ role, modulePerms });
  },

  // Resets permissions to viewer defaults on logout
  clearPermissions: () => set({ role: null, modulePerms: ROLE_DEFAULTS['viewer'] }),

  // Returns true if the current user can view the given module.
  // Used to conditionally render navigation cards and screens.
  canView: (module) => {
    const { modulePerms } = get();
    return modulePerms?.[module]?.view ?? false;
  },

  // Returns true if the current user can edit (create/modify) in the given module.
  // Used to show or hide action buttons like Start Capture and Edit Patient.
  canEdit: (module) => {
    const { modulePerms } = get();
    return modulePerms?.[module]?.edit ?? false;
  },

  // Returns true if the current user can use the Upload Image button anywhere in the system.
  // Currently disabled system-wide — only Take Photo (camera) is available.
  canUploadImage: () => {
    return false;
  },

  // Returns true if the current user can see and use the Chatbot widget.
  canUseChatbot: () => {
    const { modulePerms } = get();
    return modulePerms?.chatbot ?? false;
  },
}));

export default usePermissionStore;
export { ROLE_DEFAULTS };
