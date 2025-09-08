import { useState, useEffect, useCallback } from 'react';

interface ProjectInfo {
  isOpen: boolean;
  isDirty: boolean;
  name?: string;
  path?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UseProjectResult {
  project: ProjectInfo | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createProject: () => Promise<boolean>;
  openProject: () => Promise<boolean>;
  saveProject: (updates?: any) => Promise<boolean>;
  closeProject: () => Promise<boolean>;
  markDirty: () => Promise<void>;
  
  // Recent projects
  recentProjects: string[];
  clearRecentProjects: () => Promise<void>;
  
  // Refresh state
  refreshProject: () => Promise<void>;
}

/**
 * Hook for managing project state via Electron API
 * Replaces the old API-based project management
 */
export const useProject = (): UseProjectResult => {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  // Load current project on mount
  const refreshProject = useCallback(async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const projectInfo = await window.electronAPI.getCurrentProject();
      setProject(projectInfo);
      
      // Also load recent projects
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

  // Listen for project changes from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleProjectChanged = (projectInfo: ProjectInfo) => {
      setProject(projectInfo);
      setError(null);
    };

    window.electronAPI.onProjectChanged(handleProjectChanged);

    // Initial load
    refreshProject();

    return () => {
      window.electronAPI.removeProjectChangedListener();
    };
  }, [refreshProject]);

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
      
      // Refresh project state after creation
      await refreshProject();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to create project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshProject]);

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
      
      // Refresh project state after opening
      await refreshProject();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to open project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshProject]);

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
      
      // Refresh project state after saving
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
      
      // Refresh project state after closing
      await refreshProject();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to close project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshProject]);

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
      
      // Refresh project state to reflect dirty status
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

  return {
    project,
    isLoading,
    error,
    createProject,
    openProject,
    saveProject,
    closeProject,
    markDirty,
    recentProjects,
    clearRecentProjects,
    refreshProject,
  };
};