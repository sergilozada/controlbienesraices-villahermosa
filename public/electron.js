import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Crear ventana
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js') // opcional
    },
    icon: path.join(__dirname, 'icon.png') // opcional: agregar icono
  });

  // En desarrollo: carga desde localhost
  // En producción: carga desde los archivos compilados
  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Abre DevTools en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Cuando Electron esté listo
app.on('ready', createWindow);

// Salir cuando todas las ventanas se cierren
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-crear ventana si la app se activa (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Menú simple
const template = [
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Salir',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Ver',
    submenu: [
      {
        label: 'Recargar',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          mainWindow.reload();
        }
      },
      {
        label: 'DevTools',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          mainWindow.webContents.openDevTools();
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
