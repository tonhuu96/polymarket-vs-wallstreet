# Divergence commentator — reference agent

A runtime-agnostic specification for an LLM-driven agent that consumes this dashboard, narrates divergences, and posts alerts when a spread blows out. Drop this into OpenClaw, Hermes, n8n, a cron'd shell script, anything.

The dashboard already does the math. The agent's job is **interpretation, attribution, and delivery** — not data collection.

---

## Job-to-be-done

> "Tell me when Polymarket and Wall Street disagree by enough that it's worth a glance, and explain plausibly why they might be diverging."

That's the whole brief. Everything below is implementation.

---

## Inputs

- **Required**: `GET /api/markets` (see [`api-contract.md`](api-contract.md))
- **Optional**: `GET /api/history` for trend context ("the spread has been widening for 3 days" reads better than a single point)
- **Optional**: any news source the runtime has access to (NewsAPI, RSS, Bloomberg) for context-injection on widening pairs

---

## System prompt (drop-in)

```
You are the divergence commentator for a cross-market arbitrage dashboard
that compares Polymarket prediction-market odds against Wall Street
options-implied probabilities for four binary events: two upcoming Fed
meetings, Bitcoin > $150k by year-end, and SPX hitting 7,400 by year-end.

Each polling cycle you receive a JSON snapshot of all four pairs. Your task
is to produce ONE short message that:

1. Names the largest absolute spread.
2. States both numbers and the gap in percentage points.
3. Offers ONE plausible reason markets might be diverging — economic context,
   liquidity skew, expiry mismatch, or "no obvious catalyst, may be Polymarket
   illiquidity". Keep it humble; you do not know what's true, only what's
   priced.
4. Does NOT recommend a trade. Editorial copy in `tradable` is suggestive,
   not advice. Phrase as "the divergence implies someone is wrong" not
   "buy X / sell Y".
5. Skips pairs where `demo: true` — those are fallback values from a failing
   data source and any commentary on them is fiction.

Output format: 2 sentences plain text, no markdown, no emoji. Suitable for
posting to Telegram or Slack. Under 280 characters.

If no pair has |spread| >= the alert threshold (configured per runtime,
default 10pp), output the literal string "QUIET" and nothing else.
```

---

## Behavior

### Polling cadence

| Mode | Cadence | When |
|------|---------|------|
| Idle | 5 min | Default — match the server cache. |
| Active | 1 min | After any pair crosses the alert threshold; revert after the spread relaxes for a full poll. |
| On-demand | per-call | Slash-command / API trigger. |

### Alert thresholds

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `INFO_SPREAD_PP` | 10 | Mention the pair in a daily digest. |
| `ALERT_SPREAD_PP` | 15 | Push a notification (Telegram, Slack). |
| `URGENT_SPREAD_PP` | 25 | Mark "@channel" / high-priority. |

These are absolute values of the spread (`Math.abs(pair.spread)`).

### Deduplication

The agent should track a small in-memory or persisted state per pair:

- `lastSpread`: last spread the agent saw
- `lastAlertAt`: when it last fired an `ALERT`-level notification

Re-fire an alert only if EITHER:
- the spread direction flipped sign, OR
- it crossed a higher threshold band (10→15→25), OR
- 6 hours have passed since `lastAlertAt`

Otherwise stay silent. The dashboard is the persistent surface; the agent is the interrupting one.

---

## Output channels

The agent doesn't care where output goes. Common targets:

- **Telegram** (recommended for solo use): one bot, one chat, plain text.
- **Slack / Discord**: webhook URL, plain text or simple Block Kit.
- **Akane's `/api/markets` itself**: if you want commentary inline on the dashboard, expose a `/api/commentary` route that the agent writes to.

The reference output payload (Telegram-friendly):

```
SPX 7,400 by year-end · Polymarket 80.5% / Wall St 41.2% · gap 39.3pp
Prediction market is far more bullish than SPY options imply; could be Polymarket illiquidity in long-dated contracts, or genuine retail conviction not reflected in flow.
```

---

## Reference flow

```
every N seconds:
  res = GET /api/markets
  for pair in res.pairs:
    if pair.demo: skip
    band = classify(abs(pair.spread))   # NONE | INFO | ALERT | URGENT
    if band > NONE and should_fire(pair, band, state):
      message = llm.complete(system_prompt + json(pair) + recent_history(pair))
      if message != "QUIET":
        deliver(message, channel_for(band))
      state.update(pair, band)
  sleep(cadence(state))
```

---

## Anti-patterns

These are easy to do and they all degrade the integration:

- **Polling faster than 30 s.** Server cache is 5 min. You'll just see stale data faster.
- **Calling source APIs directly.** Polymarket Gamma, Deribit, Yahoo all rate-limit and the dashboard already absorbs that pain. Bypassing it creates divergence between agent commentary and dashboard view.
- **Generating commentary on `demo: true` pairs.** That data is fictional. The agent will hallucinate plausible-sounding nonsense.
- **Re-firing on every poll.** Use the deduplication rules above. Inbox fatigue kills the integration.
- **Trading recommendations.** This is editorial commentary, not financial advice. The system prompt is explicit about this for a reason.
- **Persisting beyond what's needed.** Last-spread + last-alert per pair is enough. No need for a database.

---

## Variants

Same contract, different flavors:

- **Daily digest agent**: runs once at 09:00 ET, summarizes all 4 pairs and the day's biggest move. No real-time alerts.
- **Wide-spread chaser**: only fires on `URGENT_SPREAD_PP`, attaches NewsAPI headlines from the relevant ticker.
- **Devil's advocate**: every alert, the agent argues *both* sides — why Polymarket might be right, why Wall Street might be right.

All three reuse the same API and the same system-prompt scaffolding; they differ only in cadence + delivery + minor prompt edits.
