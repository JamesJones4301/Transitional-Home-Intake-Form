"use client";

// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import {
  Home, LogIn, LogOut, Calendar, Check, X, FileText, Bell,
  ClipboardList, Users, Settings, Send, AlertCircle, ChevronLeft,
  Clock, ShieldCheck, TrendingUp, PenLine, Moon, ArrowRight
} from "lucide-react";

const STORAGE_KEY = "ashrei-impact-resident-care";
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
  const residents = [
    { id: "resident-maya", name: "Maya Johnson", phone: "(555) 014-2031", email: "maya@example.org", room: "201", bed: "A", admissionDate: now - 18 * 86400000, active: true, leaseSigned: true, signedAt: now - 18 * 86400000, consentDrugTest: true },
    { id: "resident-daniel", name: "Daniel Brooks", phone: "(555) 014-2088", email: "daniel@example.org", room: "204", bed: "B", admissionDate: now - 8 * 86400000, active: true, leaseSigned: true, signedAt: now - 8 * 86400000, consentDrugTest: true },
  ];
  return {
    tenants: residents,
    checkins: [
      { id: "check-maya", tenantId: "resident-maya", type: "in", timestamp: now - 45 * 60000, onTime: true },
      { id: "check-daniel", tenantId: "resident-daniel", type: "out", timestamp: now - 3 * 3600000, onTime: true },
    ],
    requests: [
      { id: "request-maya", tenantId: "resident-maya", requestedDate: new Date(now + 4 * 86400000).toISOString().slice(0, 10), returnDate: new Date(now + 5 * 86400000).toISOString().slice(0, 10), status: "pending", createdAt: now - 2 * 3600000, decidedAt: null, decidedBy: null, testRequired: true, testResult: null, eligibleAtRequest: true },
    ],
    settings: { curfews: { ...DEFAULT_CURFEWS }, managerName: "Program coordinator", managerPhone: "" },
    auditLog: [],
    notifications: [],
  };
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

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError("Changes are showing but couldn't be saved. Try again in a moment.");
    }
  }, []);

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
        {(role === "manager" || role === "owner") && (
          <ManagerView
            data={data}
            persist={persist}
            addAudit={addAudit}
            addNotification={addNotification}
            readOnly={role === "owner"}
          />
        )}
      </div>
    </div>
  );
}

function Header({ role, setRole, setResidentId }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: role ? "pointer" : "default" }}
           onClick={() => { if (role) { setRole(null); setResidentId(null); } }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: theme.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Home size={18} color="#fff" />
        </div>
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
        A shared resident-care workspace for check-ins, overnight requests, intake, and program reporting.
        {activeCount > 0 && ` ${activeCount} active resident${activeCount === 1 ? "" : "s"}.`}
      </p>
      <div className="role-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <RoleCard icon={<LogIn size={20} />} title="I'm a resident" desc="Check in or out, request an overnight, view my status" onClick={() => setRole("resident")} />
        <RoleCard icon={<ClipboardList size={20} />} title="Program team" desc="Review requests, monitor check-ins, run reports" onClick={() => setRole("manager")} />
        <RoleCard icon={<TrendingUp size={20} />} title="Foundation leadership" desc="Read-only view of program reports" onClick={() => setRole("owner")} />
        <RoleCard icon={<PenLine size={20} />} title="New resident intake" desc="Complete your residency agreement and program commitments" onClick={() => setRole("intake")} accent />
      </div>
      <p style={{ fontSize: 12, color: theme.inkSoft, marginTop: 18 }}>
        This prototype stores information only on this device. Add secure accounts and a protected database before using it for sensitive resident information.
      </p>
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
  const [consentTest, setConsentTest] = useState(false);
  const [signature, setSignature] = useState("");
  const [done, setDone] = useState(false);

  const canSubmit = form.name && form.phone && form.room && form.bed && agreeLease && agreeRules && agreeOccupancyTerms &&
    signature.trim().toLowerCase() === form.name.trim().toLowerCase() && signature.trim().length > 1;

  const submit = async () => {
    const next = JSON.parse(JSON.stringify(data));
    const tenant = {
      id: uid(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      room: form.room.trim(),
      bed: form.bed.trim(),
      admissionDate: new Date(form.admissionDate).getTime(),
      active: true,
      leaseSigned: true,
      signedAt: Date.now(),
      consentDrugTest: consentTest,
      occupancyTermsAccepted: true,
      administrativeFee: 150,
      paymentsNonRefundable: true,
    };
    next.tenants.push(tenant);
    addAudit(next, tenant.name, "occupancy_agreement_signed", `Accepted occupancy terms; assigned to Room ${tenant.room}, Bed ${tenant.bed}. Drug-test consent: ${consentTest ? "yes" : "no"}.`);
    if (tenant.email) {
      addNotification(next, tenant.email, "email",
        `Welcome ${tenant.name} — attached: your signed occupancy agreement and community commitments. Your assignment is Room ${tenant.room}, Bed ${tenant.bed}. (Simulated: connect email delivery to send this.)`);
    }
    await persist(next);
    setDone(true);
  };

  if (done) {
    return (
      <Panel>
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <ShieldCheck size={30} color={theme.accent} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>Occupancy agreement signed — welcome</div>
          <p style={{ color: theme.inkSoft, fontSize: 14, marginBottom: 18 }}>
            Your Room {form.room}, Bed {form.bed} assignment is recorded. A copy of the signed agreement would be emailed to {form.email || "your email"} once email delivery is connected.
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
      <CheckField label="I consent to being drug tested, including upon return from any approved overnight stay" checked={consentTest} onChange={setConsentTest} />

      <Field label="Type your full name as your signature">
        <input value={signature} onChange={e => setSignature(e.target.value)} style={input} placeholder="Type your name to sign" />
      </Field>
      <p style={{ fontSize: 12, color: theme.inkSoft, marginTop: -6, marginBottom: 14 }}>
        Typing your name records your acknowledgement with a timestamp in this prototype.
      </p>

      <button disabled={!canSubmit} onClick={submit} style={canSubmit ? btnPrimary : btnDisabled}>
        Sign and submit
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
      <Panel title="Who are you?" subtitle="Pick your name to continue.">
        {active.length === 0 ? (
          <EmptyState text="No residents on file yet. Use New resident intake from the home screen first." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {active.map(t => (
              <button key={t.id} onClick={() => setResidentId(t.id)} style={{ ...listRow, cursor: "pointer" }}>
                <span>
                  <span style={{ fontWeight: 500, display: "block" }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: theme.inkSoft }}>{t.room && t.bed ? `Room ${t.room} · Bed ${t.bed}` : "Room and bed not assigned"}</span>
                </span>
                <ArrowRight size={15} color={theme.inkSoft} />
              </button>
            ))}
          </div>
        )}
      </Panel>
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

function ManagerView({ data, persist, addAudit, addNotification, readOnly }) {
  const [tab, setTab] = useState(readOnly ? "reports" : "today");
  const tabs = readOnly
    ? [["reports", "Reports"]]
    : [["today", "Today"], ["assignments", "Rooms & beds"], ["requests", "Overnight requests"], ["reports", "Reports"], ["comms", "Notifications"], ["settings", "Settings"]];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={tab === key ? tabActive : tabInactive}>{label}</button>
        ))}
      </div>
      {tab === "today" && <TodayTab data={data} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} addAudit={addAudit} />}
      {tab === "requests" && <RequestsTab data={data} persist={persist} addAudit={addAudit} addNotification={addNotification} />}
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

