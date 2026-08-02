function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createEmailService({
  apiKey,
  from,
  replyTo,
  apiUrl = 'https://api.resend.com/emails',
  fetchImpl = fetch
}) {
  const configured = Boolean(apiKey && from && replyTo);

  async function sendAccountVerification({
    to,
    displayName,
    inviteUrl,
    invitationId,
    expiresAt
  }) {
    if (!configured) throw new Error('Transactional email is not configured');
    const safeName = escapeHtml(displayName || 'Instructor');
    const safeUrl = escapeHtml(inviteUrl);
    const expiryCopy = expiresAt
      ? `This one-time link expires ${new Date(expiresAt).toUTCString()}.`
      : 'This one-time link expires soon.';
    const safeExpiryCopy = escapeHtml(expiryCopy);
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `markdown-mash-verification-${invitationId}`
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [to],
        subject: 'Verify your Markdown Mash instructor account',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#15172b">
          <h1 style="font-size:28px">Welcome to Markdown Mash</h1>
          <p>Hi ${safeName},</p>
          <p>Verify your email and create your instructor password to continue to the $15/year hosted plan.</p>
          <p style="margin:28px 0"><a href="${safeUrl}" style="background:#6d4aff;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Verify my email</a></p>
          <p>${safeExpiryCopy} If you did not request it, you can ignore this email.</p>
          <p>Markdown Mash by Ensemble Methods</p>
        </div>`,
        text: `Hi ${displayName || 'Instructor'},\n\nVerify your email and create your Markdown Mash instructor password:\n${inviteUrl}\n\n${expiryCopy} If you did not request it, ignore this email.\n\nMarkdown Mash by Ensemble Methods`
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) {
      const error = new Error('Unable to send verification email');
      error.status = response.status;
      throw error;
    }
    return { id: payload.id };
  }

  return { configured, sendAccountVerification };
}

module.exports = { createEmailService, escapeHtml };
