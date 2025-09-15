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
  openProjectFromPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  triggerNewProject: () => Promise<{ success: boolean; error?: string }>;
  triggerOpenProject: () => Promise<{ success: boolean; error?: string }>;
  onProjectChanged: (callback: (projectInfo: any) => void) => void;
  removeProjectChangedListener: () => void;
  apiGet: (endpoint: string, params?: any) => Promise<any>;
  apiPost: (endpoint: string, data?: any) => Promise<any>;
  apiPut: (endpoint: string, data?: any) => Promise<any>;
  apiDelete: (endpoint: string) => Promise<any>;

  assetUpload: (fileData: ArrayBuffer, filename: string, mimetype: string, options?: any) => Promise<any>;
  assetGetPath: (hash: string, thumbnail?: boolean) => Promise<any>;
  assetDelete: (hash: string) => Promise<any>;
  assetCleanup: (options?: { removeOlderThan?: number; dryRun?: boolean }) => Promise<any>;
  assetImportBatch: (files: Array<{ data: ArrayBuffer; filename: string }>, options?: any) => Promise<any>;
  assetStatistics: () => Promise<any>;
  assetDownloadFromUrl: (imageUrl: string, filename?: string) => Promise<any>;

  // Python bridge operations
  checkPythonAvailability: () => Promise<any>;
  scrapeProduct: (url: string, options?: any) => Promise<any>;
  getPythonStatus: () => Promise<any>;
  onScrapeProgress: (callback: (progress: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}