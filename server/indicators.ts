/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  if (prices.length < period) {
    return Array(prices.length).fill(null);
  }

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
    ema.push(null);
  }
  const sma = sum / period;
  ema[period - 1] = sma;

  const k = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    const prevEma = ema[i - 1];
    if (prevEma === null) {
      ema.push(null);
    } else {
      ema.push(prices[i] * k + prevEma * (1 - k));
    }
  }
  return ema;
}

export function calculateSMA(values: (number | null)[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    let hasNull = false;
    for (let j = 0; j < period; j++) {
      const val = values[i - j];
      if (val === null || val === undefined) {
        hasNull = true;
        break;
      }
      sum += val;
      count++;
    }
    if (hasNull || count < period) {
      sma.push(null);
    } else {
      sma.push(sum / period);
    }
  }
  return sma;
}

export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  if (prices.length < period + 1) {
    return Array(prices.length).fill(null);
  }

  // Pre-fill nulls for the initial window
  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }

  let gains = 0;
  let losses = 0;

  // First RSI Calculation (Simple Average of gains and losses)
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  // Wilder's Smoothing for subsequent values
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

export function calculateMACD(prices: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const macdLine: (number | null)[] = [];
  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  // MACD Line
  for (let i = 0; i < prices.length; i++) {
    const e12 = ema12[i];
    const e26 = ema26[i];
    if (e12 !== null && e26 !== null) {
      macdLine.push(e12 - e26);
    } else {
      macdLine.push(null);
    }
  }

  // Signal Line (EMA 9 of MACD Line)
  const validMacdIndices: number[] = [];
  const validMacdValues: number[] = [];

  for (let i = 0; i < macdLine.length; i++) {
    const val = macdLine[i];
    if (val !== null) {
      validMacdIndices.push(i);
      validMacdValues.push(val);
    }
  }

  const signalValid = calculateEMA(validMacdValues, 9);

  let validIdx = 0;
  for (let i = 0; i < prices.length; i++) {
    const isVal = validMacdIndices.indexOf(i);
    if (isVal !== -1) {
      const sVal = signalValid[isVal];
      signalLine.push(sVal);
    } else {
      signalLine.push(null);
    }
  }

  // MACD Histogram
  for (let i = 0; i < prices.length; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m !== null && s !== null) {
      histogram.push(m - s);
    } else {
      histogram.push(null);
    }
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
  };
}
