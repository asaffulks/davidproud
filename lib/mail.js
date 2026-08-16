// Notification email, sent through Resend (free tier: 3,000 emails a month).
//
// Email is optional. If RESEND_API_KEY / MODERATOR_EMAIL are not configured,
// sending is skipped silently — submissions still queue up, and David can
// still sign in to /moderate with his passphrase.

import { escapeHtml } from './util.js';

export function mailConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.MODERATOR_EMAIL);
}

export async function sendMail(env, { subject, text, html }) {
  if (!mailConfigured(env)) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'davidproud.uk <notifications@davidproud.uk>',
        to: [env.MODERATOR_EMAIL],
        subject,
        text,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const shell = (title, bodyHtml) => `
<div style="font-family:Georgia,'Times New Roman',serif;color:#211d16;background:#f6f1e5;padding:28px">
  <div style="max-width:34rem;margin:0 auto;background:#fffdf8;border:1px solid #ddd2bc;padding:26px 28px">
    <p style="margin:0 0 18px;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#8a6d3b">davidproud.uk</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:normal">${escapeHtml(title)}</h1>
    ${bodyHtml}
  </div>
</div>`;

export function submissionEmail({ kind, name, pageTitle, body, flags, moderateUrl }) {
  const what = kind === 'testimonial' ? 'testimonial' : 'response';
  const where = pageTitle ? ` on “${pageTitle}”` : '';
  const subject = `New ${what} from ${name} awaiting your approval`;

  const text = [
    `${name} has sent a ${what}${where}.`,
    '',
    body,
    '',
    flags?.length ? `Automatic notes: ${flags.join(', ')}` : '',
    '',
    'It is not on the site yet. Review it here:',
    moderateUrl,
  ].filter(Boolean).join('\n');

  const html = shell(subject, `
    <p style="margin:0 0 6px;font-size:13px;color:#5f574a">${escapeHtml(name)}${escapeHtml(where)}</p>
    <blockquote style="margin:14px 0;padding-left:14px;border-left:2px solid #c9a75a;font-style:italic;color:#5f574a;white-space:pre-wrap">${escapeHtml(body)}</blockquote>
    ${flags?.length ? `<p style="margin:0 0 14px;font-size:13px;color:#8a6d3b">Automatic notes: ${escapeHtml(flags.join(', '))}</p>` : ''}
    <p style="margin:18px 0 0">It is <strong>not</strong> on the site yet.</p>
    <p style="margin:14px 0 0">
      <a href="${moderateUrl}" style="display:inline-block;padding:11px 20px;border:1px solid #8a6d3b;color:#8a6d3b;text-decoration:none;font-size:13px;letter-spacing:.18em;text-transform:uppercase">Review it</a>
    </p>`);

  return { subject, text, html };
}

export function signInEmail({ url }) {
  const subject = 'Your sign-in link for davidproud.uk';
  const text = [
    'Here is your sign-in link for the responses page on davidproud.uk.',
    '',
    url,
    '',
    'It works once you click it and stops working after an hour.',
    'If you did not ask for it, you can ignore this email.',
  ].join('\n');

  const html = shell(subject, `
    <p style="margin:0 0 18px;color:#5f574a">Here is your sign-in link for the responses page.</p>
    <p style="margin:0 0 18px">
      <a href="${url}" style="display:inline-block;padding:11px 20px;border:1px solid #8a6d3b;color:#8a6d3b;text-decoration:none;font-size:13px;letter-spacing:.18em;text-transform:uppercase">Sign in</a>
    </p>
    <p style="margin:0;font-size:13px;color:#5f574a">The link stops working after an hour. If you did not ask for it, you can ignore this email.</p>`);

  return { subject, text, html };
}
