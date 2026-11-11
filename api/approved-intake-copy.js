import { assertOwner, EMPTY_STATE, readState, writeState } from "./_sheets.js";

const RECIPIENT = "ashreiimpactfoundation@gmail.com";
const clean = value => String(value || "").trim();
const APPLICANT_QUESTIONS = {
  name: "Full legal name", preferredName: "Preferred name", birthDate: "Date of birth", adult: "Are you 18 or older?", phone: "Phone", email: "Email",
  currentAddress: "Current location or address", referralSource: "Referral source",
  independentLiving: "Can you live independently without detox, around-the-clock medical care, or medication administration by staff?",
  concerns: "Other support, legal, medical, behavioral, or housing needs you want staff to review (optional)",
  recoveryStatus: "Recovery status", recoveryOther: "Describe recovery status", sobrietyDate: "Sobriety or clean date", legalStatus: "Legal status", legalOther: "Describe legal status",
  priorSubstances: "Primary substances previously used", treatmentSupports: "Current treatment or recovery supports", legalContact: "Officer, court, or case contact, if applicable",
  registryRequirement: "Are you currently required to register as a sex offender?", goalOneYear: "One-year goals", goalFiveYears: "Five-year goals", goalTenYears: "Ten-year goals",
  paymentSource: "Payment source", paymentOther: "Other payment source", canPayAtMoveIn: "Can payment begin at move-in?", paymentFrequency: "Payment frequency",
  room: "Assigned room, if staff provided it", bed: "Assigned bed, if staff provided it", monthlyRate: "Participant-specific monthly rate, if staff confirmed it in writing ($)",
  faithParticipation: "Do you agree to the stated faith-centered program participation policies?", faithBackground: "Your faith walk, spiritual background, questions, or hoped-for growth",
  medicationStatus: "Do you currently take or have a prescription for any medication?", medications: "List each medication, its reason or purpose, and prescriber or notes",
  emergencyName: "Primary Emergency Contact", emergencyRelationship: "Relationship", emergencyPhone: "Primary Emergency Contact Phone", emergencyEmail: "Primary emergency contact email",
  secondaryName: "Secondary Contact", secondaryPhone: "Secondary Contact Phone",
  emergencyPermission: "May Ashrei contact your emergency person in an emergency or when you appear to have abandoned the program and cannot be reached?",
  releaseAuthorized: "Do you authorize any additional limited release of information?", releasePerson: "Person / Organization", releaseInformation: "Information Authorized",
  releasePurpose: "Purpose", releaseExpiration: "Expiration / Event", releaseCategories: "Information and purposes authorized, select all that apply", releaseOther: "Other, please specify",
  releaseSignatureDate: "Participant Signature Date", nextStep: "Requested next step", preferredMoveIn: "Preferred move-in date",
};
const ACKNOWLEDGMENT_QUESTIONS = {
  backgroundCheck: "I understand that a background check will be completed on all participants to verify past information.",
  sobriety: "I agree to live free of alcohol and prohibited drugs.", houseRules: "I agree to follow the house rules, curfew, chores, testing, and required meetings.",
  communitySafety: "I will help keep the residence free of drugs, alcohol, weapons, prohibited tobacco products, threats, and other prohibited items.",
  respect: "I will treat peers, neighbors, staff, volunteers, and guests with respect and integrity.",
  feeTerms: "I understand the fee schedule, the nonrefundable $100 administrative/application fee, and my duty to report a change in payment source or ability to pay. My exact monthly rate and sleeping space require written staff confirmation before move-in.",
  testing: "I consent to required drug and alcohol testing, including testing after an approved overnight stay. I will disclose medications that could affect a result.",
  medication: "I understand the medication self-management and safety policy.",
  curfew: "I will follow the posted curfew, sign-in/sign-out, and overnight-pass procedures, or obtain a documented exception.",
  visitors: "I will follow visitor limits and inform my visitors of the applicable rules.",
  accountability: "I reviewed the three-level accountability, discharge, transition, and lawful-possession policy.",
  property: "I reviewed the property retrieval and abandoned-property policy.", rights: "I reviewed my rights and the grievance or appeal process.",
  hygiene: "I understand the move-in laundry and shower procedure.",
  documents: "I reviewed all sections in this online form and certify the information I entered is accurate.",
  electronicSignature: "I intend my typed names and initials to record my electronic agreement to the sections identified above. I can print or save this page and ask Ashrei for a paper copy.",
  curseJar: "Curse jar acknowledgment (legacy intake only)",
};
const INITIAL_QUESTIONS = {
  agreement: "Agreement and program terms initials", termination: "Termination and possession terms initials", rules: "House rules and community standards initials",
  schedule: "Weekly schedule initials", medication: "Medication policy initials", curfew: "Curfew and overnight policy initials",
  accountability: "Accountability and discharge policy initials", property: "Property policy initials", rights: "Rights and grievance policy initials",
};
const SIGNATURE_QUESTIONS = {
  application: "Applicant certification - type your full legal name to sign", agreement: "Program participation agreement - type your full legal name to sign",
  fee: "Fee and sleeping-space acknowledgment - type your full legal name to sign", faith: "Faith-centered participation response - type your full legal name to sign",
  testing: "Drug and alcohol testing consent - type your full legal name to sign", release: "Participant Signature - type your full legal name to sign",
  receipt: "Receipt of program documents - type your full legal name to sign",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined || value === "" ? "Not provided" : String(value);
}

function section(title, values, questions = {}) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "";
  return `<h2 style="font:600 18px Arial,sans-serif;margin:24px 0 8px">${escapeHtml(title)}</h2><table style="border-collapse:collapse;width:100%">${entries.map(([key, value]) => `<tr><th style="border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;width:48%">${escapeHtml(questions[key] || key.replace(/([A-Z])/g, " $1"))}</th><td style="border:1px solid #ddd;padding:8px;white-space:pre-wrap">${escapeHtml(displayValue(value))}</td></tr>`).join("")}</table>`;
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
    "Intake month and year": finalTerms.intakeMonth || "",
    "Confirmed exact move-in date": finalTerms.programStartDate || "",
    "Final terms reviewed with participant by staff": finalTerms.reviewedWithParticipant ? "Yes" : "Not recorded",
    ...(finalTerms.participantSignature ? { "Prior participant final signature": finalTerms.participantSignature } : {}),
    "Ashrei representative": finalTerms.ashreiRepresentative || "",
  };
  return `<!doctype html><html><body style="font:15px Arial,sans-serif;color:#22332d;line-height:1.5"><h1 style="font:600 24px Arial,sans-serif">Approved participant intake copy</h1><p>This message contains the approved intake record for <strong>${escapeHtml(record.name)}</strong>. Every saved response appears beside the full question or acknowledgment text from the online intake. The program policy text is available in the linked client packet.</p>${section("Applicant questions and answers", application.applicant, APPLICANT_QUESTIONS)}${section("Required acknowledgments", application.acknowledgments, ACKNOWLEDGMENT_QUESTIONS)}${section("Participant initials", application.initials, INITIAL_QUESTIONS)}${section("Typed signatures", application.signatures, SIGNATURE_QUESTIONS)}${section("Final approval and assignment", approval)}<p style="margin-top:24px;color:#66736e">Packet: ${escapeHtml(application.packetVersion || "")} · Submitted: ${escapeHtml(application.signedAt ? new Date(application.signedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "")}</p></body></html>`;
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
    await assertOwner(req);
    const body = req.body || {};
    const recordId = clean(body.recordId);
    data = (await readState()) || structuredClone(EMPTY_STATE);
    record = (data.tenants || []).find(tenant => tenant.id === recordId);
    if (!record || record.approvalStatus !== "approved" || !record.application) return res.status(404).json({ error: "An approved intake record was not found." });
    if (record.approvalCopyEmailSentAt && !body.force) return res.status(200).json({ ok: true, sentAt: record.approvalCopyEmailSentAt, recipient: RECIPIENT, alreadySent: true });
    const url = process.env.INTAKE_ALERT_WEBHOOK_URL;
    const token = process.env.INTAKE_ALERT_WEBHOOK_TOKEN;
    if (!url || !token) return res.status(503).json({ error: "The approved-copy email service is not configured. The intake remains archived." });
    await updateDelivery(data, record, "sending");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type: "approved-copy", recordId, name: record.name, html: approvedIntakeHtml(record) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      await updateDelivery(data, record, "failed");
      return res.status(502).json({ error: "The approved-copy email service did not confirm delivery. The approval and archive were saved." });
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
