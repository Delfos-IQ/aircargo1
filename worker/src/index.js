/**
 * AcrossCargo — Notification Worker
 * Cloudflare Worker that relays email notifications via Resend.
 *
 * Routes:
 *   POST /notify   — send a notification email
 *
 * Required secrets (set via: wrangler secret put <NAME>):
 *   RESEND_API_KEY   from resend.com
 *   ADMIN_EMAIL      receives AWB stock alerts
 *   WORKER_SECRET    shared secret with the React app
 *
 * Configured vars (wrangler.toml [vars]):
 *   FROM_EMAIL       sender address / display name
 *   ALLOWED_ORIGIN   your Firebase Hosting URL for CORS
 */

/* ─── CORS ──────────────────────────────────────────────────── */
function corsHeaders(origin, allowed) {
  const headers = {
    'Access-Control-Allow-Methods':  'POST, OPTIONS',
    'Access-Control-Allow-Headers':  'Content-Type, Authorization',
    'Access-Control-Max-Age':        '86400',
  };
  // Allow configured origin or localhost for dev
  if (origin === allowed || origin?.startsWith('http://localhost')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function preflight(request, env) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, env.ALLOWED_ORIGIN) });
}

function json(body, status = 200, origin = '', allowed = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) },
  });
}

/* ─── Resend sender ─────────────────────────────────────────── */
async function sendEmail(to, subject, html, env) {
  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    env.FROM_EMAIL || 'AcrossCargo <notifications@acrosscargo.com>',
      to:      recipients,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
══════════════════════════════════════════════════════════════ */

/** Shared outer shell — provides the brand header and footer */
function emailShell(title, accentLine, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
    <tr><td align="center" style="padding:32px 16px;">

      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#FFFFFF;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:600px;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:#1B2766;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:1px;">ACROSSCARGO</div>
                  <div style="font-size:11px;font-weight:700;color:#D44A12;letter-spacing:3px;margin-top:3px;text-transform:uppercase;">Cargo Management Platform</div>
                </td>
                <td align="right" valign="middle">
                  <div style="width:42px;height:42px;background:#D44A12;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                    <span style="color:#fff;font-size:20px;font-weight:900;">✈</span>
                  </div>
                </td>
              </tr>
            </table>
            <div style="height:3px;background:linear-gradient(90deg,#D44A12,#FF7A40);border-radius:2px;margin-top:20px;"></div>
            <div style="font-size:15px;font-weight:600;color:#FFFFFF;margin-top:14px;">${accentLine}</div>
          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr><td style="padding:32px 36px;">${bodyHtml}</td></tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:18px 36px;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">
              This is an automated message from the AcrossCargo CMS. Please do not reply to this email.<br/>
              © ${new Date().getFullYear()} AcrossCargo — GSSA Cargo Management Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Status badge HTML */
function statusBadge(status) {
  const map = {
    KK: { bg:'#DCFCE7', color:'#166534', label:'KK — Confirmed'   },
    NN: { bg:'#FEF3C7', color:'#92400E', label:'NN — Requested'   },
    WL: { bg:'#FEF3C7', color:'#92400E', label:'WL — Waitlisted'  },
    XX: { bg:'#FEE2E2', color:'#991B1B', label:'XX — Cancelled'   },
    HX: { bg:'#FEE2E2', color:'#991B1B', label:'HX — House Cancel'},
  };
  const s = map[status] || { bg:'#F3F4F6', color:'#374151', label: status || '—' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color};">${s.label}</span>`;
}

/** Key–value detail row */
function row(label, value) {
  return `<tr>
    <td style="padding:8px 12px 8px 0;font-size:12px;color:#6B7280;font-weight:600;white-space:nowrap;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#111827;vertical-align:top;">${value ?? '—'}</td>
  </tr>`;
}

/** Section header inside body */
function sectionTitle(text) {
  return `<div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:1.5px;text-transform:uppercase;margin:24px 0 10px;">${text}</div>`;
}

/* ── Template 1: Booking Created ──────────────────────────── */
function bookingCreatedHtml(d) {
  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">New Booking Created</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#6B7280;">A new cargo booking has been registered in the system.</p>

    <div style="background:#F0F4FF;border-left:4px solid #1B2766;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:900;color:#1B2766;font-family:monospace;letter-spacing:1px;">${d.booking.awb || '—'}</span>
      <span style="margin-left:12px;">${statusBadge(d.booking.bookingStatus)}</span>
    </div>

    ${sectionTitle('Route & Cargo')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Route', `<strong>${d.booking.origin || '—'} → ${d.booking.destination || '—'}</strong>`)}
      ${row('Pieces', d.booking.pieces)}
      ${row('Actual Weight', d.booking.weightKg ? `${d.booking.weightKg} kg` : '—')}
      ${row('Chg. Weight', d.booking.chargeableWeightKg ? `${d.booking.chargeableWeightKg} kg` : '—')}
      ${row('Volume', d.booking.volumeM3 ? `${d.booking.volumeM3} m³` : '—')}
      ${row('Nature of Goods', d.booking.natureOfGoods)}
    </table>

    ${sectionTitle('Parties')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Shipper', d.booking.shipperName)}
      ${row('Consignee', d.booking.consigneeName)}
      ${row('Agent', d.agentName)}
    </table>

    ${sectionTitle('Charges')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Currency', d.booking.currency)}
      ${row('Rate / kg', d.booking.ratePerKg ? `${d.booking.ratePerKg}` : '—')}
      ${row('Freight', d.booking.freightCharges ? `${d.booking.currency} ${parseFloat(d.booking.freightCharges).toFixed(2)}` : '—')}
      ${row('Total Charges', `<strong style="color:#1B2766;font-size:15px;">${d.booking.currency} ${parseFloat(d.booking.totalCalculatedCharges || 0).toFixed(2)}</strong>`)}
      ${row('Payment Type', d.booking.paymentType)}
    </table>

    <div style="margin-top:28px;padding:14px 18px;background:#F9FAFB;border-radius:8px;font-size:12px;color:#6B7280;border:1px solid #E5E7EB;">
      <strong style="color:#374151;">Next steps:</strong> Log in to the AcrossCargo platform to review this booking, send the FFR message to the airline, or update the status once confirmed.
    </div>`;

  return emailShell(
    `New Booking — ${d.booking.awb}`,
    `New booking registered: ${d.booking.awb}`,
    body,
  );
}

/* ── Template 2: AWB Stock Alert ──────────────────────────── */
function awbStockAlertHtml(d) {
  const pct     = d.total > 0 ? Math.round((d.available / d.total) * 100) : 0;
  const isExhausted = d.available <= 0;
  const barColor = isExhausted ? '#EF4444' : pct < 10 ? '#EF4444' : '#F59E0B';
  const barWidth = Math.max(2, Math.min(100, pct));

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">${isExhausted ? '🔴 AWB Stock Exhausted' : '⚠️ AWB Stock Running Low'}</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#6B7280;">
      ${isExhausted
        ? `The AWB stock allocation for <strong>${d.agentName}</strong> is fully exhausted. This agent cannot create new bookings until new stock is allocated.`
        : `The AWB stock allocation for <strong>${d.agentName}</strong> is running low. Action is required to avoid booking disruptions.`}
    </p>

    <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td>
            <div style="font-size:13px;font-weight:600;color:#92400E;margin-bottom:4px;">Prefix ${d.prefix} — ${d.agentName}</div>
            <div style="font-size:28px;font-weight:900;color:${barColor};">${d.available}<span style="font-size:14px;font-weight:400;color:#92400E;"> / ${d.total} AWBs remaining</span></div>
          </td>
          <td align="right" valign="middle">
            <div style="font-size:32px;font-weight:900;color:${barColor};">${pct}%</div>
          </td>
        </tr>
      </table>
      <!-- Progress bar -->
      <div style="background:#E5E7EB;border-radius:999px;height:8px;margin-top:14px;overflow:hidden;">
        <div style="background:${barColor};height:8px;border-radius:999px;width:${barWidth}%;transition:width 300ms;"></div>
      </div>
    </div>

    ${sectionTitle('Action Required')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Agent',      d.agentName)}
      ${row('AWB Prefix', d.prefix)}
      ${row('Remaining',  `${d.available} of ${d.total}`)}
      ${row('Status',     isExhausted
          ? '<span style="color:#991B1B;font-weight:700;">EXHAUSTED — no bookings possible</span>'
          : `<span style="color:#92400E;font-weight:700;">LOW STOCK — ${pct}% remaining</span>`)}
    </table>

    <div style="margin-top:24px;padding:14px 18px;background:#FEF2F2;border-radius:8px;font-size:12px;color:#991B1B;border:1px solid #FECACA;">
      <strong>Recommended action:</strong> Go to <em>AWB Stock → Agent Allocations</em> and create a new allocation for this agent before they run out of AWB numbers.
    </div>`;

  return emailShell(
    `AWB Stock Alert — ${d.agentName}`,
    isExhausted ? '🔴 AWB stock exhausted' : '⚠️ AWB stock running low',
    body,
  );
}

/* ── Template 3: Booking Status Changed ──────────────────── */
function bookingStatusChangedHtml(d) {
  const statusLabels = { KK:'Confirmed', NN:'Requested', WL:'Waitlisted', XX:'Cancelled', HX:'House Cancelled' };
  const oldLabel = statusLabels[d.oldStatus] || d.oldStatus;
  const newLabel = statusLabels[d.booking.bookingStatus] || d.booking.bookingStatus;

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">Booking Status Updated</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#6B7280;">The status of booking <strong>${d.booking.awb}</strong> has been updated.</p>

    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:18px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td align="center" style="padding:0 16px;">
            <div style="font-size:11px;color:#6B7280;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Previous</div>
            ${statusBadge(d.oldStatus)}
            <div style="font-size:12px;color:#6B7280;margin-top:4px;">${oldLabel}</div>
          </td>
          <td align="center" style="font-size:22px;color:#D44A12;font-weight:700;">→</td>
          <td align="center" style="padding:0 16px;">
            <div style="font-size:11px;color:#6B7280;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">New Status</div>
            ${statusBadge(d.booking.bookingStatus)}
            <div style="font-size:12px;color:#111827;margin-top:4px;font-weight:600;">${newLabel}</div>
          </td>
        </tr>
      </table>
    </div>

    ${sectionTitle('Booking Details')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('AWB Number', `<span style="font-family:monospace;font-size:14px;font-weight:700;">${d.booking.awb}</span>`)}
      ${row('Route', `${d.booking.origin || '—'} → ${d.booking.destination || '—'}`)}
      ${row('Shipper', d.booking.shipperName)}
      ${row('Consignee', d.booking.consigneeName)}
      ${row('Weight', d.booking.chargeableWeightKg ? `${d.booking.chargeableWeightKg} kg chargeable` : '—')}
      ${row('Total Charges', `${d.booking.currency} ${parseFloat(d.booking.totalCalculatedCharges || 0).toFixed(2)}`)}
    </table>

    ${d.booking.bookingStatus === 'KK' ? `
    <div style="margin-top:24px;padding:14px 18px;background:#F0FDF4;border-radius:8px;font-size:12px;color:#166534;border:1px solid #BBF7D0;">
      <strong>✓ Booking confirmed.</strong> You can now send the FFR message to the airline and prepare the shipment documentation.
    </div>` : ''}

    ${['XX','HX'].includes(d.booking.bookingStatus) ? `
    <div style="margin-top:24px;padding:14px 18px;background:#FEF2F2;border-radius:8px;font-size:12px;color:#991B1B;border:1px solid #FECACA;">
      <strong>Booking cancelled.</strong> The AWB number is now released from this shipment. Please contact the airline if an FFR was already sent.
    </div>` : ''}`;

  return emailShell(
    `Status Update — ${d.booking.awb}`,
    `Booking ${d.booking.awb}: ${oldLabel} → ${newLabel}`,
    body,
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION HANDLERS
══════════════════════════════════════════════════════════════ */

async function handleBookingCreated(data, env) {
  if (!data.agentEmail) throw new Error('agentEmail is required');
  const html    = bookingCreatedHtml(data);
  const subject = `New Booking — AWB ${data.booking?.awb || ''}`;
  await sendEmail(data.agentEmail, subject, html, env);
}

async function handleAwbStockAlert(data, env) {
  const recipients = [env.ADMIN_EMAIL].filter(Boolean);
  if (data.agentEmail) recipients.push(data.agentEmail);
  if (!recipients.length) throw new Error('No recipient configured for AWB stock alert (set ADMIN_EMAIL secret)');
  const html    = awbStockAlertHtml(data);
  const subject = data.available <= 0
    ? `🔴 AWB Stock Exhausted — ${data.agentName} (${data.prefix})`
    : `⚠️ Low AWB Stock — ${data.agentName} (${data.prefix}) — ${data.available} remaining`;
  await sendEmail(recipients, subject, html, env);
}

async function handleBookingStatusChanged(data, env) {
  if (!data.agentEmail) throw new Error('agentEmail is required');
  const html    = bookingStatusChangedHtml(data);
  const subject = `Booking Update — AWB ${data.booking?.awb || ''}: ${data.oldStatus} → ${data.booking?.bookingStatus}`;
  await sendEmail(data.agentEmail, subject, html, env);
}

/* ══════════════════════════════════════════════════════════════
   MAIN FETCH HANDLER
══════════════════════════════════════════════════════════════ */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') return preflight(request, env);

    // Only POST /notify
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/notify') {
      return json({ error: 'Not found' }, 404, origin, env.ALLOWED_ORIGIN);
    }

    // Auth
    const auth = request.headers.get('Authorization');
    if (!env.WORKER_SECRET || auth !== `Bearer ${env.WORKER_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401, origin, env.ALLOWED_ORIGIN);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin, env.ALLOWED_ORIGIN);
    }

    const { type, data } = body;
    try {
      switch (type) {
        case 'booking_created':        await handleBookingCreated(data, env);       break;
        case 'awb_stock_alert':        await handleAwbStockAlert(data, env);        break;
        case 'booking_status_changed': await handleBookingStatusChanged(data, env); break;
        default: return json({ error: `Unknown notification type: ${type}` }, 400, origin, env.ALLOWED_ORIGIN);
      }
      return json({ ok: true, type }, 200, origin, env.ALLOWED_ORIGIN);
    } catch (err) {
      console.error(`[${type}] Error:`, err.message);
      return json({ error: err.message }, 500, origin, env.ALLOWED_ORIGIN);
    }
  },
};
