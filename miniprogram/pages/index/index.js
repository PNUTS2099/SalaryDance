const {
  CONFIG_VERSION,
  STORAGE_KEYS,
  buildHistoryBars,
  buildHistoryInsight,
  buildSlackRecord,
  buildWorkRecord,
  calculateSnapshot,
  currencyList,
  defaultConfig,
  formatDuration,
  formatMoney,
  getCurrency,
  normalizeConfig,
  getTodaySeconds,
  parseTimeToSeconds,
  pickMoneyItems,
  removeRecordForDate,
  sanitizeMoney,
  summarizeSlackRecords,
  upsertByDate,
  validateConfig
} = require("../../utils/core");

Page({
  data: {
    hasConfig: false,
    editing: false,
    config: { ...defaultConfig },
    history: [],
    slackRecords: [],
    activeSlack: null,
    showPerSecond: false,
    showCurrencySheet: false,
    formError: "",
    currencyList,
    currencyIndex: 0,
    moneyItems: [],
    display: {
      amountLabel: "今日已赚",
      earnedAmount: "¥0.00",
      currencyBadge: "CNY ¥",
      statusText: "未开始",
      statusClass: "status-muted",
      workedTime: "已工作 0 分钟",
      remainingTime: "距上班 0 分钟",
      progressPercent: 0,
      dailyLabel: "日薪",
      hourlyLabel: "时薪",
      minuteLabel: "分钟薪",
      secondLabel: "秒薪",
      dailyPay: "¥0.00",
      hourlyPay: "¥0.00",
      minutePay: "¥0.00",
      secondPay: "¥0.0000",
      monthlyTax: "¥0.00",
      netSalary: "¥0.00",
      insightSummary: "暂无记录",
      slackLive: "未计时",
      slackToday: "¥0.00",
      slackWeek: "¥0.00",
      slackMonth: "¥0.00",
      slackBreakdown: "拉屎 ¥0.00 · 摸鱼 ¥0.00",
      poopButton: "蹲坑回血",
      slackButton: "开始摸鱼",
      canEndEarly: false,
      canResumeToday: false,
      canUseSlack: false,
      slackPanelClass: "",
      poopActive: false,
      slackActive: false,
      canPoopButton: false,
      canSlackButton: false
    },
    historyBars: []
  },

  onLoad() {
    this.loadLocalState();
    this.refreshHome();
    this.timer = setInterval(() => this.refreshHome(), 500);
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  onHide() {
    this.persistActiveSlack();
  },

  loadLocalState() {
    const config = normalizeConfig(wx.getStorageSync(STORAGE_KEYS.config) || defaultConfig);
    const history = wx.getStorageSync(STORAGE_KEYS.history);
    const slackRecords = wx.getStorageSync(STORAGE_KEYS.slack);
    const error = validateConfig(config);

    this.setData({
      config,
      hasConfig: !error,
      history: Array.isArray(history) ? history : [],
      slackRecords: Array.isArray(slackRecords) ? slackRecords : [],
      currencyIndex: this.getCurrencyIndex(config.currency)
    });
  },

  persistActiveSlack() {
    if (!this.data.activeSlack) return;
    this.finishSlackTimer();
  },

  getCurrencyIndex(code) {
    const index = currencyList.findIndex((item) => item.code === code);
    return index >= 0 ? index : 0;
  },

  getSnapshot(now = new Date()) {
    return calculateSnapshot(this.data.config, this.data.history, now);
  },

  saveConfig(config) {
    const payload = {
      ...config,
      configVersion: CONFIG_VERSION,
      updatedAt: new Date().toISOString()
    };
    wx.setStorageSync(STORAGE_KEYS.config, payload);
  },

  saveHistory(history) {
    wx.setStorageSync(STORAGE_KEYS.history, history.slice(-60));
  },

  saveSlackRecords(slackRecords) {
    wx.setStorageSync(STORAGE_KEYS.slack, slackRecords.slice(-300));
  },

  updateConfigField(field, value) {
    const config = { ...this.data.config, [field]: value };
    this.setData({
      config,
      currencyIndex: this.getCurrencyIndex(config.currency),
      formError: ""
    });
  },

  onMoneyInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = sanitizeMoney(event.detail.value);
    this.updateConfigField(field, value);
    return value;
  },

  onNumberInput(event) {
    const field = event.currentTarget.dataset.field;
    this.updateConfigField(field, event.detail.value);
  },

  onCurrencyChange(event) {
    const index = Number(event.detail.value);
    const currency = currencyList[index] || currencyList[0];
    this.updateConfigField("currency", currency.code);
  },

  onTaxSwitch(event) {
    this.updateConfigField("taxEnabled", event.detail.value);
  },

  onStart() {
    const config = normalizeConfig(this.data.config);
    const error = validateConfig(config);

    if (error) {
      this.setData({ formError: error });
      return;
    }

    this.saveConfig(config);
    this.setData({
      config,
      hasConfig: true,
      editing: false,
      formError: ""
    }, () => this.refreshHome());
  },

  onEdit() {
    this.setData({ editing: true, formError: "" });
  },

  onCancelEdit() {
    const config = normalizeConfig(wx.getStorageSync(STORAGE_KEYS.config) || this.data.config);
    this.setData({
      config,
      editing: false,
      formError: "",
      currencyIndex: this.getCurrencyIndex(config.currency)
    }, () => this.refreshHome());
  },

  onReset() {
    wx.showModal({
      title: "重置设置",
      content: "确认清空工资、工时和本地记录？",
      confirmColor: "#19a15f",
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(STORAGE_KEYS.config);
        wx.removeStorageSync(STORAGE_KEYS.history);
        wx.removeStorageSync(STORAGE_KEYS.slack);
        this.setData({
          hasConfig: false,
          editing: false,
          config: { ...defaultConfig },
          history: [],
          slackRecords: [],
          activeSlack: null,
          showPerSecond: false,
          formError: "",
          currencyIndex: this.getCurrencyIndex(defaultConfig.currency)
        });
      }
    });
  },

  onTogglePerSecond() {
    this.setData({ showPerSecond: !this.data.showPerSecond }, () => this.refreshHome());
  },

  onOpenCurrencySheet() {
    this.setData({ showCurrencySheet: true });
  },

  onCloseCurrencySheet() {
    this.setData({ showCurrencySheet: false });
  },

  onPickCurrency(event) {
    const code = event.currentTarget.dataset.code;
    const config = { ...this.data.config, currency: code };
    this.saveConfig(config);
    this.setData({
      config,
      showCurrencySheet: false,
      currencyIndex: this.getCurrencyIndex(code)
    }, () => this.refreshHome(true));
  },

  noop() {},

  refreshHome(forceAnimation = false) {
    if (!this.data.hasConfig || this.data.editing) return;

    const now = new Date();
    let history = this.data.history;
    let snapshot = calculateSnapshot(this.data.config, history, now);

    if (snapshot.status === "after" && !snapshot.hasEndedToday) {
      const record = buildWorkRecord(this.data.config, { ...snapshot, workedSeconds: snapshot.totalSeconds }, "scheduled", now);
      history = upsertByDate(history, record);
      this.saveHistory(history);
      snapshot = calculateSnapshot(this.data.config, history, now);
    }

    const currency = getCurrency(this.data.config.currency);
    const endedSecond = snapshot.hasEndedToday && snapshot.todayRecord
      ? snapshot.todayRecord.actualHourly / 3600
      : snapshot.second;
    const amountToShow = this.data.showPerSecond ? endedSecond : snapshot.earned;
    const amountDecimals = this.data.showPerSecond
      ? (currency.decimals === 0 ? 2 : 4)
      : currency.decimals;
    const status = this.buildStatusDisplay(snapshot);
    const slack = this.buildSlackDisplay(snapshot, now);
    const historyBars = buildHistoryBars(history, now);

    this.setData({
      history,
      historyBars,
      display: {
        ...this.data.display,
        amountLabel: snapshot.taxEnabled
          ? (this.data.showPerSecond ? "税后每秒收入" : "今日税后已赚")
          : (this.data.showPerSecond ? "每秒收入" : "今日已赚"),
        earnedAmount: formatMoney(amountToShow, currency.code, { decimals: amountDecimals }),
        currencyBadge: `${currency.code} ${currency.symbol}`,
        statusText: status.text,
        statusClass: status.className,
        workedTime: status.workedTime,
        remainingTime: status.remainingTime,
        progressPercent: Math.round(snapshot.progress * 100),
        dailyLabel: snapshot.taxEnabled ? "税后日薪" : "日薪",
        hourlyLabel: snapshot.hasEndedToday ? "今日实际时薪" : (snapshot.taxEnabled ? "税后时薪" : "时薪"),
        minuteLabel: snapshot.hasEndedToday ? "实际分钟薪" : (snapshot.taxEnabled ? "税后分钟薪" : "分钟薪"),
        secondLabel: snapshot.hasEndedToday ? "实际秒薪" : (snapshot.taxEnabled ? "税后秒薪" : "秒薪"),
        dailyPay: formatMoney(snapshot.daily, currency.code),
        hourlyPay: formatMoney(snapshot.hasEndedToday && snapshot.todayRecord ? snapshot.todayRecord.actualHourly : snapshot.hourly, currency.code),
        minutePay: formatMoney((snapshot.hasEndedToday && snapshot.todayRecord ? snapshot.todayRecord.actualHourly : snapshot.hourly) / 60, currency.code),
        secondPay: formatMoney((snapshot.hasEndedToday && snapshot.todayRecord ? snapshot.todayRecord.actualHourly : snapshot.hourly) / 3600, currency.code, { decimals: currency.decimals === 0 ? 2 : 4 }),
        monthlyTax: formatMoney(snapshot.monthlyTax, currency.code),
        netSalary: formatMoney(snapshot.netSalary, currency.code),
        insightSummary: buildHistoryInsight(history, now, currency.code),
        slackLive: slack.live,
        slackToday: slack.today,
        slackWeek: slack.week,
        slackMonth: slack.month,
        slackBreakdown: slack.breakdown,
        poopButton: this.data.activeSlack && this.data.activeSlack.type === "poop" ? "带薪归来" : "蹲坑回血",
        slackButton: this.data.activeSlack && this.data.activeSlack.type === "slack" ? "收网回工位" : "开始摸鱼",
        canEndEarly: snapshot.status === "working",
        canResumeToday: snapshot.hasEndedToday,
        canUseSlack: snapshot.status === "working" || Boolean(this.data.activeSlack),
        slackPanelClass: this.data.activeSlack ? `active-${this.data.activeSlack.type}` : "",
        poopActive: Boolean(this.data.activeSlack && this.data.activeSlack.type === "poop"),
        slackActive: Boolean(this.data.activeSlack && this.data.activeSlack.type === "slack"),
        canPoopButton: snapshot.status === "working" || Boolean(this.data.activeSlack && this.data.activeSlack.type === "poop"),
        canSlackButton: snapshot.status === "working" || Boolean(this.data.activeSlack && this.data.activeSlack.type === "slack")
      }
    });

    if (snapshot.status === "working" || forceAnimation) {
      this.animateMoney(snapshot);
    }
  },

  buildStatusDisplay(snapshot) {
    if (snapshot.status === "before") {
      const start = parseTimeToSeconds(this.data.config.startTime);
      const current = getTodaySeconds();
      return {
        text: "未开始",
        className: "status-muted",
        workedTime: "已工作 0 分钟",
        remainingTime: `距上班 ${formatDuration(start - current)}`
      };
    }

    if (snapshot.status === "early") {
      return {
        text: "已提前下班",
        className: "status-good",
        workedTime: `今日工时 ${formatDuration(snapshot.workedSeconds)}`,
        remainingTime: `实际时薪 ${formatMoney(snapshot.todayRecord.actualHourly, this.data.config.currency)}`
      };
    }

    if (snapshot.status === "after") {
      return {
        text: "已下班",
        className: "status-warm",
        workedTime: snapshot.hasEndedToday ? `今日工时 ${formatDuration(snapshot.workedSeconds)}` : "今日已赚完",
        remainingTime: snapshot.hasEndedToday ? `实际时薪 ${formatMoney(snapshot.todayRecord.actualHourly, this.data.config.currency)}` : "明天继续到账"
      };
    }

    return {
      text: "工作中",
      className: "status-good",
      workedTime: `已工作 ${formatDuration(snapshot.workedSeconds)}`,
      remainingTime: `距下班 ${formatDuration(snapshot.remainingSeconds)}`
    };
  },

  buildSlackDisplay(snapshot, now) {
    const currency = this.data.config.currency;
    const summary = summarizeSlackRecords(this.data.slackRecords, now);
    let live = snapshot.status === "working" ? "小鱼待命" : "工作中才可开溜";

    if (this.data.activeSlack) {
      const elapsed = Math.max(0, Math.floor((Date.now() - this.data.activeSlack.startedAt) / 1000));
      const income = elapsed * this.data.activeSlack.secondIncome;
      const name = this.data.activeSlack.type === "poop" ? "拉屎" : "摸鱼";
      live = `${name}回血中 ${formatDuration(elapsed)} · ${formatMoney(income, currency)}`;
    }

    return {
      live,
      today: formatMoney(summary.todayIncome, currency),
      week: formatMoney(summary.weekIncome, currency),
      month: formatMoney(summary.monthIncome, currency),
      breakdown: `拉屎 ${formatMoney(summary.poopIncome, currency)} · 摸鱼 ${formatMoney(summary.slackIncome, currency)} · ${formatDuration(summary.todaySeconds)}`
    };
  },

  onEndTodayEarly() {
    const snapshot = this.getSnapshot();
    if (snapshot.status !== "working") return;

    if (this.data.activeSlack) this.finishSlackTimer();

    const record = buildWorkRecord(this.data.config, snapshot, "early");
    const history = upsertByDate(this.data.history, record);
    this.saveHistory(history);
    this.setData({ history }, () => this.refreshHome(true));
  },

  onResumeToday() {
    const history = removeRecordForDate(this.data.history);
    this.saveHistory(history);
    this.setData({ history }, () => this.refreshHome());
  },

  onToggleSlack(event) {
    const type = event.currentTarget.dataset.type;
    if (this.data.activeSlack && this.data.activeSlack.type === type) {
      this.finishSlackTimer();
      return;
    }

    if (this.data.activeSlack) this.finishSlackTimer();
    this.startSlackTimer(type);
  },

  startSlackTimer(type) {
    const snapshot = this.getSnapshot();
    if (snapshot.status !== "working") return;

    this.setData({
      activeSlack: {
        type,
        startedAt: Date.now(),
        secondIncome: snapshot.second
      }
    }, () => this.refreshHome());
  },

  finishSlackTimer() {
    const record = buildSlackRecord(this.data.activeSlack, this.data.config);
    if (!record) return;

    const slackRecords = this.data.slackRecords.concat(record).slice(-300);
    this.saveSlackRecords(slackRecords);
    this.setData({
      slackRecords,
      activeSlack: null
    }, () => this.refreshHome(true));
  },

  animateMoney(snapshot) {
    const now = Date.now();
    if (!this.lastAnimationAt) this.lastAnimationAt = 0;
    if (now - this.lastAnimationAt < 900) return;

    const items = pickMoneyItems(Math.max(snapshot.second * 120, 1), this.data.config.currency);
    const nextItems = items.map((value, index) => ({
      id: `${now}-${index}`,
      label: String(value),
      className: value < 1 ? "money coin" : "money note",
      style: `left:${74 + Math.random() * 140}rpx; animation-delay:${index * 80}ms;`
    }));

    this.lastAnimationAt = now;
    this.setData({ moneyItems: this.data.moneyItems.concat(nextItems).slice(-12) });
    setTimeout(() => {
      const ids = nextItems.map((item) => item.id);
      this.setData({
        moneyItems: this.data.moneyItems.filter((item) => ids.indexOf(item.id) < 0)
      });
    }, 1600);
  }
});
