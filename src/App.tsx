/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Compass, RefreshCw, Layers, TrendingUp, TrendingDown, HelpCircle, ShieldAlert } from 'lucide-react';
import { CoinDetail, ChartCandle, IndicatorVisibility, Timeframe, UnifiedAIReport, TickerCoin } from './types.js';
import { formatUSD, formatVolume } from './utils/formatters.js';
import StatsBar from './components/StatsBar.js';
import TradingChart from './components/TradingChart.js';
import AIAnalysisPanel from './components/AIAnalysisPanel.js';
import UnifiedCorrelationEngine from './components/UnifiedCorrelationEngine.js';
import { languages, Language, t } from './utils/translations.js';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('terminal_lang') as Language) || 'tr';
  });
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState<string>('BTC');
  const [searchInput, setSearchInput] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');

  const [coinDetails, setCoinDetails] = useState<CoinDetail | null>(null);
  const [klines, setKlines] = useState<ChartCandle[]>([]);
  const [spotKlines, setSpotKlines] = useState<ChartCandle[]>([]);
  const [futuresKlines, setFuturesKlines] = useState<ChartCandle[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // States for comprehensive scrollable coin search list with 24h ticker info
  const [allCoins, setAllCoins] = useState<TickerCoin[]>([]);
  const [allCoinsLoading, setAllCoinsLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sorting and search tabs for comprehensive Binance search list
  const [sortField, setSortField] = useState<'symbol' | 'price' | 'change' | 'fundingRate'>('change');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // descending default so top movers/highest metrics are first!
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('coin_favorites');
      return saved ? JSON.parse(saved) : ['BTC', 'ETH', 'SOL', 'BNB'];
    } catch (_) {
      return ['BTC', 'ETH', 'SOL', 'BNB'];
    }
  });
  const [searchTab, setSearchTab] = useState<'all' | 'favorites'>('all');

  const toggleFavorite = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym];
      localStorage.setItem('coin_favorites', JSON.stringify(next));
      return next;
    });
  };

  // Unified AI Report States
  const [unifiedReport, setUnifiedReport] = useState<UnifiedAIReport | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Indicators visibility settings for Spot Chart
  const [spotVisibility, setSpotVisibility] = useState<IndicatorVisibility>({
    ema9: true,
    ema21: true,
    ema50: true,
    ema200: false,
    rsi: true,
    rsi7: false,
    macd: true,
    cvd: false,
    oiDelta: false,
    liquidations: false,
    fundingRate: false,
    longShortRatio: false,
    heikinAshi: false,
    orderBlocks: true,
    profileVisible: true,
  });

  // Indicators visibility settings for Futures Chart
  const [futuresVisibility, setFuturesVisibility] = useState<IndicatorVisibility>({
    ema9: true,
    ema21: true,
    ema50: true,
    ema200: false,
    rsi: false,
    rsi7: false,
    macd: false,
    cvd: true,
    oiDelta: true,
    liquidations: true,
    fundingRate: true,
    longShortRatio: true,
    heikinAshi: false,
    orderBlocks: true,
    profileVisible: true,
  });

  // Fetch both coin metadata stats and kline charts array
  const fetchCoinData = async (targetSymbol: string, targetTimeframe: Timeframe, isBackground = false) => {
    const startTime = performance.now();
    if (!isBackground) {
      setLoading(true);
      setCoinDetails(null);
      setSpotKlines([]);
      setFuturesKlines([]);
      setKlines([]);
    }
    setError(null);

    console.groupCollapsed(`🔍 %c[DIAGNOSTICS] fetchCoinData: ${targetSymbol} (${targetTimeframe})`, "color: #818cf8; font-weight: bold;");
    console.log(`[Diagnostic] Başlangıç Zamanı: ${new Date().toISOString()}`);
    console.log(`[Diagnostic] Parametreler - Sembol: ${targetSymbol}, Zaman Dilimi: ${targetTimeframe}`);

    try {
      // 1. Fetch live coin info & prices proxy
      const infoUrl = `/api/coin-info?symbol=${encodeURIComponent(targetSymbol)}`;
      console.log(`[HTTP GET] Talebi Gönderiliyor: ${infoUrl}`);
      const infoRes = await fetch(infoUrl);
      
      console.log(`[HTTP GET] Yanıt Alındı: Statü = ${infoRes.status} (${infoRes.statusText})`);
      if (!infoRes.ok) {
        let detailedErrorMsg = `Fiyat bilgisi proxy API hatası (Status: ${infoRes.status})`;
        try {
          const errData = await infoRes.json();
          if (errData && errData.error) {
            detailedErrorMsg = `${errData.error} (Kod: ${infoRes.status})`;
          }
        } catch (_) {
          // Fallback if not a json error format card
        }
        
        if (infoRes.status === 404) {
          throw new Error(`[404] Belirtilen parite (${targetSymbol}) Binance üzerinde bulunamadı veya şu anda aktif değil. Lütfen sembolün doğruluğunu kontrol edin.`);
        } else if (infoRes.status === 500) {
          throw new Error(`[500] Sunucu veritabanında veya Binance APİ bağlantısında içsel bir sunucu hatası meydana geldi. (${detailedErrorMsg})`);
        } else {
          throw new Error(`[HTTP ${infoRes.status}] Veri çekme başarısız oldu: ${detailedErrorMsg}`);
        }
      }

      const infoData: CoinDetail = await infoRes.json();
      console.log("[Diagnostic] Başarıyla Çekilen Sembol Detayları:", infoData);

      // 2. Fetch history candlesticks & technical indicators in parallel for both Spot and Futures charts!
      const spotUrl = `/api/klines?symbol=${encodeURIComponent(targetSymbol)}&timeframe=${targetTimeframe}&isFutures=false`;
      const futuresUrl = `/api/klines?symbol=${encodeURIComponent(targetSymbol)}&timeframe=${targetTimeframe}&isFutures=true`;
      
      console.log(`[HTTP GET] Paralel Grafik Talepleri Gönderiliyor:\n - Spot: ${spotUrl}\n - Futures: ${futuresUrl}`);
      
      const [spotRes, futuresRes] = await Promise.all([
        fetch(spotUrl),
        fetch(futuresUrl)
      ]);

      console.log(`[HTTP GET] Grafik Mum Yanıtları Alındı: Spot: ${spotRes.status}, Futures: ${futuresRes.status}`);

      if (!spotRes.ok || !futuresRes.ok) {
        const failedRes = !spotRes.ok ? spotRes : futuresRes;
        if (failedRes.status === 429) {
          throw new Error("[429 IP Sınırı] Binance API istek limiti aşıldı. Lütfen birkaç saniye bekleyip tekrar deneyin.");
        }
        throw new Error(`[HTTP ${failedRes.status}] Grafik verileri ve indikatör göstergeleri hesaplanırken sunucu hatası oluştu.`);
      }

      const [spotData, futuresData] = await Promise.all([
        spotRes.json(),
        futuresRes.json()
      ]);

      const spotCount = spotData.candles ? spotData.candles.length : 0;
      const futuresCount = futuresData.candles ? futuresData.candles.length : 0;
      
      console.log(`[Diagnostic] Veriler Başarıyla Çekildi. Spot Mum: ${spotCount}, Futures Mum: ${futuresCount}`);

      if (spotCount === 0 || futuresCount === 0) {
        throw new Error("[Boş Veri] Sunucudan bu parite için boş mum verisi döndü. Farklı bir zaman dilimi veya parite deneyin.");
      }

      setSpotKlines(spotData.candles);
      setFuturesKlines(futuresData.candles);
      setKlines(futuresData.candles);
      setCoinDetails(infoData);

      // Update active symbol state with normalized key
      setSymbol(infoData.symbol);
      const endTime = performance.now();
      console.log(`%c[Diagnostic] Başarılı! Toplam Veri Akış Süresi: ${(endTime - startTime).toFixed(2)}ms`, "color: #10b981; font-weight: bold;");
    } catch (err: any) {
      console.error('%c[Diagnostic] İstisna Yakalandı (fetchCoinData):', "color: #f43f5e; font-weight: bold;", err);
      let localizedMsg = err.message || 'Veriler yüklenirken bilinmeyen bir ağ veya sunucu sorunu oluştu.';
      if (err instanceof TypeError && err.message.includes('failed to fetch')) {
        localizedMsg = 'İnternet bağlantınızı veya sunucu erişilebilirliğini kontrol edin. Detay: API sunucusuyla bağlantı kurulamadı.';
      }
      setError(localizedMsg);
    } finally {
      console.groupEnd();
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // Unified Matrix AI Analysis Trigger Coordinator
  const handleTriggerAnalysis = async (tf: string) => {
    const startTime = performance.now();
    setAiLoading(true);
    setAiError(null);

    console.groupCollapsed(`🤖 %c[DIAGNOSTICS] handleTriggerAnalysis: AI Yapay Zeka Raporu (${tf})`, "color: #a855f7; font-weight: bold;");
    console.log(`[Diagnostic] AI Başlangıç Zamanı: ${new Date().toISOString()}`);
    console.log(`[Diagnostic] Hedef Sembol: ${symbol}, Zaman Dilimi: ${tf}`);

    try {
      // 1. Fetch live candlestick indicators for specified timeframe
      const isFuturesParam = coinDetails?.isFutures ? 'true' : 'false';
      const klineUrl = `/api/klines?symbol=${encodeURIComponent(symbol)}&timeframe=${tf}&isFutures=${isFuturesParam}`;
      console.log(`[Diagnostic] AI Analizi Öncesi Mum Verisi Çekiliyor: ${klineUrl}`);
      const klineRes = await fetch(klineUrl);
      
      console.log(`[Diagnostic] Mum Verisi Çekme Statüsü: ${klineRes.status}`);
      if (!klineRes.ok) {
        throw new Error(lang === 'tr' 
          ? `[HTTP ${klineRes.status}] AI analizi için gerekli olan gösterge ve mum verileri yüklenemedi.` 
          : `[HTTP ${klineRes.status}] Could not fetch indicators required for AI analysis.`
        );
      }
      
      const klineData = await klineRes.json();
      if (!klineData.candles || klineData.candles.length === 0) {
        throw new Error(lang === 'tr' 
          ? "[Boş Veri] Bu zaman dilimi için yapay zeka analizine beslenecek teknik gösterge mumu bulunamadı." 
          : "No candle technical stats data found in the requested timeframe for AI payload."
        );
      }
      const lastCandle = klineData.candles[klineData.candles.length - 1];
      console.log("[Diagnostic] Analize Gönderilecek Son Mum Özeti:", lastCandle);

      // 2. Fetch unified AI report from server
      console.log("[Diagnostic] /api/analyze/unified POST isteği hazırlanıyor...");
      const aiPayload = {
        coin: coinDetails,
        lastCandle,
        timeframe: tf,
        lang
      };
      
      const aiRes = await fetch('/api/analyze/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload)
      });
      
      console.log(`[Diagnostic] AI Endpoint Yanıt Statüsü: ${aiRes.status}`);
      if (!aiRes.ok) {
        let aiDetailMsg = `Status: ${aiRes.status}`;
        try {
          const parsedErr = await aiRes.json();
          if (parsedErr && parsedErr.error) {
            aiDetailMsg = `${parsedErr.error} (HTTP ${aiRes.status})`;
          }
        } catch (_) {}
        
        throw new Error(lang === 'tr' 
          ? `🤖 Yapay zeka analiz API sunucusu hatası veya Gemini kota sınırı aşıldı. Detay: ${aiDetailMsg}` 
          : `🤖 AI analysis API endpoint failed. Detail: ${aiDetailMsg}`
        );
      }
      
      const reportData = await aiRes.json();
      console.log("[Diagnostic] Yapay Zeka Raporu Başarıyla Alındı:", reportData);
      setUnifiedReport(reportData);
      
      const endTime = performance.now();
      console.log(`%c[Diagnostic] AI Analizi Başarılı! Hazırlanma Süresi: ${(endTime - startTime).toFixed(2)}ms`, "color: #10b981; font-weight: bold;");
    } catch (err: any) {
      console.error('%c[Diagnostic] İstisna Yakalandı (handleTriggerAnalysis):', "color: #f43f5e; font-weight: bold;", err);
      let localizedMsg = err.message || (lang === 'tr' ? 'Yapay zeka analizi hazırlanırken sunucu veya ağ kaynaklı bir sorun oluştu.' : 'An error occurred during AI analysis compilation.');
      if (err instanceof TypeError && err.message.includes('failed to fetch')) {
        localizedMsg = lang === 'tr' 
          ? 'Sunucuya erişilemiyor. Lütfen internet ağınızı veya geliştirme sunucu durumunu kontrol edin.' 
          : 'Failed to establish connection to AI compilation server. Please try again later.';
      }
      setAiError(localizedMsg);
    } finally {
      console.groupEnd();
      setAiLoading(false);
    }
  };

  useEffect(() => {
    // Clear old AI analysis when switching symbols or timeframes to avoid inconsistency
    setUnifiedReport(null);
    setAiError(null);
    
    // Initial fetch
    fetchCoinData(symbol, timeframe);

    let spotWs: WebSocket | null = null;
    let futuresWs: WebSocket | null = null;
    let isCleanup = false;

    let latestSpotPrice = 0;
    let latestFuturesPrice = 0;

    const symbolLower = symbol.toLowerCase();
    const wsSymbol = `${symbolLower}usdt`;

    const updateLocalPrices = (
      spotPrice: number,
      futuresPrice: number,
      change24h?: number,
      high24h?: number,
      low24h?: number,
      volume24h?: number
    ) => {
      latestSpotPrice = spotPrice;
      latestFuturesPrice = futuresPrice;

      // 1. Update general state details for top scale bar
      setCoinDetails(prev => {
        if (!prev || prev.symbol !== symbol) return prev;
        return {
          ...prev,
          price: spotPrice,
          change24h: change24h !== undefined && !isNaN(change24h) ? change24h : prev.change24h,
          high24h: high24h !== undefined && !isNaN(high24h) ? high24h : prev.high24h,
          low24h: low24h !== undefined && !isNaN(low24h) ? low24h : prev.low24h,
          volume24h: volume24h !== undefined && !isNaN(volume24h) ? volume24h : prev.volume24h,
        };
      });

      // 2. Update Spot series klines in-place
      setSpotKlines(prev => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        copy[lastIdx] = {
          ...last,
          close: spotPrice,
          high: Math.max(last.high, spotPrice),
          low: Math.min(last.low, spotPrice),
        };
        return copy;
      });

      // 3. Update Futures series klines in-place
      setFuturesKlines(prev => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        copy[lastIdx] = {
          ...last,
          close: futuresPrice,
          high: Math.max(last.high, futuresPrice),
          low: Math.min(last.low, futuresPrice),
        };
        return copy;
      });

      // 4. Update core klines in-place
      setKlines(prev => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        copy[lastIdx] = {
          ...last,
          close: futuresPrice,
          high: Math.max(last.high, futuresPrice),
          low: Math.min(last.low, futuresPrice),
        };
        return copy;
      });
    };

    // Fast polling fallback if WebSockets are restricted or error out
    let tickerFallbackInterval: NodeJS.Timeout | null = null;
    let fallbackTriggered = false;

    const startTickerFallback = () => {
      if (fallbackTriggered || isCleanup) return;
      fallbackTriggered = true;
      console.log("[WebSocket Fallback] WebSockets restricted or failed to load in sandbox. Activating seamless 1.5s real-time REST ticker polling...");
      
      tickerFallbackInterval = setInterval(async () => {
        if (isCleanup) return;
        try {
          const res = await fetch(`/api/ticker?symbol=${symbol}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.spotPrice > 0) {
              updateLocalPrices(
                data.spotPrice,
                data.futuresPrice,
                data.change24h,
                data.high24h,
                data.low24h,
                data.volume24h
              );
            }
          }
        } catch (_) {
          // Quiet catch to keep console clean
        }
      }, 1500);
    };

    const connectWebSockets = () => {
      if (isCleanup) return;

      try {
        console.log(`[WebSocket] Connecting to Spot ticker stream for ${wsSymbol}`);
        spotWs = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`);

        spotWs.onmessage = (event) => {
          if (isCleanup) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.c) {
              const spotPrice = parseFloat(data.c);
              const change = parseFloat(data.P);
              const high = parseFloat(data.h);
              const low = parseFloat(data.l);
              const val24h = parseFloat(data.v || data.q || '0');

              const futPrice = latestFuturesPrice || (spotPrice * 1.00015);
              updateLocalPrices(spotPrice, futPrice, change, high, low, val24h);
            }
          } catch (err) {
            console.error("Error parsing Spot WS message:", err);
          }
        };

        spotWs.onerror = () => {
          startTickerFallback();
        };

        spotWs.onclose = () => {
          if (!isCleanup && !fallbackTriggered) {
            setTimeout(connectWebSockets, 5000);
          }
        };
      } catch (_) {
        startTickerFallback();
      }

      try {
        console.log(`[WebSocket] Connecting to Futures ticker stream for ${wsSymbol}`);
        futuresWs = new WebSocket(`wss://fstream.binance.com/ws/${wsSymbol}@ticker`);

        futuresWs.onmessage = (event) => {
          if (isCleanup) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.c) {
              const futPrice = parseFloat(data.c);
              const sPrice = latestSpotPrice || (futPrice / 1.00015);
              updateLocalPrices(sPrice, futPrice);
            }
          } catch (err) {
            console.error("Error parsing Futures WS message:", err);
          }
        };

        futuresWs.onerror = () => {
          startTickerFallback();
        };

        futuresWs.onclose = () => {
          // Quiet close
        };
      } catch (_) {
        startTickerFallback();
      }
    };

    connectWebSockets();

    // Setup periodic background polling fallback to fetch complete candle lists & computed technical indicators safely
    const fetchInterval = setInterval(() => {
      if (!isCleanup) {
        fetchCoinData(symbol, timeframe, true);
      }
    }, 8000);

    return () => {
      isCleanup = true;
      clearInterval(fetchInterval);
      if (tickerFallbackInterval) {
        clearInterval(tickerFallbackInterval);
      }
      if (spotWs) {
        try { spotWs.close(); } catch (_) {}
      }
      if (futuresWs) {
        try { futuresWs.close(); } catch (_) {}
      }
    };
  }, [symbol, timeframe]);

  // Load comprehensive scrollable coins list from server
  useEffect(() => {
    const fetchAllCoins = async () => {
      setAllCoinsLoading(true);
      try {
        const res = await fetch('/api/all-coins');
        if (res.ok) {
          const data = await res.json();
          setAllCoins(data);
        }
      } catch (err) {
        console.error('Failed to pre-fetch complete coin ticker lists:', err);
      } finally {
        setAllCoinsLoading(false);
      }
    };
    fetchAllCoins();
  }, []);

  // Close search and language dropdowns on clicking outside their respective containers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getCoinColor = (sym: string) => {
    const hash = sym.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hues = [20, 140, 200, 240, 275, 315, 345];
    const hue = hues[hash % hues.length];
    return `linear-gradient(135deg, hsl(${hue}, 85%, 55%) 0%, hsl(${(hue + 45) % 360}, 80%, 40%) 100%)`;
  };

  const filteredCoins = allCoins
    .filter((c) => {
      // 1. Filter by search tab
      if (searchTab === 'favorites' && !favorites.includes(c.symbol)) return false;

      // 2. Filter by search input query
      const q = searchInput.trim().toLowerCase();
      if (!q) return true;
      return c.symbol.toLowerCase().includes(q) || c.fullName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'symbol') {
        valA = a.symbol;
        valB = b.symbol;
      } else if (sortField === 'price') {
        valA = a.price;
        valB = b.price;
      } else if (sortField === 'change') {
        valA = a.change24h;
        valB = b.change24h;
      } else if (sortField === 'fundingRate') {
        valA = a.fundingRate || 0;
        valB = b.fundingRate || 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      fetchCoinData(searchInput.trim(), timeframe);
      setSearchInput('');
      setDropdownOpen(false);
    }
  };

  const handlePopularSelect = (selectedSymbol: string) => {
    fetchCoinData(selectedSymbol, timeframe);
    setDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-200 flex flex-col font-sans" id="crypto-app-container" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* ─── GLOBAL HEADER BAR ─── */}
      <header className="border-b border-zinc-900 bg-[#070709] relative px-4 py-4 lg:px-8 shadow-2xl sticky top-0 z-50" id="global-nav">
        {/* Subtle decorative purple lights wrapped in standard overflow-hidden helper */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-[400px] h-[150px] bg-indigo-500/5 rounded-full blur-[100px]" />
          <div className="absolute top-0 right-1/4 w-[300px] h-[150px] bg-violet-500/10 rounded-full blur-[80px]" />
        </div>

        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
          {/* Brand/logo block */}
          <div className="flex items-center gap-4">
            {/* Custom Glowing Shield-Compass SVG Logo */}
            <div className="relative shrink-0 select-none scale-105">
              <svg className="w-14 h-14 drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Shield Border */}
                <path d="M50 10 L85 22 V55 C85 75 50 90 50 90 C50 90 15 75 15 55 V22 Z" fill="url(#shieldMetalGrad)" stroke="url(#shieldEdgeGrad)" strokeWidth="3.5" />
                {/* Inner deep dark purple background circular radar */}
                <circle cx="50" cy="46" r="23" fill="url(#innerCircleGrad)" stroke="url(#innerCircleMetal)" strokeWidth="1.5" />
                {/* Tech Radar Rings */}
                <circle cx="50" cy="46" r="15" stroke="rgba(168, 85, 247, 0.25)" strokeWidth="0.8" strokeDasharray="2 2" />
                {/* Glowing Needle Star */}
                <path d="M50 26 L54 41 L69 46 L54 51 L50 66 L46 51 L31 46 L46 41 Z" fill="url(#needleGrad)" className="animate-pulse" />
                {/* Center Core Rivet */}
                <circle cx="50" cy="46" r="3.5" fill="#ffffff" className="shadow-[0_0_8px_#ffffff]" />
                <defs>
                  <linearGradient id="shieldMetalGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2c2c35" />
                    <stop offset="50%" stopColor="#1e1e24" />
                    <stop offset="100%" stopColor="#0a0a0d" />
                  </linearGradient>
                  <linearGradient id="shieldEdgeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="25%" stopColor="#cfcfda" />
                    <stop offset="75%" stopColor="#555562" />
                    <stop offset="100%" stopColor="#9a9ab0" />
                  </linearGradient>
                  <linearGradient id="innerCircleGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#25123e" />
                    <stop offset="50%" stopColor="#120822" />
                    <stop offset="100%" stopColor="#07030e" />
                  </linearGradient>
                  <linearGradient id="innerCircleMetal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.75" />
                  </linearGradient>
                  <linearGradient id="needleGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#e9d5ff" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <div className="flex flex-col select-none text-left">
              <h1 className="text-xl md:text-2xl font-black tracking-wider text-white flex items-center leading-none mb-1 shadow-sm font-sans" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.4)" }}>
                CRYPTO MATRIX TERMINAL
              </h1>
              <span className="text-[10px] md:text-[11px] font-bold text-zinc-400 tracking-widest uppercase font-sans">
                {t(lang, 'subtitle').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Controls row with metallic language switcher, search input with Purple button and User profile */}
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
            
            {/* Custom metallic dropdown Language switcher */}
            <div ref={langDropdownRef} className="relative z-50">
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="bg-gradient-to-b from-[#f2f2f7] via-[#c4c4cc] to-[#92929b] text-[#111115] font-black border-t border-white border-l border-white/60 border-r border-zinc-500 border-b border-zinc-650 shadow-[0_2px_4px_rgba(0,0,0,0.35)] rounded-xl px-4.5 py-2 flex items-center justify-between gap-3 text-xs transition duration-150 active:scale-95 cursor-pointer min-w-[130px]"
                id="custom-lang-btn"
              >
                <div className="flex items-center gap-1.5 select-none font-sans">
                  <span className="text-sm scale-110">{languages.find(l => l.code === lang)?.flag}</span>
                  <span className="uppercase font-sans font-black text-[#111115] tracking-tight">{lang === 'tr' ? 'TR' : lang.toUpperCase()}</span>
                  <span className="text-zinc-800 font-extrabold">{languages.find(l => l.code === lang)?.label}</span>
                </div>
                <span className="text-[#111115] font-black text-[9px] select-none scale-90">▼</span>
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-48 bg-[#121215]/95 border border-zinc-800/80 rounded-2xl shadow-2xl z-50 py-2 animate-fadeIn max-h-[320px] overflow-y-auto backdrop-blur-md scrollbar-thin scrollbar-thumb-zinc-800">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLang(l.code);
                        localStorage.setItem('terminal_lang', l.code);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-800/60 text-xs font-black flex items-center gap-2.5 transition shrink-0 ${
                        lang === l.code ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      <span className="text-base select-none">{l.flag}</span>
                      <span>{l.label}</span>
                      {lang === l.code && <span className="ml-auto text-indigo-400 select-none">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Glowing search bar input wrapper */}
            <div ref={searchContainerRef} className="relative w-full sm:w-80" id="search-coin-container">
              <form onSubmit={handleSearchSubmit} className="relative w-full" id="search-coin-form">
                <input
                  id="search-input"
                  type="text"
                  placeholder={t(lang, 'searchPlaceholder')}
                  value={searchInput}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setDropdownOpen(true);
                  }}
                  className="w-full bg-[#0a0a0bd5] border border-zinc-800 rounded-full py-2.5 pl-11 pr-20 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition focus:ring-2 focus:ring-violet-500/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]"
                  style={{ borderColor: 'rgba(63, 63, 70, 0.45)' }}
                />
                <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-3 hover:text-indigo-400 cursor-pointer" />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-full px-5 flex items-center justify-center transition cursor-pointer select-none active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.55)] border-t border-violet-400/40"
                >
                  {t(lang, 'searchBtn')}
                </button>
              </form>

              {/* Comprehensive Scrollable Dropdown List with 24h Vol and Change */}
              {dropdownOpen && (
                <div className="absolute top-12 right-0 w-[350px] sm:w-[500px] md:w-[600px] lg:w-[640px] bg-[#121214]/98 border border-zinc-850 shadow-[0_20px_50px_rgba(0,0,0,0.95)] rounded-2xl z-50 py-3.5 flex flex-col overflow-hidden animate-fadeIn select-none backdrop-blur-md">
                  
                  {/* Dynamic Tab Selector (All Coins vs Favorites) */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 border-b border-zinc-800/60 mb-2">
                    <button
                      type="button"
                      onClick={() => setSearchTab('all')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        searchTab === 'all'
                          ? 'bg-zinc-800 text-white'
                          : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>{t(lang, 'searchTabAll')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchTab('favorites')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        searchTab === 'favorites'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-transparent text-zinc-500 hover:text-amber-400'
                      }`}
                    >
                      <span>{t(lang, 'searchTabFav')} ({favorites.length})</span>
                    </button>
                  </div>

                  {/* Dropdown Header labels */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/40 pb-2 px-4 select-none tracking-wider font-mono">
                    
                    {/* Symbols column */}
                    <div 
                      className={`col-span-5 flex items-center gap-1.5 cursor-pointer hover:text-zinc-300 transition ${sortField === 'symbol' ? 'text-zinc-300' : ''}`}
                      onClick={() => {
                        setSortField('symbol');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span>Symbols / Vol</span>
                      <span>{sortField === 'symbol' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                    </div>

                    {/* Price column */}
                    <div 
                      className={`col-span-3 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-zinc-300 transition ${sortField === 'price' ? 'text-zinc-300' : ''}`}
                      onClick={() => {
                        setSortField('price');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span>Last Price</span>
                      <span>{sortField === 'price' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                    </div>

                    {/* Change column */}
                    <div 
                      className={`col-span-2 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-zinc-300 transition ${sortField === 'change' ? 'text-zinc-300' : ''}`}
                      onClick={() => {
                        setSortField('change');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span>24h Chg</span>
                      <span>{sortField === 'change' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                    </div>

                    {/* Funding Rate column */}
                    <div 
                      className={`col-span-2 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-zinc-300 transition ${sortField === 'fundingRate' ? 'text-zinc-300' : ''}`}
                      onClick={() => {
                        setSortField('fundingRate');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span>Funding Rate</span>
                      <span>{sortField === 'fundingRate' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </div>

                  {/* Coins List Scroll Container */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-900/40 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {allCoinsLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs font-medium gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                        <span>{t(lang, 'loadingCoins')}</span>
                      </div>
                    ) : filteredCoins.length === 0 ? (
                      <div className="text-center py-12 p-6 text-zinc-500 text-xs font-semibold">
                        {searchTab === 'favorites' 
                          ? t(lang, 'favsEmpty')
                          : t(lang, 'noCoinFound')}
                      </div>
                    ) : (
                      filteredCoins.map((c) => {
                        const isFav = favorites.includes(c.symbol);
                        return (
                          <div
                            key={c.symbol}
                            onClick={() => {
                              fetchCoinData(c.symbol, timeframe);
                              setDropdownOpen(false);
                              setSearchInput('');
                            }}
                            className={`grid grid-cols-12 gap-1 py-2.5 px-4 items-center hover:bg-zinc-800/30 hover:border-l-2 hover:border-indigo-500/80 transition-all duration-100 ease-out text-xs cursor-pointer ${
                              symbol === c.symbol ? 'bg-indigo-500/5 border-l-2 border-indigo-600' : 'border-l-2 border-transparent'
                            }`}
                          >
                            {/* Star Icon & Coin Logo & Symbol Info (Col span 5) */}
                            <div className="col-span-5 flex items-center gap-2 min-w-0">
                              
                              {/* Star Toggle Link */}
                              <button
                                type="button"
                                onClick={(e) => toggleFavorite(e, c.symbol)}
                                className="text-zinc-600 hover:text-amber-400 p-0.5 rounded transition cursor-pointer"
                              >
                                <span className={`text-[15px] select-none ${isFav ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`}>
                                  {isFav ? '★' : '☆'}
                                </span>
                              </button>

                              {/* Coin logo mockup with dynamic brand gradient */}
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold text-[#ffffff] shrink-0 shadow-lg"
                                style={{ background: getCoinColor(c.symbol) }}
                              >
                                {c.symbol.slice(0, 2)}
                              </div>

                              {/* Name/Label container */}
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-zinc-100 flex items-center gap-1 select-none font-mono tracking-tight">
                                  {c.symbol}
                                  <span className="text-[10px] text-zinc-400 font-sans font-medium px-1 bg-zinc-800/80 border border-zinc-700/50 rounded-md scale-[0.85] origin-left select-none">
                                    {t(lang, 'perpLabel')}
                                  </span>
                                </span>
                                <span className="text-[10px] text-zinc-500 font-semibold font-mono tracking-tight">
                                  {formatVolume(c.volume24h)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Price (Col span 3) */}
                            <div className="col-span-3 text-right font-bold text-zinc-100 font-mono tracking-tight">
                              {formatUSD(c.price)}
                            </div>
                            
                            {/* 24h Change (Col span 2) */}
                            <div className={`col-span-2 text-right font-extrabold font-mono text-xs tracking-tight ${
                              c.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                            </div>
                            
                            {/* Funding Rate (Col span 2) */}
                            <div className="col-span-2 text-right text-zinc-300 font-bold font-mono text-[10.5px] tracking-normal">
                              {c.fundingRate !== undefined 
                                ? (c.fundingRate >= 0 ? '+' : '') + c.fundingRate.toFixed(5) + '%'
                                : '0.01000%'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Elegant Footer Details */}
                  <div className="border-t border-zinc-800/80 pt-2.5 px-4 flex items-center justify-between text-[9px] text-zinc-500 font-mono font-bold tracking-tight select-none font-sans">
                    <span>{t(lang, 'totalCoinsCount')}: {filteredCoins.length} / {allCoins.length} {t(lang, 'instruments')}</span>
                    <span className="text-indigo-400">{t(lang, 'binanceLiveDataStatus')}</span>
                  </div>

                </div>
              )}
            </div>

            {/* Silver Profile Avatar medallion  */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#dfdfe4] via-[#b5b5c0] to-[#787880] p-[1.5px] shadow-[0_3px_8px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0" title="john_cecil_fredd@hotmail.com">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1b1b1e] to-[#0f0f11] flex items-center justify-center overflow-hidden relative">
                {/* Inner specular lighting overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none" />
                <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12c0 2.518.956 4.813 2.529 6.54.407-.818 1.155-1.424 2.133-1.688A7.221 7.221 0 0112 15a7.22 7.22 0 015.088 1.852c.978.264 1.726.87 2.133 1.688zM12 13a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ─── WORKSPACE CONTENT AREA ─── */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6" id="workspace-main">
        {/* Error Notification Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 shadow-lg animate-fadeIn text-sm" id="global-error-box">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-400 mb-0.5">{t(lang, 'loadingError')}</h3>
              <p className="text-gray-400 text-xs">{error}</p>
            </div>
            <button
              onClick={() => fetchCoinData(symbol, timeframe)}
              className="text-xs text-red-400 hover:text-red-300 underline font-semibold shrink-0 cursor-pointer"
            >
              {t(lang, 'retryBtn')}
            </button>
          </div>
        )}

        {/* Control & Timeline Bar - High-End Glimmer gunmetal ribbon */}
        <div 
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-b from-[#5c5c66] via-[#3a3a40] to-[#25252a] border border-[#6f6f7b] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),_0_8px_24px_rgba(0,0,0,0.6)] rounded-2xl px-5 py-2.5 font-sans relative overflow-hidden" 
          id="timeline-ribbon"
        >
          {/* Diagonal sheen shine reflection effect */}
          <div className="absolute inset-x-0 top-0 h-[40%] bg-white/5 pointer-events-none" />

          {/* Left: Summary Indicator state */}
          <div className="flex items-center gap-3 relative z-10 select-none">
            <div className="w-3.5 h-3.5 rounded-full bg-[#10b981] border border-white/40 shadow-[0_0_12px_#10b981] animate-pulse shrink-0" />
            <div className="text-xs tracking-tight text-left">
              <span className="text-zinc-300 font-extrabold font-sans">
                {lang === 'tr' ? 'Analiz edilen çift: ' : 'Analyzed pair: '}
              </span>
              <strong className="text-white font-black text-sm tracking-wide ml-0.5">{symbol}/USDT</strong>
              {coinDetails && (
                <span className={`ml-2 font-black font-mono text-[12.5px] ${coinDetails.change24h >= 0 ? 'text-[#22c55e]' : 'text-red-400'}`} style={{ textShadow: "0 1.5px 3px rgba(0,0,0,0.5)" }}>
                  ({formatUSD(coinDetails.price)})
                </span>
              )}
            </div>
          </div>

          {/* Right: Timeframe Selection Slots & Refresh */}
          <div className="flex items-center justify-between md:justify-end gap-4 flex-wrap relative z-10 w-full md:w-auto">
            
            {/* Dark inset for timeframe segments */}
            <div className="flex flex-wrap items-center bg-[#070709]/80 p-1.5 rounded-xl border border-zinc-800/65 gap-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" id="timeframe-group">
              {(['1m', '5m', '15m', '1h', '4h', '6h', '1w', '1M'] as Timeframe[]).map((tf) => {
                const labels: Record<string, Record<Language, string>> = {
                  '1m': { tr: '1 DK', en: '1M', de: '1 MIN', fr: '1 MIN', it: '1 MIN', el: '1 Λ', ru: '1 МИН', ar: 'دقيقة ١', zh: '1分', ja: '1分', ko: '1분' },
                  '5m': { tr: '5 DK', en: '5M', de: '5 MIN', fr: '5 MIN', it: '5 MIN', el: '5 Λ', ru: '5 МИН', ar: '٥ دقائق', zh: '5分', ja: '5分', ko: '5분' },
                  '15m': { tr: '15 DK', en: '15M', de: '15 MIN', fr: '15 MIN', it: '15 MIN', el: '15 Λ', ru: '15 МИН', ar: '١٥ دقيقة', zh: '15分', ja: '15分', ko: '15분' },
                  '1h': { tr: '1 SA', en: '1H', de: '1 STD', fr: '1 HEURE', it: '1 ORA', el: '1 Ω', ru: '1 Ч', ar: 'ساعة ١', zh: '1小时', ja: '1時間', ko: '1시간' },
                  '4h': { tr: '4 SA', en: '4H', de: '4 STD', fr: '4 HEURES', it: '4 ORE', el: '4 Ω', ru: '4 Ч', ar: '٤ ساعات', zh: '4小时', ja: '4時間', ko: '4시간' },
                  '6h': { tr: '6 SA', en: '6H', de: '6 STD', fr: '6 HEURES', it: '6 ORE', el: '6 Ω', ru: '6 Ч', ar: '٦ ساعات', zh: '6小时', ja: '6時間', ko: '6시간' },
                  '1w': { tr: '1 HF', en: '1W', de: '1 WO', fr: '1 SEM', it: '1 SETT', el: '1 ΕΒΔ', ru: '1 НЕД', ar: 'أسبوع ١', zh: '1周', ja: '1週間', ko: '1주' },
                  '1M': { tr: '1 AY', en: '1MO', de: '1 MON', fr: '1 MOIS', it: '1 MESE', el: '1 Μ', ru: '1 МЕС', ar: 'شهر ١', zh: '1月', ja: '1ヶ月', ko: '1달' }
                };
                const displayLabel = labels[tf]?.[lang] || tf.toUpperCase();
                const isActive = timeframe === tf;
                return (
                  <button
                    key={tf}
                    id={`timeframe-${tf}`}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-black uppercase transition-all duration-150 flex items-center gap-0.5 cursor-pointer select-none ${
                      isActive
                        ? 'bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-800 text-white shadow-[0_0_14px_rgba(99,102,241,0.7)] border-t border-indigo-400/40 font-black scale-[1.03]'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                    }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>

            {/* Brushed silver loop refresh button */}
            <button
              id="refresh-btn"
              onClick={() => fetchCoinData(symbol, timeframe)}
              disabled={loading}
              className="p-2.5 bg-gradient-to-b from-[#e5e5ea] via-[#bdbcbf] to-[#8f8e91] text-[#111115] hover:from-[#ffffff] hover:to-[#a09fa2] active:scale-95 rounded-xl border-t border-white/60 border-b-zinc-700 shadow-[0_2px_4px_rgba(0,0,0,0.4)] font-black transition disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0 animate-none"
              title={lang === 'tr' ? 'Verileri Yenile' : 'Refresh Data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#111115] font-black stroke-[3px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loader Screen overlay */}
        {loading && !coinDetails ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20" id="global-loader">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-sm font-semibold tracking-wide text-zinc-400 animate-pulse">
              {t(lang, 'loaderText')}
            </p>
          </div>
        ) : (
          /* ─── TERMINAL GRID ─── */
          coinDetails && (
            <div className="flex flex-col gap-6" id="terminal-grid-wrapper">
              
              {/* TOP ROW: SPLIT-SCREEN LAYOUT */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch" id="terminal-main-split">
                
                {/* LEFT COLUMN: COMPLETELY SPOT GRAPHIC, SPOT COMMENTARY AND VALUATION */}
                <div className="flex flex-col gap-6 flex-1 font-sans" id="spot-column-wrapper">
                  <div className="bg-[#111113]/30 border border-zinc-800/60 rounded-2xl p-4 lg:p-5 flex flex-col gap-5 flex-1">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h2 className="text-xs font-black text-emerald-400 tracking-wider uppercase font-mono">
                        {t(lang, 'spotZoneTitle')}
                      </h2>
                    </div>
                    <TradingChart
                      key={`spot-${coinDetails.symbol}`}
                      mode="spot"
                      candles={spotKlines}
                      visibility={spotVisibility}
                      setVisibility={setSpotVisibility}
                      symbol={coinDetails.symbol}
                      lang={lang}
                    />
                    <StatsBar
                      coin={coinDetails}
                      onSelectPopular={handlePopularSelect}
                      latestCandle={spotKlines && spotKlines.length > 0 ? spotKlines[spotKlines.length - 1] : null}
                      lang={lang}
                      unifiedReport={unifiedReport}
                      aiLoading={aiLoading}
                      aiError={aiError}
                      onTriggerAnalysis={handleTriggerAnalysis}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: COMPLETELY FUTURES GRAPHIC, FUTURES EVALUATION */}
                <div className="flex flex-col gap-6 flex-1 font-sans" id="futures-column-wrapper">
                  <div className="bg-[#111113]/30 border border-zinc-800/60 rounded-2xl p-4 lg:p-5 flex flex-col gap-5 flex-1">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                      <h2 className="text-xs font-black text-indigo-400 tracking-wider uppercase font-mono">
                        {t(lang, 'futuresZoneTitle')}
                      </h2>
                    </div>
                    <TradingChart
                      key={`futures-${coinDetails.symbol}`}
                      mode="futures"
                      candles={futuresKlines}
                      visibility={futuresVisibility}
                      setVisibility={setFuturesVisibility}
                      symbol={coinDetails.symbol}
                      lang={lang}
                    />
                    <AIAnalysisPanel
                      coin={coinDetails}
                      klines={futuresKlines}
                      timeframe={timeframe}
                      lang={lang}
                      unifiedReport={unifiedReport}
                      aiLoading={aiLoading}
                      aiError={aiError}
                      onTriggerAnalysis={handleTriggerAnalysis}
                    />
                  </div>
                </div>

              </div>

              {/* BOTTOM ROW: UNIFIED SPOT+FUTURES INFERENCE & REASONING CORRELATION ENGINE */}
              <UnifiedCorrelationEngine
                coin={coinDetails}
                spotKlines={spotKlines}
                futuresKlines={futuresKlines}
                unifiedReport={unifiedReport}
                aiLoading={aiLoading}
                aiError={aiError}
                onTriggerAnalysis={handleTriggerAnalysis}
                lang={lang}
              />

            </div>
          )
        )}
      </main>

      {/* ─── FOOTER & REGULATION DISCLAIMER ─── */}
      <footer className="border-t border-zinc-850 bg-[#0d0d0f] py-6 px-6 text-center mt-auto flex flex-col md:flex-row items-center justify-between gap-4" id="legal-disclaimer">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">Powered by Gemini AI Engine</span>
          <span className="text-[10px] text-zinc-650 font-mono">v2.0.4-stable-localized</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-400/5 px-2.5 py-0.5 rounded-full border border-red-500/10">
            <ShieldAlert className="w-3 h-3" />
            <span>{t(lang, 'disclaimerTitle')}</span>
          </div>
          <p className="text-[10px] text-zinc-500 max-w-lg leading-relaxed font-sans">
            {t(lang, 'disclaimerDesc')}
          </p>
        </div>
        <div className="text-[10px] text-zinc-650 italic font-medium font-mono">
          Crypto Matrix Terminal © 2026
        </div>
      </footer>
    </div>
  );
}
