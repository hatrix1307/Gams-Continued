(function () {
  "use strict";

  const MANIFEST_URL = "https://raw.githubusercontent.com/hatrix1307/Gams-Continued/main/update-manifest.json";
  const RAW_BASE = "https://raw.githubusercontent.com/hatrix1307/Gams-Continued/main/";
  const button = document.getElementById("repoUpdate");
  const status = document.getElementById("repoUpdateStatus");

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function rawUrl(path) {
    return RAW_BASE + path.split("/").map(encodeURIComponent).join("/");
  }

  function makeDirectoryResolver(root) {
    const cache = new Map([["", root]]);
    return async function resolveDirectory(parts, create) {
      let path = "";
      let directory = root;
      for (const part of parts) {
        path = path ? path + "/" + part : part;
        if (cache.has(path)) {
          directory = cache.get(path);
        } else {
          directory = await directory.getDirectoryHandle(part, {create});
          cache.set(path, directory);
        }
      }
      return directory;
    };
  }

  async function getFileHandle(resolveDirectory, path, create) {
    const parts = path.split("/");
    const name = parts.pop();
    const directory = await resolveDirectory(parts, create);
    return directory.getFileHandle(name, {create});
  }

  async function readLocalManifest(resolveDirectory) {
    try {
      const handle = await getFileHandle(resolveDirectory, "update-manifest.json", false);
      return JSON.parse(await (await handle.getFile()).text());
    } catch (_) {
      return null;
    }
  }

  async function sha256(file) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function needsFirstRunUpdate(resolveDirectory, entry) {
    try {
      const handle = await getFileHandle(resolveDirectory, entry.path, false);
      const file = await handle.getFile();
      if (file.size !== entry.size) return true;
      return await sha256(file) !== entry.sha256;
    } catch (_) {
      return true;
    }
  }

  async function fileExistsWithSize(resolveDirectory, entry) {
    try {
      const handle = await getFileHandle(resolveDirectory, entry.path, false);
      return (await handle.getFile()).size === entry.size;
    } catch (_) {
      return false;
    }
  }

  async function writeResponse(resolveDirectory, entry) {
    const response = await fetch(rawUrl(entry.path) + "?version=" + encodeURIComponent(entry.sha256), {cache: "no-store"});
    if (!response.ok) throw new Error(entry.path + " returned HTTP " + response.status);
    const blob = await response.blob();
    if (blob.size !== entry.size) throw new Error(entry.path + " downloaded with the wrong size");
    const handle = await getFileHandle(resolveDirectory, entry.path, true);
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  }

  async function writeManifest(resolveDirectory, manifestText) {
    const handle = await getFileHandle(resolveDirectory, "update-manifest.json", true);
    const writable = await handle.createWritable();
    try {
      await writable.write(manifestText);
    } finally {
      await writable.close();
    }
  }

  async function updateFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error("Folder updating requires a current version of Chrome or Edge.");
    }

    const root = await window.showDirectoryPicker({id: "gams-continued", mode: "readwrite"});
    const resolveDirectory = makeDirectoryResolver(root);
    setStatus("Downloading the latest file manifest…");
    const response = await fetch(MANIFEST_URL + "?time=" + Date.now(), {cache: "no-store"});
    if (!response.ok) throw new Error("The update manifest returned HTTP " + response.status);
    const manifestText = await response.text();
    const remote = JSON.parse(manifestText);
    const local = await readLocalManifest(resolveDirectory);
    const oldHashes = new Map((local?.files || []).map(entry => [entry.path, entry.sha256]));
    const changed = [];

    for (let index = 0; index < remote.files.length; index++) {
      const entry = remote.files[index];
      setStatus("Checking files… " + (index + 1) + "/" + remote.files.length);
      if (local) {
        if (oldHashes.get(entry.path) !== entry.sha256 || !await fileExistsWithSize(resolveDirectory, entry)) changed.push(entry);
      } else if (await needsFirstRunUpdate(resolveDirectory, entry)) {
        changed.push(entry);
      }
    }

    if (!changed.length) {
      await writeManifest(resolveDirectory, manifestText);
      setStatus("This folder is already up to date.");
      return;
    }

    const bytes = changed.reduce((sum, entry) => sum + entry.size, 0);
    const size = bytes < 1048576 ? Math.ceil(bytes / 1024) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
    if (!confirm("Update " + changed.length + " files (" + size + ") in the selected Gams-Continued folder?")) {
      setStatus("Update cancelled.");
      return;
    }

    for (let index = 0; index < changed.length; index++) {
      const entry = changed[index];
      setStatus("Updating " + (index + 1) + "/" + changed.length + ": " + entry.path);
      await writeResponse(resolveDirectory, entry);
    }
    await writeManifest(resolveDirectory, manifestText);
    setStatus("Update complete. Reload Gams.html from the updated folder.");
  }

  if (button) {
    button.addEventListener("click", async function () {
      button.disabled = true;
      try {
        await updateFolder();
      } catch (error) {
        if (error && error.name === "AbortError") setStatus("No folder was selected.");
        else setStatus("Update failed: " + (error?.message || error));
      } finally {
        button.disabled = false;
      }
    });
  }
})();
