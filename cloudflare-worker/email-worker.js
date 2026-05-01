/**
 * Cloudflare Worker — AcrossCargo Email Sender
 *
 * Deployed at: https://acrosscargo.pedicode-app.workers.dev
 *
 * Sends transactional emails via Resend API with optional PDF attachment.
 * Required secret: RESEND_API_KEY  (Settings → Variables and Secrets → Secret)
 *
 * Expected POST body (JSON):
 * {
 *   to:          string,           // recipient email (required)
 *   cc?:         string,           // CC email (optional)
 *   subject:     string,           // email subject (required)
 *   body?:       string,           // plain-text body
 *   pdfBase64?:  string,           // PDF as base64 string (no data URI prefix)
 *   pdfFilename?: string,          // attachment filename, e.g. "BookingConfirmation_180.pdf"
 * }
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { to, cc, subject, body, pdfBase64, pdfFilename } = await request.json();

      if (!to || !subject) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: to, subject' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const emailPayload = {
        from: 'AcrossCargo <noreply@acrosscargo.com>',
        to: [to],
        cc: cc ? [cc] : undefined,
        subject,
        text: body || '',
        attachments: pdfBase64
          ? [{ filename: pdfFilename || 'BookingConfirmation.pdf', content: pdfBase64 }]
          : undefined,
      };

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const result = await resendResponse.json();

      if (!resendResponse.ok) {
        return new Response(
          JSON.stringify({ error: result }),
          { status: resendResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, id: result.id }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },
};
