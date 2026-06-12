/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Clock, BarChart3, ArrowUpRight, ArrowDownRight, Activity, Sparkles, Cpu, RefreshCw, Info, ShieldAlert, AlertTriangle } from 'lucide-react';
import { CoinDetail, ChartCandle, UnifiedAIReport } from '../types.js';
import { Language, t } from '../utils/translations.js';
import { formatUSD, formatVolume } from '../utils/formatters.js';

interface StatsBarProps {
  coin: CoinDetail;
  onSelectPopular: (symbol: string) => void;
  latestCandle?: ChartCandle | null;
  lang: Language;
  unifiedReport: UnifiedAIReport | null;
  aiLoading: boolean;
  aiError: string | null;
  onTriggerAnalysis: (timeframe: string) => void;
}

const popularCoins = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'XRP', name: 'Ripple' },
];

export default function StatsBar({
  coin,
  onSelectPopular,
  latestCandle,
  lang,
  unifiedReport,
  aiLoading,
  aiError,
  onTriggerAnalysis
}: StatsBarProps) {
  const isPositive = coin.change24h >= 0;

  // Active AI timeframe selection state
  const [analysisTimeframe, setAnalysisTimeframe] = useState<string>('1d');

  const handleSpotAnalysis = async () => {
    onTriggerAnalysis(analysisTimeframe);
  };

  // High Performance Inline Markdown Parser
  function parseInlineBold(text: string) {
    const parts = text.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="font-bold text-zinc-100">
            {part}
          </strong>
        );
      }
      
      const codeParts = part.split('`');
      return codeParts.map((subPart, subIdx) => {
        if (subIdx % 2 === 1) {
          return (
            <code key={subIdx} className="px-1 py-0.5 font-mono text-[9px] bg-zinc-950 border border-zinc-800 text-green-400 rounded">
              {subPart}
            </code>
          );
        }
        return subPart;
      });
    });
  }

  function parseMarkdown(text: string) {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed === '---') {
        return <hr key={idx} className="my-2 border-zinc-805" />;
      }
      if (trimmed.startsWith('>')) {
        return (
          <div key={idx} className="my-2 p-2.5 bg-green-950/20 text-green-300 text-[10px] border-l-2 border-green-500 rounded font-medium leading-relaxed shadow-[0_0_15px_rgba(16,185,129,0.05)]">
            {parseInlineBold(trimmed.substring(1).trim())}
          </div>
        );
      }
      if (trimmed.startsWith('###')) {
        return (
          <h3 key={idx} className="text-[12px] font-bold text-white mt-4 mb-2 flex items-center gap-1.5 bg-green-500/5 px-2.5 py-1 rounded border-l-2 border-green-500">
            {parseInlineBold(trimmed.replace('###', '').trim())}
          </h3>
        );
      }
      if (trimmed.startsWith('####')) {
        return (
          <h4 key={idx} className="text-[11px] font-semibold text-green-400 mt-2.5 mb-1.5">
            {parseInlineBold(trimmed.replace('####', '').trim())}
          </h4>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h2 key={idx} className="text-xs font-bold text-green-300 mt-4 mb-2 border-b border-zinc-850 pb-1">
            {parseInlineBold(trimmed.replace('##', '').trim())}
          </h2>
        );
      }
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        return (
          <li key={idx} className="ml-3 list-disc text-[11px] text-zinc-400 mb-1 leading-relaxed">
            {parseInlineBold(trimmed.substring(1).trim())}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-1" />;
      }
      return (
        <p key={idx} className="text-[11px] text-zinc-350 leading-relaxed mb-1.5">
          {parseInlineBold(line)}
        </p>
      );
    });
  }

  // Neon gradient generator for Matrix score
  const getMatrixGaugeStyles = (score: number) => {
    if (score >= 80) {
      return {
        stroke: "#10b981",
        glow: "rgba(16,185,129,0.25)",
        bg: "bg-emerald-950/30",
        border: "border-emerald-500/30",
        text: "text-emerald-400",
        label: t(lang, 'strategicBuy')
      };
    } else if (score >= 40) {
      return {
        stroke: "#fbbf24",
        glow: "rgba(251,191,36,0.20)",
        bg: "bg-amber-950/20",
        border: "border-amber-500/30",
        text: "text-amber-400",
        label: t(lang, 'cautiousAccumulation')
      };
    } else {
      return {
        stroke: "#f43f5e",
        glow: "rgba(244,63,94,0.25)",
        bg: "bg-rose-950/30",
        border: "border-rose-500/30",
        text: "text-rose-400",
        label: t(lang, 'reduceRiskCash')
      };
    }
  };

  const spotScore = unifiedReport?.market_overview.spot_score !== undefined
    ? unifiedReport.market_overview.spot_score
    : (unifiedReport?.market_overview.matrix_score || 0);

  const spotStrategy = unifiedReport?.market_overview.spot_strategy || unifiedReport?.market_overview.global_strategy || '';

  const gaugeStyle = getMatrixGaugeStyles(spotScore);
  const circ = 2 * Math.PI * 30; // Radius=30, Perimeter=188.4
  const offset = circ - (spotScore / 100) * circ;

  return (
    <div className="flex flex-col gap-4 bg-[#111113] border border-zinc-800 rounded-xl p-5 shadow-2xl flex-1" id="coin-stats-bar">
      {/* Coin Meta Details */}
      <div className="flex items-start justify-between border-b border-zinc-800 pb-3 mb-2" id="coin-meta-details-row">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xl font-bold tracking-tight text-white">{coin.name}</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-zinc-900 text-zinc-300 rounded border border-zinc-800 shrink-0">
              {coin.symbol}/USDT
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            {t(lang, 'spotMarketAnalysis')}
          </div>
        </div>

        {/* Change Badge */}
        <div
          className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold border ${
            isPositive
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span>{isPositive ? '+' : ''}{coin.change24h.toFixed(2)}%</span>
        </div>
      </div>

      {/* Primary Price Display */}
      <div className="py-1">
        <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">{t(lang, 'spotCurrentPrice')}</span>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-3xl font-extrabold tracking-tight font-mono transition duration-300 ${
              isPositive
                ? 'text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                : 'text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.15)]'
            }`}
          >
            {formatUSD(coin.price)}
          </span>
          <span className="text-[10px] font-mono text-zinc-500">USDT</span>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 border-t border-zinc-850 pt-3">
        {/* High 24h */}
        <div className="bg-[#0a0a0b] p-2.5 rounded-lg border border-zinc-900">
          <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider block mb-0.5">{t(lang, 'high24h')}</span>
          <span className="text-xs font-semibold font-mono text-zinc-200">{formatUSD(coin.high24h)}</span>
        </div>

        {/* Low 24h */}
        <div className="bg-[#0a0a0b] p-2.5 rounded-lg border border-zinc-900">
          <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider block mb-0.5">{t(lang, 'low24h')}</span>
          <span className="text-xs font-semibold font-mono text-zinc-200">{formatUSD(coin.low24h)}</span>
        </div>

        {/* Volume */}
        <div className="col-span-2 bg-[#0a0a0b] p-2.5 rounded-lg border border-zinc-900 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider block mb-0.5">{t(lang, 'volume24h')}</span>
            <span className="text-xs font-bold font-mono text-white">{formatVolume(coin.volume24h)}</span>
          </div>
          <BarChart3 className="w-4 h-4 text-zinc-500" />
        </div>
      </div>

      {/* 🟢 SPOT AI COMMENTARY INTERACTION SYSTEM (Spot Verileri Yorumla) */}
      <div className="border-t border-zinc-850 pt-3 flex-1 flex flex-col min-h-0 gap-3.5" id="spot-ai-interpretation-panel">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
            {t(lang, 'aiSpotTitle')}
          </span>
          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {t(lang, 'aiSpotSub')}
          </span>
        </div>

        {/* Timeframe Select and Button Grid */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
            <span className="text-[10px] text-zinc-400 shrink-0 font-medium">{t(lang, 'analysisInterval')}</span>
            <select
              id="analysis-timeframe-spot-select"
              value={analysisTimeframe}
              onChange={(e) => setAnalysisTimeframe(e.target.value)}
              className="bg-zinc-900 text-zinc-100 text-[10px] outline-none border border-zinc-800 rounded px-1.5 py-1 font-semibold flex-1 cursor-pointer"
            >
              <option value="5m">{t(lang, 'tf5m')}</option>
              <option value="15m">{t(lang, 'tf15m')}</option>
              <option value="1h">{t(lang, 'tf1h')}</option>
              <option value="4h">{t(lang, 'tf4h')}</option>
              <option value="1d">{t(lang, 'tf1d')}</option>
            </select>
          </div>

          <button
            id="interpret-spot-data-btn"
            onClick={handleSpotAnalysis}
            disabled={aiLoading}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t(lang, 'analyzingBtn')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t(lang, 'interpretSpotBtn')}</span>
              </>
            )}
          </button>
        </div>

        {/* Anomaly Alerts Box (if detected) */}
        {unifiedReport?.market_overview.anomaly_detected && (
          <div className="p-3 bg-rose-950/20 text-rose-400 border border-rose-500/25 rounded-lg flex items-start gap-2.5 animate-pulse min-h-[50px] shadow-[0_0_15px_rgba(244,63,94,0.1)] shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed select-text font-medium">
              {unifiedReport.market_overview.anomaly_message}
            </div>
          </div>
        )}

        {/* Unified Matrix AI Render Results */}
        {unifiedReport ? (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0" id="spot-ai-report-display">
            {/* Master Spot Score Dial Card */}
            <div className={`p-3 rounded-xl border ${gaugeStyle.border} ${gaugeStyle.bg} flex items-center justify-between gap-3 shadow-lg transition duration-300 hover:scale-[1.01] shrink-0`}>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1">
                  {t(lang, 'spotTechnicalScore')}
                </span>
                <span className={`text-[12px] font-extrabold ${gaugeStyle.text} tracking-tight uppercase leading-snug`}>
                  {gaugeStyle.label}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  {spotStrategy}
                </span>
              </div>

              {/* Glowing High-Craft Circular Gauge */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    fill="transparent"
                    stroke="#1e1e24"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    fill="transparent"
                    stroke={gaugeStyle.stroke}
                    strokeWidth="4"
                    strokeDasharray="150.7"
                    strokeDashoffset={150.7 - (spotScore / 100) * 150.7}
                    strokeLinecap="round"
                    style={{
                      filter: `drop-shadow(0 0 4px ${gaugeStyle.stroke})`
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black tracking-tight font-mono text-zinc-100">
                    {spotScore}
                  </span>
                  <span className="text-[6px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                    SPOT
                  </span>
                </div>
              </div>
            </div>

            {/* Structured Indicators badged values based dynamically from the AI output */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {t(lang, 'spotAnalysisIndicators')}
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {(unifiedReport.spot_indicators || []).map((ind, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-900"
                  >
                    <span className="text-[10px] font-semibold text-zinc-400">{ind.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${ind.badge_class}`}>
                      {ind.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Markdown Report Display text scrollbox */}
            <div className="flex-1 bg-[#0a0a0b]/80 border border-zinc-850 rounded-xl p-3.5 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 shadow-inner select-text min-h-[140px]" id="spot-report-result-scrollbox">
              <div className="flex justify-between items-center text-[8px] text-zinc-500 font-mono mb-2 border-b border-zinc-850 pb-1.5 shrink-0">
                <span>{t(lang, 'structure')}: {unifiedReport.market_overview.spot_structure}</span>
                <span>{t(lang, 'analysisTime')}: {unifiedReport.timestamp}</span>
              </div>
              <div className="space-y-1.5 leading-relaxed">
                {parseMarkdown(unifiedReport.spot_copilot_report)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-4 border border-zinc-850 border-dashed rounded-lg bg-[#0a0a0b]/20 min-h-[220px] animate-fade-in" id="spot-ai-placeholder">
            <Sparkles className="w-6 h-6 text-emerald-500/40 mb-2 animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-400 mb-1">{t(lang, 'interpretPlaceholderTitle')}</span>
            <p className="text-[9px] text-zinc-500 max-w-[200px] leading-relaxed">
              {t(lang, 'interpretPlaceholderDesc')}
            </p>
          </div>
        )}

        {/* Error state */}
        {aiError && (
          <div className="text-[10px] text-red-400 bg-red-400/5 border border-red-500/10 rounded-lg p-2 font-medium">
            {aiError}
          </div>
        )}
      </div>

      {/* Quick Select Quick Nav */}
      <div className="border-t border-zinc-850 pt-3 mt-auto">
        <span className="text-[11px] text-zinc-400 font-semibold block mb-2">{t(lang, 'popularPairs')}</span>
        <div className="grid grid-cols-2 gap-1.5" id="popular-coins-grid">
          {popularCoins.map((item) => (
            <button
               key={item.symbol}
               id={`popular-coin-${item.symbol}`}
               onClick={() => onSelectPopular(item.symbol)}
               className={`flex items-center justify-between w-full p-1.5 rounded-lg text-left text-[10px] font-semibold border transition ${
                 coin.symbol === item.symbol
                   ? 'bg-green-500/10 text-green-400 border-green-500/20 font-bold col-span-2'
                   : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white border-transparent'
               }`}
             >
              <span>{item.name}</span>
              <span className="font-mono text-zinc-500 text-[8px]">{item.symbol}/USDT</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
