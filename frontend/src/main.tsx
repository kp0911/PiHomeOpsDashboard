import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText, HardDrive, LogOut, Shield, Upload } from "lucide-react";
import { api, login, setToken, token } from "./lib/api";
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

  async function refresh() {
    try {
      setFiles(await api<StoredFile[]>("/files?path=/uploads"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    }
  }

  async function uploadFile(file: File) {
    const data = new FormData();
    data.set("file", file);
    await api<StoredFile>("/files/upload", { method: "POST", body: data });
    await refresh();
  }

  useEffect(() => { refresh(); }, []);

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
        Drop files here
      </div>
      <table>
        <thead><tr><th>Name</th><th>Path</th><th>Size</th><th>Created</th></tr></thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>{file.originalName}</td>
              <td>{file.relativePath}</td>
              <td>{file.directory ? "folder" : `${file.sizeBytes} B`}</td>
              <td>{new Date(file.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
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
