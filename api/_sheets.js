import { google } from "googleapis";

const SPREADSHEET_ID = "13yiU4efcTMpriA10i4_xS50gIlAN4tbAi6BaF9StKH0";
const OWNER_EMAIL = "ashreiimpactfoundation@gmail.com";
const PACKET_CURFEWS = { 0: "22:00", 1: "22:00", 2: "22:00", 3: "22:00", 4: "22:00", 5: "23:00", 6: "23:00" };
const EMPTY_STATE = {
  tenants: [], checkins: [], requests: [],
  maintenance: [], dailyReports: [], incidentReports: [], staffForms: [],
  settings: { curfews: PACKET_CURFEWS, curfewPolicyVersion: "client-packet-2026-09-28", managerName: "Program coordinator", managerPhone: "" },
  auditLog: [], notifications: [],
};

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("The Google service-account key has not been configured in Vercel.");
  try { return JSON.parse(raw); } catch { throw new Error("The Google service-account key in Vercel is not valid JSON."); }
}

async function sheets() {
  const credentials = serviceAccount();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

export async function assertOwner(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Owner sign-in is required."), { status: 401 });
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw Object.assign(new Error("Google sign-in could not be verified."), { status: 401 });
  const profile = await response.json();
  if ((profile.email || "").toLowerCase() !== OWNER_EMAIL) throw Object.assign(new Error("This Google account is not authorized for Owner access."), { status: 403 });
  return profile.email;
}

function iso(value) { return value ? new Date(value).toISOString() : ""; }
function rows(data) {
  return {
    Residents: data.tenants.map(t => [t.id, t.name, t.phone || "", t.email || "", t.room || "", t.bed || "", iso(t.admissionDate), Boolean(t.active), iso(t.signedAt), Boolean(t.consentDrugTest), Boolean(t.occupancyTermsAccepted), t.administrativeFee ?? 100, Boolean(t.paymentsNonRefundable), t.approvalStatus || "pending", iso(t.submittedAt), t.reviewedBy || "", iso(t.reviewedAt)]),
    "Check-Ins": data.checkins.map(c => [c.id, c.tenantId, data.tenants.find(t => t.id === c.tenantId)?.name || "", c.type, new Date(c.timestamp).toISOString().slice(0, 10), new Date(c.timestamp).toLocaleTimeString(), c.onTime ? "On time" : "Late", c.notes || ""]),
    "Overnight Requests": data.requests.map(r => [r.id, r.tenantId, data.tenants.find(t => t.id === r.tenantId)?.name || "", r.destination || "", r.requestedDate || "", r.returnDate || "", r.reason || "", r.status, r.decidedBy || "", iso(r.decidedAt), r.address || "", r.hostName || "", r.hostRelationship || ""]),
    "Daily Reports": (data.dailyReports || []).map(r => [r.id, iso(r.createdAt), r.managerName || "", r.residents || "", r.summary || "", r.actionTaken || ""]),
    "Incident Reports": (data.incidentReports || []).map(r => [r.id, iso(r.createdAt), r.managerName || "", r.residents || "", r.summary || "", r.actionTaken || ""]),
    "Staff Forms": (data.staffForms || []).map(r => [r.id, iso(r.createdAt), r.formType || "", r.formLabel || "", r.fields?.participant || "", r.fields?.staffName || "", JSON.stringify(r.fields || {})]),
    "Approved Intake Forms": (data.tenants || []).filter(t => t.approvalStatus === "approved" && t.application).map(t => [t.id, t.name || "", iso(t.submittedAt), iso(t.reviewedAt), t.reviewedBy || "", t.application.packetVersion || "", JSON.stringify({ applicant: t.application.applicant || {}, acknowledgments: t.application.acknowledgments || {}, initials: t.application.initials || {}, signatures: t.application.signatures || {}, signedAt: t.application.signedAt || "", finalTerms: t.application.finalTerms || {}, approvalCopyEmailStatus: t.approvalCopyEmailStatus || "", approvalCopyEmailSentAt: iso(t.approvalCopyEmailSentAt), approvalCopyRecipient: t.approvalCopyRecipient || "" })]),
    "Program Settings": [["Coordinator Name", data.settings?.managerName || ""], ["Coordinator Phone", data.settings?.managerPhone || ""]],
    "Audit Log": data.auditLog.map(a => [a.id, iso(a.timestamp), a.actor || "", a.action || "", a.entityType || "", a.entityId || "", a.detail || ""]),
    Notifications: data.notifications.map(n => [n.id, n.to || "", n.channel || "", n.message || "", "queued", iso(n.timestamp), ""]),
  };
}

async function ensureTabs(client, titles) {
  const result = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets.properties(sheetId,title)" });
  const existing = new Set((result.data.sheets || []).map(sheet => sheet.properties?.title));
  const missing = titles.filter(title => !existing.has(title));
  if (missing.length) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) },
    });
  }
}

export async function readState() {
  const client = await sheets();
  const result = await client.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Portal State'!A1" });
  const value = result.data.values?.[0]?.[0];
  if (!value) return null;
  const data = JSON.parse(value);
  if (!data.settings?.curfewPolicyVersion) {
    data.settings = { ...(data.settings || {}), curfews: { ...PACKET_CURFEWS }, curfewPolicyVersion: "client-packet-2026-09-28" };
  }
  return data;
}

export async function writeState(data) {
  const client = await sheets();
  const safe = { ...EMPTY_STATE, ...data, settings: { ...EMPTY_STATE.settings, ...(data.settings || {}) } };
  const sheetRows = rows(safe);
  await ensureTabs(client, Object.keys(sheetRows).concat("Portal State"));
  await client.spreadsheets.values.batchClear({ spreadsheetId: SPREADSHEET_ID, requestBody: { ranges: ["Residents!A2:Q1000", "'Check-Ins'!A2:H1000", "'Overnight Requests'!A2:M1000", "'Daily Reports'!A2:F1000", "'Incident Reports'!A2:F1000", "'Staff Forms'!A2:G2001", "'Approved Intake Forms'!A2:G2001", "'Program Settings'!A2:C1000", "'Audit Log'!A2:G2001", "Notifications!A2:G2001"] } });
  const updates = [
    { range: "'Portal State'!A1", values: [[JSON.stringify(safe)]] },
    { range: "'Daily Reports'!A1:F1", values: [["Record ID", "Submitted At", "Staff Member", "Participants", "Report Summary", "Action Taken"]] },
    { range: "'Incident Reports'!A1:F1", values: [["Record ID", "Submitted At", "Staff Member", "Participants", "Incident Summary", "Action Taken"]] },
    { range: "'Staff Forms'!A1:G1", values: [["Record ID", "Submitted At", "Form Type", "Form Name", "Participant", "Staff Member", "Form Details (JSON)"]] },
    { range: "'Approved Intake Forms'!A1:G1", values: [["Record ID", "Participant", "Submitted At", "Approved At", "Approved By", "Packet Version", "Complete Intake Record (JSON)"]] },
    { range: "'Overnight Requests'!D1", values: [["Stay Location"]] },
    { range: "'Overnight Requests'!K1:M1", values: [["Street Address", "Person Staying With", "Relationship"]] },
  ];
  for (const [name, values] of Object.entries(sheetRows)) if (values.length) updates.push({ range: `'${name}'!A2`, values });
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: "RAW", data: updates } });
  return safe;
}

export { EMPTY_STATE };
