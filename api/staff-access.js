import { readState } from "./_sheets.js";
import { authorizeStaff } from "./_staff-access.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const data = await readState();
    await authorizeStaff(req, data || {}, String(req.body?.accessCode || "").trim());
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Staff access is temporarily unavailable." });
  }
}
