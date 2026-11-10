const clean = (value, limit) => String(value ?? "").trim().slice(0, limit);

export function failureDetails(body, reason) {
  const applicant = body?.applicant || {};
  const name = clean(applicant.name, 120);
  const email = clean(applicant.email, 180);
  const phone = clean(applicant.phone, 40);
  const attemptId = clean(body?.attemptId, 80);
  if (!name || (!email && !phone) || !/^[a-zA-Z0-9-]{12,80}$/.test(attemptId)) return null;
  return { type: "intake-failure", attemptId, name, email, phone, reason, occurredAt: Date.now() };
}

export async function sendFailureAlert(details) {
  const url = process.env.INTAKE_ALERT_WEBHOOK_URL;
  const token = process.env.INTAKE_ALERT_WEBHOOK_TOKEN;
  if (!details || !url || !token) return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...details, token }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    return response.ok && result.ok === true;
  } catch (error) {
    console.error("Intake failure alert delivery failed:", error);
    return false;
  }
}
