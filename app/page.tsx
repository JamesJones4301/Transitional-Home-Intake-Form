"use client";

// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import {
  Home, LogIn, LogOut, Calendar, Check, X, FileText, Bell,
  ClipboardList, Users, Settings, Send, AlertCircle, ChevronLeft,
  Clock, ShieldCheck, TrendingUp, PenLine, Moon, ArrowRight, Wrench
} from "lucide-react";

declare global {
  interface Window { google?: any; }
}

const STORAGE_KEY = "ashrei-impact-resident-care";
const GOOGLE_CLIENT_ID = "763224714860-t1srggj7a6jp14iceh40c1c0g6gcf87h.apps.googleusercontent.com";
const GOOGLE_SHEET_ID = "13yiU4efcTMpriA10i4_xS50gIlAN4tbAi6BaF9StKH0";
const GOOGLE_OWNER_EMAIL = "ashreiimpactfoundation@gmail.com";
const GOOGLE_SIGN_IN_SCOPE = "openid email";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_CURFEWS = { 0: "23:00", 1: "21:00", 2: "21:00", 3: "21:00", 4: "21:00", 5: "23:00", 6: "23:00" };

const theme = {
  bg: "#F7F5EF",
  card: "#FFFFFF",
  ink: "#22332D",
  inkSoft: "#66736E",
  border: "#DDD9CC",
  primary: "#174C3C",
  primarySoft: "#E2EEE9",
  accent: "#C49342",
  accentSoft: "#F5EEDC",
  amber: "#B9812E",
  amberSoft: "#FAF0DE",
  red: "#AD5A47",
  redSoft: "#F7E8E3",
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function defaultData() {
  const now = Date.now();
  return {
    tenants: [], checkins: [], requests: [],
    maintenance: [],
    settings: { curfews: { ...DEFAULT_CURFEWS }, managerName: "Program coordinator", managerPhone: "" },
    auditLog: [],
    notifications: [],
  };
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google sign-in could not load."));
    document.head.appendChild(script);
  });
}

function requestGoogleToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SIGN_IN_SCOPE,
      callback: response => response.error ? reject(new Error(response.error)) : resolve(response.access_token),
      error_callback: () => reject(new Error("Google sign-in was cancelled or blocked.")),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

function iso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function sheetRows(data) {
  return {
    Residents: data.tenants.map(t => [t.id, t.name, t.phone || "", t.email || "", t.room || "", t.bed || "", iso(t.admissionDate), Boolean(t.active), iso(t.signedAt), Boolean(t.consentDrugTest), Boolean(t.occupancyTermsAccepted), t.administrativeFee || 150, Boolean(t.paymentsNonRefundable), t.approvalStatus || (t.active ? "approved" : "pending"), iso(t.submittedAt), t.reviewedBy || "", iso(t.reviewedAt)]),
    "Check-Ins": data.checkins.map(c => { const d = new Date(c.timestamp); return [c.id, c.tenantId, data.tenants.find(t => t.id === c.tenantId)?.name || "", c.type, d.toISOString().slice(0, 10), d.toLocaleTimeString(), c.onTime ? "On time" : "Late", c.notes || ""]; }),
    "Overnight Requests": data.requests.map(r => [r.id, r.tenantId, data.tenants.find(t => t.id === r.tenantId)?.name || "", r.destination || "", r.requestedDate || "", r.returnDate || "", r.reason || "", r.status, r.decidedBy || "", iso(r.decidedAt)]),
    "Program Settings": [["Coordinator Name", data.settings.managerName || ""], ["Coordinator Phone", data.settings.managerPhone || ""], ...DAY_NAMES.map((day, index) => [`Curfew ${day}`, data.settings.curfews[index] || ""])],
    "Audit Log": data.auditLog.map(a => [a.id, iso(a.timestamp), a.actor || "", a.action || "", a.entityType || "", a.entityId || "", a.detail || ""]),
    Notifications: data.notifications.map(n => [n.id, n.to || "", n.channel || "", n.message || "", "queued", iso(n.timestamp), ""]),
  };
}

async function googleRequest(path, token, options = {}) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
  return response.json();
}

async function loadGoogleData(token) {
  const response = await fetch("/api/portal", { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Owner data could not be loaded.");
  return result.data;
}

async function saveGoogleData(data, token) {
  const response = await fetch("/api/portal", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Owner data could not be saved.");
  return result.data;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [role, setRole] = useState(null); // 'resident' | 'manager' | 'owner' | 'intake'
  const [residentId, setResidentId] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Not connected");

  useEffect(() => {
    (async () => {
      try {
        const result = window.localStorage.getItem(STORAGE_KEY);
        if (result) {
          setData(JSON.parse(result));
        } else {
          const fresh = defaultData();
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
          setData(fresh);
        }
      } catch (e) {
        setError("Could not load saved data. You can still use the app, but changes may not persist.");
        setData(defaultData());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("owner") === "1") setRole("ownerMenu");
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (googleAccessToken) {
        setSyncStatus("Saving securely…");
        await saveGoogleData(next, googleAccessToken);
        setSyncStatus("Saved to Google Sheets");
      }
    } catch {
      setSyncStatus("Secure connection needs attention");
      setError("Changes could not be saved to the private system. Reconnect as Owner and try again.");
    }
  }, [googleAccessToken]);

  const connectGoogle = useCallback(async () => {
    setError(null);
    setSyncStatus("Connecting to Google…");
    try {
      await loadGoogleIdentity();
      const token = await requestGoogleToken();
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token}` } });
      if (!profileResponse.ok) throw new Error("Google could not verify this account.");
      const profile = await profileResponse.json();
      if ((profile.email || "").toLowerCase() !== GOOGLE_OWNER_EMAIL) {
        window.google.accounts.oauth2.revoke(token);
        throw new Error(`Access is restricted to ${GOOGLE_OWNER_EMAIL}.`);
      }
      const saved = await loadGoogleData(token);
      if (saved) {
        setData(saved);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } else {
        await saveGoogleData(data, token);
      }
      setGoogleAccessToken(token);
      setGoogleUser(profile.email);
      setSyncStatus("Owner connection verified");
    } catch (e) {
      setGoogleAccessToken(null);
      setGoogleUser(null);
      setSyncStatus("Not connected");
      setError(e?.message || "Google Sheets could not be connected.");
    }
  }, [data]);

  const addAudit = (draft, actor, action, detail) => {
    draft.auditLog = [
      { id: uid(), timestamp: Date.now(), actor, action, detail },
      ...draft.auditLog,
    ].slice(0, 2000);
  };

  const addNotification = (draft, to, channel, message) => {
    draft.notifications = [
      { id: uid(), timestamp: Date.now(), to, channel, message },
      ...draft.notifications,
    ].slice(0, 2000);
  };

  if (loading || !data) {
    return (
      <div style={{ background: theme.bg, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ color: theme.inkSoft }}>Loading resident care workspace…</div>
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", fontFamily: "'Source Sans Pro', system-ui, sans-serif", color: theme.ink, padding: "1.5rem 0" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 1.25rem" }}>
        <Header role={role} setRole={setRole} setResidentId={setResidentId} />
        {error && (
          <div style={{ background: theme.redSoft, color: theme.red, padding: "0.6rem 0.9rem", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {!role && <Landing setRole={setRole} setResidentId={setResidentId} data={data} />}
        {role === "intake" && (
          <Intake
            data={data}
            persist={persist}
            addAudit={addAudit}
            addNotification={addNotification}
            onDone={() => setRole(null)}
          />
        )}
        {role === "resident" && (
          <ResidentView
            data={data}
            persist={persist}
            addAudit={addAudit}
            addNotification={addNotification}
            residentId={residentId}
            setResidentId={setResidentId}
          />
        )}
        {role === "ownerMenu" && !googleAccessToken && (
          <GoogleSheetAccess onConnect={connectGoogle} status={syncStatus} />
        )}
        {role === "ownerMenu" && googleAccessToken && <OwnerMenu setRole={setRole} />}
        {(role === "manager" || role === "owner") && !googleAccessToken && (
          <GoogleSheetAccess onConnect={connectGoogle} status={syncStatus} />
        )}
        {(role === "manager" || role === "owner") && googleAccessToken && (
          <ManagerView
            data={data}
            persist={persist}
            addAudit={addAudit}
            addNotification={addNotification}
            readOnly={role === "owner"}
            googleUser={googleUser}
            syncStatus={syncStatus}
          />
        )}
      </div>
    </div>
  );
}

function GoogleSheetAccess({ onConnect, status }) {
  return (
    <Panel title="Owner verification required" subtitle="Resident records and approval tools are restricted to the authorized Ashrei Impact Foundation Google account.">
      <div style={{ background: theme.primarySoft, borderRadius: 10, padding: "0.9rem 1rem", marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
        Sign in as <strong>{GOOGLE_OWNER_EMAIL}</strong> to open the management workspace and synchronize changes with the private Google Sheet.
      </div>
      <button onClick={onConnect} style={btnPrimary}><ShieldCheck size={16} /> Connect Google Sheet</button>
      <div style={{ marginTop: 10, fontSize: 12, color: theme.inkSoft }}>{status}</div>
    </Panel>
  );
}

function OwnerMenu({ setRole }) {
  return (
    <div>
      <p style={{ color: theme.inkSoft, fontSize: 15, marginBottom: 22, maxWidth: 480 }}>
        Owner management workspace. Choose the view you need.
      </p>
      <div className="role-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <RoleCard icon={<ClipboardList size={20} />} title="Program team" desc="Review requests, monitor check-ins, run reports" onClick={() => setRole("manager")} />
        <RoleCard icon={<TrendingUp size={20} />} title="Foundation leadership" desc="Read-only view of program reports" onClick={() => setRole("owner")} />
      </div>
    </div>
  );
}

function Header({ role, setRole, setResidentId }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: role ? "pointer" : "default" }}
           onClick={() => { if (role) { setRole(null); setResidentId(null); } }}>
        <img src="/ashrei-impact-logo.svg" alt="Ashrei Impact Foundation" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 8 }} />
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19 }}>Ashrei Impact Foundation</div>
          <div style={{ fontSize: 10, color: theme.inkSoft, letterSpacing: "0.08em", textTransform: "uppercase" }}>Resident care portal</div>
        </div>
      </div>
      {role && (
        <button onClick={() => { setRole(null); setResidentId(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: theme.inkSoft, background: "none", border: "none", cursor: "pointer" }}>
          <ChevronLeft size={15} /> Switch view
        </button>
      )}
    </div>
  );
}

function Landing({ setRole, setResidentId, data }) {
  const activeCount = data.tenants.filter(t => t.active).length;
  return (
    <div>
      <p style={{ color: theme.inkSoft, fontSize: 15, marginBottom: 22, maxWidth: 480 }}>
        Select the option that applies to you.
        {activeCount > 0 && ` ${activeCount} active resident${activeCount === 1 ? "" : "s"}.`}
      </p>
      <div className="role-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <RoleCard icon={<LogIn size={20} />} title="I'm a resident" desc="Submit an overnight request for program-team approval" onClick={() => setRole("resident")} />
        <RoleCard icon={<PenLine size={20} />} title="New resident intake" desc="Complete your residency agreement and program commitments" onClick={() => setRole("intake")} accent />
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", background: theme.card, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: "1.1rem 1.2rem", cursor: "pointer", display: "flex", gap: 12,
    }}>
      <div style={{ color: accent ? theme.accent : theme.primary, marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: theme.inkSoft, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}

/* ---------------- INTAKE / LEASE SIGNING ---------------- */

function Intake({ data, persist, addAudit, addNotification, onDone }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", room: "", bed: "", admissionDate: new Date().toISOString().slice(0, 10) });
  const [agreeLease, setAgreeLease] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);
  const [agreeOccupancyTerms, setAgreeOccupancyTerms] = useState(false);
  const [agreeProgramStandards, setAgreeProgramStandards] = useState(false);
  const [agreeMoveInHygiene, setAgreeMoveInHygiene] = useState(false);
  const [screening, setScreening] = useState({ independentLiving: "", legalOrSupervision: "", treatmentSupport: "", registryRequirement: "", concerns: "" });
  const [screeningAccurate, setScreeningAccurate] = useState(false);
  const [consentTest, setConsentTest] = useState(false);
  const [signature, setSignature] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = form.name && form.phone && form.room && form.bed && agreeLease && agreeRules && agreeOccupancyTerms && agreeProgramStandards && agreeMoveInHygiene && screening.independentLiving && screening.legalOrSupervision && screening.treatmentSupport && screening.registryRequirement && screeningAccurate &&
    signature.trim().toLowerCase() === form.name.trim().toLowerCase() && signature.trim().length > 1;

  const submit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/public-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "intake", ...form, consentDrugTest: consentTest, agreementAccepted: true, programStandardsAccepted: agreeProgramStandards, moveInHygieneAccepted: agreeMoveInHygiene, screening, screeningAccurate }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your application could not be submitted.");
      setDone(true);
    } catch (error) {
      window.alert(error.message || "Your application could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Panel>
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <ShieldCheck size={30} color={theme.accent} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>Application submitted for review</div>
          <p style={{ color: theme.inkSoft, fontSize: 14, marginBottom: 18 }}>
            Your requested Room {form.room}, Bed {form.bed} assignment will be confirmed by the program team. We will email {form.email || "you"} once a decision is made.
          </p>
          <button onClick={onDone} style={btnPrimary}>Back to home</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="New resident intake" subtitle="Complete the occupancy agreement and record the resident's room and bed assignment.">
      <Field label="Full name">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} placeholder="Jordan Reyes" />
      </Field>
      <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Phone (for texts)">
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} placeholder="(555) 555-1212" />
        </Field>
        <Field label="Email (for agreement copy)">
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} placeholder="jordan@email.com" />
        </Field>
      </div>
      <Field label="Move-in date">
        <input type="date" value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} style={input} />
      </Field>

      <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Assigned room">
          <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} style={input} placeholder="e.g., 201" />
        </Field>
        <Field label="Assigned bed">
          <input value={form.bed} onChange={e => setForm({ ...form, bed: e.target.value })} style={input} placeholder="e.g., A or 1" />
        </Field>
      </div>

      <div style={{ background: theme.primarySoft, borderRadius: 10, padding: "0.9rem 1rem", margin: "1rem 0", fontSize: 13, color: theme.ink, lineHeight: 1.6 }}>
        <strong>Residency agreement (summary):</strong> Participation follows the terms in your full residency agreement. Community hours apply as posted,
        and overnight stays require prior approval. Program commitments and discharge procedures are detailed in the full agreement.
      </div>
      <CheckField label="I have read and agree to the residency terms" checked={agreeLease} onChange={setAgreeLease} />
      <CheckField label="I have read and agree to the community commitments" checked={agreeRules} onChange={setAgreeRules} />

      <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "0.95rem 1rem", margin: "1rem 0", fontSize: 13, lineHeight: 1.55 }}>
        <strong style={{ display: "block", marginBottom: 8 }}>Screening and support information</strong>
        <p style={{ margin: "0 0 12px", color: theme.inkSoft }}>These answers help the program team review whether this shared-living setting is appropriate. They do not replace a full review or emergency assessment.</p>
        <Field label="Can you live independently without 24-hour medical or clinical supervision?">
          <select value={screening.independentLiving} onChange={e => setScreening({ ...screening, independentLiving: e.target.value })} style={input}><option value="">Select an answer</option><option>Yes</option><option>No</option></select>
        </Field>
        <Field label="Are you currently on probation, parole, or another form of legal supervision?">
          <select value={screening.legalOrSupervision} onChange={e => setScreening({ ...screening, legalOrSupervision: e.target.value })} style={input}><option value="">Select an answer</option><option>Yes</option><option>No</option></select>
        </Field>
        <Field label="Are you currently receiving treatment, counseling, or recovery support services?">
          <select value={screening.treatmentSupport} onChange={e => setScreening({ ...screening, treatmentSupport: e.target.value })} style={input}><option value="">Select an answer</option><option>Yes</option><option>No</option></select>
        </Field>
        <Field label="Are you currently required to register as a sex offender?">
          <select value={screening.registryRequirement} onChange={e => setScreening({ ...screening, registryRequirement: e.target.value })} style={input}><option value="">Select an answer</option><option>Yes</option><option>No</option></select>
        </Field>
        <Field label="Safety, legal, medical, behavioral, medication, or housing concerns the program team should review (optional)">
          <textarea value={screening.concerns} onChange={e => setScreening({ ...screening, concerns: e.target.value })} style={{ ...input, minHeight: 76, resize: "vertical" }} placeholder="Share only information relevant to your housing review." />
        </Field>
      </div>
      <CheckField label="I certify that my screening answers are complete and accurate, and I will promptly update the program team if they change" checked={screeningAccurate} onChange={setScreeningAccurate} />

      <div style={{ background: theme.amberSoft, border: `1px solid ${theme.amber}33`, borderRadius: 10, padding: "0.95rem 1rem", margin: "1rem 0", fontSize: 13, color: theme.ink, lineHeight: 1.6 }}>
        <strong style={{ display: "block", marginBottom: 6 }}>Important occupancy and payment terms</strong>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>This occupancy agreement may be terminated if a resident's conduct creates an environment that other residents reasonably experience as unwelcoming.</li>
          <li>Conduct that disrupts another resident's stay or the shared living environment will result in removal from the residence.</li>
          <li>All payments are non-refundable.</li>
          <li>A $150 administrative fee is required and is non-refundable.</li>
        </ul>
      </div>
      <CheckField label="I have read, understand, and agree to the occupancy and payment terms above" checked={agreeOccupancyTerms} onChange={setAgreeOccupancyTerms} />
      <div style={{ background: theme.primarySoft, borderRadius: 10, padding: "0.95rem 1rem", margin: "1rem 0", fontSize: 13, lineHeight: 1.6 }}>
        <strong style={{ display: "block", marginBottom: 6 }}>Program standards acknowledgment</strong>
        I understand this is a clean and sober, faith-centered shared living environment. I agree to comply with sober-living safety rules, mandatory and random drug/alcohol testing, curfew and pre-approved overnight requirements, visitor limits, resident privacy, maintenance reporting, and the grievance process. I understand serious or repeated unsafe conduct may result in corrective action or program discharge, subject to applicable law and program policy.
      </div>
      <CheckField label="I have reviewed and agree to the House Rules, safety standards, testing, curfew/overnight, visitor, maintenance, grievance, privacy, and program-discharge policies" checked={agreeProgramStandards} onChange={setAgreeProgramStandards} />
      <div style={{ background: theme.accentSoft, borderRadius: 10, padding: "0.95rem 1rem", margin: "1rem 0", fontSize: 13, lineHeight: 1.6 }}>
        <strong style={{ display: "block", marginBottom: 6 }}>Required before entering your assigned room</strong>
        All washable clothing and fabric items must be placed directly into laundry and washed/dried as directed with the program-provided bedbug laundry detergent/additive before entering the bedroom or storage area. You must also shower before settling into your assigned room and report any suspected pest concern immediately.
      </div>
      <CheckField label="I understand and will complete the required laundry and shower procedure before entering my room" checked={agreeMoveInHygiene} onChange={setAgreeMoveInHygiene} />
      <CheckField label="I consent to being drug tested, including upon return from any approved overnight stay" checked={consentTest} onChange={setConsentTest} />

      <Field label="Type your full name as your signature">
        <input value={signature} onChange={e => setSignature(e.target.value)} style={input} placeholder="Type your name to sign" />
      </Field>
      <p style={{ fontSize: 12, color: theme.inkSoft, marginTop: -6, marginBottom: 14 }}>
        Typing your name records your acknowledgement with a timestamp in this prototype.
      </p>

      <button disabled={!canSubmit || submitting} onClick={submit} style={canSubmit && !submitting ? btnPrimary : btnDisabled}>
        {submitting ? "Submitting securely…" : "Sign and submit"}
      </button>
    </Panel>
  );
}

/* ---------------- RESIDENT VIEW ---------------- */

function ResidentView({ data, persist, addAudit, addNotification, residentId, setResidentId }) {
  const active = data.tenants.filter(t => t.active);
  const tenant = data.tenants.find(t => t.id === residentId);

  if (!tenant) {
    return (
      <ResidentOvernightRequest />
    );
  }

  const myCheckins = data.checkins.filter(c => c.tenantId === tenant.id).sort((a, b) => b.timestamp - a.timestamp);
  const lastEvent = myCheckins[0];
  const isCheckedIn = lastEvent?.type === "in";
  const daysIn = daysBetween(tenant.admissionDate, Date.now());
  const eligibleForOvernight = daysIn > 10 && tenant.consentDrugTest;

  const doCheck = async (type) => {
    const next = JSON.parse(JSON.stringify(data));
    const now = Date.now();
    const dow = new Date(now).getDay();
    const curfew = next.settings.curfews[dow] || "21:00";
    const [ch, cm] = curfew.split(":").map(Number);
    const curfewTs = new Date(now).setHours(ch, cm, 0, 0);
    const onTime = type === "out" ? true : now <= curfewTs;

    next.checkins.unshift({ id: uid(), tenantId: tenant.id, type, timestamp: now, onTime });
    addAudit(next, tenant.name, `check_${type}`, onTime ? "On time" : "Late arrival");

    if (type === "in" && !onTime) {
    const mgrPhone = next.settings.managerPhone || "program coordinator";
      addNotification(next, mgrPhone, "sms",
        `Late arrival: ${tenant.name} checked in at ${fmtTime(now)} — curfew was ${curfew}. (Simulated: connect Twilio to actually send this text.)`);
    }
    await persist(next);
  };

  return (
    <div>
      <Panel title={`Hi, ${tenant.name.split(" ")[0]}`} subtitle={`Day ${daysIn} in the program${tenant.room && tenant.bed ? ` · Room ${tenant.room}, Bed ${tenant.bed}` : " · Assignment pending"}`}>
        <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          <button onClick={() => doCheck("in")} disabled={isCheckedIn} style={isCheckedIn ? btnDisabled : btnPrimary}>
            <LogIn size={15} style={{ marginRight: 6, verticalAlign: -2 }} /> Check in
          </button>
          <button onClick={() => doCheck("out")} disabled={!isCheckedIn} style={!isCheckedIn ? btnDisabled : btnSecondary}>
            <LogOut size={15} style={{ marginRight: 6, verticalAlign: -2 }} /> Check out
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: theme.inkSoft, marginTop: 10 }}>
          Currently {isCheckedIn ? "checked in" : "checked out"}
          {lastEvent ? ` · last activity ${fmtTime(lastEvent.timestamp)}` : ""}.
          Today's curfew: {data.settings.curfews[new Date().getDay()]}.
        </p>
      </Panel>

      <Panel title="Recent check-ins">
        {myCheckins.length === 0 ? <EmptyState text="No check-ins recorded yet." /> : (
          <div style={{ display: "grid", gap: 6 }}>
            {myCheckins.slice(0, 8).map(c => (
              <div key={c.id} style={listRow}>
                <span>{c.type === "in" ? "Checked in" : "Checked out"} — {fmtTime(c.timestamp)}</span>
                {c.type === "in" && (
                  <Badge tone={c.onTime ? "accent" : "amber"}>{c.onTime ? "On time" : "Late"}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <OvernightPanel
        tenant={tenant} data={data} persist={persist} addAudit={addAudit}
        eligibleForOvernight={eligibleForOvernight} daysIn={daysIn}
      />
    </div>
  );
}

function OvernightPanel({ tenant, data, persist, addAudit, eligibleForOvernight, daysIn }) {
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [consentThisTrip, setConsentThisTrip] = useState(false);
  const myRequests = data.requests.filter(r => r.tenantId === tenant.id).sort((a, b) => b.createdAt - a.createdAt);

  const blockers = [];
  if (daysIn <= 10) blockers.push(`You need more than 10 days in the program (currently day ${daysIn}).`);
  if (!tenant.consentDrugTest) blockers.push("Your intake record doesn't show drug-test consent on file — see the program coordinator.");

  const canSubmit = eligibleForOvernight && date && returnDate && consentThisTrip;

  const submit = async () => {
    const next = JSON.parse(JSON.stringify(data));
    const req = {
      id: uid(), tenantId: tenant.id, requestedDate: date, returnDate,
      status: "pending", createdAt: Date.now(), decidedAt: null, decidedBy: null,
      testRequired: true, testResult: null,
      eligibleAtRequest: true,
    };
    next.requests.unshift(req);
    addAudit(next, tenant.name, "overnight_requested", `Requested overnight ${date} to ${returnDate}.`);
    await persist(next);
    setDate(""); setReturnDate(""); setConsentThisTrip(false);
  };

  return (
    <Panel title="Overnight stay request" subtitle="Approved overnight stays require a drug test upon return.">
      {!eligibleForOvernight ? (
        <div style={{ background: theme.amberSoft, color: theme.amber, padding: "0.7rem 0.9rem", borderRadius: 8, fontSize: 13.5 }}>
          {blockers.map((b, i) => <div key={i}>{b}</div>)}
        </div>
      ) : (
        <>
          <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Leaving"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
            <Field label="Returning"><input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={input} /></Field>
          </div>
          <CheckField label="I consent to a drug test upon my return from this trip" checked={consentThisTrip} onChange={setConsentThisTrip} />
          <button disabled={!canSubmit} onClick={submit} style={{ ...(canSubmit ? btnPrimary : btnDisabled), marginTop: 6 }}>
            Submit request
          </button>
        </>
      )}

      {myRequests.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, marginBottom: 8 }}>YOUR REQUESTS</div>
          <div style={{ display: "grid", gap: 6 }}>
            {myRequests.map(r => (
              <div key={r.id} style={listRow}>
                <span>{r.requestedDate} → {r.returnDate}</span>
                <Badge tone={r.status === "approved" ? "accent" : r.status === "denied" ? "red" : "amber"}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- MANAGER / OWNER VIEW ---------------- */

function ManagerView({ data, persist, addAudit, addNotification, readOnly, googleUser, syncStatus }) {
  const [tab, setTab] = useState(readOnly ? "reports" : "today");
  const tabs = readOnly
    ? [["reports", "Reports"]]
    : [["today", "Today"], ["intakes", "Intake approvals"], ["assignments", "Rooms & beds"], ["requests", "Overnight requests"], ["maintenance", "Maintenance"], ["reports", "Reports"], ["comms", "Notifications"], ["settings", "Settings"]];

  return (
    <div>
      <div style={{ background: theme.primarySoft, border: `1px solid ${theme.primary}22`, borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
        <span><strong>Google Sheets connected</strong> · {googleUser}<br /><span style={{ color: theme.inkSoft }}>{syncStatus}</span></span>
        <a href={`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`} target="_blank" rel="noreferrer" style={{ color: theme.primary, fontWeight: 600 }}>Open private Sheet</a>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={tab === key ? tabActive : tabInactive}>{label}</button>
        ))}
      </div>
      {tab === "today" && <TodayTab data={data} />}
      {tab === "intakes" && <IntakeApprovalsTab data={data} persist={persist} addAudit={addAudit} addNotification={addNotification} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} addAudit={addAudit} />}
      {tab === "requests" && <RequestsTab data={data} persist={persist} addAudit={addAudit} addNotification={addNotification} />}
      {tab === "maintenance" && <MaintenanceTab data={data} />}
      {tab === "reports" && <ReportsTab data={data} />}
      {tab === "comms" && <CommsTab data={data} persist={persist} addAudit={addAudit} addNotification={addNotification} />}
      {tab === "settings" && <SettingsTab data={data} persist={persist} addAudit={addAudit} />}
    </div>
  );
}

function TodayTab({ data }) {
  const active = data.tenants.filter(t => t.active);
  const rows = active.map(t => {
    const events = data.checkins.filter(c => c.tenantId === t.id).sort((a, b) => b.timestamp - a.timestamp);
    const last = events[0];
    return { tenant: t, last };
  });
  const lateToday = data.checkins.filter(c => c.type === "in" && !c.onTime &&
    new Date(c.timestamp).toDateString() === new Date().toDateString());

  return (
    <div>
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Active residents" value={active.length} />
        <StatCard label="Checked in now" value={rows.filter(r => r.last?.type === "in").length} />
        <StatCard label="Late arrivals today" value={lateToday.length} tone={lateToday.length ? "amber" : "accent"} />
      </div>
      <Panel title="Resident status">
        {rows.length === 0 ? <EmptyState text="No active residents yet." /> : (
          <div style={{ display: "grid", gap: 6 }}>
            {rows.map(({ tenant, last }) => (
              <div key={tenant.id} style={listRow}>
                <span>
                  <span style={{ fontWeight: 500, display: "block" }}>{tenant.name}</span>
                  <span style={{ fontSize: 12, color: theme.inkSoft }}>{tenant.room && tenant.bed ? `Room ${tenant.room} · Bed ${tenant.bed}` : "Assignment pending"}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.inkSoft }}>
                  {last ? `${last.type === "in" ? "In" : "Out"} · ${fmtTime(last.timestamp)}` : "No activity yet"}
                  {last?.type === "in" && !last.onTime && <Badge tone="amber">Late</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function MaintenanceTab({ data }) {
  const requests = (data.maintenance || []).sort((a, b) => b.createdAt - a.createdAt);
  return <Panel title="Maintenance requests" subtitle="Emergency issues should be handled immediately; residents must not attempt unauthorized repairs.">
    {requests.length === 0 ? <EmptyState text="No maintenance requests have been submitted." /> : <div style={{ display: "grid", gap: 8 }}>{requests.map(r => <div key={r.id} style={{ ...listRow, alignItems: "flex-start", flexDirection: "column", gap: 4 }}><strong>{r.priority.toUpperCase()} · {r.location}</strong><span>{r.description}</span><span style={{ fontSize: 12, color: theme.inkSoft }}>{fmtTime(r.createdAt)} · Status: {r.status}</span></div>)}</div>}
  </Panel>;
}

function ResidentOvernightRequest() {
  const [form, setForm] = useState({ name: "", phone: "", requestedDate: "", returnDate: "", reason: "" });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = form.name && form.phone && form.requestedDate && form.returnDate && consent;
  const submit = async () => {
    setSubmitting(true); setStatus("");
    try {
      const response = await fetch("/api/public-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "overnight", ...form, consentDrugTest: consent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your request could not be submitted.");
      setStatus("Your overnight request was submitted for program-team approval.");
      setForm({ name: "", phone: "", requestedDate: "", returnDate: "", reason: "" }); setConsent(false);
    } catch (error) { setStatus(error.message || "Your request could not be submitted."); }
    finally { setSubmitting(false); }
  };
  return <><Panel title="Overnight stay request" subtitle="Your request is reviewed by the program team before it is approved.">
    <Field label="Full name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} /></Field>
    <Field label="Phone number"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
    <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Field label="Leaving"><input type="date" value={form.requestedDate} onChange={e => setForm({ ...form, requestedDate: e.target.value })} style={input} /></Field><Field label="Returning"><input type="date" value={form.returnDate} onChange={e => setForm({ ...form, returnDate: e.target.value })} style={input} /></Field></div>
    <Field label="Reason (optional)"><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={input} /></Field>
    <CheckField label="I consent to a drug test upon my return from this trip" checked={consent} onChange={setConsent} />
    <button disabled={!canSubmit || submitting} onClick={submit} style={canSubmit && !submitting ? btnPrimary : btnDisabled}>{submitting ? "Submitting…" : "Submit request"}</button>
    {status && <p style={{ color: theme.inkSoft, fontSize: 13, marginTop: 12 }}>{status}</p>}
  </Panel><MaintenanceRequest /></>;
}

function MaintenanceRequest() {
  const [form, setForm] = useState({ name: "", phone: "", location: "", priority: "routine", description: "" });
  const [status, setStatus] = useState("");
  const submit = async () => {
    setStatus("Submitting…");
    const response = await fetch("/api/public-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "maintenance", ...form }) });
    const result = await response.json();
    setStatus(response.ok ? "Maintenance request submitted. Do not attempt repairs yourself. For an emergency, contact the house manager or emergency services immediately." : (result.error || "Request could not be submitted."));
  };
  const ready = form.name && form.phone && form.location && form.description;
  return <Panel title="Maintenance request" subtitle="Report leaks, electrical hazards, lock failures, sewage backup, fire/smoke, or other property concerns promptly.">
    <Field label="Full name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} /></Field>
    <Field label="Phone number"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
    <Field label="Location of issue"><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={input} placeholder="Room 201, bathroom" /></Field>
    <Field label="Priority"><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={input}><option value="emergency">Emergency</option><option value="urgent">Urgent</option><option value="routine">Routine</option></select></Field>
    <Field label="Describe the problem"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...input, minHeight: 80 }} /></Field>
    <button disabled={!ready} onClick={submit} style={ready ? btnPrimary : btnDisabled}><Wrench size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Submit maintenance request</button>
    {status && <p style={{ color: theme.inkSoft, fontSize: 13, marginTop: 12 }}>{status}</p>}
  </Panel>;
}

function AssignmentsTab({ data, persist, addAudit }) {
  const active = data.tenants.filter(t => t.active);
  const [assignments, setAssignments] = useState(() => Object.fromEntries(active.map(t => [t.id, { room: t.room || "", bed: t.bed || "" }])));
  const [message, setMessage] = useState("");

  const save = async (tenant) => {
    const assignment = assignments[tenant.id] || { room: "", bed: "" };
    const room = assignment.room.trim();
    const bed = assignment.bed.trim();
    if (!room || !bed) {
      setMessage("Enter both a room and bed before saving.");
      return;
    }
    const conflict = active.find(t => t.id !== tenant.id && (t.room || "").toLowerCase() === room.toLowerCase() && (t.bed || "").toLowerCase() === bed.toLowerCase());
    if (conflict) {
      setMessage(`Room ${room}, Bed ${bed} is already assigned to ${conflict.name}.`);
      return;
    }
    const next = JSON.parse(JSON.stringify(data));
    const record = next.tenants.find(t => t.id === tenant.id);
    record.room = room;
    record.bed = bed;
    addAudit(next, next.settings.managerName, "room_bed_assigned", `Assigned ${tenant.name} to Room ${room}, Bed ${bed}.`);
    await persist(next);
    setMessage(`${tenant.name} is assigned to Room ${room}, Bed ${bed}.`);
  };

  return (
    <Panel title="Room and bed assignments" subtitle="Assign each active resident to a specific room and bed. Duplicate assignments are blocked.">
      {message && <div role="status" style={{ background: theme.primarySoft, color: theme.primary, padding: "0.65rem 0.8rem", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{message}</div>}
      {active.length === 0 ? <EmptyState text="No active residents yet." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {active.map(tenant => {
            const assignment = assignments[tenant.id] || { room: "", bed: "" };
            return (
              <div key={tenant.id} style={{ background: theme.bg, borderRadius: 10, padding: "0.85rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{tenant.name}</div>
                <div className="assignment-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <Field label="Room">
                    <input value={assignment.room} onChange={e => setAssignments({ ...assignments, [tenant.id]: { ...assignment, room: e.target.value } })} style={input} placeholder="201" />
                  </Field>
                  <Field label="Bed">
                    <input value={assignment.bed} onChange={e => setAssignments({ ...assignments, [tenant.id]: { ...assignment, bed: e.target.value } })} style={input} placeholder="A" />
                  </Field>
                  <button onClick={() => save(tenant)} style={{ ...btnPrimary, marginBottom: 12 }}>Save assignment</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function IntakeApprovalsTab({ data, persist, addAudit, addNotification }) {
  const pending = data.tenants.filter(t => t.approvalStatus === "pending").sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
  const reviewed = data.tenants.filter(t => t.approvalStatus === "approved" || t.approvalStatus === "denied").sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0)).slice(0, 15);

  const decide = async (applicant, status) => {
    const next = JSON.parse(JSON.stringify(data));
    const record = next.tenants.find(t => t.id === applicant.id);
    if (status === "approved") {
      const conflict = next.tenants.find(t => t.id !== record.id && t.active && (t.room || "").toLowerCase() === (record.room || "").toLowerCase() && (t.bed || "").toLowerCase() === (record.bed || "").toLowerCase());
      if (conflict) {
        window.alert(`Room ${record.room}, Bed ${record.bed} is already assigned to ${conflict.name}. Update the room and bed before approving this application.`);
        return;
      }
      record.active = true;
    }
    record.approvalStatus = status;
    record.reviewedAt = Date.now();
    record.reviewedBy = next.settings.managerName;
    addAudit(next, next.settings.managerName, `intake_${status}`, `${status} intake application for ${record.name}.`);
    if (record.email) {
      addNotification(next, record.email, "email", status === "approved"
        ? `Your residency application has been approved. Your confirmed assignment is Room ${record.room}, Bed ${record.bed}. (Simulated email.)`
        : "Your residency application was not approved at this time. Please contact the program coordinator with any questions. (Simulated email.)");
    }
    await persist(next);
  };

  return (
    <div>
      <Panel title="Pending intake applications" subtitle="Approve an application to activate the resident and confirm their room and bed assignment.">
        {pending.length === 0 ? <EmptyState text="No intake applications are waiting for review." /> : (
          <div style={{ display: "grid", gap: 10 }}>
            {pending.map(applicant => (
              <div key={applicant.id} style={{ ...listRow, alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{applicant.name}</div>
                    <div style={{ fontSize: 13, color: theme.inkSoft }}>{applicant.phone} · {applicant.email || "No email"}</div>
                    <div style={{ fontSize: 13, color: theme.inkSoft, marginTop: 3 }}>Requested assignment: Room {applicant.room}, Bed {applicant.bed}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button aria-label={`Approve ${applicant.name}`} onClick={() => decide(applicant, "approved")} style={btnSmallPrimary}><Check size={14} /></button>
                    <button aria-label={`Deny ${applicant.name}`} onClick={() => decide(applicant, "denied")} style={btnSmallDanger}><X size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Recent intake decisions">
        {reviewed.length === 0 ? <EmptyState text="No applications have been reviewed yet." /> : (
          <div style={{ display: "grid", gap: 6 }}>
            {reviewed.map(applicant => <div key={applicant.id} style={listRow}><span>{applicant.name} · Room {applicant.room}, Bed {applicant.bed}</span><Badge tone={applicant.approvalStatus === "approved" ? "accent" : "red"}>{applicant.approvalStatus}</Badge></div>)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RequestsTab({ data, persist, addAudit, addNotification }) {
  const pending = data.requests.filter(r => r.status === "pending").sort((a, b) => a.createdAt - b.createdAt);
  const decided = data.requests.filter(r => r.status !== "pending").sort((a, b) => b.decidedAt - a.decidedAt).slice(0, 15);

  const decide = async (req, status) => {
    const next = JSON.parse(JSON.stringify(data));
    const r = next.requests.find(x => x.id === req.id);
    r.status = status;
    r.decidedAt = Date.now();
    r.decidedBy = next.settings.managerName;
    const tenant = next.tenants.find(t => t.id === req.tenantId);
    addAudit(next, next.settings.managerName, `overnight_${status}`, `${status} request for ${tenant?.name} (${req.requestedDate} → ${req.returnDate}).`);
    if (tenant?.phone) {
      addNotification(next, tenant.phone, "sms",
        status === "approved"
          ? `Your overnight request for ${req.requestedDate} is approved. You'll be tested upon return. (Simulated SMS.)`
          : `Your overnight request for ${req.requestedDate} was denied. Talk to your program coordinator for details. (Simulated SMS.)`);
    }
    await persist(next);
  };

  return (
    <div>
      <Panel title="Pending requests" subtitle="Only requests that already passed the eligibility check reach this queue.">
        {pending.length === 0 ? <EmptyState text="Nothing pending." /> : (
          <div style={{ display: "grid", gap: 10 }}>
            {pending.map(r => {
              const tenant = data.tenants.find(t => t.id === r.tenantId);
              return (
                <div key={r.id} style={{ ...listRow, alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{tenant?.name || "Unknown"}</div>
                      <div style={{ fontSize: 13, color: theme.inkSoft }}>{r.requestedDate} → {r.returnDate} · drug test required on return</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => decide(r, "approved")} style={btnSmallPrimary}><Check size={14} /></button>
                      <button onClick={() => decide(r, "denied")} style={btnSmallDanger}><X size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel title="Recent decisions">
        {decided.length === 0 ? <EmptyState text="No decisions yet." /> : (
          <div style={{ display: "grid", gap: 6 }}>
            {decided.map(r => {
              const tenant = data.tenants.find(t => t.id === r.tenantId);
              return (
                <div key={r.id} style={listRow}>
                  <span>{tenant?.name} — {r.requestedDate} → {r.returnDate}</span>
                  <Badge tone={r.status === "approved" ? "accent" : "red"}>{r.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function computeReport(data, sinceTs) {
  const checkins = data.checkins.filter(c => c.timestamp >= sinceTs);
  const ins = checkins.filter(c => c.type === "in");
  const late = ins.filter(c => !c.onTime);
  const requests = data.requests.filter(r => r.createdAt >= sinceTs);
  return {
    totalCheckins: checkins.length,
    onTimeRate: ins.length ? Math.round(((ins.length - late.length) / ins.length) * 100) : 100,
    lateCount: late.length,
    requestsSubmitted: requests.length,
    requestsApproved: requests.filter(r => r.status === "approved").length,
    requestsDenied: requests.filter(r => r.status === "denied").length,
    requestsPending: requests.filter(r => r.status === "pending").length,
  };
}

function ReportsTab({ data }) {
  const now = Date.now();
  const daily = computeReport(data, now - 1 * 86400000);
  const weekly = computeReport(data, now - 7 * 86400000);
  const monthly = computeReport(data, now - 30 * 86400000);

  const summaryText = (label, r) =>
    `${label}: ${r.totalCheckins} check-ins logged, ${r.onTimeRate}% on time (${r.lateCount} late). ` +
    `Overnight requests: ${r.requestsSubmitted} submitted, ${r.requestsApproved} approved, ${r.requestsDenied} denied, ${r.requestsPending} pending.`;

  const [copied, setCopied] = useState(false);
  const copyAll = () => {
    const text = [summaryText("Last 24 hours", daily), summaryText("Last 7 days", weekly), summaryText("Last 30 days", monthly)].join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <Panel title="Reports for foundation leadership" subtitle="Pulled live from the check-in and request history — nothing to compile by hand.">
        <ReportBlock label="Daily" r={daily} />
        <ReportBlock label="Weekly" r={weekly} />
        <ReportBlock label="Monthly" r={monthly} />
        <button onClick={copyAll} style={{ ...btnSecondary, marginTop: 4 }}>
          {copied ? "Copied" : "Copy leadership summary"}
        </button>
      </Panel>
    </div>
  );
}

function ReportBlock({ label, r }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <MiniStat label="Check-ins" value={r.totalCheckins} />
        <MiniStat label="On-time rate" value={`${r.onTimeRate}%`} />
        <MiniStat label="Late" value={r.lateCount} />
        <MiniStat label="Requests" value={`${r.requestsApproved}/${r.requestsSubmitted}`} />
      </div>
    </div>
  );
}

function CommsTab({ data, persist, addAudit, addNotification }) {
  const sendWeeklyReminders = async () => {
    const next = JSON.parse(JSON.stringify(data));
    next.tenants.filter(t => t.active).forEach(t => {
      addNotification(next, t.phone || t.name, "sms", `Reminder: scheduled check-in this week, ${t.name}. Reply when you're in for the night. (Simulated SMS.)`);
    });
    addAudit(next, data.settings.managerName, "weekly_reminders_sent", `Sent to ${next.tenants.filter(t => t.active).length} residents.`);
    await persist(next);
  };

  const triggerRandomTests = async () => {
    const next = JSON.parse(JSON.stringify(data));
    const activeT = next.tenants.filter(t => t.active);
    const picked = activeT.filter(() => Math.random() < 0.4);
    (picked.length ? picked : activeT.slice(0, 1)).forEach(t => {
      addNotification(next, t.phone || t.name, "sms", `Random test notice for ${t.name}: report for testing today. (Simulated SMS.)`);
    });
    addAudit(next, data.settings.managerName, "random_test_triggered", `Notified ${picked.length || 1} resident(s).`);
    await persist(next);
  };

  return (
    <div>
      <Panel title="Send notifications">
        <p style={{ fontSize: 13, color: theme.inkSoft, marginBottom: 12 }}>
          These log exactly what would be texted. Connect Twilio on a real backend to actually send them — see the note below.
        </p>
        <div className="action-row" style={{ display: "flex", gap: 10 }}>
          <button onClick={sendWeeklyReminders} style={btnPrimary}><Send size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Weekly check-in reminders</button>
          <button onClick={triggerRandomTests} style={btnSecondary}><Bell size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Trigger random test round</button>
        </div>
      </Panel>
      <Panel title="Notification log">
        {data.notifications.length === 0 ? <EmptyState text="Nothing sent yet." /> : (
          <div style={{ display: "grid", gap: 6 }}>
            {data.notifications.slice(0, 30).map(n => (
              <div key={n.id} style={{ ...listRow, flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                <div style={{ fontSize: 12, color: theme.inkSoft }}>{fmtTime(n.timestamp)} · {n.channel.toUpperCase()} → {n.to}</div>
                <div style={{ fontSize: 13.5 }}>{n.message}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsTab({ data, persist, addAudit }) {
  const [local, setLocal] = useState(data.settings);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const next = JSON.parse(JSON.stringify(data));
    next.settings = local;
    addAudit(next, local.managerName, "settings_updated", "Updated curfew or contact settings.");
    await persist(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Panel title="Program settings">
      <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Program coordinator name">
          <input value={local.managerName} onChange={e => setLocal({ ...local, managerName: e.target.value })} style={input} />
        </Field>
        <Field label="Program coordinator phone">
          <input value={local.managerPhone} onChange={e => setLocal({ ...local, managerPhone: e.target.value })} style={input} placeholder="(555) 555-1212" />
        </Field>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, marginBottom: 8 }}>COMMUNITY HOURS</div>
      <div className="curfew-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {DAY_NAMES.map((d, i) => (
          <Field key={i} label={d}>
            <input type="time" value={local.curfews[i]} onChange={e => setLocal({ ...local, curfews: { ...local.curfews, [i]: e.target.value } })} style={input} />
          </Field>
        ))}
      </div>
      <button onClick={save} style={btnPrimary}>{saved ? "Saved" : "Save settings"}</button>
    </Panel>
  );
}

/* ---------------- SHARED UI PIECES ---------------- */

function Panel({ title, subtitle, children }) {
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "1.3rem 1.4rem", marginBottom: 16 }}>
      {title && <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, marginBottom: subtitle ? 3 : 12 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 13, color: theme.inkSoft, marginBottom: 14 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, marginBottom: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>{label}</span>
    </label>
  );
}

function Badge({ tone, children }) {
  const map = {
    accent: { bg: theme.accentSoft, c: "#4C5D3E" },
    amber: { bg: theme.amberSoft, c: theme.amber },
    red: { bg: theme.redSoft, c: theme.red },
  };
  const t = map[tone] || map.accent;
  return <span style={{ background: t.bg, color: t.c, fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{children}</span>;
}

function StatCard({ label, value, tone }) {
  const color = tone === "amber" ? theme.amber : theme.primary;
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "0.9rem 1rem" }}>
      <div style={{ fontSize: 24, fontWeight: 600, color, fontFamily: "'Fraunces', serif" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: theme.inkSoft }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: theme.inkSoft }}>{label}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ fontSize: 13.5, color: theme.inkSoft, padding: "0.6rem 0" }}>{text}</div>;
}

const input = {
  width: "100%", padding: "0.55rem 0.7rem", borderRadius: 8, border: `1px solid ${theme.border}`,
  fontSize: 14, fontFamily: "inherit", background: "#fff", color: theme.ink, boxSizing: "border-box",
};
const listRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "0.55rem 0.7rem", borderRadius: 8, background: theme.bg, fontSize: 14,
};
const btnBase = {
  padding: "0.55rem 1rem", borderRadius: 8, border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
};
const btnPrimary = { ...btnBase, background: theme.primary, color: "#fff" };
const btnSecondary = { ...btnBase, background: theme.primarySoft, color: theme.primary };
const btnDisabled = { ...btnBase, background: theme.border, color: theme.inkSoft, cursor: "not-allowed" };
const btnSmallPrimary = { ...btnBase, background: theme.accent, color: "#fff", padding: "0.4rem 0.6rem" };
const btnSmallDanger = { ...btnBase, background: theme.redSoft, color: theme.red, padding: "0.4rem 0.6rem" };
const tabActive = { ...btnBase, background: theme.primary, color: "#fff", padding: "0.4rem 0.8rem" };
const tabInactive = { ...btnBase, background: "transparent", color: theme.inkSoft, padding: "0.4rem 0.8rem", border: `1px solid ${theme.border}` };

