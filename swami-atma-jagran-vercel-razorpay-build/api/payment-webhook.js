import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Swami Atma Jagran <orders@swamiatmajagran.in>';

    if (!webhookSecret) {
      return res.status(500).json({ error: 'RAZORPAY_WEBHOOK_SECRET is missing.' });
    }
    if (!resendApiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY is missing.' });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!safeEqualHex(expected, signature)) {
      return res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
    }

    const event = JSON.parse(rawBody || '{}');
    if (event.event !== 'order.paid') {
      return res.status(200).json({ ok: true, ignored: true, event: event.event || '' });
    }

    const order = event?.payload?.order?.entity;
    const payment = event?.payload?.payment?.entity;
    const notes = order?.notes || {};
    const email = String(notes.customer_email || payment?.email || '').trim().toLowerCase();
    const name = String(notes.customer_name || payment?.notes?.customer_name || 'Customer').trim();
    const product = String(notes.product || order?.description || 'Your selected service').trim();
    const orderId = String(order?.id || payment?.order_id || '').trim();
    const paymentId = String(payment?.id || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Customer email is missing or invalid in Razorpay order notes.' });
    }

    const firstName = name.split(/\s+/)[0] || 'Customer';
    const subject = '🙏 Your Order Has Been Successfully Received — Swami Atma Jagran';
    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f1e5;font-family:Arial,Helvetica,sans-serif;color:#2b070a;">
  <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
    <div style="background:#2b070a;border:1px solid #d4af37;border-radius:20px;padding:28px 24px;color:#fcf8f2;">
      <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#f3e5ab;">Swami Atma Jagran · The Digital Monk</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#f3e5ab;margin:18px 0 20px;">Your Order Has Been Successfully Received</h1>
      <p style="font-size:16px;line-height:1.7;margin:0 0 12px;">Namaste ${escapeHtml(firstName)} 🙏</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px;">Your payment and details for <strong style="color:#f3e5ab;">${escapeHtml(product)}</strong> have been successfully received. ✅</p>
      <div style="background:#fcf8f2;color:#2b070a;border-radius:14px;padding:16px 18px;margin:18px 0;line-height:1.8;font-size:14px;">
        <div>💳 <strong>Payment:</strong> Received</div>
        <div>📜 <strong>Service:</strong> ${escapeHtml(product)}</div>
        <div>📋 <strong>Details:</strong> Successfully Received</div>
      </div>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px;">Your order has now been received by our team and processing has started.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px;">✨ Your personalised ${escapeHtml(product)} report will be prepared and delivered within 24 hours.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px;">Thank you for your trust and for choosing Swami Atma Jagran.</p>
      <p style="font-size:15px;line-height:1.7;margin:0;">🙏 With gratitude,<br><strong style="color:#f3e5ab;">Swami Atma Jagran</strong><br><em>The Digital Monk</em></p>
    </div>
    <p style="text-align:center;color:#6f5a52;font-size:11px;line-height:1.6;margin:14px 10px 0;">Order ${escapeHtml(orderId)}${paymentId ? ` · Payment ${escapeHtml(paymentId)}` : ''}</p>
  </div>
</body></html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        ...(orderId ? { 'Idempotency-Key': `swami-atma-jagran-${orderId}` } : {}),
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({
        error: data?.message || data?.error || 'Resend email delivery failed.',
      });
    }

    return res.status(200).json({
      ok: true,
      event: event.event,
      emailId: data?.id || '',
      orderId,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Webhook server error.' });
  }
}
