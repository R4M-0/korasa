/*
 * Korasa desktop packaging (electron-builder). scripts/build-desktop.mjs stages
 * desktop/app into a temp folder outside the repo and points electron-builder
 * at it, so no project node_modules can leak into the app — the bundled
 * server in resources/server is fully self-contained.
 */
const path = require("node:path");

const root = path.resolve(__dirname, "..");

module.exports = {
  appId: "app.korasa.desktop",
  productName: "Korasa",
  copyright: "Copyright © 2026 Korasa",
  electronVersion: require(path.join(root, "node_modules", "electron", "package.json")).version,
  npmRebuild: false,
  asar: true,
  directories: {
    buildResources: path.join(root, "desktop", "resources"),
    output: path.join(root, "dist-desktop"),
  },
  files: ["**/*"],
  // Copy from the parent folder: electron-builder always drops a node_modules
  // directory at the root of a copied folder, which would strip the server's
  // dependencies. As "server/node_modules" it is kept.
  extraResources: [
    {
      from: path.join(root, "desktop", "build", "${platform}-${arch}"),
      to: ".",
      filter: ["server/**/*"],
    },
  ],
  // Stable names so "releases/latest/download/<name>" links never change.
  artifactName: "Korasa-${os}-${arch}.${ext}",

  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Office",
    synopsis: "Local-first notebook for A4 notes and diagrams",
    maintainer: "R4M-0 <omar.chiboub.w@gmail.com>",
    // Lets desktop environments match the running window to its launcher.
    syncDesktopName: true,
  },
  appImage: { artifactName: "Korasa-linux-x86_64.AppImage" },
  deb: { artifactName: "Korasa-linux-amd64.deb" },

  win: { target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    artifactName: "Korasa-windows-x64-setup.exe",
  },

  mac: {
    target: [{ target: "dmg", arch: ["arm64", "x64"] }],
    category: "public.app-category.productivity",
    // Ad-hoc signature (required to run on Apple Silicon). Without notarisation
    // the hardened runtime only causes library-validation launch failures.
    identity: "-",
    hardenedRuntime: false,
  },
  dmg: { artifactName: "Korasa-mac-${arch}.${ext}" },

  publish: {
    provider: "github",
    owner: "R4M-0",
    repo: "korasa",
    // CI uploads to a draft; publish it on GitHub once the installers are checked.
    releaseType: "draft",
  },
};
