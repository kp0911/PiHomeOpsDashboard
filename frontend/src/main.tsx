import React, { useEffect, useState } from "react";
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
          <div><strong>Pi setup</strong><span>Pending hardware access</span></div>
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

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    const data = new FormData();
    data.set("file", file);
    try {
      await api<StoredFile>(`/files/upload?path=${encodeURIComponent(currentPath)}`, { method: "POST", body: data });
      await refresh();
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
        const first = event.dataTransfer.files[0];
        if (first) uploadFile(first);
      }}>
        {busy ? "Uploading..." : `Drop files into ${currentPath}`}
      </div>
      {files.length === 0 && <div className="empty-drive">{searching ? "No matching files." : "This folder is empty."}</div>}
      {folders.length > 0 && <FileSection title={searching ? "Matching folders" : "Folders"} files={folders} onOpen={openItem} onPreview={previewFile} onDownload={downloadFile} onRename={renameFile} onDelete={deleteFile} />}
      {documents.length > 0 && <FileSection title={searching ? "Matching files" : "Files"} files={documents} onOpen={openItem} onPreview={previewFile} onDownload={downloadFile} onRename={renameFile} onDelete={deleteFile} />}
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

function FileSection({ title, files, onOpen, onPreview, onDownload, onRename, onDelete }: {
  title: string;
  files: StoredFile[];
  onOpen: (file: StoredFile) => void;
  onPreview: (file: StoredFile) => void;
  onDownload: (file: StoredFile) => void;
  onRename: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
}) {
  return (
    <div className="file-section">
      <h3>{title}</h3>
      <div className="file-grid">
        {files.map((file) => (
          <article className="file-tile" key={file.id} onDoubleClick={() => onOpen(file)}>
            <button className="file-tile-main" onClick={() => onOpen(file)}>
              <span className={file.directory ? "file-icon folder-icon" : "file-icon document-icon"}>
                {file.directory ? <Folder size={34} /> : <FileText size={34} />}
              </span>
              <span className="file-tile-name">{file.originalName}</span>
              <span className="file-tile-meta">{file.directory ? "Folder" : formatBytes(file.sizeBytes)}</span>
            </button>
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
