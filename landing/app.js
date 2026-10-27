// Korasa landing: point download buttons at the latest GitHub release and
// highlight the visitor's operating system.
(() => {
  const REPO = "R4M-0/korasa";
  const RELEASES = `https://github.com/${REPO}/releases`;
  const latest = (asset) => `${RELEASES}/latest/download/${asset}`;

  const ASSETS = {
    windows: { asset: "Korasa-windows-x64-setup.exe", label: "Download for Windows" },
    "mac-arm64": { asset: "Korasa-mac-arm64.dmg", label: "Download for Mac" },
    "mac-x64": { asset: "Korasa-mac-x64.dmg", label: "Download for Mac (Intel)" },
    linux: { asset: "Korasa-linux-x86_64.AppImage", label: "Download for Linux" },
  };

  for (const a of document.querySelectorAll("[data-asset]")) a.href = latest(a.dataset.asset);

  async function detect() {
    const uaData = navigator.userAgentData;
    const ua = navigator.userAgent;
    const platform = (uaData?.platform || navigator.platform || ua).toLowerCase();
    if (/android|iphone|ipad/.test(ua.toLowerCase())) return null;
    if (platform.includes("win")) return "windows";
    if (platform.includes("linux") || platform.includes("x11")) return "linux";
    if (platform.includes("mac")) {
      try {
        const { architecture } = (await uaData?.getHighEntropyValues?.(["architecture"])) ?? {};
        if (architecture === "x86") return "mac-x64";
      } catch {}
      return "mac-arm64"; // Most Macs sold since 2020 are Apple silicon.
    }
    return null;
  }

  detect().then((os) => {
    const primary = document.getElementById("primary-download");
    const label = document.getElementById("primary-label");
    if (!os) return; // Leave the button scrolling to the download section.
    primary.href = latest(ASSETS[os].asset);
    label.textContent = ASSETS[os].label;
    document.querySelector(`.dl[data-os="${os.split("-")[0]}"]`)?.classList.add("is-current");
  });

  // Show the current version; if nothing is published yet, say so honestly.
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((release) => {
      const version = release.tag_name?.replace(/^v/, "");
      const date = new Date(release.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      document.getElementById("download-version").textContent = `Version ${version} · released ${date} · free`;
      document.getElementById("release-meta").textContent = `Version ${version} · No account. No cloud. Your notes stay yours.`;
    })
    .catch((status) => {
      if (status !== 404) return; // Rate-limited or offline: keep the static text.
      document.getElementById("download-version").innerHTML =
        `The first release is on its way — <a href="${RELEASES}">follow it on GitHub</a>.`;
      for (const a of document.querySelectorAll("[data-asset], #primary-download")) {
        a.href = RELEASES;
      }
    });
})();
