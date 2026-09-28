import { timingSafeEqual } from "node:crypto";
import { assertOwner } from "./_sheets.js";

function matchesCode(received, configured) {
  if (!received || !configured) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(configured));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorizeStaff(req, data, accessCode) {
  if (req.headers.authorization) {
    await assertOwner(req);
    return;
  }
  const configured = data.settings?.houseManagerAccessCode || process.env.HOUSE_MANAGER_ACCESS_CODE;
  if (!matchesCode(accessCode, configured)) {
    throw Object.assign(new Error("The staff access code is not valid. Contact the Owner."), { status: 403 });
  }
}
