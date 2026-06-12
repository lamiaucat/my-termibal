/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '6h' | '12h' | '1d' | '1w' | '1M';

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  isFutures?: boolean; // indicates if we are showing futures data
}

export interface ChartCandle {
  time: number; // UTC timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Indicators calculated
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  rsi7?: number; // 7-period RSI
  rsi7Sma?: number; // 7-period SMA of 7-period RSI
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  cvd?: number; // Cumulative Volume Delta
  oiDelta?: number; // Open Interest Delta
  liquidationsLong?: number; // long liquidation value
  liquidationsShort?: number; // short liquidation value
  fundingRate?: number; // predicted or historical funding rate
  longShortRatio?: number; // long/short accounts ratio
}

export interface IndicatorVisibility {
  ema9: boolean;
  ema21: boolean;
  ema50: boolean;
  ema200: boolean;
  rsi: boolean;
  rsi7: boolean; // 7-period RSI
  macd: boolean;
  cvd: boolean; // Cumulative Volume Delta
  oiDelta: boolean; // Open Interest Delta
  liquidations: boolean; // Liquidations
  fundingRate: boolean; // Funding Rate
  longShortRatio: boolean; // Long/Short Ratio
  heikinAshi: boolean; // Heikin Ashi mode
  orderBlocks: boolean; // green/red support and resistance order blocks
  profileVisible: boolean; // cumulative horizontal volume/delta details on the right
}

export interface AIAnalysisResponse {
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  sentiment: string; // Turkish, e.g., "Boğa (Alım İştahı Yüksek)", etc.
  rsiStatus: string;
  emaStatus: string;
  macdStatus: string;
  markdownContent: string;
  timestamp: string;
}

export interface AIIndicator {
  name: string;
  value: string;
  status: string;
  badge_class: string;
}

export interface UnifiedAIReport {
  market_overview: {
    pair: string;
    spot_price: string;
    change_24h: string;
    matrix_score: number; // legacy/global overall score
    global_strategy: string; // legacy/global overall strategy
    spot_score: number; // specialized spot score (0-100) based strictly on spot indicators
    spot_strategy: string; // specialized spot decision text
    futures_score: number; // specialized futures score (0-100) based strictly on derivative indicators
    futures_strategy: string; // specialized futures decision text
    spot_structure: string;
    futures_structure: string;
    anomaly_detected: boolean;
    anomaly_message: string;
  };
  spot_indicators: AIIndicator[];
  futures_indicators: AIIndicator[];
  spot_copilot_report: string;
  futures_copilot_report: string;
  timestamp: string;
}

export interface TickerCoin {
  symbol: string;
  fullName: string;
  price: number;
  change24h: number;
  volume24h: number;
  fundingRate?: number;
}

