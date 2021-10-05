'use strict'

const { app, shell, ipcMain, session, BrowserWindow, Menu } = require('electron')
const photoUpload = require('./methods/photo/upload.js')

// disable CORS, and SSL check
// https://github.com/electron/electron/issues/20710
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('ignore-certificate-errors')

let mainWindow
function createMainWindow () {

  let titleBarStyle = 'default'
  if (process.platform === 'darwin') {
    titleBarStyle = 'hiddenInset'
  }

  const window = new BrowserWindow({ 
    show: false,
    webPreferences: {
      webSecurity: false, // https://github.com/electron/electron/issues/20710
      allowRunningInsecureContent: true,
      devTools: true,
      nodeIntegration: true,
      textAreasAreResizable: false,
      webgl: false
    },
    title: 'Vkontakte.Store',
    autoHideMenuBar: true,
    titleBarStyle: titleBarStyle,
    width: 1054, minWidth:  800,
    height: 680, minHeight: 400,
    backgroundColor: '#5181b8'
  })
  
  // Убираем меню вверху в windows и linux
  window.setMenu(null)
  window.setMenuBarVisibility(false)

  window.loadURL(process.env.siteURL || 'https://vkontakte.store')


  // Open external links in default system browser
  // https://www.grzegorowski.com/electron-open-in-new-window
  window.webContents.on('new-window', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  window.on('enter-full-screen', ()=>{
    window.webContents.send('toggle-fullscreen', 'enter')
  })
  window.on('leave-full-screen', ()=>{
    window.webContents.send('toggle-fullscreen', 'leave')
  })

  // Photo upload
  ipcMain.on('photo:uploaderExist?', e => {
    e.sender.send('photo:uploaderExist', { uploaderExist: true })
  })
  ipcMain.on('photo:upload', async (e, { msgId, url, server }) => {
    let uploadResult = { error: 'Unknow error' }
    try {
      uploadResult = await photoUpload(url, server)
    } catch (err) {
      uploadResult.error = err.message
    }
    e.sender.send('photo:uploaded:'+msgId, uploadResult)
  })

  // clear all cookies on logout
  ipcMain.on('clear-cookie', ()=>{
    session.defaultSession.clearStorageData()
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


// set menu
Menu.setApplicationMenu(Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      { role: 'quit' }
    ]
  },
  
  // без этого меню(Paste) cmd+v не работает 
  // https://pracucci.com/atom-electron-enable-copy-and-paste.html
  {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'togglefullscreen' },
      { type: 'separator' },
      // { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      // { type: 'separator' },
      // { role: 'resetzoom' },
      // { role: 'zoomin' },
      // { role: 'zoomout' },
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://vk.com/vkstorevk')
        }
      }
    ]
  }
]))