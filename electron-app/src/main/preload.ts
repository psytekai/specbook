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
  navigateToApiKeys: () => ipcRenderer.invoke('menu:navigate-to-api-keys'),

  // Event listeners
  onProjectChanged: (callback: (projectInfo: any) => void) => {
    ipcRenderer.on('project:changed', (_event, projectInfo) => callback(projectInfo));
  },

  removeProjectChangedListener: () => {
    ipcRenderer.removeAllListeners('project:changed');
  },

  // Recent projects change events
  onRecentProjectsChanged: (callback: (projects: string[]) => void) => {
    const handler = (_event: any, projects: string[]) => callback(projects);
    ipcRenderer.on('recent:changed', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('recent:changed', handler);
    };
  },

  onNavigate: (callback: (path: string) => void) => {
    const handler = (_event: any, path: string) => callback(path);
    ipcRenderer.on('navigate-to', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('navigate-to', handler);
    };
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
  
  onScrapeProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('python:scrape-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('python:scrape-progress', handler);
    };
  },

  // API keys management
  setApiKeys: (keys: { openai: string; firecrawl: string }) =>
    ipcRenderer.invoke('api-keys:set', keys),

  // File system operations
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),

  // PDF Export operations
  exportToPDF: (request: any) => ipcRenderer.invoke('export:pdf', request),
  cancelExport: (exportId: string) => ipcRenderer.invoke('export:cancel', exportId),
  getExportStatistics: (config: any) => ipcRenderer.invoke('export:getStatistics', config),
  validateExportConfig: (config: any) => ipcRenderer.invoke('export:validateConfig', config),
  getDefaultExportConfig: () => ipcRenderer.invoke('export:getDefaultConfig'),

  onExportProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('export:progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('export:progress', handler);
    };
  },

  onExportCompleted: (callback: (result: any) => void) => {
    const handler = (_event: any, result: any) => callback(result);
    ipcRenderer.on('export:completed', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('export:completed', handler);
    };
  },
   
});

// Types are defined in shared/types.ts