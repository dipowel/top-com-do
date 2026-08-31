/**
 * Correo transaccional vía Resend (sin SDK, solo fetch).
 * Si falta RESEND_API_KEY, no-op: el growth loop sigue funcionando con la
 * notificación in-app y el botón "Recuperar #1".
 */
import { SITE_URL } from '../../shared/site';
import { formatDOP } from '../../shared/fx';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || 'Top.com.do <no-reply@top.com.do>';
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log('[email] omitido (falta RESEND_API_KEY):', opts.subject, '→', opts.to);
    return;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend', res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.error('[email] error de red:', (e as Error).message);
  }
}

/** Plantilla del correo "Te superaron" con CTA para recuperar el #1. */
export function dethroneEmailHtml(d: {
  businessName: string;
  scopeLabel: string;
  newLeaderName: string;
  newLeaderTotalDop: number;
  minBidDop: number;
  profileId: string;
}): string {
  const cta = `${SITE_URL}/p/${d.profileId}?pujar=1`;
  return `<!doctype html><html><body style="margin:0;background:#070b14;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#0b1220;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
    <tr><td style="padding:24px 24px 8px">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#D4AF37;font-weight:700">Top.com.do</div>
      <h1 style="margin:12px 0 4px;font-size:22px;color:#e8ecf4">⚠️ Te superaron en ${escapeHtml(d.scopeLabel)}</h1>
      <p style="margin:0;color:#9aa4b2;font-size:14px;line-height:1.6">
        <strong style="color:#e8ecf4">${escapeHtml(d.businessName)}</strong> bajó al <strong>#2</strong>.
        El nuevo #1 es <strong style="color:#e8ecf4">${escapeHtml(d.newLeaderName)}</strong> con
        <strong style="color:#D4AF37">${formatDOP(d.newLeaderTotalDop)}</strong>.
      </p>
    </td></tr>
    <tr><td style="padding:16px 24px">
      <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:12px;padding:14px 16px">
        <div style="font-size:12px;color:#9aa4b2">Para recuperar el #1 necesitas ofertar al menos</div>
        <div style="font-size:24px;font-weight:800;color:#D4AF37;margin-top:2px">${formatDOP(d.minBidDop)}</div>
      </div>
    </td></tr>
    <tr><td style="padding:8px 24px 28px" align="center">
      <a href="${cta}" style="display:inline-block;background:linear-gradient(135deg,#e8c874,#d4af37);color:#000;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px">🔥 Recuperar mi #1</a>
      <p style="margin:16px 0 0;color:#5b6472;font-size:11px">El que no defiende su puesto, baja. Cada puja cuenta 7 días.</p>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
