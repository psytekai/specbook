import { BrowserWindow } from 'electron';
import { ProjectFileManager } from './ProjectFileManager';
import type { Project } from '../types/project.types';

/**
 * Centralized project state management for the main process.
 * Handles all project lifecycle operations and state synchronization.
 */
export class ProjectState {
  private static instance: ProjectState | null = null;
  
  private manager: ProjectFileManager | null = null;
  private project: Project | null = null;
  private filePath: string | null = null;
  private isDirty: boolean = false;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ProjectState {
    if (!ProjectState.instance) {
      ProjectState.instance = new ProjectState();
    }
    return ProjectState.instance;
  }

  /**
   * Set the main window reference for UI updates
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Open an existing project
   */
  async openProject(filePath: string): Promise<Project> {
    try {
      this.manager = new ProjectFileManager();
      this.project = await this.manager.openProject(filePath);
      this.filePath = filePath;
      this.isDirty = false;
      
      this.notifyStateChange();
      this.updateWindowTitle();
      
      return this.project;
    } catch (error) {
      // Clean up on error
      await this.closeProject();
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(filePath: string, name: string): Promise<Project> {
    try {
      this.manager = new ProjectFileManager();
      this.project = await this.manager.createProject(filePath, name);
      this.filePath = filePath;
      this.isDirty = false;
      
      this.notifyStateChange();
      this.updateWindowTitle();
      
      return this.project;
    } catch (error) {
      // Clean up on error
      await this.closeProject();
      throw error;
    }
  }

  /**
   * Save project updates
   */
  async saveProject(updates?: Partial<Project>): Promise<boolean> {
    if (!this.manager || !this.project) {
      throw new Error('No project is open');
    }

    try {
      const result = await this.manager.saveProject(updates || {});
      if (result) {
        this.isDirty = false;
        
        // Update local project data if updates were provided
        if (updates) {
          this.project = { ...this.project, ...updates, updatedAt: new Date() };
        }
        
        this.notifyStateChange();
        this.updateWindowTitle();
      }
      return result;
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    }
  }

  /**
   * Close the current project
   */
  async closeProject(): Promise<void> {
    console.log('🔄 ProjectState: closeProject called, current state:', {
      isOpen: this.isOpen,
      hasProject: !!this.project,
      filePath: this.filePath,
      isDirty: this.isDirty
    });
    
    try {
      if (this.manager) {
        console.log('🔄 ProjectState: Closing project manager');
        await this.manager.closeProject();
      }
    } catch (error) {
      console.error('❌ ProjectState: Error closing project:', error);
    } finally {
      // Always reset state, even if close failed
      console.log('🔄 ProjectState: Resetting state');
      this.manager = null;
      this.project = null;
      this.filePath = null;
      this.isDirty = false;
      
      console.log('🔄 ProjectState: Notifying state change');
      this.notifyStateChange();
      this.updateWindowTitle();
      
      console.log('✅ ProjectState: Project closed, new state:', {
        isOpen: this.isOpen,
        hasProject: !!this.project,
        filePath: this.filePath,
        isDirty: this.isDirty
      });
    }
  }

  /**
   * Mark the project as having unsaved changes
   */
  markDirty(): void {
    if (this.isOpen && !this.isDirty) {
      this.isDirty = true;
      this.updateWindowTitle();
      this.notifyStateChange();
    }
  }

  /**
   * Check if a project can be closed (handle unsaved changes)
   */
  async canCloseProject(): Promise<boolean> {
    if (!this.hasUnsavedChanges || !this.mainWindow) {
      return true;
    }

    const { dialog } = await import('electron');
    const response = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Do you want to save changes to your project?',
      detail: 'Your changes will be lost if you don\'t save them.'
    });

    switch (response.response) {
      case 0: // Save
        await this.saveProject();
        return true;
      case 1: // Don't Save
        return true;
      case 2: // Cancel
        return false;
      default:
        return false;
    }
  }

  /**
   * Update the window title based on current project state
   */
  private updateWindowTitle(): void {
    if (!this.mainWindow) return;

    let title = 'Specbook Manager';
    
    if (this.project) {
      title = `${this.project.name}${this.isDirty ? ' •' : ''} - Specbook Manager`;
    }
    
    this.mainWindow.setTitle(title);
  }

  /**
   * Notify renderer process of state changes
   */
  private notifyStateChange(): void {
    if (!this.mainWindow) return;

    const stateInfo = {
      project: this.project,
      filePath: this.filePath,
      isOpen: this.isOpen,
      hasUnsavedChanges: this.isDirty
    };

    console.log('🔄 ProjectState: Notifying renderer of state change:', stateInfo);
    this.mainWindow.webContents.send('project:changed', stateInfo);
  }

  // Getters
  get isOpen(): boolean {
    return this.manager !== null && this.project !== null;
  }

  get currentProject(): Project | null {
    return this.project;
  }

  get currentFilePath(): string | null {
    return this.filePath;
  }

  get hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  get projectManager(): ProjectFileManager | null {
    return this.manager;
  }

  /**
   * Get complete state info for IPC responses
   */
  getStateInfo() {
    return {
      project: this.project,
      filePath: this.filePath,
      isOpen: this.isOpen,
      hasUnsavedChanges: this.isDirty
    };
  }

  /**
   * Get the current project manager instance
   */
  getManager(): ProjectFileManager | null {
    return this.manager;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    ProjectState.instance = null;
  }
}