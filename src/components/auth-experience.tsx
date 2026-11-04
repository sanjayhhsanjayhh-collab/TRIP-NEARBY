"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Eye, EyeOff, KeyRound, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";

export type PublicUser = { id: string; name: string; email: string; role: string; location: string | null; avatarUrl: string | null };
type SessionResponse = { authenticated: boolean; user: PublicUser | null };
type Mode = "login" | "register";
type View = "form" | "reset";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function readResponse(response: Response) {
  try { return await response.json() as Record<string, unknown>; }
  catch { return { error: "The server returned an unexpected response. Please try again." }; }
}

export async function logoutAndReload(destination = "/") {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    if (!response.ok) throw new Error("Logout failed");
  } finally {
    window.location.assign(destination);
  }
}

export function LogoutButton({ className = "btn btn-outline", destination = "/", label = "Log out" }: { className?: string; destination?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" className={className} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }); window.location.assign(destination); } catch { setBusy(false); setError("Logout failed. Please try again."); } }}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />} {busy ? "Logging out…" : label}</button>{error && <p className="inline-error">{error}</p>}</>;
}

function PasswordInput({ id, name, label, autoComplete, placeholder, visible, onToggle, minLength = 8 }: {
  id: string; name: string; label: string; autoComplete: string; placeholder?: string; visible: boolean; onToggle: () => void; minLength?: number;
}) {
  return <div className="form-field"><label htmlFor={id}>{label}</label><div className="password-wrap"><input id={id} name={name} className="form-control" type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} minLength={minLength} required /><button type="button" className="password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={onToggle}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>;
}

export function AuthExperience({ initialMode, nextPath, initialUser }: { initialMode: Mode; nextPath: string; initialUser: PublicUser | null }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [view, setView] = useState<View>("form");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  const [sessionChecked, setSessionChecked] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => await response.json() as SessionResponse)
      .then((data) => { if (!cancelled) { setUser(data.authenticated ? data.user : null); setSessionChecked(true); } })
      .catch(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const updateUrl = (nextMode: Mode) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams({ mode: nextMode });
      if (nextPath !== "/profile") params.set("next", nextPath);
      window.history.replaceState(null, "", `/auth?${params.toString()}`);
    }
  };
  const switchMode = (nextMode: Mode) => {
    if (inFlight.current) return;
    setMode(nextMode); setView("form"); setMessage(null); setFieldError(""); setRecoveryCode(null);
    setShowPassword(false); setShowConfirm(false); updateUrl(nextMode);
  };
  const verifySession = async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not confirm your session. Please try logging in again.");
    const data = await response.json() as SessionResponse;
    if (!data.authenticated || !data.user) throw new Error("Your session was not established. Please try again.");
    setUser(data.user);
    return data.user;
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || busy) return;
    const form = new FormData(event.currentTarget);
    const name = str(form, "name"), email = str(form, "email"), password = str(form, "password"), confirm = str(form, "confirmPassword");
    if (!emailPattern.test(email)) { setFieldError("Enter a valid email address."); return; }
    if (password.length < 8 || password.length > 72) { setFieldError("Password must be between 8 and 72 characters."); return; }
    if (mode === "register" && name.length < 2) { setFieldError("Enter your name (at least 2 characters)."); return; }
    if (mode === "register" && password !== confirm) { setFieldError("The two passwords do not match."); return; }
    setFieldError(""); setMessage(null); setMessageError(false); inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(mode === "register" ? { name } : {}), email, password }), cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(String(data.error || "We could not complete the request."));
      await verifySession();
      if (mode === "register") {
        setRecoveryCode(typeof data.recoveryCode === "string" ? data.recoveryCode : null);
        setMessage("Account created and session established. Save your recovery code, then continue.");
      } else {
        setMessage("Signed in. Taking you to your destination…");
        window.location.assign(nextPath || "/profile");
      }
    } catch (cause) {
      setMessageError(true);
      setMessage(cause instanceof Error ? cause.message : "Network error. Check your connection and try again.");
    } finally { inFlight.current = false; setBusy(false); }
  };

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || busy) return;
    const form = new FormData(event.currentTarget);
    const email = str(form, "email"), code = str(form, "code"), newPassword = str(form, "newPassword"), confirm = str(form, "confirmPassword");
    if (!emailPattern.test(email)) { setFieldError("Enter a valid email address."); return; }
    if (code.length < 12) { setFieldError("Enter your full recovery code."); return; }
    if (newPassword.length < 8 || newPassword.length > 72) { setFieldError("New password must be between 8 and 72 characters."); return; }
    if (newPassword !== confirm) { setFieldError("The two passwords do not match."); return; }
    setFieldError(""); setMessage(null); setMessageError(false); inFlight.current = true; setBusy(true);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", email, code, newPassword }), cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(String(data.error || "Could not reset your password."));
      setMessage("Password updated. Log in with your new password."); setView("form"); setMode("login"); updateUrl("login"); setShowPassword(false);
    } catch (cause) { setMessageError(true); setMessage(cause instanceof Error ? cause.message : "Network error. Check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  if (user && !recoveryCode) {
    return <div className="auth-panel"><span className="pill"><ShieldCheck size={13} /> Signed in{sessionChecked ? "" : " · checking session…"}</span><h2 style={{ marginTop: 18 }}>Welcome back, {user.name.split(" ")[0]}.</h2><p>You are already signed in as {user.email}. Nothing will switch or redirect unless you choose an action below.</p><div className="form-actions"><button className="btn btn-primary" onClick={() => window.location.assign(nextPath || "/profile")}>Continue <ArrowRight size={15} /></button><LogoutButton destination={`/auth?mode=${mode}${nextPath !== "/profile" ? `&next=${encodeURIComponent(nextPath)}` : ""}`} label="Use another account" /></div></div>;
  }

  if (recoveryCode) {
    return <div className="auth-panel"><span className="pill"><KeyRound size={13} /> Account created</span><h2 style={{ marginTop: 18 }}>Save your recovery code.</h2><p>Email delivery is not configured, so TripNearby gives you a one-time offline recovery code instead. It is shown only once and can reset your password.</p><div className="recovery-code"><code>{recoveryCode}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(recoveryCode); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</button></div><div className="form-actions"><button className="btn btn-primary" onClick={() => window.location.assign(nextPath || "/profile")}>Continue to TripNearby <ArrowRight size={15} /></button></div><p className="form-help">Your session is active. You can generate a new code any time from Profile → Password & recovery.</p></div>;
  }

  return <div className="auth-panel"><div className="auth-tabs" role="tablist" aria-label="Authentication options"><button type="button" role="tab" aria-selected={mode === "login" && view === "form"} className={`auth-tab ${mode === "login" && view === "form" ? "active" : ""}`} onClick={() => switchMode("login")}>Log in</button><button type="button" role="tab" aria-selected={mode === "register" && view === "form"} className={`auth-tab ${mode === "register" && view === "form" ? "active" : ""}`} onClick={() => switchMode("register")}>Register</button></div>
    <h2 style={{ marginTop: 22 }}>{view === "reset" ? "Reset your password." : mode === "login" ? "Welcome back." : "Join the journey."}</h2>
    <p>{view === "reset" ? "Use the recovery code shown when you registered, or one generated from your profile." : mode === "login" ? "Log in to save places, plan trips and share your discoveries." : "Create your free traveller account. This screen stays on Register until you choose Log in."}</p>
    {view === "form" ? <form key={mode} onSubmit={submitAuth} noValidate>
      {mode === "register" && <div className="form-field"><label htmlFor="auth-name">Your name</label><input id="auth-name" className="form-control" name="name" autoComplete="name" required minLength={2} /></div>}
      <div className="form-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" className="form-control" name="email" type="email" autoComplete="email" required /></div>
      <PasswordInput id="auth-password" name="password" label="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
      {mode === "register" && <PasswordInput id="auth-confirm" name="confirmPassword" label="Confirm password" autoComplete="new-password" visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />}
      {fieldError && <p className="inline-error" role="alert">{fieldError}</p>}
      <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="animate-spin" /> Please wait…</> : <>{mode === "login" ? "Log in" : "Create account"} <ArrowRight size={15} /></>}</button>
    </form> : <form onSubmit={submitReset} noValidate>
      <div className="form-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" className="form-control" name="email" type="email" autoComplete="email" required /></div>
      <div className="form-field"><label htmlFor="reset-code">Recovery code</label><input id="reset-code" className="form-control" name="code" placeholder="TN-XXXXXX-XXXXXX" autoComplete="off" required /></div>
      <PasswordInput id="reset-password" name="newPassword" label="New password" autoComplete="new-password" visible={showResetPassword} onToggle={() => setShowResetPassword(!showResetPassword)} />
      <PasswordInput id="reset-confirm" name="confirmPassword" label="Confirm new password" autoComplete="new-password" visible={showResetPassword} onToggle={() => setShowResetPassword(!showResetPassword)} />
      {fieldError && <p className="inline-error" role="alert">{fieldError}</p>}
      <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="animate-spin" /> Updating…</> : <>Reset password <ArrowRight size={15} /></>}</button>
    </form>}
    {message && <p className={messageError ? "inline-error" : "inline-success"} role="status">{message}</p>}
    <div className="auth-footer"><button type="button" className="text-link auth-text-button" onClick={() => { setView(view === "reset" ? "form" : "reset"); setMessage(null); setFieldError(""); }}>{view === "reset" ? "Back to Log in" : "Forgot password? Use a recovery code"}</button>{view === "form" && <p className="auth-switch">{mode === "login" ? "New to TripNearby?" : "Already have an account?"} <button type="button" className="auth-text-button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Register" : "Log in"}</button></p>}</div>
  </div>;
}

export function PasswordManager() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const guard = useRef(false);
  const send = async (payload: Record<string, string>) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(String(data.error || "Could not complete the request."));
      setMessage(String(data.message || "Done.")); setCode(typeof data.recoveryCode === "string" ? data.recoveryCode : null);
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Network error. Please try again."); }
    finally { guard.current = false; setBusy(false); }
  };
  const change = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = str(form, "currentPassword"), newPassword = str(form, "newPassword"), confirm = str(form, "confirmPassword");
    if (newPassword.length < 8 || newPassword !== confirm) { setError(true); setMessage("Enter a new password of at least 8 characters and make sure both entries match."); return; }
    void send({ action: "change", currentPassword, newPassword });
    event.currentTarget.reset();
  };
  return <div className="white-card" style={{ marginTop: 18 }}><h3>Password & recovery</h3><p>Change your password while signed in, or create a one-time recovery code for a future sign-in.</p><form onSubmit={change}>
    <PasswordInput id="profile-current" name="currentPassword" label="Current password" autoComplete="current-password" visible={show} onToggle={() => setShow(!show)} />
    <PasswordInput id="profile-new" name="newPassword" label="New password" autoComplete="new-password" visible={show} onToggle={() => setShow(!show)} />
    <PasswordInput id="profile-confirm" name="confirmPassword" label="Confirm new password" autoComplete="new-password" visible={show} onToggle={() => setShow(!show)} />
    <div className="form-actions"><button className="btn btn-primary" disabled={busy}>Change password</button><button className="btn btn-outline" type="button" disabled={busy} onClick={() => void send({ action: "create-code" })}><KeyRound size={15} /> Create recovery code</button></div>
    {message && <p className={error ? "inline-error" : "inline-success"} role="status">{message}</p>}{code && <div className="recovery-code"><code>{code}</code><button type="button" onClick={() => void navigator.clipboard.writeText(code)}><Copy size={15} /> Copy</button></div>}
  </form></div>;
}
