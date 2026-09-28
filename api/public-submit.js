import { EMPTY_STATE, readState, writeState } from "./_sheets.js";
import { authorizeStaff } from "./_staff-access.js";

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clean = value => String(value || "").trim();
const PACKET_VERSION = "Client View, September 28, 2026 (SL.19-SL.32)";
const INITIAL_SECTIONS = ["agreement", "termination", "rules", "schedule", "medication", "curfew", "accountability", "property", "rights"];
const SIGNATURE_SECTIONS = ["application", "agreement", "fee", "faith", "testing", "release", "receipt"];
const REQUIRED_ACKS = ["sobriety", "houseRules", "communitySafety", "respect", "feeTerms", "testing", "medication", "curfew", "visitors", "accountability", "property", "rights", "documents", "hygiene", "curseJar", "backgroundCheck", "electronicSignature"];
const APPLICANT_FIELDS = ["name", "preferredName", "birthDate", "adult", "phone", "email", "currentAddress", "referralSource", "recoveryStatus", "recoveryOther", "sobrietyDate", "priorSubstances", "treatmentSupports", "legalStatus", "legalOther", "legalContact", "independentLiving", "registryRequirement", "concerns", "medicationStatus", "medications", "faithParticipation", "faithBackground", "goalOneYear", "goalFiveYears", "goalTenYears", "emergencyName", "emergencyRelationship", "emergencyPhone", "emergencyEmail", "secondaryName", "secondaryPhone", "emergencyPermission", "releaseAuthorized", "releasePerson", "releaseInformation", "releasePurpose", "releaseExpiration", "paymentSource", "paymentOther", "canPayAtMoveIn", "nextStep", "preferredMoveIn", "room", "bed", "monthlyRate", "paymentFrequency"];
const STAFF_LABELS = { violation: "A. Violation and corrective action", finalWarning: "B. Final warning and behavior agreement", emergency: "C. Emergency safety incident", discharge: "D. Program discharge or license-termination notice", possession: "E. Notice-to-vacate and possession preparation", transition: "F. Discharge decision and transition checklist" };
const STAFF_REQUIRED = {
  violation: ["participant", "occurredAt", "staffName", "policy", "level", "facts", "priorCount", "response", "correctivePlan", "refusal", "staffWitness"],
  finalWarning: ["participant", "issuedAt", "staffName", "basis", "conduct", "conditions", "reviewDeadline", "representative", "refusal"],
  emergency: ["participant", "occurredAt", "staffName", "concern", "actions", "facts", "leadershipNotified"],
  discharge: ["participant", "issuedAt", "staffName", "basis", "status", "effectiveAt", "facts", "occupancy", "staffWitness", "representative"],
  possession: ["participant", "occurredAt", "staffName", "representative", "checks", "possessionStatus"],
  transition: ["participant", "occurredAt", "staffName", "representative", "policy", "facts", "checks"],
};
const textMap = (object, keys) => Object.fromEntries(keys.map(key => [key, clean(object?.[key]).slice(0, 4000)]));

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  try {
    const body = req.body || {};
    if (body.type === "staff-form") {
      const formType = clean(body.formType), accessCode = clean(body.accessCode);
      if (!Object.hasOwn(STAFF_LABELS, formType)) return res.status(400).json({ error: "Select a valid staff form." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      try { await authorizeStaff(req, data, accessCode); } catch (error) { return res.status(error.status || 403).json({ error: error.message }); }
      if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) return res.status(400).json({ error: "Complete the staff form." });
      const fields = Object.fromEntries(Object.entries(body.fields).filter(([key]) => /^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key)).map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 20).map(item => clean(item).slice(0, 200)) : clean(value).slice(0, 4000)]));
      if (STAFF_REQUIRED[formType].some(key => !fields[key] || (Array.isArray(fields[key]) && !fields[key].length))) return res.status(400).json({ error: "Complete every required staff field." });
      const createdAt = Date.now();
      data.staffForms = data.staffForms || [];
      data.staffForms.unshift({ id: id(), formType, formLabel: STAFF_LABELS[formType], fields, createdAt });
      data.auditLog = data.auditLog || [];
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: fields.staffName, action: "staff_form_submitted", detail: `${STAFF_LABELS[formType]} for ${fields.participant}.` });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type === "manager-daily" || body.type === "manager-incident") {
      const managerName = clean(body.managerName), summary = clean(body.summary), accessCode = clean(body.accessCode);
      if (!managerName || !summary) return res.status(400).json({ error: "Please enter your name and complete the report." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      try { await authorizeStaff(req, data, accessCode); } catch (error) { return res.status(error.status || 403).json({ error: error.message }); }
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
      if (!tenant) return res.status(400).json({ error: "We could not verify an active participant using that name and phone number. Please contact the program coordinator." });
      const createdAt = Date.now();
      data.maintenance = data.maintenance || [];
      data.maintenance.unshift({ id: id(), tenantId: tenant.id, location, priority: clean(body.priority) || "routine", description, status: "reported", createdAt });
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: tenant.name, action: "maintenance_reported", detail: `${location}: ${description}` });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type === "overnight") {
      const name = clean(body.name), phone = clean(body.phone), requestedDate = clean(body.requestedDate), returnDate = clean(body.returnDate);
      const destination = clean(body.destination), address = clean(body.address), hostName = clean(body.hostName), hostRelationship = clean(body.hostRelationship), reason = clean(body.reason);
      if (!name || !phone || !requestedDate || !returnDate || !destination || !address || !hostName || !hostRelationship || !reason || !body.consentDrugTest) return res.status(400).json({ error: "Please complete every required overnight-request field, including the stay details and reason." });
      if (new Date(returnDate) < new Date(requestedDate)) return res.status(400).json({ error: "Your return date must be after your leaving date." });
      const data = (await readState()) || structuredClone(EMPTY_STATE);
      const tenant = data.tenants.find(t => t.active && t.name.toLowerCase() === name.toLowerCase() && t.phone.replace(/\D/g, "").slice(-4) === phone.replace(/\D/g, "").slice(-4));
      if (!tenant) return res.status(400).json({ error: "We could not verify an active participant using that name and phone number. Please contact the program coordinator." });
      const daysIn = Math.floor((Date.now() - tenant.admissionDate) / 86400000);
      if (daysIn <= 10 || !tenant.consentDrugTest) return res.status(400).json({ error: "This participant is not currently eligible for an overnight request. Please contact the program coordinator." });
      const createdAt = Date.now();
      data.requests.unshift({ id: id(), tenantId: tenant.id, requestedDate, returnDate, destination, address, hostName, hostRelationship, reason, status: "pending", createdAt, decidedAt: null, decidedBy: null, testRequired: true, testResult: null, eligibleAtRequest: true });
      data.auditLog.unshift({ id: id(), timestamp: createdAt, actor: tenant.name, action: "overnight_requested", detail: `Requested overnight ${requestedDate} to ${returnDate}.` });
      await writeState(data);
      return res.status(201).json({ ok: true });
    }
    if (body.type !== "intake") return res.status(400).json({ error: "Unsupported public submission." });
    if (body.documentVersion !== PACKET_VERSION) return res.status(400).json({ error: "Refresh the form to review the current program packet." });
    const applicant = textMap(body.applicant, APPLICANT_FIELDS);
    applicant.releaseCategories = Array.isArray(body.applicant?.releaseCategories) ? body.applicant.releaseCategories.slice(0, 10).map(value => clean(value).slice(0, 100)) : [];
    const { name, phone, room, bed } = applicant;
    const required = ["name", "phone", "birthDate", "adult", "currentAddress", "independentLiving", "recoveryStatus", "legalStatus", "registryRequirement", "medicationStatus", "faithParticipation", "paymentSource", "canPayAtMoveIn", "nextStep", "emergencyName", "emergencyRelationship", "emergencyPhone", "emergencyPermission", "releaseAuthorized"];
    if (required.some(key => !applicant[key]) || applicant.adult !== "Yes") return res.status(400).json({ error: "Please complete the required application fields. Applicants must be 18 or older." });
    if ((applicant.medicationStatus === "Yes" && !applicant.medications) || (applicant.releaseAuthorized === "Yes" && ["releasePerson", "releaseInformation", "releasePurpose", "releaseExpiration"].some(key => !applicant[key]))) return res.status(400).json({ error: "Complete the medication and release details that apply." });
    const fee = applicant.monthlyRate ? Number(applicant.monthlyRate) : null;
    if (fee !== null && (!Number.isFinite(fee) || fee < 900)) return res.status(400).json({ error: "The stated participant rate needs staff review." });
    if (!body.agreementAccepted || !body.screeningAccurate || REQUIRED_ACKS.some(key => body.acknowledgments?.[key] !== true)) return res.status(400).json({ error: "Review and accept every required acknowledgment." });
    const expectedInitials = name.split(/\s+/).map(part => part[0] || "").join("").toUpperCase();
    if (INITIAL_SECTIONS.some(key => clean(body.initials?.[key]).toUpperCase() !== expectedInitials)) return res.status(400).json({ error: "Your initials must match your full legal name in each required section." });
    if (SIGNATURE_SECTIONS.some(key => clean(body.signatures?.[key]).replace(/\s+/g, " ").toLowerCase() !== name.replace(/\s+/g, " ").toLowerCase())) return res.status(400).json({ error: "Type your full legal name in each required signature field." });
    const data = (await readState()) || structuredClone(EMPTY_STATE);
    const submittedAt = Date.now();
    const tenant = { id: id(), name, phone, email: applicant.email, room, bed, admissionDate: applicant.preferredMoveIn ? new Date(`${applicant.preferredMoveIn}T12:00:00`).getTime() : submittedAt, active: false, approvalStatus: "pending", submittedAt, applicationSigned: true, leaseSigned: false, signedAt: submittedAt, consentDrugTest: true, occupancyTermsAccepted: true, programStandardsAccepted: true, moveInHygieneAccepted: true, curseJarAccepted: true, screeningAccurate: true, administrativeFee: 100, monthlyRate: fee, feeAssignmentPending: true, application: { applicant, acknowledgments: Object.fromEntries(REQUIRED_ACKS.map(key => [key, true])), initials: textMap(body.initials, INITIAL_SECTIONS), signatures: textMap(body.signatures, SIGNATURE_SECTIONS), packetVersion: PACKET_VERSION, signedAt: submittedAt } };
    data.tenants.push(tenant);
    data.auditLog.unshift({ id: id(), timestamp: submittedAt, actor: name, action: "intake_submitted", detail: "Submitted client packet for review. Assignment and rate require staff confirmation." });
    await writeState(data);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Your application could not be saved right now. Please try again or contact Ashrei Impact Foundation." });
  }
}
