/**
 * Beacon demo personas — Austin-localized, ~6–12 months of accumulated data per industry.
 * Loaded by beacon/index.html. Activated by ?demo=<key> URL param or by signing in
 * with one of the demo email addresses below (password: demo).
 */
(function() {
  'use strict';

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const monthsAgo = (n) => new Date(Date.now() - n * 30 * 86400000).toISOString();

  window.BEACON_DEMO_PERSONAS = {

    /* ============================================================
       1. REAL ESTATE — Sarah Chen Realty (central Austin)
       ============================================================ */
    real_estate: {
      key: 'real_estate',
      email: 'realestate@beacon.demo',
      password: 'demo',
      label: 'Real Estate',
      description: 'Sarah Chen Realty · Central Austin',
      subscription: {
        id: 'demo-re-001',
        email: 'realestate@beacon.demo',
        client_name: 'Sarah Chen',
        business_name: 'Sarah Chen Realty',
        industry: 'real_estate',
        plan: 'pro',
        status: 'active',
        tokens_used: 218450,
        referral_code: 'SARAH-CHEN-RLTY',
        created_at: monthsAgo(8),
        current_period_end: daysAhead(19),
        token_reset_date: daysAhead(19)
      },
      chat: [
        { role: 'user', content: 'Write the listing description for 3812 Avenue G — 4BR/3BA Hyde Park bungalow at $1.395M.', created_at: monthsAgo(5) },
        { role: 'assistant', type: 'social', content: 'Hyde Park dreams, delivered. ✨\n\n3812 Avenue G | 4BR · 3BA · $1,395,000\n\nA 1920s bungalow with the bones you fall in love with and the kitchen you actually want to cook in. Original hardwoods, restored windows, screened porch made for slow Sundays — and yes, walkable to Quack\'s.\n\nDM for the private tour list. Open Saturday 11–1.', created_at: monthsAgo(5) },
        { role: 'user', content: 'Make it shorter and more casual', created_at: monthsAgo(5) },
        { role: 'assistant', type: 'social', content: 'New listing alert 🏡\n\n3812 Avenue G | Hyde Park | $1.395M\n4 bed, 3 bath bungalow with the original hardwoods and a screened porch you won\'t want to leave.\n\nOpen Sat 11–1. DM for early access.', created_at: monthsAgo(5) },
        { role: 'user', content: 'Draft a follow-up email to last weekend\'s open house attendees at 3812 Avenue G.', created_at: monthsAgo(5) },
        { role: 'assistant', type: 'email', content: 'Subject: Thanks for stopping by 3812 Avenue G\n\nHi {{first_name}},\n\nReally appreciated meeting you at the open house Saturday. A few folks asked for the comps in Hyde Park — I put together a quick one-pager covering the last 6 sales on Avenue G and Avenue H. Happy to send it over.\n\nIf 3812 isn\'t the one, I\'ve got two more coming to market in the same pocket next week — both under $1.5M. Want me to text you when they go live?\n\nSarah\n512-555-0143', created_at: monthsAgo(5) },
        { role: 'user', content: 'Draft a Tarrytown buyer guide for first-time $2M+ buyers', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'blog_post', content: 'The Tarrytown Buyer\'s Field Guide (2026)\n\nTarrytown isn\'t a neighborhood you "shop." It\'s one you wait for. Inventory rarely tops 12 active listings, and the homes that do hit the market move fast — usually within 11 days, often with multiple offers.\n\nIf you\'re a first-time Tarrytown buyer at the $2M+ tier, here\'s what 11 years of selling here has taught me...\n\n1. The lot is the asset. Tarrytown lots run 8,000–14,000 sq ft. Pay for the lot first; the house can be remodeled.\n2. Casis Elementary is the price multiplier. Homes inside Casis boundaries trade 18–22% above identical homes a block south.\n3. The hidden inventory is real. About 30% of Tarrytown sales last year never hit the MLS. If you\'re working with the right agent, you\'re seeing the off-market list.\n4. Renovate vs. tear down: most teardowns happen on lots over 11,000 sq ft. Below that, the math rarely works.\n5. The "good streets": Westover, Kenwood, Bowman, and the upper end of Hartford are the most consistent for resale.', created_at: monthsAgo(3) },
        { role: 'user', content: 'Quick tweet about today\'s rate move', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'social', content: 'Rates dropped 0.25% this morning.\n\nFor the Hyde Park bungalow at $1.4M, that\'s about $230/month back in your pocket on a conventional 30-year. Not nothing.\n\nIf you paused your search 6 months ago because of rates — let\'s look again.', created_at: monthsAgo(2) },
        { role: 'user', content: 'Draft a follow-up to a buyer who ghosted me 3 weeks ago', created_at: daysAgo(12) },
        { role: 'assistant', type: 'email', content: 'Subject: No pressure — just a quick check-in\n\nHi {{first_name}},\n\nNo agenda here. Just wanted to say hi and let you know the listing on East Side I sent over last month sold over ask in 9 days. The 78704 market is moving faster than feel.\n\nIf you\'re still looking, I\'ve got two new ones I think fit your list — one in Bouldin under $850K, one in South 5th around $1.1M. Want me to send them over, or are you on pause for now? Either is fine.\n\nSarah', created_at: daysAgo(12) },
        { role: 'user', content: 'Write me an Instagram caption for the new East Austin listing on Holly Street', created_at: daysAgo(2) },
        { role: 'assistant', type: 'social', content: 'East Austin, your move 👀\n\n2107 Holly St | 3BR · 2BA · $785,000\n\nWalkable to Cisco\'s, Lazarus Brewing, and the new East 7th food hall. Light-soaked living room, screened back porch, and a backyard begging for string lights.\n\nOpen Saturday 12–2. DM for the private tour list.', created_at: daysAgo(2) },
        { role: 'user', content: 'Reply to a 5-star Google review from Jennifer & Marcus (Bouldin buyers)', created_at: daysAgo(1) },
        { role: 'assistant', type: 'review_response', content: 'Hi Jennifer — thank you so much. Helping you and Marcus find the Bouldin house was genuinely one of my favorite deals this year. The fact that you took my "let\'s wait for the right one" advice instead of jumping on the Travis Heights listing in February — that patience is what got you the porch you wanted. Cheers to many slow Sundays at home. — Sarah', created_at: daysAgo(1) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Warm but expert. Conversational, never salesy. Specific over generic — name the streets, the schools, the coffee shops. Speak to first-time Austin buyers and to homeowners who already know the market. Avoid hype words ("stunning", "must-see"). Default to numbers and sensory detail.' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'Buyer representation (first-time + move-up), seller listings, relocation services for tech transplants, investment property consultations, off-market sourcing for $1M+ buyers, staging coordination through partner firm.' },
        { id: 'doc-3', type: 'about', title: 'About Sarah', content: 'Austin native, 11 years in residential real estate. Top 5% producer 2023 + 2024. Specializes in central Austin pockets: Hyde Park, Tarrytown, Mueller, East Cesar Chavez, Bouldin. UT alum. Bilingual English/Mandarin.' },
        { id: 'doc-4', type: 'faq', title: 'FAQ for Buyers', content: 'Most-asked: How fast does central Austin move? (median 18 days, 6% over ask in 78751). Cash vs. financed? Conventional with strong escalation works. Inspection contingency? Always — but waive repairs under $5K to compete.' },
        { id: 'doc-5', type: 'pricing', title: 'Commission Structure', content: 'Buyer side: paid by seller per MLS. Seller side: 2.5% listing fee, all-inclusive (pro photography, drone, 3D tour, staging consult, social campaign, weekly market updates). No transaction fees. No hidden costs.' },
        { id: 'doc-6', type: 'about', title: 'Neighborhoods I Serve', content: 'Primary: Hyde Park (78751), Tarrytown (78703), Mueller (78723), Bouldin Creek (78704), East Cesar Chavez (78702), Travis Heights (78704), Clarksville (78703), Old West Austin (78703). Selective in Westlake, Lake Austin, and the Domain area for past-client referrals only.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Bramlett Residential', url: 'https://bramlettresidential.com', last_checked: daysAgo(1), summary: 'New positioning push around relocation services — added a "Moving to Austin" landing page with neighborhood guides for Hyde Park, Mueller, and Westlake. Their blog dropped 3 posts this week on tech-employee buyer programs. Worth matching with a 78751-specific guide. Pricing transparency on listings is stronger than ours; consider adding price-per-sqft to listing posts.' },
        { id: 'comp-2', name: 'Realty Austin', url: 'https://realtyaustin.com', last_checked: daysAgo(2), summary: 'Heavy Instagram Reels investment — running daily neighborhood tours with their agents on camera. 3 of their last 5 posts hit 10K+ views. They\'re also testing a "live market update" weekly newsletter (Wednesdays) with hyperlocal data. Recommend testing similar weekly cadence for our Hyde Park / Tarrytown segment.' },
        { id: 'comp-3', name: 'JBGoodwin REALTORS', url: 'https://jbgoodwin.com', last_checked: daysAgo(3), summary: 'Quiet on social this month, but launched a refreshed email newsletter with a "deals of the week" section featuring price drops + new listings under $750K. Their SEO ranking improved on "Austin first time home buyer" — they now hold position 2. Monitor whether they sustain it.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'East Austin, your move 👀\n\n2107 Holly St | 3BR · 2BA · $785,000\n\nWalkable to Cisco\'s, Lazarus Brewing, and the new East 7th food hall. Light-soaked living room, screened back porch, and a backyard begging for string lights.\n\nOpen Saturday 12–2.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(8), next_run: daysAhead(22), last_output: 'Subject: April in Austin — 3 pockets I\'m watching\n\nHey friends — quick market update before May.\n\nHyde Park: median DOM dropped to 14 days (down from 21 in March). Buyers jumping on anything under $1.5M with original character.\n\nMueller: phase 5 townhomes selling pre-construction. If you\'ve been waiting, the wait is over.\n\nEast Cesar Chavez: investor activity cooled. First-time buyer territory again — three solid options under $650K right now.\n\nReply if you want the full comp set for any of these.\n\nSarah' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(11), last_output: '5 Things to Know Before Buying in Hyde Park (2026 Edition)\n\nHyde Park sits in a strange sweet spot: walkable like Mueller, character like Tarrytown, prices that still occasionally start with a 7. Here\'s what every buyer should know before writing an offer in 78751...\n\n1. The lot matters more than the house. Most homes are pre-1940. The good ones have been thoughtfully renovated; the great ones still have the original casement windows...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Hi Jennifer — thank you so much. Helping you and Marcus find the Bouldin house was genuinely one of my favorite deals this year. The patience to wait for the right one is what got you the porch you wanted. Cheers to many slow Sundays at home. — Sarah' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan (Bramlett, Realty Austin, JBGoodwin):\n\n• Bramlett added a "Moving to Austin" relocation hub — 3 new neighborhood guides this week.\n• Realty Austin: 3 of last 5 Reels hit 10K+ views. Recommend matching their daily Reel cadence.\n• JBGoodwin: refreshed newsletter format. SEO position 2 on "Austin first time home buyer" — watch.\n\nTop opportunity: weekly Hyde Park / Tarrytown live market newsletter. None of them own this segment.' },
        { id: 'task-6', task_type: 'outbound_sequence', frequency: 'weekly', status: 'active', last_run: daysAgo(0), next_run: daysAhead(7), last_output: 'Cold outreach — past renters in 78751 (week of April 22)\n\nSubject: Quick question about your Hyde Park lease\n\nHi {{first_name}} — saw your lease at {{address}} renews this fall. Quick note: 3 homes just hit the market within 4 blocks under $1.4M, all renovated. With current rates and a 5% down conventional, the math on buying vs. renewing is closer than most people realize.\n\nWant me to send the buy-vs-rent breakdown for your specific street? Takes me 5 minutes, no pitch.\n\nSarah' },
        { id: 'task-7', task_type: 'lead_research', frequency: 'weekly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(3), last_output: 'Weekly lead research — central Austin\n\n• 14 new "expired listings" identified in 78703/78751/78704 (active 2024, off-market without sale)\n• 9 absentee owners on Avenue G, Avenue H (Hyde Park investor cohort)\n• 6 likely move-up buyers identified via permit data (kitchen/bath remodels in starter homes 78745)\n\nFull list + contact data exported to spreadsheet.' },
        { id: 'task-8', task_type: 'email', frequency: 'biweekly', status: 'active', last_run: daysAgo(6), next_run: daysAhead(8), last_output: 'Subject: 5 homes you should be watching (off-MLS edition)\n\nHi {{first_name}},\n\nQuiet listings only — these aren\'t on Zillow yet:\n\n1. Tarrytown ranch on Bowman, $2.4M — coming next week\n2. Hyde Park bungalow on Avenue F, $1.275M — pocket listing\n3. Mueller phase 5, 4BR — pre-construction\n4. Bouldin reno on S 4th, $925K — early access only\n5. East Cesar Chavez, $625K — needs love but priced for it\n\nReply with the numbers you want details on. Sarah' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Mike Johnson', email: 'mike@jrealty.co', status: 'paid', created_at: daysAgo(120), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'Lisa Park', email: 'lisa@parkproperties.com', status: 'trial', created_at: daysAgo(8), trial_ends_at: daysAhead(34) },
        { id: 'ref-3', client_name: 'Carla Reyes', email: 'carla@austinhomesgroup.com', status: 'paid', created_at: daysAgo(180), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'David Bell', email: 'david@bellrealty.com', status: 'paid', created_at: daysAgo(60), referral_credit_awarded: true }
      ],
      chatTemplates: {
        social: 'New listing alert 🏡\n\n2418 Westover Rd | Tarrytown | $2,250,000\n5BR · 4BA classic Tarrytown brick on a quiet block, walkable to Lake Austin. Renovated kitchen, original oak floors, screened porch built for evening drinks.\n\nPrivate tours by appt — DM to book.',
        newsletter: 'Subject: This week in central Austin\n\nQuick read on the three pockets I watch closest:\n\nHyde Park — 4 new listings, 2 already pending after one weekend. Still moving fast under $1.5M.\nTarrytown — inventory up 12% MoM. First real buyer leverage in 18 months.\nMueller — phase 5 pre-sales open. Ping me if you want the floor plans.\n\nReply with questions. Always happy to dig in.\n\nSarah',
        blog_post: 'Why Tarrytown Inventory Is Finally Loosening (And What It Means for Buyers)\n\nFor 18 months, Tarrytown listings disappeared in a weekend. That\'s changing — and not because demand cooled. Here\'s what the April data is showing...',
        email: 'Subject: Following up — the Bouldin listing\n\nHi {{first_name}},\n\nWanted to circle back on 1804 S 5th. Inspection came back clean except for the foundation note we expected. Sellers signaled they\'d cover up to $8K in repairs.\n\nIf you\'re still interested, I think we have room. Want to hop on a 15-minute call this week?\n\nSarah',
        review_response: 'Hi {{name}} — thank you, this means a lot. Helping you find the right home in {{neighborhood}} was the easy part; you knew exactly what you wanted. Wishing you many happy years there. — Sarah',
        fallback: 'Got it — I can help with that. To make the output really sharp, can you give me the listing address (or topic), the audience (buyer / seller / past client), and what platform you\'re publishing on?'
      }
    },

    /* ============================================================
       2. PEST CONTROL — Lone Star Pest & Termite (north metro)
       ============================================================ */
    pest_control: {
      key: 'pest_control',
      email: 'pestcontrol@beacon.demo',
      password: 'demo',
      label: 'Pest Control',
      description: 'Lone Star Pest & Termite · Pflugerville',
      subscription: {
        id: 'demo-pest-001',
        email: 'pestcontrol@beacon.demo',
        client_name: 'Marcus Reyes',
        business_name: 'Lone Star Pest & Termite',
        industry: 'pest_control',
        plan: 'beacon',
        status: 'active',
        tokens_used: 142890,
        referral_code: 'LONESTAR-PEST',
        created_at: monthsAgo(11),
        current_period_end: daysAhead(11),
        token_reset_date: daysAhead(11)
      },
      chat: [
        { role: 'user', content: 'Write a Facebook post about scorpion season starting up', created_at: monthsAgo(6) },
        { role: 'assistant', type: 'social', content: '🦂 Scorpion season is here, Pflugerville.\n\nBy late April our techs see 3x the scorpion calls. They\'re coming inside hunting water — and the summer dry stretch hasn\'t even started.\n\nThe fix isn\'t just spraying. It\'s sealing entry points around your foundation, weather stripping doors, and treating the perimeter at a real depth (not the 6-inch band the big guys do).\n\nFree scorpion inspection this month. Drop your zip in the comments and we\'ll come out.', created_at: monthsAgo(6) },
        { role: 'user', content: 'Reply to a 1-star review claiming we missed scorpions on the second visit', created_at: monthsAgo(5) },
        { role: 'assistant', type: 'review_response', content: 'Hi Tracy — Marcus here, owner. I\'m really sorry your second visit didn\'t resolve it. Scorpions are the toughest pest we deal with — even the best treatment plan has a 2–3 visit ramp-up before harborage drops out.\n\nI just pulled your account. Looks like we treated perimeter + interior baseboards, but didn\'t do the attic dust application. That\'s on me — that should have been included for a Pflugerville home backing up to greenbelt. I\'d like to come back personally this week, no charge, and finish the job right.\n\nText me direct: 512-555-0188. — Marcus', created_at: monthsAgo(5) },
        { role: 'user', content: 'Email to commercial property managers about quarterly contracts', created_at: monthsAgo(4) },
        { role: 'assistant', type: 'email', content: 'Subject: Quarterly pest plan for {{property_name}} — quick proposal\n\nHi {{first_name}},\n\nMarcus from Lone Star Pest & Termite. We service 14 multifamily properties in the Pflugerville / Round Rock corridor and we\'re opening up Q3 capacity.\n\nWhat you get:\n• Quarterly perimeter + common-area treatment\n• 24/7 tenant call response (we handle the angry calls, you don\'t)\n• Termite inspection on every visit (no upcharge)\n• Bilingual techs, fully insured\n\nFlat $185/unit/year for 50+ unit properties. No long contract — month-to-month after first quarter.\n\nWant me to send a sample service report from one of our existing complexes?\n\nMarcus\n512-555-0188', created_at: monthsAgo(4) },
        { role: 'user', content: 'Blog post about why German roaches keep coming back even after spraying', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'blog_post', content: 'Why Your Roaches Keep Coming Back (Even After Pest Control)\n\nIf you\'re calling pest control every two months for the same German roach problem, you don\'t have a roach problem. You have a treatment problem.\n\nGerman roaches don\'t respond to perimeter sprays the way ants do. They live indoors, breed indoors, and survive on the crumbs and moisture inside your kitchen — which means treatment has to happen inside, with gel bait, not just chemical spray.\n\nHere\'s what most companies do wrong, and what actually works...\n\n1. Spray-only treatments scatter roaches but don\'t kill the colony. The egg cases (oothecae) are inside cabinets, behind appliances, in wall voids.\n\n2. Gel baiting with multiple active ingredients rotates pressure on the colony. We use 3 different baits across 4 visits.\n\n3. The first 30 days are a population crash, not a kill. You\'ll see more roaches before you see fewer.\n\nIf you\'ve treated 3+ times and they\'re still back, you\'re paying for the wrong service. Real cleanup takes 60–90 days and a baiting protocol — not a perimeter spray.', created_at: monthsAgo(3) },
        { role: 'user', content: 'Quick text-friendly mosquito barrier promo for May', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'social', content: 'Mosquitoes won. 🦟\n\nMay is when Pflugerville backyards become unlivable. Standing water from the spring rains + 80° humidity = breeding city.\n\nOur monthly mosquito barrier hits the underside of leaves where they rest. 30-day knockdown. $89/month, no contract.\n\nFirst spray free if you book before May 15.', created_at: monthsAgo(1) },
        { role: 'user', content: 'Email reminder for customers due for a quarterly visit', created_at: daysAgo(10) },
        { role: 'assistant', type: 'email', content: 'Subject: Your quarterly visit is up — let\'s book it\n\nHi {{first_name}},\n\nQuick note from Lone Star Pest. Your last service was {{last_service_date}}, which means your next quarterly is due in the next 2–3 weeks.\n\nReply to this email with the days that work for you (we\'ll bring our usual tech, {{tech_name}}), or just pick a slot on the booking link below. Most appointments take 35–45 minutes.\n\nAnything new since last visit? Let me know in your reply — we\'ll target it.\n\nThanks,\nMarcus', created_at: daysAgo(10) },
        { role: 'user', content: 'Termite warning post for spring swarm season', created_at: daysAgo(5) },
        { role: 'assistant', type: 'social', content: 'You probably already saw your first termite swarm of the year.\n\nIn central Texas, subterranean termites swarm March through May after warm rain. If you saw a black cloud of winged insects near a window — that\'s the warning shot.\n\nWhat to do this week:\n1. Walk your foundation. Look for mud tubes (pencil-thin dirt lines climbing the slab).\n2. Check window sills for shed wings. Termites drop their wings after swarming.\n3. Tap suspect wood with a screwdriver. Hollow = problem.\n\nFree inspection if you spot any of the above. We\'ll come out within 48 hours.', created_at: daysAgo(5) },
        { role: 'user', content: 'Text-message style message for a customer whose tech is running late', created_at: daysAgo(2) },
        { role: 'assistant', type: 'email', content: 'Hi {{first_name}}, Marcus from Lone Star Pest. Heads up that {{tech_name}} is running about 25 min behind schedule — previous appointment had a wasp nest situation that took longer than expected. He\'ll be there closer to {{updated_eta}}. Sorry for the shift. Reply NO if that no longer works and we\'ll reschedule.', created_at: daysAgo(2) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Direct, no-BS, slightly cowboy. We\'re a small operator competing with corporate franchises (ABC, Aptive). Lean into "we actually answer the phone" + "we live here too." Avoid corporate phrases ("solutions", "experience"). Talk like a tech who knows what he\'s doing, not a salesperson.' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'Quarterly residential general pest. Monthly mosquito barrier (April–October). Termite inspections + treatment (Termidor SC). Scorpion specialty treatment (perimeter + attic dust). Rodent exclusion + trapping. Wasp/hornet nest removal. WDI reports for real estate transactions. Commercial multifamily contracts.' },
        { id: 'doc-3', type: 'about', title: 'About the Company', content: 'Founded 2018 by Marcus Reyes. 4 trucks, 6 techs (5 bilingual). Service area: Pflugerville, Round Rock, Cedar Park, Leander, Hutto, north Austin (78727, 78758). 80% residential, 20% commercial multifamily. Owner-operated — Marcus runs route 1 himself.' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing', content: 'Quarterly residential general pest: $115/quarter (2,500 sqft and under), $145 (over). Initial visit double the quarterly. Mosquito monthly: $89. Termite treatment: avg $1,650 for full perimeter Termidor SC. Scorpion specialty: $245 first visit, $135 follow-ups. Rodent exclusion: priced per inspection.' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: How is this different from ABC/Aptive?\nA: We\'re local, we don\'t lock you into 12-month contracts, and Marcus answers his cell. Same chemicals, smaller margins.\n\nQ: Do treatments work the same day?\nA: Most things yes. Roaches and scorpions ramp up over 30 days because of egg cases. We tell customers up front so expectations match reality.\n\nQ: Pets/kids safe?\nA: Yes — we use bifenthrin and fipronil applied at label rates. Dry in 30 min on hard surfaces.' },
        { id: 'doc-6', type: 'about', title: 'Service Area Notes', content: 'Pflugerville: heavy scorpion activity in Falcon Pointe, Bohls Crossing, anything bordering greenbelt. Round Rock: rodent issues in older subdivisions (Round Rock West, Brushy Creek). Cedar Park: termite swarms peak earlier here than Pflugerville (mid-March vs late March). Leander: lots of new construction = ant pressure.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'ABC Home & Commercial Services', url: 'https://abchomeandcommercial.com', last_checked: daysAgo(2), summary: 'The 800-pound gorilla. Massive ad budget on Spectrum cable + Google. Heavy emphasis on "78 years in Texas" trust messaging. Their pricing is 20–30% above ours but customers pay for the brand. Recently launched a "rodent + termite combo" bundle that we should consider matching. Their weakness: contractor-quality techs, slow response times outside business hours.' },
        { id: 'comp-2', name: 'Aptive Environmental', url: 'https://goaptive.com', last_checked: daysAgo(3), summary: 'D2D sales operation that hits Pflugerville hard every spring. Aggressive contracts (12 months, $50 cancel fee). Customer reviews on BBB are brutal — 2.4 stars. Big opportunity to position against them: "no door-to-door pressure, no contract trap, local owner you can text." Our recent ads using "no D2D" language are converting at 3.2% vs 1.8% baseline.' },
        { id: 'comp-3', name: 'Bug Master Pest Control', url: 'https://bugmasterpest.com', last_checked: daysAgo(1), summary: 'Closer match to our positioning — local, family operated, 30 years. They run a strong Google Local presence (4.8 stars, 1,400 reviews). Recently added scorpion specialty service which is exactly our niche differentiator. Their pricing is comparable but they don\'t advertise it. We should keep our transparent pricing on the website as a wedge.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(5), next_run: daysAhead(2), last_output: 'You probably already saw your first termite swarm of the year.\n\nIn central Texas, subterranean termites swarm March through May after warm rain. If you saw a black cloud of winged insects near a window — that\'s the warning shot.\n\nFree inspection if you spot any of the above. We\'ll come out within 48 hours.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(12), next_run: daysAhead(18), last_output: 'Subject: April pest brief — what we\'re seeing\n\nHey neighbors,\n\nQuick rundown of what techs flagged this month:\n\n• Scorpion calls up 38% over March. Falcon Pointe and Bohls Crossing are the hottest pockets.\n• Mosquito breeding sites finally drying — but late spring rains will reset things in 2 weeks.\n• Termite swarms peaked the week of April 8. If you didn\'t see one, that\'s normal — only 1 in 4 colonies swarm visibly.\n\nIf you\'ve been on the fence about a quarterly plan, May is the right month to start — gets you ahead of summer scorpion peak.\n\nMarcus' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(7), last_output: 'How to Read a Termite Inspection Report (And Catch the Things They Skip)\n\nMost termite reports are 4 pages of "no visible activity at this time." That language sounds clean — but it doesn\'t mean what most homeowners think it means.\n\nHere\'s how to actually read your inspection report and ask the right follow-up questions...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(4), last_output: 'Hi Tracy — Marcus here, owner. I\'m really sorry your second visit didn\'t resolve it. I\'d like to come back personally this week, no charge, and finish the job right. Text me direct: 512-555-0188. — Marcus' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan:\n\n• ABC: launched "rodent + termite combo" — bundled pricing. Worth matching.\n• Aptive: D2D activity reported in Falcon Pointe (3 customers messaged us). Posting our "no D2D" ads now.\n• Bug Master: added scorpion specialty page. Their messaging mirrors ours. We need to lock in scorpion SEO before they catch up.' },
        { id: 'task-6', task_type: 'email', frequency: 'weekly', status: 'active', last_run: daysAgo(10), next_run: daysAhead(4), last_output: 'Subject: Your quarterly visit is up — let\'s book it\n\nHi {{first_name}}, your last service was {{last_service_date}}, which means your quarterly is due in the next 2–3 weeks. Reply with days that work, or pick a slot on the booking link.' },
        { id: 'task-7', task_type: 'review_request', frequency: 'weekly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(3), last_output: 'Subject: Quick favor — would mean a lot\n\nHi {{first_name}}, hope the {{pest_treated}} treatment cleared things up. If we did good work, a Google review goes a long way for a small operation like ours. Takes 30 seconds: {{review_link}}. Thanks. — Marcus' },
        { id: 'task-8', task_type: 'social_post', frequency: 'biweekly', status: 'paused', last_run: daysAgo(28), next_run: daysAhead(14), last_output: 'Paused for May — focusing on quarterly cadence weekly + mosquito promo posts only.' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'David Bohls (HOA mgr)', email: 'david@bohlshoa.com', status: 'paid', created_at: daysAgo(150), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'A&M Property Mgmt', email: 'service@ampropertymgmt.com', status: 'paid', created_at: daysAgo(95), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Jason Liu', email: 'jason@liuhomes.com', status: 'paid', created_at: daysAgo(70), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Maria Gonzalez', email: 'maria.g@example.com', status: 'trial', created_at: daysAgo(11), trial_ends_at: daysAhead(31) }
      ],
      chatTemplates: {
        social: '🦂 Scorpion season is here, Pflugerville.\n\nBy late April our techs see 3x the scorpion calls. They\'re coming inside hunting water — and the summer dry stretch hasn\'t even started.\n\nThe fix isn\'t just spraying. It\'s sealing entry points, weather stripping doors, and treating the perimeter at a real depth.\n\nFree scorpion inspection this month. Drop your zip below.',
        newsletter: 'Subject: This month\'s pest brief\n\nQuick rundown of what techs flagged this month:\n\n• Scorpion calls up 38% over last month\n• Mosquito breeding sites drying — reset coming in 2 weeks\n• Termite swarms peaked\n\nIf you\'ve been on the fence about quarterly, this is the month.\n\nMarcus',
        blog_post: 'Why Your Roaches Keep Coming Back (Even After Pest Control)\n\nIf you\'re calling pest control every two months for the same German roach problem, you don\'t have a roach problem. You have a treatment problem...',
        email: 'Subject: Your quarterly visit is up — let\'s book it\n\nHi {{first_name}}, your last service was {{last_service_date}}. Reply with days that work for you, or pick a slot on the booking link. Most appointments take 35–45 min.\n\nMarcus',
        review_response: 'Hi {{name}} — Marcus here, owner. Really appreciate the kind words. {{tech_name}} mentioned you were dealing with {{pest}} for a while before calling us. Glad we got it knocked down. If anything pops back up, text me direct anytime. — Marcus',
        fallback: 'Got it. To make this useful, tell me the pest, the location (interior vs exterior), and whether this is for a customer follow-up or a marketing post.'
      }
    },

    /* ============================================================
       3. CLEANING — Capital Clean Co. (Maya Thompson)
       ============================================================ */
    cleaning: {
      key: 'cleaning',
      email: 'cleaning@beacon.demo',
      password: 'demo',
      label: 'Cleaning',
      description: 'Capital Clean Co. · East Austin',
      subscription: {
        id: 'demo-clean-001',
        email: 'cleaning@beacon.demo',
        client_name: 'Maya Thompson',
        business_name: 'Capital Clean Co.',
        industry: 'cleaning',
        plan: 'beacon',
        status: 'active',
        tokens_used: 96120,
        referral_code: 'CAPITAL-CLEAN',
        created_at: monthsAgo(7),
        current_period_end: daysAhead(16),
        token_reset_date: daysAhead(16)
      },
      chat: [
        { role: 'user', content: 'Write an Instagram post about our spring deep clean special', created_at: monthsAgo(4) },
        { role: 'assistant', type: 'social', content: 'Spring clean season is here. ✨\n\nFor March + April only:\n• Whole-house deep clean\n• Inside ovens, fridge, microwave\n• Window tracks + baseboards\n• Cabinet faces wiped + degreased\n\n$30 off every package booked before April 1. Mention "BLOOM" at booking.\n\nWe service Westlake, Tarrytown, Mueller, and most of central Austin. DM for a quote — flat-rate, no surprises.', created_at: monthsAgo(4) },
        { role: 'user', content: 'Blog post about Airbnb turnover cleaning', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'blog_post', content: '5-Star Airbnb Turnovers: What Hosts Get Wrong (And What We Actually Do)\n\nIf you\'re hosting in central Austin — South Congress, East 6th, Mueller, or anywhere walkable — your Airbnb stays full only as long as your reviews stay above 4.8. And the #1 review-tanker isn\'t the price. It\'s the cleaning.\n\nHere\'s what most cleaning companies miss on turnovers, and what we do differently...\n\n1. Linen rotation isn\'t cleaning. We bring fresh sets every visit and take used ones to be laundered offsite. Same-day laundering on-site is why hosts get "sheets felt damp" reviews.\n\n2. The 12-point bathroom audit. Hair on shower floor, fingerprints on faucet, dust on light fixture, water spots on glass — these are the things that drop a 5 to a 4. Our checklist enforces all 12.\n\n3. We restage. Towel folds, throw pillow placement, coffee setup — we leave the unit looking like the listing photos. Hosts tell us it cuts complaints by 40%.\n\nIf you\'re hosting and your reviews dipped below 4.8 in the last 60 days, the issue is almost always cleaning.', created_at: monthsAgo(3) },
        { role: 'user', content: 'Reply to a 5-star Yelp review from a Westlake client', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'review_response', content: 'Sarah, thank you so much! Your house is one of our team\'s favorite Tuesdays — that hardwood through the kitchen always makes the after photo look effortless. Tell Pip we\'ll bring more crumbs from snacks next time. 🐶 — Maya & the team', created_at: monthsAgo(2) },
        { role: 'user', content: 'Email to current weekly clients introducing recurring deep clean tier', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'email', content: 'Subject: A new option for our weekly clients\n\nHi {{first_name}},\n\nMaya here. After a few client requests, we\'re launching a new tier called "Weekly + Deep Rotate." Same weekly cadence, same crew — but every 4 weeks one room gets a true deep clean (oven, fridge interior, baseboards, vents).\n\nFor most homes, that means rotating through master bath, kitchen, kids\' rooms, and main living area on a monthly cycle. By month end you\'ve effectively had a full deep clean baked into your normal schedule, no scheduling headache.\n\nUpgrade is $20/visit. No commitment — try it for a month and tell me what you think.\n\nReply YES and I\'ll add it to your next visit.\n\nMaya', created_at: monthsAgo(1) },
        { role: 'user', content: 'Quick post about move-out cleans for the May leasing rush', created_at: daysAgo(15) },
        { role: 'assistant', type: 'social', content: 'May 31 is the busiest day in Austin cleaning. 📦\n\nIf you\'re moving out of a lease this spring, book your move-out clean now. Last year we turned away 40+ requests in the final week of May.\n\nWe handle full-deposit-back cleans:\n✔ Inside oven, fridge, washer/dryer\n✔ Cabinet interiors\n✔ Baseboards, window tracks, blinds\n✔ Garage sweep + wipe\n\nFlat-rate quote in 1 hour. DM us your floor plan.', created_at: daysAgo(15) },
        { role: 'user', content: 'Email reminder about appointment for tomorrow', created_at: daysAgo(8) },
        { role: 'assistant', type: 'email', content: 'Hi {{first_name}} — quick reminder that your weekly clean is on for tomorrow at {{time}}. Your usual crew ({{tech_names}}) will be there. Anything specific you\'d like us to focus on this week? Reply with notes — kids\' rooms always extra bonkers, fridge needing a hit, etc. — and we\'ll target it. Maya', created_at: daysAgo(8) },
        { role: 'user', content: 'Holiday hosting prep promo for early November', created_at: daysAgo(3) },
        { role: 'assistant', type: 'social', content: 'Hosting Thanksgiving? Let us handle the part nobody wants to do. 🦃\n\nPre-holiday deep clean — the Friday or Saturday before — covers:\n• Guest bedrooms turned + linen-fresh\n• Kitchen prep zones degreased\n• Bathrooms guest-ready\n• Floors that won\'t embarrass you\n\nBook by Nov 10 for guaranteed pre-Thanksgiving slot. We always sell out by then.', created_at: daysAgo(3) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Friendly, warm, slightly playful — like a coworker who happens to clean your house. We\'re not corporate ("our valued clients"), we\'re neighborly. Use first names. Reference specific details — the dog, the hardwood, the kid\'s room. Avoid jargon ("EPA-compliant"); say "products that won\'t make your kid sneeze."' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'Weekly recurring residential cleaning. Biweekly + monthly options. Move-out / move-in deep cleans (deposit-back guaranteed). Airbnb / short-term turnovers (24/7 availability). Post-construction cleans. Holiday hosting prep packages. One-time deep cleans.' },
        { id: 'doc-3', type: 'about', title: 'About Capital Clean Co.', content: 'Founded 2022 by Maya Thompson. 6 cleaners, 2 SUVs. Service area: central + west Austin (Westlake, Tarrytown, Mueller, North Loop, East Austin, Bouldin, Lakeway). Team is 100% W2 employees (not 1099) — better turnover, better quality. Insured + bonded.' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing', content: 'Weekly recurring: $135 / 1500sqft, $185 / 2500sqft, $245 / 3500+sqft. Biweekly: +15%. Monthly: +30%. One-time deep: 1.5x weekly rate. Move-out: $295 / 1500sqft, $395 / 2500sqft. Airbnb turnover: $95–145 depending on size. No hidden fees.' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: Same crew every week?\nA: Yes — we assign 2 cleaners to your house and they stay your team unless you ask for a change.\n\nQ: Bring your own products?\nA: Yes. We use Method, Mrs. Meyers, and Bona for hardwoods. Eco-friendly. Pet/kid safe. We can match a specific product if you have allergies.\n\nQ: What about during vacation?\nA: Skip a week with 48 hr notice — no charge.' },
        { id: 'doc-6', type: 'about', title: 'Service Area', content: 'Central Austin sweet spot: 78751 (Hyde Park), 78703 (Tarrytown/Clarksville), 78704 (Bouldin/Travis Heights), 78723 (Mueller), 78702 (East Austin). Western edge: Westlake, Lakeway. Will not service: south of William Cannon, anything past Manor Road east, Round Rock.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Maid Brigade Austin', url: 'https://maidbrigade.com', last_checked: daysAgo(2), summary: 'Big franchise. Strong Google presence (4.6 stars, 700+ reviews). Their pricing runs 10–15% above ours. Marketing leans on "green" certifications which we don\'t advertise. Recently launched a "subscription cleaning" model with prepaid 12-week packages — worth considering as a retention play. Weakness: 1099 cleaner model means inconsistent crews.' },
        { id: 'comp-2', name: 'The Cleaning Authority', url: 'https://thecleaningauthority.com', last_checked: daysAgo(3), summary: 'Heavily focused on detailed checklists and "rotating focus rooms" — very similar to our new Weekly + Deep Rotate. They market the system as proprietary. We launched ours first in our local market but they have brand recognition. Recommend pushing the "same crew every visit" angle — they rotate teams which is a real weakness.' },
        { id: 'comp-3', name: 'Two Maids Austin', url: 'https://twomaidsaustin.com', last_checked: daysAgo(1), summary: 'Aggressive on Yelp ads + Google Local Service ads. Their differentiator is "pay for performance" pricing — clients rate cleaners and tip varies. Reviews are mixed (3.9 stars). Could position against them: "we don\'t make our cleaners chase tips, we pay them well, you get the same crew." Strong message for word-of-mouth markets like Tarrytown / Westlake.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(4), last_output: 'May 31 is the busiest day in Austin cleaning. 📦\n\nIf you\'re moving out of a lease this spring, book your move-out clean now. Last year we turned away 40+ requests in the final week of May.\n\nFlat-rate quote in 1 hour. DM us your floor plan.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(11), next_run: daysAhead(19), last_output: 'Subject: April recap + a small change for May\n\nHi friends,\n\nQuick update — we hit 162 weekly homes this month, up from 134 in January. Thank you for telling neighbors about us. Your referrals literally are the business.\n\nOne small change for May: we\'re adding a 30-minute "linen + restock" mini-visit option for hosts who don\'t need a full turnover. Booking now.\n\nIf you skipped weekly during spring break, your slot is still yours — just text the team when you\'re ready.\n\nMaya' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(6), next_run: daysAhead(8), last_output: '5-Star Airbnb Turnovers: What Hosts Get Wrong (And What We Actually Do)\n\nIf you\'re hosting in central Austin — South Congress, East 6th, Mueller, or anywhere walkable — your Airbnb stays full only as long as your reviews stay above 4.8...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Sarah, thank you so much! Your house is one of our team\'s favorite Tuesdays — that hardwood through the kitchen always makes the after photo look effortless. Tell Pip we\'ll bring more crumbs from snacks next time. — Maya & the team' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan:\n\n• Maid Brigade: launched 12-week prepaid subscription. Worth piloting our own version.\n• Cleaning Authority: still pushing "rotating focus rooms" — we beat them to the local market with Weekly + Deep Rotate.\n• Two Maids: heavy on Google Local Service ads. Our organic ranking is solid but we should test LSA on move-out keyword.' },
        { id: 'task-6', task_type: 'email', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Hi {{first_name}} — quick reminder that your weekly clean is on for tomorrow at {{time}}. Your usual crew ({{tech_names}}) will be there. Anything specific you\'d like us to focus on this week?' },
        { id: 'task-7', task_type: 'review_request', frequency: 'biweekly', status: 'active', last_run: daysAgo(8), next_run: daysAhead(6), last_output: 'Subject: 30 seconds for Maya?\n\nHi {{first_name}}, hope the deep clean before {{event}} hit the spot. If we did good work, a quick Google review goes a long way for our team — they all read them. Link: {{review_link}}. Thanks. — Maya' },
        { id: 'task-8', task_type: 'social_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(13), next_run: daysAhead(1), last_output: 'Before / after from a deep clean in Mueller this week. The kitchen had a full bake-marathon over Easter and the oven came back like new.\n\nIf your oven hasn\'t had a real clean in 6+ months, you can probably smell the difference once it\'s done.' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Travis Heights HOA', email: 'admin@travisheightshoa.org', status: 'paid', created_at: daysAgo(110), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'Jamie & Erin Goss', email: 'jamie@gosshome.com', status: 'paid', created_at: daysAgo(75), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Wells Properties', email: 'kim@wellsrental.co', status: 'paid', created_at: daysAgo(40), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Hannah Lee', email: 'hlee.atx@example.com', status: 'trial', created_at: daysAgo(6), trial_ends_at: daysAhead(36) }
      ],
      chatTemplates: {
        social: 'Spring clean season is here. ✨\n\nFor March + April only:\n• Whole-house deep clean\n• Inside ovens, fridge, microwave\n• Window tracks + baseboards\n• Cabinet faces wiped + degreased\n\n$30 off every package booked before April 1. DM for a quote.',
        newsletter: 'Subject: This month at Capital Clean\n\nHi friends,\n\nQuick update — we hit 162 weekly homes this month. Your referrals literally are the business.\n\nOne small change for the month ahead...\n\nMaya',
        blog_post: '5-Star Airbnb Turnovers: What Hosts Get Wrong\n\nIf you\'re hosting in central Austin, your bookings stay full only as long as your reviews stay above 4.8. The #1 review-tanker isn\'t the price — it\'s the cleaning...',
        email: 'Hi {{first_name}} — quick reminder that your weekly clean is on for {{day}} at {{time}}. Your usual crew will be there. Any focus areas this week? Reply and we\'ll target them. — Maya',
        review_response: '{{name}}, thank you so much! Your house is one of our team\'s favorite stops. Glad we could help before {{event}}. — Maya & the team',
        fallback: 'Got it. Tell me the audience (existing client / lead / past client), the platform (IG / email / blog), and the angle (promotion / education / nurture) and I\'ll draft something tight.'
      }
    },

    /* ============================================================
       4. PLUMBING — Texas Trusted Plumbing (Eddie Morales)
       ============================================================ */
    plumber: {
      key: 'plumber',
      email: 'plumber@beacon.demo',
      password: 'demo',
      label: 'Plumbing',
      description: 'Texas Trusted Plumbing · Austin metro',
      subscription: {
        id: 'demo-plumb-001',
        email: 'plumber@beacon.demo',
        client_name: 'Eddie Morales',
        business_name: 'Texas Trusted Plumbing',
        industry: 'plumbing',
        plan: 'pro',
        status: 'active',
        tokens_used: 287510,
        referral_code: 'TX-TRUSTED-PLB',
        created_at: monthsAgo(10),
        current_period_end: daysAhead(8),
        token_reset_date: daysAhead(8)
      },
      chat: [
        { role: 'user', content: 'Write a Facebook post about freeze prep before next week\'s cold front', created_at: monthsAgo(5) },
        { role: 'assistant', type: 'social', content: '❄️ Freeze warning Tuesday night. Read this before bed.\n\nIf you\'re a homeowner who lived through Uri in Feb 2021, you know what slab leaks look like. Don\'t go to bed without doing these 4 things:\n\n1. Disconnect outdoor hoses. Foam-cover every hose bib.\n2. Open cabinet doors under sinks on exterior walls.\n3. Drip a pencil-thin stream from one faucet on each side of the house.\n4. Locate your shutoff valve. Test that it actually works (most don\'t after 10+ years).\n\nWe\'re running a $59 freeze-readiness check this week — we\'ll inspect shutoffs, attic pipes, and hose bibs in under 30 minutes. Better than a $4,000 repipe in March.\n\nText "FREEZE" to 512-555-0177 to book.', created_at: monthsAgo(5) },
        { role: 'user', content: 'Email to past customers about water heater age', created_at: monthsAgo(4) },
        { role: 'assistant', type: 'email', content: 'Subject: Your water heater is older than you think\n\nHi {{first_name}},\n\nQuick check-in. Per our records, your water heater was installed in {{year_installed}} — which makes it {{age}} years old.\n\nThe average gas water heater fails between 8–12 years. Tank water heaters don\'t leak slowly — they fail catastrophically (50 gallons of water on your floor at 2 AM).\n\nIf you\'re sitting on a 10+ year old tank, two questions to think about:\n\n1. Have you noticed warm-water inconsistency or rust-tinted water? Both are signs the anode rod is gone.\n2. Have you considered upgrading to a tankless? Endless hot water, 18-year lifespan, qualifies for federal tax credits this year.\n\nReply if you want me to swing by for a 15-minute inspection. No upsell — just a real opinion on whether to replace now or wait.\n\nEddie\n512-555-0177', created_at: monthsAgo(4) },
        { role: 'user', content: 'Blog post about slab leak warning signs', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'blog_post', content: 'How to Spot a Slab Leak in Your Austin Home Before It Costs You $15,000\n\nIf you live in Austin and your home is on a concrete slab (most homes built after 1960 are), you have a 1-in-5 chance of dealing with a slab leak in your lifetime. The challenging part isn\'t fixing it — it\'s catching it before the foundation cracks or the flooring is destroyed.\n\nHere are the 6 warning signs that mean you should call a plumber the same day:\n\n1. Unexplained water bill spike. A 30%+ jump month-over-month with no usage change is the canary in the coal mine.\n\n2. Warm spots on the floor. If your tile or hardwood feels warm in random areas, you have a hot-water-line slab leak.\n\n3. Sound of running water with everything off. Stand still in your home at 2 AM. If you hear running water, you have a leak.\n\n4. Cracks in drywall or tile grout. Slow leaks shift the foundation.\n\n5. Mold or mildew smell with no visible source. Water under the slab feeds mold growth at the wall base.\n\n6. Decreased water pressure. The pressure goes somewhere — and "somewhere" is under your slab.\n\nIf you have 2 or more of these, call any qualified plumber (us or otherwise) within 48 hours. Slab leaks compound fast.', created_at: monthsAgo(3) },
        { role: 'user', content: 'Reply to a 5-star review from a tankless install', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'review_response', content: 'Mike — appreciate the time you took to write this. Our crew (Tony + Carlos) said the install was tight quarters but the pre-existing gas line was actually in great shape, which sped things up. Glad the tankless is hitting hot water faster than the old tank ever did. Any callbacks on warranty in the next 12 months — direct line, not the front desk: 512-555-0177. — Eddie', created_at: monthsAgo(2) },
        { role: 'user', content: 'Quick post about hard water in Austin', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'social', content: 'Austin water hardness: 200+ ppm. 💧\n\nFor reference, "soft water" is under 60. Austin is borderline "very hard."\n\nWhat that does to your house over 5 years:\n• Cuts water heater life by 30–40%\n• Clogs faucet aerators (the white crust)\n• Spots glassware in the dishwasher\n• Builds scale inside pipes — restricts flow\n\nWhole-house softener install is $2,800–$4,200 depending on system. Pays for itself in 4 years on water heater life alone.\n\nFree hardness test if you book any service this month.', created_at: monthsAgo(1) },
        { role: 'user', content: 'Email about a finished slab leak repair', created_at: daysAgo(14) },
        { role: 'assistant', type: 'email', content: 'Subject: Your slab leak repair is complete — what we found\n\nHi {{first_name}},\n\nWrapped the slab leak repair at {{address}} this afternoon. Quick summary so you have the record:\n\n• Leak located: 14 ft from kitchen wall under main living room\n• Cause: pinhole in 3/4" copper (typical Austin water chemistry, 18-year-old line)\n• Repair: re-routed hot water line through attic, sealed slab penetration, pressure tested\n• Drying: dehumidifier left on-site for 48 hours\n\nNo flooring damage — caught it early because of the warm-floor flag you noticed. Glad you called.\n\nInvoice attached. Warranty: 5 years on the re-route work. Reach out direct if anything off.\n\nEddie', created_at: daysAgo(14) },
        { role: 'user', content: 'Drip campaign step 2 for someone who got a quote but didn\'t book', created_at: daysAgo(7) },
        { role: 'assistant', type: 'email', content: 'Subject: No pressure — just thinking through your water heater\n\nHi {{first_name}},\n\nNo agenda here. I sent over the tankless quote about 10 days ago and haven\'t heard back, which is totally fine.\n\nI know tankless is a $4K decision and most people sit with it for a while. Two things worth knowing if you\'re still chewing on it:\n\n1. The federal tax credit for high-efficiency tankless ($600 in 2026) drops back to $300 next year.\n2. We\'re running a "skip the install fee" promo for May only — saves you $295.\n\nNeither of these are reasons to buy. Just wanted you to have the full picture so the decision\'s not happening in the dark.\n\nIf you want a 10-minute call to think through the math — happy to do it free.\n\nEddie', created_at: daysAgo(7) },
        { role: 'user', content: 'Quick text-style follow-up after a service call', created_at: daysAgo(2) },
        { role: 'assistant', type: 'email', content: 'Hi {{first_name}}, Eddie here. Wanted to make sure the disposal is running quiet and not leaking under the sink — sometimes the new install needs a tightening pass after 24 hours of use. Reply with one of: ALL GOOD / DRIP / NOISE and I\'ll respond direct. — Eddie', created_at: daysAgo(2) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Confident, direct, expert. We\'re master plumbers, not salespeople. Don\'t soft-sell — give the actual diagnosis and the actual cost. Talk like the guy who\'s been doing this 22 years and has seen everything. Avoid corporate phrases. Avoid emoji except occasionally for warnings (❄️, 💧). Use real numbers, real ages, real pressures.' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'Emergency leak repair (24/7). Slab leak detection + re-route. Water heater repair, replacement, tankless conversion. Whole-house repipe (PEX). Drain cleaning + hydro-jetting. Sewer line camera inspection + repair. Water softener installation. Faucet, disposal, toilet replacement. Backflow testing + repair. Commercial pre-treatment for restaurants.' },
        { id: 'doc-3', type: 'about', title: 'About Texas Trusted Plumbing', content: 'Founded 2017 by Eddie Morales (master plumber, 22 years). 7 trucks, 9 plumbers (4 master, 5 journeymen). Service area: all of Austin metro + Round Rock + Cedar Park + Pflugerville. Licensed, bonded, insured. Veteran-owned (Eddie was Navy CEC). Open 24/7 for emergencies — no answering service.' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing', content: 'Trip charge: $79 (waived if work performed). Diagnostics: included with trip. Common services: faucet replace $245, garbage disposal $295, toilet replace $395, standard tank water heater $1,650 install + tank, tankless gas $4,200 average. Slab leak detection: $295. Re-route: $1,200–$2,800. Whole-house repipe: $6,800–$12,500.' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: Is your trip charge applied to the work?\nA: Yes. If we do the job, you pay only the job cost.\n\nQ: Do you charge for after-hours?\nA: $145 surcharge after 8 PM and weekends. Emergencies always answered.\n\nQ: Do you give estimates over the phone?\nA: For common items yes. For diagnostics-required work (leaks, no hot water) we have to see it.' },
        { id: 'doc-6', type: 'about', title: 'Service Area + Specialties', content: 'Heavy in: Westlake, Tarrytown, Lakeway, Mueller, Round Rock. Specialty: slab leak detection (we have the only certified leak-detection tech in north Austin under 5-yr warranty). Tankless gas conversions: top 3 installer in Austin metro per Rinnai distributor numbers.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Radiant Plumbing & Air Conditioning', url: 'https://radiantplumbing.com', last_checked: daysAgo(1), summary: 'The market leader. Fleet of 30+ trucks. Heavy radio + TV ad spend. Premium pricing — about 25–35% above ours on common services. Their differentiator is "premium experience" (uniformed techs, shoe covers, follow-up calls). Customer reviews are very strong (4.8 stars, 5,000+). Recently bundled HVAC + plumbing under one membership ($24/month) which is hurting our maintenance contract revenue. Should respond with a plumbing-only membership at $14/month.' },
        { id: 'comp-2', name: 'Stan\'s Heating Air Plumbing & Electric', url: 'https://stansac.com', last_checked: daysAgo(2), summary: 'Stan\'s is HVAC-first, plumbing-second. Strong brand recognition (60+ years in Austin). They\'re aggressive on Google Local Service ads — outranking us on "Austin plumber" searches. Their plumbing pricing is high. They struggle with technical-heavy work like slab leaks (referrals come our way often). Opportunity: position on technical depth + slab leak specialty.' },
        { id: 'comp-3', name: 'Daniel\'s Plumbing & Air Conditioning', url: 'https://danielsplumbingandac.com', last_checked: daysAgo(3), summary: 'Closer match to our positioning. Family-owned, similar size. They run smart Facebook ad campaigns targeting freeze-prep season — heavy lift in January / February. Their website lacks the technical depth ours has (we have detailed slab leak + tankless content; they don\'t). Maintain SEO advantage on technical keywords.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Austin water hardness: 200+ ppm. 💧\n\nFor reference, "soft water" is under 60. Austin is borderline "very hard."\n\nWhole-house softener install is $2,800–$4,200 depending on system. Pays for itself in 4 years on water heater life alone.\n\nFree hardness test if you book any service this month.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(8), next_run: daysAhead(22), last_output: 'Subject: Spring plumbing brief — what we\'re seeing\n\nHi friends,\n\nQuick rundown:\n\n• Water bill spikes are up 18% in customer service calls (mostly outdoor irrigation leaks after the dry stretch).\n• Tankless conversions: April is our highest-volume month historically. Federal tax credit at $600 makes the math work.\n• Reminder: Texas freeze tax credit forms for 2024 freeze repairs are due May 15.\n\nReply if you want me to flag your install date for warranty reminders.\n\nEddie' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(5), next_run: daysAhead(9), last_output: 'How to Spot a Slab Leak in Your Austin Home Before It Costs You $15,000\n\nIf you live in Austin and your home is on a concrete slab, you have a 1-in-5 chance of dealing with a slab leak in your lifetime. The challenging part isn\'t fixing it — it\'s catching it before the foundation cracks...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(4), last_output: 'Mike — appreciate the time you took to write this. Our crew (Tony + Carlos) said the install was tight quarters but the pre-existing gas line was actually in great shape, which sped things up. — Eddie' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan:\n\n• Radiant: bundled membership now hurting maintenance contracts. Recommend $14/month plumbing-only.\n• Stan\'s: outranking us on "Austin plumber" LSA. Need to add LSA budget.\n• Daniel\'s: ramping freeze-prep social. Pre-empt with our technical content (slab + tankless).' },
        { id: 'task-6', task_type: 'outbound_sequence', frequency: 'weekly', status: 'active', last_run: daysAgo(0), next_run: daysAhead(7), last_output: 'B2B outbound: commercial multifamily property managers in 78758 / 78727. Pitching grease trap + backflow service contracts (we\'re under-utilized commercial). 12 emails sent this week, 3 replies.' },
        { id: 'task-7', task_type: 'lead_research', frequency: 'weekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(4), last_output: 'Weekly lead research:\n• 22 homes in Westlake / Tarrytown with permits filed for kitchen remodels (likely tankless candidates)\n• 14 commercial restaurants opening within 90 days (grease trap install opportunity)\n• 8 expired-warranty water heaters from our own database (8–10 yr old installs)' },
        { id: 'task-8', task_type: 'email', frequency: 'biweekly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(7), last_output: 'Drip step 2 for unconverted quotes:\n\nSubject: No pressure — just thinking through your water heater\n\nHi {{first_name}}, no agenda. I sent over the tankless quote 10 days ago. Two things worth knowing: federal tax credit drops next year, and we\'re running "skip the install fee" through May. — Eddie' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Pinnacle Property Mgmt', email: 'maint@pinnacleatx.com', status: 'paid', created_at: daysAgo(160), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'Radner Construction', email: 'jeff@radnerbuild.com', status: 'paid', created_at: daysAgo(85), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Westlake Realty Partners', email: 'jenna@westlakerp.com', status: 'paid', created_at: daysAgo(50), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Greg Holm', email: 'greg.holm@example.com', status: 'paid', created_at: daysAgo(20), referral_credit_awarded: true },
        { id: 'ref-5', client_name: 'Beth Carrera', email: 'beth.c@example.com', status: 'trial', created_at: daysAgo(5), trial_ends_at: daysAhead(37) }
      ],
      chatTemplates: {
        social: '❄️ Freeze warning Tuesday night. Read this before bed.\n\nIf you\'re a homeowner who lived through Uri in Feb 2021, you know what slab leaks look like. Don\'t go to bed without doing these 4 things:\n\n1. Disconnect outdoor hoses. Foam-cover hose bibs.\n2. Open cabinets under sinks on exterior walls.\n3. Drip a pencil-thin stream from one faucet on each side.\n4. Locate your shutoff valve. Test it.\n\nText "FREEZE" to 512-555-0177 to book a $59 readiness check.',
        newsletter: 'Subject: This month at Texas Trusted Plumbing\n\nQuick rundown:\n\n• Water bill spikes up 18% in service calls\n• Tankless conversions: highest-volume month historically\n• Texas freeze tax credit forms due May 15\n\nReply if you want install dates flagged for warranty reminders.\n\nEddie',
        blog_post: 'How to Spot a Slab Leak in Your Austin Home Before It Costs You $15,000\n\nIf you live in Austin and your home is on a concrete slab, you have a 1-in-5 chance of dealing with a slab leak in your lifetime...',
        email: 'Subject: Your water heater is older than you think\n\nHi {{first_name}}, your water heater was installed in {{year}}. The average tank fails between 8–12 years. Reply if you want me to swing by for a 15-min inspection. No upsell. — Eddie',
        review_response: '{{name}} — appreciate this. Our crew said it was a clean job. Direct line for any callbacks: 512-555-0177. — Eddie',
        fallback: 'Tell me the situation: emergency vs. scheduled, residential vs. commercial, and what platform (FB / email / blog / review reply) and I\'ll draft something direct.'
      }
    },

    /* ============================================================
       5. RESTAURANT — Mariposa Taqueria (Carmen Velasco, East Austin)
       ============================================================ */
    restaurant: {
      key: 'restaurant',
      email: 'restaurant@beacon.demo',
      password: 'demo',
      label: 'Restaurant',
      description: 'Mariposa Taqueria · East Austin',
      subscription: {
        id: 'demo-rest-001',
        email: 'restaurant@beacon.demo',
        client_name: 'Carmen Velasco',
        business_name: 'Mariposa Taqueria',
        industry: 'restaurant',
        plan: 'beacon',
        status: 'active',
        tokens_used: 158300,
        referral_code: 'MARIPOSA-TAQ',
        created_at: monthsAgo(9),
        current_period_end: daysAhead(13),
        token_reset_date: daysAhead(13)
      },
      chat: [
        { role: 'user', content: 'Write an Instagram post for SXSW week — what we\'re running', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'social', content: 'SXSW week. Mariposa is open extended hours. 🦋\n\nMar 11–17 | 7 AM – 1 AM nightly\n\nSpecials all week:\n• Breakfast tacos by the dozen for film badges (use code FILM12)\n• $5 al pastor street tacos all afternoon, 2–5 PM\n• Late-night menu after 10 PM — barbacoa, lengua, nopales\n\nWe\'re 4 blocks off the convention center on 12th & Chicon. Walk-ins only — no reservations during festival.\n\nSee you in line. 💛', created_at: monthsAgo(2) },
        { role: 'user', content: 'Reply to a 5-star Yelp review from a regular', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'review_response', content: 'Damon — gracias amigo. Mama Velasco saw your review and said "tell him I knew he\'d order the cochinita again." She remembers every regular by what they order. Bring the kids in this weekend — we\'re doing the kids\' tortilla-pressing demo on Saturday at 11. Carmen', created_at: monthsAgo(1) },
        { role: 'user', content: 'Email to the newsletter list about ACL Festival weekend hours', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'email', content: 'Subject: ACL is here — Mariposa hours + a heads up on the line\n\nHola amigos,\n\nQuick note as ACL weekend kicks off:\n\n• We\'re open 7 AM – midnight Friday + Saturday, 7 AM – 10 PM Sunday\n• Breakfast tacos by the dozen — order ahead via website if you\'re feeding a crew\n• Last 2 hours each night get busy. If you\'re heading to a show, come by 5–7 PM for the easiest table.\n\nWeekend special: smoked brisket taco with our roasted-poblano salsa. Limited daily, until we run out.\n\nSee you on Chicon.\n\nCarmen + the Mariposa team', created_at: monthsAgo(1) },
        { role: 'user', content: 'Blog post about why we\'re using nixtamal for our tortillas', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'blog_post', content: 'Why We Make Tortillas From Scratch (And Why Most "Authentic" Restaurants Don\'t)\n\nIf you walk into 90% of "authentic" Mexican restaurants in Austin and order a taco, the tortilla on your plate started its life as a bag of Maseca — pre-ground masa harina with preservatives. There\'s nothing wrong with Maseca. It\'s how most family kitchens make tortillas in 2026, including some great ones.\n\nBut at Mariposa, we made a different decision. Every morning at 5 AM, our cook Roberto starts a 24-hour cycle: dried corn from a heritage farm in Coahuila, soaked overnight in calcium hydroxide (cal), then ground fresh on stone the next morning. That process — nixtamalization — has been the way Mexican families made tortillas for 4,000 years.\n\nIt costs us 3x more than Maseca. It takes a 2-person crew an extra hour every morning. So why do we keep doing it?\n\n1. The flavor is not subtle. Nixtamal tortillas have a corn flavor that store-bought corn tortillas literally cannot have. Once you taste it, you taste the difference.\n\n2. Texture matters. The corn proteins are intact, which means the tortilla flexes around the filling without tearing. Restaurant-supply tortillas crack if you fold them around chunky barbacoa.\n\n3. It\'s how my grandmother made them. That\'s the actual answer. Our menu is hers, with permission.\n\nIf you\'ve only ever had Maseca tortillas, come try one — we serve them as a single side ($2) so you can taste before you commit to the meal. — Carmen', created_at: monthsAgo(3) },
        { role: 'user', content: 'Quick post about the new lengua taco we just added', created_at: daysAgo(20) },
        { role: 'assistant', type: 'social', content: 'New on the menu: Lengua taco. 👅\n\nCooked overnight in Coca-Cola, garlic, and cumin until it falls apart. Served on a fresh tortilla with chopped onion, cilantro, and our roasted-tomatillo salsa.\n\n$5.50 each. Available daily until we run out (usually before 8 PM).\n\nIf you\'ve never had lengua — start here. We\'ll teach you why your Tio Joe always orders it.', created_at: daysAgo(20) },
        { role: 'user', content: 'Email blast about our new pop-up dinner series', created_at: daysAgo(11) },
        { role: 'assistant', type: 'email', content: 'Subject: Mariposa Sunday Suppers — first one is May 5\n\nHola amigos,\n\nSomething new we\'re launching:\n\nMariposa Sunday Suppers. One Sunday a month, we close the dining room at 5 and open a 24-seat communal table at 7 PM. Single tasting menu — 6 courses — paired with mezcal from our friends at Mezcalería Tobalá.\n\nFirst supper: May 5 (Cinco de Mayo). $85/person all-in. Reservations open Wednesday at noon — drop your email and we\'ll send the booking link first.\n\nIf this fills out, June 2 will be the next one.\n\nReply with your headcount estimate so we can plan dough volume.\n\nCarmen', created_at: daysAgo(11) },
        { role: 'user', content: 'Reply to a 1-star Google review about a long wait', created_at: daysAgo(4) },
        { role: 'assistant', type: 'review_response', content: 'Hi Mark — Carmen, owner. I\'m sorry the wait was that long on Saturday. Looking at our timing reports, that night was 38 minutes for tables which is genuinely longer than we ever want it to be — our target is 18.\n\nWhat I won\'t do is pretend it was fine. We were 2 servers short Saturday because of a flu outbreak in the team. Wasn\'t your problem and shouldn\'t have been your wait.\n\nIf you\'re willing to give us another shot, email me direct (carmen@mariposataqueria.com) and I\'ll put a free order of mole tamales on the table. — Carmen', created_at: daysAgo(4) },
        { role: 'user', content: 'Friday lunch special post for this week', created_at: daysAgo(1) },
        { role: 'assistant', type: 'social', content: 'Friday lunch special. ⏰\n\nToday only: 3-taco plate w/ rice, beans, salsa duo + agua fresca — $12.\n\nAvailable 11 AM – 2 PM. Dine-in or grab-and-go. Vegetarian sub available (calabacitas, hongo, or rajas).\n\nLine moves fast on Fridays. See you between meetings.', created_at: daysAgo(1) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Warm, family-driven, slightly bilingual (Spanish phrases sprinkled — "amigos", "gracias", "abuela"). Personal voice from Carmen the owner. We are NOT corporate Tex-Mex. We are family-recipe Mexican. References to abuela, family kitchen, traditions are core. Avoid "fusion" language. Avoid food writer language ("decadent", "elevated"). Talk like a chef who grew up in this kitchen.' },
        { id: 'doc-2', type: 'services', title: 'Menu + Services', content: 'Breakfast tacos (6 AM – 11 AM). Lunch + dinner tacos, plates, tortas. Catering for private events ($14/person 25+ guests). Sunday Suppers (monthly tasting menu, 24 seats). Tortilla classes (Saturday mornings, $45/person). Online ordering via Toast. Limited delivery (DoorDash, 1.5 mile radius).' },
        { id: 'doc-3', type: 'about', title: 'About Mariposa', content: 'Founded 2018 by Carmen Velasco in honor of her grandmother. Located 12th & Chicon, East Austin. 36 seats, full bar with mezcal-forward cocktail list. Family recipes from Coahuila and Veracruz. Heritage corn nixtamalized in-house daily. James Beard semifinalist 2024 (Best Chef Texas).' },
        { id: 'doc-4', type: 'pricing', title: 'Menu Pricing', content: 'Tacos: $4.50–$6.50 each. Plates: $13–$22. Brunch tacos: $4.25 each, dozen for $48. Catering: $14/person 25+, $11/person 75+. Sunday Suppers: $85/person, $145 with mezcal pairing. Tortilla class: $45/person, includes 1 lb of corn to take home.' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: Reservations?\nA: For dinner Tu–Sat, yes (via Resy). Brunch + lunch are walk-in only. Sunday Suppers reservation only.\n\nQ: Vegetarian?\nA: 4 standing menu items + daily vegetarian special. Vegan on request — we use lard in some traditional items, ask the server.\n\nQ: Gluten-free?\nA: All corn tortillas are GF. Some salsas use beer; ask server. Flour tortillas obviously not.' },
        { id: 'doc-6', type: 'about', title: 'Press + Events', content: 'James Beard Best Chef Texas semifinalist 2024. Featured in Texas Monthly\'s "Best Tacos in Texas" 2023, 2024. Eater Austin "Restaurant of the Year" 2023. Annual events: Día de los Muertos altar + dinner (Nov 1–2), Cinco de Mayo Sunday Supper, ACL late-night menu, SXSW extended hours.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Veracruz All Natural', url: 'https://veracruzallnatural.com', last_checked: daysAgo(2), summary: 'The Austin tacqueria standard everyone measures against. Multiple locations now (East Austin, South Lamar, Domain). Migas taco is the star of the city. Their pricing is comparable to ours. Their advantage: brand recognition + multiple locations. Our advantage: heritage corn + Sunday Suppers (they don\'t do tasting menus). Recommend doubling down on our nixtamal story — they don\'t have one.' },
        { id: 'comp-2', name: 'Tacodeli', url: 'https://tacodeli.com', last_checked: daysAgo(3), summary: 'Larger, faster, more corporate. 8+ locations. Strong breakfast taco game. They market hard on Instagram (heavy investment in food photography). Their weakness: feels increasingly chain-like, locals talk about it less. We don\'t directly compete except for the breakfast-by-the-dozen catering segment, where we underprice them by $4/dozen and word is spreading.' },
        { id: 'comp-3', name: 'Suerte', url: 'https://suerteatx.com', last_checked: daysAgo(1), summary: 'Upscale East Austin Mexican — same neighborhood, different segment. Tasting menus, $60+ entrees. They\'re a halo brand for the East Austin food scene. Our Sunday Supper concept directly references their model but at a 30% lower price point. Their press coverage drives diners to East Austin generally — which helps us. Don\'t compete; complement.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Friday lunch special. ⏰\n\nToday only: 3-taco plate w/ rice, beans, salsa duo + agua fresca — $12.\n\nAvailable 11 AM – 2 PM. Dine-in or grab-and-go. Vegetarian sub available.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(11), next_run: daysAhead(19), last_output: 'Subject: Mariposa Sunday Suppers — first one is May 5\n\nHola amigos,\n\nWe\'re launching Sunday Suppers. One Sunday a month, communal table, 6 courses, mezcal pairings. First one May 5 — $85/person.\n\nReservations open Wednesday at noon. Reply with headcount so we can plan dough volume.\n\nCarmen' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(7), last_output: 'Why We Make Tortillas From Scratch (And Why Most "Authentic" Restaurants Don\'t)\n\nEvery morning at 5 AM, Roberto starts a 24-hour cycle: dried corn from a heritage farm in Coahuila, soaked overnight in cal, then ground fresh on stone...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Hi Mark — Carmen, owner. Saturday wait was 38 min, way over our 18-min target. Won\'t pretend it was fine. We were 2 servers short. If you\'re willing to give us another shot, email me direct and I\'ll put free mole tamales on the table. — Carmen' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan:\n\n• Veracruz: opening Domain location July. Catering breakfast volumes will rise — protect our pricing.\n• Tacodeli: heavy IG ad spend on migas tacos. We can\'t outspend; double down on heritage story.\n• Suerte: 2 new tasting menu announcements. Our Sunday Supper directly competes at 30% less. Lock in May 5 reservations.' },
        { id: 'task-6', task_type: 'email', frequency: 'biweekly', status: 'active', last_run: daysAgo(8), next_run: daysAhead(6), last_output: 'Subject: Brunch crew, this Saturday\'s special\n\nHola — Saturday brunch we\'re running cochinita-pibil tacos as a special until they run out (usually by noon). Come hungry. Carmen' },
        { id: 'task-7', task_type: 'review_request', frequency: 'weekly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(3), last_output: 'Subject: Did Mariposa do good?\n\nHola {{first_name}}, hope your visit was great. If we did, a 30-second review goes a long way for a small spot like ours. Link: {{review_link}}. Gracias. — Carmen' },
        { id: 'task-8', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(13), next_run: daysAhead(1), last_output: 'New on the menu: Lengua taco. 👅\n\nCooked overnight in Coca-Cola, garlic, and cumin until it falls apart. $5.50. Available daily until we run out.' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Suerte (cross-promo)', email: 'events@suerteatx.com', status: 'paid', created_at: daysAgo(135), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'East Side Showroom', email: 'events@eastsideshowroom.com', status: 'paid', created_at: daysAgo(75), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Mezcalería Tobalá', email: 'partner@tobalá.com', status: 'paid', created_at: daysAgo(50), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Heritage Coffee', email: 'lex@heritageatx.com', status: 'trial', created_at: daysAgo(7), trial_ends_at: daysAhead(35) }
      ],
      chatTemplates: {
        social: 'New on the menu: Lengua taco. 👅\n\nCooked overnight in Coca-Cola, garlic, and cumin until it falls apart. Served on a fresh tortilla with chopped onion, cilantro, and our roasted-tomatillo salsa.\n\n$5.50 each. Available daily until we run out.',
        newsletter: 'Subject: This month at Mariposa\n\nHola amigos,\n\nSunday Supper #2 dropping June 2. New menu: ceviche, tlayudas, mole negro. $85/person.\n\nReservations open Wednesday — reply with headcount.\n\nCarmen',
        blog_post: 'Why We Make Tortillas From Scratch (And Why Most "Authentic" Restaurants Don\'t)\n\nIf you walk into 90% of "authentic" Mexican restaurants in Austin and order a taco, the tortilla on your plate started its life as a bag of Maseca...',
        email: 'Subject: ACL is here — Mariposa hours + line heads up\n\nHola amigos, we\'re open 7 AM – midnight Fri + Sat, 7 AM – 10 PM Sun. Breakfast tacos by the dozen for crews — order ahead. Carmen',
        review_response: '{{name}} — gracias amigo. Mama Velasco saw your review and said "tell them they get the {{their_order}} on the house next time." Bring the family. — Carmen',
        fallback: 'Tell me what occasion (daily special, festival prep, event launch, customer reply) and platform (IG, FB, email, blog) and I\'ll write something in our voice.'
      }
    },

    /* ============================================================
       6. SALON — Magnolia Hair Studio (Brittany Hayes, South Lamar)
       ============================================================ */
    salon: {
      key: 'salon',
      email: 'salon@beacon.demo',
      password: 'demo',
      label: 'Salon',
      description: 'Magnolia Hair Studio · South Lamar',
      subscription: {
        id: 'demo-salon-001',
        email: 'salon@beacon.demo',
        client_name: 'Brittany Hayes',
        business_name: 'Magnolia Hair Studio',
        industry: 'salon',
        plan: 'beacon',
        status: 'active',
        tokens_used: 121400,
        referral_code: 'MAGNOLIA-HAIR',
        created_at: monthsAgo(7),
        current_period_end: daysAhead(15),
        token_reset_date: daysAhead(15)
      },
      chat: [
        { role: 'user', content: 'Instagram post about new balayage pricing for spring', created_at: monthsAgo(4) },
        { role: 'assistant', type: 'social', content: 'Spring balayage season is open. ☀️\n\nApr 1 – May 31:\n• Full balayage + cut + gloss — $345 (reg $395)\n• Partial balayage + gloss — $245 (reg $285)\n• Includes K18 bond builder + Olaplex finishing toner\n\nWeekend slots fill 2 weeks out. DM @magnoliahairsouth or book direct in the link in bio.\n\n📍 South Lamar | Park free in lot behind Tomboy', created_at: monthsAgo(4) },
        { role: 'user', content: 'Reply to a 5-star Google review from a wedding client', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'review_response', content: 'Lauren — congratulations again. Doing your hair the morning of the wedding, with all four of your bridesmaids in the chairs around you, was honestly the highlight of my month. Watching the dad-walk-in moment was something else. Cherish those photos. xo Brittany & the Magnolia team', created_at: monthsAgo(3) },
        { role: 'user', content: 'Email to clients about the K18 bond builder we\'re now using', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'email', content: 'Subject: A small upgrade to your color services\n\nHi {{first_name}},\n\nQuick note — every color service at Magnolia now includes K18 bond builder, no upcharge.\n\nIf you haven\'t heard of it: K18 is the only treatment that biomedically repairs broken hair bonds (the things that actually hold your hair strong, separate from "moisturizing" treatments which just coat the strand). For anyone doing balayage, lightener, or repeat color, this is the difference between hair that feels healthy at 6 weeks and hair that\'s starting to feel fragile.\n\nNothing for you to do — your next visit just gets it included. If you want to add a take-home K18 mask ($35), let your stylist know.\n\nBrittany', created_at: monthsAgo(2) },
        { role: 'user', content: 'Blog post about balayage maintenance for Austin\'s sun + chlorine', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'blog_post', content: 'How to Make Your Balayage Survive an Austin Summer\n\nIf you got fresh balayage in March, by August it will look like a different color. Austin\'s combo of UV intensity, chlorine, and lake water is the worst summer balayage gauntlet in the country.\n\nHere\'s how to make April balayage still look intentional in September.\n\n1. UV protector spray, every day. Not optional. Brands we like: Color Wow Dream Coat (heat-activated), Olaplex No. 9 (everyday).\n\n2. Pre-pool soak. Wet your hair with tap water before getting in the pool. Saturated hair absorbs less chlorine.\n\n3. Glossing visits, every 6 weeks. Not "touch-ups" — those are for grow-out. Gloss tones the brass that UV pulls forward. $85 in our chair, takes 35 minutes.\n\n4. Sulfate-free shampoo. Sulfates strip lightener fast. We carry Davines, Olaplex, K18 at the salon.\n\n5. Skip a couple wash days a week. Dry shampoo is your friend. The cleaner you "have to keep it," the faster the color fades.\n\nWe see clients who follow this protocol go 5 months between full balayage. Clients who don\'t are back at 10 weeks asking what happened. — Brittany', created_at: monthsAgo(2) },
        { role: 'user', content: 'Quick post about a last-minute Friday slot opening', created_at: daysAgo(8) },
        { role: 'assistant', type: 'social', content: '⚡ Last-minute opening:\n\nFriday 4/26, 1:00 PM. 3-hour slot — perfect for cut + balayage refresh + gloss.\n\nDM "Friday" if you want it. First DM gets it. ✨', created_at: daysAgo(8) },
        { role: 'user', content: 'Wedding hair package promo for May/June season', created_at: daysAgo(6) },
        { role: 'assistant', type: 'social', content: 'Wedding season is here. 💍\n\nMagnolia\'s 2026 bridal package:\n• Bridal trial (90 min, $145)\n• Wedding day hair (in-salon or onsite)\n• Bridesmaids: $95–$135 each\n• Welcome day: complimentary mimosas + photo wall\n\nFour weekends already booked for May. Two weekends still open in June.\n\nDM us your wedding date and we\'ll send the full package PDF.', created_at: daysAgo(6) },
        { role: 'user', content: 'Reply to a 1-star Yelp review about a color result', created_at: daysAgo(3) },
        { role: 'assistant', type: 'review_response', content: 'Kate — Brittany, owner here. I\'m really sorry the result didn\'t match what you walked in for. Looking at the consultation notes from your visit with Mia, it sounds like the inspiration photo was a balayage with a much higher contrast than what your starting darkness allows in one session.\n\nThat\'s on us to communicate better — going from your level 4 to that inspiration realistically takes 2 sessions, and we should have priced that into the plan.\n\nI\'d like to make this right. Email me direct (brittany@magnoliahairstudio.com) and I\'ll book you in personally for the corrective session, no charge for the lightening pass. — Brittany', created_at: daysAgo(3) },
        { role: 'user', content: 'Appointment reminder for tomorrow', created_at: daysAgo(1) },
        { role: 'assistant', type: 'email', content: 'Hi {{first_name}}! Just a reminder your appointment with {{stylist}} is tomorrow at {{time}} for {{service}}. Coming as the inspo photo from your last text? Drop us a follow-up image if anything has changed. See you then. — Magnolia', created_at: daysAgo(1) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Friendly, expert, slightly girlfriend-y. Owner Brittany speaks like she\'s talking to a friend across the chair, not pitching from behind a desk. We are color-specialty, not "everything for everyone." References to specific products (K18, Olaplex, Davines), specific neighborhoods (South Lamar, Bouldin), and the actual stylists by name (Mia, Sarah, Jess). Avoid spa language ("indulge", "rejuvenate", "pamper").' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'Women\'s precision cuts ($85–$125). Color: single process ($125), all-over highlights ($175), partial balayage ($245), full balayage ($345 includes cut + gloss). Color correction (priced individual). Glossing/toning ($85). Wedding hair (bridal $325, bridesmaids $95–$135). Smoothing treatments. Extensions consultation.' },
        { id: 'doc-3', type: 'about', title: 'About Magnolia', content: 'Founded 2020 by Brittany Hayes (master colorist, 13 years). Located on South Lamar in the design district. 4 chairs, 4 stylists (Brittany, Mia, Sarah, Jess). Color specialty — we don\'t do barbering or men\'s. Davines + Olaplex + K18 partner salon. Award: Best Color Salon, Austin Monthly 2024.' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing Structure', content: 'New clients book 1.5x time for first appointment ($35 consultation fee, applied to service). All color includes K18 bond builder no upcharge. Balayage ($345) includes cut + gloss bundled. Bridal trial ($145) credited toward wedding day if booked within 3 months. 24-hour cancel policy ($50 fee).' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: Do you take walk-ins?\nA: Rarely. We\'re mostly booked 2–3 weeks out. Best to DM @magnoliahairsouth for cancellation slots.\n\nQ: Color correction?\nA: Yes — but corrections need a free 15-minute video consultation first to scope cost + sessions.\n\nQ: Extensions?\nA: We do hand-tied wefts. Consultation required, install 4–6 hours, $1,200–$2,400 depending on hair length.\n\nQ: Parking?\nA: Free lot behind Tomboy/our building. Don\'t park at Tarrytown Pharmacy lot — they tow.' },
        { id: 'doc-6', type: 'about', title: 'Stylist Bios', content: 'Brittany Hayes — owner, master colorist, 13 yrs. Specialty: complex correction, blonde + brunette balayage.\nMia Patel — senior stylist, 8 yrs. Specialty: precision cuts, long layers, curtain bangs.\nSarah Liu — color specialist, 5 yrs. Specialty: copper + red transformations, color refresh maintenance.\nJess Ortega — junior stylist, 3 yrs. Specialty: glossing, root retouches, wedding party hair.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Birds Barbershop', url: 'https://birdsbarbershop.com', last_checked: daysAgo(2), summary: 'Different segment but Austin\'s most recognized hair brand. Now have 6+ locations across the city. They lean into "casual cool" branding (skate culture, alternative). Their color services are growing but cut-led. Not a direct competitor — we\'re color specialty, they\'re cut-led — but they own brand awareness in the city. Recommend leveraging "color specialty" as the differentiator vs. "everything-for-everyone" salons.' },
        { id: 'comp-2', name: 'Method Speakeasy', url: 'https://methodsalon.com', last_checked: daysAgo(3), summary: 'Direct competitor on color. Located near downtown. Strong Instagram presence (15K+ followers). Their pricing runs $30–$60 above ours on equivalent services. Their advantage: longer history (founded 2010), name recognition. Their weakness: 6-stylist shop with high turnover (3 stylists left in last 12 months per LinkedIn). Recommend pushing our stable team narrative.' },
        { id: 'comp-3', name: 'Salon Mirage', url: 'https://salonmirageaustin.com', last_checked: daysAgo(1), summary: 'Closer to our positioning — color-led, smaller team. Founder is strong on Instagram. Recently added a "color membership" — $185/month for unlimited gloss visits + 15% off other services. Worth piloting our own version. Our advantage: K18 inclusion, more transparent pricing on website (theirs requires consultation).' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(6), next_run: daysAhead(1), last_output: 'Wedding season is here. 💍\n\nMagnolia\'s 2026 bridal package:\n• Bridal trial (90 min, $145)\n• Wedding day hair (in-salon or onsite)\n• Bridesmaids: $95–$135 each\n• Welcome day: complimentary mimosas + photo wall\n\nDM us your wedding date and we\'ll send the full package PDF.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(13), next_run: daysAhead(17), last_output: 'Subject: April at Magnolia — what\'s changing\n\nHi friends,\n\nQuick rundown:\n\n• K18 now included on all color services, no upcharge\n• Balayage spring pricing through May 31 — $345 full balayage + cut + gloss\n• Wedding season slots: 4 May weekends fully booked, 2 June weekends still open\n• Mia is back from maternity leave May 6 — book her early, she fills first\n\nBrittany' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'biweekly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(7), last_output: 'How to Make Your Balayage Survive an Austin Summer\n\nIf you got fresh balayage in March, by August it will look like a different color. Austin\'s combo of UV intensity, chlorine, and lake water is the worst summer balayage gauntlet in the country...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(3), next_run: daysAhead(4), last_output: 'Kate — Brittany, owner here. I\'m really sorry the result didn\'t match what you walked in for. Email me direct and I\'ll book you in personally for the corrective session, no charge for the lightening pass. — Brittany' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'weekly', status: 'active', last_run: daysAgo(1), next_run: daysAhead(6), last_output: 'Weekly competitor scan:\n\n• Birds: opened a new East Austin location. Brand awareness rising; doesn\'t directly compete on color.\n• Method Speakeasy: 3rd stylist departure in 12 months. Recommend running an "established team" social campaign.\n• Salon Mirage: launched "$185/mo color membership." Worth piloting our own.' },
        { id: 'task-6', task_type: 'email', frequency: 'biweekly', status: 'active', last_run: daysAgo(9), next_run: daysAhead(5), last_output: 'Subject: Reminder + small win\n\nHi {{first_name}}, your appointment with {{stylist}} is in 2 days at {{time}}. Quick win: every color now includes K18 bond builder. — Magnolia' },
        { id: 'task-7', task_type: 'review_request', frequency: 'weekly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(3), last_output: 'Subject: Did Magnolia knock it out?\n\nHi {{first_name}}, hope you love the new color. If you have 30 seconds, a Google review goes a long way for our team. {{review_link}}. xo Brittany' },
        { id: 'task-8', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(8), next_run: daysAhead(6), last_output: '⚡ Last-minute opening:\n\nFriday 4/26, 1:00 PM. 3-hour slot — perfect for cut + balayage refresh + gloss.\n\nDM "Friday" if you want it.' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Lauren\'s Bridal Party', email: 'laurenh@example.com', status: 'paid', created_at: daysAgo(95), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'Kim Avila', email: 'kim.a@example.com', status: 'paid', created_at: daysAgo(60), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Tomboy Boutique', email: 'lex@tomboy.com', status: 'paid', created_at: daysAgo(35), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Whitney Lee', email: 'whitney.l@example.com', status: 'trial', created_at: daysAgo(9), trial_ends_at: daysAhead(33) }
      ],
      chatTemplates: {
        social: 'Spring balayage season is open. ☀️\n\nApr 1 – May 31:\n• Full balayage + cut + gloss — $345 (reg $395)\n• Partial balayage + gloss — $245\n• Includes K18 + Olaplex toner\n\nWeekend slots fill 2 weeks out. DM us or book in the link in bio.',
        newsletter: 'Subject: This month at Magnolia\n\nHi friends, quick rundown:\n• K18 now included no upcharge\n• Balayage pricing through May 31\n• Mia\'s back from maternity leave\n\nxo Brittany',
        blog_post: 'How to Make Your Balayage Survive an Austin Summer\n\nIf you got fresh balayage in March, by August it will look like a different color...',
        email: 'Hi {{first_name}}! Reminder your appointment with {{stylist}} is in {{days}} at {{time}}. Coming as the inspo photo from last visit? Drop a fresh image if anything has changed. — Magnolia',
        review_response: '{{name}} — thank you so much. {{stylist}} mentioned how happy you were with the {{service}}. Ride that color into summer. xo Brittany',
        fallback: 'Tell me the angle — promo, education, wedding, retention — and the platform (IG / email / blog / review reply) and I\'ll write something tight.'
      }
    },

    /* ============================================================
       7. CAFE — Eastside Espresso Co. (Jordan Lee, East 6th)
       ============================================================ */
    cafe: {
      key: 'cafe',
      email: 'cafe@beacon.demo',
      password: 'demo',
      label: 'Cafe',
      description: 'Eastside Espresso Co. · East 6th',
      subscription: {
        id: 'demo-cafe-001',
        email: 'cafe@beacon.demo',
        client_name: 'Jordan Lee',
        business_name: 'Eastside Espresso Co.',
        industry: 'cafe',
        plan: 'lite',
        status: 'active',
        tokens_used: 38240,
        referral_code: 'EASTSIDE-COFFEE',
        created_at: monthsAgo(6),
        current_period_end: daysAhead(20),
        token_reset_date: daysAhead(20)
      },
      chat: [
        { role: 'user', content: 'Instagram post for our new spring drink — peach cold brew tonic', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'social', content: 'New for spring: Peach Cold Brew Tonic. 🍑\n\nOur house cold brew + Topo Chico + a splash of fresh peach syrup we make from Hill Country peaches dropped off Wednesdays.\n\n$6.50. On menu through August or until peaches run out (whichever comes first).\n\nServed in the patio glass. Iced over the big square cubes from Cube Co. ✨', created_at: monthsAgo(3) },
        { role: 'user', content: 'Reply to a 5-star Google review from a regular', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'review_response', content: 'Sam — thank you. Olivia (the barista) said you\'ve been getting the cortado-and-laptop combo every Tuesday. We notice. Stay as long as you want this week — wifi password is on the chalkboard. — Jordan', created_at: monthsAgo(2) },
        { role: 'user', content: 'Email blast about our Sunday brunch launching', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'email', content: 'Subject: Sunday brunch starts April 7\n\nHey East 6th,\n\nWe\'ve been quietly testing a brunch menu on Sunday afternoons for a couple weeks. It\'s ready for the full launch.\n\nStarting April 7, every Sunday 9 AM – 2 PM:\n• Sourdough breakfast sandwich (bacon or avocado-mushroom) — $11\n• Pancake stack with brown butter + Texas honey — $13\n• Migas plate with corn tortillas — $14\n• Cold brew float with vanilla bean ice cream — $8\n\nNo reservations — counter service. Patio open. Vinyl on the speakers.\n\nSee you Sunday.\n\nJordan + the Eastside crew', created_at: monthsAgo(2) },
        { role: 'user', content: 'Quick post about Saturday\'s live music night', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'social', content: 'Saturday night: 7–10 PM. 🎶\n\nCindy & the Comets are back in for our acoustic patio set. No cover. Wine + beer only after 6 PM. Drip coffee + tea always.\n\nBring your dog. The patio runs warm — the heaters are out.', created_at: monthsAgo(1) },
        { role: 'user', content: 'New roast launch post', created_at: daysAgo(18) },
        { role: 'assistant', type: 'social', content: 'New roast on bar: Ethiopia Yirgacheffe ☕\n\nLight roast. Bright like a tangerine. Florals — jasmine, white tea. Best as pour-over.\n\n12 oz bag for home: $22. Cup at the bar: $5.\n\nSourced through our friends at Blue Bottle. We get one batch — when it\'s gone it\'s gone.', created_at: daysAgo(18) },
        { role: 'user', content: 'SXSW prep note for the team', created_at: daysAgo(50) },
        { role: 'assistant', type: 'email', content: 'Subject: SXSW playbook — printing for the team\n\nTeam,\n\nQuick prep memo for SXSW week (Mar 11–17). Putting it on paper so we can print + tape behind the bar.\n\nHours: 6 AM – 8 PM Mon–Wed, 6 AM – midnight Thu–Sun.\n\nMenu: Drip + cold brew run all day. Espresso bar opens 6:30. Pastries — increase pre-order with Easy Tiger by 40%. We always run out.\n\nCash flow: pull register cash twice daily (morning + 4 PM). Keep $300 float.\n\nPatio: line stops at the chalkboard sign. No menu camp-outs over 2 hours.\n\nVibe: this is our biggest week. Be calm + helpful + slightly chaotic. — Jordan', created_at: daysAgo(50) },
        { role: 'user', content: 'Thanksgiving / holiday hours announcement', created_at: daysAgo(8) },
        { role: 'assistant', type: 'social', content: 'Holiday hours, in case you\'re planning around them. 🦃\n\n• Thanksgiving Day: closed\n• Black Friday: 7 AM – 2 PM\n• Christmas Eve: 7 AM – 1 PM\n• Christmas Day: closed\n• New Year\'s Eve: 7 AM – 5 PM\n• New Year\'s Day: 9 AM – 4 PM (recovery hours)\n\nGift cards online for last-minute shoppers. Bag of beans = a person\'s favorite gift, every year. ☕', created_at: daysAgo(8) },
        { role: 'user', content: 'Shoutout post for the local artist whose work is up this month', created_at: daysAgo(2) },
        { role: 'assistant', type: 'social', content: 'New on the walls this month: paintings by @marisol.atx 🎨\n\nMarisol is an East Austin painter doing tiny, precise oil studies of neighborhood scenes — taquerías at noon, dogs on porches, the corner of E 6th + Pedernales after rain.\n\nShow runs through May 31. All paintings are for sale; reach out to her direct or ask the team. We don\'t take a cut.\n\nCome by for the artist meet-and-greet Friday May 2, 6–8 PM. Wine + light bites.', created_at: daysAgo(2) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Quiet, slightly East Austin cool, never trying too hard. Owner Jordan writes like he\'s telling you about a thing rather than selling it. Specifics over hype: "Hill Country peaches dropped off Wednesdays" not "fresh local peaches." We are coffee-led, not Instagram-led. Music + art + community ARE the brand. Don\'t do "passion" or "craft" or "experience." Use lowercase emoji rarely.' },
        { id: 'doc-2', type: 'services', title: 'Menu + Services', content: 'Specialty espresso bar (single origin rotating). House cold brew (kegerator). Drip coffee. Pour-over. Pastries from Easy Tiger. Sunday brunch (9 AM – 2 PM). Live music Saturday nights (no cover). Local artist wall (rotating monthly). Beans for retail (12 oz bags). Catering for small offices.' },
        { id: 'doc-3', type: 'about', title: 'About Eastside Espresso', content: 'Founded 2023 by Jordan Lee. Located on East 6th + Pedernales. 18 seats inside, 12 patio. Music venue ASCAP licensed. Coffee partner: Blue Bottle, Greater Goods, Cuvée rotation. Pastries: Easy Tiger. Open daily 6 AM – 8 PM, extended Sat night.' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing', content: 'Drip: $3.50. Cortado: $4.50. Latte: $5.25. Cold brew: $5.50. Pour-over: $6. Specialty drinks (seasonal): $6.50. Pastries: $4–$6. Brunch entrees: $11–$14. Beans for retail: $18 (250g), $22 (12 oz), $30 (1 lb).' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: Wifi?\nA: Yes, free, on the chalkboard. We do ask laptop campers to take phone calls outside.\n\nQ: Reservations for brunch?\nA: No, walk-in only. Sundays 9 AM – 2 PM. Line stops at chalkboard.\n\nQ: Dogs?\nA: Patio yes, inside no. Water bowls on patio always.\n\nQ: Live music nights?\nA: Saturdays 7–10 PM. No cover. Wine + beer after 6 PM.' },
        { id: 'doc-6', type: 'about', title: 'Music + Art Calendar', content: 'Music: rotating local acoustic acts Saturday nights. Booking via @musicfor6th. We pay $200 cash + free tab. Art: monthly rotation, artist picks pieces, we hang. Artist meet-and-greets first Friday of the month. We don\'t take a cut on art sales.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Greater Goods Coffee Roasters', url: 'https://greatergoodsroasting.com', last_checked: daysAgo(2), summary: 'Closest aesthetic match. Multiple Austin locations now. Strong specialty coffee program. Their advantage: roasting in-house gives them margin + brand depth. Our advantage: location (we\'re East 6th, they\'re Bouldin / Springdale), evening hours + music. Recommend leaning further into music + arts programming — they don\'t do this.' },
        { id: 'comp-2', name: 'Houndstooth Coffee', url: 'https://houndstoothcoffee.com', last_checked: daysAgo(3), summary: 'Premium specialty cafe with multiple downtown + central locations. Very strong pour-over program. Trains baristas to a high standard. Their pricing runs slightly above ours. Our advantage on East side: they don\'t have a location east of I-35; we own this geography. Maintain "the East 6th specialty cafe" positioning.' },
        { id: 'comp-3', name: 'Cuvée Coffee Bar', url: 'https://cuveecoffee.com', last_checked: daysAgo(1), summary: 'Coffee partner of ours (we use their beans seasonally) AND a local cafe operator. Their bar in East Austin draws very similar crowd. Recommend keeping the partnership — co-marketing opportunities (cuppings, classes, coffee festivals) are mutual wins. We do not need to compete; we collaborate.' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'New on the walls this month: paintings by @marisol.atx 🎨\n\nMarisol is an East Austin painter. Show runs through May 31. All for sale — we don\'t take a cut. Artist meet-and-greet Friday May 2, 6–8 PM.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(13), next_run: daysAhead(17), last_output: 'Subject: April at Eastside\n\nHey neighbors,\n\nQuick update on what\'s new:\n\n• Peach cold brew tonic is back on bar (until peaches run out)\n• Sunday brunch dialed in — bring a crew\n• Saturday music: Cindy & the Comets May 4, Maple Cliff May 11, Slow Light May 18\n• Beans on shelf: Ethiopia Yirgacheffe (light), Guatemala Huehuetenango (medium-dark)\n\nSee you on the patio.\n\nJordan' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'monthly', status: 'paused', last_run: daysAgo(45), next_run: daysAhead(15), last_output: 'Paused — spending content time on social + newsletter only for now. Will revisit summer.' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Sam — thank you. Olivia (the barista) said you\'ve been getting the cortado-and-laptop combo every Tuesday. We notice. Stay as long as you want this week. — Jordan' },
        { id: 'task-5', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(0), last_output: 'New roast on bar: Ethiopia Yirgacheffe ☕\n\nLight roast. Bright like a tangerine. Florals — jasmine, white tea. Best as pour-over.\n\n12 oz bag for home: $22.' },
        { id: 'task-6', task_type: 'email', frequency: 'monthly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(26), last_output: 'Subject: Saturday acoustic — 5/4 line-up\n\nHey friends, Cindy & the Comets back on the patio Saturday 5/4 from 7. Bring the dog, bring a date. — Jordan' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Easy Tiger Bakery', email: 'pat@easytigeratx.com', status: 'paid', created_at: daysAgo(90), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'East Side Vinyl', email: 'rio@eastsidevinyl.com', status: 'paid', created_at: daysAgo(50), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Cube Co. Ice', email: 'orders@cubeco.com', status: 'paid', created_at: daysAgo(30), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Marisol (artist partner)', email: 'marisol.atx@example.com', status: 'trial', created_at: daysAgo(4), trial_ends_at: daysAhead(38) }
      ],
      chatTemplates: {
        social: 'New on bar: Ethiopia Yirgacheffe ☕\n\nLight roast, bright like a tangerine. Florals — jasmine, white tea. Best as pour-over.\n\n12 oz bag for home: $22. Cup at the bar: $5.',
        newsletter: 'Subject: This month at Eastside\n\nHey neighbors,\n\nQuick update:\n• New roast on bar\n• Sunday brunch dialed in\n• Saturday music line-up\n\nJordan',
        blog_post: 'Why We Buy Peaches From Real People\n\nEvery Wednesday a guy named Tomas drives in from outside Fredericksburg with a truck bed of peaches...',
        email: 'Subject: Saturday acoustic — line-up\n\nHey friends, Saturday on the patio: {{artist}} from 7. Bring the dog, bring a date. — Jordan',
        review_response: '{{name}} — thank you. {{barista}} mentioned you\'ve been a regular for {{months}} months. Stay as long as you want next time. — Jordan',
        fallback: 'Tell me the moment — new drink, new music night, brunch menu, art show, or a community thing — and I\'ll write it in our voice.'
      }
    },

    /* ============================================================
       8. HANDYMAN — ATX Honey Do Co. (Dave Ramirez)
       ============================================================ */
    handyman: {
      key: 'handyman',
      email: 'handyman@beacon.demo',
      password: 'demo',
      label: 'Handyman',
      description: 'ATX Honey Do Co. · South Austin',
      subscription: {
        id: 'demo-handy-001',
        email: 'handyman@beacon.demo',
        client_name: 'Dave Ramirez',
        business_name: 'ATX Honey Do Co.',
        industry: 'handyman',
        plan: 'beacon',
        status: 'active',
        tokens_used: 78950,
        referral_code: 'ATX-HONEYDO',
        created_at: monthsAgo(8),
        current_period_end: daysAhead(17),
        token_reset_date: daysAhead(17)
      },
      chat: [
        { role: 'user', content: 'Facebook post about TV mounting season for football', created_at: monthsAgo(8) },
        { role: 'assistant', type: 'social', content: '🏈 Football season is here. Get the TV mounted before the first kickoff.\n\nCommon ATX Honey Do request from August on. We mount, hide cables, and add an outlet behind the TV so the cord cluster disappears.\n\n$185 flat for mount + cable management + outlet. Most jobs done in 90 minutes.\n\nText 512-555-0166 with TV size + wall type and we\'ll quote next-day.', created_at: monthsAgo(8) },
        { role: 'user', content: 'Email about freeze prep before Texas freeze week', created_at: monthsAgo(3) },
        { role: 'assistant', type: 'email', content: 'Subject: Freeze coming Tuesday — get a freeze-prep visit on the books\n\nHey friends,\n\nForecast says Tuesday night drops into the teens. If you\'ve been in Texas for the 2021 freeze, you know what comes next if you\'re not ready.\n\nATX Honey Do freeze prep — $145 flat, 2-hour visit:\n\n✔ Wrap or foam-cover all hose bibs\n✔ Disconnect outdoor hoses + drain\n✔ Insulate exposed pipes in attic + crawl spaces\n✔ Test main shutoff valve (most homes\' valves are seized)\n✔ Pre-drip setup for faucets\n\nWe do this with the homeowner walked through every step so you know how to handle it next time.\n\nReply with your zip + days that work this weekend. — Dave\n512-555-0166', created_at: monthsAgo(3) },
        { role: 'user', content: 'Reply to a 5-star Google review from a deck repair', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'review_response', content: 'Hey John — appreciate this. The deck-board replacements went smoother than we expected once we found the rot pattern was contained to the south-facing rail. Gable, my partner on this one, said the sealing job should hold 5+ years given the new flashing we added. Holler at me if anything pops up next storm season. — Dave', created_at: monthsAgo(2) },
        { role: 'user', content: 'Quick post about gutter cleaning before fall', created_at: monthsAgo(2) },
        { role: 'assistant', type: 'social', content: 'Gutter clean season. 🍂\n\nIf you\'re under live oaks (most of central Austin), your gutters are 60% full of catkins right now. Heavy rain + clogged gutters = water back into your fascia + soffit, which is how you get the brown stains under your roof line.\n\nWe do gutter clean + gutter guard install. $185 single-story, $295 two-story.\n\nText 512-555-0166 with address; we quote same-day.', created_at: monthsAgo(2) },
        { role: 'user', content: 'Blog post about home maintenance schedule for new homeowners', created_at: monthsAgo(1) },
        { role: 'assistant', type: 'blog_post', content: 'The ATX Homeowner Maintenance Calendar (What to Do When)\n\nYou bought a house. Congrats. Now nobody told you that homeownership has a maintenance schedule, and ignoring it costs about $4,000–$8,000 a year in compounded damage. Here\'s the calendar I give to every new client.\n\nJANUARY-FEBRUARY: Freeze prep. Disconnect hoses. Wrap hose bibs. Test shutoff valves. (We do this for $145 if you don\'t want to crawl in your attic.)\n\nMARCH: HVAC tune-up. Replace filter. Schedule pro service before April allergies.\n\nAPRIL: Termite walk-around. Look for swarm activity. Mud tubes on foundation.\n\nMAY: Gutter clean #1. Pollen + catkins are out. Clean before storm season.\n\nJUNE: AC drain pan check. Austin humidity clogs primary AC drains. The float switch in the secondary drain pan is your last line of defense — we test it.\n\nJULY-AUGUST: Roof inspection from ground (binoculars). Look for shingle lift on south-facing slopes.\n\nSEPTEMBER: Caulk + seal exterior doors and windows before winter. Air leaks add up to $400/yr in heating.\n\nOCTOBER: Gutter clean #2. Live oaks drop hardest in fall.\n\nNOVEMBER: Smoke + CO detector test. Replace 9V batteries.\n\nDECEMBER: Freeze plan in place. Make sure you know where your shutoff is.\n\nIf this list is overwhelming — that\'s normal. Most clients pick 4–5 to do themselves and have us handle the rest twice a year.', created_at: monthsAgo(1) },
        { role: 'user', content: 'Quick text-style follow-up after a finished job', created_at: daysAgo(10) },
        { role: 'assistant', type: 'email', content: 'Hey {{first_name}}, Dave from ATX Honey Do. Wrapped the {{job}} this afternoon. Couple things to know:\n\n• {{key_detail}}\n• Warranty: 12 months on labor, manufacturer warranty on materials\n• Any callbacks: text me direct, not the office\n\nInvoice in your inbox. Thanks for trusting us with the work. — Dave', created_at: daysAgo(10) },
        { role: 'user', content: 'Spring honey-do checklist post', created_at: daysAgo(5) },
        { role: 'assistant', type: 'social', content: 'Spring honey-do checklist for the homeowner who keeps "getting to it next weekend." 🛠️\n\n1. Replace all weatherstrip on doors that lead outside.\n2. Clean dryer vent — ALL THE WAY to the outside cap. Lint fires happen.\n3. Reseal the kitchen sink + bathroom tile — 30 min, prevents 2 years of water damage.\n4. Check garage door rollers + lubricate.\n5. Touch up exterior paint on south + west walls (UV cooks them first).\n\nWe knock out the whole list in a 4-hour visit for $295 flat.\n\nReply HONEY DO and we\'ll get you on the schedule.', created_at: daysAgo(5) },
        { role: 'user', content: 'Reply to a 4-star review noting a cleanup miss', created_at: daysAgo(2) },
        { role: 'assistant', type: 'review_response', content: 'Mike — fair. We pride ourselves on cleanup and we missed it on yours. Gabe should have run the shop vac in the laundry room before leaving — that\'s on him and on me as the owner for not double-checking on a same-day finish. I\'m bringing a credit on the next visit ($45 off). Text me direct anytime: 512-555-0166. — Dave', created_at: daysAgo(2) }
      ],
      context: [
        { id: 'doc-1', type: 'brand_voice', title: 'Brand Voice', content: 'Practical, no-nonsense, slightly Texas-friendly. We talk like a guy who\'s been on a hundred jobs and seen every Austin home failure. Specific dollar amounts, specific problems, specific fixes. Avoid corporate-speak ("solutions provider"). Avoid scare tactics ("don\'t let this happen to your home!"). Just say what we see and what it costs.' },
        { id: 'doc-2', type: 'services', title: 'Services Offered', content: 'TV mounting + cable management. Drywall repair (small + large patches, texture match). Interior painting (single rooms + accent walls). Exterior painting (small jobs only — under 800 sqft). Deck repair, board replacement, sealing. Fence repair (pickets, posts, gates). Gutter clean + gutter guard install. Faucet/toilet replacement. Shelving + storage build-outs. Doorknob + lockset rekey. Smart home install (thermostats, doorbells). Freeze prep visits.' },
        { id: 'doc-3', type: 'about', title: 'About ATX Honey Do', content: 'Founded 2019 by Dave Ramirez (15 years in trades — framing carpenter background). 2 trucks, 3 techs (Dave, Gabe, Kris). Service area: Austin city + Buda + Kyle + Manor. Insured, bonded. Specialty: small home-repair work that handymen often dodge or overcharge. We do not do: roofing replacement, HVAC repair, electrical panel work (we partner with licensed pros for those).' },
        { id: 'doc-4', type: 'pricing', title: 'Pricing', content: 'Trip charge: $79 (waived if work performed). TV mount: $185 flat including outlet behind TV. Drywall patch: $145 flat under 4x4. Painting: $195/wall (10x10 standard), $345/room. Deck board replacement: $25/board labor + materials. Gutter clean: $185 single, $295 two-story. Faucet replace: $145. Toilet replace: $245. 4-hour honey-do visit: $295 flat.' },
        { id: 'doc-5', type: 'faq', title: 'FAQ', content: 'Q: How fast can you come out?\nA: Same-week for most jobs. Next-day for urgent.\n\nQ: Do you do estimates over text?\nA: Most things yes — send a photo + address. We quote in 1 hour.\n\nQ: Insurance / bonding?\nA: Yes — both. Certificates available on request.\n\nQ: Can you handle electrical?\nA: Outlet swaps + light fixture replacement yes. Panel work or anything pulling permits no — we partner with a licensed electrician for those.' },
        { id: 'doc-6', type: 'about', title: 'Service Area + Specialties', content: 'Heavy in: Bouldin, South Lamar, Travis Heights, East Austin, Mueller. Specialty: freeze prep (Texas freeze of Feb 2021 created a permanent service line for us). TV mounting + smart home installs are our highest-margin work. Worst job we don\'t take: full-bath remodels. Better referred out.' }
      ],
      competitors: [
        { id: 'comp-1', name: 'Mr. Handyman of Austin', url: 'https://mrhandyman.com', last_checked: daysAgo(2), summary: 'National franchise, multiple Austin franchisees. Premium pricing — about 35–50% above ours on equivalent work. Strong brand recognition + fleet visibility. Their advantage: insurance + branding give corporate clients comfort. Our advantage: same-week scheduling, owner-operator quality, transparent pricing on the website. Recommend "no franchise markup" angle in social ads.' },
        { id: 'comp-2', name: 'Ace Handyman Services', url: 'https://acehandymanservices.com', last_checked: daysAgo(3), summary: 'Larger handyman op, multiple Austin teams. Strong Google ad presence. Their pricing is higher than ours on most line items. They handle bigger projects (multi-day) which we deliberately avoid. Recommend keeping our positioning on "fast small-job specialist" — they\'re slower for under-$500 work.' },
        { id: 'comp-3', name: 'Austin Handyman Pros', url: 'https://austinhandymanpros.com', last_checked: daysAgo(1), summary: 'Closer competitor — small local op, similar pricing. They\'re weak on online presence (their website is dated, no clear pricing). Our website with transparent pricing is our biggest lead-gen advantage. Maintain SEO investment on "Austin handyman pricing."' }
      ],
      tasks: [
        { id: 'task-1', task_type: 'social_post', frequency: 'weekly', status: 'active', last_run: daysAgo(5), next_run: daysAhead(2), last_output: 'Spring honey-do checklist for the homeowner who keeps "getting to it next weekend." 🛠️\n\n1. Replace all weatherstrip on doors that lead outside.\n2. Clean dryer vent ALL THE WAY to the outside cap.\n3. Reseal the kitchen sink + bathroom tile.\n4. Check garage door rollers + lubricate.\n5. Touch up exterior paint on south + west walls.\n\nWe knock out the whole list in a 4-hour visit for $295 flat.' },
        { id: 'task-2', task_type: 'newsletter', frequency: 'monthly', status: 'active', last_run: daysAgo(10), next_run: daysAhead(20), last_output: 'Subject: This month at ATX Honey Do — what we\'re seeing\n\nHey friends,\n\n• Live oak catkins everywhere — gutter cleans booking 2 weeks out\n• HVAC drain pan checks: 14 calls this month, 3 saved a flooded ceiling\n• TV mounts ramping early for football season — book in May for August\n• Reminder: $295 4-hour honey-do bundle is our best value\n\nDave' },
        { id: 'task-3', task_type: 'blog_post', frequency: 'monthly', status: 'active', last_run: daysAgo(7), next_run: daysAhead(23), last_output: 'The ATX Homeowner Maintenance Calendar (What to Do When)\n\nYou bought a house. Congrats. Now nobody told you that homeownership has a maintenance schedule, and ignoring it costs about $4,000–$8,000 a year in compounded damage...' },
        { id: 'task-4', task_type: 'review_response', frequency: 'weekly', status: 'active', last_run: daysAgo(2), next_run: daysAhead(5), last_output: 'Mike — fair. We missed it on yours. Gabe should have run the shop vac before leaving. Bringing a credit on the next visit ($45 off). Text me direct anytime: 512-555-0166. — Dave' },
        { id: 'task-5', task_type: 'competitor_report', frequency: 'biweekly', status: 'active', last_run: daysAgo(6), next_run: daysAhead(8), last_output: 'Bi-weekly competitor scan:\n\n• Mr. Handyman: still 35–50% above us. Run "no franchise markup" social ad.\n• Ace Handyman: heavy Google ads. Match LSA spend on TV mount keyword.\n• Austin Handyman Pros: dated website, no online pricing. Maintain our SEO advantage.' },
        { id: 'task-6', task_type: 'email', frequency: 'monthly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(26), last_output: 'Subject: 6-month check-in — anything piling up?\n\nHey {{first_name}}, Dave from ATX Honey Do. Hit me back with a list of things bugging you around the house — even small. The $295 4-hour bundle knocks out 8–12 typical items in one visit. — Dave' },
        { id: 'task-7', task_type: 'review_request', frequency: 'weekly', status: 'active', last_run: daysAgo(4), next_run: daysAhead(3), last_output: 'Subject: Quick favor\n\nHey {{first_name}}, hope the {{job}} held up. If you have 30 seconds, a Google review goes a long way for us — they\'re the way new clients find us. {{review_link}}. Thanks. — Dave' }
      ],
      referrals: [
        { id: 'ref-1', client_name: 'Bouldin Buyers Group', email: 'admin@bouldinbg.com', status: 'paid', created_at: daysAgo(120), referral_credit_awarded: true },
        { id: 'ref-2', client_name: 'South Lamar HOA', email: 'admin@slhoa.org', status: 'paid', created_at: daysAgo(75), referral_credit_awarded: true },
        { id: 'ref-3', client_name: 'Reedy Realty', email: 'jane@reedyrealty.com', status: 'paid', created_at: daysAgo(40), referral_credit_awarded: true },
        { id: 'ref-4', client_name: 'Tom Cabrera', email: 'tom.cab@example.com', status: 'trial', created_at: daysAgo(8), trial_ends_at: daysAhead(34) }
      ],
      chatTemplates: {
        social: 'Spring honey-do checklist for the homeowner who keeps "getting to it next weekend." 🛠️\n\n1. Weatherstrip on exterior doors\n2. Dryer vent (all the way to outside cap)\n3. Sink + tile reseal\n4. Garage door rollers + lube\n5. Exterior paint touch-up on south + west walls\n\nWe knock out the list in a 4-hour visit for $295 flat.',
        newsletter: 'Subject: This month at ATX Honey Do\n\nHey friends,\n\n• Gutter cleans booking 2 weeks out\n• HVAC drain pan checks saving ceilings\n• TV mounts ramping early for football\n• $295 4-hour bundle is the best value\n\nDave',
        blog_post: 'The ATX Homeowner Maintenance Calendar (What to Do When)\n\nYou bought a house. Now nobody told you that homeownership has a maintenance schedule. Here\'s the calendar I give every new client...',
        email: 'Subject: 6-month check-in — anything piling up?\n\nHey {{first_name}}, Dave from ATX Honey Do. Hit me back with a list of things bugging you. The $295 4-hour bundle knocks out 8–12 typical items in one visit. — Dave',
        review_response: '{{name}} — appreciate this. {{tech}} said the {{job}} job came together cleanly. Holler if anything pops up. — Dave',
        fallback: 'Tell me the platform (FB / IG / email / blog / review reply) and the situation (promo, education, customer follow-up, season prep) and I\'ll write something direct.'
      }
    }

  };

  // Public helpers
  window.BEACON_DEMO_BY_EMAIL = Object.values(window.BEACON_DEMO_PERSONAS).reduce((acc, p) => {
    acc[p.email.toLowerCase()] = p;
    return acc;
  }, {});

})();
