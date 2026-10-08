"""
Runs anomaly detection, forecasting, and spike-risk scoring in sequence.

Order matters: spike_risk.py reads the forecast each pair's ForecastResult
row (for its trend signal) and reuses anomaly.py's scoring function
directly, so anomaly and forecast must both complete first.

Usage: python run_all.py  (run from the ml/ directory, with the venv active)
"""

import anomaly
import forecast
import spike_risk


def run():
    print("=" * 60)
    print("MarketLens ML pipeline")
    print("=" * 60)

    print("\n[1/3] Anomaly detection")
    anomaly.run()

    print("\n[2/3] Forecasting")
    forecast.run()

    print("\n[3/3] Spike-risk scoring")
    spike_risk.run()

    print("\n" + "=" * 60)
    print("Done.")
    print("=" * 60)


if __name__ == "__main__":
    run()
