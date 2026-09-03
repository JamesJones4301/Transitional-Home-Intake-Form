import { EMPTY_STATE, readState, writeState } from "./_sheets.js";

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clean = value => String(value || "").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  try {
    const body = req.body || {};
    if (body.type === "manager-daily" || body.type === "manager-incident") {
      const managerName = clean(body.managerName), summary = clean(body.summary), accessCode = clean(body.accessCode);
      if (!managerName || !summary || !accessCode) return res.status(400).json({ error: "Please complete the access code, your name, and the report." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      if (!data.settings?.houseManagerAccessCode || accessCode !== data.settings.houseManagerAccessCode) return res.status(403).json({ error: "That House Manager access code is not valid. Contact the Owner." });
      const createdAt = Date.now();
      const report = { id: id(), managerName, residents: clean(body.residents), summary, actionTaken: clean(body.actionTaken), createdAt };
      const isIncident = body.type === "manager-incident";
      const key = isIncident ? "incidentReports" : "dailyReports";
      data[key] = data[key] || [];
      data[key].unshift(report);
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: managerName, action: isIncident ? "incident_report_submitted" : "daily_report_submitted", detail: summary });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type === "maintenance") {
      const name = clean(body.name), phone = clean(body.phone), location = clean(body.location), description = clean(body.description);
      if (!name || !phone || !location || !description) return res.status(400).json({ error: "Please complete the required maintenance request fields." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      const tenant = data.tenants.find(t => t.active && t.name.toLowerCase() === name.toLowerCase() && t.phone.replace(/\D/g, "").slice(-4) === phone.replace(/\D/g, "").slice(-4));
      if (!tenant) return res.status(400).json({ error: "We could not verify an active resident using that name and phone number. Please contact the program coordinator." });
      const createdAt = Date.now();
      data.maintenance = data.maintenance || [];
      data.maintenance.unshift({ id: id(), tenantId: tenant.id, location, priority: clean(body.priority) || "routine", description, status: "reported", createdAt });
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: tenant.name, action: "maintenance_reported", detail: `${location}: ${description}` });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type === "overnight") {
      const name = clean(body.name), phone = clean(body.phone), requestedDate = clean(body.requestedDate), returnDate = clean(body.returnDate);
      if (!name || !phone || !requestedDate || !returnDate || !body.consentDrugTest) return res.status(400).json({ error: "Please complete every required overnight-request field." });
      if (new Date(returnDate) < new Date(requestedDate)) return res.status(400).json({ error: "Your return date must be after your leaving date." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      const tenant = data.tenants.find(t => t.active && t.name.toLowerCase() === name.toLowerCase() && t.phone.replace(/\D/g, "").slice(-4) === phone.replace(/\D/g, "").slice(-4));
      if (!tenant) return res.status(400).json({ error: "We could not verify an active resident using that name and phone number. Please contact the program coordinator." });
      const daysIn = Math.floor((Date.now() - tenant.admissionDate) / 86400000);
      if (daysIn <= 10 || !tenant.consentDrugTest) return res.status(400).json({ error: "This resident is not currently eligible for an overnight request. Please contact the program coordinator." });
      const createdAt = Date.now();
      data.requests.unshift({ id: id(), tenantId: tenant.id, requestedDate, returnDate, reason: clean(body.reason), status: "pending", createdAt, decidedAt: null, decidedBy: null, testRequired: true, testResult: null, eligibleAtRequest: true });
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: tenant.name, action: "overnight_requested", detail: `Requested overnight ${requestedDate} to ${returnDate}.` });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type !== "intake") return res.status(400).json({ error: "Unsupported public submission." });
    const name = clean(body.name), phone = clean(body.phone), room = clean(body.room), bed = clean(body.bed);
    if (!name || !phone || !room || !bed || !body.agreementAccepted || !body.screeningAccurate) return res.status(400).json({ error: "Please complete the required application fields and agreement." });
    const data = (await readState()) || structuredClone(EMPTY_STATE);
    const submittedAt = Date.now();
    const tenant = { id: id(), name, phone, email: clean(body.email), room, bed, admissionDate: new Date(body.admissionDate || submittedAt).getTime(), active: false, approvalStatus: "pending", submittedAt, leaseSigned: true, signedAt: submittedAt, consentDrugTest: Boolean(body.consentDrugTest), occupancyTermsAccepted: true, programStandardsAccepted: Boolean(body.programStandardsAccepted), moveInHygieneAccepted: Boolean(body.moveInHygieneAccepted), curseJarAccepted: Boolean(body.curseJarAccepted), screening: body.screening || {}, screeningAccurate: true, administrativeFee: 200, paymentsNonRefundable: true };
    data.tenants.push(tenant);
    data.auditLog.unshift({ id: id(), timestamp: submittedAt, actor: name, action: "intake_submitted", detail: `Submitted for approval. Requested Room ${room}, Bed ${bed}.` });
    await writeState(data);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Your application could not be saved right now. Please try again or contact Ashrei Impact Foundation." });
  }
}

