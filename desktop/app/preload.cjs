/*
 * The only bridge between Korasa's pages and the desktop shell. Pages never
 * get Node or Electron access; they can ask the shell to save a PDF.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("korasaDesktop", {
  /** Render a /print/... route to a vector PDF and save it where the user picks. */
  exportPdf: (printPath, filename) => ipcRenderer.invoke("korasa:export-pdf", { printPath, filename }),
});
