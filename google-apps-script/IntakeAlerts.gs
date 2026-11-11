// Source for the existing Ashrei Immediate Intake Alerts web app.
// Keep the INTAKE_ALERT_WEBHOOK_TOKEN Script Property configured in Apps Script.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty('INTAKE_ALERT_WEBHOOK_TOKEN');
    if (!expected || !data.token || data.token !== expected) return json_({ ok: false });
    if (data.type === 'intake-failure') return sendFailureAlert_(data);
    if (data.type === 'approved-copy') return sendApprovedCopy_(data);

    var intakeId = String(data.intakeId || '').trim();
    var name = String(data.name || '').replace(/[\r\n]/g, ' ').trim();
    var timestamp = Number(data.submittedAt);
    if (!intakeId || !name || !Number.isFinite(timestamp)) return json_({ ok: false });
    var cache = CacheService.getScriptCache();
    var key = 'intake_' + intakeId;
    if (cache.get(key)) return json_({ ok: true, duplicate: true });
    var when = Utilities.formatDate(new Date(timestamp), 'America/Chicago', 'MMM d, yyyy h:mm a');
    MailApp.sendEmail({
      to: 'ashreiimpactfoundation@gmail.com',
      subject: 'New participant intake submitted: ' + name,
      body: 'A new participant intake was submitted for ' + name + '.\nSubmitted: ' + when + ' Central time.\n\nSign in to the Ashrei owner portal to review the complete application. This alert contains no private application answers.'
    });
    cache.put(key, 'sent', 21600);
    return json_({ ok: true });
  } catch (error) {
    console.error('Intake alert failed: ' + error);
    return json_({ ok: false });
  }
}

function sendApprovedCopy_(data) {
  var recordId = String(data.recordId || '').trim();
  var name = String(data.name || '').replace(/[\r\n]/g, ' ').trim().slice(0, 120);
  var html = String(data.html || '');
  if (!/^[a-zA-Z0-9_-]{4,100}$/.test(recordId) || !name || !html.startsWith('<!doctype html>') || html.length > 500000) return json_({ ok: false });
  MailApp.sendEmail({
    to: 'ashreiimpactfoundation@gmail.com',
    subject: 'Approved participant intake copy: ' + name,
    body: 'Approved participant intake copy for ' + name + '. Open this message in an HTML-capable email client to review every saved question and answer.',
    htmlBody: html
  });
  return json_({ ok: true });
}

function sendFailureAlert_(data) {
  var attemptId = String(data.attemptId || '').trim();
  var name = String(data.name || '').replace(/[\r\n]/g, ' ').trim().slice(0, 120);
  var email = String(data.email || '').replace(/[\r\n]/g, ' ').trim().slice(0, 180);
  var phone = String(data.phone || '').replace(/[\r\n]/g, ' ').trim().slice(0, 40);
  var reason = String(data.reason || '').replace(/[\r\n]/g, ' ').trim().slice(0, 160);
  var timestamp = Number(data.occurredAt);
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(attemptId) || !name || (!email && !phone) || !Number.isFinite(timestamp)) return json_({ ok: false });
  var cache = CacheService.getScriptCache();
  var key = 'intake_failure_' + attemptId;
  if (cache.get(key)) return json_({ ok: true, duplicate: true });
  var when = Utilities.formatDate(new Date(timestamp), 'America/Chicago', 'MMM d, yyyy h:mm a');
  MailApp.sendEmail({
    to: 'ashreiimpactfoundation@gmail.com',
    subject: 'Intake submission problem: ' + name,
    body: 'An applicant tried to submit an intake, but the portal could not confirm completion. Check the owner portal before asking them to submit again.\n\n' +
      'Name: ' + name + '\nEmail: ' + (email || 'Not provided') + '\nPhone: ' + (phone || 'Not provided') + '\n' +
      'Reason: ' + reason + '\nAttempt ID: ' + attemptId + '\nReported: ' + when + ' Central time.\n\n' +
      'This alert does not mean an application was saved. No intake answers are included.'
  });
  cache.put(key, 'sent', 21600);
  return json_({ ok: true });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
