"use client";

import React, { useState } from "react";

const PACKET_VERSION = "Client View, September 28, 2026 (SL.19-SL.32)";
const INITIAL_SECTIONS = ["agreement", "termination", "rules", "schedule", "medication", "curfew", "accountability", "property", "rights"];
const SIGNATURE_SECTIONS = ["application", "agreement", "fee", "faith", "testing", "release", "receipt"];
const REQUIRED_ACKS = ["sobriety", "houseRules", "communitySafety", "respect", "feeTerms", "testing", "medication", "curfew", "visitors", "accountability", "property", "rights", "documents", "hygiene", "curseJar", "electronicSignature"];

const empty = {
  name: "", preferredName: "", birthDate: "", adult: "", phone: "", email: "", currentAddress: "", referralSource: "",
  recoveryStatus: "", recoveryOther: "", sobrietyDate: "", priorSubstances: "", treatmentSupports: "", legalStatus: "", legalOther: "", legalContact: "",
  independentLiving: "", registryRequirement: "", concerns: "", medicationStatus: "", medications: "", faithParticipation: "", faithBackground: "",
  goalOneYear: "", goalFiveYears: "", goalTenYears: "", emergencyName: "", emergencyRelationship: "", emergencyPhone: "", emergencyEmail: "",
  secondaryName: "", secondaryPhone: "", emergencyPermission: "", releaseAuthorized: "", releasePerson: "", releaseInformation: "", releasePurpose: "", releaseExpiration: "", releaseCategories: [] as string[],
  paymentSource: "", paymentOther: "", canPayAtMoveIn: "", nextStep: "", preferredMoveIn: "", room: "", bed: "", monthlyRate: "", paymentFrequency: "Monthly",
};

const box = { width: "100%", padding: "0.6rem 0.7rem", border: "1px solid #d8d7cf", borderRadius: 8, font: "inherit", boxSizing: "border-box" as const };

export default function IntakeForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState(empty);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [initials, setInitials] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof empty, value: any) => setForm(previous => ({ ...previous, [key]: value }));
  const expectedInitials = form.name.trim().split(/\s+/).map(part => part[0] || "").join("").toUpperCase();
  const initial = (key: string, label: string) => <label className="packet-initial">{label} initials
    <input aria-label={`${label} initials`} value={initials[key] || ""} onChange={event => setInitials({ ...initials, [key]: event.target.value })} maxLength={8} placeholder={expectedInitials || "Initials"} required />
  </label>;
  const sign = (key: string, label: string) => <Field label={`${label} - type your full legal name to sign`}>
    <input value={signatures[key] || ""} onChange={event => setSignatures({ ...signatures, [key]: event.target.value })} style={box} autoComplete="off" required />
  </Field>;
  const check = (key: string, label: string) => <label className="packet-check">
    <input type="checkbox" checked={Boolean(acks[key])} onChange={event => setAcks({ ...acks, [key]: event.target.checked })} /> <span>{label}</span>
  </label>;
  const select = (key: keyof typeof empty, values: string[], required = true) => <select value={form[key] as string} onChange={event => set(key, event.target.value)} style={box} required={required}>
    <option value="">Select an answer</option>{values.map(value => <option key={value}>{value}</option>)}
  </select>;
  const input = (key: keyof typeof empty, required = false, type = "text") => <input type={type} value={form[key] as string} onChange={event => set(key, event.target.value)} style={box} required={required} />;
  const area = (key: keyof typeof empty, required = false) => <textarea value={form[key] as string} onChange={event => set(key, event.target.value)} style={{ ...box, minHeight: 76 }} required={required} />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const fullName = form.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (form.adult !== "Yes") return setError("Applicants must be at least 18 years old.");
    if (REQUIRED_ACKS.some(key => !acks[key])) return setError("Please review and check every required acknowledgment.");
    if (INITIAL_SECTIONS.some(key => initials[key]?.trim().toUpperCase() !== expectedInitials)) return setError(`Enter your initials, ${expectedInitials}, in each policy section.`);
    if (SIGNATURE_SECTIONS.some(key => signatures[key]?.trim().replace(/\s+/g, " ").toLowerCase() !== fullName)) return setError("Type your full legal name in each signature field.");
    if (form.medicationStatus === "Yes" && !form.medications.trim()) return setError("List your current medications, purpose, and prescriber or notes.");
    if (form.releaseAuthorized === "Yes" && (!form.releasePerson.trim() || !form.releaseInformation.trim() || !form.releasePurpose.trim() || !form.releaseExpiration.trim())) return setError("Complete the limited release details or choose No.");
    if (form.monthlyRate && Number(form.monthlyRate) < 900) return setError("The packet lists a starting rate of $900. Ask staff to confirm any other rate in writing.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/public-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: "intake", applicant: form, acknowledgments: acks, initials, signatures,
        documentVersion: PACKET_VERSION, agreementAccepted: true, screeningAccurate: true,
      }) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "Application could not be saved.");
      setSubmitted(true);
    } catch (failure: any) { setError(failure.message || "Application could not be saved. Please try again."); }
    finally { setSubmitting(false); }
  }

  return <div className="packet-shell">
    <header className="packet-header">
      <figure><img src="/bird-pepper-place-exterior.jpg" alt="Bird Pepper Place residence" /><figcaption>Bird Pepper Place, 2017 Cheshire Drive, Austin</figcaption></figure>
      <div><h1>Ashrei New Member Intake</h1><p>Bird Pepper Place sober-living program, 2017 Cheshire Dr, Austin, TX 78723</p>
        <p>Review each section below before signing. Ask Ashrei staff for a copy of the full program packet for your records.</p>
        <p className="packet-note">Submission does not guarantee admission or a bed assignment. Ashrei does not provide detoxification, medical care, medication administration, or clinical substance-use treatment.</p>
      </div>
    </header>
    {submitted && <div className="packet-success" role="status"><strong>Application submitted for staff review.</strong> Keep this page open to print your completed answers. Staff will confirm your space and monthly rate in writing before move-in. <button type="button" onClick={() => window.print()}>Print or save copy</button><button type="button" onClick={onDone}>Back to home</button></div>}
    <form onSubmit={submit} className="packet-form">
      <fieldset disabled={submitted} className="packet-completed-fields">
      <Section title="1. Applicant and admission information" note="Adults who live independently in a shared residence may apply. Ashrei reviews eligibility and requested accommodations individually.">
        <div className="packet-two"><Field label="Full legal name">{input("name", true)}</Field><Field label="Preferred name">{input("preferredName")}</Field>
          <Field label="Date of birth">{input("birthDate", true, "date")}</Field><Field label="Are you 18 or older?">{select("adult", ["Yes", "No"])}</Field>
          <Field label="Phone">{input("phone", true, "tel")}</Field><Field label="Email">{input("email", false, "email")}</Field></div>
        <Field label="Current location or address">{input("currentAddress", true)}</Field><Field label="Referral source">{input("referralSource")}</Field>
        <Field label="Can you live independently without detox, around-the-clock medical care, or medication administration by staff?">{select("independentLiving", ["Yes", "No", "I would like to discuss an accommodation"])}</Field>
        <Field label="Other support, legal, medical, behavioral, or housing needs you want staff to review (optional)">{area("concerns")}</Field>
      </Section>

      <Section title="2. Recovery, supervision, and goals">
        <div className="packet-two"><Field label="Recovery status">{select("recoveryStatus", ["Early recovery", "Treatment transition", "Reentry", "Other"])}</Field>
          {form.recoveryStatus === "Other" && <Field label="Describe recovery status">{input("recoveryOther", true)}</Field>}
          <Field label="Sobriety or clean date">{input("sobrietyDate", false, "date")}</Field><Field label="Legal status">{select("legalStatus", ["None", "Probation", "Parole", "Pending court", "Other"])}</Field></div>
        {form.legalStatus === "Other" && <Field label="Describe legal status">{input("legalOther", true)}</Field>}
        <Field label="Primary substances previously used">{area("priorSubstances")}</Field><Field label="Current treatment or recovery supports">{area("treatmentSupports")}</Field>
        <Field label="Officer, court, or case contact, if applicable">{input("legalContact")}</Field>
        <Field label="Are you currently required to register as a sex offender?">{select("registryRequirement", ["Yes", "No", "Prefer to discuss with staff"])}</Field>
        <div className="packet-two"><Field label="One-year goals">{area("goalOneYear")}</Field><Field label="Five-year goals">{area("goalFiveYears")}</Field></div><Field label="Ten-year goals">{area("goalTenYears")}</Field>
        {check("sobriety", "I agree to live free of alcohol and prohibited drugs.")}
        {check("houseRules", "I agree to follow the house rules, curfew, chores, testing, and required meetings.")}
        {check("communitySafety", "I will help keep the residence free of drugs, alcohol, weapons, prohibited tobacco products, threats, and other prohibited items.")}
        {check("respect", "I will treat peers, neighbors, staff, volunteers, and guests with respect and integrity.")}
      </Section>

      <Section title="3. Program participation and license to occupy" note="The packet describes a personal, temporary, program-related license to use an assigned bed and approved common areas while enrolled and in good standing. Ashrei retains operational control and may reassign spaces for program, safety, maintenance, compatibility, or approved accommodation needs.">
        <p>Participation includes the written agreement, sobriety and testing requirements, curfew, chores, meetings, faith-centered expectations, visitor limits, and safety policies. Ashrei is not a clinical provider. Participants arrange needed medical, behavioral-health, legal, and treatment services with outside professionals.</p>
        <p>Routine violations may lead to documented coaching, written action, a final warning, or termination. Three Level 1 violations in a rolling 60 days may result in termination, but serious or safety-critical conduct may lead to faster action. Program termination and lawful recovery of possession are separate matters. Ashrei will use required notice and court procedures when applicable and will not use unlawful lockouts, utility interruption, physical self-help eviction, or disposal of belongings.</p>
        {initial("agreement", "Agreement and program terms")}{initial("termination", "Termination and possession terms")}
        {sign("agreement", "Program participation agreement")}
      </Section>

      <Section title="4. Fees and assigned sleeping space" note="The $100 administrative/application fee is nonrefundable. The program fee starts at $900 per bed per month. Staff must confirm your participant-specific rate and assigned room and bed in writing before move-in.">
        <div className="packet-two"><Field label="Payment source">{select("paymentSource", ["Self", "Family", "Sponsor", "Court/Agency", "Other"])}</Field>
          {form.paymentSource === "Other" && <Field label="Other payment source">{input("paymentOther", true)}</Field>}
          <Field label="Can payment begin at move-in?">{select("canPayAtMoveIn", ["Yes", "No", "Needs discussion"])}</Field><Field label="Payment frequency">{select("paymentFrequency", ["Weekly", "Biweekly", "Monthly", "Other"])}</Field></div>
        <div className="packet-two"><Field label="Assigned room, if staff provided it">{input("room")}</Field><Field label="Assigned bed, if staff provided it">{input("bed")}</Field></div>
        <Field label="Participant-specific monthly rate, if staff confirmed it in writing ($)">{input("monthlyRate", false, "number")}</Field>
        <p>The first monthly payment is due on the program start date before entry. After that, payment is due on the 1st of each month. If unpaid after the 3rd, a $15 per day late fee applies unless Ashrei documents an approved payment plan. If neither payment nor a written plan is received by the 9th, staff will proceed under the accountability and discharge policy.</p>
        {check("feeTerms", "I understand the fee schedule, the nonrefundable $100 administrative/application fee, and my duty to report a change in payment source or ability to pay. My exact monthly rate and sleeping space require written staff confirmation before move-in.")}
        {sign("fee", "Fee and sleeping-space acknowledgment")}
      </Section>

      <Section title="5. House rules and community safety">
        <ul><li>No alcohol, illegal drugs, prohibited substances, weapons, violence, threats, intimidation, theft, or property damage.</li>
          <li>No cigarettes or chewing tobacco on the property. Vaping is permitted only outside, away from doors and windows, in designated areas.</li>
          <li>Secure medications. Never share, trade, misuse, or leave them accessible to others.</li>
          <li>Complete chores, care for assigned space and common areas, respect quiet hours, curfew, visitors, privacy, neighbors, and staff.</li>
          <li>Attend required house meetings, weekday devotionals, Sunday church participation, and other designated activities unless an approved exception applies. Report urgent safety concerns promptly.</li></ul>
        {initial("rules", "House rules and community standards")}
      </Section>

      <Section title="6. Faith-centered participation" note="The program includes weekday devotionals, a Thursday growth meeting, Sunday transportation to SoCo Church, prayer, and spiritual-growth opportunities. Approved exceptions may cover work, treatment, court, illness, disability-related accommodation, or other approved circumstances.">
        <Field label="Do you agree to the stated faith-centered program participation policies?">{select("faithParticipation", ["Yes", "No", "I would like to discuss an exception or accommodation"])}</Field>
        <Field label="Your faith walk, spiritual background, questions, or hoped-for growth">{area("faithBackground")}</Field>{sign("faith", "Faith-centered participation response")}
      </Section>

      <Section title="7. Drug and alcohol testing" note="Mandatory tests may occur several times weekly, with additional random tests. Urine, breath, or other reasonable program-approved methods may be used. Refusal, tampering, substitution, or failure to test may be a violation. A non-negative screen may require confirmation and review; testing does not replace medical care.">
        {check("testing", "I consent to required drug and alcohol testing, including testing after an approved overnight stay. I will disclose medications that could affect a result.")}
        {sign("testing", "Drug and alcohol testing consent")}
      </Section>

      <Section title="8. Medication self-management and disclosure">
        <Field label="Do you currently take or have a prescription for any medication?">{select("medicationStatus", ["Yes", "No"])}</Field>
        {form.medicationStatus === "Yes" && <Field label="List each medication, its reason or purpose, and prescriber or notes">{area("medications", true)}</Field>}
        <p>You manage your own medications unless a separate lawful arrangement is established. Keep medications secured and do not share, sell, trade, misuse, or leave them accessible. Ashrei may request information relevant to safety, diversion risk, compatibility, or accommodation while protecting confidentiality.</p>
        {check("medication", "I understand the medication self-management and safety policy.")}{initial("medication", "Medication policy")}
      </Section>

      <Section title="9. Curfew, overnight passes, and visitors" note="Standard curfew is 10:00 PM Sunday through Thursday and 11:00 PM Friday and Saturday. Leadership may adjust the posted program-wide curfew and will communicate changes. Work, treatment, court, church, medical, emergency, program, and accommodation exceptions require approval and documentation as applicable.">
        <p>Sign in and out. Request overnight approval before leaving. Visitors are limited to approved hours and common areas. Bedrooms and sleeping areas are off-limits. No overnight guests without a written exception. Ashrei may end unsafe or disruptive visits.</p>
        {check("curfew", "I will follow the posted curfew, sign-in/sign-out, and overnight-pass procedures, or obtain a documented exception.")}
        {check("visitors", "I will follow visitor limits and inform my visitors of the applicable rules.")}{initial("curfew", "Curfew and overnight policy")}
      </Section>

      <Section title="10. Weekly program schedule" note="The posted schedule may change. Random testing may occur at any time. Staff will document approved exceptions.">
        <div className="packet-schedule"><span>Mon-Fri, 6:00 AM</span><span>Devotional. Thursday includes a shared Scripture reflection.</span><span>Mon-Fri, 8:00 AM-5:00 PM</span><span>Launch time for work, school, appointments, training, and goals.</span><span>Mon-Fri, 6:30 PM</span><span>Agape Dinner, hosted by Ashrei or volunteers.</span><span>Thursday, 7:30 PM</span><span>Honest Conversations, mandatory weekly meeting.</span><span>When applicable, 8:30 PM</span><span>Scheduled testing; random testing may occur at any time.</span><span>Sunday, 10:30 AM</span><span>SoCo Community Church, 412 Cumberland Rd, Austin, with approved exceptions.</span></div>
        <p>Program support includes personal financial training and coaching, resource connections, nearby metro pickup/drop-off locations, and accountability toward independence.</p>
        {initial("schedule", "Weekly schedule")}
      </Section>

      <Section title="11. Emergency contacts and limited release">
        <div className="packet-two"><Field label="Primary emergency contact or next of kin">{input("emergencyName", true)}</Field><Field label="Relationship">{input("emergencyRelationship", true)}</Field>
          <Field label="Phone">{input("emergencyPhone", true, "tel")}</Field><Field label="Email">{input("emergencyEmail", false, "email")}</Field>
          <Field label="Secondary contact">{input("secondaryName")}</Field><Field label="Secondary phone">{input("secondaryPhone", false, "tel")}</Field></div>
        <Field label="May Ashrei contact your emergency person in an emergency or when you appear to have abandoned the program and cannot be reached?">{select("emergencyPermission", ["Yes", "No"])}</Field>
        <Field label="Do you authorize any additional limited release of information?">{select("releaseAuthorized", ["Yes", "No"])}</Field>
        {form.releaseAuthorized === "Yes" && <><Field label="Person or organization">{input("releasePerson", true)}</Field>
          <Field label="Exactly what information may be shared or obtained">{area("releaseInformation", true)}</Field>
          <Field label="Purpose">{input("releasePurpose", true)}</Field><Field label="Expiration date or event">{input("releaseExpiration", true)}</Field>
          <fieldset className="packet-fieldset"><legend>Authorized categories, select all that apply</legend>{["Emergency/safety coordination", "Program status", "Payment coordination", "Court/probation/reentry", "Treatment/recovery resources", "Other"].map(category => <label key={category} className="packet-check"><input type="checkbox" checked={form.releaseCategories.includes(category)} onChange={event => set("releaseCategories", event.target.checked ? [...form.releaseCategories, category] : form.releaseCategories.filter(item => item !== category))} />{category}</label>)}</fieldset></>}
        <p>Additional disclosure is voluntary except as otherwise allowed or required by law. A No response does not authorize the additional release.</p>{sign("release", "Emergency contact and release choice")}
      </Section>

      <Section title="12. Accountability, discharge, and lawful possession">
        <p><strong>Level 1:</strong> routine curfew, chores, meeting, sign-in, visitor, or quiet-hour violations. Coaching, written action, final warning, and termination may follow. Three documented Level 1 violations in 60 days are a guideline, not a guaranteed number of warnings.</p>
        <p><strong>Level 2:</strong> serious substance use or possession, testing refusal or tampering, theft, major damage, serious dishonesty, prohibited items, unauthorized overnight guests, or substantial disruption. A final warning or immediate program termination may follow.</p>
        <p><strong>Level 3:</strong> violence, credible threats, weapons, drug distribution, supplying substances to another participant, arson, serious criminal conduct, or immediate danger. Staff may take lawful immediate safety steps and contact emergency services.</p>
        <p>Leadership documents facts, prior incidents, safety, corrective efforts, the decision-maker, transition, and occupancy status. An authorized Ashrei representative issues formal termination and possession notices. Program termination does not itself authorize removal from an occupied space. Staff will follow applicable notice and possession processes and may offer safe transition resources.</p>
        {check("accountability", "I reviewed the three-level accountability, discharge, transition, and lawful-possession policy.")}{initial("accountability", "Accountability and discharge policy")}
      </Section>

      <Section title="13. Property, grievance, and rights">
        <p>Remove personal property when you leave. If property remains, Ashrei will document it, attempt contact, and follow applicable requirements for access, storage, retrieval, and disposition. Staff will record departure date, items, contact attempts, and retrieval arrangements.</p>
        {check("property", "I reviewed the property retrieval and abandoned-property policy.")}{initial("property", "Property policy")}
        <p>You have the right to dignity, fairness, appropriate confidentiality, written rules and fee information, reasonable accommodation when applicable, grievance without retaliation, and notice of corrective action or discharge consistent with policy and law. You may submit an issue, requested resolution, and appeal for staff follow-up.</p>
        {check("rights", "I reviewed my rights and the grievance or appeal process.")}{initial("rights", "Rights and grievance policy")}
      </Section>

      <Section title="14. Additional house commitments retained from the prior intake">
        <p>Before entering an assigned room, wash and dry washable clothing and fabrics as directed with the program-provided pest-control laundry product, shower, and report suspected pests. The prior intake also described a $1 curse jar for cursing or unruly behavior toward another guest.</p>
        {check("hygiene", "I understand the move-in laundry and shower procedure.")}
        {check("curseJar", "I acknowledge the $1 curse jar commitment described above.")}
      </Section>

      <Section title="15. Application, document receipt, and signatures">
        <div className="packet-two"><Field label="Requested next step">{select("nextStep", ["Intake/interview", "Bed hold", "Tour", "Document review"])}</Field>
          <Field label="Preferred move-in date">{input("preferredMoveIn", false, "date")}</Field></div>
        <p>I certify that my answers are true and complete to the best of my knowledge. Material omissions or false information may affect admission or continued participation. I reviewed the agreement, fee and sleeping-space terms, house rules, faith participation, testing consent, medication disclosure, curfew and overnight policy, visitor policy, emergency release, discharge policy, property policy, and grievance and rights policy presented in this form. I can request the complete paper packet from Ashrei.</p>
        {check("documents", "I reviewed all sections in this online form and certify the information I entered is accurate.")}
        {check("electronicSignature", "I intend my typed names and initials to record my electronic agreement to the sections identified above. I can print or save this page and ask Ashrei for a paper copy.")}
        {sign("application", "Applicant certification")}{sign("receipt", "Receipt of program documents")}
        <p className="packet-note">Staff must separately record the admission decision, confirmed program start date, assigned bed, participant-specific fee, any approved accommodations, and the authorized Ashrei representative. Incomplete assignment and rate fields in this application are not a final bed or fee acknowledgment.</p>
      </Section>

      </fieldset>
      {error && <div role="alert" className="packet-error">{error}</div>}
      {!submitted && <button type="submit" disabled={submitting} className="packet-submit">{submitting ? "Submitting..." : "Sign and submit for review"}</button>}
      <p className="packet-note">For a paper copy or help with the application, call 737-344-4075 or email ashreiimpactfoundation@gmail.com.</p>
      <a className="packet-pay" href="https://www.paypal.com/ncp/payment/8P5J6RWQF8TKC" target="_blank" rel="noopener noreferrer">Pay $100 administrative/application fee with PayPal</a>
    </form>
  </div>;
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="packet-section"><h2>{title}</h2>{note && <p className="packet-note">{note}</p>}{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="packet-field"><span>{label}</span>{children}</label>;
}
