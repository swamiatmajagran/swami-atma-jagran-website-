import crypto from 'crypto';

function auth(){
  const k=process.env.RAZORPAY_KEY_ID,s=process.env.RAZORPAY_KEY_SECRET;
  if(!k||!s) throw new Error('Razorpay server configuration is missing.');
  return `Basic ${Buffer.from(`${k}:${s}`).toString('base64')}`;
}

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

async function sendOwnerBookingEmail(data){
  const apiKey=process.env.RESEND_API_KEY, owner=process.env.OWNER_NOTIFICATION_EMAIL;
  if(!apiKey||!owner) return;
  const domain=process.env.RESEND_EMAIL_DOMAIN||'swamiatmajagran.in';
  const from=process.env.RESEND_FROM_EMAIL||`Swami Atma Jagran <orders@${domain}>`;
  const subject=`📅 Consultation Date Booked — ${data.product} — ${data.name}`;
  const html=`<div style="font-family:Arial,sans-serif;background:#faf7f0;padding:28px;color:#3b1118"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e7d7a6;border-radius:18px;padding:30px"><div style="font-size:12px;letter-spacing:3px;color:#a47a13;font-weight:700">SWAMI ATMA JAGRAN</div><h1 style="font-size:24px">📅 Consultation Date Booked</h1><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td>Customer</td><td><b>${esc(data.name)}</b></td></tr><tr><td>Service</td><td><b>${esc(data.product)}</b></td></tr><tr><td>Consultation Date</td><td><b>${esc(data.date)}</b></td></tr><tr><td>Exact Time</td><td><b>To be informed on WhatsApp</b></td></tr><tr><td>Slot ID</td><td><b>${esc(data.slotId)}</b></td></tr><tr><td>WhatsApp</td><td>${esc(data.whatsapp)}</td></tr><tr><td>Email</td><td>${esc(data.email)}</td></tr><tr><td>Payment ID</td><td>${esc(data.paymentId)}</td></tr><tr><td>Order ID</td><td>${esc(data.orderId)}</td></tr></table><p style="margin-top:22px;padding:16px;background:#f8f0d8;border:1px solid #e7d7a6;border-radius:14px"><b>Customer has selected the consultation date.</b><br>Exact consultation time will be communicated by WhatsApp.</p></div></div>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`booking/${data.orderId}/${data.slotId}`},body:JSON.stringify({from,to:[owner],subject,html})});
  if(!r.ok) throw new Error('Booking notification email failed.');
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {orderId,date,slotId,customer,paymentId}=req.body||{};
    if(!orderId||!date||!slotId) return res.status(400).json({error:'Consultation order, date and Slot ID are required.'});
    const day=new Date(`${date}T12:00:00`).getDay();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||day===0||day===6) return res.status(400).json({error:'Consultations are available Monday to Friday only.'});
    const r=await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:auth()}});
    const o=await r.json();
    if(!r.ok) return res.status(r.status).json({error:o?.error?.description||'Unable to verify order.'});
    if(o.status!=='paid') return res.status(400).json({error:'Payment is not confirmed yet.'});
    const product=o.notes?.product||customer?.product||'';
    if(!['Individual Clarity Session','Partnership & Harmony','Meet Swami Ji Ashram Session'].includes(product)) return res.status(400).json({error:'This order is not a consultation booking.'});
    if(!paymentId) return res.status(400).json({error:'Payment ID is required to finalize the booking.'});
    // Persist the selected date + Slot ID on the captured Razorpay payment.
    // Razorpay supports updating payment notes, which lets the private owner panel
    // retrieve the booking later without exposing the data publicly.
    const paymentGet=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:auth()}});
    const payment=await paymentGet.json();
    if(!paymentGet.ok) return res.status(paymentGet.status).json({error:payment?.error?.description||'Unable to load payment record.'});
    const mergedNotes={
      ...(payment.notes||{}),
      consultation_slot_date:String(date),
      consultation_slot_time:'Exact time will be sent on WhatsApp',
      consultation_slot_id:String(slotId),
      consultation_booking_status:'DATE BOOKED'
    };
    const paymentPatch=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{
      method:'PATCH',
      headers:{Authorization:auth(),'Content-Type':'application/json'},
      body:JSON.stringify({notes:mergedNotes})
    });
    const patched=await paymentPatch.json();
    if(!paymentPatch.ok) return res.status(paymentPatch.status).json({error:patched?.error?.description||'Unable to save consultation booking.'});
    const payload={orderId,date,slotId,paymentId,name:customer?.name||o.notes?.customer_name||'',email:customer?.email||o.notes?.customer_email||'',whatsapp:customer?.whatsapp||o.notes?.whatsapp||'',product};
    try{await sendOwnerBookingEmail(payload);}catch(e){console.error(e);}
    return res.status(200).json({ok:true,bookingId:`BOOK-${crypto.randomBytes(4).toString('hex')}`,date,time:'Exact time will be sent on WhatsApp',slotId});
  }catch(e){return res.status(500).json({error:e.message||'Session booking failed.'});}
}
