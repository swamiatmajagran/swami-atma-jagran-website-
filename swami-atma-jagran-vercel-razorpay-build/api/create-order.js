const PRODUCTS = {
  'Lagan Maya Sutra': 299,
  'Shukra Maya Sutra': 399,
  'D10 Destiny Sutra': 799,
  'Divya Bhagya Sutra': 999,
  'Individual Clarity Session': 999,
  'Partnership & Harmony': 1299,
  'Meet Swami Ji Ashram Session': 1999,
  // Kept for backward compatibility with the existing page.
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { product, customer } = req.body || {};
    const price = PRODUCTS[product];

    if (!price) return res.status(400).json({ error: 'Invalid product.' });

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer?.email || '');
    if (
      !customer?.name ||
      !customer?.dob ||
      !customer?.gender ||
      !customer?.time ||
      !customer?.ampm ||
      !customer?.place ||
      !/^[0-9]{10}$/.test(customer?.whatsapp || '') ||
      !validEmail
    ) {
      return res.status(400).json({ error: 'Complete customer details including a valid email are required.' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({ error: 'Razorpay server configuration is missing.' });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const receipt = `SJ-${Date.now()}`;

    // These notes become the persistent customer record attached to the Razorpay order.
    // They are read server-side by the private Your Chart Data panel and the webhook.
    const consultationProducts = new Set(['Individual Clarity Session','Partnership & Harmony','Meet Swami Ji Ashram Session']);
    const isConsultation = consultationProducts.has(product);
    if (isConsultation) {
      const slotDate = String(customer.consultation_slot_date || '');
      const slotTime = String(customer.consultation_slot_time || '');
      const day = slotDate ? new Date(slotDate + 'T12:00:00').getDay() : -1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || day === 0 || day === 6) return res.status(400).json({ error: 'Consultation sessions are available Monday to Friday only.' });
      const tm = slotTime.match(/^(\d{1,2}):00\s*(AM|PM)$/i);
      if (!tm) return res.status(400).json({ error: 'Please select a valid consultation time.' });
      let h = Number(tm[1]); if (h < 1 || h > 12) return res.status(400).json({ error: 'Invalid consultation time.' });
      if (tm[2].toUpperCase() === 'PM' && h !== 12) h += 12; if (tm[2].toUpperCase() === 'AM' && h === 12) h = 0;
      if (h < 12 || h > 20) return res.status(400).json({ error: 'Consultation timings are strictly 12:00 PM to 8:00 PM.' });
    }

    const notes = {
      product,
      customer_name: String(customer.name).slice(0, 255),
      customer_email: String(customer.email).slice(0, 255),
      dob: String(customer.dob).slice(0, 255),
      gender: String(customer.gender).slice(0, 255),
      birth_time: `${customer.time} ${customer.ampm}`.slice(0, 255),
      birth_place: String(customer.place).slice(0, 255),
      whatsapp: String(customer.whatsapp).slice(0, 255),
      ...(isConsultation ? { consultation_slot_date: String(customer.consultation_slot_date).slice(0,255), consultation_slot_time: String(customer.consultation_slot_time).slice(0,255), consultation_duration: String(customer.consultation_duration || '').slice(0,255), consultation_type: String(customer.consultation_type || '').slice(0,255) } : {}),
    };

    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: price * 100, currency: 'INR', receipt, notes }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.description || 'Razorpay order creation failed.' });

    return res.status(200).json({ orderId: data.id, amount: data.amount, currency: data.currency, keyId });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error.' });
  }
}
