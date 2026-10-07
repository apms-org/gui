"use strict";

// Preload for the approval panel. It exposes only what the panel needs: no
// generic backend call. The main process checks every message (approvals.js).

const { contextBridge, ipcRenderer } = require("electron");

function listen(channel) {
  return (cb) => {
    if (typeof cb !== "function") return () => {};
    const fn = (_e, data) => {
      try { cb(data); } catch (err) { console.error(err); }
    };
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  };
}

contextBridge.exposeInMainWorld("apmApproval", {
  onShow: listen("approval:show"),
  onResolved: listen("approval:resolved"),
  onTouch: listen("approval:touch"),
  decide: (id, approve, via) => ipcRenderer.invoke("approval:decide", id, approve, via),
  touchSlot: (rect) => ipcRenderer.send("approval:touch-slot", rect || null),
  size: (height) => ipcRenderer.send("approval:size", height),
  info: () => ipcRenderer.invoke("approval:info")
});
