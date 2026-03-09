# v0.dev Prompt — Polaris Point Celestial Redesign

Paste the sections below into v0.dev to update the polarispoint.io site.

---

## PROMPT

Redesign the entire Polaris Point website with a **celestial / North Star theme**. Polaris IS the North Star — lean hard into that. The site should feel like navigating by starlight: premium, cosmic, and aspirational.

### Design Direction

**Color palette:**
- Background: deep space navy `#050D1E` with subtle indigo undertones
- Card/surface: `rgba(15, 25, 55, 0.6)` with glass-blur borders `rgba(120, 160, 255, 0.12)`
- Primary accent: celestial blue `#5B8DEF` (the guiding star)
- Secondary accent: starlight gold `#E8C547` (warm highlights, CTAs)
- Text: pure white `#FFFFFF` for headings, `#B0C4E8` for body
- Subtle gradient glows: radial gradients in indigo/blue/purple behind sections

**Typography:**
- Headlines: Inter or Space Grotesk, bold, clean
- Body: Inter, weight 400, generous line-height

**Visual elements:**
- Subtle star-field particle effect in the hero background (tiny dots of varying opacity that slowly twinkle — CSS animation, no heavy JS)
- Constellation-line connectors between process steps (thin lines connecting dots, like connecting stars)
- Glowing orb/star element near the logo (pulsing soft glow)
- Section dividers: faint horizontal constellation lines or nebula-gradient bands
- Cards: frosted glass (backdrop-filter: blur) with subtle luminous borders
- Hover states: cards get a brighter glow border, slight lift
- The Polaris star logo should pulse with a soft radial glow

**Hero section:**
- Headline: "Your North Star to Digital Success"
- Subheadline: "We build fast, beautiful websites that guide Austin customers to your door."
- Star-field background with a prominent glowing Polaris star element (top-right or centered behind text)
- Nebula gradient wash (deep indigo → space blue → transparent)
- CTA buttons: "View Our Work" (starlight gold fill) and "Book a Free Call" (glass outline)
- Trust badge: "5.0 from 20+ projects" with star icons

### Sections to include (in order):

1. **Hero** — as described above

2. **The Problem** — 3 stat cards (40% no website, 76% same-day visit, 88% check online first). Cards are frosted glass with constellation-dot icons instead of emoji.

3. **What We Build** — 4 cards (Local Business Sites, Restaurant & Menu Sites, Service Pro Sites, Booking-Ready Sites). Use Lucide icons (Home, UtensilsCrossed, Wrench, CalendarCheck). Frosted glass cards with glow hover.

4. **Portfolio / Demo Gallery** — THIS IS THE KEY SECTION. Display 4 live demo case studies as cards with real photo thumbnails. Each card has:
   - Photo thumbnail (use these exact Pexels URLs):
     - Plumber: `https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=600`
     - Salon: `https://images.pexels.com/photos/3993453/pexels-photo-3993453.jpeg?auto=compress&cs=tinysrgb&w=600`
     - Restaurant: `https://images.pexels.com/photos/12645502/pexels-photo-12645502.jpeg?auto=compress&cs=tinysrgb&w=600`
     - Pest Control: `https://images.pexels.com/photos/7061662/pexels-photo-7061662.jpeg?auto=compress&cs=tinysrgb&w=600`
   - Business name overlay on the photo
   - Industry label
   - Short description
   - "View Live Demo" button that opens in new tab
   - Links (use these exact URLs):
     - `https://demos.polarispoint.io/plumber`
     - `https://demos.polarispoint.io/salon`
     - `https://demos.polarispoint.io/restaurant`
     - `https://demos.polarispoint.io/pest-control`

   Portfolio card details:
   | Card | Name | Industry | Description |
   |------|------|----------|-------------|
   | 1 | Lone Star Plumbing Co. | Service Pro | Trust-first design with emergency CTAs and quote forms |
   | 2 | Velvet & Vine Salon | Beauty & Wellness | Elegant gallery, service pricing, and booking-first layout |
   | 3 | Smoke & Stone BBQ | Restaurant | Bold menu showcase with pickup-ready conversion flow |
   | 4 | Pete's Pest Control | Home Services | Trust badges, service cards, and lead capture forms |

5. **How It Works** — 3-step process. Use constellation-line connectors between steps (dots connected by thin lines, like stars forming a path). Steps: Learn Your Business → Build Your Site → Go Live in 2 Weeks.

6. **Pricing** — Single premium banner card. "Starting at $799. Monthly plans from $79/mo." Frosted glass card with a nebula gradient background. CTA: "Get a Free Quote" (starlight gold button).

7. **CTA / Contact** — "Ready to Find Your North Star?" with email link and call button. Glowing star element.

8. **Footer** — Dark, minimal. Polaris Point, Austin TX, contact info, copyright 2025.

### Navigation
Sticky header with frosted glass background. Logo with glowing star icon + "Polaris Point" text. Nav links: Services, Portfolio, Pricing, Contact. "Book a Call" CTA button in starlight gold.

### Responsiveness
Fully responsive. Cards stack on mobile. Nav collapses to hamburger. Hero text scales down cleanly.

### Key technical notes
- Use Next.js App Router with Tailwind CSS
- Use Lucide React icons
- All demo links open in `target="_blank"`
- Photo thumbnails use `next/image` with the Pexels URLs (add `images.pexels.com` to next.config.js image domains)
- Smooth scroll to sections from nav links
- Intersection Observer for scroll-reveal animations (fade up)
- Star twinkle effect: CSS keyframe animation on small positioned dots, no canvas/WebGL
