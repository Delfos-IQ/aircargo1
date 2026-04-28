/**
 * notifications.js
 * Client-side service that calls the Cloudflare Worker notification relay.
 *
 * All functions are fire-and-forget — they never throw or block the caller.
 * If the Worker URL is not configured, calls are silently skipped.
 *
 * Environment variables required in .env:
 *   VITE_WORKER_URL     = https://acrosscargo-notifications.<your-subdomain>.workers.dev
 *   VITE_WORKER_SECRET  = (same value as WORKER_SECRET wrangler secret)
 */

const WORKER_URL    = import.meta.env.VITE_WORKER_URL;
const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET;

/**
 * Internal dispatcher — non-blocking, never throws.
 */
async function dispatch(type, data) {
  if (!WORKER_URL || !WORKER_SECRET) {
    if (import.meta.env.DEV) {
      console.info(`[notifications] Worker not configured — skipping "${type}"`);
    }
    return;
  }

  try {
    const res = await fetch(`${WORKER_URL}/notify`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({ type, data }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[notifications] "${type}" failed (${res.status}):`, text);
    }
  } catch (err) {
    // Network errors must never surface to the user
    console.warn(`[notifications] "${type}" network error:`, err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────────── */

/**
 * Sends a booking confirmation email to the agent.
 * Call after a booking is successfully created.
 *
 * @param {object} booking        — the full booking data object saved to Firestore
 * @param {object} agentProfile   — agentProfiles entry for the booking's agent
 */
export function notifyBookingCreated(booking, agentProfile) {
  if (!agentProfile?.agentEmail) return;
  dispatch('booking_created', {
    booking,
    agentEmail: agentProfile.agentEmail,
    agentName:  agentProfile.agentName || '—',
  });
}

/**
 * Sends an AWB low-stock alert to the admin (and optionally the agent).
 * Call after a booking is created when the agent's remaining stock drops below 25%.
 *
 * @param {object} allocation     — awbStockAllocations entry that was just used
 * @param {object} agentProfile   — agentProfiles entry for the agent
 * @param {number} available      — remaining AWB count after this booking
 * @param {number} total          — total AWBs in this allocation
 */
export function notifyAwbStockAlert(allocation, agentProfile, available, total) {
  dispatch('awb_stock_alert', {
    prefix:     allocation?.prefix || '—',
    agentName:  agentProfile?.agentName  || '—',
    agentEmail: agentProfile?.agentEmail || null,
    available,
    total,
  });
}

/**
 * Sends a status-change notification to the agent.
 * Call after a booking is updated with a different bookingStatus.
 *
 * @param {object} booking        — the updated booking data
 * @param {string} oldStatus      — the previous bookingStatus value
 * @param {object} agentProfile   — agentProfiles entry for the booking's agent
 */
export function notifyBookingStatusChanged(booking, oldStatus, agentProfile) {
  if (!agentProfile?.agentEmail) return;
  if (oldStatus === booking.bookingStatus) return;    // no change — skip
  dispatch('booking_status_changed', {
    booking,
    oldStatus,
    agentEmail: agentProfile.agentEmail,
    agentName:  agentProfile.agentName || '—',
  });
}
