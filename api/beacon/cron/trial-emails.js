// /api/beacon/cron/trial-emails.js — Queue trial expiration emails
// Runs daily at 9am CT. Checks all trial subscriptions and queues emails at
// the right stages: day 28, 35, 40, 42 (trial end → read-only), 65 (pre-delete).
// Emails queue into beacon_emails table; actual sending happens via sendTrialEmails()
// which can be hooked up to SendGrid/Resend/etc.
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Find trial subscriptions and work out what stage each is at
    var trials = await sql`
      SELECT id, client_name, client_email, plan, trial_ends_at,
             read_only_until, delete_after, status,
             EXTRACT(EPOCH FROM (trial_ends_at - NOW()))/86400 AS days_until_end,
             EXTRACT(EPOCH FROM (NOW() - trial_ends_at))/86400 AS days_past_end
      FROM beacon_subscriptions
      WHERE client_email IS NOT NULL
        AND (trial_ends_at IS NOT NULL OR read_only_until IS NOT NULL)
        AND status IN ('active', 'trial', 'read_only')
    `;

    var queued = [];

    for (var i = 0; i < trials.length; i++) {
      var t = trials[i];
      var daysUntilEnd = Math.round(t.days_until_end || 0);
      var daysPastEnd = Math.round(t.days_past_end || 0);
      var emailType = null;

      // Determine which email to queue based on days remaining/past end
      if (t.status === 'active' || t.status === 'trial') {
        if (daysUntilEnd === 14) emailType = 'trial_half';      // Day 28 of 42
        else if (daysUntilEnd === 7) emailType = 'trial_week';    // Day 35 of 42
        else if (daysUntilEnd === 2) emailType = 'trial_48h';     // Day 40 of 42
        else if (daysUntilEnd <= 0 && daysUntilEnd >= -1) emailType = 'trial_ended'; // Day 42
      } else if (t.status === 'read_only') {
        // Delete countdown starts after read-only period (30 days)
        if (daysPastEnd === 37) emailType = 'delete_warning';     // Day 65 (7 days before 72-day total)
      }

      if (!emailType) continue;

      // Skip if we already queued this type for this subscription today
      var existing = await sql`
        SELECT id FROM beacon_emails
        WHERE subscription_id = ${t.id}
          AND email_type = ${emailType}
          AND created_at > NOW() - INTERVAL '2 days'
      `;
      if (existing.length) continue;

      var email = buildEmail(emailType, t);
      await sql`
        INSERT INTO beacon_emails (subscription_id, email_type, subject, body, recipient, status)
        VALUES (${t.id}, ${emailType}, ${email.subject}, ${email.body}, ${t.client_email}, 'pending')
      `;

      // If we just hit "trial_ended", transition the subscription to read_only
      if (emailType === 'trial_ended') {
        var readOnlyUntil = new Date();
        readOnlyUntil.setDate(readOnlyUntil.getDate() + 30);
        var deleteAfter = new Date();
        deleteAfter.setDate(deleteAfter.getDate() + 30);
        await sql`
          UPDATE beacon_subscriptions
          SET status = 'read_only', read_only_until = ${readOnlyUntil}, delete_after = ${deleteAfter}
          WHERE id = ${t.id}
        `;
      }

      queued.push({ sub_id: t.id, type: emailType, recipient: t.client_email });
    }

    // Delete subscriptions that have passed their delete_after date
    var toDelete = await sql`
      SELECT id, client_email FROM beacon_subscriptions
      WHERE delete_after IS NOT NULL AND delete_after < NOW()
        AND status = 'read_only'
    `;
    for (var j = 0; j < toDelete.length; j++) {
      await sql`DELETE FROM beacon_subscriptions WHERE id = ${toDelete[j].id}`;
      queued.push({ deleted: toDelete[j].id, email: toDelete[j].client_email });
    }

    return res.json({ queued: queued.length, details: queued });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function buildEmail(type, sub) {
  var name = sub.client_name || 'there';
  var firstName = name.split(' ')[0];
  var trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  var deleteDate = sub.delete_after ? new Date(sub.delete_after).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  var portalLink = 'https://polarispoint.io/beacon';
  var subscribeLink = 'https://polarispoint.io/beacon#settings';

  if (type === 'trial_half') {
    return {
      subject: 'Your Beacon trial is halfway through',
      body: 'Hi ' + firstName + ',\n\nYou\'ve had Beacon running for 4 weeks now. Hope it\'s earning its keep.\n\nYou\'re two weeks away from the end of your trial. No charge yet — but now\'s a good time to think about where Beacon fits in your business long-term.\n\n→ Continue with Beacon: ' + subscribeLink + '\n→ Book a call to discuss: https://polarispoint.io/#booking\n\nIf you\'ve referred anyone, remember each successful referral gives you a free month. You can share your code from your Beacon dashboard.\n\n— Pete @ Polaris Point'
    };
  }

  if (type === 'trial_week') {
    return {
      subject: '7 days left on your Beacon trial',
      body: 'Hi ' + firstName + ',\n\nYour 6-week trial ends on ' + trialEnd + '. After that, your Beacon workspace goes read-only until you activate a paid plan.\n\nHere\'s what happens:\n\n✓ Your context and content history stay safe for 30 days\n⏸ New content generation, chat, and automated tasks pause\n✗ After 30 days of inactivity: everything is deleted\n\nThree ways to continue:\n\n1. Subscribe — Plans start at $89/mo on a 6-month commit (or $129/mo month-to-month)\n2. Refer a friend — You earn a free month for each signup\n3. Extend trial — Reply and tell us why you need more time\n\n→ Activate Subscription: ' + subscribeLink + '\n\n— Pete'
    };
  }

  if (type === 'trial_48h') {
    return {
      subject: 'Beacon trial ends in 48 hours',
      body: 'Hi ' + firstName + ',\n\nQuick heads up — your trial expires on ' + trialEnd + ' at 11:59 PM. After that, your workspace goes read-only.\n\nIf you want to keep Beacon running:\n\n→ Activate Subscription (60 seconds): ' + subscribeLink + '\n\nIf you\'re not ready yet, no problem — your data is safe for 30 days and you can come back anytime.\n\n— Pete'
    };
  }

  if (type === 'trial_ended') {
    return {
      subject: 'Your Beacon workspace is in read-only mode',
      body: 'Hi ' + firstName + ',\n\nYour trial ended. Your workspace is still there, but paused:\n\n✓ All your content, context, and chat history are preserved\n⏸ No new generation or automation until you activate a plan\n✗ Data will be permanently deleted on ' + deleteDate + '\n\n→ Activate Subscription: ' + subscribeLink + '\n→ Export Data: ' + portalLink + ' (Settings tab)\n\n— Pete'
    };
  }

  if (type === 'delete_warning') {
    return {
      subject: 'Last chance — your Beacon data deletes in 5 days',
      body: 'Hi ' + firstName + ',\n\nYour Beacon workspace has been inactive for 25 days. On ' + deleteDate + ', everything will be permanently deleted:\n\n- All chat history\n- All generated content\n- All business context you uploaded\n- Your competitor monitoring and scheduled tasks\n\nTwo options:\n\n→ Activate Subscription — keep everything, plans start at $129/mo: ' + subscribeLink + '\n→ Export Everything — download a zip: ' + portalLink + '\n\nNo response needed if you want to let it go — we\'ll handle the cleanup.\n\n— Pete'
    };
  }

  return { subject: '', body: '' };
}
