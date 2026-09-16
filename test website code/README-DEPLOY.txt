# Swami Atma Jagran — Final Website

## Structure
- `index.html` — frontend
- `api/` — Vercel serverless API routes

## Required Vercel Environment Variables
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `JIGYASU_ADMIN_PASSWORD` (or `ADMIN_PANEL_PASSWORD`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (recommended)
- `RESEND_EMAIL_DOMAIN` (optional)
- `OWNER_NOTIFICATION_EMAIL`
- `RAZORPAY_WEBHOOK_SECRET` (for the payment webhook)

## Consultation payment flow
1. Customer enters personal details.
2. Customer enters consultation question.
3. `PAY NOW →` opens Razorpay Standard Checkout.
4. Payment is verified server-side.
5. Customer selects only a Monday-Friday date.
6. No customer time selection.
7. Slot ID is generated and the date/Slot ID are saved to the captured Razorpay payment notes.
8. Owner notification is sent by Resend.
9. Confirmation screen shows payment, date, Slot ID and WhatsApp time notice.

The exact consultation time is intentionally communicated by WhatsApp, as requested.

## Deployment
Upload `index.html` at the site root and the complete `api/` folder to the same Vercel project. Do not put API files inside the public/static folder.
