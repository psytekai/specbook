// ApplicationMenu.ts
import { Menu, BrowserWindow, dialog, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectState } from '../services/ProjectState';

interface RecentProjectsStore {
  recentProjects?: string[];
}

class SimpleStore {
  private storePath: string;
  private data: RecentProjectsStore = { recentProjects: [] };

  constructor() {
    const { app } = require('electron');
    this.storePath = path.join(app.getPath('userData'), 'recent-projects.json');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const data = await fs.readFile(this.storePath, 'utf-8');
      this.data = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      this.data = { recentProjects: [] };
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.writeFile(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save recent projects:', error);
    }
  }

  get(key: keyof RecentProjectsStore, defaultValue: any): any {
    return this.data[key] || defaultValue;
  }

  set(key: keyof RecentProjectsStore, value: any): void {
    this.data[key] = value;
    this.saveData();
  }

  delete(key: keyof RecentProjectsStore): void {
    delete this.data[key];
    this.saveData();
  }
}

const store = new SimpleStore();

/**
 * Application menu management with File menu and recent projects
 */
export class ApplicationMenu {
  private static instance: ApplicationMenu | null = null;
  private mainWindow: BrowserWindow | null = null;
  private projectState: ProjectState;

  private constructor() {
    this.projectState = ProjectState.getInstance();
  }

  static getInstance(): ApplicationMenu {
    if (!ApplicationMenu.instance) {
      ApplicationMenu.instance = new ApplicationMenu();
    }
    return ApplicationMenu.instance;
  }

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.projectState.setMainWindow(window);
  }

  /**
   * Create and set the application menu
   */
  createApplicationMenu(): Menu {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Project...',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.handleNewProject()
          },
          {
            label: 'Open Project...',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleOpenProject()
          },
          { type: 'separator' },
          {
            label: 'Save Project',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.handleSaveProject(),
            enabled: false // Initially disabled
          },
          {
            label: 'Close Project',
            accelerator: 'CmdOrCtrl+W',
            click: () => this.handleCloseProject(),
            enabled: false // Initially disabled
          },
          { type: 'separator' },
          {
            label: 'API Keys...',
            click: () => this.handleApiKeys()
          },
          { type: 'separator' },
          {
            label: 'Recent Projects',
            submenu: this.buildRecentProjectsSubmenu()
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services', submenu: [] },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      } as any);

      // Window menu
      (template[4] as any).submenu = [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ];
    }

    const menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu);
    return menu;
  }

  /**
   * Add a project to recent projects list
   */
  addToRecentProjects(filePath: string): void {
    const recent = store.get('recentProjects', [] as string[]);
    const updated = [filePath, ...recent.filter((p: string) => p !== filePath)].slice(0, 10);
    store.set('recentProjects', updated);
    this.updateRecentProjectsMenu();
  }

  /**
   * Build the recent projects submenu
   */
  private buildRecentProjectsSubmenu(): any[] {
    const recentProjects = store.get('recentProjects', [] as string[]);

    if (recentProjects.length === 0) {
      return [{
        label: 'No Recent Projects',
        enabled: false
      }];
    }

    const submenuItems: any[] = [];

    // Add recent project items
    recentProjects.forEach((projectPath: string) => {
      const projectName = path.basename(projectPath, '.specbook');
      submenuItems.push({
        label: projectName,
        sublabel: projectPath,
        click: () => this.openRecentProject(projectPath)
      });
    });

    // Add separator and clear option
    submenuItems.push({ type: 'separator' });
    submenuItems.push({
      label: 'Clear Recent Projects',
      click: () => {
        store.delete('recentProjects');
        this.updateRecentProjectsMenu();
      }
    });

    return submenuItems;
  }

  /**
   * Update the recent projects submenu by rebuilding the entire menu
   */
  private updateRecentProjectsMenu(): void {
    // Rebuild the entire menu to update recent projects
    this.createApplicationMenu();
  }

  /**
   * Update menu state based on current project status
   */
  updateMenuState(): void {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    const fileMenu = menu.items.find(item => item.label === 'File');
    if (!fileMenu || !fileMenu.submenu) return;

    const saveMenuItem = fileMenu.submenu.items.find(item => item.label === 'Save Project');
    const closeMenuItem = fileMenu.submenu.items.find(item => item.label === 'Close Project');

    if (saveMenuItem) {
      saveMenuItem.enabled = this.projectState.isOpen;
    }
    if (closeMenuItem) {
      closeMenuItem.enabled = this.projectState.isOpen;
    }
  }

  /**
   * Handle File > New Project
   */
  private async handleNewProject(): Promise<void> {
    if (!this.mainWindow) return;

    try {
      // Check for unsaved changes
      const canClose = await this.projectState.canCloseProject();
      if (!canClose) return;

      const result = await dialog.showSaveDialog(this.mainWindow, {
        title: 'Create New Project',
        defaultPath: 'MyProject.specbook',
        filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }],
        properties: ['createDirectory']
      });

      if (!result.canceled && result.filePath) {
        const projectName = path.basename(result.filePath, '.specbook');
        await this.projectState.createProject(result.filePath, projectName);
        this.addToRecentProjects(result.filePath);
        this.updateMenuState();
      }
    } catch (error) {
      console.error('Error creating new project:', error);
      dialog.showErrorBox('Error', `Failed to create project: ${error}`);
    }
  }

  /**
   * Handle File > Open Project
   */
  private async handleOpenProject(): Promise<void> {
    if (!this.mainWindow) return;

    try {
      // Check for unsaved changes
      const canClose = await this.projectState.canCloseProject();
      if (!canClose) return;

      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: 'Open Project',
        filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }],
        properties: ['openDirectory']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await this.projectState.openProject(result.filePaths[0]);
        this.addToRecentProjects(result.filePaths[0]);
        this.updateMenuState();
      }
    } catch (error) {
      console.error('Error opening project:', error);
      dialog.showErrorBox('Error', `Failed to open project: ${error}`);
    }
  }

  /**
   * Handle File > Save Project
   */
  private async handleSaveProject(): Promise<void> {
    if (!this.projectState.isOpen) return;

    try {
      await this.projectState.saveProject();
    } catch (error) {
      console.error('Error saving project:', error);
      dialog.showErrorBox('Error', `Failed to save project: ${error}`);
    }
  }

  /**
   * Handle File > Close Project
   */
  private async handleCloseProject(): Promise<void> {
    if (!this.projectState.isOpen) return;

    try {
      const canClose = await this.projectState.canCloseProject();
      if (canClose) {
        await this.projectState.closeProject();
        this.updateMenuState();
      }
    } catch (error) {
      console.error('Error closing project:', error);
      dialog.showErrorBox('Error', `Failed to close project: ${error}`);
    }
  }

  /**
   * Open a recent project
   */
  private async openRecentProject(filePath: string): Promise<void> {
    try {
      // Check if file still exists
      await fs.access(filePath);

      // Check for unsaved changes
      const canClose = await this.projectState.canCloseProject();
      if (!canClose) return;

      await this.projectState.openProject(filePath);
      this.addToRecentProjects(filePath); // Move to top of recent list
      this.updateMenuState();
    } catch (error) {
      console.error('Error opening recent project:', error);

      // Remove from recent if file doesn't exist
      const recent = store.get('recentProjects', [] as string[]);
      const updated = recent.filter((p: string) => p !== filePath);
      store.set('recentProjects', updated);
      this.updateRecentProjectsMenu();

      if (this.mainWindow) {
        dialog.showErrorBox(
          'Project Not Found',
          `The project "${filePath}" could not be found. It may have been moved or deleted.`
        );
      }
    }
  }

  /**
   * Get recent projects list
   */
  getRecentProjects(): string[] {
    return store.get('recentProjects', [] as string[]);
  }

  /**
   * Clear all recent projects
   */
  clearRecentProjects(): void {
    store.delete('recentProjects');
    this.updateRecentProjectsMenu();
  }

  /**
   * Handle File > API Keys
   */
  private async handleApiKeys(): Promise<void> {
    if (!this.mainWindow) return;

    try {
      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Set API Keys'],
        defaultId: 1,
        title: 'API Keys Configuration',
        message: 'Configure API Keys for Web Scraping',
        detail: 'Enter your OpenAI and Firecrawl API keys to enable web scraping functionality.'
      });

      if (result.response === 1) {
        // Show single dialog for both API keys
        const keys = await this.showApiKeysDialog();
        if (keys) {
          // Set environment variables for Python process
          process.env.OPENAI_API_KEY = keys.openai;
          process.env.FIRECRAWL_API_KEY = keys.firecrawl;

          dialog.showMessageBox(this.mainWindow!, {
            type: 'info',
            title: 'API Keys Set',
            message: 'API keys have been configured successfully.',
            detail: 'The keys will be available for the current session.'
          });
        }
      }
    } catch (error) {
      console.error('Error setting API keys:', error);
      dialog.showErrorBox('Error', `Failed to set API keys: ${error}`);
    }
  }

  /**
   * Show dialog for both API keys
   */
  private async showApiKeysDialog(): Promise<{openai: string, firecrawl: string} | null> {
    if (!this.mainWindow) return null;

    const { ipcMain } = require('electron');

    return new Promise((resolve) => {
      const inputWindow = new BrowserWindow({
        parent: this.mainWindow!,
        modal: true,
        width: 450,
        height: 350,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false,
        title: 'API Keys Configuration',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
        },
      });

      const cleanup = () => {
        ipcMain.removeListener('api-keys-input', onKeys);
      };
  
      const onKeys = (_evt: Electron.IpcMainEvent, data: { openai: string; firecrawl: string } | null) => {
        cleanup();
        if (!inputWindow.isDestroyed()) inputWindow.close();
        resolve(data ?? null);
      };
  
      ipcMain.once('api-keys-input', onKeys);
  
      const html = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>API Keys</title>
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; padding:20px; background:#f5f5f5;}
            .card { background:#fff; padding:16px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,.08);}
            h3 { margin:0 0 8px; }
            label { display:block; margin:12px 0 6px; font-weight:500; }
            input { width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; }
            .actions { margin-top:16px; text-align:right; }
            button { padding:8px 14px; border:0; border-radius:6px; cursor:pointer; }
            .cancel { background:#eee; margin-right:8px; }
            .ok { background:#0078d4; color:#fff; }
          </style>
        </head>
        <body>
          <div class="card">
            <h3>API Keys Configuration</h3>
            <p>Enter keys for this session:</p>
            <label for="openaiKey">OpenAI API Key</label>
            <input type="password" id="openaiKey" placeholder="sk-..." autocomplete="off" />
            <label for="firecrawlKey">Firecrawl API Key</label>
            <input type="password" id="firecrawlKey" placeholder="fc-..." autocomplete="off" />
            <div class="actions">
              <button class="cancel" id="btnCancel">Cancel</button>
              <button class="ok" id="btnOk">OK</button>
            </div>
          </div>
          <script>
            const send = (payload) => window.electronAPI?.sendApiKeys(payload);
      
            document.getElementById('btnOk').addEventListener('click', () => {
              const openai = document.getElementById('openaiKey').value.trim();
              const firecrawl = document.getElementById('firecrawlKey').value.trim();
              if (!openai || !firecrawl) { alert('Please enter both API keys'); return; }
              send({ openai, firecrawl });
              window.close();
            });
  
            document.getElementById('btnCancel').addEventListener('click', () => {
              send(null);
              window.close();
            });
  
            document.getElementById('openaiKey').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') document.getElementById('firecrawlKey').focus();
            });
            document.getElementById('firecrawlKey').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') document.getElementById('btnOk').click();
            });
  
            // Focus on load
            setTimeout(() => document.getElementById('openaiKey').focus(), 0);
          </script>
        </body>
        </html>
      `;
  
      inputWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      inputWindow.once('ready-to-show', () => inputWindow.show());
  
      inputWindow.on('closed', () => {
        cleanup();
        // If user closes the window without sending anything
        resolve(null);
      });
    });
  }
}