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
