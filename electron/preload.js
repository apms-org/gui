"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Map();

ipcRenderer.on("apm:event", (_e, msg) => {
  if (!msg || typeof msg.event !== "string") return;
  const set = listeners.get(msg.event);
  if (!set) return;
  for (const cb of Array.from(set)) {
    try {
      cb(msg.data);
    } catch (err) {
      console.error(err);
    }
  }
});

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("apmNative", {
  call: (method, params) => invoke("apm:call", method, params),
  on: (event, cb) => {
    if (typeof event !== "string" || typeof cb !== "function") return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => {
      const set = listeners.get(event);
      if (set) set.delete(cb);
    };
  },
  clipboard: {
    write: (text, opts) => invoke("apm:clipboard-write", text, opts || {}),
    clear: () => invoke("apm:clipboard-clear")
  },
  dialog: {
    save: (opts) => invoke("apm:dialog-save", opts || {}),
    open: (opts) => invoke("apm:dialog-open", opts || {})
  },
  files: {
    write: (path, data, opts) => invoke("apm:files-write", path, data, opts || {}),
    read: (path) => invoke("apm:files-read", path)
  },
  shell: {
    openExternal: (url) => invoke("apm:shell-open", url),
    showItemInFolder: (path) => invoke("apm:shell-show", path)
  },
  app: {
    info: () => invoke("apm:app-info"),
    getVaultPath: () => invoke("apm:app-vault-path"),
    defaultVaultPath: () => invoke("apm:app-default-vault-path"),
    setVaultPath: (path) => invoke("apm:app-set-vault-path", path),
    cliStatus: () => invoke("apm:app-cli-status"),
    installCli: () => invoke("apm:app-cli-install"),
    uninstallCli: () => invoke("apm:app-cli-uninstall"),
    updateCli: () => invoke("apm:app-cli-update"),
    relaunch: () => invoke("apm:app-relaunch"),
    quit: () => invoke("apm:app-quit")
  },
  menu: {
    setState: (state) => ipcRenderer.send("apm:menu-state", state || {})
  },
  touchId: {
    info: () => invoke("apm:touchid-info"),
    slot: (slot) => ipcRenderer.send("apm:touchid-slot", slot || null),
    cancel: () => ipcRenderer.send("apm:touchid-cancel")
  },
  platform: process.platform
});
