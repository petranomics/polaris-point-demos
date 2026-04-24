// /api/beacon/signup.js — Public signup with trial code or referral code
const { neon } = require('@neondatabase/serverless');

const PLAN_LIMITS = { lite: 50000, beacon: 200000, pro: 500000 };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    var b = req.body;

    // Code validation action (used by signup page for live feedback)
    if (req.query.action === 'validate_code') {
      if (!b.code) return res.status(400).json({ valid: false, error: 'Missing code' });
      var checkCode = b.code.toUpperCase();
      // Try trial code first
      var trialRows = await sql`
        SELECT code, tier, trial_weeks, max_uses, times_used FROM beacon_trial_codes
        WHERE code = ${checkCode}
          AND (max_uses = 0 OR times_used < max_uses)
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
      if (trialRows.length) {
        return res.json({
          valid: true,
          type: 'trial',
          message: trialRows[0].trial_weeks + '-week trial on Beacon ' + trialRows[0].tier.charAt(0).toUpperCase() + trialRows[0].tier.slice(1)
        });
      }
      // Check referral code
      var refRows = await sql`SELECT client_name FROM beacon_subscriptions WHERE referral_code = ${checkCode} AND status = 'active'`;
      if (refRows.length) {
        return res.json({
          valid: true,
          type: 'referral',
          message: '1 month free — referred by ' + (refRows[0].client_name || 'a friend')
        });
      }
      return res.json({ valid: false, error: 'Invalid or expired code' });
    }

    if (!b.email || !b.password_hash || !b.name) {
      return res.status(400).json({ error: 'Missing name, email, or password' });
    }

    // Check if email already has a subscription
    var existing = await sql`SELECT id FROM beacon_subscriptions WHERE client_email = ${b.email}`;
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    var plan = 'lite';
    var industry = b.industry || 'general';
    var trialWeeks = 0;
    var referredByCode = null;
    var codeType = null; // 'trial' or 'referral'

    // Check trial code first
    if (b.code) {
      var codeRows = await sql`
        SELECT * FROM beacon_trial_codes
        WHERE code = ${b.code.toUpperCase()}
          AND (max_uses = 0 OR times_used < max_uses)
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
      if (codeRows.length) {
        codeType = 'trial';
        plan = codeRows[0].tier;
        trialWeeks = codeRows[0].trial_weeks;
        industry = codeRows[0].industry || industry;
        // Increment code usage
        await sql`UPDATE beacon_trial_codes SET times_used = times_used + 1 WHERE id = ${codeRows[0].id}`;
      } else {
        // Check if it's a referral code
        var refRows = await sql`SELECT id, client_name FROM beacon_subscriptions WHERE referral_code = ${b.code.toUpperCase()} AND status = 'active'`;
        if (refRows.length) {
          codeType = 'referral';
          referredByCode = b.code.toUpperCase();
          // New user gets 1 free month trial-style
          trialWeeks = 4;
        } else {
          return res.status(400).json({ error: 'Invalid or expired code' });
        }
      }
    } else {
      // No code = no free trial, must pay
      return res.status(400).json({ error: 'Signup requires a trial or referral code. Contact hello@polarispoint.io for access.' });
    }

    // Generate unique referral code for this new user
    var baseName = (b.name || 'user').toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) || 'USER';
    var newRefCode;
    for (var attempts = 0; attempts < 5; attempts++) {
      newRefCode = baseName + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      var collision = await sql`SELECT id FROM beacon_subscriptions WHERE referral_code = ${newRefCode}`;
      if (!collision.length) break;
    }

    // Calculate trial end date
    var trialEnds = null;
    if (trialWeeks > 0) {
      trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + (trialWeeks * 7));
    }

    // Create subscription
    var sub = await sql`
      INSERT INTO beacon_subscriptions (
        client_name, client_email, client_password_hash,
        plan, tokens_limit, status, industry, billing_term,
        referral_code, referred_by_code, trial_ends_at
      )
      VALUES (
        ${b.name}, ${b.email}, ${b.password_hash},
        ${plan}, ${PLAN_LIMITS[plan]}, 'active', ${industry}, ${trialWeeks > 0 ? 'trial' : 'monthly'},
        ${newRefCode}, ${referredByCode}, ${trialEnds}
      )
      RETURNING *
    `;

    var newSubId = sub[0].id;

    // Create default tasks for their plan + industry
    if (industry === 'real_estate') {
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'listing_post', 'weekly', NOW() + INTERVAL '7 days')`;
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'social_post', 'weekly', NOW() + INTERVAL '7 days')`;
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'newsletter', 'monthly', NOW() + INTERVAL '30 days')`;
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'past_client_nurture', 'monthly', NOW() + INTERVAL '30 days')`;
    } else {
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'social_post', 'weekly', NOW() + INTERVAL '7 days')`;
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'newsletter', 'monthly', NOW() + INTERVAL '30 days')`;
      await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
        VALUES (${newSubId}, 'blog', 'monthly', NOW() + INTERVAL '14 days')`;
    }

    // If used a referral code, award the referrer a free month
    if (referredByCode) {
      var referrerRows = await sql`SELECT id, trial_ends_at, free_months_earned FROM beacon_subscriptions WHERE referral_code = ${referredByCode}`;
      if (referrerRows.length) {
        var referrer = referrerRows[0];
        // Track the referral
        await sql`INSERT INTO beacon_referrals (referrer_subscription_id, referee_subscription_id, referral_code, free_month_awarded)
          VALUES (${referrer.id}, ${newSubId}, ${referredByCode}, true)`;
        // Extend referrer's trial by 30 days OR increment their free_months_earned
        if (referrer.trial_ends_at) {
          var newEnd = new Date(referrer.trial_ends_at);
          newEnd.setDate(newEnd.getDate() + 30);
          await sql`UPDATE beacon_subscriptions
            SET trial_ends_at = ${newEnd}, free_months_earned = free_months_earned + 1
            WHERE id = ${referrer.id}`;
        } else {
          await sql`UPDATE beacon_subscriptions
            SET free_months_earned = free_months_earned + 1
            WHERE id = ${referrer.id}`;
        }
      }
    }

    return res.json({
      success: true,
      subscription: sub[0],
      code_type: codeType,
      trial_weeks: trialWeeks
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
