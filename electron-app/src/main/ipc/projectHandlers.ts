import { ipcMain } from 'electron';
import { ProjectState } from '../services/ProjectState';
import { ApplicationMenu } from '../menu/ApplicationMenu';

/**
 * Set up IPC handlers for project operations
 */
export function setupProjectIPC(): void {
  const projectState = ProjectState.getInstance();
  const applicationMenu = ApplicationMenu.getInstance();

  /**
   * Get current project information
   */
  ipcMain.handle('project:get-current', async () => {
    return projectState.getStateInfo();
  });

  /**
   * Close the current project
   */
  ipcMain.handle('project:close', async () => {
    try {
      const canClose = await projectState.canCloseProject();
      if (canClose) {
        await projectState.closeProject();
        applicationMenu.updateMenuState();
        return { success: true };
      }
      return { success: false, reason: 'User cancelled' };
    } catch (error) {
      console.error('Error closing project via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Save the current project
   */
  ipcMain.handle('project:save', async (_event, updates) => {
    try {
      const result = await projectState.saveProject(updates);
      return { success: result };
    } catch (error) {
      console.error('Error saving project via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Mark the project as dirty (having unsaved changes)
   */
  ipcMain.handle('project:mark-dirty', async () => {
    try {
      projectState.markDirty();
      return { success: true };
    } catch (error) {
      console.error('Error marking project dirty via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Get recent projects list
   */
  ipcMain.handle('project:get-recent', async () => {
    try {
      const recentProjects = applicationMenu.getRecentProjects();
      return { success: true, projects: recentProjects };
    } catch (error) {
      console.error('Error getting recent projects via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Clear recent projects list
   */
  ipcMain.handle('project:clear-recent', async () => {
    try {
      applicationMenu.clearRecentProjects();
      return { success: true };
    } catch (error) {
      console.error('Error clearing recent projects via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Trigger File > New Project menu action from renderer
   */
  ipcMain.handle('menu:new-project', async () => {
    try {
      // Get the File menu and trigger New Project
      const { Menu } = await import('electron');
      const menu = Menu.getApplicationMenu();
      if (menu) {
        const fileMenu = menu.items.find(item => item.label === 'File');
        if (fileMenu && fileMenu.submenu) {
          const newProjectItem = fileMenu.submenu.items.find(item => item.label === 'New Project...');
          if (newProjectItem && newProjectItem.click) {
            newProjectItem.click();
            return { success: true };
          }
        }
      }
      return { success: false, error: 'Menu item not found' };
    } catch (error) {
      console.error('Error triggering new project via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Trigger File > Open Project menu action from renderer
   */
  ipcMain.handle('menu:open-project', async () => {
    try {
      // Get the File menu and trigger Open Project
      const { Menu } = await import('electron');
      const menu = Menu.getApplicationMenu();
      if (menu) {
        const fileMenu = menu.items.find(item => item.label === 'File');
        if (fileMenu && fileMenu.submenu) {
          const openProjectItem = fileMenu.submenu.items.find(item => item.label === 'Open Project...');
          if (openProjectItem && openProjectItem.click) {
            openProjectItem.click();
            return { success: true };
          }
        }
      }
      return { success: false, error: 'Menu item not found' };
    } catch (error) {
      console.error('Error triggering open project via IPC:', error);
      return { success: false, error: String(error) };
    }
  });

  console.log('✅ Project IPC handlers registered');
}