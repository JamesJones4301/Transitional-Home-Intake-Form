// Deploy this file in the existing Ashrei Immediate Intake Alerts web app.
// Preserve the existing INTAKE_ALERT_WEBHOOK_TOKEN Script Property.
function doPost(e) {
  function json(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  }
  var payload;
  try { payload = JSON.parse(e.postData.contents); } catch (error) { return json({ ok: false, error: 'Invalid request' }); }
  var secret = PropertiesService.getScriptProperties().getProperty('INTAKE_ALERT_WEBHOOK_TOKEN');
  if (!secret || payload.token !== secret) return json({ ok: false, error: 'Unauthorized' });

  function value(input, max) { return String(input || '').trim().slice(0, max); }
  var failure = payload.type === 'intake-failure';
  var name = value(payload.name, 120);
  var identifier = value(failure ? payload.attemptId : payload.intakeId, 80);
  if (!name || !identifier) return json({ ok: false, error: 'Missing details' });
  var cache = CacheService.getScriptCache();
  var cacheKey = (failure ? 'failure-' : 'submitted-') + identifier.replace(/[^a-zA-Z0-9-]/g, '');
  if (cache.get(cacheKey)) return json({ ok: true, duplicate: true });

  if (failure) {
    var email = value(payload.email, 180);
    var phone = value(payload.phone, 40);
    if (!email && !phone) return json({ ok: false, error: 'Missing contact information' });
    MailApp.sendEmail({
      to: 'ashreiimpactfoundation@gmail.com',
      subject: 'Intake submission problem: ' + name,
      body: 'An applicant tried to submit an intake, but the portal could not confirm completion. Check the owner portal before asking them to submit again.\n\n' +
        'Name: ' + name + '\nEmail: ' + (email || 'Not provided') + '\nPhone: ' + (phone || 'Not provided') + '\n' +
        'Reason: ' + value(payload.reason, 160) + '\nAttempt ID: ' + identifier + '\n' +
        'Reported: ' + new Date(Number(payload.occurredAt) || Date.now()).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' Central time.\n\n' +
        'This alert does not mean an application was saved. No intake answers are included.'
    });
  } else {
    MailApp.sendEmail({
      to: 'ashreiimpactfoundation@gmail.com',
      subject: 'New participant intake submitted: ' + name,
      body: 'A new participant intake was submitted for ' + name + '.\n' +
        'Submitted: ' + new Date(Number(payload.submittedAt) || Date.now()).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' Central time.\n' +
        'Sign in to the Ashrei owner portal to review the complete application. This alert does not contain the full intake packet.'
    });
  }
  cache.put(cacheKey, 'sent', 21600);
  return json({ ok: true });
}
