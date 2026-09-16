function authHeader() {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error('Razorpay server configuration is missing.');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = authHeader();
    const headers = { Authorization: auth };
    async function fetchAll(path) {
      const all = [];
      for (let skip = 0; skip < 5000; skip += 100) {
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
    for (const p of payments) {
      if (p.order_id && !paymentByOrder.has(p.order_id)) paymentByOrder.set(p.order_id, p);
    }
    const orderRows = orders.filter(o => o?.notes?.product && o.status === 'paid').map(o => {
      const p = paymentByOrder.get(o.id);
      const paidAt = p?.created_at ? p.created_at * 1000 : (o.created_at ? o.created_at * 1000 : Date.now());
      return {
        name: o.notes?.customer_name || 'Customer',
        product: o.notes?.product || '',
        paymentStatus: 'PAID',
        dueAt: paidAt + 86400000,
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ orders: orderRows.slice(0, 200) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unable to load live orders.' });
  }
}
