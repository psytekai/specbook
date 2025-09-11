import { app, BrowserWindow, shell, protocol } from 'electron';
import path from 'node:path';
import * as fs from 'fs';
import { ApplicationMenu } from './menu/ApplicationMenu';
import { setupProjectIPC } from './ipc/projectHandlers';
import { setupAPIIPC } from './ipc/apiHandlers';
import { setupAssetIPC } from './ipc/assetHandlers';
import { ProjectState } from './services/ProjectState';
import { AssetManager } from './services/AssetManager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Register the asset protocol as a standard scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: false
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let applicationMenu: ApplicationMenu | null = null;

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    frame: true,
    title: 'Specbook Manager',
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    icon: path.join(__dirname, '../../public/icons/icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize application menu and project state
  applicationMenu = ApplicationMenu.getInstance();
  applicationMenu.setMainWindow(mainWindow);
  applicationMenu.createApplicationMenu();

  return mainWindow;
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set up IPC handlers first
  setupProjectIPC();
  setupAPIIPC();
  setupAssetIPC();
  
  // Register custom asset:// protocol for serving images
  console.log('🎯 Registering asset:// protocol handler');
  protocol.registerFileProtocol('asset', async (request, callback) => {
    console.log(`🔍 Asset protocol request: ${request.url}`);
    try {
      const projectState = ProjectState.getInstance();
      const state = projectState.getStateInfo();

      if (!state.isOpen || !state.project?.path) {
        console.warn('Asset protocol: No project open');
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      // Parse asset hash from URL (asset://hash)
      // Extract hash directly from URL string since asset://hash creates invalid URL format
      const urlString = request.url;
      const assetPrefix = 'asset://';
      
      if (!urlString.startsWith(assetPrefix)) {
        console.warn('Asset protocol: Invalid URL format');
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }
      
      // Extract everything after asset:// and remove trailing slashes
      const urlSuffix = urlString.substring(assetPrefix.length);
      const hash = urlSuffix.replace(/\/+$/, '');

      if (!hash) {
        console.warn('Asset protocol: Invalid hash');
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      console.log(`Asset protocol: Requesting asset for hash: ${hash}`);
      
      // Create AssetManager and get asset path
      const assetManager = new AssetManager(state.project.path);
      const assetPath = await assetManager.getAssetPath(hash);

      console.log(`Asset protocol: Resolved path: ${assetPath}`);

      // Verify file exists
      if (!fs.existsSync(assetPath)) {
        console.warn(`Asset protocol: File not found at ${assetPath}`);
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      console.log(`Asset protocol: Successfully serving file: ${assetPath}`);
      callback({ path: assetPath });
    } catch (error) {
      console.error('Asset protocol error:', error);
      callback({ error: -6 }); // FILE_NOT_FOUND
    }
  });
  
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});