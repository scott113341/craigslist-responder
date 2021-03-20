# craigslist-responder

This is an app that auto-responds to text messages with information about my craigslist postings.
Vercel + Twilio + Postgres.

Database schema is dumped at `schema.sql`. Required environment variables:

```
ADDRESS="123 45th Ave"
DATABASE_URL="postgresql://user:pass@pg.com/craigslist_responder"
TWILIO_AUTH_TOKEN="abc123"
TWILIO_WEBHOOK_URL="https://craigslist-responder-123.vercel.app/api/get-text.js"
```
