import { z } from "zod";

export const TradeDirectionSchema = z.enum(["long", "short"]);
export const TradeStatusSchema = z.enum(["pending", "confirmed", "entered", "closed"]);
export const WatchlistStatusSchema = z.enum(["watching", "promoted", "removed"]);
export const IngestionMethodSchema = z.enum(["manual_paste", "manual_ocr", "manual_share", "automated"]);
export const SourceTypeSchema = z.enum(["text", "image", "combined"]);
export const AlertTypeSchema = z.enum(["price_confirmation", "target_reached", "stop_loss", "new_post"]);

export const ParsePreviewRequestSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const IngestPostRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  postedAt: z.string().datetime().optional(),
  imageStoragePaths: z.array(z.string()).optional(),
  ingestionMethod: IngestionMethodSchema.optional(),
});

export const CreateWatchlistItemSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  parsedTradeId: z.string().cuid().optional(),
  coachPostId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const CreateTradeSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  direction: TradeDirectionSchema.optional(),
  parsedTradeId: z.string().cuid().optional(),
  entryPrice: z.number().positive().optional(),
  entryDate: z.string().datetime().optional(),
  priceConfirmation: z.number().positive().optional(),
  priceTargetHigh: z.number().positive().optional(),
  priceTargetLow: z.number().positive().optional(),
  projectedDate: z.string().datetime().optional(),
  stopLoss: z.number().positive().optional(),
  supportLevel: z.number().positive().optional(),
  resistanceLevel: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateTradeStatusSchema = z.object({
  status: TradeStatusSchema,
  entryPrice: z.number().positive().optional(),
  entryDate: z.string().datetime().optional(),
  closedPrice: z.number().positive().optional(),
  closedAt: z.string().datetime().optional(),
});

export const GetBatchPricesSchema = z.object({
  tickers: z.array(z.string().min(1).max(10).toUpperCase()).min(1).max(50),
});
