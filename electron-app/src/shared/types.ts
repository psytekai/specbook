// Shared types between main and renderer processes

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  getCurrentProject: () => Promise<any>;
  closeProject: () => Promise<{ success: boolean; reason?: string; error?: string }>;
  saveProject: (updates?: any) => Promise<{ success: boolean; error?: string }>;
  markProjectDirty: () => Promise<{ success: boolean; error?: string }>;
  getRecentProjects: () => Promise<{ success: boolean; projects?: string[]; error?: string }>;
  clearRecentProjects: () => Promise<{ success: boolean; error?: string }>;
  triggerNewProject: () => Promise<{ success: boolean; error?: string }>;
  triggerOpenProject: () => Promise<{ success: boolean; error?: string }>;
  onProjectChanged: (callback: (projectInfo: any) => void) => void;
  removeProjectChangedListener: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}