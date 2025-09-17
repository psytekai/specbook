// preload.ts
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
    ipcRenderer.invoke('asset:statistics'),
  assetDownloadFromUrl: (imageUrl: string, filename?: string) =>
    ipcRenderer.invoke('asset:download-from-url', imageUrl, filename),

  // Python bridge operations
  checkPythonAvailability: () => ipcRenderer.invoke('python:check-availability'),
  scrapeProduct: (url: string, options?: any) => 
    ipcRenderer.invoke('python:scrape-product', url, options),
  getPythonStatus: () => ipcRenderer.invoke('python:get-status'),
  pythonRunDiagnostics: () => ipcRenderer.invoke('python:run-diagnostics'),
  
  onScrapeProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('python:scrape-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('python:scrape-progress', handler);
    };
  },

  // API keys input
   sendApiKeys: (payload: { openai: string; firecrawl: string } | null) =>
    ipcRenderer.send('api-keys-input', payload),

   
});

// Types are defined in shared/types.ts