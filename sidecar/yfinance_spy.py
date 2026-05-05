"""
yfinance sidecar exposing SPY-options-implied probability of the SPX hitting
a target index level by a given expiry, using Black-Scholes N(d2).

Endpoint:
    GET /spy?target_index=7400&expiry=2026-12-31

Response:
    {
        "probability": 60.5,   # 0..100, P(S_T >= strike) under risk-neutral GBM
        "spot": 720.51,        # SPY spot from yfinance
        "strike": 740.0,       # SPY-equivalent strike (target / 10) -- closest available
        "iv": 0.183,           # implied volatility (decimal) of the chosen call
        "t_years": 0.65,       # time to expiry in years (365.25-day year)
        "expiry": "2026-12-31" # actual expiry used (yfinance closest available)
    }

Why this exists: yfinance handles Yahoo's anti-scrape "crumb" cookie/token
dance internally. Hitting query2.finance.yahoo.com directly from Node now
returns "Unauthorized -- Invalid Crumb".
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from math import log, sqrt
from typing import Annotated

import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from scipy.stats import norm

app = FastAPI(title="yfinance-spy-sidecar", version="0.1.0")

DAYS_PER_YEAR = 365.25


def probability_above_strike(spot: float, strike: float, t: float, vol: float, r: float = 0.0) -> float:
    """Risk-neutral P(S_T >= K) under GBM dynamics. Returns 0..1."""
    if spot <= 0 or strike <= 0 or t <= 0 or vol <= 0:
        raise ValueError("spot, strike, t, vol must all be > 0")
    d2 = (log(spot / strike) + (r - 0.5 * vol * vol) * t) / (vol * sqrt(t))
    return float(norm.cdf(d2))


def closest_expiry(available: list[str], target: date) -> str:
    """Pick the earliest available expiry on or after `target`; if none, the latest before."""
    parsed = [(datetime.strptime(d, "%Y-%m-%d").date(), d) for d in available]
    on_or_after = [pair for pair in parsed if pair[0] >= target]
    if on_or_after:
        on_or_after.sort(key=lambda p: p[0])
        return on_or_after[0][1]
    parsed.sort(key=lambda p: p[0], reverse=True)
    return parsed[0][1]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/spy")
def spy_implied_above(
    target_index: Annotated[float, Query(gt=0, description="SPX target level, e.g. 7400")],
    expiry: Annotated[str, Query(description="Target expiry YYYY-MM-DD")],
) -> dict[str, float | str]:
    try:
        target_date = datetime.strptime(expiry, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"bad expiry: {exc}") from None

    spy_target = target_index / 10.0  # SPY trades at ~SPX/10

    ticker = yf.Ticker("SPY")
    expirations = list(ticker.options or [])
    if not expirations:
        raise HTTPException(status_code=502, detail="yfinance returned no SPY expirations")

    chosen_expiry = closest_expiry(expirations, target_date)

    chain = ticker.option_chain(chosen_expiry)
    calls = chain.calls
    if calls is None or calls.empty:
        raise HTTPException(status_code=502, detail=f"empty SPY call chain for {chosen_expiry}")

    # Pick the call with strike closest to spy_target.
    calls = calls.copy()
    calls["distance"] = (calls["strike"] - spy_target).abs()
    nearest = calls.sort_values("distance").iloc[0]
    iv = float(nearest["impliedVolatility"])
    strike = float(nearest["strike"])

    # Spot from quote (fast info has lastPrice or marketPrice depending on yfinance version).
    fast = ticker.fast_info
    spot = float(fast.get("last_price") or fast.get("lastPrice") or 0.0)
    if spot <= 0:
        # Fallback: ticker.info["regularMarketPrice"]
        info = ticker.info or {}
        spot = float(info.get("regularMarketPrice") or 0.0)
    if spot <= 0:
        raise HTTPException(status_code=502, detail="yfinance returned no SPY spot price")

    expiry_dt = datetime.strptime(chosen_expiry, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    now_utc = datetime.now(timezone.utc)
    t_years = (expiry_dt - now_utc).total_seconds() / (DAYS_PER_YEAR * 86400)
    if t_years <= 0:
        raise HTTPException(status_code=502, detail=f"expiry {chosen_expiry} is in the past")

    if iv <= 0:
        raise HTTPException(status_code=502, detail="yfinance returned non-positive IV for chosen call")

    prob = probability_above_strike(spot=spot, strike=strike, t=t_years, vol=iv) * 100.0
    return {
        "probability": round(prob, 4),
        "spot": round(spot, 4),
        "strike": strike,
        "iv": round(iv, 6),
        "t_years": round(t_years, 6),
        "expiry": chosen_expiry,
    }
