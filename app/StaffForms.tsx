"use client";

import React, { useState } from "react";

type FieldSpec = { key: string; label: string; required?: boolean; type?: "date" | "datetime-local" | "textarea"; choices?: string[]; multi?: boolean };
type FormSpec = { label: string; guidance: string; fields: FieldSpec[] };

export const STAFF_FORMS: Record<string, FormSpec> = {
  violation: { label: "A. Violation and corrective action", guidance: "Record observed facts, prior Level 1 history, required response, participant comments, and delivery. Receipt does not mean agreement. Document a refusal to sign with a witness.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "occurredAt", label: "Date and time", type: "datetime-local", required: true },
    { key: "staffName", label: "Staff issuing notice", required: true }, { key: "policy", label: "Policy or rule", required: true },
    { key: "level", label: "Violation level", choices: ["Level 1 - routine/administrative", "Level 2 - serious", "Level 3 - safety/critical"], required: true },
    { key: "facts", label: "Observed conduct and facts", type: "textarea", required: true },
    { key: "priorCount", label: "Prior Level 1 violations in rolling 60 days", choices: ["0", "1", "2", "3+"], required: true },
    { key: "priorDates", label: "Dates of prior notices" },
    { key: "response", label: "Required response", choices: ["Documented coaching", "Written corrective action", "Leadership meeting", "Testing under policy", "Final warning/behavior agreement", "Program termination review", "Other"], multi: true, required: true },
    { key: "correctivePlan", label: "Corrective action and deadline", type: "textarea", required: true },
    { key: "participantComments", label: "Participant comments", type: "textarea" },
    { key: "participantSignature", label: "Participant typed signature, if received" },
    { key: "refusal", label: "Receipt or refusal", choices: ["Signed receipt", "Refused to sign", "Not available"], required: true },
    { key: "staffWitness", label: "Staff or witness typed name", required: true },
  ] },
  finalWarning: { label: "B. Final warning and behavior agreement", guidance: "A further violation or unmet condition may lead to termination without another progressive warning.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "issuedAt", label: "Date issued", type: "date", required: true },
    { key: "staffName", label: "Staff completing form", required: true },
    { key: "basis", label: "Basis", choices: ["Accumulated Level 1 violations", "Level 2 serious violation", "Pattern of noncompliance", "Other"], multi: true, required: true },
    { key: "conduct", label: "Conduct requiring correction", type: "textarea", required: true },
    { key: "conditions", label: "Required behavior and conditions", type: "textarea", required: true },
    { key: "reviewDeadline", label: "Review period or deadline", required: true },
    { key: "participantSignature", label: "Participant typed signature, if received" },
    { key: "representative", label: "Authorized Ashrei representative typed name", required: true },
    { key: "refusal", label: "Receipt or refusal", choices: ["Signed", "Refused to sign", "Not available"], required: true },
  ] },
  emergency: { label: "C. Emergency safety incident", guidance: "Address immediate danger first. This form records actions after a safety response.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "occurredAt", label: "Date and time", type: "datetime-local", required: true },
    { key: "staffName", label: "Staff completing report", required: true },
    { key: "concern", label: "Safety concern", choices: ["Violence", "Credible threat", "Weapon", "Drug distribution", "Fire/arson", "Serious intimidation/harassment", "Medical/overdose emergency", "Other"], multi: true, required: true },
    { key: "actions", label: "Immediate actions", choices: ["Directed away from common areas or residence for safety", "Law enforcement contacted", "EMS contacted", "Crisis service contacted", "Others moved or protected", "Program suspended/terminated", "Other"], multi: true, required: true },
    { key: "facts", label: "Facts, witnesses, and response", type: "textarea", required: true },
    { key: "incidentNumber", label: "Emergency or incident number" },
    { key: "leadershipNotified", label: "Leadership notified and when", required: true },
  ] },
  discharge: { label: "D. Program discharge or license-termination notice", guidance: "Only an authorized Ashrei representative issues formal notices. Program termination is separate from notice to vacate and any lawful possession process. Recording this form does not remove a person or serve a legal notice.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "issuedAt", label: "Date issued", type: "date", required: true },
    { key: "staffName", label: "Staff preparing record", required: true },
    { key: "basis", label: "Level of action", choices: ["Routine/administrative, progressive accountability exhausted", "Repeated noncompliance", "Serious program violation", "Immediate safety/critical", "Sobriety requirement", "Nonpayment", "No longer eligible", "Other"], multi: true, required: true },
    { key: "status", label: "Program status", choices: ["Final warning, participation continues", "Terminated effective at stated time", "Suspended pending review", "Immediate termination due to serious/safety circumstances"], required: true },
    { key: "effectiveAt", label: "Effective date and time", type: "datetime-local", required: true },
    { key: "facts", label: "Reasons and supporting facts", type: "textarea", required: true },
    { key: "priorNotices", label: "Prior notices and incidents" },
    { key: "occupancy", label: "Occupancy or possession status", choices: ["Voluntarily surrendered occupancy and property", "Agreed to vacate by specified time", "Written notice to vacate delivered if applicable", "Still in possession, refer for legal process", "Emergency or law-enforcement intervention"], multi: true, required: true },
    { key: "transition", label: "Transition and referrals offered", type: "textarea" },
    { key: "participantSignature", label: "Participant receipt or typed signature, if received" },
    { key: "staffWitness", label: "Staff or witness typed name", required: true },
    { key: "representative", label: "Authorized Ashrei representative typed name", required: true },
  ] },
  possession: { label: "E. Notice-to-vacate and possession preparation", guidance: "Use after a program discharge when occupancy was not voluntarily surrendered. Confirm applicable Texas notice and process with authorized leadership or counsel before any formal legal step.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "occurredAt", label: "Checklist date", type: "date", required: true },
    { key: "staffName", label: "Prepared by", required: true }, { key: "representative", label: "Authorized by", required: true },
    { key: "checks", label: "Preparation checks", choices: ["Termination decision and records completed", "Current occupancy status confirmed", "Agreement and file reviewed", "Required Texas notice prepared with grounds, date, method, deadline", "Delivery documented", "No unlawful lockout, utility interruption, physical removal, or disposal", "Leadership reviewed filing/process if occupant remains", "Safety plan active", "Property retrieval coordinated separately", "Bed status updated only after voluntary surrender or lawful recovery"], multi: true, required: true },
    { key: "noticeDetails", label: "Notice grounds, deadline, and delivery details if applicable", type: "textarea" },
    { key: "possessionStatus", label: "Current occupancy and next step", type: "textarea", required: true },
  ] },
  transition: { label: "F. Discharge decision and transition checklist", guidance: "Document the decision, safety needs, property and medication plan, referrals, and the separate occupancy status.", fields: [
    { key: "participant", label: "Participant", required: true }, { key: "occurredAt", label: "Date and time", type: "datetime-local", required: true },
    { key: "staffName", label: "Staff completing checklist", required: true }, { key: "representative", label: "Authorized Ashrei representative", required: true },
    { key: "policy", label: "Policy or rule", required: true }, { key: "facts", label: "Observed facts and decision", type: "textarea", required: true },
    { key: "checks", label: "Discharge and transition checks", choices: ["Violation level and facts documented", "Prior Level 1 history reviewed", "Immediate safety needs addressed", "Authorized representative approved termination", "Notice prepared and delivered", "Occupancy/possession separately documented", "Payment status documented", "Medication and property retrieval addressed", "Authorized support contact considered", "Referrals offered when safe", "Incident, test, and witness records retained", "Bed updated only after lawful departure"], multi: true, required: true },
    { key: "immediateAction", label: "Immediate action", type: "textarea" },
    { key: "correctivePlan", label: "Corrective plan or deadline", type: "textarea" },
    { key: "propertyPlan", label: "Property retrieval plan", type: "textarea" },
    { key: "referrals", label: "Referrals and transition support", type: "textarea" },
  ] },
};

const inputStyle = { width: "100%", padding: "0.6rem 0.7rem", border: "1px solid #d8d7cf", borderRadius: 8, font: "inherit", boxSizing: "border-box" as const };

export default function StaffForms() {
  const [kind, setKind] = useState("violation");
  const [accessCode, setAccessCode] = useState("");
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const spec = STAFF_FORMS[kind];
  function change(key: string, value: string | string[]) { setValues(previous => ({ ...previous, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus("");
    if (!accessCode.trim()) return setStatus("Enter the House Manager access code.");
    if (spec.fields.some(field => field.required && (Array.isArray(values[field.key]) ? !(values[field.key] as string[]).length : !String(values[field.key] || "").trim()))) return setStatus("Complete every required field.");
    setBusy(true);
    try {
      const response = await fetch("/api/public-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "staff-form", accessCode, formType: kind, fields: values }) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "The staff record could not be saved.");
      setStatus("Staff record saved to the restricted Owner workspace. Print or save a copy if a signed notice must be delivered.");
      setValues({});
    } catch (failure: any) { setStatus(failure.message || "The staff record could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className="packet-shell"><div className="packet-section"><h2>Staff forms</h2>
    <p className="packet-note">For authorized staff. These records are separate from member requests. Protect the access code and include only facts needed for the program record. Call emergency services for an immediate threat.</p>
    <label className="packet-field"><span>House Manager access code</span><input type="password" autoComplete="off" value={accessCode} onChange={event => setAccessCode(event.target.value)} style={inputStyle} /></label>
    <label className="packet-field"><span>Select staff form</span><select value={kind} onChange={event => { setKind(event.target.value); setValues({}); setStatus(""); }} style={inputStyle}>{Object.entries(STAFF_FORMS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
  </div><form onSubmit={submit} className="packet-form"><section className="packet-section"><h2>{spec.label}</h2><p className="packet-note">{spec.guidance}</p>
    {spec.fields.map(field => <label className="packet-field" key={field.key}><span>{field.label}{field.required ? " *" : ""}</span>
      {field.choices && field.multi ? <fieldset className="packet-fieldset"><legend>Select all that apply</legend>{field.choices.map(choice => <label key={choice} className="packet-check"><input type="checkbox" checked={Array.isArray(values[field.key]) && (values[field.key] as string[]).includes(choice)} onChange={event => change(field.key, event.target.checked ? [...((values[field.key] as string[]) || []), choice] : ((values[field.key] as string[]) || []).filter(item => item !== choice))} />{choice}</label>)}</fieldset>
        : field.choices ? <select value={(values[field.key] as string) || ""} onChange={event => change(field.key, event.target.value)} required={field.required} style={inputStyle}><option value="">Select</option>{field.choices.map(choice => <option key={choice}>{choice}</option>)}</select>
        : field.type === "textarea" ? <textarea value={(values[field.key] as string) || ""} onChange={event => change(field.key, event.target.value)} required={field.required} style={{ ...inputStyle, minHeight: 85 }} />
        : <input type={field.type || "text"} value={(values[field.key] as string) || ""} onChange={event => change(field.key, event.target.value)} required={field.required} style={inputStyle} />}</label>)}
    {status && <p role="status" className="packet-note">{status}</p>}<button type="submit" className="packet-submit" disabled={busy}>{busy ? "Saving..." : "Save staff record"}</button>
  </section></form></div>;
}
