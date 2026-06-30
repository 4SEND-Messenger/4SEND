const { app, BrowserWindow } = require('electron');
const path = require('path');

const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
    app.quit();
} else {
    let win = null;

    function createWindow() {
        if (win) return;

        win = new BrowserWindow({
            width: 1100,
            height: 750,
            title: "4SEND - Messenger",
            backgroundColor: '#0e0e14',
            icon: path.join(__dirname, 'ico.ico'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                spellcheck: true
            }
        });

        win.setMenu(null);
        
        win.loadURL('https://4send-messenger.hf.space/');

        win.on('closed', () => {
            win = null;
        });
    }

    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(createWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
