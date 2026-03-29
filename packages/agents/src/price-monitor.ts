// Price Monitor Agent — tracks real-time prices for active trades and watchlist
// Connects to Polygon.io WebSocket or polls REST API
// Evaluates alert conditions on each price update

export class PriceMonitor {
  private tickers: Set<string> = new Set();

  addTicker(ticker: string): void {
    this.tickers.add(ticker);
  }

  removeTicker(ticker: string): void {
    this.tickers.delete(ticker);
  }

  getTickers(): string[] {
    return Array.from(this.tickers);
  }

  // TODO: implement Polygon.io WebSocket connection and REST polling fallback
}
