import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      product,
    } = req.body || {};

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Incomplete Razorpay verification data.' });
    }

    if (orderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order mismatch.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!secret || !keyId) {
      return res.status(500).json({ error: 'Razorpay server configuration is missing.' });
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${razorpay_payment_id}`)
      .digest('hex');

    if (
      expected.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(razorpay_signature, 'utf8')
      )
    ) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    const auth = Buffer.from(`${keyId}:${secret}`).toString('base64');

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return res.status(400).json({
        error: payment?.error?.description || 'Unable to verify payment status.',
      });
    }

    if (payment.status !== 'captured') {
      return res.status(400).json({
        error: `Payment status is ${payment.status}, not captured.`,
      });
    }

    return res.status(200).json({
      ok: true,
      status: 'PAYMENT_VERIFIED',
      paymentId: razorpay_payment_id,
      orderId,
      product: product || payment.description || '',
    });
  } catch (e) {
    return res.status(500).json({
      error: e.message || 'Verification server error.',
    });
  }
}
