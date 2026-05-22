# Business Automation — setup sheet

Business Automation is the $79/mo tier: **online booking, AI popup chat, lead auto-reply, and review-request emails.** It's all delivered by one script, switchable per site.

This sheet covers: (1) turning it on for an ops/admin site, (2) adding it to a custom site, (3) what the client has to give you. Keep it simple — most sites take 5 minutes.

---

## The 4 features at a glance

| Feature | What the visitor sees | What you need from the client |
|---|---|---|
| **Online booking** | A "Book Now" button → their calendar | A **Calendly link** |
| **AI popup chat** | A "Chat" button that answers questions about their business | Nothing — it reads their site content |
| **Lead auto-reply** | Contact form sends an instant confirmation email | Their **business email** (already in site config) |
| **Review-request emails** | Customer gets a "leave us a review" email a few days after service | Their **Google review link** |

---

## 1. Turn it on for a site built in Admin/Ops  ← easiest

Ops now has an **Automation** column, just like the Analytics toggle.

1. Open **Ops → Sites**.
2. Find the site, click the **⚙ Automation** button in its row.
3. Flip on the features you want.
4. Fill the fields the features need:
   - **Calendly URL** (for booking)
   - **Google review URL** (for review emails)
   - **Chat greeting** (optional — there's a sensible default)
5. Click **Save**. Done — it's live on the next page load.

That's it. No code, no redeploy. The toggles write into the site's stored config, and the site reads them automatically.

> The button shows "2/4 on" etc. so you can see at a glance what's active.

---

## 2. Add it to a custom site (in code)

For a site **registered in our system** (has a slug), it's **one line** before `</body>`:

```html
<script src="https://polarispoint.io/shared/automation.js" data-pp-slug="THE-SITE-SLUG"></script>
```

It fetches that site's settings by slug and turns on whatever's enabled in Ops. You still manage the toggles from Ops (step 1).

For a site **NOT in our system**, set the config inline, then load the script:

```html
<script>
  window.PP_AUTOMATION = {
    features: { booking: true, aiChat: false, leadAutoReply: true },
    automation: {
      businessName: "Joe's Plumbing",
      calendlyUrl: "https://calendly.com/joes-plumbing/service-call",
      leadAutoReply: { fromName: "Joe's Plumbing", replyText: "Thanks! We'll call you back within the hour." }
    }
  };
</script>
<script src="https://polarispoint.io/shared/automation.js"></script>
```

> **AI chat needs the site registered** (it pulls the business's info by slug from our database). On a fully external site with no slug, ship booking + lead auto-reply, and add chat once you register the site.

Works on any platform — WordPress, Squarespace, Webflow, hand-coded. The script injects its own styling, so nothing else is needed.

---

## 3. What the client needs to set up

Give the client this checklist. You only need the items for features you're turning on.

- [ ] **Calendly account** (free tier is fine) → send you the booking link, e.g. `https://calendly.com/their-business/30min`
  *(booking only)*
- [ ] **Google Business Profile** with reviews turned on → send you their review link (`https://g.page/r/…`)
  *(review emails only)*
- [ ] **A business email** they check → for lead notifications + as the reply-to on auto-replies
  *(already captured in their site config in most cases)*
- [ ] Nothing for AI chat — it learns from the site's own services, hours, FAQ, and about text.

That's the whole client ask. Booking and reviews are the only ones that need an external account, and both are free to set up.

---

## 4. Paste-prompt for an AI building a custom site

Hand this to whatever's building the site (v0, Cursor, Claude, a contractor):

> Add Polaris Point Business Automation. Insert this right before `</body>`:
>
> ```html
> <script>
>   window.PP_AUTOMATION = {
>     features: { booking: true, aiChat: false, leadAutoReply: true },
>     automation: {
>       businessName: "<BUSINESS NAME>",
>       calendlyUrl: "<CALENDLY URL or empty string>",
>       leadAutoReply: { fromName: "<BUSINESS NAME>", replyText: "Thanks for reaching out! We'll be in touch shortly." }
>     }
>   };
> </script>
> <script src="https://polarispoint.io/shared/automation.js"></script>
> ```
>
> Rules: don't add any other booking or chat widget (this provides them); leave the existing contact form as-is (the script auto-wires any form with an email field); if there's no Calendly link set `booking: false`; set `aiChat: true` only if the site is registered with a slug (then add `data-pp-slug="<slug>"` to the script tag).

---

## Reference (for the curious / debugging)

**Files:** front-end [`shared/automation.js`](../shared/automation.js); endpoints [`api/site-chat.js`](../api/site-chat.js), [`api/site-lead.js`](../api/site-lead.js), [`api/site-review-request.js`](../api/site-review-request.js). Reference wiring lives in [`cleaning/`](../cleaning/).

**Config shape** (what the Ops toggle writes into `site_config`):
```js
features:   { booking, aiChat, leadAutoReply, reviewRequests },   // booleans
automation: {
  calendlyUrl: "…",
  chat: { greeting: "…" },
  leadAutoReply: { fromName: "…", replyText: "…" },
  reviewRequest: { delayDays: 3, reviewUrl: "…" }
}
```

**Review requests** are sent by a daily cron. They're queued by POSTing to `/api/site-review-request` when a job/booking completes (trigger from Ops or an integration) — there's no visitor button for that one.

**Server env required:** `ANTHROPIC_API_KEY` (chat), `RESEND_API_KEY` (lead + review emails), `DATABASE_URL` (everything), `CRON_SECRET` (optional, protects the review cron). Lead capture still works without email keys — the emails just no-op.
