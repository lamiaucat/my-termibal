/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Zap, 
  Workflow, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Cpu, 
  Sparkles, 
  RefreshCw, 
  ShieldAlert, 
  Activity, 
  LineChart, 
  Coins,
  ArrowRight
} from 'lucide-react';
import { CoinDetail, ChartCandle, UnifiedAIReport } from '../types.js';
import { Language, t } from '../utils/translations.js';
import { formatUSD } from '../utils/formatters.js';

interface UnifiedCorrelationEngineProps {
  coin: CoinDetail;
  spotKlines: ChartCandle[];
  futuresKlines: ChartCandle[];
  unifiedReport: UnifiedAIReport | null;
  aiLoading: boolean;
  aiError: string | null;
  onTriggerAnalysis: (timeframe: string) => void;
  lang: Language;
}

export default function UnifiedCorrelationEngine({
  coin,
  spotKlines,
  futuresKlines,
  unifiedReport,
  aiLoading,
  aiError,
  onTriggerAnalysis,
  lang
}: UnifiedCorrelationEngineProps) {
  
  // 1. Calculate prices and spread
  const spotPrice = spotKlines.length > 0 ? spotKlines[spotKlines.length - 1].close : coin.price;
  const futuresPrice = futuresKlines.length > 0 ? futuresKlines[futuresKlines.length - 1].close : coin.price;
  const spreadUSD = futuresPrice - spotPrice;
  const spreadPercent = spotPrice > 0 ? (spreadUSD / spotPrice) * 100 : 0;

  // 2. Identify premium regime
  let regimeLabel = '';
  let regimeColor = '';
  let regimeDesc = '';
  
  if (spreadPercent > 0.05) {
    regimeLabel = t(lang, 'contangoLabel');
    regimeColor = 'text-green-400 border-green-500/25 bg-green-500/5';
    regimeDesc = t(lang, 'contangoDesc');
  } else if (spreadPercent < -0.05) {
    regimeLabel = t(lang, 'backwardationLabel');
    regimeColor = 'text-red-400 border-red-500/25 bg-red-500/5';
    regimeDesc = t(lang, 'backwardationDesc');
  } else {
    regimeLabel = t(lang, 'synchronizedLabel');
    regimeColor = 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
    regimeDesc = t(lang, 'synchronizedDesc');
  }

  // 3. Multi-layer divergence analyzer
  const lastSpotCandle = spotKlines.length > 0 ? spotKlines[spotKlines.length - 1] : null;
  const lastFuturesCandle = futuresKlines.length > 0 ? futuresKlines[futuresKlines.length - 1] : null;

  let divergenceStatus = '';
  let divergenceDesc = '';
  let divergenceBadge = '';

  const isSpotBullish = lastSpotCandle && lastSpotCandle.ema9 && lastSpotCandle.ema21 ? lastSpotCandle.ema9 > lastSpotCandle.ema21 : coin.change24h > 0;
  const isCvdPositive = lastFuturesCandle && (lastFuturesCandle.cvd || 0) > 0;
  const isOiDeltaPositive = lastFuturesCandle && (lastFuturesCandle.oiDelta || 0) > 0;

  if (isSpotBullish && isCvdPositive) {
    divergenceStatus = t(lang, 'bullishConvergence');
    divergenceDesc = t(lang, 'bullishConvergenceDesc');
    divergenceBadge = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  } else if (!isSpotBullish && !isCvdPositive) {
    divergenceStatus = t(lang, 'bearishConvergence');
    divergenceDesc = t(lang, 'bearishConvergenceDesc');
    divergenceBadge = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
  } else if (isSpotBullish && !isCvdPositive) {
    divergenceStatus = t(lang, 'bearishDistributionDivergence');
    divergenceDesc = t(lang, 'bearishDistributionDivergenceDesc');
    divergenceBadge = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  } else {
    // Spot bearish/flat but CVD is positive (accumulation)
    divergenceStatus = t(lang, 'bullishAccumulationDivergence');
    divergenceDesc = t(lang, 'bullishAccumulationDivergenceDesc');
    divergenceBadge = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
  }

  // Double check anomaly
  const hasAnomaly = unifiedReport?.market_overview.anomaly_detected;

  // Joint Matrix Score
  const jointScore = unifiedReport?.market_overview.matrix_score !== undefined
    ? unifiedReport.market_overview.matrix_score
    : Math.round(((unifiedReport?.market_overview.spot_score || 50) + (unifiedReport?.market_overview.futures_score || 50)) / 2);

  const getMatrixGaugeStyles = (score: number) => {
    if (score >= 80) {
      return {
        stroke: "#6366f1",
        bg: "bg-indigo-950/20",
        border: "border-indigo-500/30",
        text: "text-indigo-400",
        label: t(lang, 'strongBullishSynergy')
      };
    } else if (score >= 40) {
      return {
        stroke: "#fbbf24",
        bg: "bg-amber-950/10",
        border: "border-amber-505/20",
        text: "text-amber-400",
        label: t(lang, 'consolidatingSynergy')
      };
    } else {
      return {
        stroke: "#f43f5e",
        bg: "bg-rose-950/20",
        border: "border-rose-500/25",
        text: "text-rose-400",
        label: t(lang, 'highCrossRisk')
      };
    }
  };

  const jointGauge = getMatrixGaugeStyles(jointScore);

  return (
    <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5" id="unified-correlation-engine">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-805 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Workflow className="w-5 h-5 text-indigo-400 animate-spin-slow" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-1.5 tracking-tight">
              {t(lang, 'unifiedEngineTitle')}
            </h2>
            <p className="text-[10px] text-zinc-500 font-medium">
              {t(lang, 'unifiedEngineDesc')}
            </p>
          </div>
        </div>

        <span className="mt-2 md:mt-0 text-[9px] font-bold font-mono px-2.5 py-1 uppercase rounded-full bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 self-start md:self-center">
          Active Hub v2.5
        </span>
      </div>

      {/* CORE INFO MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="correlation-panel-grid">
        
        {/* PANEL 1: SPREAD & REAL-TIME ARBITRAGE (4 col) */}
        <div className="lg:col-span-4 bg-[#0a0a0b] border border-zinc-900 rounded-xl p-4.5 flex flex-col justify-between gap-4 font-sans">
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider font-mono">
                {t(lang, 'basisSpreadTitle')}
              </span>
            </div>

            {/* Price lines */}
            <div className="space-y-2 border-b border-zinc-850 pb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {t(lang, 'spotRef')}:
                </span>
                <span className="font-mono font-bold text-zinc-300">{formatUSD(spotPrice)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {t(lang, 'futuresRef')}:
                </span>
                <span className="font-mono font-bold text-indigo-300">{formatUSD(futuresPrice)}</span>
              </div>
            </div>

            {/* Spread calculation widget */}
            <div className="pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                  {t(lang, 'basisSpreadSub')}
                </span>
                <span className={`text-[10px] font-mono font-bold ${spreadUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {spreadUSD >= 0 ? '+' : ''}{spreadPercent.toFixed(4)}%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-xl font-black font-mono tracking-tight ${spreadUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {spreadUSD >= 0 ? '+' : ''}{formatUSD(spreadUSD)}
                </span>
                <span className="text-[9px] text-zinc-650 font-mono">USDT Premium</span>
              </div>
            </div>
          </div>

          {/* Premium regime badge and text block */}
          <div className={`p-3 rounded-lg border text-[10px] leading-relaxed select-text ${regimeColor}`}>
            <strong className="block font-extrabold uppercase mb-1 font-mono tracking-wide">{regimeLabel}</strong>
            {regimeDesc}
          </div>
        </div>

        {/* PANEL 2: INTEGRATED DIVERGENCE ENGINE (4 col) */}
        <div className="lg:col-span-4 bg-[#0a0a0b] border border-zinc-900 rounded-xl p-4.5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider font-mono">
                {t(lang, 'crossMarketTitle')}
              </span>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-1.5 pt-0.5 border-b border-zinc-850 pb-3 mb-3">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 font-medium">{t(lang, 'spotMomentum')}:</span>
                <span className={`font-bold uppercase ${isSpotBullish ? 'text-green-400' : 'text-rose-400'}`}>
                  {isSpotBullish ? t(lang, 'bullish') : t(lang, 'bearish')}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 font-medium">{t(lang, 'derivativesCVDLedger')}:</span>
                <span className={`font-bold uppercase ${isCvdPositive ? 'text-green-400' : 'text-rose-400'}`}>
                  {isCvdPositive ? t(lang, 'buyerDominant') : t(lang, 'sellerDominant')}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 font-medium">{t(lang, 'openInterestFlow')}:</span>
                <span className={`font-bold uppercase ${isOiDeltaPositive ? 'text-green-400' : 'text-zinc-500'}`}>
                  {isOiDeltaPositive ? t(lang, 'netCapacityInflow') : t(lang, 'capacityDecrease')}
                </span>
              </div>
            </div>

            {/* Convergence regime block */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">
                {t(lang, 'liquidityConvergenceRegime')}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block self-start ${divergenceBadge}`}>
                {divergenceStatus}
              </span>
              <p className="text-[10px] text-zinc-400 leading-relaxed mt-1 select-text">
                {divergenceDesc}
              </p>
            </div>
          </div>

          {/* Anomaly flash alarm */}
          {hasAnomaly ? (
            <div className="p-3 bg-red-950/30 text-red-400 border border-red-500/30 rounded-lg flex items-start gap-2 animate-pulse">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <div className="text-[9.5px] leading-relaxed font-semibold">
                <strong>{t(lang, 'anomalyDetectedTitle')}</strong> {unifiedReport?.market_overview.anomaly_message || "High short squeeze probability!"}
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-zinc-950 text-zinc-550 border border-zinc-900 rounded-lg text-[9px] leading-relaxed font-semibold font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping shrink-0" />
              <span>{t(lang, 'noAnomalyMsg')}</span>
            </div>
          )}
        </div>

        {/* PANEL 3: COMBINED CORE SYNTHESIS & AI STRATEGY (4 col) */}
        <div className="lg:col-span-4 bg-[#0a0a0b] border border-zinc-900 rounded-xl p-4.5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider font-mono">
                  {t(lang, 'integratedSynerCoPilot')}
                </span>
              </div>
              <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {t(lang, 'jointAI')}
              </span>
            </div>

            {/* Combined Matrix Dial Card */}
            <div className={`p-3 rounded-lg border ${jointGauge.border} ${jointGauge.bg} flex items-center justify-between gap-3 shadow-sm`}>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] uppercase font-bold tracking-wider text-zinc-500 mb-0.5">
                  {t(lang, 'jointMatrixIndex')}
                </span>
                <span className={`text-[10px] font-extrabold ${jointGauge.text} tracking-tight uppercase leading-snug truncate`}>
                  {jointGauge.label}
                </span>
              </div>

              {/* Glowing High-Craft Circular Gauge */}
              <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    fill="transparent"
                    stroke="#1e1e24"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    fill="transparent"
                    stroke={jointGauge.stroke}
                    strokeWidth="3"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 - (jointScore / 100) * 113.1}
                    strokeLinecap="round"
                    style={{
                      filter: `drop-shadow(0 0 3px ${jointGauge.stroke})`
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-black tracking-tight font-mono text-zinc-100">
                    {jointScore}
                  </span>
                </div>
              </div>
            </div>

            {/* AI synthesis description */}
            <div className="mt-3.5" id="ai-deep-strategy-narrative">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block font-mono mb-1">
                {t(lang, 'crossMarketIntelStrategy')}
              </span>
              <p className="text-[10px] text-zinc-350 leading-relaxed font-sans select-text">
                {unifiedReport?.market_overview.global_strategy || t(lang, 'jointStrategyFallback')}
              </p>
            </div>
          </div>

          {/* Trigger deep sync diagnostics button */}
          <button
            id="interpret-joint-correlation-btn"
            onClick={() => onTriggerAnalysis('1d')}
            disabled={aiLoading}
            className="w-full py-2 px-3 bg-gradient-to-r from-indigo-650 to-indigo-505 hover:from-indigo-600 hover:to-indigo-400 text-white font-bold text-xs rounded-lg transition-all shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)] flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-500/20"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t(lang, 'compilingJoint')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
                <span>{t(lang, 'triggerJointSynergyReport')}</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
