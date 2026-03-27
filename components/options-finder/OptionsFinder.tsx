"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOptionsFinderStore } from "@/stores/options-finder";
import { sortContracts } from "@/lib/options";
import type { TradeInput, CustomTradeInput } from "@/lib/options";

import { PageHeader } from "@/components/options-finder/PageHeader";
import { TickerSelector } from "@/components/options-finder/TickerSelector";
import { FilterBar } from "@/components/options-finder/FilterBar";
import { ContractCard } from "@/components/options-finder/ContractCard";
import { SummaryFooter } from "@/components/options-finder/SummaryFooter";
import { EmptyState } from "@/components/options-finder/EmptyState";
import { MethodologyNote } from "@/components/options-finder/MethodologyNote";
import { AccuracyDashboard } from "@/components/options-finder/AccuracyDashboard";
import { ShimmerLoader } from "@/components/primitives/ShimmerLoader";

type Tab = "finder" | "accuracy";

export function OptionsFinder() {
  const store = useOptionsFinderStore();
  const {
    selectedTicker,
    sortBy,
    customTickers,
    customDrafts,
    coachTrades,
    contracts,
    isLoading,
    error,
    setSelectedTicker,
    setSortBy,
    setCoachTrades,
    addCustomTicker,
    removeCustomTicker,
    updateCustomDraft,
    setContracts,
    setLoading,
    setError,
    hydrateFromStorage,
  } = store;

  const [activeTab, setActiveTab] = useState<Tab>("finder");
  const fetchIdRef = useRef(0);

  // Hydrate custom tickers from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    hydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load coach recs from ParsedTrade records
  useEffect(() => {
    async function loadCoachRecs() {
      try {
        const res = await fetch("/api/feed");
        if (!res.ok) return;
        const data = await res.json();
        const posts = data.posts ?? [];

        const trades: Record<string, TradeInput> = {};

        for (const post of posts) {
          const parsedTrades = post.parsedTrades ?? [];
          for (const pt of parsedTrades) {
            if (!pt.ticker || !pt.priceTargetHigh || !pt.projectedDate) continue;
            if (trades[pt.ticker]) continue;

            trades[pt.ticker] = {
              ticker: pt.ticker,
              direction: (pt.direction?.toUpperCase() === "SHORT" ? "SHORT" : "LONG") as "LONG" | "SHORT",
              currentPrice: 0,
              priceTargetHigh: pt.priceTargetHigh,
              projectedDate:
                typeof pt.projectedDate === "string"
                  ? pt.projectedDate.split("T")[0]
                  : new Date(pt.projectedDate).toISOString().split("T")[0],
              stopLoss: pt.stopLoss ?? 0,
              coachNote: pt.rawExtract ?? post.content?.slice(0, 200) ?? "",
              hasCoachRec: true,
            };
          }
        }

        const tickers = Object.keys(trades);
        if (tickers.length > 0) {
          try {
            const priceRes = await fetch(
              `/api/prices/batch?tickers=${tickers.join(",")}`
            );
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              const prices = priceData.prices ?? {};
              for (const t of tickers) {
                if (prices[t]?.price) {
                  trades[t].currentPrice = prices[t].price;
                }
              }
            }
          } catch {
            // Prices optional
          }
        }

        setCoachTrades(trades);
      } catch {
        // Feed not available
      }
    }

    loadCoachRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coachTickers = useMemo(
    () => Object.keys(coachTrades),
    [coachTrades]
  );
  const isCoachRec = selectedTicker
    ? coachTickers.includes(selectedTicker)
    : false;
  const currentTrade: TradeInput | CustomTradeInput | null =
    selectedTicker
      ? isCoachRec
        ? coachTrades[selectedTicker]
        : customDrafts[selectedTicker] ?? null
      : null;

  // Fetch options chain when trade params change
  useEffect(() => {
    if (!currentTrade) {
      setContracts([], 0, 0);
      return;
    }

    const ready =
      currentTrade.ticker &&
      currentTrade.currentPrice > 0 &&
      currentTrade.priceTargetHigh > 0 &&
      currentTrade.projectedDate;

    if (!ready) return;

    const direction: "LONG" | "SHORT" =
      currentTrade.priceTargetHigh >= currentTrade.currentPrice
        ? "LONG"
        : "SHORT";

    // Increment fetch ID to handle race conditions
    const id = ++fetchIdRef.current;

    // Set loading synchronously via Zustand's direct set
    useOptionsFinderStore.setState({ isLoading: true, error: null });

    const params = new URLSearchParams({
      ticker: currentTrade.ticker,
      direction,
      currentPrice: String(currentTrade.currentPrice),
      targetPrice: String(currentTrade.priceTargetHigh),
      projectedDate: currentTrade.projectedDate,
      stopLoss: String(currentTrade.stopLoss),
    });

    fetch(`/api/options/chain?${params}`)
      .then((res) => {
        if (!res.ok) return res.json().then((e) => { throw new Error(e.error ?? `HTTP ${res.status}`); });
        return res.json();
      })
      .then((data) => {
        if (fetchIdRef.current !== id) return; // stale
        setContracts(
          data.contracts ?? [],
          data.totalRaw ?? 0,
          data.totalFiltered ?? 0
        );
      })
      .catch((err) => {
        if (fetchIdRef.current !== id) return; // stale
        setError(err instanceof Error ? err.message : "Failed to fetch options chain");
        setContracts([], 0, 0);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTicker,
    currentTrade?.currentPrice,
    currentTrade?.priceTargetHigh,
    currentTrade?.projectedDate,
  ]);

  const sorted = useMemo(
    () => sortContracts(contracts, sortBy),
    [contracts, sortBy]
  );

  const maxOI = useMemo(
    () => Math.max(...contracts.map((c) => c.openInterest), 1),
    [contracts]
  );

  const contractLabel =
    currentTrade?.direction === "SHORT" ? "Puts only" : "Calls only";

  const isCustomReady =
    !isCoachRec &&
    currentTrade &&
    currentTrade.currentPrice > 0 &&
    currentTrade.priceTargetHigh > 0 &&
    currentTrade.projectedDate.length > 0;

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <PageHeader status={isLoading && activeTab === "finder" ? "Loading..." : undefined} />

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 20,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {(["finder", "accuracy"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab
                ? "2px solid var(--accent-primary)"
                : "2px solid transparent",
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              color: activeTab === tab
                ? "var(--accent-primary)"
                : "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color 120ms, border-color 120ms",
              letterSpacing: "0.02em",
            }}
          >
            {tab === "finder" ? "Options Finder" : "Accuracy"}
          </button>
        ))}
      </div>

      {activeTab === "accuracy" && <AccuracyDashboard />}

      {activeTab === "finder" && <><TickerSelector
        selected={selectedTicker}
        coachTickers={coachTickers}
        coachTrades={coachTrades}
        customTickers={customTickers}
        customDrafts={customDrafts}
        onSelect={setSelectedTicker}
        onAddCustom={addCustomTicker}
        onRemoveCustom={removeCustomTicker}
        currentTrade={currentTrade}
        isCoachRec={isCoachRec}
        onUpdateDraft={!isCoachRec ? updateCustomDraft : undefined}
      />

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--semantic-negative-muted)",
            border: "1px solid rgba(240,110,110,0.25)",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            color: "var(--semantic-negative)",
          }}
        >
          {error}
        </div>
      )}

      {isLoading && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <ShimmerLoader width={180} height={28} rounded="var(--radius-md)" />
            <ShimmerLoader width={120} height={22} rounded="var(--radius-sm)" />
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                padding: "18px 22px",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <ShimmerLoader width={20} height={20} rounded="4px" />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ShimmerLoader width={90} height={18} rounded="var(--radius-sm)" />
                  <ShimmerLoader width={110} height={12} rounded="var(--radius-sm)" />
                </div>
                <ShimmerLoader width={70} height={16} rounded="var(--radius-sm)" />
                <ShimmerLoader width={80} height={16} rounded="var(--radius-sm)" />
                <ShimmerLoader width={80} height={16} rounded="var(--radius-sm)" />
                <div style={{ marginLeft: "auto" }}>
                  <ShimmerLoader width={70} height={24} rounded="var(--radius-sm)" />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <ShimmerLoader width="100%" height={3} rounded="2px" />
              </div>
            </div>
          ))}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: 8,
            }}
          >
            Fetching options chain & computing Greeks...
          </div>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div>
          <FilterBar
            sortBy={sortBy}
            onSort={setSortBy}
            count={sorted.length}
            contractLabel={contractLabel}
          />

          {sorted.map((contract, i) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              rank={i + 1}
              maxOI={maxOI}
            />
          ))}

          <SummaryFooter contracts={sorted} />
        </div>
      )}

      {!isLoading && sorted.length === 0 && selectedTicker && (
        <EmptyState
          message={
            !isCoachRec && !isCustomReady
              ? "Enter trade details above to see contracts"
              : contracts.length === 0 && !error
                ? "No options chain data available"
                : "No contracts match filters"
          }
          sub={
            !isCoachRec && !isCustomReady
              ? "Current price, target, and projected date are required"
              : "Try a different ticker or check that Polygon API key is configured"
          }
        />
      )}

      {!selectedTicker && (
        <EmptyState
          message="Select a ticker to get started"
          sub="Choose from coach recommendations or add a custom ticker"
        />
      )}

      <MethodologyNote />
      </>}
    </div>
  );
}
