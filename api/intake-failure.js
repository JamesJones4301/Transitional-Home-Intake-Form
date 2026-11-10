import { failureDetails, sendFailureAlert } from "./_intake-failure-alert.js";

// Best-effort fallback when the primary submission returns an error or cannot be confirmed.
const recent = new Map();
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: "Origin not allowed." });
  const details = failureDetails(req.body, "Submission response could not be confirmed");
  if (!details) return res.status(400).json({ error: "Contact details are required." });
  const now = Date.now();
  for (const [key, timestamp] of recent) if (now - timestamp > 3600000) recent.delete(key);
  const source = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0];
  const count = [...recent.keys()].filter(key => key.startsWith(`${source}:`)).length;
  if (count >= 5) return res.status(429).json({ error: "Too many reports." });
  recent.set(`${source}:${details.attemptId}`, now);
  const sent = await sendFailureAlert(details);
  return res.status(sent ? 200 : 503).json({ ok: sent });
}
