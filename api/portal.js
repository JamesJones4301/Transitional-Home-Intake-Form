import { assertOwner, readState, writeState } from "./_sheets.js";

export default async function handler(req, res) {
  try {
    await assertOwner(req);
    if (req.method === "GET") return res.status(200).json({ data: await readState() });
    if (req.method === "PUT") {
      if (!req.body?.data || typeof req.body.data !== "object") return res.status(400).json({ error: "A portal data payload is required." });
      return res.status(200).json({ data: await writeState(req.body.data) });
    }
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "The secure data service could not complete that request." });
  }
}

