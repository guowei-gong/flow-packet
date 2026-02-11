import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let goProcess: ChildProcess | null = null
let backendPort: number | null = null

function getGoExecutablePath(): string {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    // 开发模式：使用 go run 或预编译的二进制
    return path.join(__dirname, '..', 'apps', 'server', 'cmd', 'flow-packet')
  }
  // 生产模式：打包的二进制文件
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(process.resourcesPath, 'go-backend', `flow-packet${ext}`)
}

function startGoBackend(): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Go backend startup timeout (10s)'))
    }, 10000)

    const isDev = !!process.env.VITE_DEV_SERVER_URL
    let cmd: string
    let args: string[]

    if (isDev) {
      cmd = 'go'
      args = ['run', '.']
    } else {
      cmd = getGoExecutablePath()
      args = []
    }

    const cwd = isDev
      ? path.join(__dirname, '..', 'apps', 'server', 'cmd', 'flow-packet')
      : undefined

    goProcess = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    goProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      const match = output.match(/PORT:(\d+)/)
      if (match) {
        const port = parseInt(match[1])
        clearTimeout(timeout)
        resolve(port)
      }
    })

    goProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[go-backend]', data.toString())
    })

    goProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    goProcess.on('exit', (code) => {
      console.log(`[go-backend] exited with code ${code}`)
      goProcess = null
    })
  })
}

function stopGoBackend(): Promise<void> {
  return new Promise((resolve) => {
    if (!goProcess) {
      resolve()
      return
    }

    const forceTimeout = setTimeout(() => {
      if (goProcess) {
        goProcess.kill('SIGKILL')
        goProcess = null
      }
      resolve()
    }, 5000)

    goProcess.on('exit', () => {
      clearTimeout(forceTimeout)
      goProcess = null
      resolve()
    })

    // 发送 SIGTERM 请求优雅退出
    if (process.platform === 'win32') {
      goProcess.kill()
    } else {
      goProcess.kill('SIGTERM')
    }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#16162A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../apps/renderer/dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC: 渲染进程获取后端端口号
ipcMain.handle('get-backend-port', () => backendPort)

app.whenReady().then(async () => {
  try {
    backendPort = await startGoBackend()
    console.log(`[go-backend] started on port ${backendPort}`)
  } catch (err) {
    console.error('[go-backend] failed to start:', err)
  }

  await createWindow()
})

app.on('window-all-closed', async () => {
  await stopGoBackend()
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  await stopGoBackend()
})
