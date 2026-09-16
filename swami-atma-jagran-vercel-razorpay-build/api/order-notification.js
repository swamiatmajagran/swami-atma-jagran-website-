import crypto from 'crypto';

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

async function sendResend({to,subject,html,idempotencyKey}){
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey) throw new Error('RESEND_API_KEY is missing.');
  const domain=process.env.RESEND_EMAIL_DOMAIN||'swamiatmajagran.in';
  const from=process.env.RESEND_FROM_EMAIL||`Swami Atma Jagran <orders@${domain}>`;
  const r=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
    body:JSON.stringify({from,to:[to],subject,html})
  });
  const d=await r.json();
  if(!r.ok) throw new Error(d?.message||d?.name||'Resend email failed.');
  return d;
}

function emailHtml(eventType,p){
  const isBooked=eventType==='consultation_booked';
  const title=isBooked?'📅 Consultation Date Booked':'💳 Payment Verified';
  return `<div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118"><div style="max-width:700px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:30px"><div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div><h1 style="font-size:25px">${title}</h1><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px 0;color:#777">Customer</td><td style="padding:8px 0;font-weight:700">${esc(p.customer?.name)}</td></tr><tr><td style="padding:8px 0;color:#777">Email</td><td style="padding:8px 0">${esc(p.customer?.email)}</td></tr><tr><td style="padding:8px 0;color:#777">WhatsApp</td><td style="padding:8px 0">${esc(p.customer?.whatsapp)}</td></tr><tr><td style="padding:8px 0;color:#777">Service</td><td style="padding:8px 0;font-weight:700">${esc(p.product)}</td></tr><tr><td style="padding:8px 0;color:#777">Amount</td><td style="padding:8px 0">₹${esc(p.price)}</td></tr><tr><td style="padding:8px 0;color:#777">Order ID</td><td style="padding:8px 0;font-family:monospace">${esc(p.orderId)}</td></tr><tr><td style="padding:8px 0;color:#777">Payment ID</td><td style="padding:8px 0;font-family:monospace">${esc(p.paymentId)}</td></tr>${isBooked?`<tr><td style="padding:8px 0;color:#777">Consultation Date</td><td style="padding:8px 0;font-weight:700">${esc(p.slotDate)}</td></tr><tr><td style="padding:8px 0;color:#777">Exact Time</td><td style="padding:8px 0;font-weight:700">Will be sent on WhatsApp</td></tr><tr><td style="padding:8px 0;color:#777">Slot ID</td><td style="padding:8px 0;font-weight:700">${esc(p.slotId)}</td></tr>`:''}</table><div style="margin-top:22px;padding:16px;border-radius:14px;background:#f8f0d8;border:1px solid #e7d7a6"><b>${isBooked?'Date booked successfully. Exact consultation time will be communicated on WhatsApp.':'Payment verified successfully. Customer must now select a Monday-Friday consultation date.'}</b></div></div></div>`;
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {eventType,payload}=req.body||{};
    if(!eventType||!payload) return res.status(400).json({error:'Notification event is required.'});
    const owner=process.env.OWNER_NOTIFICATION_EMAIL;
    if(!owner) return res.status(500).json({error:'OWNER_NOTIFICATION_EMAIL is missing.'});
    const key=`${eventType}/${payload.orderId||crypto.randomUUID()}/${payload.paymentId||''}/${payload.slotId||''}`;
    await sendResend({to:owner,subject:eventType==='consultation_booked'?`📅 Consultation Booked — ${payload.product||'Session'} — ${payload.customer?.name||'Customer'}`:`💳 Payment Verified — ${payload.product||'Service'} — ${payload.customer?.name||'Customer'}`,html:emailHtml(eventType,payload),idempotencyKey:key});
    return res.status(200).json({ok:true});
  }catch(e){console.error('order-notification error:',e);return res.status(500).json({error:e.message||'Notification failed.'});}
}
