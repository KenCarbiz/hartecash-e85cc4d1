/**
 * Default email & SMS templates for every notification trigger.
 * Placeholders: {{customer_name}}, {{vehicle}}, {{mileage}}, {{offer_amount}},
 * {{portal_link}}, {{appointment_date}}, {{appointment_time}}, {{location}},
 * {{dealership_name}}, {{status}}, {{guarantee_days}}
 */

export interface TemplateDefaults {
  email_subject: string;
  email_body: string;
  sms_body: string;
  channels?: string[];
}

export const DEFAULT_TEMPLATES: Record<string, TemplateDefaults> = {
  /* ───── Staff triggers ───── */
  new_submission: {
    email_subject: "New Vehicle Submission — {{vehicle}}",
    email_body:
      "A new submission has been received.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nMileage: {{mileage}}\n\nView it in the admin dashboard to review and make an offer.",
    sms_body:
      "New submission from {{customer_name}} for their {{vehicle}}. Review it in the admin dashboard.",
  },
  hot_lead: {
    email_subject: "🔥 Hot Lead — {{customer_name}}",
    email_body:
      "A submission has been flagged as a hot lead.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThis lead meets your configured offer rules for priority follow-up.",
    sms_body:
      "🔥 Hot Lead: {{customer_name}} — {{vehicle}}. Flagged for priority follow-up.",
  },
  appointment_booked: {
    email_subject: "New Appointment — {{customer_name}}",
    email_body:
      "A customer has scheduled an inspection.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}",
    sms_body:
      "New appt: {{customer_name}} — {{vehicle}} on {{appointment_date}} at {{appointment_time}}.",
  },
  photos_uploaded: {
    email_subject: "Photos Uploaded — {{vehicle}}",
    email_body:
      "{{customer_name}} has uploaded photos for their {{vehicle}}. Review them in the admin dashboard.",
    sms_body: "{{customer_name}} uploaded photos for their {{vehicle}}.",
  },
  docs_uploaded: {
    email_subject: "Documents Uploaded — {{vehicle}}",
    email_body:
      "{{customer_name}} has uploaded documents for their {{vehicle}}. Review them in the admin dashboard.",
    sms_body: "{{customer_name}} uploaded documents for their {{vehicle}}.",
  },
  status_change: {
    email_subject: "Status Update — {{vehicle}}",
    email_body:
      "A submission status has been updated.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nNew Status: {{status}}",
    sms_body:
      "Status update: {{customer_name}} — {{vehicle}} is now \"{{status}}\".",
  },
  staff_customer_accepted: {
    email_subject: "🎉 Customer Accepted Offer — {{customer_name}}",
    email_body:
      "Great news! {{customer_name}} has accepted the offer on their {{vehicle}}.\n\nOffer Amount: {{offer_amount}}\n\nFollow up to schedule their inspection visit.",
    sms_body:
      "🎉 {{customer_name}} accepted the offer on their {{vehicle}} ({{offer_amount}}). Follow up to schedule!",
  },
  staff_deal_completed: {
    email_subject: "✅ Deal Completed — {{customer_name}}",
    email_body:
      "A deal has been completed.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThe purchase has been finalized.",
    sms_body: "✅ Deal completed: {{customer_name}} — {{vehicle}}.",
  },

  /* ───── Customer triggers ───── */
  customer_offer_ready: {
    email_subject: "Your Offer Is Ready — {{dealership_name}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news! We've reviewed your {{vehicle}} and your personalized offer is ready.\n\nClick below to view your offer:\n{{portal_link}}\n\nThis offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your offer for your {{vehicle}} is ready! View it here: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_increased: {
    email_subject: "Great News — Your Offer Has Been Increased!",
    email_body:
      "Hi {{customer_name}},\n\nWe've increased the offer on your {{vehicle}}!\n\nView your updated offer:\n{{portal_link}}\n\nDon't wait — this offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, great news! We've increased our offer on your {{vehicle}}. View it: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_accepted: {
    email_subject: "Offer Accepted — Next Steps for Your {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nThank you for accepting our offer on your {{vehicle}}!\n\nOffer Amount: {{offer_amount}}\n\nNext Steps:\n1. Schedule your inspection visit\n2. Bring your title, registration, and valid ID\n3. We'll handle the rest!\n\nSchedule now: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your offer of {{offer_amount}} for your {{vehicle}} is confirmed! Schedule your visit: {{portal_link}} — {{dealership_name}}",
  },
  customer_appointment_booked: {
    email_subject: "Appointment Confirmed — {{appointment_date}}",
    email_body:
      "Hi {{customer_name}},\n\nYour inspection is confirmed!\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}\nAddress: {{location_address}}\nVehicle: {{vehicle}}\n\nWhat to Bring:\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Info (if applicable)\n\nYour inspection takes about 15-20 minutes.\n\nSee you there!\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your visit is confirmed for {{appointment_date}} at {{appointment_time}} at {{location}}. Bring your ID, title/registration, and all keys. — {{dealership_name}}",
  },
  customer_appointment_reminder: {
    // Strategist-audit dead-phrase fix: dropped "Just a friendly
    // reminder" + injected {{rep_name_short}} so the customer hears
    // from a named human, not a system.
    email_subject: "You're on the books for tomorrow at {{appointment_time}}",
    email_body:
      "Hi {{customer_name}},\n\n{{rep_name_short}} here — confirming your inspection tomorrow at {{appointment_time}}, {{location}}, for the {{vehicle}}.\n\nWhat to bring:\n• Driver's license\n• Vehicle title (or registration if your lender holds the title)\n• All keys + remotes\n• Loan payoff letter if you still owe on it\n\nDon't detail it and don't fix anything beforehand — we'd rather see the car as-is.\n\nReply to this and it goes straight to {{rep_name_short}}.\n\n— {{dealership_name}}",
    sms_body:
      "{{customer_name}} — {{rep_name_short}} here, confirming you for tomorrow at {{appointment_time}} at {{location}}. Bring ID, title (or registration), all keys. — {{dealership_name}}",
  },
  customer_appointment_reminder_dayof: {
    email_subject: "Your inspection is today at {{appointment_time}}",
    email_body:
      "Hi {{customer_name}},\n\nYour vehicle inspection is TODAY!\n\nTime: {{appointment_time}}\nLocation: {{location}}\nAddress: {{location_address}}\nVehicle: {{vehicle}}\n\nWhat to Bring:\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Info (if applicable)\n\nWhen you head out: {{arrive_url}}?status=on_the_way\nWhen you get here: {{arrive_url}}?status=arrived\n\nYour inspection takes about 15-20 minutes.\n\nWe look forward to seeing you!\n{{dealership_name}}",
    sms_body:
      "Reminder: Your inspection is today at {{appointment_time}} at {{location_name}}. Tap when you head out: {{arrive_url}}?status=on_the_way — or when you arrive: {{arrive_url}}?status=arrived. Bring ID, title/registration, all keys. — {{dealership_name}}",
  },
  customer_self_checkin_link: {
    // T-3h before the appointment. The two URLs are the heart of the
    // self-check-in flow — customer taps one, the front desk sees the
    // status flip on FrontDesk + the customer file's Greeting Card
    // strip without needing to visually spot the customer at the
    // counter.
    email_subject: "Heading our way? Tap one button when you do",
    email_body:
      "Hi {{customer_name}},\n\nYour inspection is coming up at {{appointment_time}} at {{location}}.\n\nWhen you leave home, tap: {{arrive_url}}?status=on_the_way\nWhen you pull in, tap: {{arrive_url}}?status=arrived\n\nWe'll have your file pulled and the bay ready before you walk in. See you soon.\n\n{{dealership_name}}",
    sms_body:
      "{{customer_name}} — heads-up that {{location_name}} is ready for you at {{appointment_time}}. Tap when you head out: {{arrive_url}}?status=on_the_way — or when you arrive: {{arrive_url}}?status=arrived. — {{dealership_name}}",
  },
  // ── Education suite — content-rich emails the dealer can drip
  // post-decline OR pre-decision. Each carries a real reason the
  // customer benefits from selling to us instead of going wholesale
  // (CarMax/Carvana) or private (Craigslist/FB Marketplace).
  // Anchored in citable industry numbers from the May-2026
  // voice-AI-training research; phrasing matches the dealer-floor-
  // direct voice the objection playbook uses.

  customer_education_private_sale_risks: {
    // The "if you sell it private here's what really happens" email.
    // Open-title risk gets its own paragraph because it's the single
    // most-misunderstood liability consumers carry without realizing.
    email_subject: "Selling private? A few things worth knowing first",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "You mentioned selling your {{vehicle}} privately — totally fair, the headline number on Craigslist or Facebook Marketplace is usually higher than what any dealer will pay. Before you commit, here are the things most folks don't think about until they're in the middle of it.\n\n" +
      "OPEN-TITLE EXPOSURE — the biggest one\n" +
      "If you sign the back of your title and hand it to a private buyer who doesn't immediately register the car in their name, you have what's called an \"open title.\" Until that buyer takes the title to the DMV, YOU are still the registered owner. That means parking tickets, toll violations, accidents, and abandoned-vehicle fines all come back to you — sometimes for months. State DMVs report hundreds of these cases per year per state. There is no easy way to force the buyer to register; you'd have to sue them.\n" +
      "How we avoid this: when you sell to us, our title clerk takes the title directly from your hand to the DMV. The car is re-titled to the dealership before anyone drives off our lot.\n\n" +
      "TEST-DRIVE LIABILITY\n" +
      "If a private buyer test-drives your car and crashes it before you've signed and they've paid, your insurance is on the hook. Your premium goes up. Your deductible applies. We've seen it more than once.\n" +
      "How we avoid this: you don't hand the keys to a stranger. The car never moves until we've cut you a check.\n\n" +
      "CHECK FRAUD\n" +
      "Cashier's checks, certified checks, and bank drafts can all be forged convincingly. Banks don't confirm a check is real for 7-10 business days even though they release the funds for the customer to use. By then, your buyer is gone with the car.\n" +
      "How we avoid this: real check, drawn on the dealership's account, cleared before you leave.\n\n" +
      "TIME ON MARKET\n" +
      "The average private-party listing takes 30-60 days to sell. That's an hour or two of your time per buyer who shows up — most of whom don't buy. If your time is worth $30/hr, the math closes faster than you'd think.\n\n" +
      "PERSONAL SAFETY\n" +
      "Strangers coming to your house at the times that work for them. We don't have to belabor it; if you've sold a car privately before, you know the feeling.\n\n" +
      "TAX-CREDIT MATH\n" +
      "If you're going to buy another car this year, trading instead of selling private captures the sales-tax credit on your trade allowance — typically 5-9% of the trade value depending on state. That's real money the private buyer doesn't give you.\n\n" +
      "I'm not trying to talk you out of selling private — sometimes the dollar gap is real. I just want you to compare with the full picture in front of you. Our offer of {{offer_amount}} is locked through {{lock_expires}} if you'd like a fallback.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "{{customer_name}} — heads up on private sales. Big one: if a buyer signs the title but doesn't register it, YOU stay liable for tickets/tolls/accidents until they do. Plus check fraud, test-drive liability, 30-60 day average time. Quick read: {{portal_link}}. Our offer of {{offer_amount}} is locked through {{lock_expires}} if you want a fallback. — {{rep_name_short}}",
  },

  customer_education_wholesale_vs_retail: {
    // The "where your car actually goes" piece. We do NOT name
    // competitors proactively — naming them promotes them. The
    // industry stat (30-40% of online-buyer purchases get wholesaled
    // at auction) is citable as "publicly published annual reports"
    // without naming the brand. The objection playbook handles the
    // named-competitor case when the customer brings one up.
    email_subject: "Where your car actually goes after you sell it",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "Quick honest comparison since the question comes up a lot — what happens to your car after you sell it depends entirely on whether the buyer is a wholesaler or a retailer.\n\n" +
      "THE WHOLESALE MODEL\n" +
      "Most of the big online buyers operate on a wholesale-and-flip model. Their published annual reports show 30-40% of the vehicles they buy get sold at wholesale auction, often within a week or two. Your car becomes one of thousands moving through the auction registry, where your title chain is visible to every dealer who bids on it. There's no way for the seller to know in advance whether their car ends up retailed by the buyer or shipped to auction.\n\n" +
      "Some online buyers also condition their offer on a separate inspection at pickup. Reductions are case-by-case and unpublished — once their truck is in your driveway, the negotiating leverage is theirs.\n\n" +
      "OUR MODEL\n" +
      "We're a single dealership. We bought your {{vehicle}} for our own retail lot. We'll recondition it, photograph it, list it, and sell it to a customer in the next 30-45 days. Your title and your contact information stay in this building. Three people see your name on this transaction: me, our title clerk, and the DMV. That's it.\n\n" +
      "If you'd rather see what we're going to list your car as, here's our current inventory: {{portal_link}}\n\n" +
      "Your offer of {{offer_amount}} is locked through {{lock_expires}}.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "Quick honest one — the big online buyers wholesale 30-40% of what they buy (their own annual reports). We're a single store buying your {{vehicle}} for our lot. Title stays here, three people see your name. {{portal_link}} — {{rep_name_short}}",
  },

  customer_education_title_data_flow: {
    // The "where your information goes" piece. Often the closer for
    // a customer who's been burned before or is naturally privacy-
    // conscious.
    email_subject: "Where your information goes when you sell to us",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "Privacy questions come up a lot, especially since the big online buyers wholesale most of what they take in. Here's the actual data flow when you sell to {{dealership_name}}:\n\n" +
      "1. You hand us the title and ID. Our title clerk photographs both into our internal system. The originals go in a locked cabinet until DMV processing.\n" +
      "2. Our title clerk takes the title to the DMV (or submits electronically if your state supports it). The DMV re-titles the car to the dealership.\n" +
      "3. Your name comes off the registration. We are now the registered owner of record.\n" +
      "4. We list the car for retail. The new buyer's name goes on the next title — your name never touches their transaction.\n\n" +
      "Three people see your name during this: me (your acquisition contact), our title clerk, and the DMV. That's the whole list.\n\n" +
      "Compare to a wholesale flow: a CarMax-style operation logs your title in their system, ships the car to auction, the auction registry exposes the title chain to every dealer who bids, the winning dealer takes the title, retitles in their state, often adds another step if they ship out of state. Your information has touched 5-15 organizations by the time the car finds a new owner. None of those organizations are bound by what you agreed to with the buyer up front.\n\n" +
      "If you'd like a written privacy commitment from {{dealership_name}}, just reply and our GM will send one over on letterhead. Costs nothing, and a few customers have asked for it.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "Quick one on privacy — your name and title at {{dealership_name}} touch 3 people: your contact, our title clerk, and the DMV. With wholesale flows it's 5-15 orgs because the car goes to auction. Reply if you want a written privacy commitment from our GM. — {{rep_name_short}}",
  },

  customer_education_payoff_timeline: {
    // The "if you owe money on the car, here's how it works"
    // explainer. Negative-equity prevalence sits at ~29% of trades
    // per Edmunds Q4 2025 — most customers in this state feel alone
    // and embarrassed; lead with the data point so they don't.
    email_subject: "If you have a loan on the car — how the payoff works",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "Quick rundown so this part doesn't feel mysterious. Roughly 29% of vehicles being sold in the US right now have an active loan with a balance higher than the car's value — you're not alone if that's where you sit, and it's not a deal-killer either way.\n\n" +
      "STEP 1 — Get the real payoff number\n" +
      "We send your lender a payoff authorization form (you sign it, we fax/email it). The lender returns a 10-day payoff letter — the exact dollar amount needed to clear the loan, including unearned interest you'll get back. Captive lenders (Toyota Financial, Ford Credit, BMW FS) often respond same day. Most banks: 2-5 business days. Credit unions: typically 10 business days.\n\n" +
      "STEP 2 — Compare payoff to offer\n" +
      "If the payoff is LESS than {{offer_amount}}, we send the difference to you and the lender directly. Your loan is closed; your title is released to us; you're done.\n" +
      "If the payoff is MORE than {{offer_amount}} (negative equity), the gap can be covered out of pocket OR rolled into a new financing arrangement if you're trading into another vehicle. Either way, we walk through the math with you before anything is signed.\n\n" +
      "STEP 3 — Title release\n" +
      "Once the lender is paid, they release the title to us. Some captive lenders do this electronically same-day. Banks send a hard-copy lien release in 2-3 weeks. Credit unions hold the title another 10 business days after payoff before releasing.\n\n" +
      "Translation: from your perspective, you sign the payoff authorization today, we cut you a check today (less the loan balance), and you walk out done. The title cleanup happens on our end.\n\n" +
      "Want to start the payoff authorization now so it's not the bottleneck on inspection day? Reply YES and I'll text you the link.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "Quick one on the loan — about 29% of trades nationally are underwater, average gap $7,214 (Edmunds Q4 2025). We send your lender a payoff auth, they return a 10-day payoff letter. If you owe less than {{offer_amount}}, you get the difference. If more, we walk you through options. Want to start the auth now? Reply YES. — {{rep_name_short}}",
  },

  customer_education_inspection_prep: {
    // T-48h to T-24h before the inspection. Removes the friction
    // list (don't detail it, don't fix anything, here's what to
    // bring) — strategist-flagged opportunity for warmth.
    email_subject: "Before your inspection at {{dealership_name}}",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "Quick prep so your inspection day is the easy day.\n\n" +
      "DON'T DETAIL IT\n" +
      "Seriously — please don't pay for a detail. We're going to look at the car as-is, and a freshly-detailed car can hide things our appraiser would normally call out and fix later. You'll do better skipping the $200 detail fee.\n\n" +
      "DON'T FIX ANYTHING\n" +
      "If there's a known issue (a check-engine light, a small dent, a worn tire), don't repair it before bringing the car in. Tell us what you know. Repairs done outside our network rarely move the offer favorably; honesty about known issues almost always preserves it.\n\n" +
      "WHAT TO BRING\n" +
      "• Driver's license (yours and any co-titler's)\n" +
      "• Vehicle title — or, if your lender holds it, your most recent registration plus the lender's name and your account number\n" +
      "• All keys and remotes (yes, even the spare)\n" +
      "• Owner's manual if you have it\n" +
      "• Loan payoff letter if we haven't already pulled one\n\n" +
      "WHAT WE'LL DO IN THE 30-MINUTE INSPECTION\n" +
      "Walk-around with you (we encourage you to come along — most customers like seeing what we're looking at), tire-tread and brake check, road test on a 2-mile loop, full diagnostic scan, paperwork verification. If you'd rather wait in the lounge, that's fine too — we'll text you when it's done.\n\n" +
      "WHAT WE'LL TELL YOU AT THE END\n" +
      "Your final number. If it matches the offer of {{offer_amount}}, we move to paperwork. If anything we found requires a small adjustment, we walk you through what we saw, line by line. You decide whether to proceed.\n\n" +
      "See you soon.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "Heads up before your inspection: DON'T detail it (a detail can hide what we'd normally fix on our dime). DON'T fix anything yourself. Bring license, title (or registration + lender name), all keys, payoff letter if you have one. We do a 30-min walk-around — you can ride along. — {{rep_name_short}}",
  },

  customer_decline_winback_benefits: {
    // The post-decline content-rich email. NOT a "we miss you" plea
    // — it's the dealer's positioning argument distilled. Pulls
    // from the objection playbook lines and the citable data the
    // voice-AI-training research surfaced. Includes the trade-up
    // incentive variable so dealers who configure one have it
    // surfaced; degrades gracefully when no incentive is set.
    email_subject: "Worth a second look on your {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "I saw the offer didn't move forward. I'm not going to keep emailing you — but if it would help to see the comparison clearly before you go elsewhere, here it is in one place.\n\n" +
      "WHAT MAKES OUR OFFER DIFFERENT\n\n" +
      "1. Title and information stay in our building\n" +
      "Three people see your name: me, our title clerk, and the DMV. That's it. Online wholesale buyers move 30-40% of what they take in to auction (their own annual reports), which means your title information touches every dealer who bids.\n\n" +
      "2. Locked, in writing, for 7 days\n" +
      "Your offer of {{offer_amount}} doesn't change at inspection unless we find something specific (and we walk you through it line by line if we do). The first $0-500 of any inspection difference, we eat — not you.\n\n" +
      "3. Match a written offer\n" +
      "If you've got a written offer in hand from anyone else that beats ours, send it over and we'll see what we can do on the spot. No re-appraisal, no inspection games.\n\n" +
      "4. Same-day check\n" +
      "From your driveway to a check in your hand: typically 30-45 minutes once you're at the dealership. Most folks expect this to take a day or two — it doesn't.\n\n" +
      "5. {{trade_up_block}}\n\n" +
      "WHAT YOU'RE COMPARING TO\n\n" +
      "Selling private: 30-60 days on market on average, plus the open-title liability (you stay on the registration until the buyer registers, which means tickets and accidents come back to you), plus check fraud risk, plus the time tax of running ads and screening buyers.\n\n" +
      "Online wholesale buyers: their numbers can move at inspection — most don't publish what the reduction range looks like. Combined, the major online players wholesale roughly 40% of what they buy, so your car may not stay with the buyer; it likely ends up at auction within a week.\n\n" +
      "If the math still doesn't work for you, no hard feelings. Auction prices are running about 0.5% higher than they were last week (Manheim Index 213.0) — if you want to revisit in 30 days, I'll re-quote based on the market then.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}",
    sms_body:
      "{{customer_name}} — quick recap on your {{vehicle}}: title + info stay with us, written offers honored, same-day check, first $500 of inspection delta we eat. {{trade_up_short}} Full comparison: {{portal_link}} — {{rep_name_short}}",
  },

  customer_offer_accepted_v2: {
    // Strategist-recommended rewrite of customer_offer_accepted in
    // the voice of customer_manager_signed_extension — prose-first,
    // named rep up top, doc checklist as P.S. Use this template key
    // for new acceptances; the legacy customer_offer_accepted stays
    // available for tenants that haven't migrated.
    email_subject: "Confirmed — {{rep_name_short}} from {{dealership_name}}",
    email_body:
      "Hi {{customer_name}},\n\n" +
      "{{rep_name_short}} here. Thanks for accepting the offer of {{offer_amount}} on your {{vehicle}}. Wanted to reach out personally so you have a name and a face on the other end of this rather than just a confirmation email.\n\n" +
      "{{trade_up_block}}\n\n" +
      "Next step is the inspection — about 30 minutes door to door, you can ride along with the appraiser if you want, and the check is cut the same visit. You can pick a time here: {{portal_link}}\n\n" +
      "If anything comes up between now and then — questions, schedule changes, paperwork wrinkles — just reply to this email and it goes straight to me.\n\n" +
      "Looking forward to meeting you.\n\n" +
      "— {{rep_name_short}}, {{dealership_name}}\n\n" +
      "P.S. — what to bring on inspection day: driver's license, vehicle title (or registration plus your lender's name if they hold the title), all keys and remotes, and a loan payoff letter if you still owe on it. We'll handle every step from there.",
    sms_body:
      "Hi {{customer_name}} — {{rep_name_short}} from {{dealership_name}}. Thanks for locking in {{offer_amount}} on your {{vehicle}}. Pick an inspection time here: {{portal_link}} — about 30 min door to door, check the same visit. Reply with any questions; goes straight to me.",
  },

  customer_what_to_bring: {
    email_subject: "What to bring to your vehicle inspection",
    email_body:
      "Hi {{customer_name}},\n\nHere's what to bring to your upcoming vehicle inspection:\n\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Statement (if applicable)\n\nExpect your visit to take about 15-20 minutes.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "For your upcoming inspection, please bring: Driver's License, Title/Registration, all keys & remotes, and loan payoff info if applicable. Visit takes ~15-20 min. — {{dealership_name}}",
  },
  customer_inspection_started: {
    email_subject: "Inspection in progress — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nOur team is starting the inspection of your {{vehicle}} now. You'll get a quick update when we're done — usually 15-20 minutes.\n\nHang tight, and thanks for choosing {{dealership_name}}.",
    sms_body:
      "Hi {{customer_name}} — our team is starting your {{vehicle}} inspection now. Usually takes 15-20 min. We'll text when we're done. — {{dealership_name}}",
  },
  customer_inspection_progress: {
    email_subject: "Inspection progress — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nQuick update: tires and brakes have been checked on your {{vehicle}}. We're wrapping up the rest of the inspection and will send your final number shortly.\n\n— {{dealership_name}}",
    sms_body:
      "Quick update: tires & brakes checked on your {{vehicle}}, wrapping up the rest. Final number coming shortly. — {{dealership_name}}",
  },
  customer_inspection_complete: {
    email_subject: "Inspection Complete — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news! The inspection on your {{vehicle}} has been completed.\n\nWe're finalizing the details and will be in touch shortly with next steps.\n\nView your status: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, the inspection on your {{vehicle}} is complete! We'll follow up with next steps shortly. — {{dealership_name}}",
  },
  customer_check_ready: {
    email_subject: "Your Check Is Being Processed — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nYour check request for your {{vehicle}} has been submitted and is being processed.\n\nWe'll let you know as soon as it's ready for pickup.\n\nView your status: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your check for your {{vehicle}} is being processed. We'll notify you when it's ready! — {{dealership_name}}",
  },
  staff_escalation_overdue: {
    email_subject: "[OVERDUE] Escalation open {{minutes_open}}m — {{vehicle}}",
    email_body:
      "An escalation on {{customer_name}}'s {{vehicle}} has been open for {{minutes_open}} minutes without resolution.\n\nReason: {{escalation_reason}}\nNotes: {{escalation_notes}}\nEscalated by: {{escalation_created_by}}\n\nOpen the customer file: {{admin_link}}",
    sms_body:
      "Escalation open {{minutes_open}}m — {{customer_name}}'s {{vehicle}}. Reason: {{escalation_reason}}. Needs someone.",
  },
  staff_escalation_opened: {
    email_subject: "[ESCALATION] {{escalation_reason}} — {{customer_name}}",
    email_body:
      "{{escalation_created_by}} just escalated {{customer_name}}'s {{vehicle}}.\n\nReason: {{escalation_reason}}\nNotes: {{escalation_notes}}\n\nOpen the customer file: {{admin_link}}",
    sms_body:
      "Escalation: {{customer_name}} — {{vehicle}}. Reason: {{escalation_reason}}. Needs a manager.",
  },
  staff_customer_arrived: {
    email_subject: "Customer arrived — {{customer_name}}",
    email_body:
      "{{customer_name}} just checked in at reception for their {{vehicle}} inspection.\n\nHead to the front desk to greet them.\n\nCustomer file: {{admin_link}}",
    sms_body:
      "{{customer_name}} just arrived for their {{vehicle}} inspection. They're at the front desk.",
  },
  staff_customer_replied: {
    email_subject: "Customer texted back — {{customer_name}}",
    email_body:
      "{{customer_name}} just replied to one of your SMS messages.\n\n{{custom_body}}\n\nCustomer file: {{admin_link}}",
    sms_body: "{{custom_body}}",
  },
  customer_check_ready_for_pickup: {
    email_subject: "Your check is ready — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news — your check for the {{vehicle}} is ready for pickup. Come on by whenever works for you today.\n\nJust ask for your salesperson at the front desk.\n\nThank you,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}} — your check for the {{vehicle}} is ready! Come pick it up any time today. — {{dealership_name}}",
  },
  customer_purchase_complete: {
    email_subject: "Purchase Complete — Thank You!",
    email_body:
      "Hi {{customer_name}},\n\nCongratulations! The purchase of your {{vehicle}} is now complete.\n\nThank you for choosing {{dealership_name}}. If you have any questions, don't hesitate to reach out.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your {{vehicle}} purchase is complete! Thank you for choosing {{dealership_name}}.",
  },
  customer_appointment_rescheduled: {
    email_subject: "Your Appointment Has Been Rescheduled",
    email_body:
      "Hi {{customer_name}},\n\nYour inspection appointment has been rescheduled.\n\nNew Date: {{appointment_date}}\nNew Time: {{appointment_time}}\nLocation: {{location}}\nVehicle: {{vehicle}}\n\nIf you need to make changes, please contact us.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your appointment has been rescheduled to {{appointment_date}} at {{appointment_time}} at {{location}}. — {{dealership_name}}",
  },

  /* ───── Voice AI triggers ───── */
  voice_warmup_sms: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Hey {{customer_name}}, this is {{dealership_name}}. We have a cash offer ready for your {{vehicle_info}}. We'll give you a quick call shortly to discuss. Reply STOP to opt out.",
    channels: ["sms"],
  },
  customer_voicemail_followup: {
    email_subject: "We tried to reach you about your {{vehicle_info}}",
    email_body:
      "Hi {{customer_name}},\n\nWe just tried to give you a call about your {{vehicle_info}}. We have an offer of {{offer_amount}} ready for you.\n\nView your offer: {{offer_link}}\n\nReply to this email or call us anytime.",
    sms_body:
      "Hey {{customer_name}}, we just tried to reach you about your {{vehicle_info}}. Your ${{offer_amount}} offer is waiting: {{offer_link}}",
    channels: ["sms", "email"],
  },
  customer_missed_call_text: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Hey {{customer_name}}, this is {{dealership_name}}. We have a ${{offer_amount}} cash offer for your {{vehicle_info}}. Tap here to view: {{offer_link}}",
    channels: ["sms"],
  },
  customer_callback_confirmation: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Thanks for chatting, {{customer_name}}! We'll call you back as requested. In the meantime, your ${{offer_amount}} offer is here: {{offer_link}}",
    channels: ["sms"],
  },
};

/** Available placeholder variables with descriptions */
export const PLACEHOLDER_VARS: { key: string; desc: string }[] = [
  { key: "{{customer_name}}", desc: "Customer's full name" },
  { key: "{{vehicle}}", desc: "Year Make Model" },
  { key: "{{mileage}}", desc: "Vehicle mileage" },
  { key: "{{offer_amount}}", desc: "Dollar offer amount" },
  { key: "{{portal_link}}", desc: "Customer portal URL" },
  { key: "{{appointment_date}}", desc: "Appointment date" },
  { key: "{{appointment_time}}", desc: "Appointment time" },
  { key: "{{location}}", desc: "Dealership location" },
  { key: "{{location_address}}", desc: "Dealership street address" },
  { key: "{{location_name}}", desc: "Dealership location name" },
  { key: "{{dealership_name}}", desc: "Dealership name" },
  { key: "{{status}}", desc: "Submission status" },
  { key: "{{guarantee_days}}", desc: "Offer guarantee days" },
];
