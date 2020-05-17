'use strict'

const { app, shell, BrowserWindow } = require('electron')

let mainWindow

function createMainWindow () {

  let titleBarStyle = 'default'
  if (process.platform === 'darwin') {
    titleBarStyle = 'hiddenInset'
  }

  const window = new BrowserWindow({ 
    show: false,
    webPreferences: {
      webSecurity: false,
      devTools: true,
      nodeIntegration: true,
    },
    titleBarStyle: titleBarStyle,
    width: 1054, minWidth:  800,
    height: 680, minHeight: 400,
    backgroundColor: '#5181b8'
  })
  
  // Убираем меню вверху в windows и linux
  window.setMenu(null)

  window.loadURL('https://vkontakte.store')
  // window.loadURL('http://localhost:3000')

  // Open external links in default system browser
  // https://www.grzegorowski.com/electron-open-in-new-window
  window.webContents.on('new-window', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  window.webContents.on('devtools-opened', () => {
    window.focus()
    setImmediate(() => {
      window.focus()
    })
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.on('closed', () => {
    mainWindow = null
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

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow()
})
