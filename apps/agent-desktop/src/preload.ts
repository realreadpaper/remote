import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("agentDesktop", {
  getState: () => ipcRenderer.invoke("agent:get-state"),
  setTerminalEnabled: (enabled: boolean) => ipcRenderer.invoke("agent:set-terminal-enabled", enabled),
  approvePairing: () => ipcRenderer.invoke("agent:approve-pairing"),
  rejectPairing: () => ipcRenderer.invoke("agent:reject-pairing"),
  showWindow: () => ipcRenderer.invoke("agent:show-window"),
  quit: () => ipcRenderer.invoke("agent:quit"),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("agent:state", listener);
    return () => ipcRenderer.removeListener("agent:state", listener);
  }
});
