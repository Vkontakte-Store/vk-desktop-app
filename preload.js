const { contextBridge, ipcRenderer, shell } = require('electron')

// Пробрасываем api electron в браузер на клиент
// там будет window.electron с перечисленными методами
contextBridge.exposeInMainWorld('electron', {
    shell: {
        openExternal: shell.openExternal
    },
    ipcRenderer: {
        send : ipcRenderer.send,
        on   : (channel, func) => {
            ipcRenderer.on(
                channel,
                (event, ...args) => {
                    func(event, ...args)
                }
            )
        }
    }
})