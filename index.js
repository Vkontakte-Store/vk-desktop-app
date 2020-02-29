'use strict'

const { app, BrowserWindow } = require('electron')

const isDevelopment = process.env.NODE_ENV !== 'production'

let mainWindow

function createMainWindow () {
  const window = new BrowserWindow({ 
    webPreferences: {
      webSecurity: false,
      devTools: isDevelopment,
      nodeIntegration: true,
    },
    width: 1054, minWidth:  800,
    height: 680, minHeight: 400,
  })

  window.loadURL('https://vkontakte.store')

  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.on('devtools-opened', () => {
    window.focus()
    setImmediate(() => {
      window.focus()
    })
  })

  return window
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow()
  }
})

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow()
})
