function authHeader() {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error('Razorpay server configuration is missing.');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const expectedPassword = process.env.JIGYASU_ADMIN_PASSWORD || process.env.ADMIN_PANEL_PASSWORD;
  const suppliedPassword = req.headers['x-admin-password'];
  if (!expectedPassword) return res.status(500).json({ error: 'Jigyasu admin password is not configured on Vercel.' });
  if (!suppliedPassword || suppliedPassword !== expectedPassword) return res.status(401).json({ error: 'Private access denied.' });

  try {
    const auth = authHeader();
    const headers = { Authorization: auth };
    async function fetchAll(path) {
      const all = [];
      for (let skip = 0; skip < 10000; skip += 100) {
        const r = await fetch(`https://api.razorpay.com/v1/${path}?count=100&skip=${skip}`, { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.description || `Unable to load ${path}.`);
        const items = d?.items || [];
        all.push(...items);
        if (items.length < 100) break;
      }
      return all;
    }
    const [orders, payments] = await Promise.all([fetchAll('orders'), fetchAll('payments')]);
    const paymentByOrder = new Map();
    for (const p of payments) if (p.order_id && !paymentByOrder.has(p.order_id)) paymentByOrder.set(p.order_id, p);

    const orderRows = orders.filter(o => o?.notes?.product).map(o => {
      const p = paymentByOrder.get(o.id);
      const paid = o.status === 'paid';
      const baseTime = p?.created_at ? p.created_at * 1000 : (o.created_at ? o.created_at * 1000 : Date.now());
      const notes = o.notes || {};
      return {
        orderId: o.id,
        name: notes.customer_name || '',
        email: notes.customer_email || '',
        dob: notes.dob || '',
        gender: notes.gender || '',
        birthTime: notes.birth_time || '',
        birthPlace: notes.birth_place || '',
        whatsapp: notes.whatsapp || '',
        product: notes.product || '',
        // Consultation Section booking fields (present only for Book Now / Consult Now orders).
        slotId: notes.slot_id || '',
        bookingDate: notes.booking_date || '',
        bookingSlot: notes.booking_slot || '',
        consultReason: notes.consult_reason || '',
        consultQuestion: notes.consult_question || '',
        sessionDuration: notes.session_duration || '',
        sessionType: notes.session_type || '',
        unknownBirthTime: notes.unknown_birth_time || '',
        paymentStatus: paid ? 'PAID' : String(o.status || 'PENDING').toUpperCase(),
        paymentId: p?.id || '',
        amount: Number(o.amount || 0) / 100,
        createdAt: (o.created_at || 0) * 1000,
        dueAt: paid ? baseTime + 86400000 : 0,
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ orders: orderRows });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unable to load private order data.' });
  }
}
