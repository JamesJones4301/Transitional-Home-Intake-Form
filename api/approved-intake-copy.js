import { assertOwner, EMPTY_STATE, readState, writeState } from "./_sheets.js";

const RECIPIENT = "ashreiimpactfoundation@gmail.com";
const clean = value => String(value || "").trim();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function section(title, values) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "";
  return `<h2 style="font:600 18px Arial,sans-serif;margin:24px 0 8px">${escapeHtml(title)}</h2><table style="border-collapse:collapse;width:100%">${entries.map(([key, value]) => `<tr><th style="border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;width:34%">${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</th><td style="border:1px solid #ddd;padding:8px;white-space:pre-wrap">${escapeHtml(displayValue(value))}</td></tr>`).join("")}</table>`;
}

function approvedIntakeHtml(record) {
  const application = record.application || {};
  const finalTerms = application.finalTerms || {};
  const approval = {
    "Approval status": record.approvalStatus,
    "Approved at": record.reviewedAt ? new Date(record.reviewedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "",
    "Approved by": record.reviewedBy,
    "Room": record.room,
    "Bed": record.bed,
    "Monthly rate": record.monthlyRate ? `$${record.monthlyRate}` : "",
    "Program start date": finalTerms.programStartDate || "",
    "Participant final signature": finalTerms.participantSignature || "",
    "Ashrei representative": finalTerms.ashreiRepresentative || "",
  };
  return `<!doctype html><html><body style="font:15px Arial,sans-serif;color:#22332d;line-height:1.5"><h1 style="font:600 24px Arial,sans-serif">Approved participant intake copy</h1><p>This message contains the approved intake record for <strong>${escapeHtml(record.name)}</strong>.</p>${section("Applicant information", application.applicant)}${section("Required acknowledgments", application.acknowledgments)}${section("Participant initials", application.initials)}${section("Typed signatures", application.signatures)}${section("Final approval and assignment", approval)}<p style="margin-top:24px;color:#66736e">Packet: ${escapeHtml(application.packetVersion || "")} · Submitted: ${escapeHtml(application.signedAt ? new Date(application.signedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "")}</p></body></html>`;
}

function encodeMessage(to, subject, html) {
  const subjectEncoded = Buffer.from(subject, "utf8").toString("base64");
  const bodyEncoded = Buffer.from(html, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  const message = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${subjectEncoded}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyEncoded,
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

async function updateDelivery(data, record, status, sentAt = null) {
  record.approvalCopyEmailStatus = status;
  record.approvalCopyEmailRecipient = RECIPIENT;
  if (sentAt) record.approvalCopyEmailSentAt = sentAt;
  await writeState(data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  let data;
  let record;
  try {
    const token = clean((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    await assertOwner(req);
    const body = req.body || {};
    const recordId = clean(body.recordId);
    data = (await readState()) || structuredClone(EMPTY_STATE);
    record = (data.tenants || []).find(tenant => tenant.id === recordId);
    if (!record || record.approvalStatus !== "approved" || !record.application) return res.status(404).json({ error: "An approved intake record was not found." });
    if (record.approvalCopyEmailSentAt && !body.force) return res.status(200).json({ ok: true, sentAt: record.approvalCopyEmailSentAt, recipient: RECIPIENT, alreadySent: true });
    if (record.approvalCopyEmailStatus === "sending") return res.status(409).json({ error: "An intake copy email is already being sent for this application." });

    await updateDelivery(data, record, "sending");
    const subject = `Approved participant intake copy: ${record.name || "Participant"}`;
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encodeMessage(RECIPIENT, subject, approvedIntakeHtml(record)) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await updateDelivery(data, record, "failed");
      return res.status(502).json({ error: result.error?.message || "Gmail could not send the intake copy. The approval and archive were saved." });
    }

    const sentAt = Date.now();
    await updateDelivery(data, record, "sent", sentAt);
    return res.status(200).json({ ok: true, sentAt, recipient: RECIPIENT });
  } catch (error) {
    if (data && record?.approvalStatus === "approved" && !record.approvalCopyEmailSentAt) {
      try { await updateDelivery(data, record, "failed"); } catch {}
    }
    return res.status(error.status || 500).json({ error: error.status ? error.message : "The approved intake was saved, but the email copy could not be sent." });
  }
}
