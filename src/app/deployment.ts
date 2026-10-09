// Local development and releases enable login by default. Explicit false is
// reserved for a deliberately configured preview build.
export const workspaceEnabled = import.meta.env.VITE_WORKSPACE_ENABLED !== 'false'
