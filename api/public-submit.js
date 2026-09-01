import { EMPTY_STATE, readState, writeState } from "./_sheets.js";

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clean = value => String(value || "").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  try {
    const body = req.body || {};
    if (body.type !== "intake") return res.status(400).json({ error: "Unsupported public submission." });
    const name = clean(body.name), phone = clean(body.phone), room = clean(body.room), bed = clean(body.bed);
    if (!name || !phone || !room || !bed || !body.agreementAccepted) return res.status(400).json({ error: "Please complete the required application fields and agreement." });
    const data = (await readState()) || structuredClone(EMPTY_STATE);
    const submittedAt = Date.now();
    const tenant = { id: id(), name, phone, email: clean(body.email), room, bed, admissionDate: new Date(body.admissionDate || submittedAt).getTime(), active: false, approvalStatus: "pending", submittedAt, leaseSigned: true, signedAt: submittedAt, consentDrugTest: Boolean(body.consentDrugTest), occupancyTermsAccepted: true, administrativeFee: 150, paymentsNonRefundable: true };
    data.tenants.push(tenant);
    data.auditLog.unshift({ id: id(), timestamp: submittedAt, actor: name, action: "intake_submitted", detail: `Submitted for approval. Requested Room ${room}, Bed ${bed}.` });
    await writeState(data);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Your application could not be saved right now. Please try again or contact Ashrei Impact Foundation." });
  }
}

