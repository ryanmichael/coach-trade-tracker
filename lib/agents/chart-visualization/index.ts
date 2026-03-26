/**
 * Chart Visualization Agent
 *
 * Transforms Coach's chart screenshots into structured, renderable ChartData.
 * Runs in parallel with the NLP/Parser Vision pass during image analysis.
 *
 * Pipeline:
 *   Image → extractChartGeometry() → buildChartData() → CoachPost.chartData
 */

export type { ChartGeometry, ChartData } from "./types";
export { extractChartGeometry } from "./shape-extractor";
export { buildChartData, rebuildChartData } from "./geometry-builder";
