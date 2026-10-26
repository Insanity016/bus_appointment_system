# bus_appointment_system

Clickable prototype of the **Five Star Bus Reservation & Operations System**:
public website with online booking, passenger mobile app, staff operations
portal and crew app, covering Phases 1, 2 and 3 of the proposal in `docs/`
(menu items are tagged P2 / P3). Front-end only (React + Vite) with sample
data, published on Vercel for Five Star to try.

> Everything changed in the portal (CMS, settings, bookings, dispatch) is saved
> in **that browser only** (localStorage). Each visitor starts from the same
> sample data. "Reset all demo data" on the staff sign-in page restores it.
> Terminals, routes and departure times come from fivestarph.com; fares, buses,
> crew and passengers are samples.

## Try it

| Where | What to try |
|---|---|
| `/` | Homepage built from the CMS: hero slides, trip search, advisories, popular routes, live "Leaving soon" board, route map of Luzon, bus classes, app, services, reviews, news and FAQs |
| `/book` | Search → seat map (priority seats, discounts) → SMS code (shown on screen) → PayMongo checkout (simulated) or reserve & pay at terminal → e-ticket with QR |
| `/manage`, `/ticket/:ref` | E-ticket, live trip status, change trip, cancel & refund, pay a reservation |
| `/routes`, `/terminals`, `/rent-a-bus`, `/parcels`, `/track`, `/news`, `/help` | Schedules, terminal finder, charter quotation, parcel tracking (P2), live bus tracking (P3) |
| `/account` | Passenger account: sign in with mobile + SMS code (demo `0917-555-0101`) |
| `/app` | Passenger app (installable PWA): book, offline e-tickets, track, Star Points |
| `/app/crew` | Crew app: employee no. `E-2002` (conductor) or `E-2001` (driver), PIN `246810` |
| `/admin` | Staff portal (accounts below) |
| `/admin/departures-tv?t=cubao` | Departure screen for the terminal TVs |

Staff accounts (password `Demo@2026!`, authenticator code `123456`):

| Email | Role |
|---|---|
| superadmin@demo.test | Super Admin (everything) |
| admin@demo.test | Company Admin |
| manager@demo.test | Terminal Manager – Cubao |
| dispatcher@demo.test | Dispatcher – Cubao |
| counter@demo.test | Ticketing Clerk – Cubao |
| cashier@demo.test | Cashier – Cubao |
| csr@demo.test | Customer Service |
| fleet@demo.test | Fleet & Maintenance |
| parcel@demo.test | Parcel Clerk – Cubao |
| editor@demo.test | Content Editor (website CMS only) |
| conductor@demo.test | Conductor (boarding only) |

Things to demo:

- **Login lockout**: 3 wrong passwords lock the account for 15 minutes; a second lock within 24 hours flags it. A higher rank unlocks it in *Staff & roles* (reason required).
- **One seat inventory**: book a seat online, then open the same trip in *Ticket counter* or *Boarding*: the seat is taken everywhere.
- **Dispatch**: assign buses and crew (buses with overdue PMS or expired papers are blocked), board / depart / arrive, delay or cancel a trip (SMS to every passenger, see *SMS outbox*), add an Undas extra trip.
- **Boarding**: scan or type an e-ticket reference; wrong-trip, unpaid and already-used tickets are refused; discounted fares say "check ID".
- **Website CMS**: homepage (draft → preview → publish → versions), routes, fares and departure times, terminals, bus classes and seat layouts, advisories, FAQs, promo banner, reviews, logo and colours.
- **Settings**: security, ticketing rules (fees, holds, priority seats, changes, refunds), discounts, SMS wording, parcels, fleet & crew limits, integrations (PayMongo, Semaphore, Mailjet, Amazon S3, Google Maps, GPS, Turnstile: enter keys, *Test*, switch on), maintenance mode.
- **Phase 2**: parcels & cargo, buses & maintenance (work orders), drivers & conductors, cash remittance, roadside tickets in the crew app.
- **Phase 3**: live bus map, charter quotations and deposits, report builder (CSV export), Star Points.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build
```

## Publish on Vercel

1. Commit and push this repository to GitHub.
2. On [vercel.com](https://vercel.com): **Add New → Project → Import** `bus_appointment_system`.
3. Vercel reads `vercel.json` (framework Vite, build `npm run build`, output `dist`, all paths to `index.html`). Press **Deploy**.
4. Every later push to the main branch redeploys automatically.

Only the built site (`dist/`) is published; `docs/` stays in the repository.

## Structure

```
src/
  lib/        data.js (terminals, routes, classes, fleet, CMS content, settings schema, roles),
              seed.js (sample dispatch, bookings, parcels, work orders, charters),
              trips.js (schedule → trips, seat maps, fares, statuses), booking.js (book, hold,
              rebook, refund, board), store.jsx (browser storage, audit, SMS), auth.js (lockout)
  shared.jsx  seat map, QR, Luzon route map, bus artwork, brand mark
  site/       public website and booking
  app/        passenger app and crew app
  admin/      staff portal (dashboard, dispatch, counter, boarding, bookings, P2/P3 modules, CMS, settings, staff, audit)
  styles/     base.css, site.css, admin.css, app.css
docs/         FiveStar-Bus-System-Documentation.docx / .pdf and its generator
```

The real system (documentation, section 2.2) runs on Vercel with a managed
Postgres database; this prototype shows how it works for Five Star.
