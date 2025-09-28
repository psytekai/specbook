export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;
  location: string[];
  type?: string;
  specificationDescription?: string;
  category: string[];
  productName: string;
  manufacturer?: string;
  price?: number;

  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];

  createdAt: Date;
  updatedAt: Date;
}

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
  onRecentProjectsChanged: (callback: (projects: string[]) => void) => () => void;
  onNavigate: (callback: (path: string) => void) => () => void;
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
  navigateToApiKeys: () => Promise<{ success: boolean; error?: string }>;
  setApiKeys: (keys: { openai: string; firecrawl: string }) => Promise<{ success: boolean; error?: string }>;

  // PDF Export operations
  exportToPDF: (request: any) => Promise<any>;
  onExportProgress: (callback: (progress: any) => void) => () => void;
}

// Python Scraping Types
export interface ScrapeOptions {
  method?: 'auto' | 'requests' | 'firecrawl';
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ScrapeProgress {
  type: 'progress';
  stage: 'init' | 'scraping' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
  timestamp: number;
}

export interface StructuredLogEvent {
  schema: string;
  ts: string;
  event_id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  ctx?: Record<string, any>;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    image_url: string;
    type: string;
    specification: string;
    product_name: string;
    manufacturer: string;
    price: number;
    model_no: string;
    product_link: string;
  } | null;
  metadata: {
    scrape_method?: string;
    processing_time?: number;
    scrape_time?: number;
    llm_model?: string;
    status_code?: number;
    html_length?: number;
    processed_length?: number;
    prompt_tokens?: number;
    execution_time?: number;
    partial_output?: string;
    [key: string]: any;
  };
  error: string | null;
  diagnostics?: StructuredLogEvent[];
}

export interface PythonStatus {
  available: boolean;
  error: string | null;
  bridgePath: string;
  activeProcesses?: number;
  maxProcesses?: number;
}

// Re-export PDF export types
export * from './types/exportTypes';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}