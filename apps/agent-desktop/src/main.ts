import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import QRCode from "qrcode";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentConfig } from "@remote/agent/config";
import { AgentDesktopRuntime } from "./agentDesktopRuntime.js";
import type { DesktopState } from "./desktopState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let runtime: AgentDesktopRuntime | null = null;
let isQuitting = false;

function createTrayImage(state?: DesktopState) {
  const color = state?.connectionStatus === "online" ? "#2e7d32" : state?.terminalEnabled ? "#c77700" : "#777777";
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="${color}"/></svg>`
  );
  return nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 620,
    minWidth: 560,
    minHeight: 520,
    title: "Terminal First Agent",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(join(__dirname, "renderer", "index.html"));
  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  return window;
}

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow();
  }

  mainWindow.show();
  mainWindow.focus();
}

function updateTray(state: DesktopState): void {
  if (!tray) {
    tray = new Tray(createTrayImage(state));
    tray.setToolTip("Terminal First Agent");
    tray.on("click", showMainWindow);
  }

  tray.setImage(createTrayImage(state));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: state.deviceName,
        enabled: false
      },
      {
        label: `Status: ${state.connectionStatus}`,
        enabled: false
      },
      { type: "separator" },
      {
        label: "Show Window",
        click: showMainWindow
      },
      {
        label: state.terminalEnabled ? "Turn Terminal Off" : "Turn Terminal On",
        click: () => {
          runtime?.setTerminalEnabled(!runtime.getState().terminalEnabled);
          const nextState = runtime?.getState();
          if (nextState) {
            broadcastState(nextState);
          }
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          runtime?.stop();
          app.quit();
        }
      }
    ])
  );
}

function broadcastState(state: DesktopState): void {
  updateTray(state);
  mainWindow?.webContents.send("agent:state", state);
}

function getRuntime(): AgentDesktopRuntime {
  if (!runtime) {
    throw new Error("Agent runtime is not initialized.");
  }

  return runtime;
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  runtime = new AgentDesktopRuntime(loadAgentConfig(), {
    createQrDataUrl: (payload) =>
      QRCode.toDataURL(payload, {
        margin: 1,
        width: 240
      }),
    onStateChange: broadcastState
  });
  updateTray(runtime.getState());
  runtime.start();

  ipcMain.handle("agent:get-state", () => getRuntime().getState());
  ipcMain.handle("agent:set-terminal-enabled", (_event, enabled: unknown) => {
    getRuntime().setTerminalEnabled(Boolean(enabled));
    return getRuntime().getState();
  });
  ipcMain.handle("agent:approve-pairing", () => {
    getRuntime().approvePairing();
    return getRuntime().getState();
  });
  ipcMain.handle("agent:reject-pairing", () => {
    getRuntime().rejectPairing();
    return getRuntime().getState();
  });
  ipcMain.handle("agent:show-window", () => {
    showMainWindow();
    return getRuntime().getState();
  });
  ipcMain.handle("agent:quit", () => {
    isQuitting = true;
    getRuntime().stop();
    app.quit();
  });
});

app.on("activate", () => {
  showMainWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  runtime?.stop();
});
