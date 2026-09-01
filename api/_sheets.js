import { google } from "googleapis";

const SPREADSHEET_ID = "13yiU4efcTMpriA10i4_xS50gIlAN4tbAi6BaF9StKH0";
const OWNER_EMAIL = "ashreiimpactfoundation@gmail.com";
const EMPTY_STATE = {
  tenants: [], checkins: [], requests: [],
  settings: { curfews: { 0: "23:00", 1: "21:00", 2: "21:00", 3: "21:00", 4: "21:00", 5: "23:00", 6: "23:00" }, managerName: "Program coordinator", managerPhone: "" },
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
    Residents: data.tenants.map(t => [t.id, t.name, t.phone || "", t.email || "", t.room || "", t.bed || "", iso(t.admissionDate), Boolean(t.active), iso(t.signedAt), Boolean(t.consentDrugTest), Boolean(t.occupancyTermsAccepted), t.administrativeFee || 150, Boolean(t.paymentsNonRefundable), t.approvalStatus || "pending", iso(t.submittedAt), t.reviewedBy || "", iso(t.reviewedAt)]),
    "Check-Ins": data.checkins.map(c => [c.id, c.tenantId, data.tenants.find(t => t.id === c.tenantId)?.name || "", c.type, new Date(c.timestamp).toISOString().slice(0, 10), new Date(c.timestamp).toLocaleTimeString(), c.onTime ? "On time" : "Late", c.notes || ""]),
    "Overnight Requests": data.requests.map(r => [r.id, r.tenantId, data.tenants.find(t => t.id === r.tenantId)?.name || "", r.destination || "", r.requestedDate || "", r.returnDate || "", r.reason || "", r.status, r.decidedBy || "", iso(r.decidedAt)]),
    "Program Settings": [["Coordinator Name", data.settings?.managerName || ""], ["Coordinator Phone", data.settings?.managerPhone || ""]],
    "Audit Log": data.auditLog.map(a => [a.id, iso(a.timestamp), a.actor || "", a.action || "", a.entityType || "", a.entityId || "", a.detail || ""]),
    Notifications: data.notifications.map(n => [n.id, n.to || "", n.channel || "", n.message || "", "queued", iso(n.timestamp), ""]),
  };
}

export async function readState() {
  const client = await sheets();
  const result = await client.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Portal State'!A1" });
  const value = result.data.values?.[0]?.[0];
  return value ? JSON.parse(value) : null;
}

export async function writeState(data) {
  const client = await sheets();
  const safe = { ...EMPTY_STATE, ...data, settings: { ...EMPTY_STATE.settings, ...(data.settings || {}) } };
  const sheetRows = rows(safe);
  await client.spreadsheets.values.batchClear({ spreadsheetId: SPREADSHEET_ID, requestBody: { ranges: ["Residents!A2:Q1000", "'Check-Ins'!A2:H1000", "'Overnight Requests'!A2:J1000", "'Program Settings'!A2:C1000", "'Audit Log'!A2:G2001", "Notifications!A2:G2001"] } });
  const updates = [{ range: "'Portal State'!A1", values: [[JSON.stringify(safe)]] }];
  for (const [name, values] of Object.entries(sheetRows)) if (values.length) updates.push({ range: `'${name}'!A2`, values });
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: "RAW", data: updates } });
  return safe;
}

export { EMPTY_STATE };

