import { prisma } from "../lib/prisma.js";
import { priceService } from "./price.service.js";
import { forecastService } from "./forecast.service.js";
import { spikeRiskService } from "./spikeRisk.service.js";
import { generateText, LLM_MODEL_NAME } from "../llm/client.js";

interface StructuredSignal {
  commodityName: string;
  marketName: string;
  currentPrice: number;
  currentDate: string;
  baselineAverage: number;
  deviationPct: number;
  trend: "up" | "down" | "flat";
  windowDays: number;
  dataPointsInWindow: number;
  latestAnomaly: { isAnomaly: boolean; deviationPct: number; date: string } | null;
  forecastNext: { predictedPrice: number; forecastDate: string; horizonDays: number } | null;
  forecastEvaluation: { mae?: number; rmse?: number } | null;
  spikeRisk: { riskProbability: number; horizonDays: number } | null;
}

// Short in-memory cache keyed by market+commodity+day, so repeated
// dashboard loads for the same day don't re-call the LLM (cost + latency)
// - cleared naturally on server restart, which is fine for this use case.
const cache = new Map<string, { generatedAt: Date; source: "llm" | "deterministic"; text: string }>();

const SYSTEM_PROMPT = `You explain commodity mandi price data for a market-intelligence dashboard.
You will be given structured numbers: current price, a historical baseline, percentage
deviation, trend direction, an anomaly flag, a forecast, and a spike-risk probability.

Rules you must follow exactly:
- Only reference numbers given to you. Never state or imply a specific cause (weather,
  supply shortage, festival demand, government policy, transport disruption, etc.) unless
  that cause is explicitly present in the data you were given - it never will be, so do not
  speculate about causes at all.
- Do not invent any number not present in the input.
- Be concise: 2-4 short sentences, plain language, no bullet points, no headers.
- If forecast or spike-risk data is missing, simply don't mention it - don't apologize for
  its absence or mention that data is missing.`;

async function buildStructuredSignal(marketId: string, commodityId: string): Promise<StructuredSignal | null> {
  const [market, commodity, summary] = await Promise.all([
    prisma.market.findUnique({ where: { id: marketId }, select: { name: true, state: true } }),
    prisma.commodity.findUnique({ where: { id: commodityId }, select: { name: true } }),
    priceService.summary({ marketId, commodityId }),
  ]);

  if (!market || !commodity || !summary) return null;

  const [latestAnomaly, forecastResult, spikeRisk] = await Promise.all([
    prisma.anomalyFlag.findFirst({ where: { marketId, commodityId }, orderBy: { date: "desc" } }),
    forecastService.get({ marketId, commodityId }),
    spikeRiskService.latest({ marketId, commodityId }),
  ]);

  const nextForecast = forecastResult.forecasts[0] ?? null;
  const metrics = forecastResult.evaluation?.metrics as { mae?: number; rmse?: number } | null;

  return {
    commodityName: commodity.name,
    marketName: `${market.name}, ${market.state}`,
    currentPrice: summary.currentPrice,
    currentDate: summary.currentDate.toISOString().slice(0, 10),
    baselineAverage: summary.baselineAverage,
    deviationPct: summary.deviationPct,
    trend: summary.trend,
    windowDays: summary.windowDays,
    dataPointsInWindow: summary.dataPointsInWindow,
    latestAnomaly: latestAnomaly
      ? {
          isAnomaly: latestAnomaly.isAnomaly,
          deviationPct: Math.round(latestAnomaly.deviationPct * 100) / 100,
          date: latestAnomaly.date.toISOString().slice(0, 10),
        }
      : null,
    forecastNext: nextForecast
      ? {
          predictedPrice: nextForecast.predictedPrice,
          forecastDate: nextForecast.forecastDate.toISOString().slice(0, 10),
          horizonDays: nextForecast.horizonDays,
        }
      : null,
    forecastEvaluation: metrics ? { mae: metrics.mae, rmse: metrics.rmse } : null,
    spikeRisk: spikeRisk
      ? { riskProbability: Math.round(spikeRisk.riskProbability * 100) / 100, horizonDays: spikeRisk.horizonDays }
      : null,
  };
}

function buildDeterministicExplanation(s: StructuredSignal): string {
  const direction = s.deviationPct > 0 ? "above" : s.deviationPct < 0 ? "below" : "in line with";
  const sentences: string[] = [];

  sentences.push(
    `The current modal price of ${s.commodityName} in ${s.marketName} is ₹${s.currentPrice}, ` +
      `which is ${Math.abs(s.deviationPct)}% ${direction} the ${s.windowDays}-day average of ₹${s.baselineAverage} ` +
      `(based on ${s.dataPointsInWindow} day${s.dataPointsInWindow === 1 ? "" : "s"} of recent data).`,
  );

  sentences.push(
    `The recent trend is ${s.trend === "flat" ? "stable" : s.trend === "up" ? "upward" : "downward"}.`,
  );

  if (s.latestAnomaly?.isAnomaly) {
    sentences.push(`This price has been flagged as unusual relative to its historical baseline.`);
  }

  if (s.forecastNext) {
    sentences.push(
      `The forecasting model expects a price of around ₹${s.forecastNext.predictedPrice} by ${s.forecastNext.forecastDate}.`,
    );
  }

  if (s.spikeRisk && s.spikeRisk.riskProbability >= 0.5) {
    sentences.push(
      `Estimated spike risk over the next ${s.spikeRisk.horizonDays} days is elevated, at ${Math.round(
        s.spikeRisk.riskProbability * 100,
      )}%.`,
    );
  }

  return sentences.join(" ");
}

export const explanationService = {
  async explain({ marketId, commodityId }: { marketId: string; commodityId: string }) {
    const signal = await buildStructuredSignal(marketId, commodityId);
    if (!signal) return null;

    const cacheKey = `${marketId}:${commodityId}:${signal.currentDate}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return { ...cached, signal };
    }

    const llmText = await generateText(SYSTEM_PROMPT, JSON.stringify(signal, null, 2));

    const result: { generatedAt: Date; source: "llm" | "deterministic"; text: string } = llmText
      ? { generatedAt: new Date(), source: "llm", text: llmText }
      : { generatedAt: new Date(), source: "deterministic", text: buildDeterministicExplanation(signal) };

    cache.set(cacheKey, result);
    return { ...result, signal };
  },
};

export { LLM_MODEL_NAME };
