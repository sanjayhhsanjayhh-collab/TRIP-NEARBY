"use client";

import { useState } from "react";
import { Camera, CheckCircle2, LoaderCircle } from "lucide-react";

export type ApiResult = { ok?: boolean; error?: string; message?: string; [key: string]: unknown };

export async function postAction(payload: Record<string, unknown>, endpoint = "/api/actions") {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as ApiResult;
  if (!response.ok) throw new Error(result.error ?? "Could not complete this action.");
  return result;
}

export function ActionNotice({ text, error = false }: { text: string | null; error?: boolean }) {
  return text ? <p role="status" className={error ? "inline-error" : "inline-success"}>{text}</p> : null;
}

export function PhotoUpload({ value, onChange, label = "Add a photograph" }: { value?: string; onChange: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    setError(""); setBusy(true);
    const form = new FormData(); form.set("file", file);
    try {
      const response = await fetch("/api/media", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
      onChange(data.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); }
  };
  return <div className="form-field"><label>{label} <span className="muted small">(optional)</span></label><div className="upload-box">
    {value ? <img className="upload-preview" src={value} alt="Uploaded preview" /> : <Camera size={22} color="#538b68" />}
    <div style={{ flex: 1 }}>{busy ? <span className="small"><LoaderCircle size={13} className="inline animate-spin" /> Uploading…</span> : value ? <span className="small"><CheckCircle2 size={14} className="inline" /> Photo uploaded</span> : <input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void upload(e.target.files?.[0])} />}
      <p className="form-help">JPEG, PNG or WebP · max 2 MB. Only upload photos you own or have permission to use.</p></div>
    {value && <button className="btn btn-outline" type="button" onClick={() => onChange("")}>Remove</button>}
  </div>{error && <span className="inline-error">{error}</span>}</div>;
}
