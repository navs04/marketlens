export type DataSource = "DATA_GOV_IN" | "NPPA" | "MANUAL";
export type CommodityCategory = "VEGETABLE" | "MEDICINE" | "LPG";

export interface Market {
  id: string;
  name: string;
  state: string;
  district: string | null;
  source: DataSource;
  latitude: number | null;
  longitude: number | null;
}

export interface Commodity {
  id: string;
  name: string;
  category: CommodityCategory;
  unit: string;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  database: "connected" | "unreachable";
  responseTimeMs: number;
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface PriceObservation {
  date: string;
  price: number;
  minPrice: number | null;
  maxPrice: number | null;
  modalPrice: number | null;
  variety: string;
  grade: string | null;
}

export interface PriceSummary {
  currentPrice: number;
  currentDate: string;
  baselineAverage: number;
  minPrice: number;
  maxPrice: number;
  deviationPct: number;
  trend: "up" | "down" | "flat";
  windowDays: number;
  dataPointsInWindow: number;
}

export interface MarketComparisonEntry {
  market: { id: string; name: string; state: string };
  price: number;
  date: string;
}

export interface ForecastPoint {
  forecastDate: string;
  predictedPrice: number;
  lowerBound: number | null;
  upperBound: number | null;
  horizonDays: number;
  modelVersion: string;
}

export interface ForecastEvaluation {
  status: string;
  modelVersion: string;
  generatedAt: string;
  metrics: {
    winner?: string;
    mae?: number;
    rmse?: number;
    naive?: { mae: number; rmse: number };
    linearTrend?: { mae: number; rmse: number };
    trainSize?: number;
    testSize?: number;
  } | null;
  notes: string | null;
}

export interface ForecastResponse {
  forecasts: ForecastPoint[];
  evaluation: ForecastEvaluation | null;
}

export interface AnomalyFlagEntry {
  id: string;
  date: string;
  observedPrice: number;
  expectedPrice: number;
  deviationPct: number;
  isAnomaly: boolean;
  method: string;
}

export interface AnomalyFeedEntry extends AnomalyFlagEntry {
  market: { id: string; name: string; state: string };
  commodity: { id: string; name: string; unit: string };
}

export interface SpikeRiskScoreData {
  asOfDate: string;
  riskProbability: number;
  horizonDays: number;
  modelVersion: string;
}

export interface SpikeRiskFeedEntry extends SpikeRiskScoreData {
  market: { id: string; name: string; state: string };
  commodity: { id: string; name: string; unit: string };
}

export interface ExplanationResponse {
  text: string;
  source: "llm" | "deterministic";
  generatedAt: string;
}

export interface OverviewStats {
  commoditiesTracked: number;
  marketsTracked: number;
  priceObservations: number;
  anomaliesDetected: number;
  latestDataDate: string | null;
  lastIngestion: { fetchedAt: string; source: DataSource; status: string } | null;
}

export interface MarketCommodityEntry {
  commodity: { id: string; name: string; unit: string };
  latestPrice: number;
  latestDate: string;
}
