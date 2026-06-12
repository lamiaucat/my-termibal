/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Cpu, RefreshCw, Sparkles, TrendingUp, TrendingDown, Info, ShieldAlert, Activity, Landmark } from 'lucide-react';
import { ChartCandle, CoinDetail, UnifiedAIReport } from '../types.js';
import { Language, t } from '../utils/translations.js';

interface AIAnalysisPanelProps {
  coin: CoinDetail;
  klines: ChartCandle[];
  timeframe: string;
  lang: Language;
  unifiedReport: UnifiedAIReport | null;
  aiLoading: boolean;
  aiError: string | null;
  onTriggerAnalysis: (timeframe: string) => void;
}

export default function AIAnalysisPanel({
  coin,
  klines,
  timeframe,
  lang,
  unifiedReport,
  aiLoading,
  aiError,
  onTriggerAnalysis
}: AIAnalysisPanelProps) {
  const [analysisTimeframe, setAnalysisTimeframe] = useState<string>('1d');

  const getLatestCandle = () => {
    if (klines.length === 0) return null;
    return klines[klines.length - 1];
  };

  const currentCandle = getLatestCandle();

  const handleFuturesAnalysis = async () => {
    onTriggerAnalysis(analysisTimeframe);
  };

  // --- Regex-Free High Performance Markdown Parser ---
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
            <code key={subIdx} className="px-1.5 py-0.5 font-mono text-[9px] bg-zinc-950 border border-zinc-800 text-indigo-400 rounded">
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
      // Divider
      if (trimmed === '---') {
        return <hr key={idx} className="my-2.5 border-zinc-850" />;
      }
      // Blockquotes
      if (trimmed.startsWith('>')) {
        return (
          <div key={idx} className="my-2.5 p-2.5 bg-indigo-950/20 text-indigo-300 text-[10px] border-l-2 border-indigo-500 rounded font-medium leading-relaxed shadow-[0_0_15px_rgba(99,102,241,0.05)]">
            {parseInlineBold(trimmed.substring(1).trim())}
          </div>
        );
      }
      // H3
      if (trimmed.startsWith('###')) {
        return (
          <h3 key={idx} className="text-[12px] font-bold text-white mt-4 mb-2 flex items-center gap-1.5 bg-indigo-500/5 px-2.5 py-1 rounded border-l-2 border-indigo-500">
            {parseInlineBold(trimmed.replace('###', '').trim())}
          </h3>
        );
      }
      // H4
      if (trimmed.startsWith('####')) {
        return (
          <h4 key={idx} className="text-[11px] font-semibold text-indigo-400 mt-2.5 mb-1.5">
            {parseInlineBold(trimmed.replace('####', '').trim())}
          </h4>
        );
      }
      // H2
      if (trimmed.startsWith('##')) {
        return (
          <h2 key={idx} className="text-xs font-bold text-indigo-300 mt-4 mb-2 border-b border-zinc-850 pb-1">
            {parseInlineBold(trimmed.replace('##', '').trim())}
          </h2>
        );
      }
      // Bulleted Lists
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        return (
          <li key={idx} className="ml-3 list-disc text-[11px] text-zinc-400 mb-1 leading-relaxed">
            {parseInlineBold(trimmed.substring(1).trim())}
          </li>
        );
      }
      // Line Break
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

  return (
    <div className="flex flex-col gap-4 bg-[#111113] border border-zinc-800 rounded-xl p-5 shadow-2xl flex-1" id="futures-deep-pillar">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-2 shrink-0" id="futures-analytics-title-row">
        <div className="flex items-center gap-x-1.5">
          <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h2 className="font-bold text-sm text-white tracking-tight">{t(lang, 'futuresAnalytics')}</h2>
        </div>
        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {t(lang, 'leverageTracker')}
        </span>
      </div>

      {/* Live Futures Metrics Widgets */}
      {currentCandle ? (
        <div className="grid grid-cols-2 gap-2 mb-4 shrink-0 font-sans" id="futures-metrics-grid">
          {/* Open Interest Delta */}
          <div className="bg-[#0a0a0b] p-2 rounded-lg border border-zinc-900 flex flex-col justify-between">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">{t(lang, 'oiDeltaText')}</span>
            <span className={`text-[11px] font-mono font-bold mt-1.5 ${
              (currentCandle.oiDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(currentCandle.oiDelta || 0) >= 0 ? '+' : ''}
              {currentCandle.oiDelta?.toLocaleString() || '0.00'}
            </span>
          </div>

          {/* Aggregated CVD */}
          <div className="bg-[#0a0a0b] p-2 rounded-lg border border-zinc-900 flex flex-col justify-between">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">AGG. CVD</span>
            <span className={`text-[11px] font-mono font-bold mt-1.5 ${
              (currentCandle.cvd || 0) >= 0 ? 'text-teal-400' : 'text-orange-400'
            }`}>
              {currentCandle.cvd?.toLocaleString() || '0.00'}
            </span>
          </div>

          {/* Funding Rate */}
          <div className="bg-[#0a0a0b] p-2 rounded-lg border border-zinc-900 flex flex-col justify-between">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">{t(lang, 'fundingRate')}</span>
            <span className="text-[11px] font-mono font-bold text-purple-400 mt-1.5">
              {currentCandle.fundingRate !== undefined
                ? `${(currentCandle.fundingRate * 100).toFixed(4)}%`
                : '0.0100%'}
            </span>
          </div>

          {/* Long/Short Ratio */}
          <div className="bg-[#0a0a0b] p-2 rounded-lg border border-zinc-900 flex flex-col justify-between">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">{t(lang, 'lsRatioText')}</span>
            <span className="text-[11px] font-mono font-bold text-yellow-500 mt-1.5">
              {currentCandle.longShortRatio !== undefined
                ? currentCandle.longShortRatio.toFixed(3)
                : '1.000'}
            </span>
          </div>

          {/* Liquidations Profile */}
          <div className="col-span-2 bg-[#0a0a0b] p-2 rounded-lg border border-zinc-900 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-wide">
              <span>{t(lang, 'liqTitle')}</span>
            </div>
            
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-green-400 font-bold">
                Short: ${currentCandle.liquidationsShort?.toLocaleString() || '0'}
              </span>
              <span className="text-red-400 font-bold">
                Long: ${currentCandle.liquidationsLong?.toLocaleString() || '0'}
              </span>
            </div>

            {/* Progress Bar of Liquidations */}
            <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 h-full transition-all duration-300"
                style={{
                  width: `${
                    (currentCandle.liquidationsShort || 0) + (currentCandle.liquidationsLong || 0) === 0
                      ? 50
                      : ((currentCandle.liquidationsShort || 0) /
                          ((currentCandle.liquidationsShort || 0) + (currentCandle.liquidationsLong || 0))) *
                        100
                  }%`,
                }}
              />
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{
                  width: `${
                    (currentCandle.liquidationsShort || 0) + (currentCandle.liquidationsLong || 0) === 0
                      ? 50
                      : ((currentCandle.liquidationsLong || 0) /
                          ((currentCandle.liquidationsShort || 0) + (currentCandle.liquidationsLong || 0))) *
                        100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0a0a0b] p-3 rounded-lg border border-zinc-900 text-[10px] text-zinc-500 mb-4 text-center shrink-0">
          {t(lang, 'waitFuturesLoaded')}
        </div>
      )}

      {/* 🔴 FUTURES AI COMMENTARY INTERACTION SYSTEM (Futures Verileri Yorumla) */}
      <div className="border-t border-zinc-850 pt-3 flex-1 flex flex-col min-h-0 gap-3.5" id="futures-ai-interpretation-panel">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
            <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
            {t(lang, 'aiFuturesTitle')}
          </span>
          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {t(lang, 'aiFuturesSub')}
          </span>
        </div>

        {/* Timeframe Select and Button Grid */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
            <span className="text-[10px] text-zinc-400 shrink-0 font-medium">{t(lang, 'analysisInterval')}</span>
            <select
              id="analysis-timeframe-futures-select"
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
            id="interpret-futures-data-btn"
            onClick={handleFuturesAnalysis}
            disabled={aiLoading}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-[0_4px_12px_rgba(79,70,229,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t(lang, 'analyzingBtn')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t(lang, 'interpretFuturesBtn')}</span>
              </>
            )}
          </button>
        </div>

        {/* Analysis Output Container */}
        {aiError && (
          <div className="text-[10px] text-red-400 bg-red-450/5 border border-red-500/10 rounded-lg p-2.5 mb-3 select-text shrink-0">
            {aiError}
          </div>
        )}

        {unifiedReport ? (() => {
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

          const futuresScore = unifiedReport.market_overview.futures_score !== undefined
            ? unifiedReport.market_overview.futures_score
            : (unifiedReport.market_overview.matrix_score || 0);

          const futuresStrategy = unifiedReport.market_overview.futures_strategy || unifiedReport.market_overview.global_strategy || '';

          const gaugeStyle = getMatrixGaugeStyles(futuresScore);

          return (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Master Futures Score Dial Card */}
              <div className={`p-3 rounded-xl border ${gaugeStyle.border} ${gaugeStyle.bg} flex items-center justify-between gap-3 shadow-lg transition duration-300 hover:scale-[1.01] shrink-0`}>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1">
                    {t(lang, 'futuresRiskScore')}
                  </span>
                  <span className={`text-[12px] font-extrabold ${gaugeStyle.text} tracking-tight uppercase leading-snug`}>
                    {gaugeStyle.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                    {futuresStrategy}
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
                      strokeDashoffset={150.7 - (futuresScore / 100) * 150.7}
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 4px ${gaugeStyle.stroke})`
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black tracking-tight font-mono text-zinc-100">
                      {futuresScore}
                    </span>
                    <span className="text-[6px] font-semibold text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                      FUT.
                    </span>
                  </div>
                </div>
              </div>

              {/* Structured Indicators badged values from the AI output */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  {t(lang, 'futuresSignalIndicators')}
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {(unifiedReport.futures_indicators || []).map((ind, idx) => (
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

              {/* Scrollable Report Box */}
              <div className="flex-1 overflow-y-auto pr-1 select-text bg-[#0a0a0b]/80 border border-zinc-850 rounded-xl p-3.5 scrollbar-thin scrollbar-thumb-zinc-800 shadow-inner">
                <div className="flex justify-between items-center text-[8px] text-zinc-500 font-mono mb-2.5 border-b border-zinc-850 pb-1.5 shrink-0">
                  <span>{t(lang, 'structure')}: {unifiedReport.market_overview.futures_structure}</span>
                  <span>{t(lang, 'analysisTime')}: {unifiedReport.timestamp}</span>
                </div>
                <div className="space-y-1.5">
                  {parseMarkdown(unifiedReport.futures_copilot_report)}
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-4 border border-zinc-850 border-dashed rounded-lg bg-[#0a0a0b]/20 min-h-[220px] animate-fade-in" id="futures-ai-placeholder">
            <Sparkles className="w-6 h-6 text-indigo-500/40 mb-2 animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-400 mb-1">{t(lang, 'interpretPlaceholderTitle')}</span>
            <p className="text-[9px] text-zinc-500 max-w-[200px] leading-relaxed">
              {t(lang, 'interpretPlaceholderDesc')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
