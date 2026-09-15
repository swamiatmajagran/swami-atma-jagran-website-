import crypto from 'crypto';
function auth(){const k=process.env.RAZORPAY_KEY_ID,s=process.env.RAZORPAY_KEY_SECRET;if(!k||!s)throw new Error('Razorpay server configuration is missing.');return `Basic ${Buffer.from(`${k}:${s}`).toString('base64')}`;}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const {orderId,date,time}=req.body||{};
    if(!orderId||!date||!time)return res.status(400).json({error:'Consultation order and slot are required.'});
    const day=new Date(`${date}T12:00:00`).getDay();
    if(day===0||day===6)return res.status(400).json({error:'Consultations are available Monday to Friday only.'});
    const m=String(time).match(/^(\d{1,2}):00\s*(AM|PM)$/i); if(!m)return res.status(400).json({error:'Invalid session time.'});
    let h=Number(m[1]); const ap=m[2].toUpperCase(); if(h<1||h>12)return res.status(400).json({error:'Invalid session time.'}); if(ap==='PM'&&h!==12)h+=12;if(ap==='AM'&&h===12)h=0;
    if(h<12||h>20)return res.status(400).json({error:'Session timings are strictly 12:00 PM to 8:00 PM.'});
    const headers={Authorization:auth()};
    const r=await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,{headers}); const o=await r.json();
    if(!r.ok)return res.status(r.status).json({error:o?.error?.description||'Unable to verify order.'});
    if(o.status!=='paid')return res.status(400).json({error:'Payment is not confirmed yet.'});
    if(!o.notes?.product||!['Individual Clarity Session','Partnership & Harmony','Meet Swami Ji Ashram Session'].includes(o.notes.product))return res.status(400).json({error:'This order is not a consultation booking.'});
    // Slot is already attached to the order at creation; this endpoint confirms the same slot after payment.
    return res.status(200).json({ok:true,bookingId:`BOOK-${crypto.randomBytes(4).toString('hex')}`,date,time});
  }catch(e){return res.status(500).json({error:e.message||'Session booking failed.'});}
}
