import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Project operations
  getCurrentProject: () => ipcRenderer.invoke('project:get-current'),
  closeProject: () => ipcRenderer.invoke('project:close'),
  saveProject: (updates?: any) => ipcRenderer.invoke('project:save', updates),
  markProjectDirty: () => ipcRenderer.invoke('project:mark-dirty'),
  getRecentProjects: () => ipcRenderer.invoke('project:get-recent'),
  clearRecentProjects: () => ipcRenderer.invoke('project:clear-recent'),
  openProjectFromPath: (filePath: string) => ipcRenderer.invoke('project:open-path', filePath),

  // Menu operations
  triggerNewProject: () => ipcRenderer.invoke('menu:new-project'),
  triggerOpenProject: () => ipcRenderer.invoke('menu:open-project'),

  // Event listeners
  onProjectChanged: (callback: (projectInfo: any) => void) => {
    ipcRenderer.on('project:changed', (_event, projectInfo) => callback(projectInfo));
  },

  removeProjectChangedListener: () => {
    ipcRenderer.removeAllListeners('project:changed');
  },

  // API operations (replacing HTTP API with IPC)
  apiGet: (endpoint: string, params?: any) => ipcRenderer.invoke('api:get', endpoint, params),
  apiPost: (endpoint: string, data?: any) => ipcRenderer.invoke('api:post', endpoint, data),
  apiPut: (endpoint: string, data?: any) => ipcRenderer.invoke('api:put', endpoint, data),
  apiDelete: (endpoint: string) => ipcRenderer.invoke('api:delete', endpoint),
  apiScrape: (request: any) => ipcRenderer.invoke('api:scrape-product', request),

  // Asset management operations
  assetUpload: (fileData: ArrayBuffer, filename: string, mimetype: string, options?: any) => 
    ipcRenderer.invoke('asset:upload', fileData, filename, mimetype, options),
  assetGetPath: (hash: string, thumbnail?: boolean) => 
    ipcRenderer.invoke('asset:get-path', hash, thumbnail),
  assetDelete: (hash: string) => 
    ipcRenderer.invoke('asset:delete', hash),
  assetCleanup: (options?: { removeOlderThan?: number; dryRun?: boolean }) => 
    ipcRenderer.invoke('asset:cleanup', options),
  assetImportBatch: (files: Array<{ data: ArrayBuffer; filename: string }>, options?: any) => 
    ipcRenderer.invoke('asset:import-batch', files, options),
  assetStatistics: () => 
    ipcRenderer.invoke('asset:statistics')
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
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
      openProjectFromPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      triggerNewProject: () => Promise<{ success: boolean; error?: string }>;
      triggerOpenProject: () => Promise<{ success: boolean; error?: string }>;
      onProjectChanged: (callback: (projectInfo: any) => void) => void;
      removeProjectChangedListener: () => void;
      apiGet: (endpoint: string, params?: any) => Promise<any>;
      apiPost: (endpoint: string, data?: any) => Promise<any>;
      apiPut: (endpoint: string, data?: any) => Promise<any>;
      apiDelete: (endpoint: string) => Promise<any>;
      apiScrape: (request: any) => Promise<any>;
      assetUpload: (fileData: ArrayBuffer, filename: string, mimetype: string, options?: any) => Promise<any>;
      assetGetPath: (hash: string, thumbnail?: boolean) => Promise<any>;
      assetDelete: (hash: string) => Promise<any>;
      assetCleanup: (options?: { removeOlderThan?: number; dryRun?: boolean }) => Promise<any>;
      assetImportBatch: (files: Array<{ data: ArrayBuffer; filename: string }>, options?: any) => Promise<any>;
      assetStatistics: () => Promise<any>;
    };
  }
}