import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[c]));
}

function formatEmail({ name, product, amount, whatsapp, email, orderId, paymentId, slotId, bookingDate, bookingSlot, sessionDuration, sessionType }) {
  const bookingRow = (slotId || bookingDate || bookingSlot) ? `
        <tr><td style="padding:8px 0;color:#777">Booking Date</td><td style="padding:8px 0;font-weight:700">${esc(bookingDate || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Time Slot</td><td style="padding:8px 0;font-weight:700">${esc(bookingSlot || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Duration / Mode</td><td style="padding:8px 0;font-weight:700">${esc(sessionDuration || '—')} ${sessionType ? '· ' + esc(sessionType) : ''}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Slot ID</td><td style="padding:8px 0;font-family:monospace;font-weight:700">${esc(slotId || '—')}</td></tr>` : '';
  return `
  <div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:28px">
      <div style="text-align:center;margin-bottom:22px">
        <div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div>
        <div style="font-size:12px;color:#7a5b20;margin-top:4px">The Digital Monk</div>
      </div>
      <h1 style="font-size:25px;margin:0 0 16px">🙏 New Paid Order Received</h1>
      <p style="font-size:16px;line-height:1.6">A new customer payment has been successfully captured and verified.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#777">Customer</td><td style="padding:8px 0;font-weight:700">${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Service</td><td style="padding:8px 0;font-weight:700">${esc(product)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Amount</td><td style="padding:8px 0;font-weight:700">₹${esc(amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">WhatsApp</td><td style="padding:8px 0">${esc(whatsapp)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Email</td><td style="padding:8px 0">${esc(email)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Order ID</td><td style="padding:8px 0;font-family:monospace">${esc(orderId)}</td></tr>
        <tr><td style="padding:8px 0;color:#777">Payment ID</td><td style="padding:8px 0;font-family:monospace">${esc(paymentId)}</td></tr>${bookingRow}
      </table>
      <div style="margin-top:22px;padding:16px;border-radius:14px;background:#f8f0d8;border:1px solid #e7d7a6">
        <b>24-hour delivery countdown has started.</b><br>
        The customer's personalised report is due within 24 hours of successful payment.
      </div>
    </div>
  </div>`;
}

function customerEmail({ name, product, slotId, bookingDate, bookingSlot, sessionDuration, sessionType }) {
  const bookingBlock = (slotId || bookingDate || bookingSlot) ? `
      <div style="margin:20px 0;padding:18px;border-radius:15px;background:#fff8e6;border:1px solid #e7d7a6;line-height:1.9">
        📅 <b>Booked Date:</b> ${esc(bookingDate || '—')}<br>
        ⏰ <b>Time Slot:</b> ${esc(bookingSlot || '—')}<br>
        ${(sessionDuration || sessionType) ? `🎙 <b>Duration / Mode:</b> ${esc(sessionDuration || '—')} ${sessionType ? '· ' + esc(sessionType) : ''}<br>` : ''}
        🆔 <b>Your Slot ID:</b> <span style="font-family:monospace;font-weight:700">${esc(slotId || '—')}</span><br>
        <span style="font-size:13px">Please save this Slot ID — our team will confirm the exact time on WhatsApp within 1-3 hours and may ask for this ID.</span>
      </div>` : '';
  return `
  <div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:30px">
      <div style="text-align:center;margin-bottom:22px">
        <div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div>
        <div style="font-size:12px;color:#7a5b20;margin-top:4px">The Digital Monk</div>
      </div>
      <h1 style="font-size:24px;margin:0 0 18px">🙏 Your Order Has Been Successfully Received</h1>
      <p style="font-size:16px">Namaste ${esc(name)} 🙏</p>
      <p style="font-size:15px;line-height:1.7">Your payment and details for <b>${esc(product)}</b> have been successfully received. ✅</p>
      <div style="margin:20px 0;padding:18px;border-radius:15px;background:#f4fbf5;border:1px solid #bfe3c4;line-height:1.9">
        💳 <b>Payment:</b> Received<br>
        📜 <b>Service:</b> ${esc(product)}<br>
        📋 <b>Details:</b> Successfully Received
      </div>${bookingBlock}
      <p style="font-size:15px;line-height:1.7">Your order has now been received by our team and processing has started.</p>
      <p style="font-size:17px;line-height:1.7;font-weight:700">✨ Your personalised ${esc(product)} report will be prepared and delivered to your WhatsApp number within <span style="color:#177245">24 hours</span>.</p>
      <p style="font-size:15px;line-height:1.7">Thank you for your trust and for choosing Swami Atma Jagran.</p>
      <p style="font-size:15px;line-height:1.7;margin-top:24px">🙏 With gratitude,<br><b>Swami Atma Jagran</b><br><i>The Digital Monk</i></p>
    </div>
  </div>`;
}

async function sendResend({ to, subject, html, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN || 'swamiatmajagran.in';
  const from = process.env.RESEND_FROM_EMAIL || `Swami Atma Jagran <orders@${domain}>`;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing.');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || data?.name || 'Resend email failed.');
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return res.status(400).json({ error: 'Webhook configuration/signature missing.' });

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const payload = JSON.parse(rawBody);
    if (payload.event !== 'order.paid') return res.status(200).json({ ok: true, ignored: payload.event });

    const order = payload?.payload?.order?.entity || {};
    const payment = payload?.payload?.payment?.entity || {};
    const notes = order.notes || payment.notes || {};
    const orderId = order.id || payment.order_id || '';
    const paymentId = payment.id || '';
    const name = notes.customer_name || payment?.notes?.customer_name || payment?.email || 'Customer';
    const email = notes.customer_email || payment?.notes?.customer_email || payment.email || '';
    const product = notes.product || payment?.notes?.product || 'Swami Atma Jagran Service';
    const amount = Number(order.amount || payment.amount || 0) / 100;
    const whatsapp = notes.whatsapp || payment.contact || '';
    const slotId = notes.slot_id || payment?.notes?.slot_id || '';
    const bookingDate = notes.booking_date || payment?.notes?.booking_date || '';
    const bookingSlot = notes.booking_slot || payment?.notes?.booking_slot || '';
    const sessionDuration = notes.session_duration || payment?.notes?.session_duration || '';
    const sessionType = notes.session_type || payment?.notes?.session_type || '';

    if (!orderId || !email) {
      return res.status(400).json({ error: 'Paid order is missing order ID or customer email.' });
    }

    const tasks = [];
    tasks.push(sendResend({
      to: email,
      subject: '🙏 Your Order Has Been Successfully Received — Swami Atma Jagran',
      html: customerEmail({ name, product, slotId, bookingDate, bookingSlot, sessionDuration, sessionType }),
      idempotencyKey: `customer-order/${orderId}`,
    }));

    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    if (ownerEmail) {
      tasks.push(sendResend({
        to: ownerEmail,
        subject: `🔔 New Paid Order — ${product} — ${name}`,
        html: formatEmail({ name, product, amount, whatsapp, email, orderId, paymentId, slotId, bookingDate, bookingSlot, sessionDuration, sessionType }),
        idempotencyKey: `owner-order/${orderId}`,
      }));
    }

    const results = await Promise.allSettled(tasks);
    const failed = results.filter(x => x.status === 'rejected');
    if (failed.length) {
      console.error('Webhook email failure:', failed.map(x => x.reason?.message || String(x.reason)));
      return res.status(500).json({ error: 'Payment was received, but one or more notification emails failed.' });
    }

    return res.status(200).json({ ok: true, orderId, paymentId, customerEmailSent: true, ownerNotificationSent: Boolean(ownerEmail) });
  } catch (e) {
    console.error('payment-webhook error:', e);
    return res.status(500).json({ error: e.message || 'Webhook processing failed.' });
  }
}
