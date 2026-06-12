/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  Time,
  DeepPartial,
  TimeChartOptions
} from 'lightweight-charts';
import { ChartCandle, IndicatorVisibility } from '../types.js';
import { formatPriceOnly, formatUSD } from '../utils/formatters.js';
import { Sliders, Activity, Sparkles, TrendingUp, BarChart3, HelpCircle, RefreshCw, Flame, BarChart, Clock } from 'lucide-react';
import { Language, t } from '../utils/translations.js';

interface DetectedOB {
  price: number;
  age: number;
  volume: number;
}

const findOrderBlocks = (data: ChartCandle[]) => {
  if (data.length < 5) return { bullishOB: null, bearishOB: null };

  let bullishOB: DetectedOB | null = null;
  let bearishOB: DetectedOB | null = null;

  const scanLimit = Math.min(data.length - 4, 150);
  const startIndex = data.length - 1 - 4;

  for (let i = startIndex; i >= startIndex - scanLimit && i > 0; i--) {
    const candle = data[i];
    const isRed = candle.close < candle.open;
    const isGreen = candle.close > candle.open;

    if (isRed && !bullishOB) {
      const next1 = data[i + 1];
      const next2 = data[i + 2];
      const next3 = data[i + 3];
      if (next1 && next2 && next3) {
        const hasBrokenStructure = next3.close > candle.high && (next1.close > next1.open || next2.close > next2.open);
        if (hasBrokenStructure) {
          bullishOB = {
            price: (candle.low + candle.open) / 2,
            age: startIndex - i,
            volume: candle.volume,
          };
        }
      }
    }

    if (isGreen && !bearishOB) {
      const next1 = data[i + 1];
      const next2 = data[i + 2];
      const next3 = data[i + 3];
      if (next1 && next2 && next3) {
        const hasBrokenStructure = next3.close < candle.low && (next1.close < next1.open || next2.close < next2.open);
        if (hasBrokenStructure) {
          bearishOB = {
            price: (candle.high + candle.open) / 2,
            age: startIndex - i,
            volume: candle.volume,
          };
        }
      }
    }

    if (bullishOB && bearishOB) break;
  }

  // Fallbacks if structure breaks not found
  if (!bullishOB && data.length > 0) {
    const last50 = data.slice(-50);
    const minLow = Math.min(...last50.map((c) => c.low));
    bullishOB = {
      price: minLow,
      age: 0,
      volume: 0,
    };
  }
  if (!bearishOB && data.length > 0) {
    const last50 = data.slice(-50);
    const maxHigh = Math.max(...last50.map((c) => c.high));
    bearishOB = {
      price: maxHigh,
      age: 0,
      volume: 0,
    };
  }

  return { bullishOB, bearishOB };
};

interface RsiSettings {
  length: number;
  smoothingLine: 'SMA' | 'EMA';
  smoothingLength: number;
  showPlot: boolean;
  showSmoothedMA: boolean;
  showUpperLimit: boolean;
  upperLimitValue: number;
  showMiddleLimit: boolean;
  middleLimitValue: number;
  showLowerLimit: boolean;
  lowerLimitValue: number;
  showBg: boolean;
}

interface TradingChartProps {
  key?: string;
  mode?: 'spot' | 'futures';
  candles: ChartCandle[];
  visibility: IndicatorVisibility;
  setVisibility: (v: IndicatorVisibility) => void;
  symbol: string;
  lang: Language;
}

export default function TradingChart({ mode = 'spot', candles, visibility, setVisibility, symbol, lang }: TradingChartProps) {
  const v = {
    ...visibility,
    rsi: mode === 'futures' ? false : visibility.rsi,
    macd: mode === 'futures' ? false : visibility.macd,
    oiDelta: mode === 'spot' ? false : visibility.oiDelta,
    cvd: mode === 'spot' ? false : visibility.cvd,
    fundingRate: mode === 'spot' ? false : visibility.fundingRate,
    liquidations: mode === 'spot' ? false : visibility.liquidations,
    longShortRatio: mode === 'spot' ? false : visibility.longShortRatio,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;

  // Realtime Live Clock State conforming precisely to requested "saniye,dakika,saat,gün,ay,yıl" format
  const [liveDate, setLiveDate] = useState<Date>(new Date());
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setLiveDate(new Date());
    }, 500);
    return () => clearInterval(clockTimer);
  }, []);

  const formatLiveClock = (date: Date) => {
    const saniye = String(date.getSeconds()).padStart(2, '0');
    const dakika = String(date.getMinutes()).padStart(2, '0');
    const saat = String(date.getHours()).padStart(2, '0');
    const gun = String(date.getDate()).padStart(2, '0');
    const ay = String(date.getMonth() + 1).padStart(2, '0');
    const yil = date.getFullYear();

    const offsetMin = -date.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMin) / 60);
    const tzSign = offsetMin >= 0 ? '+' : '-';
    const timezoneText = `(UTC${tzSign}${offsetHours})`;

    return {
      time: `${saat}:${dakika}:${saniye}`,
      dateStr: `${gun}.${ay}.${yil}`,
      timezoneText,
    };
  };

  // Customizable RSI Settings (Defaulting exactly to user's screenshots!)
  const [rsiSettings, setRsiSettings] = useState<RsiSettings>({
    length: 7,
    smoothingLine: 'SMA',
    smoothingLength: 7,
    showPlot: true,
    showSmoothedMA: false,
    showUpperLimit: true,
    upperLimitValue: 90,
    showMiddleLimit: true,
    middleLimitValue: 60,
    showLowerLimit: true,
    lowerLimitValue: 30,
    showBg: true,
  });

  const [showRsiSettingsModal, setShowRsiSettingsModal] = useState(false);
  const [tempRsiSettings, setTempRsiSettings] = useState<RsiSettings>({ ...rsiSettings });
  const [modalTab, setModalTab] = useState<'inputs' | 'style' | 'visibility'>('inputs');

  const hasSetInitialZoom = useRef<Record<string, boolean>>({});
  const previousStructureKeyRef = useRef<string>('');
  const latestCandlesRef = useRef<ChartCandle[] | null>(null);
  const updateRafIdRef = useRef<number | null>(null);
  const prevCandlesLengthRef = useRef<number>(0);
  const prevSecondToLastTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevSecondToLastHaRef = useRef<{ open: number; close: number } | null>(null);

  // Calculate Horizontal Cumulative Profiles (Volume, OI Delta and Liquidations)
  const prices = candles ? candles.map((c) => c.high).concat(candles.map((c) => c.low)) : [];
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const priceRange = maxPrice - minPrice;

  const binCount = 10;
  const bins: {
    floor: number;
    ceiling: number;
    shortLiqs: number;
    longLiqs: number;
    oiDeltaPositive: number;
    oiDeltaNegative: number;
  }[] = [];
  let maxLiqs = 1;
  let maxOi = 1;

  if (priceRange > 0 && candles && candles.length > 0) {
    const binSize = priceRange / binCount;
    for (let i = 0; i < binCount; i++) {
      const floor = minPrice + i * binSize;
      const ceiling = floor + binSize;
      bins.push({
        floor,
        ceiling,
        shortLiqs: 0,
        longLiqs: 0,
        oiDeltaPositive: 0,
        oiDeltaNegative: 0,
      });
    }

    candles.forEach((c) => {
      const clow = c.low;
      const chigh = c.high;
      const intersectingBins = bins.filter((b) => b.floor <= chigh && b.ceiling >= clow);
      if (intersectingBins.length === 0) return;

      const count = intersectingBins.length;
      intersectingBins.forEach((b) => {
        b.shortLiqs += (c.liquidationsShort || 0) / count;
        b.longLiqs += (c.liquidationsLong || 0) / count;

        const oi = c.oiDelta || 0;
        if (oi >= 0) {
          b.oiDeltaPositive += oi / count;
        } else {
          b.oiDeltaNegative += Math.abs(oi) / count;
        }
      });
    });

    maxLiqs = Math.max(...bins.map((b) => b.shortLiqs + b.longLiqs), 1);
    maxOi = Math.max(...bins.map((b) => b.oiDeltaPositive + b.oiDeltaNegative), 1);
  }

  // Chart Panel DOM references
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);
  const oiDeltaChartRef = useRef<HTMLDivElement>(null);
  const cvdChartRef = useRef<HTMLDivElement>(null);
  const fundingChartRef = useRef<HTMLDivElement>(null);
  const liqsChartRef = useRef<HTMLDivElement>(null);
  const longShortChartRef = useRef<HTMLDivElement>(null);

  // Chart instance API references
  const mainApiRef = useRef<IChartApi | null>(null);
  const rsiApiRef = useRef<IChartApi | null>(null);
  const macdApiRef = useRef<IChartApi | null>(null);
  const oiDeltaApiRef = useRef<IChartApi | null>(null);
  const cvdApiRef = useRef<IChartApi | null>(null);
  const fundingApiRef = useRef<IChartApi | null>(null);
  const liqsApiRef = useRef<IChartApi | null>(null);
  const longShortApiRef = useRef<IChartApi | null>(null);

  // Series references
  const mainSeriesRef = useRef<any>(null);
  const ema9SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const ema50SeriesRef = useRef<any>(null);
  const ema200SeriesRef = useRef<any>(null);

  const activeCount = [
    visibility.rsi,
    visibility.macd,
    visibility.oiDelta,
    visibility.cvd,
    visibility.fundingRate,
    visibility.liquidations,
    visibility.longShortRatio
  ].filter(Boolean).length;

  const calculatedMainHeight = activeCount > 0 ? 260 : 440;

  const rsiSeriesRef = useRef<any>(null);
  const rsi7SeriesRef = useRef<any>(null);

  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);
  const macdHistSeriesRef = useRef<any>(null);

  const oiDeltaSeriesRef = useRef<any>(null);
  const cvdSeriesRef = useRef<any>(null);
  const fundingSeriesRef = useRef<any>(null);
  const liqsLongSeriesRef = useRef<any>(null);
  const liqsShortSeriesRef = useRef<any>(null);
  const longShortSeriesRef = useRef<any>(null);

  const localeMap: Record<string, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    el: 'el-GR',
    ru: 'ru-RU',
    ar: 'ar-EG',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR'
  };

  // Setup layout option defaults
  const chartThemeOptions: DeepPartial<TimeChartOptions> = {
    layout: {
      background: { color: '#0d0d0f' },
      textColor: '#a1a1aa',
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    localization: {
      locale: localeMap[lang] || 'en-US',
      priceFormatter: (price: number) => {
        return formatPriceOnly(price);
      },
    },
    grid: {
      vertLines: { color: 'rgba(39, 39, 42, 0.35)' },
      horzLines: { color: 'rgba(39, 39, 42, 0.35)' },
    },
    crosshair: {
      mode: 1, // Magnet mode
      vertLine: {
        color: '#52525b',
        style: 3, // Dotted
        labelBackgroundColor: '#18181b',
      },
      horzLine: {
        color: '#52525b',
        style: 3,
        labelBackgroundColor: '#18181b',
      },
    },
    timeScale: {
      borderColor: 'rgba(39, 39, 42, 0.7)',
      timeVisible: true,
      secondsVisible: false,
    },
  };

  useEffect(() => {
    if (!candles || candles.length === 0) return;
    if (!mainChartRef.current) return;

    const currentStructureKey = [
      symbol,
      v.rsi,
      v.macd,
      v.oiDelta,
      v.cvd,
      v.fundingRate,
      v.liquidations,
      v.longShortRatio,
      v.heikinAshi,
      v.orderBlocks,
      JSON.stringify(rsiSettings),
    ].join('|');

    previousStructureKeyRef.current = currentStructureKey;

    let isDisposed = false;

    // --- Cleanup previous instances to prevent "Object is disposed" crashes safely ---
    const cleanupInstances = () => {
      const apis = [
        mainApiRef,
        rsiApiRef,
        macdApiRef,
        oiDeltaApiRef,
        cvdApiRef,
        fundingApiRef,
        liqsApiRef,
        longShortApiRef,
      ];
      apis.forEach((apiRef) => {
        if (apiRef.current) {
          try {
            apiRef.current.remove();
          } catch (e) {
            console.warn('Silent issue clearing chart container:', e);
          }
          apiRef.current = null;
        }
      });
    };

    cleanupInstances();

    const container = containerRef.current;
    let parentWidth = 600;
    if (container) {
      const computed = window.getComputedStyle(container);
      const paddingLeft = parseFloat(computed.paddingLeft) || 0;
      const paddingRight = parseFloat(computed.paddingRight) || 0;
      parentWidth = Math.max(100, container.clientWidth - paddingLeft - paddingRight - 8);
    }

    const subHeight = 80;

    // ============== 1. MAIN CHART ==============
    const mainChart = createChart(mainChartRef.current, {
      ...chartThemeOptions,
      width: parentWidth,
      height: calculatedMainHeight,
    });
    mainApiRef.current = mainChart;

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'custom',
        minMove: 0.0000000001,
        formatter: (price: number) => {
          return formatPriceOnly(price);
        },
      },
    });
    mainSeriesRef.current = candleSeries;

    // ================== HEIKIN ASHI TRANSFORMATION ==================
    let displayData = [];
    if (v.heikinAshi) {
      let prevHA: { open: number; close: number } | null = null;
      displayData = candles.map((c) => {
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        let haOpen = 0;
        if (!prevHA) {
          haOpen = (c.open + c.close) / 2;
        } else {
          haOpen = (prevHA.open + prevHA.close) / 2;
        }
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);

        const row = {
          time: c.time as Time,
          open: haOpen,
          high: haHigh,
          low: haLow,
          close: haClose,
        };
        prevHA = { open: haOpen, close: haClose };
        return row;
      });
    } else {
      displayData = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    }
    candleSeries.setData(displayData);

    // EMA overlays creation (More professional brand tonal palette)
    const ema9Series = mainChart.addSeries(LineSeries, {
      color: '#818cf8',
      lineWidth: 1,
      title: 'EMA 9',
      visible: v.ema9,
      priceFormat: {
        type: 'custom',
        minMove: 0.0000000001,
        formatter: (price: number) => {
          return formatPriceOnly(price);
        },
      },
    });
    const ema21Series = mainChart.addSeries(LineSeries, {
      color: '#a5b4fc',
      lineWidth: 1,
      title: 'EMA 21',
      visible: v.ema21,
      priceFormat: {
        type: 'custom',
        minMove: 0.0000000001,
        formatter: (price: number) => {
          return formatPriceOnly(price);
        },
      },
    });
    const ema50Series = mainChart.addSeries(LineSeries, {
      color: '#cbd5e1',
      lineWidth: 1,
      title: 'EMA 50',
      visible: v.ema50,
      priceFormat: {
        type: 'custom',
        minMove: 0.0000000001,
        formatter: (price: number) => {
          return formatPriceOnly(price);
        },
      },
    });
    const ema200Series = mainChart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 2,
      title: 'EMA 200',
      visible: v.ema200,
      priceFormat: {
        type: 'custom',
        minMove: 0.0000000001,
        formatter: (price: number) => {
          return formatPriceOnly(price);
        },
      },
    });

    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;

    // Feed EMA Data
    ema9Series.setData(candles.filter((c) => c.ema9 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema9! })));
    ema21Series.setData(candles.filter((c) => c.ema21 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema21! })));
    ema50Series.setData(candles.filter((c) => c.ema50 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema50! })));
    ema200Series.setData(candles.filter((c) => c.ema200 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema200! })));

    // ================== ORDER BLOCKS (SIPARİŞ BLOKLARI) ==================
    if (v.orderBlocks) {
      const { bullishOB, bearishOB } = findOrderBlocks(candles);
      if (bullishOB) {
        try {
          candleSeries.createPriceLine({
            price: bullishOB.price,
            color: '#10b981',
            lineWidth: 2,
            lineStyle: 1, // Solid
            axisLabelVisible: true,
            title: lang === 'tr' ? '🟢 Boğa Sipariş Bloğu (OB Destek)' : '🟢 Bullish Order Block (OB Support)',
          });
        } catch (e) {
          console.warn('Error creating bullish OB line:', e);
        }
      }
      if (bearishOB) {
        try {
          candleSeries.createPriceLine({
            price: bearishOB.price,
            color: '#ef4444',
            lineWidth: 2,
            lineStyle: 1, // Solid
            axisLabelVisible: true,
            title: lang === 'tr' ? '🔴 Ayı Sipariş Bloğu (OB Direnç)' : '🔴 Bearish Order Block (OB Resistance)',
          });
        } catch (e) {
          console.warn('Error creating bearish OB line:', e);
        }
      }
    }

    // Active subcharts track array for timescale sync loop
    interface ActiveSub {
      chart: IChartApi;
      type: string;
    }
    const subchartList: ActiveSub[] = [];

    // ============== 2. RSI SUBCHART ==============
    let rsiChart: IChartApi | null = null;
    if (v.rsi && rsiChartRef.current) {
      rsiChart = createChart(rsiChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      rsiApiRef.current = rsiChart;
      subchartList.push({ chart: rsiChart, type: 'RSI' });

      // Add RSI boundary guide lines
      if (rsiSettings.showUpperLimit) {
        const overboughtLine = rsiChart.addSeries(LineSeries, {
          color: '#ef4444', // slightly thick bold red
          lineWidth: 2,
          title: rsiSettings.upperLimitValue.toString()
        });
        overboughtLine.setData(candles.map((c) => ({ time: c.time as Time, value: rsiSettings.upperLimitValue })));
      }

      if (rsiSettings.showLowerLimit) {
        const oversoldLine = rsiChart.addSeries(LineSeries, {
          color: '#10b981', // slightly thick bold green
          lineWidth: 2,
          title: rsiSettings.lowerLimitValue.toString()
        });
        oversoldLine.setData(candles.map((c) => ({ time: c.time as Time, value: rsiSettings.lowerLimitValue })));
      }

      if (rsiSettings.showMiddleLimit) {
        const middleLine = rsiChart.addSeries(LineSeries, {
          color: 'rgba(156, 163, 175, 0.25)',
          lineWidth: 1,
          title: rsiSettings.middleLimitValue.toString()
        });
        middleLine.setData(candles.map((c) => ({ time: c.time as Time, value: rsiSettings.middleLimitValue })));
      }

      // Draw active RSI series
      if (v.rsi) {
        if (rsiSettings.showPlot) {
          const rsiLineSeries = rsiChart.addSeries(LineSeries, {
            color: '#f97316', // Solid Vibrant Orange
            lineWidth: 2,
            title: `RSI(${rsiSettings.length})`
          });
          rsiSeriesRef.current = rsiLineSeries;
          rsiLineSeries.setData(
            candles
              .filter((c) => (rsiSettings.length === 7 ? c.rsi7 : c.rsi) !== undefined)
              .map((c) => ({
                time: c.time as Time,
                value: rsiSettings.length === 7 ? c.rsi7! : c.rsi!
              }))
          );
        }

        if (rsiSettings.showSmoothedMA) {
          const smaSeries = rsiChart.addSeries(LineSeries, {
            color: '#2563eb', // Blue
            lineWidth: 2,
            title: `${rsiSettings.smoothingLine}(${rsiSettings.smoothingLength})`
          });
          rsi7SeriesRef.current = smaSeries;
          smaSeries.setData(
            candles
              .filter((c) => c.rsi7Sma !== undefined)
              .map((c) => ({
                time: c.time as Time,
                value: c.rsi7Sma!
              }))
          );
        }
      }
    }

    // ============== 3. MACD SUBCHART ==============
    let macdChart: IChartApi | null = null;
    if (v.macd && macdChartRef.current) {
      macdChart = createChart(macdChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      macdApiRef.current = macdChart;
      subchartList.push({ chart: macdChart, type: 'MACD' });

      const mLine = macdChart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, title: 'MACD' });
      const mSignal = macdChart.addSeries(LineSeries, { color: '#f43f5e', lineWidth: 1, title: 'Signal' });
      const mHist = macdChart.addSeries(HistogramSeries, { title: 'Histogram' });

      macdLineSeriesRef.current = mLine;
      macdSignalSeriesRef.current = mSignal;
      macdHistSeriesRef.current = mHist;

      mLine.setData(candles.filter((c) => c.macd !== undefined).map((c) => ({ time: c.time as Time, value: c.macd! })));
      mSignal.setData(candles.filter((c) => c.macdSignal !== undefined).map((c) => ({ time: c.time as Time, value: c.macdSignal! })));
      mHist.setData(candles.filter((c) => c.macdHist !== undefined).map((c) => ({
        time: c.time as Time,
        value: c.macdHist!,
        color: c.macdHist! >= 0 ? '#10b981' : '#ef4444',
      })));
    }

    // ============== 4. OPEN INTEREST DELTA SUBCHART ==============
    let oiChart: IChartApi | null = null;
    if (v.oiDelta && oiDeltaChartRef.current) {
      oiChart = createChart(oiDeltaChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      oiDeltaApiRef.current = oiChart;
      subchartList.push({ chart: oiChart, type: 'OI_DELTA' });

      const oiDeltaSeries = oiChart.addSeries(HistogramSeries, { title: 'OI Delta' });
      oiDeltaSeriesRef.current = oiDeltaSeries;

      const oiData = candles.map((c) => ({
        time: c.time as Time,
        value: c.oiDelta || 0,
        color: (c.oiDelta || 0) >= 0 ? '#10b981' : '#ef4444',
      }));
      oiDeltaSeries.setData(oiData);
    }

    // ============== 5. CUMULATIVE VOLUME DELTA (CVD) SUBCHART ==============
    let cvdChart: IChartApi | null = null;
    if (v.cvd && cvdChartRef.current) {
      cvdChart = createChart(cvdChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      cvdApiRef.current = cvdChart;
      subchartList.push({ chart: cvdChart, type: 'CVD' });

      const cvdSeries = cvdChart.addSeries(LineSeries, { color: '#14b8a6', lineWidth: 2, title: 'CVD' });
      cvdSeriesRef.current = cvdSeries;

      cvdSeries.setData(candles.filter((c) => c.cvd !== undefined).map((c) => ({ time: c.time as Time, value: c.cvd! })));
    }

    // ============== 6. FUNDING RATE SUBCHART ==============
    let fundingChart: IChartApi | null = null;
    if (v.fundingRate && fundingChartRef.current) {
      fundingChart = createChart(fundingChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      fundingApiRef.current = fundingChart;
      subchartList.push({ chart: fundingChart, type: 'FUNDING_RATE' });

      const fundingSeries = fundingChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2, title: 'Funding %' });
      fundingSeriesRef.current = fundingSeries;

      // Add zero line guide
      const zeroLine = fundingChart.addSeries(LineSeries, { color: 'rgba(156, 163, 175, 0.2)', lineWidth: 1 });
      zeroLine.setData(candles.map((c) => ({ time: c.time as Time, value: 0 })));

      // Render as readable percent (e.g. fundingRate * 100)
      fundingSeries.setData(candles.filter((c) => c.fundingRate !== undefined).map((c) => ({
        time: c.time as Time,
        value: c.fundingRate! * 100,
      })));
    }

    // ============== 7. LIQUIDATIONS PROFILE SUBCHART ==============
    let liqsChart: IChartApi | null = null;
    if (v.liquidations && liqsChartRef.current) {
      liqsChart = createChart(liqsChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      liqsApiRef.current = liqsChart;
      subchartList.push({ chart: liqsChart, type: 'LIQ_PROFILE' });

      // Combined view with long liquidations going downwards (negative) and shorts going upwards (positive)
      const shortLiqsSeries = liqsChart.addSeries(HistogramSeries, {
        title: lang === 'tr' ? 'Short Liq (Alım Squeeze)' : 'Short Liq (Buying Squeeze)',
        color: '#10b981',
      });
      const longLiqsSeries = liqsChart.addSeries(HistogramSeries, {
        title: lang === 'tr' ? 'Long Liq (Satım Squeeze)' : 'Long Liq (Selling Squeeze)',
        color: '#ef4444',
      });

      liqsLongSeriesRef.current = longLiqsSeries;
      liqsShortSeriesRef.current = shortLiqsSeries;

      shortLiqsSeries.setData(candles.map((c) => ({
        time: c.time as Time,
        value: c.liquidationsShort || 0,
      })));
      longLiqsSeries.setData(candles.map((c) => ({
        time: c.time as Time,
        // plot downwards for visual excellence
        value: -(c.liquidationsLong || 0),
      })));
    }

    // ============== 8. LONG/SHORT RATIO SUBCHART ==============
    let lSRatioChart: IChartApi | null = null;
    if (v.longShortRatio && longShortChartRef.current) {
      lSRatioChart = createChart(longShortChartRef.current, {
        ...chartThemeOptions,
        width: parentWidth,
        height: 100,
      });
      longShortApiRef.current = lSRatioChart;
      subchartList.push({ chart: lSRatioChart, type: 'LONG_SHORT_RATIO' });

      const longShortSeries = lSRatioChart.addSeries(LineSeries, { color: '#facc15', lineWidth: 2, title: 'Ratio' });
      longShortSeriesRef.current = longShortSeries;

      // Add balanced 1.0 guide
      const balancedLine = lSRatioChart.addSeries(LineSeries, { color: 'rgba(156, 163, 175, 0.2)', lineWidth: 1 });
      balancedLine.setData(candles.map((c) => ({ time: c.time as Time, value: 1.0 })));

      longShortSeries.setData(candles.filter((c) => c.longShortRatio !== undefined).map((c) => ({
        time: c.time as Time,
        value: c.longShortRatio!,
      })));
    }

    // ================== TIMESCALE SYNCHRONIZATION (DYNAMIC SYNC LOOP) ==================
    const mainTimeScale = mainChart.timeScale();
    const allScales = [mainTimeScale, ...subchartList.map((sc) => sc.chart.timeScale())];

    allScales.forEach((scale, index) => {
      scale.subscribeVisibleLogicalRangeChange((range) => {
        if (isDisposed) return;
        if (!range) return;
        allScales.forEach((targetScale, targetIndex) => {
          if (index !== targetIndex) {
            try {
              targetScale.setVisibleLogicalRange(range);
            } catch (e) {}
          }
        });
      });
    });

    // Preset initial window zoom - ONLY execute once per unique symbol/mode combination to preserve user scroll and zoom states!
    const zoomKey = `${symbol}_${mode}`;
    if (!hasSetInitialZoom.current[zoomKey] && displayData.length > 50) {
      const fromIdx = Math.max(0, displayData.length - 120);
      try {
        mainTimeScale.setVisibleRange({
          from: displayData[fromIdx].time as Time,
          to: displayData[displayData.length - 1].time as Time,
        });
        hasSetInitialZoom.current[zoomKey] = true;
      } catch (e) {}
    }

    // ================== RESIZE OBSERVER ==================
    let resizeAnimationFrameId: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (isDisposed) return;
      if (entries.length === 0) return;
      const { width } = entries[0].contentRect;

      if (resizeAnimationFrameId !== null) {
        cancelAnimationFrame(resizeAnimationFrameId);
      }

      resizeAnimationFrameId = requestAnimationFrame(() => {
        if (isDisposed) return;
        try {
          // Guard against collapse of parent containers back to 0 (circular flex dependency)
          if (width > 50) {
            mainChart.resize(width, calculatedMainHeight);
            if (rsiChart) rsiChart.resize(width, subHeight);
            if (macdChart) macdChart.resize(width, subHeight);
            if (oiChart) oiChart.resize(width, subHeight);
            if (cvdChart) cvdChart.resize(width, subHeight);
            if (fundingChart) fundingChart.resize(width, subHeight);
            if (liqsChart) liqsChart.resize(width, subHeight);
            if (lSRatioChart) lSRatioChart.resize(width, subHeight);
          }
        } catch (e) {
          console.warn('Silent chart resize skipped; likely container unmounted.', e);
        }
      });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    prevCandlesLengthRef.current = candles.length;
    if (candles.length >= 2) {
      prevSecondToLastTimeRef.current = candles[candles.length - 2].time;
    }
    prevLastTimeRef.current = candles[candles.length - 1].time;

    if (v.heikinAshi && displayData.length >= 2) {
      const h2 = displayData[displayData.length - 2];
      prevSecondToLastHaRef.current = { open: h2.open, close: h2.close };
    }

    return () => {
      isDisposed = true;
      if (resizeAnimationFrameId !== null) {
        cancelAnimationFrame(resizeAnimationFrameId);
      }
      if (updateRafIdRef.current !== null) {
        cancelAnimationFrame(updateRafIdRef.current);
        updateRafIdRef.current = null;
      }
      resizeObserver.disconnect();
      cleanupInstances();
    };
  }, [
    symbol,
    candles?.length > 0,
    visibility.rsi,
    rsiSettings,
    visibility.macd,
    visibility.oiDelta,
    visibility.cvd,
    visibility.liquidations,
    visibility.fundingRate,
    visibility.longShortRatio,
    visibility.heikinAshi,
    visibility.orderBlocks,
    visibility.profileVisible,
  ]); // Recreate and redraw on any pane layouts toggle or symbol changes

  // HIGH-PERFORMANCE IN-PLACE DATA UPDATE EFFECT (Hook 2)
  // Re-runs whenever candles change, updating the existing series/charts in-place without recreation
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    if (!mainApiRef.current) return;

    const lastIdx = candles.length - 1;
    const secondToLastIdx = candles.length - 2;

    const isIncremental =
      mainApiRef.current &&
      ((candles.length === prevCandlesLengthRef.current &&
        prevSecondToLastTimeRef.current !== null &&
        secondToLastIdx >= 0 &&
        candles[secondToLastIdx].time === prevSecondToLastTimeRef.current) ||
       (candles.length === prevCandlesLengthRef.current + 1 &&
        prevLastTimeRef.current !== null &&
        secondToLastIdx >= 0 &&
        candles[secondToLastIdx].time === prevLastTimeRef.current));

    latestCandlesRef.current = candles;

    if (updateRafIdRef.current === null) {
      updateRafIdRef.current = requestAnimationFrame(() => {
        updateRafIdRef.current = null;
        const currentCandles = latestCandlesRef.current;
        if (!currentCandles || currentCandles.length === 0) return;

        if (isIncremental) {
          const lastCandle = currentCandles[currentCandles.length - 1];
          const time = lastCandle.time as Time;

          let lastMainCandleData;
          if (v.heikinAshi) {
            let haOpen = 0;
            let haClose = 0;
            if (currentCandles.length === prevCandlesLengthRef.current) {
              const prevHA = prevSecondToLastHaRef.current || {
                open: (currentCandles[currentCandles.length - 2].open + currentCandles[currentCandles.length - 2].close) / 2,
                close: (currentCandles[currentCandles.length - 2].open + currentCandles[currentCandles.length - 2].high + currentCandles[currentCandles.length - 2].low + currentCandles[currentCandles.length - 2].close) / 4,
              };
              haClose = (lastCandle.open + lastCandle.high + lastCandle.low + lastCandle.close) / 4;
              haOpen = (prevHA.open + prevHA.close) / 2;
            } else {
              const oldLast = currentCandles[currentCandles.length - 2];
              const oldPrevHA = prevSecondToLastHaRef.current || {
                open: (currentCandles[currentCandles.length - 3].open + currentCandles[currentCandles.length - 3].close) / 2,
                close: (currentCandles[currentCandles.length - 3].open + currentCandles[currentCandles.length - 3].high + currentCandles[currentCandles.length - 3].low + currentCandles[currentCandles.length - 3].close) / 4,
              };
              const oldHaClose = (oldLast.open + oldLast.high + oldLast.low + oldLast.close) / 4;
              const oldHaOpen = (oldPrevHA.open + oldPrevHA.close) / 2;
              prevSecondToLastHaRef.current = { open: oldHaOpen, close: oldHaClose };

              haClose = (lastCandle.open + lastCandle.high + lastCandle.low + lastCandle.close) / 4;
              haOpen = (oldHaOpen + oldHaClose) / 2;
            }

            const haHigh = Math.max(lastCandle.high, haOpen, haClose);
            const haLow = Math.min(lastCandle.low, haOpen, haClose);
            lastMainCandleData = {
              time,
              open: haOpen,
              high: haHigh,
              low: haLow,
              close: haClose,
            };
          } else {
            lastMainCandleData = {
              time,
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
            };
          }

          if (mainSeriesRef.current) {
            try { mainSeriesRef.current.update(lastMainCandleData); } catch (e) {}
          }

          if (ema9SeriesRef.current && lastCandle.ema9 !== undefined) {
            try { ema9SeriesRef.current.update({ time, value: lastCandle.ema9 }); } catch (e) {}
          }
          if (ema21SeriesRef.current && lastCandle.ema21 !== undefined) {
            try { ema21SeriesRef.current.update({ time, value: lastCandle.ema21 }); } catch (e) {}
          }
          if (ema50SeriesRef.current && lastCandle.ema50 !== undefined) {
            try { ema50SeriesRef.current.update({ time, value: lastCandle.ema50 }); } catch (e) {}
          }
          if (ema200SeriesRef.current && lastCandle.ema200 !== undefined) {
            try { ema200SeriesRef.current.update({ time, value: lastCandle.ema200 }); } catch (e) {}
          }

          if (v.rsi && rsiSeriesRef.current) {
            const rsiVal = rsiSettings.length === 7 ? lastCandle.rsi7 : lastCandle.rsi;
            if (rsiVal !== undefined) {
              try { rsiSeriesRef.current.update({ time, value: rsiVal }); } catch (e) {}
            }
          }
          if (v.rsi && rsi7SeriesRef.current && lastCandle.rsi7Sma !== undefined) {
            try { rsi7SeriesRef.current.update({ time, value: lastCandle.rsi7Sma }); } catch (e) {}
          }

          if (v.macd) {
            if (macdLineSeriesRef.current && lastCandle.macd !== undefined) {
              try { macdLineSeriesRef.current.update({ time, value: lastCandle.macd }); } catch (e) {}
            }
            if (macdSignalSeriesRef.current && lastCandle.macdSignal !== undefined) {
              try { macdSignalSeriesRef.current.update({ time, value: lastCandle.macdSignal }); } catch (e) {}
            }
            if (macdHistSeriesRef.current && lastCandle.macdHist !== undefined) {
              try {
                macdHistSeriesRef.current.update({
                  time,
                  value: lastCandle.macdHist,
                  color: lastCandle.macdHist >= 0 ? '#10b981' : '#ef4444',
                });
              } catch (e) {}
            }
          }

          if (v.oiDelta && oiDeltaSeriesRef.current) {
            const oiVal = lastCandle.oiDelta || 0;
            try {
              oiDeltaSeriesRef.current.update({
                time,
                value: oiVal,
                color: oiVal >= 0 ? '#10b981' : '#ef4444',
              });
            } catch (e) {}
          }

          if (v.cvd && cvdSeriesRef.current && lastCandle.cvd !== undefined) {
            try { cvdSeriesRef.current.update({ time, value: lastCandle.cvd }); } catch (e) {}
          }

          if (v.fundingRate && fundingSeriesRef.current && lastCandle.fundingRate !== undefined) {
            try { fundingSeriesRef.current.update({ time, value: lastCandle.fundingRate * 100 }); } catch (e) {}
          }

          if (v.liquidations) {
            if (liqsShortSeriesRef.current) {
              try { liqsShortSeriesRef.current.update({ time, value: lastCandle.liquidationsShort || 0 }); } catch (e) {}
            }
            if (liqsLongSeriesRef.current) {
              try { liqsLongSeriesRef.current.update({ time, value: -(lastCandle.liquidationsLong || 0) }); } catch (e) {}
            }
          }

          if (v.longShortRatio && longShortSeriesRef.current && lastCandle.longShortRatio !== undefined) {
            try { longShortSeriesRef.current.update({ time, value: lastCandle.longShortRatio }); } catch (e) {}
          }
        } else {
          // FULL RELOAD IN-PLACE
          let displayData = [];
          if (v.heikinAshi) {
            let prevHA: { open: number; close: number } | null = null;
            displayData = currentCandles.map((c) => {
              const haClose = (c.open + c.high + c.low + c.close) / 4;
              let haOpen = 0;
              if (!prevHA) {
                haOpen = (c.open + c.close) / 2;
              } else {
                haOpen = (prevHA.open + prevHA.close) / 2;
              }
              const haHigh = Math.max(c.high, haOpen, haClose);
              const haLow = Math.min(c.low, haOpen, haClose);

              const row = {
                time: c.time as Time,
                open: haOpen,
                high: haHigh,
                low: haLow,
                close: haClose,
              };
              prevHA = { open: haOpen, close: haClose };
              return row;
            });
          } else {
            displayData = currentCandles.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));
          }

          if (mainSeriesRef.current) {
            try { mainSeriesRef.current.setData(displayData); } catch (e) {}
          }

          if (ema9SeriesRef.current) {
            try { ema9SeriesRef.current.setData(currentCandles.filter((c) => c.ema9 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema9! }))); } catch (e) {}
          }
          if (ema21SeriesRef.current) {
            try { ema21SeriesRef.current.setData(currentCandles.filter((c) => c.ema21 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema21! }))); } catch (e) {}
          }
          if (ema50SeriesRef.current) {
            try { ema50SeriesRef.current.setData(currentCandles.filter((c) => c.ema50 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema50! }))); } catch (e) {}
          }
          if (ema200SeriesRef.current) {
            try { ema200SeriesRef.current.setData(currentCandles.filter((c) => c.ema200 !== undefined).map((c) => ({ time: c.time as Time, value: c.ema200! }))); } catch (e) {}
          }

          if (v.rsi && rsiSeriesRef.current) {
            try {
              rsiSeriesRef.current.setData(
                currentCandles
                  .filter((c) => (rsiSettings.length === 7 ? c.rsi7 : c.rsi) !== undefined)
                  .map((c) => ({
                    time: c.time as Time,
                    value: rsiSettings.length === 7 ? c.rsi7! : c.rsi!
                  }))
              );
            } catch (e) {}
          }
          if (v.rsi && rsi7SeriesRef.current) {
            try {
              rsi7SeriesRef.current.setData(
                currentCandles
                  .filter((c) => c.rsi7Sma !== undefined)
                  .map((c) => ({
                    time: c.time as Time,
                    value: c.rsi7Sma!
                  }))
              );
            } catch (e) {}
          }

          if (v.macd) {
            if (macdLineSeriesRef.current) {
              try { macdLineSeriesRef.current.setData(currentCandles.filter((c) => c.macd !== undefined).map((c) => ({ time: c.time as Time, value: c.macd! }))); } catch (e) {}
            }
            if (macdSignalSeriesRef.current) {
              try { macdSignalSeriesRef.current.setData(currentCandles.filter((c) => c.macdSignal !== undefined).map((c) => ({ time: c.time as Time, value: c.macdSignal! }))); } catch (e) {}
            }
            if (macdHistSeriesRef.current) {
              try {
                macdHistSeriesRef.current.setData(currentCandles.filter((c) => c.macdHist !== undefined).map((c) => ({
                  time: c.time as Time,
                  value: c.macdHist!,
                  color: c.macdHist! >= 0 ? '#10b981' : '#ef4444',
                })));
              } catch (e) {}
            }
          }

          if (v.oiDelta && oiDeltaSeriesRef.current) {
            try {
              const oiData = currentCandles.map((c) => ({
                time: c.time as Time,
                value: c.oiDelta || 0,
                color: (c.oiDelta || 0) >= 0 ? '#10b981' : '#ef4444',
              }));
              oiDeltaSeriesRef.current.setData(oiData);
            } catch (e) {}
          }

          if (v.cvd && cvdSeriesRef.current) {
            try { cvdSeriesRef.current.setData(currentCandles.filter((c) => c.cvd !== undefined).map((c) => ({ time: c.time as Time, value: c.cvd! }))); } catch (e) {}
          }

          if (v.fundingRate && fundingSeriesRef.current) {
            try {
              fundingSeriesRef.current.setData(currentCandles.filter((c) => c.fundingRate !== undefined).map((c) => ({
                time: c.time as Time,
                value: c.fundingRate! * 100,
              })));
            } catch (e) {}
          }

          if (v.liquidations) {
            if (liqsShortSeriesRef.current) {
              try {
                liqsShortSeriesRef.current.setData(currentCandles.map((c) => ({
                  time: c.time as Time,
                  value: c.liquidationsShort || 0,
                })));
              } catch (e) {}
            }
            if (liqsLongSeriesRef.current) {
              try {
                liqsLongSeriesRef.current.setData(currentCandles.map((c) => ({
                  time: c.time as Time,
                  value: -(c.liquidationsLong || 0),
                })));
              } catch (e) {}
            }
          }

          if (v.longShortRatio && longShortSeriesRef.current) {
            try {
              longShortSeriesRef.current.setData(currentCandles.filter((c) => c.longShortRatio !== undefined).map((c) => ({
                time: c.time as Time,
                value: c.longShortRatio!,
              })));
            } catch (e) {}
          }

          if (v.heikinAshi && displayData.length >= 2) {
            const h2 = displayData[displayData.length - 2];
            prevSecondToLastHaRef.current = { open: h2.open, close: h2.close };
          }
        }

        // Sync tracking refs
        prevCandlesLengthRef.current = currentCandles.length;
        if (currentCandles.length >= 2) {
          prevSecondToLastTimeRef.current = currentCandles[currentCandles.length - 2].time;
        }
        prevLastTimeRef.current = currentCandles[currentCandles.length - 1].time;
      });
    }

    return () => {
      if (updateRafIdRef.current !== null) {
        cancelAnimationFrame(updateRafIdRef.current);
        updateRafIdRef.current = null;
      }
    };
  }, [candles]);

  // Update overlay line visibility in-line natively avoiding flicker
  useEffect(() => {
    if (ema9SeriesRef.current) {
      try { ema9SeriesRef.current.applyOptions({ visible: v.ema9 }); } catch (e) {}
    }
  }, [v.ema9]);

  useEffect(() => {
    if (ema21SeriesRef.current) {
      try { ema21SeriesRef.current.applyOptions({ visible: v.ema21 }); } catch (e) {}
    }
  }, [v.ema21]);

  useEffect(() => {
    if (ema50SeriesRef.current) {
      try { ema50SeriesRef.current.applyOptions({ visible: v.ema50 }); } catch (e) {}
    }
  }, [v.ema50]);

  useEffect(() => {
    if (ema200SeriesRef.current) {
      try { ema200SeriesRef.current.applyOptions({ visible: v.ema200 }); } catch (e) {}
    }
  }, [v.ema200]);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#111113] border border-zinc-805 rounded-xl overflow-hidden shadow-2xl p-4 lg:p-5" id="crypto-chart-block">
      
      {/* ───── LIVE CRYPTO TERMINAL CLOCK BLOCK ───── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d0d0f] border border-zinc-850 px-3.5 py-2.5 rounded-xl mb-4 shadow-sm" id="realtime-clock-row">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 font-mono">{t(lang, 'liveBorsaTime')}</span>
        </div>
        <div className="bg-zinc-950 px-3.5 py-1.5 rounded-lg border border-zinc-850 text-right flex items-center gap-2.5 shadow-inner">
          <span className="text-xs font-bold font-mono text-amber-500 tracking-wider">
            {formatLiveClock(liveDate).time}
          </span>
          <span className="text-xs font-bold font-mono text-cyan-400 tracking-tight">
            {formatLiveClock(liveDate).timezoneText}
          </span>
          <span className="text-zinc-500 text-[10px] font-bold select-none font-mono">|</span>
          <span className="text-xs font-semibold font-mono text-zinc-400">
            {formatLiveClock(liveDate).dateStr}
          </span>
        </div>
      </div>
      
      {/* ───── CONTROLS RIBBON BLOCK (GÖSTERGELER & AYARLAR PANELİ) ───── */}
      <div className="flex flex-col gap-3.5 border-b border-zinc-850 pb-4 mb-4" id="indicator-ribbon">
        
        {/* Header indicator row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-100 font-mono">
              {mode === 'spot' 
                ? (lang === 'tr' ? '🟢 SPOT PİYASA GRAFİĞİ' : '🟢 SPOT MARKET CHART')
                : (lang === 'tr' ? '⚡ VADELİ (FUTURES) DETAY GRAFİĞİ' : '⚡ FUTURES / DERIVATIVES CHART')
              }
            </span>
          </div>

          <button
            id="toggle-heikin"
            onClick={() => setVisibility({ ...visibility, heikinAshi: !visibility.heikinAshi })}
            className={`px-3 py-1 text-[10px] rounded-lg font-bold border transition duration-200 cursor-pointer ${
              visibility.heikinAshi
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t(lang, 'haMode')}
          </button>
        </div>

        {/* Unified "Göstergeler" Section depending on Mode */}
        <div className="bg-[#0b0b0d]/90 border border-zinc-850 p-3 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider font-mono">
              🛠️ {lang === 'tr' ? 'GÖSTERGELER' : 'INDICATORS'}
            </span>
            <span className="text-[8.5px] font-bold text-zinc-500 font-mono">
              {mode === 'spot' ? 'Spot-Only Suite' : 'Futures-Only Suite'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Overlay EMAs group (Common on both) */}
            <div className="bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-zinc-400">{t(lang, 'emasGroup')}:</span>
              <div className="flex items-center gap-1">
                <button
                  id="toggle-ema9"
                  onClick={() => setVisibility({ ...visibility, ema9: !visibility.ema9 })}
                  className={`px-2 py-0.5 text-[9.5px] rounded font-bold transition ${
                    visibility.ema9 ? 'bg-[#22d3ee]/20 text-[#22d3ee]' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  9
                </button>
                <button
                  id="toggle-ema21"
                  onClick={() => setVisibility({ ...visibility, ema21: !visibility.ema21 })}
                  className={`px-2 py-0.5 text-[9.5px] rounded font-bold transition ${
                    visibility.ema21 ? 'bg-[#facc15]/20 text-[#facc15]' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  21
                </button>
                <button
                  id="toggle-ema50"
                  onClick={() => setVisibility({ ...visibility, ema50: !visibility.ema50 })}
                  className={`px-2 py-0.5 text-[9.5px] rounded font-bold transition ${
                    visibility.ema50 ? 'bg-[#f472b6]/20 text-[#f472b6]' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  50
                </button>
                <button
                  id="toggle-ema200"
                  onClick={() => setVisibility({ ...visibility, ema200: !visibility.ema200 })}
                  className={`px-2 py-0.5 text-[9.5px] rounded font-bold transition ${
                    visibility.ema200 ? 'bg-[#a855f7]/20 text-[#a855f7]' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  200
                </button>
              </div>
            </div>

            {/* Render ONLY Spot Indicators inside separate Spot chart */}
            {mode === 'spot' && (
              <>
                {/* RSI Standard Toggle */}
                <div className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                  visibility.rsi
                    ? 'bg-orange-500/15 text-orange-400 border-orange-500/40 shadow-inner'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}>
                  <button
                    id="toggle-rsi"
                    onClick={() => setVisibility({ ...visibility, rsi: !visibility.rsi })}
                    className="flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Activity className="w-3 h-3" />
                    <span>RSI ({rsiSettings.length})</span>
                  </button>
                  <button
                    id="configure-rsi"
                    onClick={() => {
                      setTempRsiSettings({ ...rsiSettings });
                      setModalTab('inputs');
                      setShowRsiSettingsModal(true);
                    }}
                    className="p-0.5 ml-0.5 hover:bg-zinc-850 rounded text-zinc-500 hover:text-zinc-200 cursor-pointer transition"
                    title={t(lang, 'rsiSettingsTitle')}
                  >
                    <Sliders className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* MACD Standard Toggle */}
                <button
                  id="toggle-macd"
                  onClick={() => setVisibility({ ...visibility, macd: !visibility.macd })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.macd
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-inner'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>MACD</span>
                </button>

                {/* Order Blocks Toggle */}
                <button
                  id="toggle-orderblocks"
                  onClick={() => setVisibility({ ...visibility, orderBlocks: !visibility.orderBlocks })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.orderBlocks
                      ? 'bg-green-500/15 text-green-400 border-green-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t(lang, 'orderBlocks')}
                </button>

                {/* Cumulative Horizontal Profile Toggle */}
                <button
                  id="toggle-profile"
                  onClick={() => setVisibility({ ...visibility, profileVisible: !visibility.profileVisible })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.profileVisible
                      ? 'bg-pink-500/15 text-pink-400 border-pink-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 font-medium'
                  }`}
                >
                  {t(lang, 'volumeProfile')}
                </button>
              </>
            )}

            {/* Render ONLY Futures / Derivatives Indicators inside separate Futures chart */}
            {mode === 'futures' && (
              <>
                {/* Open Interest Delta Toggle */}
                <button
                  id="toggle-oi"
                  onClick={() => setVisibility({ ...visibility, oiDelta: !visibility.oiDelta })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.oiDelta
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  ⚖️ {t(lang, 'oiDeltaText')}
                </button>

                {/* Cumulative Volume Delta Toggle */}
                <button
                  id="toggle-cvd"
                  onClick={() => setVisibility({ ...visibility, cvd: !visibility.cvd })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.cvd
                      ? 'bg-teal-500/15 text-teal-400 border-teal-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🌊 CVD Futures
                </button>

                {/* Funding Rate Toggle */}
                <button
                  id="toggle-funding"
                  onClick={() => setVisibility({ ...visibility, fundingRate: !visibility.fundingRate })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.fundingRate
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  💸 {lang === 'tr' ? 'Fonlama Oranı' : 'Funding Rate'}
                </button>

                {/* Liquidations Profile Toggle */}
                <button
                  id="toggle-liquidations"
                  onClick={() => setVisibility({ ...visibility, liquidations: !visibility.liquidations })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.liquidations
                      ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🩸 {t(lang, 'liquidationsText')}
                </button>

                {/* Long/Short Ratio Toggle */}
                <button
                  id="toggle-ls"
                  onClick={() => setVisibility({ ...visibility, longShortRatio: !visibility.longShortRatio })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.longShortRatio
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🎭 {t(lang, 'lsRatioText')}
                </button>

                {/* Order Blocks Toggle (on futures too) */}
                <button
                  id="toggle-orderblocks-futures"
                  onClick={() => setVisibility({ ...visibility, orderBlocks: !visibility.orderBlocks })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.orderBlocks
                      ? 'bg-green-500/15 text-green-400 border-green-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium'
                  }`}
                >
                  📦 {t(lang, 'orderBlocks')}
                </button>

                {/* Cumulative Horizontal Profile Toggle (on futures too) */}
                <button
                  id="toggle-profile-futures"
                  onClick={() => setVisibility({ ...visibility, profileVisible: !visibility.profileVisible })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg font-bold border transition ${
                    visibility.profileVisible
                      ? 'bg-pink-500/15 text-pink-400 border-pink-500/40 shadow-inner font-extrabold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium'
                  }`}
                >
                  📊 {t(lang, 'volumeProfile')}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ───── SYNCHRONIZED PANELS LIST STACK ───── */}
      <div className="h-[460px] min-h-[460px] max-h-[460px] flex flex-col gap-3" id="charts-stack">
        
        {/* Main Candle Panel */}
        <div ref={mainChartRef} className="w-full relative shrink-0 rounded-xl overflow-hidden border border-zinc-900 bg-[#070708]/40 shadow-inner" style={{ height: `${calculatedMainHeight}px` }}>
          {/* Legend Overlay Info */}
          <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#0d0d0f]/90 px-3 py-2 rounded-lg border border-zinc-800 backdrop-blur text-[10px] select-none font-mono">
            <span className="text-xs text-zinc-100 font-bold tracking-tight">{symbol}/USDT Perp</span>
            <span className="text-zinc-500 font-semibold">Binance</span>
            <span className="text-zinc-400 bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase">
              {visibility.heikinAshi ? 'HA' : t(lang, 'standard')}
            </span>
            {latestCandle && (
              <div className="flex flex-wrap items-center gap-x-2 text-zinc-400">
                <span>{lang === 'tr' ? 'A' : 'O'}: <strong className="text-zinc-200">${latestCandle.open.toLocaleString()}</strong></span>
                <span>{lang === 'tr' ? 'Y' : 'H'}: <strong className="text-green-400">${latestCandle.high.toLocaleString()}</strong></span>
                <span>{lang === 'tr' ? 'D' : 'L'}: <strong className="text-red-400">${latestCandle.low.toLocaleString()}</strong></span>
                <span>{lang === 'tr' ? 'K' : 'C'}: <strong className={`font-extrabold ${latestCandle.close >= latestCandle.open ? 'text-green-400' : 'text-red-400'}`}>${latestCandle.close.toLocaleString()}</strong></span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-l border-zinc-800 pl-2.5">
              {visibility.ema9 && <span className="text-[9px] font-bold text-[#818cf8]">EMA9: ${latestCandle?.ema9 ? latestCandle.ema9.toLocaleString() : t(lang, 'noData')}</span>}
              {visibility.ema21 && <span className="text-[9px] font-bold text-[#a5b4fc]">EMA21: ${latestCandle?.ema21 ? latestCandle.ema21.toLocaleString() : t(lang, 'noData')}</span>}
              {visibility.ema50 && <span className="text-[9px] font-bold text-[#cbd5e1]">EMA50: ${latestCandle?.ema50 ? latestCandle.ema50.toLocaleString() : t(lang, 'noData')}</span>}
              {visibility.ema200 && <span className="text-[9px] font-bold text-[#64748b]">EMA200: ${latestCandle?.ema200 ? latestCandle.ema200.toLocaleString() : t(lang, 'noData')}</span>}
            </div>
          </div>

          {/* Cumulative Horizontal Profile overlay on the right side of the main chart */}
          {visibility.profileVisible && bins.length > 0 && (
            <div className="absolute right-[65px] top-[42px] h-[245px] w-48 md:w-56 pointer-events-none z-10 flex flex-col-reverse justify-between select-none">
              {bins.map((bin, idx) => {
                const totalLiqs = bin.shortLiqs + bin.longLiqs;
                const totalOi = bin.oiDeltaPositive + bin.oiDeltaNegative;

                const liqsPct = Math.min(100, (totalLiqs / maxLiqs) * 100);
                const oiPct = Math.min(100, (totalOi / maxOi) * 100);

                const shortLiqRatio = totalLiqs > 0 ? (bin.shortLiqs / totalLiqs) : 0.5;
                const longLiqRatio = totalLiqs > 0 ? (bin.longLiqs / totalLiqs) : 0.5;

                const oiPosRatio = totalOi > 0 ? (bin.oiDeltaPositive / totalOi) : 0.5;
                const oiNegRatio = totalOi > 0 ? (bin.oiDeltaNegative / totalOi) : 0.5;

                const formatVal = (v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
                  return v.toFixed(0);
                };

                return (
                  <div key={idx} className="flex flex-col justify-center h-full border-b border-zinc-900/10 relative">
                    {/* Liquidations Profile line */}
                    <div className="flex justify-end items-center h-[42%] w-full opacity-80">
                      <div className="h-full rounded-sm flex overflow-hidden justify-end" style={{ width: `${liqsPct * 0.75}%` }}>
                        <div className="bg-emerald-500/35 h-full" style={{ width: `${longLiqRatio * 100}%` }} title={t(lang, 'longLiqs')} />
                        <div className="bg-red-500/35 h-full" style={{ width: `${shortLiqRatio * 100}%` }} title={t(lang, 'shortLiqs')} />
                      </div>
                      <span className="text-[7.5px] font-mono text-zinc-400 font-bold ml-1.5 min-w-[32px] text-right">
                        {formatVal(totalLiqs)}
                      </span>
                    </div>

                    {/* OI Delta Profile line */}
                    <div className="flex justify-end items-center h-[38%] w-full opacity-65 mt-0.5">
                      <div className="h-full rounded-sm flex overflow-hidden justify-end" style={{ width: `${oiPct * 0.6}%` }}>
                        <div className="bg-indigo-500/30 h-full" style={{ width: `${oiPosRatio * 100}%` }} title={t(lang, 'oiPosChange')} />
                        <div className="bg-orange-500/30 h-full" style={{ width: `${oiNegRatio * 100}%` }} title={t(lang, 'oiNegChange')} />
                      </div>
                      <span className="text-[6.5px] font-mono text-zinc-500 ml-1.5 min-w-[32px] text-right">
                        {formatVal(bin.oiDeltaPositive)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Indicator Subcharts Scrolling Container */}
        {activeCount > 0 && (
          <div className="flex-grow overflow-y-auto flex flex-col gap-3.5 pr-1 pl-0.5" id="indicators-list-stack" style={{ height: `${460 - calculatedMainHeight - 12}px` }}>

        {/* RSI Panel */}
        {visibility.rsi && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-orange-400 font-sans">{t(lang, 'rsiTitle')}</span>
              {visibility.rsi && (
                <>
                  <span className="text-orange-400 font-bold">
                    RSI ({rsiSettings.length}): <strong className="font-extrabold text-white">
                      {rsiSettings.length === 7 
                        ? (latestCandle?.rsi7 !== undefined ? latestCandle.rsi7 : t(lang, 'noData'))
                        : (latestCandle?.rsi !== undefined ? latestCandle.rsi : t(lang, 'noData'))
                      }
                    </strong>
                  </span>
                  {rsiSettings.showSmoothedMA && (
                    <span className="text-blue-400 font-bold">
                      MA ({rsiSettings.smoothingLength}): <strong className="font-extrabold text-white">
                        {latestCandle?.rsi7Sma !== undefined ? latestCandle.rsi7Sma : t(lang, 'noData')}
                      </strong>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setTempRsiSettings({ ...rsiSettings });
                      setModalTab('inputs');
                      setShowRsiSettingsModal(true);
                    }}
                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-200 cursor-pointer transition ml-1"
                    title={t(lang, 'rsiSettingsTitle')}
                  >
                    <Sliders className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
            <div ref={rsiChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* MACD Panel */}
        {visibility.macd && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-blue-400 font-sans">{t(lang, 'macdTitle')}</span>
              {latestCandle?.macd !== undefined && (
                <>
                  <span>MACD: <strong className="text-[#60a5fa] font-extrabold font-mono">{latestCandle.macd}</strong></span>
                  <span className="ml-1">{t(lang, 'signalLabel')}: <strong className="text-[#f87171] font-extrabold font-mono">{latestCandle.macdSignal}</strong></span>
                  <span className={`ml-1 font-bold ${latestCandle.macdHist! >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t(lang, 'histLabel')}: <strong className="text-white font-extrabold font-mono">{latestCandle.macdHist}</strong></span>
                </>
              )}
            </div>
            <div ref={macdChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* OI Delta Panel */}
        {visibility.oiDelta && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-emerald-400 font-sans">{t(lang, 'oiDeltaTitle')}</span>
              {latestCandle?.oiDelta !== undefined && (
                <span>
                  {t(lang, 'valueLabel')}:{' '}
                  <strong className={`font-extrabold ${latestCandle.oiDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {latestCandle.oiDelta >= 0 ? '+' : ''}
                    {latestCandle.oiDelta.toLocaleString()}
                  </strong>
                </span>
              )}
            </div>
            <div ref={oiDeltaChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* CVD Panel */}
        {visibility.cvd && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-teal-400 font-sans">{t(lang, 'cvdTitle')}</span>
              {latestCandle?.cvd !== undefined && (
                <span>
                  CVD:{' '}
                  <strong className={`font-extrabold ${latestCandle.cvd >= 0 ? 'text-teal-300' : 'text-orange-400'}`}>
                    {latestCandle.cvd.toLocaleString()}
                  </strong>
                </span>
              )}
            </div>
            <div ref={cvdChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* Predicted Funding Rate Panel */}
        {visibility.fundingRate && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-purple-400 font-sans">{t(lang, 'fundingRateTitle')}</span>
              {latestCandle?.fundingRate !== undefined && (
                <span>
                  {t(lang, 'fundingRateLabel')}:{' '}
                  <strong className="text-purple-300 font-extrabold">
                    {(latestCandle.fundingRate * 100).toFixed(4)}%
                  </strong>
                </span>
              )}
            </div>
            <div ref={fundingChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* Liquidations Panel */}
        {visibility.liquidations && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-red-500 font-sans">{t(lang, 'liqProfileTitle')}</span>
              {latestCandle?.liquidationsLong !== undefined && (
                <>
                  <span className="text-[#10b981] font-bold">• {t(lang, 'shortSqueezeLabel')}: <strong>${latestCandle.liquidationsShort!.toLocaleString()}</strong></span>
                  <span className="text-[#ef4444] font-bold">• {t(lang, 'longSqueezeLabel')}: <strong>${latestCandle.liquidationsLong.toLocaleString()}</strong></span>
                </>
              )}
            </div>
            <div ref={liqsChartRef} style={{ height: '80px' }} />
          </div>
        )}

        {/* Long/Short Ratio Panel */}
        {visibility.longShortRatio && (
          <div className="w-full relative border border-zinc-900 rounded-xl p-3 bg-[#070708]/40 shrink-0" style={{ height: '115px' }}>
            <div className="absolute top-2 left-3 z-20 bg-[#0d0d0f]/95 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur text-[9.5px] text-zinc-450 flex flex-wrap items-center gap-2.5 font-mono shadow-md">
              <span className="font-semibold text-amber-500 font-sans">{t(lang, 'longShortRatioTitle')}</span>
              {latestCandle?.longShortRatio !== undefined && (
                <span>
                  {t(lang, 'ratioLabel')}:{' '}
                  <strong className="text-amber-400 font-extrabold">{latestCandle.longShortRatio.toFixed(3)}</strong>
                </span>
              )}
            </div>
            <div ref={longShortChartRef} style={{ height: '80px' }} />
          </div>
        )}

          </div>
        )}

      </div>

      {/* RSI SETTINGS TRADINGVIEW MODAL POPUP */}
      {showRsiSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-[380px] bg-[#1c1e22] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden text-zinc-300 font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-bold text-white tracking-wide">{t(lang, 'rsiSettingsTitle')}</span>
              <button 
                onClick={() => setShowRsiSettingsModal(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <span className="text-base">✕</span>
              </button>
            </div>

            {/* Tabs Menu */}
            <div className="flex border-b border-zinc-800 px-4">
              {(['inputs', 'style', 'visibility'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`py-2 px-3 text-xs font-bold transition-all relative ${
                    modalTab === tab 
                      ? 'text-blue-500 font-extrabold border-b-2 border-blue-500' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab === 'inputs' ? t(lang, 'inputsTab') : tab === 'style' ? t(lang, 'styleTab') : t(lang, 'visibilityTab')}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-4 space-y-4 min-h-[220px]">
              {modalTab === 'inputs' && (
                <div className="space-y-4">
                  
                  {/* Uzunluk */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 font-medium font-sans">{t(lang, 'lengthLabel')}</label>
                    <select
                      value={tempRsiSettings.length}
                      onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, length: parseInt(e.target.value) || 7 })}
                      className="w-36 px-2.5 py-1 text-xs bg-[#121316] border border-zinc-850 rounded hover:border-zinc-700 focus:outline-hidden focus:border-blue-500 text-right font-bold text-white font-mono"
                    >
                      <option value={7}>7</option>
                      <option value={14}>14</option>
                    </select>
                  </div>

                  {/* Yumuşatma Çizgisi */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 font-medium font-sans">{t(lang, 'smoothingLineLabel')}</label>
                    <select
                      value={tempRsiSettings.smoothingLine}
                      onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, smoothingLine: e.target.value as any })}
                      className="w-36 px-2.5 py-1 text-xs bg-[#121316] border border-zinc-850 rounded hover:border-zinc-700 focus:outline-hidden focus:border-blue-500 font-bold text-white"
                    >
                      <option value="SMA">SMA</option>
                      <option value="EMA">EMA</option>
                    </select>
                  </div>

                  {/* Yumuşatma Uzunluğu */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 font-medium font-sans">{t(lang, 'smoothingLengthLabel')}</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={tempRsiSettings.smoothingLength}
                      onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, smoothingLength: Math.max(1, parseInt(e.target.value) || 7) })}
                      className="w-36 px-2.5 py-1 text-xs bg-[#121316] border border-zinc-850 rounded hover:border-zinc-700 focus:outline-hidden focus:border-blue-500 text-right font-bold text-white font-mono"
                    />
                  </div>

                </div>
              )}

              {modalTab === 'style' && (
                <div className="space-y-3">
                  
                  {/* Çizim (Plot) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-plot"
                        checked={tempRsiSettings.showPlot}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showPlot: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-plot" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">{t(lang, 'plotLabel')}</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded bg-[#fb923c] border border-[#d97706]/50" />
                      <div className="w-10 h-4 bg-zinc-800 border border-zinc-700 rounded-sm flex items-center justify-center text-[10px] text-zinc-500 font-semibold cursor-not-allowed">🗲</div>
                    </div>
                  </div>

                  {/* Smoothed MA */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-ma"
                        checked={tempRsiSettings.showSmoothedMA}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showSmoothedMA: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-ma" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">Smoothed MA</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded bg-[#3b82f6] border border-[#2563eb]/50" />
                      <div className="w-10 h-4 bg-zinc-800 border border-zinc-700 rounded-sm flex items-center justify-center text-[10px] text-zinc-500 font-semibold cursor-not-allowed">🗲</div>
                    </div>
                  </div>

                  {/* ÜstLimit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-upper"
                        checked={tempRsiSettings.showUpperLimit}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showUpperLimit: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-upper" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">{t(lang, 'upperLimitLabel')}</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded bg-[#ef4444] border border-[#dc2626]/50" />
                      <input
                        type="number"
                        value={tempRsiSettings.upperLimitValue}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, upperLimitValue: parseInt(e.target.value) || 70 })}
                        className="w-16 px-1.5 py-0.5 text-xs bg-[#121316] border border-zinc-850 rounded font-bold text-white text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* MiddleLimit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-middle"
                        checked={tempRsiSettings.showMiddleLimit}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showMiddleLimit: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-middle" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">{t(lang, 'middleLimitLabel')}</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded bg-[#9ca3af] border border-[#6b7280]/50" />
                      <input
                        type="number"
                        value={tempRsiSettings.middleLimitValue}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, middleLimitValue: parseInt(e.target.value) || 50 })}
                        className="w-16 px-1.5 py-0.5 text-xs bg-[#121316] border border-zinc-850 rounded font-bold text-white text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* AltLimit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-lower"
                        checked={tempRsiSettings.showLowerLimit}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showLowerLimit: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-lower" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">{t(lang, 'lowerLimitLabel')}</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded bg-[#10b981] border border-[#059669]/50" />
                      <input
                        type="number"
                        value={tempRsiSettings.lowerLimitValue}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, lowerLimitValue: parseInt(e.target.value) || 30 })}
                        className="w-16 px-1.5 py-0.5 text-xs bg-[#121316] border border-zinc-850 rounded font-bold text-white text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* Hlines Background */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="style-bg"
                        checked={tempRsiSettings.showBg}
                        onChange={(e) => setTempRsiSettings({ ...tempRsiSettings, showBg: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="style-bg" className="text-xs text-zinc-350 cursor-pointer font-medium font-sans">{t(lang, 'hlinesBgLabel')}</label>
                    </div>
                    <div className="w-6 h-4 rounded checkered-pattern border border-zinc-700" style={{ backgroundImage: 'repeating-conic-gradient(#555 0% 25%, #222 0% 50%)', backgroundSize: '6px 6px' }} />
                  </div>

                </div>
              )}

              {modalTab === 'visibility' && (
                <div className="text-center py-6 text-xs text-zinc-500 font-sans">
                  {t(lang, 'visibleOnAllTfs')}
                </div>
              )}
            </div>

            {/* Footer controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-850 bg-[#16171b]">
              {/* Defaults Menu */}
              <select
                defaultValue="default"
                onChange={(e) => {
                  if (e.target.value === 'reset') {
                    setTempRsiSettings({
                      length: 7,
                      smoothingLine: 'SMA',
                      smoothingLength: 7,
                      showPlot: true,
                      showSmoothedMA: false,
                      showUpperLimit: true,
                      upperLimitValue: 90,
                      showMiddleLimit: true,
                      middleLimitValue: 60,
                      showLowerLimit: true,
                      lowerLimitValue: 30,
                      showBg: true,
                    });
                  }
                }}
                className="px-2 py-1 text-xs bg-[#1e2026] border border-zinc-805 rounded text-zinc-450 font-medium cursor-pointer"
              >
                <option value="default">{t(lang, 'defaultLabel')}</option>
                <option value="reset">{t(lang, 'resetLabel')}</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRsiSettingsModal(false)}
                  className="px-4 py-1.5 text-xs font-bold font-sans bg-transparent border border-zinc-800 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer transition-all duration-150"
                >
                  {t(lang, 'cancelLabel')}
                </button>
                <button
                  onClick={() => {
                    setRsiSettings({ ...tempRsiSettings });
                    setShowRsiSettingsModal(false);
                  }}
                  className="px-4 py-1.5 text-xs font-bold font-sans bg-blue-600 rounded text-white hover:bg-blue-500 hover:shadow-lg cursor-pointer transition-all duration-150"
                >
                  {t(lang, 'applyLabel')}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
