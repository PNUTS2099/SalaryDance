const STORAGE_KEYS = {
  config: "salary-wallet-miniprogram-config",
  history: "salary-wallet-miniprogram-history",
  slack: "salary-wallet-miniprogram-slack"
};

const CONFIG_VERSION = 1;
const TAX_FREE_THRESHOLD = 5000;
const MONTHLY_TAX_BRACKETS = [
  { max: 3000, rate: 0.03, quickDeduction: 0 },
  { max: 12000, rate: 0.10, quickDeduction: 210 },
  { max: 25000, rate: 0.20, quickDeduction: 1410 },
  { max: 35000, rate: 0.25, quickDeduction: 2660 },
  { max: 55000, rate: 0.30, quickDeduction: 4410 },
  { max: 80000, rate: 0.35, quickDeduction: 7160 },
  { max: Infinity, rate: 0.45, quickDeduction: 15160 }
];

const currencies = {
  CNY: {
    code: "CNY",
    name: "人民币",
    symbol: "¥",
    decimals: 2,
    notes: [100, 50, 20, 10, 5, 1],
    coins: [1, 0.5, 0.1],
    palette: {
      100: "#f27b7b",
      50: "#73b18c",
      20: "#d8a967",
      10: "#8db6e8",
      5: "#c9a8e8",
      1: "#dce7f7",
      coin: "#d7a62c"
    }
  },
  USD: {
    code: "USD",
    name: "美元",
    symbol: "$",
    decimals: 2,
    notes: [100, 50, 20, 10, 5, 1],
    coins: [1, 0.25, 0.1],
    palette: {
      100: "#a9c9a7",
      50: "#b7d8b4",
      20: "#c1dfbe",
      10: "#cbe6c7",
      5: "#d5ebd0",
      1: "#e0f0d9",
      coin: "#c5ccd2"
    }
  },
  HKD: {
    code: "HKD",
    name: "港币",
    symbol: "HK$",
    decimals: 2,
    notes: [1000, 500, 100, 50, 20, 10],
    coins: [10, 5, 2, 1],
    palette: {
      1000: "#d9878c",
      500: "#c99bd7",
      100: "#e8a66c",
      50: "#8fb9e9",
      20: "#9fd2a6",
      10: "#dce7f7",
      coin: "#d3a64a"
    }
  },
  EUR: {
    code: "EUR",
    name: "欧元",
    symbol: "€",
    decimals: 2,
    notes: [500, 200, 100, 50, 20, 10, 5],
    coins: [2, 1, 0.5, 0.1],
    palette: {
      500: "#b59bd7",
      200: "#e8c46b",
      100: "#8ec9a1",
      50: "#e89a87",
      20: "#84b5df",
      10: "#db8a92",
      5: "#c7c7c7",
      coin: "#d8a93d"
    }
  },
  JPY: {
    code: "JPY",
    name: "日元",
    symbol: "JP¥",
    decimals: 0,
    notes: [10000, 5000, 2000, 1000],
    coins: [500, 100, 50, 10, 5, 1],
    palette: {
      10000: "#cfc5a4",
      5000: "#b8cfbd",
      2000: "#bec8dc",
      1000: "#d8c0b4",
      coin: "#c7c7c7"
    }
  }
};

const currencyList = Object.keys(currencies).map((code) => currencies[code]);

const defaultConfig = {
  monthlySalary: "",
  currency: "CNY",
  taxEnabled: false,
  socialDeduction: "",
  specialDeduction: "",
  workDaysPerMonth: 22,
  startTime: "09:00",
  endTime: "18:00"
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseTimeToSeconds(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 3600 + minutes * 60;
}

function getTodaySeconds(date = new Date()) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getWeekStart(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return getDateKey(next);
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function getWeekdayLabel(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function sanitizeMoney(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const head = parts[0] || "";
  const tail = parts.length > 1 ? `.${parts.slice(1).join("").slice(0, 2)}` : "";
  return head + tail;
}

function getCurrency(code) {
  return currencies[code] || currencies.CNY;
}

function formatMoney(value, currencyCode = "CNY", options = {}) {
  const currency = getCurrency(currencyCode);
  const decimals = options.decimals ?? currency.decimals;
  const amount = Number.isFinite(value) ? value : 0;
  return currency.symbol + amount.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes} 分钟`;
  if (minutes <= 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function calculateMonthlyTax(salary, socialDeduction, specialDeduction) {
  const safeSalary = Number.isFinite(salary) ? salary : 0;
  const social = Number.isFinite(socialDeduction) ? socialDeduction : 0;
  const special = Number.isFinite(specialDeduction) ? specialDeduction : 0;
  const taxableIncome = Math.max(0, safeSalary - social - special - TAX_FREE_THRESHOLD);
  const bracket = MONTHLY_TAX_BRACKETS.find((item) => taxableIncome <= item.max) || MONTHLY_TAX_BRACKETS[0];
  const monthlyTax = Math.max(0, taxableIncome * bracket.rate - bracket.quickDeduction);
  const netSalary = Math.max(0, safeSalary - social - monthlyTax);

  return {
    taxableIncome,
    monthlyTax,
    netSalary,
    rate: bracket.rate,
    quickDeduction: bracket.quickDeduction
  };
}

function normalizeConfig(input = {}) {
  return {
    ...defaultConfig,
    monthlySalary: sanitizeMoney(input.monthlySalary),
    currency: currencies[input.currency] ? input.currency : "CNY",
    taxEnabled: Boolean(input.taxEnabled),
    socialDeduction: sanitizeMoney(input.socialDeduction),
    specialDeduction: sanitizeMoney(input.specialDeduction),
    workDaysPerMonth: Number(input.workDaysPerMonth) || defaultConfig.workDaysPerMonth,
    startTime: input.startTime || defaultConfig.startTime,
    endTime: input.endTime || defaultConfig.endTime
  };
}

function validateConfig(config) {
  const salary = Number(config.monthlySalary);
  const workDays = Number(config.workDaysPerMonth);
  const socialDeduction = Number(config.socialDeduction) || 0;
  const specialDeduction = Number(config.specialDeduction) || 0;
  const start = parseTimeToSeconds(config.startTime);
  const end = parseTimeToSeconds(config.endTime);

  if (!config.monthlySalary || !Number.isFinite(salary) || salary <= 0) {
    return "请输入大于 0 的月薪";
  }

  if (salary > 999999) {
    return "月薪上限为 999999";
  }

  if (config.taxEnabled && (socialDeduction < 0 || specialDeduction < 0)) {
    return "扣除金额不能为负数";
  }

  if (config.taxEnabled && socialDeduction > salary) {
    return "五险一金不能高于月薪";
  }

  if (!Number.isInteger(workDays) || workDays < 1 || workDays > 31) {
    return "每月工作天数需为 1-31 天";
  }

  if (!config.startTime || !config.endTime || end <= start) {
    return "下班时间需要晚于上班时间";
  }

  return "";
}

function getTodayRecord(history = [], date = new Date()) {
  const key = getDateKey(date);
  return history.find((record) => record.date === key);
}

function calculateSnapshot(configInput, history = [], now = new Date()) {
  const config = normalizeConfig(configInput);
  const salary = Number(config.monthlySalary);
  const taxEnabled = Boolean(config.taxEnabled);
  const socialDeduction = Number(config.socialDeduction) || 0;
  const specialDeduction = Number(config.specialDeduction) || 0;
  const tax = calculateMonthlyTax(salary, socialDeduction, specialDeduction);
  const incomeSalary = taxEnabled ? tax.netSalary : salary;
  const workDays = Number(config.workDaysPerMonth);
  const start = parseTimeToSeconds(config.startTime);
  const end = parseTimeToSeconds(config.endTime);
  const totalSeconds = Math.max(1, end - start);
  const current = getTodaySeconds(now);
  const todayRecord = getTodayRecord(history, now);
  const hasEndedToday = Boolean(todayRecord);
  const workedSeconds = hasEndedToday
    ? clamp(Number(todayRecord.workSeconds) || 0, 0, totalSeconds)
    : clamp(current - start, 0, totalSeconds);
  const daily = incomeSalary / workDays;
  const hourly = daily / (totalSeconds / 3600);
  const minute = hourly / 60;
  const second = minute / 60;
  const earned = hasEndedToday ? daily : second * workedSeconds;
  const progress = workedSeconds / totalSeconds;

  let status = "working";
  if (current < start) status = "before";
  if (current >= end) status = "after";
  if (hasEndedToday) status = todayRecord.mode === "early" ? "early" : "after";

  return {
    status,
    todayRecord,
    hasEndedToday,
    salary,
    incomeSalary,
    taxEnabled,
    taxableIncome: tax.taxableIncome,
    monthlyTax: tax.monthlyTax,
    netSalary: tax.netSalary,
    taxRate: tax.rate,
    quickDeduction: tax.quickDeduction,
    totalSeconds,
    workedSeconds,
    remainingSeconds: hasEndedToday ? 0 : Math.max(0, totalSeconds - workedSeconds),
    daily,
    hourly,
    minute,
    second,
    earned,
    progress
  };
}

function buildWorkRecord(configInput, snapshot, mode, now = new Date()) {
  const config = normalizeConfig(configInput);
  const actualSeconds = Math.max(60, Math.floor(snapshot.workedSeconds));
  const actualHours = actualSeconds / 3600;
  const actualHourly = snapshot.daily / actualHours;

  return {
    date: getDateKey(now),
    mode,
    currency: config.currency,
    taxEnabled: snapshot.taxEnabled,
    startTime: config.startTime,
    endTime: config.endTime,
    actualEndTime: now.toTimeString().slice(0, 5),
    workSeconds: actualSeconds,
    dailyIncome: snapshot.daily,
    actualHourly,
    createdAt: now.toISOString()
  };
}

function upsertByDate(records, record, limit = 60) {
  const list = Array.isArray(records) ? records.slice() : [];
  const index = list.findIndex((item) => item.date === record.date);
  if (index >= 0) {
    list[index] = { ...list[index], ...record };
  } else {
    list.push(record);
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-limit);
}

function removeRecordForDate(records, date = new Date()) {
  const key = getDateKey(date);
  return (Array.isArray(records) ? records : []).filter((record) => record.date !== key);
}

function buildSlackRecord(activeSlack, configInput, endedAtMs = Date.now()) {
  if (!activeSlack) return null;

  const config = normalizeConfig(configInput);
  const seconds = Math.max(1, Math.floor((endedAtMs - activeSlack.startedAt) / 1000));
  const income = seconds * activeSlack.secondIncome;
  const startDate = new Date(activeSlack.startedAt);

  return {
    id: `${activeSlack.startedAt}-${activeSlack.type}`,
    type: activeSlack.type,
    date: getDateKey(startDate),
    weekStart: getWeekStart(startDate),
    month: getMonthKey(startDate),
    startedAt: new Date(activeSlack.startedAt).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    seconds,
    secondIncome: activeSlack.secondIncome,
    income,
    currency: config.currency,
    taxEnabled: Boolean(config.taxEnabled)
  };
}

function summarizeSlackRecords(records = [], now = new Date()) {
  const today = getDateKey(now);
  const weekStart = getWeekStart(now);
  const month = getMonthKey(now);
  const summary = {
    todayIncome: 0,
    weekIncome: 0,
    monthIncome: 0,
    poopIncome: 0,
    slackIncome: 0,
    todaySeconds: 0
  };

  records.forEach((record) => {
    const income = Number(record.income) || 0;
    const seconds = Number(record.seconds) || 0;

    if (record.date === today) {
      summary.todayIncome += income;
      summary.todaySeconds += seconds;
      if (record.type === "poop") summary.poopIncome += income;
      if (record.type === "slack") summary.slackIncome += income;
    }

    if (record.weekStart === weekStart) summary.weekIncome += income;
    if (record.month === month) summary.monthIncome += income;
  });

  return summary;
}

function buildHistoryBars(history = [], now = new Date()) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  const records = days.map((date) => {
    const key = getDateKey(date);
    return { date, key, record: history.find((item) => item.date === key) };
  });
  const visible = records.filter((item) => item.record);
  const maxHours = Math.max(...visible.map((item) => item.record.workSeconds / 3600), 1);
  const maxRate = Math.max(...visible.map((item) => item.record.actualHourly), 1);

  return records.map((item) => {
    const record = item.record;
    const hours = record ? record.workSeconds / 3600 : 0;
    const rate = record ? record.actualHourly : 0;

    return {
      key: item.key,
      label: getWeekdayLabel(item.date).slice(1),
      hasRecord: Boolean(record),
      hours,
      rate,
      hoursHeight: record ? Math.max(8, Math.round((hours / maxHours) * 96)) : 6,
      rateHeight: record ? Math.max(8, Math.round((rate / maxRate) * 96)) : 6
    };
  });
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function buildHistoryInsight(history = [], now = new Date(), currencyCode = "CNY") {
  const today = now;
  const currentStart = addDays(today, -6);
  const previousStart = addDays(today, -13);
  const previousEnd = addDays(today, -7);
  const currentRates = history
    .filter((record) => record.date >= getDateKey(currentStart) && record.date <= getDateKey(today))
    .map((record) => Number(record.actualHourly));
  const previousRates = history
    .filter((record) => record.date >= getDateKey(previousStart) && record.date <= getDateKey(previousEnd))
    .map((record) => Number(record.actualHourly));
  const currentAvg = average(currentRates);
  const previousAvg = average(previousRates);
  const change = previousAvg ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
  const changeText = previousAvg ? `环比${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "暂无环比";

  if (!currentRates.length) return "暂无记录";
  return `本周均时薪 ${formatMoney(currentAvg, currencyCode)} · ${changeText}`;
}

function pickMoneyItems(delta, currencyCode = "CNY") {
  const currency = getCurrency(currencyCode);
  const amount = Math.max(delta, currency.coins[currency.coins.length - 1] || 0.1);
  const pool = amount >= Math.min(...currency.notes) ? currency.notes : currency.coins;
  const ordered = pool.slice().sort((a, b) => b - a);
  const picked = [];
  let rest = amount;

  for (const value of ordered) {
    if (picked.length >= 5) break;
    if (value <= rest) {
      picked.push(value);
      rest -= value;
    }
  }

  return picked.length ? picked : [ordered[ordered.length - 1]];
}

module.exports = {
  CONFIG_VERSION,
  STORAGE_KEYS,
  buildHistoryBars,
  buildHistoryInsight,
  buildSlackRecord,
  buildWorkRecord,
  calculateMonthlyTax,
  calculateSnapshot,
  currencies,
  currencyList,
  defaultConfig,
  formatDuration,
  formatMoney,
  getCurrency,
  getDateKey,
  getMonthKey,
  getTodaySeconds,
  getWeekStart,
  normalizeConfig,
  parseTimeToSeconds,
  pickMoneyItems,
  removeRecordForDate,
  sanitizeMoney,
  summarizeSlackRecords,
  upsertByDate,
  validateConfig
};
