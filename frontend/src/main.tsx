import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, Eye, FileText, Folder, FolderPlus, HardDrive, Home, LogOut, Pencil, Search, Shield, Trash2, Upload, X } from "lucide-react";
import { api, apiBlob, login, setToken, token } from "./lib/api";
import "./styles.css";

type StoredFile = {
  id: string;
  originalName: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  directory: boolean;
  createdAt: string;
};

type PreviewState = {
  file: StoredFile;
  url: string;
  text?: string;
};

type AuditLog = {
  id: string;
  eventType: string;
  ipAddress: string | null;
  target: string | null;
  detail: string | null;
  createdAt: string;
};

type StorageStats = {
  path: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
};

function folderTargetFromPoint(x: number, y: number) {
  if (!x && !y) return null;
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-folder-path][data-folder-id]");
  if (!element) return null;
  return {
    id: element.dataset.folderId ?? "",
    path: element.dataset.folderPath ?? ""
  };
}

function App() {
  const [authed, setAuthed] = useState(Boolean(token()));

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;
  return <Shell onLogout={() => { setToken(null); setAuthed(false); }} />;
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(username, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <h1>Pi HomeOps NAS</h1>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"files" | "audit">("files");
  const [storage, setStorage] = useState<StorageStats | null>(null);

  useEffect(() => {
    api<StorageStats>("/system/storage").then(setStorage).catch(() => setStorage(null));
  }, []);

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <HardDrive size={24} />
          <span>HomeOps NAS</span>
        </div>
        <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}><FileText size={18} /> Files</button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><Shield size={18} /> Audit</button>
        <button onClick={onLogout}><LogOut size={18} /> Logout</button>
      </aside>
      <main>
        <section className="status-grid">
          <div><strong>NAS root</strong><span>/mnt/nas</span></div>
          <div><strong>Access model</strong><span>Tailscale-first</span></div>
          <div>
            <strong>NAS storage</strong>
            {storage ? (
              <>
                <span>{formatBytes(storage.availableBytes)} free of {formatBytes(storage.totalBytes)}</span>
                <meter min={0} max={100} value={storage.usedPercent} />
              </>
            ) : (
              <span>Unavailable</span>
            )}
          </div>
        </section>
        {tab === "files" ? <FileManager /> : <AuditPage />}
      </main>
    </div>
  );
}

function FileManager() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [currentPath, setCurrentPath] = useState("/uploads");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [hoveredFolder, setHoveredFolder] = useState<{ id: string; path: string } | null>(null);
  const [pointerDraggingFileId, setPointerDraggingFileId] = useState<string | null>(null);
  const dropHandledRef = useRef(false);
  const pointerDragRef = useRef<{ fileId: string; startX: number; startY: number; active: boolean } | null>(null);
  const suppressOpenRef = useRef(false);
  const moveFileRef = useRef(moveFile);

  async function refresh() {
    try {
      setError("");
      if (query.trim()) {
        setSearching(true);
        setFiles(await api<StoredFile[]>(`/files/search?query=${encodeURIComponent(query.trim())}`));
      } else {
        setSearching(false);
        setFiles(await api<StoredFile[]>(`/files?path=${encodeURIComponent(currentPath)}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    }
  }

  async function uploadFile(file: File, targetPath = currentPath) {
    setBusy(true);
    setError("");
    const data = new FormData();
    data.set("file", file);
    try {
      await api<StoredFile>(`/files/upload?path=${encodeURIComponent(targetPath)}`, { method: "POST", body: data });
      if (targetPath !== currentPath || query.trim()) {
        setQuery("");
        setCurrentPath(targetPath);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(file: StoredFile) {
    try {
      const blob = await apiBlob(`/files/download/${file.id}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function previewFile(file: StoredFile) {
    try {
      closePreview();
      const blob = await apiBlob(`/files/preview/${file.id}`);
      const url = URL.createObjectURL(blob);
      const next: PreviewState = { file, url };
      if (isText(file)) {
        next.text = await blob.text();
      }
      setPreview(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function renameFile(file: StoredFile) {
    const nextName = window.prompt("New file name. If you omit the extension, the current extension is kept.", file.originalName);
    if (!nextName || nextName === file.originalName) return;
    try {
      await api<StoredFile>(`/files/rename/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName })
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function createFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;
    try {
      await api<StoredFile>("/files/folder", {
        method: "POST",
        body: JSON.stringify({ parentPath: currentPath, name })
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create folder failed");
    }
  }

  function openItem(file: StoredFile) {
    if (file.directory) {
      setQuery("");
      setCurrentPath(file.relativePath);
      return;
    }
    previewFile(file);
  }

  async function deleteFile(file: StoredFile) {
    if (!window.confirm(`Move "${file.originalName}" to trash?`)) return;
    try {
      await api<StoredFile>(`/files/${file.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function moveFile(fileId: string, targetParentPath: string) {
    try {
      await api<StoredFile>(`/files/move/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ targetParentPath })
      });
      if (query.trim()) {
        setQuery("");
        setCurrentPath(targetParentPath);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
    }
  }

  moveFileRef.current = moveFile;

  function startInternalDrag(fileId: string) {
    dropHandledRef.current = false;
    setDraggedFileId(fileId);
  }

  function moveFileFromDrop(fileId: string, targetParentPath: string) {
    dropHandledRef.current = true;
    void moveFile(fileId, targetParentPath);
  }

  function finishInternalDrag(fileId: string, releaseTarget?: { id: string; path: string } | null) {
    const target = releaseTarget ?? hoveredFolder;
    setDraggedFileId(null);
    setHoveredFolder(null);
    if (!dropHandledRef.current && target && target.id !== fileId) {
      void moveFile(fileId, target.path);
    }
  }

  function beginPointerDrag(fileId: string, event: React.PointerEvent) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest(".tile-actions")) return;
    pointerDragRef.current = {
      fileId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
  }

  function openFromTile(file: StoredFile) {
    if (suppressOpenRef.current) return;
    openItem(file);
  }

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  useEffect(() => {
    refresh();
    return () => closePreview();
  }, [currentPath]);

  useEffect(() => {
    const timer = window.setTimeout(() => refresh(), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = pointerDragRef.current;
      if (!drag) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.active && distance < 6) return;
      if (!drag.active) {
        drag.active = true;
        dropHandledRef.current = false;
        setDraggedFileId(drag.fileId);
        setPointerDraggingFileId(drag.fileId);
      }
      const target = folderTargetFromPoint(event.clientX, event.clientY);
      setHoveredFolder(target && target.id !== drag.fileId ? target : null);
    }

    function onPointerUp(event: PointerEvent) {
      const drag = pointerDragRef.current;
      pointerDragRef.current = null;
      if (!drag) return;
      const target = folderTargetFromPoint(event.clientX, event.clientY);
      setDraggedFileId(null);
      setPointerDraggingFileId(null);
      setHoveredFolder(null);
      if (drag.active) {
        suppressOpenRef.current = true;
        window.setTimeout(() => {
          suppressOpenRef.current = false;
        }, 0);
      }
      if (drag.active && target && target.id !== drag.fileId) {
        void moveFileRef.current(drag.fileId, target.path);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const folders = files.filter((file) => file.directory);
  const documents = files.filter((file) => !file.directory);

  return (
    <section className="workspace">
      <div className="file-manager-header">
        <div>
          <h2>File Manager</h2>
          <Breadcrumb path={currentPath} onChange={(path) => { setQuery(""); setCurrentPath(path); }} />
        </div>
        <div className="file-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files" />
          </div>
          <button title="New folder" onClick={createFolder}><FolderPlus size={18} /></button>
          <label className="icon-button" title="Upload">
            <Upload size={18} />
          <input type="file" onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])} />
          </label>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        if (draggedFileId || event.dataTransfer.getData("application/x-homeops-file-id")) return;
        const first = event.dataTransfer.files[0];
        if (first) uploadFile(first);
      }}>
        {busy ? "Uploading..." : `Drop files into ${currentPath}`}
      </div>
      {files.length === 0 && <div className="empty-drive">{searching ? "No matching files." : "This folder is empty."}</div>}
      {folders.length > 0 && <FileSection title={searching ? "Matching folders" : "Folders"} files={folders} draggedFileId={draggedFileId} hoveredFolderId={hoveredFolder?.id ?? null} pointerDraggingFileId={pointerDraggingFileId} onPointerDragStart={beginPointerDrag} onDragStart={startInternalDrag} onDragEnd={finishInternalDrag} onHoverFolder={setHoveredFolder} onOpen={openFromTile} onPreview={previewFile} onDownload={downloadFile} onRename={renameFile} onDelete={deleteFile} onDropIntoFolder={uploadFile} onMoveIntoFolder={moveFileFromDrop} />}
      {documents.length > 0 && <FileSection title={searching ? "Matching files" : "Files"} files={documents} draggedFileId={draggedFileId} hoveredFolderId={hoveredFolder?.id ?? null} pointerDraggingFileId={pointerDraggingFileId} onPointerDragStart={beginPointerDrag} onDragStart={startInternalDrag} onDragEnd={finishInternalDrag} onHoverFolder={setHoveredFolder} onOpen={openFromTile} onPreview={previewFile} onDownload={downloadFile} onRename={renameFile} onDelete={deleteFile} onDropIntoFolder={uploadFile} onMoveIntoFolder={moveFileFromDrop} />}
      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
    </section>
  );
}

function Breadcrumb({ path, onChange }: { path: string; onChange: (path: string) => void }) {
  const parts = path.split("/").filter(Boolean);
  const crumbs = parts.map((part, index) => ({
    label: index === 0 ? "Uploads" : part,
    path: "/" + parts.slice(0, index + 1).join("/")
  }));

  return (
    <nav className="breadcrumb">
      <button title="Uploads" onClick={() => onChange("/uploads")}><Home size={15} /></button>
      {crumbs.slice(1).map((crumb) => (
        <React.Fragment key={crumb.path}>
          <span>/</span>
          <button onClick={() => onChange(crumb.path)}>{crumb.label}</button>
        </React.Fragment>
      ))}
    </nav>
  );
}

function FileSection({ title, files, draggedFileId, hoveredFolderId, pointerDraggingFileId, onPointerDragStart, onDragStart, onDragEnd, onHoverFolder, onOpen, onPreview, onDownload, onRename, onDelete, onDropIntoFolder, onMoveIntoFolder }: {
  title: string;
  files: StoredFile[];
  draggedFileId: string | null;
  hoveredFolderId: string | null;
  pointerDraggingFileId: string | null;
  onPointerDragStart: (fileId: string, event: React.PointerEvent) => void;
  onDragStart: (fileId: string) => void;
  onDragEnd: (fileId: string, releaseTarget?: { id: string; path: string } | null) => void;
  onHoverFolder: (folder: { id: string; path: string } | null) => void;
  onOpen: (file: StoredFile) => void;
  onPreview: (file: StoredFile) => void;
  onDownload: (file: StoredFile) => void;
  onRename: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
  onDropIntoFolder: (file: File, targetPath: string) => void;
  onMoveIntoFolder: (fileId: string, targetPath: string) => void;
}) {
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  function folderFromEventTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return null;
    const element = target.closest<HTMLElement>("[data-folder-path][data-folder-id]");
    if (!element) return null;
    return {
      id: element.dataset.folderId ?? "",
      path: element.dataset.folderPath ?? ""
    };
  }

  function handleSectionDrag(event: React.DragEvent) {
    const target = folderFromEventTarget(event.target);
    if (!target || !draggedFileId || target.id === draggedFileId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetId(target.id);
    onHoverFolder(target);
  }

  function handleSectionDrop(event: React.DragEvent) {
    const target = folderFromEventTarget(event.target);
    const internalFileId = draggedFileId || event.dataTransfer.getData("application/x-homeops-file-id");
    if (!target || !internalFileId || target.id === internalFileId) return;
    event.preventDefault();
    event.stopPropagation();
    setDragTargetId(null);
    onHoverFolder(null);
    onMoveIntoFolder(internalFileId, target.path);
  }

  function handleFolderDrag(event: React.DragEvent, file: StoredFile) {
    if (!file.directory) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = draggedFileId ? "move" : "copy";
    setDragTargetId(file.id);
    if (draggedFileId && draggedFileId !== file.id) {
      onHoverFolder({ id: file.id, path: file.relativePath });
    }
  }

  function handleFolderDrop(event: React.DragEvent, file: StoredFile) {
    if (!file.directory) return;
    event.preventDefault();
    event.stopPropagation();
    setDragTargetId(null);
    onHoverFolder(null);
    const internalFileId = draggedFileId || event.dataTransfer.getData("application/x-homeops-file-id");
    if (internalFileId) {
      if (internalFileId !== file.id) onMoveIntoFolder(internalFileId, file.relativePath);
      return;
    }
    const first = event.dataTransfer.files[0];
    if (first) onDropIntoFolder(first, file.relativePath);
  }

  return (
    <div className="file-section" onDragOver={handleSectionDrag} onDrop={handleSectionDrop}>
      <h3>{title}</h3>
      <div className="file-grid">
        {files.map((file) => (
          <article
            className={[
              "file-tile",
              file.directory ? "folder-drop-target" : "",
              (dragTargetId === file.id || hoveredFolderId === file.id) ? "drag-over" : "",
              pointerDraggingFileId === file.id ? "is-dragging" : ""
            ].filter(Boolean).join(" ")}
            key={file.id}
            draggable={false}
            data-file-id={file.id}
            data-folder-id={file.directory ? file.id : undefined}
            data-folder-path={file.directory ? file.relativePath : undefined}
            onPointerDown={(event) => onPointerDragStart(file.id, event)}
            onDoubleClick={() => onOpen(file)}
            onDragStart={(event) => {
              onDragStart(file.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-homeops-file-id", file.id);
              event.dataTransfer.setData("text/plain", file.originalName);
            }}
            onDragEnd={(event) => {
              setDragTargetId(null);
              const releaseTarget = folderTargetFromPoint(event.clientX, event.clientY);
              onDragEnd(file.id, releaseTarget);
            }}
            onDragEnter={(event) => handleFolderDrag(event, file)}
            onDragOver={(event) => handleFolderDrag(event, file)}
            onDragLeave={() => {
              setDragTargetId((current) => current === file.id ? null : current);
            }}
            onDrop={(event) => handleFolderDrop(event, file)}
          >
            <div
              className="file-tile-main"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(file)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(file);
                }
              }}
              onDragEnter={(event) => handleFolderDrag(event, file)}
              onDragOver={(event) => handleFolderDrag(event, file)}
              onDrop={(event) => handleFolderDrop(event, file)}
            >
              <span className={file.directory ? "file-icon folder-icon" : "file-icon document-icon"}>
                {file.directory ? <Folder size={34} /> : <FileText size={34} />}
              </span>
              <span className="file-tile-name">{file.originalName}</span>
              <span className="file-tile-meta">{file.directory ? "Folder" : formatBytes(file.sizeBytes)}</span>
            </div>
            <div className="tile-actions">
              <button title="Preview" onClick={() => onPreview(file)} disabled={file.directory}><Eye size={15} /></button>
              <button title="Download" onClick={() => onDownload(file)} disabled={file.directory}><Download size={15} /></button>
              <button title="Rename" onClick={() => onRename(file)}><Pencil size={15} /></button>
              <button title="Move to trash" onClick={() => onDelete(file)}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PreviewDialog({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="preview-dialog">
        <div className="preview-header">
          <h3>{preview.file.originalName}</h3>
          <button title="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="preview-body">
          {isImage(preview.file) && <img src={preview.url} alt={preview.file.originalName} />}
          {isVideo(preview.file) && <video src={preview.url} controls />}
          {isText(preview.file) && <pre>{preview.text}</pre>}
          {!isImage(preview.file) && !isVideo(preview.file) && !isText(preview.file) && (
            <p>This file type cannot be previewed in the browser. Use download instead.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function isImage(file: StoredFile) {
  return file.mimeType?.startsWith("image/") ?? false;
}

function isVideo(file: StoredFile) {
  return file.mimeType?.startsWith("video/") ?? false;
}

function isText(file: StoredFile) {
  return Boolean(file.mimeType?.startsWith("text/") || file.originalName.match(/\.(md|json|csv|log|txt)$/i));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index++) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api<{ content: AuditLog[] }>("/audit").then((page) => setLogs(page.content)).catch(() => setLogs([]));
  }, []);

  return (
    <section className="workspace">
      <h2>Audit Logs</h2>
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.eventType}</td>
              <td>{log.target ?? "-"}</td>
              <td>{log.detail ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
