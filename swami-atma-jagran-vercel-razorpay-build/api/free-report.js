import crypto from 'crypto';

function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function sendResend({ to, subject, html, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN || 'swamiatmajagran.in';
  const from = process.env.RESEND_FROM_EMAIL || `Swami Atma Jagran <orders@${domain}>`;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing.');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.message || d?.name || 'Resend email failed.');
  return d;
}

function customerHtml({name}) {
  return `<div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:30px"><div style="text-align:center;margin-bottom:22px"><div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div><div style="font-size:12px;color:#7a5b20;margin-top:4px">The Digital Monk</div></div><h1 style="font-size:25px;margin:0 0 18px">🎉 Your Free Swarnima Janm Patrika Request Is Received</h1><p style="font-size:16px">Namaste ${esc(name)} 🙏</p><p style="font-size:15px;line-height:1.7">Your details for the <b>Swarnima Janm Patrika — FREE Kundli Report</b> have been successfully received.</p><div style="margin:20px 0;padding:18px;border-radius:15px;background:#f4fbf5;border:1px solid #bfe3c4;line-height:1.9">📋 <b>Details:</b> Successfully Received<br>💰 <b>Payment:</b> FREE<br>📜 <b>Report:</b> Swarnima Janm Patrika</div><p style="font-size:17px;line-height:1.7;font-weight:700">✨ Your personalised report will be prepared and delivered to your WhatsApp number within <span style="color:#177245">24 hours</span>.</p><p style="font-size:15px;line-height:1.7">Thank you for choosing Swami Atma Jagran.</p><p style="font-size:15px;line-height:1.7;margin-top:24px">🙏 With gratitude,<br><b>Swami Atma Jagran</b><br><i>The Digital Monk</i></p></div></div>`;
}

function ownerHtml({name,email,whatsapp,dob,gender,birthTime,birthPlace,requestId}) {
  return `<div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:30px"><div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div><h1 style="font-size:24px">🪷 New FREE Janm Patrika Request</h1><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px 0;color:#777">Customer</td><td style="padding:8px 0;font-weight:700">${esc(name)}</td></tr><tr><td style="padding:8px 0;color:#777">Email</td><td style="padding:8px 0">${esc(email)}</td></tr><tr><td style="padding:8px 0;color:#777">WhatsApp</td><td style="padding:8px 0">${esc(whatsapp)}</td></tr><tr><td style="padding:8px 0;color:#777">DOB / Gender</td><td style="padding:8px 0">${esc(dob)} / ${esc(gender)}</td></tr><tr><td style="padding:8px 0;color:#777">Birth</td><td style="padding:8px 0">${esc(birthTime)} / ${esc(birthPlace)}</td></tr><tr><td style="padding:8px 0;color:#777">Request ID</td><td style="padding:8px 0;font-family:monospace">${esc(requestId)}</td></tr></table><div style="margin-top:22px;padding:16px;border-radius:14px;background:#f8f0d8;border:1px solid #e7d7a6"><b>24-hour delivery countdown has started.</b><br>Free Swarnima Janm Patrika is due within 24 hours.</div></div></div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const {name,gender,dob,time,ampm,place,whatsapp,email} = req.body || {};
    const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'');
    if(!name||!gender||!dob||!time||!ampm||!place||!/^[0-9]{10}$/.test(whatsapp||'')||!validEmail) return res.status(400).json({error:'Complete free-report details including a valid email are required.'});
    const keyId=process.env.RAZORPAY_KEY_ID, keySecret=process.env.RAZORPAY_KEY_SECRET;
    if(!keyId||!keySecret) return res.status(500).json({error:'Razorpay server configuration is missing.'});
    const auth=Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const requestId=`FREE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const notes={product:'Swarnima Janm Patrika (Free)',free_request:'true',request_id:requestId,customer_name:String(name).slice(0,255),customer_email:String(email).slice(0,255),dob:String(dob).slice(0,255),gender:String(gender).slice(0,255),birth_time:`${time} ${ampm}`.slice(0,255),birth_place:String(place).slice(0,255),whatsapp:String(whatsapp).slice(0,255)};
    // A ₹1 Razorpay order is created only as a server-side durable request record; checkout is never opened and the customer is never charged.
    const rr=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json'},body:JSON.stringify({amount:100,currency:'INR',receipt:requestId,notes})});
    const rd=await rr.json();
    if(!rr.ok) return res.status(rr.status).json({error:rd?.error?.description||'Unable to create free report request.'});
    const tasks=[];
    tasks.push(sendResend({to:email,subject:'🙏 Your Free Swarnima Janm Patrika Request Is Received — Swami Atma Jagran',html:customerHtml({name}),idempotencyKey:`free-customer/${requestId}`}));
    if(process.env.OWNER_NOTIFICATION_EMAIL) tasks.push(sendResend({to:process.env.OWNER_NOTIFICATION_EMAIL,subject:`🪷 New FREE Janm Patrika Request — ${name}`,html:ownerHtml({name,email,whatsapp,dob,gender,birthTime:`${time} ${ampm}`,birthPlace:place,requestId}),idempotencyKey:`free-owner/${requestId}`}));
    const results=await Promise.allSettled(tasks); const failed=results.filter(x=>x.status==='rejected');
    if(failed.length) console.error('Free report email failure:',failed.map(x=>x.reason?.message||String(x.reason)));
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,requestId,recordId:rd.id,emailSent:failed.length===0});
  } catch(e) { console.error('free-report error:',e); return res.status(500).json({error:e.message||'Free report submission failed.'}); }
}
