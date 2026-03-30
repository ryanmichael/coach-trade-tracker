// Parser Agent entry point
// Routes text to regex-pipeline, images to image-analyzer, merges results

export { RegexPipeline } from "./regex-pipeline";
export { ImageAnalyzer } from "./image-analyzer";
export { MergeStrategy } from "./merge-strategy";
export { ClaudeFallback } from "./claude-fallback";
export {
  preprocessChartImage,
  formatAsVisionContext,
  type PreprocessedChartData,
} from "./image-preprocessing";
