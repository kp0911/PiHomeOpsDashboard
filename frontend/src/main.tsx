import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, Eye, FileText, Folder, HardDrive, LogOut, Pencil, Shield, Trash2, Upload, X } from "lucide-react";
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

  async function refresh() {
    try {
      setError("");
      setFiles(await api<StoredFile[]>("/files?path=/uploads"));
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
      await api<StoredFile>("/files/upload", { method: "POST", body: data });
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
    const nextName = window.prompt("New file name", file.originalName);
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
  }, []);

  return (
    <section className="workspace">
      <div className="toolbar">
        <h2>File Manager</h2>
        <label className="icon-button">
          <Upload size={18} />
          <input type="file" onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        const first = event.dataTransfer.files[0];
        if (first) uploadFile(first);
      }}>
        {busy ? "Uploading..." : "Drop files here"}
      </div>
      <table>
        <thead><tr><th>Name</th><th>Path</th><th>Size</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {files.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">No uploaded files yet.</td>
            </tr>
          )}
          {files.map((file) => (
            <tr key={file.id}>
              <td className="file-name">{file.directory ? <Folder size={18} /> : <FileText size={18} />}{file.originalName}</td>
              <td>{file.relativePath}</td>
              <td>{file.directory ? "folder" : formatBytes(file.sizeBytes)}</td>
              <td>{new Date(file.createdAt).toLocaleString()}</td>
              <td>
                <div className="row-actions">
                  <button title="Preview" onClick={() => previewFile(file)} disabled={file.directory}><Eye size={16} /></button>
                  <button title="Download" onClick={() => downloadFile(file)} disabled={file.directory}><Download size={16} /></button>
                  <button title="Rename" onClick={() => renameFile(file)}><Pencil size={16} /></button>
                  <button title="Move to trash" onClick={() => deleteFile(file)}><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
    </section>
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
