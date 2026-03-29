// ── Base Types ──────────────────────────────────────────────────────────────

export type TradeDirection = "long" | "short";
export type TradeStatus = "pending" | "confirmed" | "entered" | "closed";
export type WatchlistStatus = "watching" | "promoted" | "removed";
export type IngestionMethod = "manual_paste" | "manual_ocr" | "manual_share" | "automated";
export type SourceType = "text" | "image" | "combined";
export type AlertType = "price_confirmation" | "target_reached" | "stop_loss" | "new_post";
export type ImageType = "stock_chart" | "annotated_chart" | "text_screenshot" | "other";
export type FeedTagType = "watchlist" | "important" | "skip";
export type MarketStatus = "open" | "pre_market" | "after_hours" | "closed";
export type AlertLifecycle = "created" | "triggered" | "displayed" | "acknowledged" | "archived";
export type DelistStatus = "green" | "yellow" | "red";
export type DelistCheckSource = "sec_edgar" | "polygon_aum" | "polygon_volume" | "web_search" | "ai_analysis";

// ── Prisma Model Interfaces ──────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  watchlist?: WatchlistItem[];
  activeTrades?: ActiveTrade[];
  alerts?: Alert[];
  preferences?: UserPreference | null;
}

export interface UserPreference {
  id: string;
  userId: string;
  user?: User;
  alertSound: boolean;
  alertBrowserPush: boolean;
  defaultView: string;
  priceCheckIntervalSec: number;
}

export interface CoachPost {
  id: string;
  externalId: string | null;
  content: string;
  mediaUrls: string[];
  imageStoragePaths: string[];
  imageAnalysis: ImageAnalysisResult[] | null;
  hasImages: boolean;
  postedAt: Date;
  ingestedAt: Date;
  ingestionMethod: IngestionMethod;
  parsedTrades?: ParsedTrade[];
  watchlistItems?: WatchlistItem[];
  feedTags?: FeedTag[];
}

export interface ParsedTrade {
  id: string;
  coachPostId: string;
  coachPost?: CoachPost;
  ticker: string;
  direction: TradeDirection;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  projectedDate: Date | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  confidence: number;
  sourceType: SourceType;
  rawExtract: string;
  createdAt: Date;
  watchlistItems?: WatchlistItem[];
  activeTrades?: ActiveTrade[];
}

export interface WatchlistItem {
  id: string;
  userId: string;
  user?: User;
  ticker: string;
  parsedTradeId: string | null;
  parsedTrade?: ParsedTrade | null;
  coachPostId: string | null;
  coachPost?: CoachPost | null;
  notes: string | null;
  addedAt: Date;
  status: WatchlistStatus;
}

export interface ActiveTrade {
  id: string;
  userId: string;
  user?: User;
  ticker: string;
  parsedTradeId: string | null;
  parsedTrade?: ParsedTrade | null;
  entryPrice: number | null;
  entryDate: Date | null;
  priceConfirmation: number | null;
  priceTargetHigh: number | null;
  priceTargetLow: number | null;
  projectedDate: Date | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  status: TradeStatus;
  currentPrice: number | null;
  currentPriceUpdatedAt: Date | null;
  profitLoss: number | null;
  closedAt: Date | null;
  closedPrice: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  alerts?: Alert[];
}

export interface Alert {
  id: string;
  userId: string;
  user?: User;
  activeTradeId: string | null;
  activeTrade?: ActiveTrade | null;
  ticker: string;
  alertType: AlertType;
  triggerPrice: number | null;
  triggeredAt: Date | null;
  acknowledged: boolean;
  message: string;
  createdAt: Date;
}

export interface FeedTag {
  id: string;
  coachPostId: string;
  coachPost?: CoachPost;
  tagType: FeedTagType;
  ticker: string | null;
  createdAt: Date;
}

// ── Delist Monitor Types ────────────────────────────────────────────────────

export interface DelistMonitorTicker {
  id: string;
  userId: string;
  ticker: string;
  status: DelistStatus;
  addedAt: Date;
  updatedAt: Date;
  notes: string | null;
  checkResults?: DelistCheckResult[];
}

export interface DelistCheckResult {
  id: string;
  delistMonitorTickerId: string;
  ticker: string;
  checkDate: Date;
  source: DelistCheckSource;
  signalLevel: DelistStatus;
  summary: string;
  rawData: unknown;
  url: string | null;
}

// ── Delist Monitor API Types ────────────────────────────────────────────────

export interface AddDelistTickersRequest {
  tickers: string; // comma-delimited
}

export interface AddDelistTickersResponse {
  added: DelistMonitorTicker[];
  duplicates: string[];
  invalid: string[];
}

export interface DelistSummaryResponse {
  yellowCount: number;
  redCount: number;
}

export interface DelistCheckResponse {
  results: DelistMonitorTicker[];
  checkedAt: string;
}

// ── Image Analysis Types ──────────────────────────────────────────────────────

export interface PriceLevel {
  value: number;
  type: "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
  label: string | null;
}

export interface ImageAnalysisResult {
  imageType: ImageType;
  ticker: string | null;
  priceLevels: PriceLevel[];
  annotations: string[];
  timeframe: string | null;
  direction: "bullish" | "bearish" | "neutral" | null;
  projectedDates: string[];
  confidence: number;
  summary: string;
}

// ── Parser Types ──────────────────────────────────────────────────────────────

export interface ParsedTradeData {
  ticker: string;
  direction: TradeDirection;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  projectedDate: string | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  confidence: number;
  sourceType: SourceType;
  rawExtract: string;
}

export interface ParseConflict {
  field: keyof ParsedTradeData;
  textValue: number | string | null;
  imageValue: number | string | null;
}

export interface MergedParseResult {
  trades: ParsedTradeData[];
  conflicts: ParseConflict[];
  imageAnalysis: ImageAnalysisResult[];
}

// ── API Request / Response Types ──────────────────────────────────────────────

// Feed
export interface GetFeedRequest {
  page?: number;
  limit?: number;
  ticker?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetFeedResponse {
  posts: CoachPost[];
  total: number;
  page: number;
  limit: number;
}

export interface IngestPostRequest {
  content: string;
  postedAt?: string;
  imageStoragePaths?: string[];
  ingestionMethod?: IngestionMethod;
}

export interface IngestPostResponse {
  post: CoachPost;
  parsedTrades: ParsedTrade[];
}

export interface BulkIngestRequest {
  posts: IngestPostRequest[];
}

export interface BulkIngestResponse {
  results: IngestPostResponse[];
  failedCount: number;
}

// Parse
export interface ParsePreviewRequest {
  content: string;
}

export interface ParsePreviewResponse {
  trades: ParsedTradeData[];
  rawText: string;
  processingTimeMs: number;
}

export interface ParseImageRequest {
  imagePath: string;
}

export interface ParseImageResponse {
  analysis: ImageAnalysisResult;
  processingTimeMs: number;
}

export interface MergeParseRequest {
  textResult: ParsedTradeData[];
  imageResults: ImageAnalysisResult[];
}

export interface MergeParseResponse {
  merged: MergedParseResult;
}

export interface RefineParseRequest {
  content: string;
  ticker?: string;
}

export interface RefineParseResponse {
  trades: ParsedTradeData[];
  processingTimeMs: number;
}

// Watchlist
export interface GetWatchlistResponse {
  items: (WatchlistItem & { latestPost?: CoachPost | null })[];
}

export interface CreateWatchlistItemRequest {
  ticker: string;
  parsedTradeId?: string;
  coachPostId?: string;
  notes?: string;
}

export interface CreateWatchlistItemResponse {
  item: WatchlistItem;
}

export interface UpdateWatchlistItemRequest {
  notes?: string;
  status?: WatchlistStatus;
}

export interface PromoteToActiveRequest {
  entryPrice?: number;
  notes?: string;
}

export interface PromoteToActiveResponse {
  activeTrade: ActiveTrade;
}

// Active Trades
export interface GetTradesResponse {
  trades: ActiveTrade[];
}

export interface CreateTradeRequest {
  ticker: string;
  direction?: TradeDirection;
  parsedTradeId?: string;
  entryPrice?: number;
  entryDate?: string;
  priceConfirmation?: number;
  priceTargetHigh?: number;
  priceTargetLow?: number;
  projectedDate?: string;
  stopLoss?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  notes?: string;
}

export interface CreateTradeResponse {
  trade: ActiveTrade;
}

export interface UpdateTradeRequest {
  entryPrice?: number;
  entryDate?: string;
  priceConfirmation?: number;
  priceTargetHigh?: number;
  priceTargetLow?: number;
  projectedDate?: string;
  stopLoss?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  notes?: string;
  status?: TradeStatus;
}

export interface UpdateTradeStatusRequest {
  status: TradeStatus;
  entryPrice?: number;
  entryDate?: string;
  closedPrice?: number;
  closedAt?: string;
}

export interface GetTradeHistoryResponse {
  trades: ActiveTrade[];
  total: number;
}

// Alerts
export interface GetAlertsRequest {
  type?: AlertType;
  acknowledged?: boolean;
  ticker?: string;
  page?: number;
  limit?: number;
}

export interface GetAlertsResponse {
  alerts: Alert[];
  total: number;
}

export interface AcknowledgeAlertResponse {
  alert: Alert;
}

export interface AcknowledgeAllResponse {
  acknowledged: number;
}

export interface UnreadAlertCountResponse {
  count: number;
}

// Prices
export interface PriceData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface GetPriceResponse {
  data: PriceData;
}

export interface GetBatchPricesRequest {
  tickers: string[];
}

export interface GetBatchPricesResponse {
  data: Record<string, PriceData>;
}

// Health & Market
export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  db: boolean;
  priceFeed: boolean;
  jobQueue: boolean;
  timestamp: string;
}

export interface MarketStatusResponse {
  status: MarketStatus;
  nextChange: string | null;
  message: string;
}

// Orchestrator
export interface OrchestratorRunRequest {
  trigger?: "manual" | "cron" | "price_update";
}

export interface OrchestratorRunResponse {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
}
