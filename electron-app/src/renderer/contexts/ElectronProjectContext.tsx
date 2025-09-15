import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// Types matching the Electron API
interface ProjectInfo {
  isOpen: boolean;
  isDirty: boolean;
  name?: string;
  path?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ElectronProjectContextType {
  // State
  project: ProjectInfo | null;
  isInitializing: boolean;  // True only during initial app load
  isLoading: boolean;        // True during any async operation
  error: string | null;
  recentProjects: string[];
  
  // Actions
  createProject: () => Promise<boolean>;
  openProject: () => Promise<boolean>;
  openProjectFromPath: (filePath: string) => Promise<boolean>;
  saveProject: (updates?: any) => Promise<boolean>;
  closeProject: () => Promise<boolean>;
  markDirty: () => Promise<void>;
  clearRecentProjects: () => Promise<void>;
  refreshProject: () => Promise<void>;
}

// Create context with undefined default
const ElectronProjectContext = createContext<ElectronProjectContextType | undefined>(undefined);

// Provider component
export const ElectronProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  
  // Initialize with isInitializing = true to prevent premature checks
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  // Initialize project state on mount (ONCE)
  useEffect(() => {
    const initializeProject = async () => {
      if (!window.electronAPI) {
        setError('Electron API not available');
        setIsInitializing(false);
        return;
      }

      try {
        console.log('📦 ElectronProjectContext: Initializing project state...');
        
        // Fetch initial project state
        const stateInfo = await window.electronAPI.getCurrentProject();
        
        // Map the state info from main process to ProjectInfo format
        const projectInfo: ProjectInfo | null = stateInfo.isOpen && stateInfo.project ? {
          isOpen: stateInfo.isOpen,
          isDirty: stateInfo.hasUnsavedChanges,
          name: stateInfo.project.name,
          path: stateInfo.filePath,
          createdAt: stateInfo.project.createdAt,
          updatedAt: stateInfo.project.updatedAt
        } : null;
        
        setProject(projectInfo);
        
        // Auto-navigate to project view if a project is already open
        if (projectInfo && projectInfo.isOpen) {
          navigate('/project');
        }
        
        // Load recent projects
        const recentResult = await window.electronAPI.getRecentProjects();
        if (recentResult.success && recentResult.projects) {
          setRecentProjects(recentResult.projects);
        }
        
        console.log('✅ ElectronProjectContext: Initialization complete', { projectInfo });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('Failed to initialize project:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeProject();
  }, []); // Only run once on mount

  // Listen for project changes from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleProjectChanged = (stateInfo: any) => {
      console.log('🔄 ElectronProjectContext: Received project change event:', stateInfo);
      
      // Map the state info from main process to ProjectInfo format
      const projectInfo: ProjectInfo | null = stateInfo.isOpen && stateInfo.project ? {
        isOpen: stateInfo.isOpen,
        isDirty: stateInfo.hasUnsavedChanges,
        name: stateInfo.project.name,
        path: stateInfo.filePath,
        createdAt: stateInfo.project.createdAt,
        updatedAt: stateInfo.project.updatedAt
      } : null;
      
      // Check if we're transitioning from no project to having a project
      const wasNoProject = !project || !project.isOpen;
      const nowHasProject = projectInfo && projectInfo.isOpen;
      
      setProject(projectInfo);
      setError(null);
      
      // Auto-navigate to project view when a project is opened
      if (wasNoProject && nowHasProject) {
        navigate('/project');
      } else if (!nowHasProject && project?.isOpen) {
        // Navigate to welcome when project is closed
        navigate('/welcome');
      }
    };

    window.electronAPI.onProjectChanged(handleProjectChanged);

    return () => {
      window.electronAPI.removeProjectChangedListener();
    };
  }, [project, navigate]);

  // Refresh project state (can be called manually if needed)
  const refreshProject = useCallback(async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const stateInfo = await window.electronAPI.getCurrentProject();
      
      const projectInfo: ProjectInfo | null = stateInfo.isOpen && stateInfo.project ? {
        isOpen: stateInfo.isOpen,
        isDirty: stateInfo.hasUnsavedChanges,
        name: stateInfo.project.name,
        path: stateInfo.filePath,
        createdAt: stateInfo.project.createdAt,
        updatedAt: stateInfo.project.updatedAt
      } : null;
      
      setProject(projectInfo);
      
      // Also refresh recent projects
      const recentResult = await window.electronAPI.getRecentProjects();
      if (recentResult.success && recentResult.projects) {
        setRecentProjects(recentResult.projects);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to refresh project:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Project actions
  const createProject = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electronAPI.triggerNewProject();
      if (!result.success) {
        setError(result.error || 'Failed to create project');
        return false;
      }
      
      // State will be updated via project:changed event
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to create project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openProject = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electronAPI.triggerOpenProject();
      if (!result.success) {
        setError(result.error || 'Failed to open project');
        return false;
      }
      
      // State will be updated via project:changed event
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to open project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openProjectFromPath = useCallback(async (filePath: string): Promise<boolean> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electronAPI.openProjectFromPath(filePath);
      if (!result.success) {
        setError(result.error || 'Failed to open project');
        return false;
      }
      
      // State will be updated via project:changed event
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to open project from path:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProject = useCallback(async (updates?: any): Promise<boolean> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electronAPI.saveProject(updates);
      if (!result.success) {
        setError(result.error || 'Failed to save project');
        return false;
      }
      
      // Refresh to get updated state
      await refreshProject();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to save project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshProject]);

  const closeProject = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electronAPI.closeProject();
      
      if (!result.success) {
        if (result.reason === 'User cancelled') {
          // User chose not to close, this is not an error
          return false;
        }
        setError(result.error || 'Failed to close project');
        return false;
      }
      
      // State will be updated via project:changed event
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to close project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markDirty = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      const result = await window.electronAPI.markProjectDirty();
      if (!result.success) {
        setError(result.error || 'Failed to mark project dirty');
        return;
      }
      
      // Refresh to get updated state
      await refreshProject();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to mark project dirty:', err);
    }
  }, [refreshProject]);

  const clearRecentProjects = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      const result = await window.electronAPI.clearRecentProjects();
      if (!result.success) {
        setError(result.error || 'Failed to clear recent projects');
        return;
      }
      
      setRecentProjects([]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to clear recent projects:', err);
    }
  }, []);

  const value: ElectronProjectContextType = {
    project,
    isInitializing,
    isLoading,
    error,
    recentProjects,
    createProject,
    openProject,
    openProjectFromPath,
    saveProject,
    closeProject,
    markDirty,
    clearRecentProjects,
    refreshProject,
  };

  return (
    <ElectronProjectContext.Provider value={value}>
      {children}
    </ElectronProjectContext.Provider>
  );
};

// Custom hook to use the context
export const useElectronProject = () => {
  const context = useContext(ElectronProjectContext);
  if (context === undefined) {
    throw new Error('useElectronProject must be used within an ElectronProjectProvider');
  }
  return context;
};