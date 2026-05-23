const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateMonthlyTax,
  calculateSnapshot,
  defaultConfig,
  formatDuration,
  formatMoney,
  getDateKey,
  getWeekStart,
  sanitizeMoney,
  summarizeSlackRecords,
  validateConfig
} = require("../miniprogram/utils/core");

test("sanitizeMoney keeps digits and two decimal places", () => {
  assert.equal(sanitizeMoney("¥12,345.678x"), "12345.67");
  assert.equal(sanitizeMoney("abc"), "");
});

test("calculateMonthlyTax follows monthly individual income tax brackets", () => {
  const result = calculateMonthlyTax(20000, 2000, 1000);
  assert.equal(result.taxableIncome, 12000);
  assert.equal(result.monthlyTax, 990);
  assert.equal(result.netSalary, 17010);
  assert.equal(result.rate, 0.1);
});

test("calculateSnapshot reports working progress and earned salary", () => {
  const config = {
    ...defaultConfig,
    monthlySalary: "22000",
    workDaysPerMonth: 22,
    startTime: "09:00",
    endTime: "18:00"
  };
  const now = new Date("2026-05-23T13:30:00+08:00");
  const snapshot = calculateSnapshot(config, [], now);

  assert.equal(snapshot.status, "working");
  assert.equal(snapshot.workedSeconds, 16200);
  assert.equal(snapshot.totalSeconds, 32400);
  assert.equal(snapshot.daily, 1000);
  assert.equal(Number(snapshot.earned.toFixed(2)), 500);
  assert.equal(snapshot.progress, 0.5);
});

test("calculateSnapshot respects an early-end history record", () => {
  const config = {
    ...defaultConfig,
    monthlySalary: "22000",
    workDaysPerMonth: 22,
    startTime: "09:00",
    endTime: "18:00"
  };
  const now = new Date("2026-05-23T15:00:00+08:00");
  const history = [{
    date: getDateKey(now),
    mode: "early",
    workSeconds: 7200,
    actualHourly: 500
  }];
  const snapshot = calculateSnapshot(config, history, now);

  assert.equal(snapshot.status, "early");
  assert.equal(snapshot.hasEndedToday, true);
  assert.equal(snapshot.workedSeconds, 7200);
  assert.equal(snapshot.earned, 1000);
});

test("validateConfig rejects impossible setup values", () => {
  assert.equal(validateConfig({ ...defaultConfig, monthlySalary: "0" }), "请输入大于 0 的月薪");
  assert.equal(validateConfig({ ...defaultConfig, monthlySalary: "10000", startTime: "18:00", endTime: "09:00" }), "下班时间需要晚于上班时间");
});

test("summarizeSlackRecords groups today, week, month, and type income", () => {
  const now = new Date("2026-05-23T12:00:00+08:00");
  const records = [
    { date: getDateKey(now), weekStart: getWeekStart(now), month: "2026-05", type: "poop", seconds: 60, income: 2 },
    { date: getDateKey(now), weekStart: getWeekStart(now), month: "2026-05", type: "slack", seconds: 120, income: 4 },
    { date: "2026-05-20", weekStart: getWeekStart(now), month: "2026-05", type: "slack", seconds: 30, income: 1 }
  ];

  const summary = summarizeSlackRecords(records, now);
  assert.equal(summary.todayIncome, 6);
  assert.equal(summary.weekIncome, 7);
  assert.equal(summary.monthIncome, 7);
  assert.equal(summary.poopIncome, 2);
  assert.equal(summary.slackIncome, 4);
  assert.equal(summary.todaySeconds, 180);
});

test("formatters match the app display language", () => {
  assert.equal(formatMoney(12.3, "CNY"), "¥12.30");
  assert.equal(formatMoney(12.3456, "USD", { decimals: 3 }), "$12.346");
  assert.equal(formatDuration(3661), "1 小时 1 分钟");
});
