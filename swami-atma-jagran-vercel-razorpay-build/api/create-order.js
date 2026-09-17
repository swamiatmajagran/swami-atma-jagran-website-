const PRODUCTS = {
  'Lagan Maya Sutra': 299,
  'Shukra Maya Sutra': 399,
  'D10 Destiny Sutra': 799,
  'Divya Bhagya Sutra': 999,
  'Individual Clarity Session': 1, // TESTING PRICE — strictly ₹1 as requested. Revert to 999 after testing.
  'Partnership & Harmony': 1299,
  'Meet Swami Ji Ashram Session': 1999,
  // Kept for backward compatibility with the existing page.
};

// Products booked through the new Consultation Section popup (Step 1/2 flow).
// For these, birth-chart fields are not collected — instead we require the
// consultation reason/question and the booked date + time slot.
const CONSULTATION_PRODUCTS = new Set([
  'Individual Clarity Session',
  'Partnership & Harmony',
  'Meet Swami Ji Ashram Session',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { product, customer } = req.body || {};
    const price = PRODUCTS[product];

    if (!price) return res.status(400).json({ error: 'Invalid product.' });

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer?.email || '');
    const validWhatsapp = /^[0-9]{10}$/.test(customer?.whatsapp || '');
    const isConsultation = CONSULTATION_PRODUCTS.has(product);

    if (isConsultation) {
      // Consultation booking flow: name, birth details, contact info, reason/question, and a booked slot are required.
      if (
        !customer?.name ||
        !customer?.dob ||
        !customer?.gender ||
        !customer?.birthTime ||
        !customer?.birthPlace ||
        !validWhatsapp ||
        !customer?.consultReason ||
        !customer?.bookingDate ||
        !customer?.bookingSlot
      ) {
        return res.status(400).json({ error: 'Complete booking details (name, DOB, gender, birth time & place, WhatsApp, email, reason, date and slot) are required.' });
      }
    } else {
      if (
        !customer?.name ||
        !customer?.dob ||
        !customer?.gender ||
        !customer?.time ||
        !customer?.ampm ||
        !customer?.place ||
        !validWhatsapp ||
        !validEmail
      ) {
        return res.status(400).json({ error: 'Complete customer details including a valid email are required.' });
      }
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({ error: 'Razorpay server configuration is missing.' });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const receipt = `SJ-${Date.now()}`;

    // These notes become the persistent customer record attached to the Razorpay order.
    // They are read server-side by the private Your Chart Data panel and the webhook.
    const notes = {
      product,
      customer_name: String(customer.name).slice(0, 255),
      customer_email: String(customer.email).slice(0, 255),
      whatsapp: String(customer.whatsapp).slice(0, 255),
    };

    if (isConsultation) {
      // Consultation-specific note fields (birth details, Slot ID, booked date/slot, reason, question, duration & mode).
      notes.dob = String(customer.dob || '').slice(0, 255);
      notes.gender = String(customer.gender || '').slice(0, 255);
      notes.birth_time = String(customer.birthTime || '').slice(0, 255);
      notes.birth_place = String(customer.birthPlace || '').slice(0, 255);
      notes.slot_id = String(customer.slotId || '').slice(0, 32);
      notes.booking_date = String(customer.bookingDate || '').slice(0, 32);
      notes.booking_slot = String(customer.bookingSlot || '').slice(0, 64);
      notes.consult_reason = String(customer.consultReason || '').slice(0, 255);
      notes.consult_question = String(customer.consultQuestion || '').slice(0, 500);
      notes.session_duration = String(customer.sessionDuration || '').slice(0, 32);
      notes.session_type = String(customer.sessionType || '').slice(0, 32);
      notes.unknown_birth_time = customer.unknownBirthTime ? 'true' : 'false';
      notes.birth_ampm = String(customer.ampm || '').slice(0, 8);
    } else {
      notes.dob = String(customer.dob).slice(0, 255);
      notes.gender = String(customer.gender).slice(0, 255);
      notes.birth_time = `${customer.time} ${customer.ampm}`.slice(0, 255);
      notes.birth_place = String(customer.place).slice(0, 255);
    }

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
