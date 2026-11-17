// Envoi des e-mails (Gmail) et modèle HTML commun.
const nodemailer = require('nodemailer');
const { IS_TEST, EMAIL_USER, EMAIL_PASS } = require('./config');

const transporter = (EMAIL_USER && EMAIL_PASS) ? nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
}) : null;

const testOutbox = [];
async function sendEmail(to, subject, text, html, fromName = 'JobFacile') {
    if (IS_TEST) { testOutbox.push({ to, subject, text, html }); return true; }
    if (!transporter) {
        console.log(`📧 [email non configuré] ${to} | ${subject} → ${text.slice(0, 300)}`);
        return false;
    }
    try {
        await transporter.sendMail({ from: `"${fromName}" <${EMAIL_USER}>`, to, subject, text, html });
        return true;
    } catch (e) {
        console.error('Erreur envoi e-mail :', e.message);
        console.log(`📧 [secours] ${to} → ${text.slice(0, 300)}`);
        return false;
    }
}
function sendCodeEmail(to, subject, text) { return sendEmail(to, subject, text, undefined, 'JobFacile Sécurité'); }

// Modèle commun des e-mails de confirmation (même style que les alertes)
function simpleEmailHtml({ title, intro, rows = [], note = '', ctaUrl, ctaLabel, footer = '' }) {
    const e = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rowsHtml = rows.map(([k, v]) => `
        <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:38%;vertical-align:top">${e(k)}</td>
            <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:700">${e(v)}</td></tr>`).join('');
    return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#059669,#14b8a6);background-color:#059669;padding:24px">
            <div style="font-size:22px;font-weight:800;color:#ffffff">JobFacile</div>
            <div style="font-size:15px;color:#d1fae5;margin-top:6px;font-weight:700">${e(title)}</div>
        </td></tr>
        <tr><td style="padding:24px">
            <p style="font-size:15px;color:#334155;line-height:1.5;margin:0 0 16px">${intro}</p>
            ${rowsHtml ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:16px">${rowsHtml}</table>` : ''}
            ${note ? `<p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 16px">${note}</p>` : ''}
            ${ctaUrl ? `<p style="text-align:center;margin:24px 0 8px"><a href="${ctaUrl}" style="background:#059669;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;display:inline-block">${e(ctaLabel)}</a></p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">${footer || 'Cet e-mail vous a été envoyé automatiquement par JobFacile.'}</td></tr>
    </table></td></tr></table></body></html>`;
}

module.exports = { testOutbox, sendCodeEmail, transporter, sendEmail, simpleEmailHtml };
