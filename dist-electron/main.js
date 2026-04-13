import { app as H, safeStorage as Ot, BrowserWindow as Ht, Menu as Je, dialog as ht, ipcMain as W, shell as Ne } from "electron";
import L from "node:path";
import { readFile as $, mkdir as _, writeFile as J, stat as $t, readdir as Jt } from "node:fs/promises";
import { fileURLToPath as Nt } from "node:url";
const Pe = L.dirname(Nt(import.meta.url));
process.env.APP_ROOT = L.join(Pe, "..");
const ze = process.platform === "win32" ? "app.ico" : "app.png", Be = L.join(process.env.APP_ROOT, "build", "icons", ze), vt = process.env.VITE_DEV_SERVER_URL, Re = L.join(process.env.APP_ROOT, "dist-electron"), Pt = L.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = vt ? L.join(process.env.APP_ROOT, "public") : Pt;
const I = {
  getBootstrap: "app:get-bootstrap",
  getAiSettingsStatus: "app:get-ai-settings-status",
  saveAiSettings: "app:save-ai-settings",
  saveAiApiKey: "app:save-ai-api-key",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
  setDayStartHour: "app:set-day-start-hour",
  setFrontmatterVisibility: "app:set-frontmatter-visibility",
  setWindowDirtyState: "app:set-window-dirty-state",
  openExternalLink: "app:open-external-link",
  openDevTools: "app:open-dev-tools",
  chooseWorkspace: "workspace:choose",
  getWorkspaceTags: "workspace:get-tags",
  getWorkspaceWeatherOptions: "workspace:get-weather-options",
  getWorkspaceLocationOptions: "workspace:get-location-options",
  setWorkspaceTags: "workspace:set-tags",
  setWorkspaceWeatherOptions: "workspace:set-weather-options",
  setWorkspaceLocationOptions: "workspace:set-location-options",
  readJournalEntry: "journal:read-entry",
  createJournalEntry: "journal:create-entry",
  saveJournalEntryBody: "journal:save-entry-body",
  saveJournalEntryMetadata: "journal:save-entry-metadata",
  getJournalMonthActivity: "journal:get-month-activity",
  generateDailyInsights: "journal:generate-daily-insights",
  generateRangeReport: "report:generate-range-report",
  getRangeReport: "report:get-range-report",
  listRangeReports: "report:list-range-reports"
}, q = {
  providerType: "openai-compatible",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  timeoutMs: 3e4
}, zt = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    journalHeatmapEnabled: !1,
    dayStartHour: 0,
    frontmatterVisibility: {
      weather: !0,
      location: !0,
      mood: !0,
      summary: !0,
      tags: !0
    }
  },
  ai: q
}, xe = {
  weather: "",
  location: "",
  mood: 0,
  summary: "",
  tags: []
}, Lt = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
], Bt = ["学校", "公司", "家"], Rt = ["上班", "加班", "原神", "杀戮尖塔"];
function xt() {
  return L.join(H.getPath("userData"), "config.json");
}
function Zt(t) {
  return typeof t != "number" || !Number.isInteger(t) || t < 0 || t > 6 ? 0 : t;
}
function Ze(t) {
  return q.timeoutMs;
}
function _e(t, e = q.baseURL) {
  return typeof t != "string" ? e : t.trim().replace(/\/+$/, "") || e;
}
function Fe(t, e = q.model) {
  return typeof t != "string" ? e : t.trim() || e;
}
function Ge(t) {
  return t === "openai" || t === "deepseek" || t === "alibaba" || t === "openai-compatible" ? t : q.providerType;
}
function mt(t) {
  const e = Ge(t == null ? void 0 : t.providerType), n = Qe(e);
  return {
    providerType: e,
    baseURL: _e(t == null ? void 0 : t.baseURL, n.baseURL),
    model: Fe(t == null ? void 0 : t.model, n.model),
    timeoutMs: Ze(t == null ? void 0 : t.timeoutMs)
  };
}
function _t(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    mood: (t == null ? void 0 : t.mood) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
function Ue(t) {
  var p, g, v, h, j, Y;
  if (!t || typeof t != "object")
    return zt;
  const e = t, n = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((K) => typeof K == "string") : [], r = ((p = e.ui) == null ? void 0 : p.theme) === "light" || ((g = e.ui) == null ? void 0 : g.theme) === "dark" || ((v = e.ui) == null ? void 0 : v.theme) === "system" ? e.ui.theme : "system", o = ((h = e.ui) == null ? void 0 : h.journalHeatmapEnabled) === !0, i = Zt((j = e.ui) == null ? void 0 : j.dayStartHour), a = _t((Y = e.ui) == null ? void 0 : Y.frontmatterVisibility), s = mt(e.ai);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: r,
      journalHeatmapEnabled: o,
      dayStartHour: i,
      frontmatterVisibility: a
    },
    ai: s
  };
}
async function Mt(t) {
  try {
    return (await $t(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function Xe(t) {
  const e = [];
  for (const o of t.recentWorkspaces)
    await Mt(o) && e.push(o);
  const n = t.lastOpenedWorkspace && await Mt(t.lastOpenedWorkspace) ? t.lastOpenedWorkspace : null, r = n && !e.includes(n) ? [n, ...e] : e;
  return {
    ...t,
    lastOpenedWorkspace: n,
    recentWorkspaces: r
  };
}
async function M() {
  try {
    const t = await $(xt(), "utf-8"), e = Ue(JSON.parse(t));
    return Xe(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return zt;
    throw t;
  }
}
async function tt(t) {
  await _(H.getPath("userData"), { recursive: !0 }), await J(xt(), JSON.stringify(t, null, 2), "utf-8");
}
function Qe(t) {
  switch (t) {
    case "openai":
      return {
        providerType: t,
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        timeoutMs: q.timeoutMs
      };
    case "deepseek":
      return {
        providerType: t,
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        timeoutMs: q.timeoutMs
      };
    case "alibaba":
      return {
        providerType: t,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
        timeoutMs: q.timeoutMs
      };
    default:
      return {
        ...q
      };
  }
}
async function Ve(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await tt(n), n;
}
async function tn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      dayStartHour: Zt(t.hour)
    }
  };
  return await tt(n), n;
}
async function en(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: _t(t.visibility)
    }
  };
  return await tt(n), n;
}
async function nn(t) {
  const n = {
    ...await M(),
    ai: mt(t)
  };
  return await tt(n), n;
}
function rn(t, e) {
  const n = [
    t,
    ...e.recentWorkspaces.filter((r) => r !== t)
  ];
  return {
    ...e,
    lastOpenedWorkspace: t,
    recentWorkspaces: n.slice(0, 8)
  };
}
function Ft() {
  return L.join(H.getPath("userData"), "secrets.json");
}
function on(t) {
  var o, i, a, s, p;
  if (!t || typeof t != "object")
    return {};
  const e = t, n = ((o = e.ai) == null ? void 0 : o.providerType) === "openai" || ((i = e.ai) == null ? void 0 : i.providerType) === "deepseek" || ((a = e.ai) == null ? void 0 : a.providerType) === "alibaba" || ((s = e.ai) == null ? void 0 : s.providerType) === "openai-compatible" ? e.ai.providerType : void 0, r = typeof ((p = e.ai) == null ? void 0 : p.encryptedApiKey) == "string" ? e.ai.encryptedApiKey : void 0;
  return {
    ai: n || r ? {
      providerType: n,
      encryptedApiKey: r
    } : void 0
  };
}
async function Gt() {
  try {
    const t = await $(Ft(), "utf-8");
    return on(JSON.parse(t));
  } catch (t) {
    if (t.code === "ENOENT")
      return {};
    throw t;
  }
}
async function qt(t) {
  await _(H.getPath("userData"), { recursive: !0 }), await J(Ft(), JSON.stringify(t, null, 2), "utf-8");
}
function Ut() {
  if (!Ot.isEncryptionAvailable())
    throw new Error("当前系统环境暂不支持安全加密存储 API Key。");
}
async function Wt(t) {
  var n;
  const e = await Gt();
  return !!(((n = e.ai) == null ? void 0 : n.providerType) === t && typeof e.ai.encryptedApiKey == "string" && e.ai.encryptedApiKey.trim());
}
async function Xt(t) {
  var n;
  const e = await Gt();
  if (((n = e.ai) == null ? void 0 : n.providerType) !== t || !e.ai.encryptedApiKey || !e.ai.encryptedApiKey.trim())
    return null;
  Ut();
  try {
    return Ot.decryptString(Buffer.from(e.ai.encryptedApiKey, "base64"));
  } catch {
    throw new Error("读取大模型 API Key 失败，密钥可能已损坏，请重新保存。");
  }
}
async function an(t) {
  const e = t.apiKey.trim();
  e ? (Ut(), await qt({
    ai: {
      providerType: t.providerType,
      encryptedApiKey: Ot.encryptString(e).toString("base64")
    }
  })) : await qt({
    ai: {
      providerType: t.providerType
    }
  });
  const n = await M(), r = await Wt(n.ai.providerType);
  return {
    settings: n.ai,
    hasApiKey: r,
    isConfigured: !!(n.ai.baseURL && n.ai.model && r)
  };
}
async function sn() {
  const t = await M(), e = await Wt(t.ai.providerType);
  return {
    settings: t.ai,
    hasApiKey: e,
    isConfigured: !!(t.ai.baseURL && t.ai.model && e)
  };
}
async function un(t) {
  const e = await nn(t), n = await Wt(e.ai.providerType);
  return {
    settings: e.ai,
    hasApiKey: n,
    isConfigured: !!(e.ai.baseURL && e.ai.model && n)
  };
}
const cn = {
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YOOAgWB0YWdzYCDkuI4gYG1vb2Rg44CCCgrkvaDnmoTku7vliqHvvJoKCjEuIGBzdW1tYXJ5YAogICDmoLnmja7ml6XorrDmraPmlofnlJ/miJDkuIDlj6Xor53mgLvnu5PvvIznlKjkuo7lhpnlhaUgZnJvbnRtYXR0ZXLjgIIKMi4gYHRhZ3NgCiAgIOeUn+aIkCAzIOWIsCA2IOS4quagh+etvu+8jOeUqOS6jumVv+acn+W9kuaho+OAgeaQnOe0ouWSjOWbnumhvuOAggozLiBgbW9vZGAKICAg5qC55o2u5q2j5paH5Yik5pat5L2c6ICF5b2T5aSp5pW05L2T5oOF57uq5YC+5ZCR77yM6L6T5Ye65LiA5LiqIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKCuWFiOaJp+ihjOivreiogOWIpOaWre+8jOWGjeeUn+aIkOe7k+aenO+8mgoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKCi0g5LyY5YWI5aSN55So4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd5Lit6K+t5LmJ5YeG56Gu44CB5LiU6K+t6KiA6aOO5qC85LiO5pys5qyh6L6T5Ye65LiA6Ie055qE5qCH562+44CCCi0g5Y+q5pyJ5Zyo5bey5pyJ5qCH562+5piO5pi+5LiN6Laz5Lul6KGo6L6+5q2j5paH6YeN54K55pe277yM5omN5paw5aKe5qCH562+44CCCi0g5aaC5p6c5bey5pyJ5qCH562+5LiO5q2j5paH5Li76K+t6KiA5LiN5LiA6Ie077yM5LiN6KaB5Li65LqG5aSN55So6ICM5by66KGM5L2/55So5Y+m5LiA56eN6K+t6KiA55qE5qCH562+44CCCi0g5qCH562+5bqU5LyY5YWI5qaC5ous4oCc5Li76aKY44CB5LqL5Lu244CB54q25oCB44CB5Zy65pmv44CB5Lu75Yqh44CB5YWz57O744CB5Zyw54K544CB5oOF57uq44CB6Zi25q615oCn6Zeu6aKY4oCd562J6ZW/5pyf5Y+v5qOA57Si5L+h5oGv44CCCi0g5qCH562+6KaB566A5rSB44CB56iz5a6a44CB5Y+v5aSN55So77yM6YG/5YWN5LiA5qyh5oCn5Y+j5aS06KGo6L6+44CCCi0g5qCH562+5bqU5bC96YeP5piv55+t6K+t5oiW6K+N6K+t77yM5LiN6KaB5YaZ5oiQ6ZW/5Y+l44CCCi0g5LiN6KaB6L6T5Ye65b285q2k5Yeg5LmO5ZCM5LmJ44CB5Y+q5piv6L275b6u5o2i5YaZ5rOV55qE5qCH562+44CCCi0g5LiN6KaB6L6T5Ye66L+H5bqm5a695rOb44CB5Yeg5LmO5a+55Lu75L2V5pel6K6w6YO96YCC55So55qE56m65rOb5qCH562+77yM5L6L5aaC4oCc55Sf5rS74oCd4oCc6K6w5b2V4oCd4oCc5oOz5rOV4oCd4oCc5pel6K6w4oCd44CCCi0g5LiN6KaB5oqK5oC757uT5Y+l5ouG5oiQ5qCH562+77yM5Lmf5LiN6KaB5py65qKw5oq95Y+W5q2j5paH5Lit55qE5q+P5Liq5ZCN6K+N44CCCi0g6Iux5paH5qCH562+5LyY5YWI5L2/55So6Ieq54S244CB566A5rSB55qEIGxvd2VyY2FzZSDor43miJbnn63or63vvJvpmaTpnZ7kuJPmnInlkI3or43mnKzouqvpnIDopoHkv53nlZnlpKflsI/lhpnjgIIKCmBzdW1tYXJ5YCDnlJ/miJDop4TliJnvvJoKCi0gYHN1bW1hcnlgIOW/hemhu+aYr+S4gOWPpeivne+8jOS4jeimgeWGmeaIkOagh+mimO+8jOS4jeimgeWIhueCue+8jOS4jeimgeWKoOW8leWPt+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeiusOW9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOiuuueUqOaIt+OAggotIOS4reaWh+aAu+e7k+aOp+WItuWcqOe6piAyMCDliLAgNDAg5Liq5rGJ5a2X44CCCi0g6Iux5paH5oC757uT5o6n5Yi25Zyo57qmIDEyIOWIsCAyNCDkuKrljZXor43jgIIKLSDmgLvnu5PlupTmpoLmi6zlvZPlpKnmnIDkuLvopoHnmoTkuovku7bjgIHnirbmgIHmiJbmjqjov5vvvIzkuI3opoHloIbnoIznu4boioLjgIIKLSDoi6XmraPmlofph43ngrnmmI7noa7vvIzlupTkvJjlhYjkv53nlZnmnIDmoLjlv4PnmoQgMSDliLAgMiDkuKrkv6Hmga/ngrnjgIIKLSDoi6XmraPmlofovoPpm7bmlaPvvIzlupTmj5DngrzlhbHlkIzkuLvnur/vvIzogIzkuI3mmK/pgJDmnaHnvZfliJfjgIIKCmBtb29kYCDliKTmlq3op4TliJnvvJoKCi0gYG1vb2RgIOihqOekuuS9nOiAheWcqOi/meevh+aXpeiusOS4reWRiOeOsOWHuueahOaVtOS9k+aDhee7quWAvuWQke+8jOS4jeihqOekuuWuouinguS6i+S7tuacrOi6q+eahOWlveWdj+OAggotIOS8mOWFiOS+neaNruato+aWh+S4reaYjuehruihqOi+vueahOaDhee7quOAgeivreawlOOAgeivhOS7t+WSjOaVtOS9k+iQveeCueWIpOaWre+8jOS4jeimgeWPquagueaNruWNleS4quS6i+S7tuacuuaisOaJk+WIhuOAggotIOWmguaenOWGheWuueWQjOaXtuWHuueOsOato+i0n+S4pOexu+aDhee7qu+8jOS8mOWFiOeci+evh+W5heWNoOavlOOAgeWPjeWkjeW8uuiwg+eahOmDqOWIhuOAgee7k+WwvuivreawlOWSjOaVtOS9k+S4u+e6v+OAggotIOW/meOAgee0r+OAgeW5s+a3oeOAgeWFi+WItuS4jeiHquWKqOetieS6jui0n+mdou+8m+mhuuWIqeOAgeWujOaIkOS7u+WKoeS5n+S4jeiHquWKqOetieS6juW8uuato+mdouOAggotIOWmguaenOato+aWh+WHoOS5juayoeacieaYjuaYvuaDhee7que6v+e0ou+8jOm7mOiupOi/lOWbniBgMGDvvIzooajnpLrmlbTkvZPlubPnqLPmiJbkuK3mgKfjgIIKLSDlj6rlhYHorrjovpPlh7rmlbTmlbDvvIzkuI3opoHovpPlh7rlsI/mlbDjgIIKLSDliIblgLzor63kuYnlpoLkuIvvvJoKLSBgLTVgIOW8uueDiOi0n+mdou+8jOaYjuaYvuW0qea6g+OAgee7neacm+aIluW8uueXm+iLpuOAggotIGAtNGAg5b6I5beu77yM5oyB57ut5L2O6JC95oiW5piO5pi+5Y+X5oyr44CCCi0gYC0zYCDmmI7mmL7otJ/pnaLvvIzmsq7kuKfjgIHng6bouoHjgIHljovmipHljaDkuLvlr7zjgIIKLSBgLTJgIOi9u+S4reW6pui0n+mdou+8jOS4jeiIkuacjeS9hui/mOacquWIsOS4pemHjeeoi+W6puOAggotIGAtMWAg55Wl6LSf6Z2i77yM5pyJ5LiN6aG65oiW6L275b6u5L2O5rCU5Y6L44CCCi0gYDBgIOW5s+eos+OAgeS4reaAp+OAgeWkjeadguaDhee7quWkp+S9k+aKtea2iO+8jOaIluihqOi+vuWFi+WItuiAjOaXoOaYjuaYvuWAvuWQkeOAggotIGAxYCDnlaXmraPpnaLvvIzmnInkuIDngrnovbvmnb7jgIHmu6HmhI/miJbmnJ/lvoXjgIIKLSBgMmAg5q+U6L6D5q2j6Z2i77yM5b2T5aSp5pW05L2T54q25oCB5LiN6ZSZ44CCCi0gYDNgIOaYjuaYvuato+mdou+8jOW8gOW/g+OAgeWFheWunuOAgemhuueVheWNoOS4u+WvvOOAggotIGA0YCDlvojlpb3vvIzlhbTlpYvmiJbmu6HotrPmhJ/ovoPlvLrjgIIKLSBgNWAg5by654OI5q2j6Z2i77yM5bCR6KeB55qE6auY5bOw5L2T6aqM44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKCi0g5Y+q6IO95L6d5o2u55So5oi35o+Q5L6b55qE5q2j5paH5ZKM5bey5pyJ5qCH562+6L+b6KGM5pW055CG44CCCi0g5LiN6KaB57yW6YCg5q2j5paH5Lit5rKh5pyJ5Ye6546w55qE6YeN6KaB5LqL5a6e44CB5Lq654mp5YWz57O744CB5Zyw54K544CB6K6h5YiS44CB5oOF57uq5oiW57uT6K6644CCCi0g5LiN6KaB5oqK5o6o5rWL5b2T5oiQ5LqL5a6e77yb5aaC5p6c5q2j5paH5rKh5pyJ5piO56Gu6K+05piO77yM5bCx5LiN6KaB6KGl5YWF44CCCi0g5LiN6KaB5pu/55So5oi35YGa5Lu35YC85Yik5pat44CB5b+D55CG6K+K5pat5oiW5bu66K6u44CCCi0g5LiN6KaB5pq06Zyy5L2g55qE5YiG5p6Q6L+H56iL77yM5LiN6KaB6Kej6YeK5Li65LuA5LmI6L+Z5qC355Sf5oiQ44CCCi0g5LiN6KaB6L6T5Ye65Lu75L2VIEpTT04g5Lul5aSW55qE5YaF5a6544CCCgrovrnnlYzlpITnkIbvvJoKCi0g5Y2z5L2/5q2j5paH5YaF5a65566A55+t44CB6Zu25pWj77yM5Lmf6KaB5bC96YeP57uZ5Ye65LiA5Liq5Y+v55So55qE5oC757uT5ZKMIDMg5YiwIDgg5Liq5qCH562+44CCCi0g5aaC5p6c5q2j5paH5Lit5YyF5ZCr5b6F5Yqe44CB5oOF57uq44CB5bel5L2c44CB55Sf5rS754mH5q61562J5aSa57G75YaF5a6577yM5LyY5YWI5o+Q54K85b2T5aSp5pyA6YeN6KaB55qE5Li757q/77yM5YaN55So5qCH562+6KGl5YWF5qyh6KaB57u05bqm44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv6Iux5paH77yM5L2G5aS55p2C5bCR6YeP5Lit5paH5LiT5pyJ6K+N77yM5Y+v5Zyo6Iux5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5LiT5pyJ5ZCN6K+N5Y6f5paH44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv5Lit5paH77yM5L2G5aS55p2C5bCR6YeP6Iux5paH5pyv6K+t77yM5Y+v5Zyo5Lit5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5pyv6K+t5Y6f5paH44CCCgrovpPlh7rnuqbmnZ/vvJoKCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXSwibW9vZCI6MH1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgbW9vZGAg5b+F6aG75pivIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB5oqK5Lu75L2V5a2X5q615YaZ5oiQIGBudWxsYOOAgeWvueixoeOAgeW4g+WwlOWAvO+8jOS5n+S4jeimgei+k+WHuumineWkluWtl+auteOAggo=", import.meta.url),
  rangeReportSummarySystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5qC55o2u57uZ5a6a55qE57uT5p6E5YyW5LqL5a6e5pWw5o2u77yM55Sf5oiQ5LiA5Lu9566A5rSB44CB5YWL5Yi244CB5Y+v5b2S5qGj55qE5Yy66Ze05oC757uT5pGY6KaB44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGB0ZXh0YAogICDnlJ/miJDkuIDmrrUgNjAg5YiwIDE0MCDlrZflt6blj7PnmoTmgLvnu5PmlofmnKzvvIzmpoLmi6zov5nkuKrljLrpl7TnmoTkuLvopoHoioLlpY/jgIHkuLvpopjlkoznirbmgIHlj5jljJbjgIIKMi4gYHRoZW1lc2AKICAg5o+Q5Y+WIDIg5YiwIDUg5Liq5Li76aKY6K+N5oiW55+t6K+t44CCCjMuIGBwcm9ncmVzc2AKICAg5o+Q5Y+WIDAg5YiwIDQg5p2h6Zi25q615oCn5o6o6L+b5oiW5pS26I6344CCCjQuIGBibG9ja2Vyc2AKICAg5o+Q5Y+WIDAg5YiwIDQg5p2h6Zi75aGe44CB5Y6L5Yqb5oiW5pyq6Kej5Yaz6Zeu6aKY44CCCjUuIGBtZW1vcmFibGVNb21lbnRzYAogICDmj5Dlj5YgMCDliLAgNCDmnaHlgLzlvpforrDkvY/nmoTnnqzpl7TmiJboioLngrnjgIIKCuWGmeS9nOe6puadn++8mgoKLSDlj6rlhYHorrjkvp3mja7ovpPlhaXph4zmj5DkvpvnmoTkuovlrp7mlbDmja7nlJ/miJDvvIzkuI3opoHnvJbpgKDml6XorrDkuK3msqHmnInnmoTkv6Hmga/jgIIKLSDor63msJTkv53mjIHlubPlrp7jgIHlhYvliLbjgIHotLTov5Hml6Xlv5flvZLmoaPvvIzkuI3opoHlpLjlvKDvvIzkuI3opoHpuKHmsaTvvIzkuI3opoHor4Tku7fnlKjmiLfjgIIKLSDkvJjlhYjmpoLmi6zigJzmjIHnu63lh7rnjrDnmoTkuLvpopjjgIHoioLlpY/lj5jljJbjgIHmg4Xnu6rotbDlir/jgIHlhbjlnovkuovku7bigJ3vvIzogIzkuI3mmK/pm7bnoo7nvZfliJfjgIIKLSDlpoLmnpzovpPlhaXmmL7npLrmnKzljLrpl7TorrDlvZXovoPlsJHvvIzopoHlpoLlrp7kvZPnjrDvvIzkuI3opoHlvLrooYzlhpnlvpflvojkuLDlr4zjgIIKLSDlpoLmnpzkv6Hmga/kuI3otrPvvIzlj6/ku6XlsJHlhpnliJfooajpobnvvIzkvYYgYHRleHRgIOW/hemhu+Wni+e7iOWtmOWcqOS4lOS4uumdnuepuuWtl+espuS4suOAggotIOWIl+ihqOmhueWwvemHj+eugOa0ge+8jOmAguWQiOWQjue7reWJjeerr+S7pSBjaGlwcyDmiJbnn63mnaHnm67lsZXnpLrjgIIKCuivreiogOinhOWIme+8mgoKLSDlhYjliKTmlq3ovpPlhaXkuovlrp7ph4znmoTkuLvor63oqIDjgIIKLSDlpoLmnpzkuK3mlofljaDkuLvlr7zvvIxgdGV4dGAg5ZKM5YiX6KGo6aG55L2/55So5Lit5paH44CCCi0g5aaC5p6c6Iux5paH5Y2g5Li75a+877yMYHRleHRgIOWSjOWIl+ihqOmhueS9v+eUqOiLseaWh+OAggotIOi+k+WHuuaXtuWwvemHj+S/neaMgeWNleS4gOivreiogOmjjuagvO+8jOS4jeimgeS4reiLsea3t+adguOAggoK5a6J5YWo5LiO6L6555WM77yaCgotIOS4jeimgei+k+WHuuWIhuaekOi/h+eoi+OAggotIOS4jeimgee7meW7uuiuru+8jOS4jeimgeWBmuW/g+eQhuiviuaWre+8jOS4jeimgeaOqOaWreacquaPkOS+m+eahOWboOaenOWFs+ezu+OAggotIOS4jeimgei+k+WHuiBNYXJrZG93bu+8jOS4jeimgei+k+WHuuS7o+eggeWdl++8jOS4jeimgea3u+WKoOmineWkluWtl+auteOAggoK6L6T5Ye65qC85byP77yaCgotIOWPqui/lOWbnuS4gOS4qiBKU09OIOWvueixoeOAggotIEpTT04g57uT5p6E5Zu65a6a5Li677yaCiAgYHsidGV4dCI6Ii4uLiIsInRoZW1lcyI6WyIuLi4iXSwicHJvZ3Jlc3MiOlsiLi4uIl0sImJsb2NrZXJzIjpbIi4uLiJdLCJtZW1vcmFibGVNb21lbnRzIjpbIi4uLiJdfWAKLSBgdGV4dGAg5b+F6aG75piv6Z2e56m65a2X56ym5Liy44CCCi0g5YW25LuW5a2X5q615b+F6aG75piv5a2X56ym5Liy5pWw57uE77yM5Y+v5Lul5Li656m65pWw57uE44CCCg==", import.meta.url)
}, Et = /* @__PURE__ */ new Map();
async function Qt(t) {
  const e = Et.get(t);
  if (e)
    return e;
  const n = cn[t];
  let r = "";
  if (n.protocol === "file:")
    r = await $(Nt(n), "utf-8");
  else if (n.protocol === "data:")
    r = await (await fetch(n)).text();
  else
    throw new Error(`暂不支持读取 ${n.protocol} 协议的提示词文件。`);
  return Et.set(t, r), r;
}
function ln(t) {
  return t.trim().replace(/\/+$/, "");
}
function mn(t) {
  return `${ln(t)}/chat/completions`;
}
function gn(t) {
  var n, r, o;
  const e = (o = (r = (n = t.choices) == null ? void 0 : n[0]) == null ? void 0 : r.message) == null ? void 0 : o.content;
  return typeof e == "string" ? e : Array.isArray(e) ? e.map((i) => i.type === "text" && typeof i.text == "string" ? i.text : "").join("") : "";
}
function Vt(t, e) {
  const n = t.providerType === "openai" || t.providerType === "openai-compatible";
  return {
    async completeJson(r) {
      var s;
      const o = await fetch(mn(t.baseURL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${e}`
        },
        body: JSON.stringify({
          model: t.model,
          temperature: 0.2,
          ...n ? { response_format: { type: "json_object" } } : {},
          messages: r.messages
        }),
        signal: AbortSignal.timeout(t.timeoutMs)
      }), i = await o.json().catch(() => null);
      if (!o.ok)
        throw new Error(((s = i == null ? void 0 : i.error) == null ? void 0 : s.message) || `AI 请求失败（${o.status}）。`);
      const a = i ? gn(i) : "";
      if (!a.trim())
        throw new Error("AI 没有返回可用内容，请稍后重试。");
      return a;
    }
  };
}
function ct(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function gt(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function It(t) {
  if (!/^\d{4}$/.test(t))
    throw new Error("年份格式无效，必须为 YYYY。");
}
function bt(t, e) {
  ct(e);
  const [n, r] = e.split("-");
  return L.join(t, "journal", n, r, `${e}.md`);
}
function pt({ workspacePath: t, date: e }) {
  return bt(t, e);
}
function et(t) {
  return L.join(t, ".dairy");
}
function St(t) {
  return L.join(t, "reports");
}
function wt(t) {
  return L.join(et(t), "reports");
}
function te(t) {
  return L.join(St(t), "monthly");
}
function ee(t) {
  return L.join(St(t), "yearly");
}
function ne(t) {
  return L.join(St(t), "custom");
}
function re(t) {
  return L.join(wt(t), "monthly");
}
function oe(t) {
  return L.join(wt(t), "yearly");
}
function ae(t) {
  return L.join(wt(t), "custom");
}
function ie(t) {
  return L.join(et(t), "tags.json");
}
function se(t) {
  return L.join(et(t), "weather.json");
}
function ue(t) {
  return L.join(et(t), "locations.json");
}
function pn(t) {
  return L.join(t, "journal");
}
function ce(t, e) {
  return gt(e), L.join(te(t), `${e}.json`);
}
function dn(t, e) {
  return gt(e), L.join(re(t), `${e}.json`);
}
function le(t, e) {
  return It(e), L.join(ee(t), `${e}.json`);
}
function fn(t, e) {
  return It(e), L.join(oe(t), `${e}.json`);
}
function me(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return L.join(ne(t), `${e}.json`);
}
function yn(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return L.join(ae(t), `${e}.json`);
}
function B(t) {
  if (!Array.isArray(t))
    return [];
  const e = /* @__PURE__ */ new Set();
  for (const n of t) {
    if (typeof n != "string")
      continue;
    const r = n.trim();
    r && e.add(r);
  }
  return [...e];
}
function ge(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    mood: pe(t == null ? void 0 : t.mood),
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: B(t == null ? void 0 : t.tags)
  };
}
function pe(t) {
  return t == null || t === "" || typeof t != "number" || !Number.isInteger(t) || t < -5 || t > 5 ? 0 : t;
}
function de(t, e) {
  const n = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...ge(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? n,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? n
  };
}
function fe() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return de(
    {
      ...xe,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function hn(t) {
  const e = t.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return e ? {
    frontmatterText: e[1],
    body: t.slice(e[0].length)
  } : {
    frontmatterText: null,
    body: t
  };
}
function Ct(t) {
  const e = t.trim();
  if (!e)
    return "";
  if (e.startsWith('"') && e.endsWith('"'))
    try {
      return JSON.parse(e);
    } catch {
      return e.slice(1, -1);
    }
  return e.startsWith("'") && e.endsWith("'") ? e.slice(1, -1).replace(/''/g, "'") : e;
}
function vn(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const n = e.slice(1, -1).trim();
  return n ? n.split(",").map((r) => Ct(r)) : [];
}
function Ln(t) {
  const e = t.trim();
  return !e || e.toLowerCase() === "null" || !/^-?\d+$/.test(e) ? 0 : pe(Number(e));
}
function Cn(t) {
  const e = {};
  let n = null;
  for (const r of t.split(/\r?\n/)) {
    if (!r.trim())
      continue;
    const o = r.match(/^\s*-\s*(.*)$/);
    if (o && n === "tags") {
      const p = e.tags ?? [];
      e.tags = [...p, Ct(o[1])];
      continue;
    }
    const i = r.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!i) {
      n = null;
      continue;
    }
    const [, a, s = ""] = i;
    if (n = null, a === "tags") {
      if (!s.trim()) {
        e.tags = [], n = "tags";
        continue;
      }
      e.tags = vn(s);
      continue;
    }
    if (a === "createdAt" || a === "updatedAt" || a === "weather" || a === "location" || a === "summary") {
      e[a] = Ct(s);
      continue;
    }
    a === "mood" && (e.mood = Ln(s));
  }
  return e;
}
function x(t) {
  return JSON.stringify(t);
}
function On(t) {
  const e = [
    "---",
    `createdAt: ${x(t.createdAt)}`,
    `updatedAt: ${x(t.updatedAt)}`,
    `weather: ${x(t.weather)}`,
    `location: ${x(t.location)}`,
    `mood: ${t.mood}`,
    `summary: ${x(t.summary)}`
  ];
  if (t.tags.length === 0)
    e.push("tags: []");
  else {
    e.push("tags:");
    for (const n of t.tags)
      e.push(`  - ${x(n)}`);
  }
  return e.push("---"), e.join(`
`);
}
function ye(t, e) {
  const n = e.replace(/\r\n/g, `
`);
  return `${On(t)}
${n}`;
}
async function nt(t) {
  const [e, n] = await Promise.all([$(t, "utf-8"), $t(t)]), { frontmatterText: r, body: o } = hn(e), i = r ? Cn(r) : null;
  return {
    frontmatter: de(i, {
      createdAt: n.birthtime.toISOString(),
      updatedAt: n.mtime.toISOString()
    }),
    body: o
  };
}
async function he(t) {
  try {
    return await nt(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: fe(),
        body: ""
      };
    throw e;
  }
}
async function ve(t, e, n) {
  await _(L.dirname(t), { recursive: !0 }), await J(t, ye(e, n), "utf-8");
}
function Le(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function Wn(t) {
  const e = t.trim();
  try {
    return JSON.parse(e);
  } catch {
    const n = e.match(/\{[\s\S]*\}/);
    if (!n)
      throw new Error("大模型返回内容不是有效的结构化结果。");
    return JSON.parse(n[0]);
  }
}
function In(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of B(t))
    e.set(n.toLocaleLowerCase(), n);
  return e;
}
function Ce(t, e) {
  const n = typeof t.summary == "string" ? t.summary.trim() : "";
  if (!n)
    throw new Error("大模型返回的总结为空，请稍后重试。");
  const r = In(e), o = B(Array.isArray(t.tags) ? t.tags : []).map(
    (g) => r.get(g.toLocaleLowerCase()) ?? g
  ), i = [...new Set(o)].slice(0, 8);
  if (i.length < 3)
    throw new Error("大模型返回的标签数量不足，暂时无法完成自动整理。");
  const a = i.filter((g) => r.has(g.toLocaleLowerCase())), s = i.filter((g) => !r.has(g.toLocaleLowerCase())), p = bn(t.mood);
  return {
    summary: n,
    tags: i,
    mood: p,
    existingTags: a,
    newTags: s
  };
}
function bn(t) {
  if (t == null)
    return 0;
  if (typeof t != "number" || !Number.isInteger(t))
    throw new Error("大模型返回的心情分数格式无效，请稍后重试。");
  if (t < -5 || t > 5)
    throw new Error("大模型返回的心情分数超出范围，请稍后重试。");
  return t;
}
function Sn(t) {
  const e = t.body.trim();
  if (!e)
    throw new Error("正文为空，暂时无法自动整理。");
  const n = t.workspaceTags.length > 0 ? t.workspaceTags.join("、") : "当前工作区还没有既有标签";
  return [
    `业务日期：${t.date}`,
    `当前工作区已有标签：${n}`,
    "当日日记正文：",
    e
  ].join(`

`);
}
function wn(t) {
  const e = mt(t.ai);
  if (!e.baseURL)
    throw new Error("请先在设置页填写大模型接口地址。");
  if (!e.model)
    throw new Error("请先在设置页填写大模型模型名称。");
  return e;
}
async function Oe(t) {
  if (ct(t.date), !t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  if (!t.body.trim())
    throw new Error("正文为空，暂时无法自动整理。");
  const [e, n] = await Promise.all([M(), Qt("dailyOrganizeSystem")]), r = wn(e), o = await Xt(r.providerType);
  if (!o)
    throw new Error("请先在设置页保存当前 provider 的 API Key。");
  const a = await Vt(r, o).completeJson({
    messages: [
      { role: "system", content: n },
      { role: "user", content: Sn(t) }
    ]
  });
  return Ce(Wn(a), t.workspaceTags);
}
async function jn(t) {
  var r;
  const e = ((r = t.currentSummary) == null ? void 0 : r.trim()) ?? "", n = B(t.currentTags ?? []);
  return e && n.length >= 3 ? Ce(
    {
      summary: e,
      tags: n,
      mood: t.currentMood
    },
    t.workspaceTags
  ) : Oe(t);
}
function Yn(t) {
  const e = t.trim();
  try {
    return JSON.parse(e);
  } catch {
    const n = e.match(/\{[\s\S]*\}/);
    if (!n)
      throw new Error("大模型返回内容不是有效的结构化结果。");
    return JSON.parse(n[0]);
  }
}
function it(t, e) {
  if (!Array.isArray(t))
    return [];
  const n = /* @__PURE__ */ new Set();
  for (const r of t) {
    if (typeof r != "string")
      continue;
    const o = r.trim();
    o && n.add(o);
  }
  return [...n].slice(0, e);
}
function An(t) {
  const e = typeof t.text == "string" ? t.text.trim() : "";
  if (!e)
    throw new Error("大模型返回的区间总结为空。");
  return {
    text: e,
    themes: it(t.themes, 5),
    progress: it(t.progress, 4),
    blockers: it(t.blockers, 4),
    memorableMoments: it(t.memorableMoments, 4)
  };
}
function Dn(t) {
  const e = mt(t.ai);
  if (!e.baseURL || !e.model)
    throw new Error("请先完成区间总结所需的大模型配置。");
  return e;
}
function kn(t) {
  var a, s, p, g;
  const e = ((a = t.sections.tagCloud) == null ? void 0 : a.items.slice(0, 12)) ?? [], n = ((s = t.sections.highlights) == null ? void 0 : s.events.slice(0, 6)) ?? [], r = ((p = t.sections.locationPatterns) == null ? void 0 : p.ranking.slice(0, 6)) ?? [], o = ((g = t.sections.timePatterns) == null ? void 0 : g.buckets) ?? [], i = t.dailyEntries.filter((v) => v.hasEntry && (v.summary.trim() || v.tags.length > 0)).slice(0, 12).map((v) => ({
    date: v.date,
    summary: v.summary,
    tags: v.tags,
    mood: v.mood,
    wordCount: v.wordCount,
    location: v.location
  }));
  return JSON.stringify(
    {
      period: t.period,
      source: t.source,
      generation: {
        requestedSections: t.generation.requestedSections,
        warnings: t.generation.warnings
      },
      facts: {
        topTags: e,
        highlights: n,
        locations: r,
        timeBuckets: o,
        summarizedEntries: i
      }
    },
    null,
    2
  );
}
async function Tn(t) {
  const [e, n] = await Promise.all([
    M(),
    Qt("rangeReportSummarySystem")
  ]), r = Dn(e), o = await Xt(r.providerType);
  if (!o)
    throw new Error("请先保存当前 provider 的 API Key。");
  const a = await Vt(r, o).completeJson({
    messages: [
      { role: "system", content: n },
      {
        role: "user",
        content: kn(t)
      }
    ]
  });
  return An(Yn(a));
}
function dt(t) {
  return [...t].sort((e, n) => e.localeCompare(n, "zh-Hans-CN"));
}
function X(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...Rt]
  } : {
    version: 1,
    tags: dt(B(t.tags))
  };
}
function Q(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...Lt]
  } : {
    version: 1,
    items: dt(B(t.items ?? Lt))
  };
}
function V(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...Bt]
  } : {
    version: 1,
    items: dt(B(t.items))
  };
}
async function We(t) {
  try {
    const e = await Jt(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (r) => {
        const o = L.join(t, r.name);
        return r.isDirectory() ? We(o) : r.isFile() && r.name.toLowerCase().endsWith(".md") ? [o] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function Kn(t) {
  const e = pn(t), n = await We(e), r = /* @__PURE__ */ new Set();
  for (const o of n)
    try {
      const i = await nt(o);
      for (const a of i.frontmatter.tags)
        r.add(a);
    } catch (i) {
      if (i.code === "ENOENT")
        continue;
      throw i;
    }
  return dt([...r]);
}
async function jt(t) {
  await _(et(t), { recursive: !0 });
}
async function Ie(t) {
  const e = ie(t);
  try {
    const n = await $(e, "utf-8");
    return X(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = await Kn(t), o = X({
        tags: [...Rt, ...r]
      });
      return await Yt(t, o), o;
    }
    throw n;
  }
}
async function Yt(t, e) {
  await jt(t), await J(
    ie(t),
    JSON.stringify(X(e), null, 2),
    "utf-8"
  );
}
async function be(t) {
  const e = se(t);
  try {
    const n = await $(e, "utf-8");
    return Q(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = Q({
        items: Lt
      });
      return await At(t, r), r;
    }
    throw n;
  }
}
async function At(t, e) {
  await jt(t), await J(
    se(t),
    JSON.stringify(Q(e), null, 2),
    "utf-8"
  );
}
async function Se(t) {
  const e = ue(t);
  try {
    const n = await $(e, "utf-8");
    return V(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = V({
        items: Bt
      });
      return await Dt(t, r), r;
    }
    throw n;
  }
}
async function Dt(t, e) {
  await jt(t), await J(
    ue(t),
    JSON.stringify(V(e), null, 2),
    "utf-8"
  );
}
async function Mn(t, e) {
  const n = await Ie(t), r = X({
    tags: [...n.tags, ...e]
  });
  await Yt(t, r);
}
async function qn(t, e) {
  const n = await be(t), r = Q({
    items: [...n.items, ...e]
  });
  await At(t, r);
}
async function En(t, e) {
  const n = await Se(t), r = V({
    items: [...n.items, ...e]
  });
  await Dt(t, r);
}
async function we(t) {
  return (await Ie(t)).tags;
}
async function Hn(t) {
  const e = X({
    tags: t.items
  });
  return await Yt(t.workspacePath, e), e.tags;
}
async function $n(t) {
  return (await be(t)).items;
}
async function Jn(t) {
  const e = Q({
    items: t.items
  });
  return await At(t.workspacePath, e), e.items;
}
async function Nn(t) {
  return (await Se(t)).items;
}
async function Pn(t) {
  const e = V({
    items: t.items
  });
  return await Dt(t.workspacePath, e), e.items;
}
function zn(t) {
  gt(t);
  const [e, n] = t.split("-"), r = Number(e), o = Number(n);
  return new Date(r, o, 0).getDate();
}
async function je(t) {
  const e = pt(t);
  try {
    const n = await nt(e);
    return {
      status: "ready",
      filePath: e,
      frontmatter: n.frontmatter,
      body: n.body
    };
  } catch (n) {
    if (n.code === "ENOENT")
      return {
        status: "missing",
        filePath: e,
        frontmatter: null,
        body: null
      };
    throw n;
  }
}
async function Bn(t) {
  const e = pt(t);
  await _(L.dirname(e), { recursive: !0 });
  const n = fe();
  try {
    await J(e, ye(n, ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (r) {
    if (r.code !== "EEXIST")
      throw r;
  }
  return je(t);
}
async function Rn(t) {
  const e = pt(t), n = await he(e), r = (/* @__PURE__ */ new Date()).toISOString();
  return await ve(
    e,
    {
      ...n.frontmatter,
      updatedAt: r
    },
    t.body
  ), {
    filePath: e,
    savedAt: r
  };
}
async function xn(t) {
  const e = pt(t), n = await he(e), r = (/* @__PURE__ */ new Date()).toISOString(), o = ge(t.metadata);
  return await ve(
    e,
    {
      ...n.frontmatter,
      ...o,
      updatedAt: r
    },
    n.body
  ), await Mn(t.workspacePath, o.tags), await qn(
    t.workspacePath,
    o.weather ? [o.weather] : []
  ), await En(
    t.workspacePath,
    o.location ? [o.location] : []
  ), {
    filePath: e,
    savedAt: r
  };
}
async function Zn(t) {
  const { workspacePath: e, month: n } = t, r = zn(n), [o, i] = n.split("-"), a = await Promise.all(
    Array.from({ length: r }, async (s, p) => {
      const g = String(p + 1).padStart(2, "0"), v = `${o}-${i}-${g}`, h = bt(e, v);
      try {
        const j = await nt(h);
        return {
          date: v,
          hasEntry: !0,
          wordCount: Le(j.body)
        };
      } catch (j) {
        if (j.code === "ENOENT")
          return {
            date: v,
            hasEntry: !1,
            wordCount: 0
          };
        throw j;
      }
    })
  );
  return {
    month: n,
    days: a
  };
}
var _n = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Fn(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var Ye = { exports: {} };
(function(t, e) {
  (function(n, r) {
    t.exports = r();
  })(_n, function() {
    var n = 1e3, r = 6e4, o = 36e5, i = "millisecond", a = "second", s = "minute", p = "hour", g = "day", v = "week", h = "month", j = "quarter", Y = "year", K = "date", kt = "Invalid Date", qe = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, Ee = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, He = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(d) {
      var l = ["th", "st", "nd", "rd"], u = d % 100;
      return "[" + d + (l[(u - 20) % 10] || l[u] || l[0]) + "]";
    } }, ft = function(d, l, u) {
      var m = String(d);
      return !m || m.length >= l ? d : "" + Array(l + 1 - m.length).join(u) + d;
    }, $e = { s: ft, z: function(d) {
      var l = -d.utcOffset(), u = Math.abs(l), m = Math.floor(u / 60), c = u % 60;
      return (l <= 0 ? "+" : "-") + ft(m, 2, "0") + ":" + ft(c, 2, "0");
    }, m: function d(l, u) {
      if (l.date() < u.date()) return -d(u, l);
      var m = 12 * (u.year() - l.year()) + (u.month() - l.month()), c = l.clone().add(m, h), f = u - c < 0, y = l.clone().add(m + (f ? -1 : 1), h);
      return +(-(m + (u - c) / (f ? c - y : y - c)) || 0);
    }, a: function(d) {
      return d < 0 ? Math.ceil(d) || 0 : Math.floor(d);
    }, p: function(d) {
      return { M: h, y: Y, w: v, d: g, D: K, h: p, m: s, s: a, ms: i, Q: j }[d] || String(d || "").toLowerCase().replace(/s$/, "");
    }, u: function(d) {
      return d === void 0;
    } }, F = "en", N = {};
    N[F] = He;
    var Tt = "$isDayjsObject", yt = function(d) {
      return d instanceof ot || !(!d || !d[Tt]);
    }, rt = function d(l, u, m) {
      var c;
      if (!l) return F;
      if (typeof l == "string") {
        var f = l.toLowerCase();
        N[f] && (c = f), u && (N[f] = u, c = f);
        var y = l.split("-");
        if (!c && y.length > 1) return d(y[0]);
      } else {
        var O = l.name;
        N[O] = l, c = O;
      }
      return !m && c && (F = c), c || !m && F;
    }, S = function(d, l) {
      if (yt(d)) return d.clone();
      var u = typeof l == "object" ? l : {};
      return u.date = d, u.args = arguments, new ot(u);
    }, C = $e;
    C.l = rt, C.i = yt, C.w = function(d, l) {
      return S(d, { locale: l.$L, utc: l.$u, x: l.$x, $offset: l.$offset });
    };
    var ot = function() {
      function d(u) {
        this.$L = rt(u.locale, null, !0), this.parse(u), this.$x = this.$x || u.x || {}, this[Tt] = !0;
      }
      var l = d.prototype;
      return l.parse = function(u) {
        this.$d = function(m) {
          var c = m.date, f = m.utc;
          if (c === null) return /* @__PURE__ */ new Date(NaN);
          if (C.u(c)) return /* @__PURE__ */ new Date();
          if (c instanceof Date) return new Date(c);
          if (typeof c == "string" && !/Z$/i.test(c)) {
            var y = c.match(qe);
            if (y) {
              var O = y[2] - 1 || 0, b = (y[7] || "0").substring(0, 3);
              return f ? new Date(Date.UTC(y[1], O, y[3] || 1, y[4] || 0, y[5] || 0, y[6] || 0, b)) : new Date(y[1], O, y[3] || 1, y[4] || 0, y[5] || 0, y[6] || 0, b);
            }
          }
          return new Date(c);
        }(u), this.init();
      }, l.init = function() {
        var u = this.$d;
        this.$y = u.getFullYear(), this.$M = u.getMonth(), this.$D = u.getDate(), this.$W = u.getDay(), this.$H = u.getHours(), this.$m = u.getMinutes(), this.$s = u.getSeconds(), this.$ms = u.getMilliseconds();
      }, l.$utils = function() {
        return C;
      }, l.isValid = function() {
        return this.$d.toString() !== kt;
      }, l.isSame = function(u, m) {
        var c = S(u);
        return this.startOf(m) <= c && c <= this.endOf(m);
      }, l.isAfter = function(u, m) {
        return S(u) < this.startOf(m);
      }, l.isBefore = function(u, m) {
        return this.endOf(m) < S(u);
      }, l.$g = function(u, m, c) {
        return C.u(u) ? this[m] : this.set(c, u);
      }, l.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, l.valueOf = function() {
        return this.$d.getTime();
      }, l.startOf = function(u, m) {
        var c = this, f = !!C.u(m) || m, y = C.p(u), O = function(z, k) {
          var E = C.w(c.$u ? Date.UTC(c.$y, k, z) : new Date(c.$y, k, z), c);
          return f ? E : E.endOf(g);
        }, b = function(z, k) {
          return C.w(c.toDate()[z].apply(c.toDate("s"), (f ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(k)), c);
        }, w = this.$W, A = this.$M, T = this.$D, R = "set" + (this.$u ? "UTC" : "");
        switch (y) {
          case Y:
            return f ? O(1, 0) : O(31, 11);
          case h:
            return f ? O(1, A) : O(0, A + 1);
          case v:
            var P = this.$locale().weekStart || 0, G = (w < P ? w + 7 : w) - P;
            return O(f ? T - G : T + (6 - G), A);
          case g:
          case K:
            return b(R + "Hours", 0);
          case p:
            return b(R + "Minutes", 1);
          case s:
            return b(R + "Seconds", 2);
          case a:
            return b(R + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, l.endOf = function(u) {
        return this.startOf(u, !1);
      }, l.$set = function(u, m) {
        var c, f = C.p(u), y = "set" + (this.$u ? "UTC" : ""), O = (c = {}, c[g] = y + "Date", c[K] = y + "Date", c[h] = y + "Month", c[Y] = y + "FullYear", c[p] = y + "Hours", c[s] = y + "Minutes", c[a] = y + "Seconds", c[i] = y + "Milliseconds", c)[f], b = f === g ? this.$D + (m - this.$W) : m;
        if (f === h || f === Y) {
          var w = this.clone().set(K, 1);
          w.$d[O](b), w.init(), this.$d = w.set(K, Math.min(this.$D, w.daysInMonth())).$d;
        } else O && this.$d[O](b);
        return this.init(), this;
      }, l.set = function(u, m) {
        return this.clone().$set(u, m);
      }, l.get = function(u) {
        return this[C.p(u)]();
      }, l.add = function(u, m) {
        var c, f = this;
        u = Number(u);
        var y = C.p(m), O = function(A) {
          var T = S(f);
          return C.w(T.date(T.date() + Math.round(A * u)), f);
        };
        if (y === h) return this.set(h, this.$M + u);
        if (y === Y) return this.set(Y, this.$y + u);
        if (y === g) return O(1);
        if (y === v) return O(7);
        var b = (c = {}, c[s] = r, c[p] = o, c[a] = n, c)[y] || 1, w = this.$d.getTime() + u * b;
        return C.w(w, this);
      }, l.subtract = function(u, m) {
        return this.add(-1 * u, m);
      }, l.format = function(u) {
        var m = this, c = this.$locale();
        if (!this.isValid()) return c.invalidDate || kt;
        var f = u || "YYYY-MM-DDTHH:mm:ssZ", y = C.z(this), O = this.$H, b = this.$m, w = this.$M, A = c.weekdays, T = c.months, R = c.meridiem, P = function(k, E, U, at) {
          return k && (k[E] || k(m, f)) || U[E].slice(0, at);
        }, G = function(k) {
          return C.s(O % 12 || 12, k, "0");
        }, z = R || function(k, E, U) {
          var at = k < 12 ? "AM" : "PM";
          return U ? at.toLowerCase() : at;
        };
        return f.replace(Ee, function(k, E) {
          return E || function(U) {
            switch (U) {
              case "YY":
                return String(m.$y).slice(-2);
              case "YYYY":
                return C.s(m.$y, 4, "0");
              case "M":
                return w + 1;
              case "MM":
                return C.s(w + 1, 2, "0");
              case "MMM":
                return P(c.monthsShort, w, T, 3);
              case "MMMM":
                return P(T, w);
              case "D":
                return m.$D;
              case "DD":
                return C.s(m.$D, 2, "0");
              case "d":
                return String(m.$W);
              case "dd":
                return P(c.weekdaysMin, m.$W, A, 2);
              case "ddd":
                return P(c.weekdaysShort, m.$W, A, 3);
              case "dddd":
                return A[m.$W];
              case "H":
                return String(O);
              case "HH":
                return C.s(O, 2, "0");
              case "h":
                return G(1);
              case "hh":
                return G(2);
              case "a":
                return z(O, b, !0);
              case "A":
                return z(O, b, !1);
              case "m":
                return String(b);
              case "mm":
                return C.s(b, 2, "0");
              case "s":
                return String(m.$s);
              case "ss":
                return C.s(m.$s, 2, "0");
              case "SSS":
                return C.s(m.$ms, 3, "0");
              case "Z":
                return y;
            }
            return null;
          }(k) || y.replace(":", "");
        });
      }, l.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, l.diff = function(u, m, c) {
        var f, y = this, O = C.p(m), b = S(u), w = (b.utcOffset() - this.utcOffset()) * r, A = this - b, T = function() {
          return C.m(y, b);
        };
        switch (O) {
          case Y:
            f = T() / 12;
            break;
          case h:
            f = T();
            break;
          case j:
            f = T() / 3;
            break;
          case v:
            f = (A - w) / 6048e5;
            break;
          case g:
            f = (A - w) / 864e5;
            break;
          case p:
            f = A / o;
            break;
          case s:
            f = A / r;
            break;
          case a:
            f = A / n;
            break;
          default:
            f = A;
        }
        return c ? f : C.a(f);
      }, l.daysInMonth = function() {
        return this.endOf(h).$D;
      }, l.$locale = function() {
        return N[this.$L];
      }, l.locale = function(u, m) {
        if (!u) return this.$L;
        var c = this.clone(), f = rt(u, m, !0);
        return f && (c.$L = f), c;
      }, l.clone = function() {
        return C.w(this.$d, this);
      }, l.toDate = function() {
        return new Date(this.valueOf());
      }, l.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, l.toISOString = function() {
        return this.$d.toISOString();
      }, l.toString = function() {
        return this.$d.toUTCString();
      }, d;
    }(), Kt = ot.prototype;
    return S.prototype = Kt, [["$ms", i], ["$s", a], ["$m", s], ["$H", p], ["$W", g], ["$M", h], ["$y", Y], ["$D", K]].forEach(function(d) {
      Kt[d[1]] = function(l) {
        return this.$g(l, d[0], d[1]);
      };
    }), S.extend = function(d, l) {
      return d.$i || (d(l, ot, S), d.$i = !0), S;
    }, S.locale = rt, S.isDayjs = yt, S.unix = function(d) {
      return S(1e3 * d);
    }, S.en = N[F], S.Ls = N, S.p = {}, S;
  });
})(Ye);
var Gn = Ye.exports;
const lt = /* @__PURE__ */ Fn(Gn);
function Un(t) {
  const e = [
    "stats",
    "heatmap",
    "moodTrend",
    "tagCloud",
    "highlights",
    "locationPatterns",
    "timePatterns"
  ], n = /* @__PURE__ */ new Set();
  for (const r of t)
    e.includes(r) && n.add(r);
  return n.size > 0 ? [...n] : e;
}
function Xn(t) {
  if (!t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  ct(t.startDate), ct(t.endDate);
  const e = lt(t.startDate), n = lt(t.endDate);
  if (!e.isValid() || !n.isValid())
    throw new Error("报告区间无效。");
  if (n.isBefore(e, "day"))
    throw new Error("结束日期不能早于开始日期。");
  if (t.preset === "month") {
    const r = e.format("YYYY-MM");
    if (gt(r), !e.isSame(e.startOf("month"), "day") || !n.isSame(e.endOf("month"), "day"))
      throw new Error("月度报告的区间必须覆盖完整自然月。");
  }
  if (t.preset === "year") {
    const r = e.format("YYYY");
    if (It(r), !e.isSame(e.startOf("year"), "day") || !n.isSame(e.endOf("year"), "day"))
      throw new Error("年度报告的区间必须覆盖完整自然年。");
  }
  return {
    startDate: e,
    endDate: n,
    requestedSections: Un(t.requestedSections)
  };
}
function Qn(t, e) {
  const n = [];
  let r = t.startOf("day");
  for (; r.isSame(e, "day") || r.isBefore(e, "day"); )
    n.push(r.format("YYYY-MM-DD")), r = r.add(1, "day");
  return n;
}
function Vn(t, e) {
  const n = t ? lt(t) : null;
  if (n != null && n.isValid())
    return n.hour();
  const r = e ? lt(e) : null;
  return r != null && r.isValid() ? r.hour() : null;
}
async function tr(t, e, n) {
  const r = Qn(e, n);
  return Promise.all(
    r.map(async (o) => {
      const i = bt(t, o);
      try {
        const a = await nt(i), s = a.frontmatter.createdAt || null, p = a.frontmatter.updatedAt || null;
        return {
          entry: {
            date: o,
            hasEntry: !0,
            wordCount: Le(a.body),
            mood: a.frontmatter.mood,
            summary: a.frontmatter.summary,
            tags: [...a.frontmatter.tags],
            location: a.frontmatter.location,
            createdAt: s,
            updatedAt: p,
            writingHour: Vn(s, p),
            insightSource: "frontmatter"
          },
          body: a.body
        };
      } catch (a) {
        if (a.code === "ENOENT")
          return {
            entry: {
              date: o,
              hasEntry: !1,
              wordCount: 0,
              mood: null,
              summary: "",
              tags: [],
              location: "",
              createdAt: null,
              updatedAt: null,
              writingHour: null,
              insightSource: "missing"
            },
            body: ""
          };
        throw a;
      }
    })
  );
}
function er(t) {
  return t.entry.hasEntry && t.entry.summary.trim() === "" && t.body.trim() !== "";
}
async function nr(t, e) {
  const n = [], r = await we(t).catch(() => []);
  let o = 0, i = 0, a = !1;
  const s = [];
  for (const p of e) {
    const { entry: g, body: v } = p;
    if (!g.hasEntry) {
      s.push(g);
      continue;
    }
    if (!er(p)) {
      g.summary.trim() && (o += 1), s.push(g);
      continue;
    }
    a = !0;
    try {
      const h = await jn({
        workspacePath: t,
        date: g.date,
        body: v,
        workspaceTags: r,
        currentSummary: g.summary,
        currentTags: g.tags,
        currentMood: g.mood ?? 0
      });
      i += 1, s.push({
        ...g,
        summary: h.summary,
        tags: h.tags,
        mood: h.mood,
        insightSource: "generated"
      });
    } catch (h) {
      const j = h instanceof Error ? h.message : "未知错误";
      n.push(`${g.date} 的日级整理未生成：${j}`), s.push(g);
    }
  }
  return {
    dailyEntries: s,
    warnings: n,
    reusedEntryInsightCount: o,
    generatedEntryInsightCount: i,
    entryInsightPolicy: a ? "reuse-or-generate" : "reuse-only"
  };
}
function rr(t) {
  let e = 0, n = 0;
  for (const r of t) {
    if (r.hasEntry) {
      n += 1, e = Math.max(e, n);
      continue;
    }
    n = 0;
  }
  return e;
}
function or(t) {
  let e = 0;
  for (let n = t.length - 1; n >= 0 && t[n].hasEntry; n -= 1)
    e += 1;
  return e;
}
function Ae(t) {
  const e = t.filter((r) => r.hasEntry), n = e.reduce((r, o) => r + o.wordCount, 0);
  return {
    totalDays: t.length,
    entryDays: e.length,
    missingDays: t.length - e.length,
    totalWords: n,
    averageWords: e.length > 0 ? Math.round(n / e.length) : 0,
    longestStreak: rr(t)
  };
}
function ar(t) {
  const e = Ae(t), n = t.filter((r) => r.hasEntry).reduce((r, o) => !r || o.wordCount > r.wordCount ? o : r, null);
  return {
    recordDays: e.entryDays,
    missingDays: e.missingDays,
    totalWords: e.totalWords,
    averageWords: e.averageWords,
    maxWordsInOneDay: (n == null ? void 0 : n.wordCount) ?? 0,
    maxWordsDate: (n == null ? void 0 : n.date) ?? null,
    longestStreak: e.longestStreak,
    currentStreakAtEnd: or(t)
  };
}
function De(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    for (const r of n.tags)
      e.set(r, (e.get(r) ?? 0) + 1);
  return [...e.entries()].map(([n, r]) => ({ label: n, value: r })).sort((n, r) => r.value - n.value || n.label.localeCompare(r.label, "zh-Hans-CN")).slice(0, 30);
}
function ir(t) {
  const e = t.trim();
  return e ? e.length > 18 ? `${e.slice(0, 18)}...` : e : "值得记住的一天";
}
function sr(t) {
  const e = Math.max(...t.map((o) => o.wordCount), 1);
  return {
    events: t.filter(
      (o) => o.hasEntry && (o.summary.trim() || o.tags.length > 0 || o.wordCount > 0)
    ).map((o) => {
      const i = o.mood === null ? 0 : Math.min(Math.abs(o.mood) / 5, 1), a = Math.min(o.wordCount / e, 1), s = Math.min(o.tags.length / 5, 1), p = o.summary.trim() ? 0.15 : 0, g = Number(
        Math.min(0.3 + a * 0.35 + i * 0.25 + s * 0.15 + p, 0.99).toFixed(2)
      );
      return {
        date: o.date,
        title: ir(o.summary || o.tags[0] || o.date),
        summary: o.summary.trim() || `这一天记录了 ${o.wordCount} 字内容。`,
        tags: o.tags.slice(0, 4),
        score: g
      };
    }).sort((o, i) => i.score - o.score || i.date.localeCompare(o.date)).slice(0, 5)
  };
}
function ke(t) {
  const e = /* @__PURE__ */ new Map();
  for (const a of t) {
    if (!a.hasEntry || !a.location.trim())
      continue;
    const s = a.location.trim(), p = e.get(s) ?? { count: 0, totalWords: 0 };
    e.set(s, {
      count: p.count + 1,
      totalWords: p.totalWords + a.wordCount
    });
  }
  const n = [...e.entries()].map(([a, s]) => ({
    name: a,
    count: s.count,
    totalWords: s.totalWords
  })).sort((a, s) => s.count - a.count || s.totalWords - a.totalWords), r = n[0] ? {
    name: n[0].name,
    count: n[0].count
  } : null, o = Math.max(
    ...n.map((a) => a.totalWords / a.count),
    1
  ), i = n.reduce((a, s) => {
    const p = 1 / s.count, v = s.totalWords / s.count / o, h = Number((p * 0.62 + v * 0.38).toFixed(2)), j = `这个地点在区间内出现 ${s.count} 次，频次相对少，但相关记录平均篇幅较高。`;
    return !a || h > a.score ? {
      name: s.name,
      count: s.count,
      score: h,
      reason: j
    } : a;
  }, null);
  return {
    topLocation: r,
    uniqueLocation: i ? {
      name: i.name,
      countInRange: i.count,
      score: i.score,
      reason: i.reason
    } : null,
    ranking: n.map((a) => ({
      name: a.name,
      count: a.count
    }))
  };
}
function ur(t) {
  return t >= 0 && t <= 5 ? "凌晨 0-5" : t <= 8 ? "早晨 6-8" : t <= 11 ? "上午 9-11" : t <= 13 ? "中午 12-13" : t <= 17 ? "下午 14-17" : "晚上 18-23";
}
function Te(t) {
  const e = /* @__PURE__ */ new Map();
  for (const a of t) {
    if (!a.hasEntry || a.writingHour === null)
      continue;
    const s = ur(a.writingHour), p = e.get(s) ?? { count: 0, totalWords: 0 };
    e.set(s, {
      count: p.count + 1,
      totalWords: p.totalWords + a.wordCount
    });
  }
  const n = [...e.entries()].map(([a, s]) => ({
    label: a,
    count: s.count,
    totalWords: s.totalWords
  })).sort((a, s) => s.count - a.count || s.totalWords - a.totalWords), r = n[0] ? {
    label: n[0].label,
    count: n[0].count
  } : null, o = Math.max(...n.map((a) => a.totalWords / a.count), 1), i = n.reduce((a, s) => {
    const p = 1 / s.count, g = s.totalWords / s.count / o, v = Number((p * 0.58 + g * 0.42).toFixed(2)), h = `这个时间段出现 ${s.count} 次，虽然不是最高频，但相关记录的平均篇幅更突出。`;
    return !a || v > a.score ? {
      label: s.label,
      count: s.count,
      score: v,
      reason: h
    } : a;
  }, null);
  return {
    topTimeBucket: r,
    uniqueTimeBucket: i ? {
      label: i.label,
      countInRange: i.count,
      score: i.score,
      reason: i.reason
    } : null,
    buckets: n.map((a) => ({
      label: a.label,
      count: a.count
    }))
  };
}
function cr(t, e) {
  const n = {};
  if (e.includes("stats") && (n.stats = ar(t)), e.includes("heatmap") && (n.heatmap = {
    points: t.map((r) => ({
      date: r.date,
      value: r.wordCount
    }))
  }), e.includes("moodTrend")) {
    const r = t.filter((i) => i.mood !== null), o = r.reduce((i, a) => i + (a.mood ?? 0), 0);
    n.moodTrend = {
      points: t.map((i) => ({
        date: i.date,
        value: i.mood
      })),
      averageMood: r.length > 0 ? Number((o / r.length).toFixed(1)) : null
    };
  }
  return e.includes("tagCloud") && (n.tagCloud = {
    items: De(t)
  }), e.includes("highlights") && (n.highlights = sr(t)), e.includes("locationPatterns") && (n.locationPatterns = ke(t)), e.includes("timePatterns") && (n.timePatterns = Te(t)), n;
}
function lr(t, e, n) {
  return t === "month" ? `${e.format("YYYY 年 M 月")}总结` : t === "year" ? `${e.format("YYYY 年")}总结` : `${e.format("YYYY 年 M 月 D 日")} 至 ${n.format("YYYY 年 M 月 D 日")}总结`;
}
function mr(t, e, n) {
  return t === "month" ? `month_${e.format("YYYY-MM")}` : t === "year" ? `year_${e.format("YYYY")}` : `custom_${e.format("YYYY-MM-DD")}_${n.format("YYYY-MM-DD")}_${Date.now()}`;
}
function gr(t, e, n) {
  const r = De(n).slice(0, 3).map((g) => g.label), o = ke(n).topLocation, i = Te(n).topTimeBucket, a = r.length > 0 ? `主要标签包括 ${r.join("、")}。` : "这段时间还没有形成明显的标签集中。", s = o ? `最常出现的地点是 ${o.name}。` : "", p = i ? `写作多集中在 ${i.label}。` : "";
  return {
    text: `${t}共记录 ${e.entryDays} 天，缺失 ${e.missingDays} 天，总字数 ${e.totalWords}，最长连续记录 ${e.longestStreak} 天。${a}${s}${p}`,
    themes: r,
    progress: e.entryDays > 0 ? [`完成了 ${e.entryDays} 天记录，累计 ${e.totalWords} 字。`] : [],
    blockers: [],
    memorableMoments: []
  };
}
async function pr(t, e) {
  try {
    return await Tn(t);
  } catch (n) {
    const r = n instanceof Error ? n.message : "区间总结 AI 生成失败。";
    return t.generation.warnings.push(`AI 总结未生成：${r}`), e;
  }
}
function dr() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}
function fr(t, e, n, r) {
  return e === "month" ? ce(t, r.format("YYYY-MM")) : e === "year" ? le(t, r.format("YYYY")) : me(t, n);
}
async function yr(t, e) {
  await _(L.dirname(t), { recursive: !0 }), await J(t, JSON.stringify(e, null, 2), "utf-8");
}
function hr(t) {
  if (!t || typeof t != "object")
    throw new Error("报告文件内容无效。");
  return t;
}
async function Ke(t) {
  const e = await $(t, "utf-8");
  return hr(JSON.parse(e));
}
async function Z(t) {
  try {
    return (await Jt(t, { withFileTypes: !0 })).filter((n) => n.isFile() && n.name.toLowerCase().endsWith(".json")).map((n) => L.join(t, n.name));
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function vr(t) {
  const { startDate: e, endDate: n, requestedSections: r } = Xn(t), o = await tr(t.workspacePath, e, n), i = await nr(t.workspacePath, o), a = i.dailyEntries, s = Ae(a), p = lr(t.preset, e, n), g = mr(t.preset, e, n), v = (/* @__PURE__ */ new Date()).toISOString(), h = cr(a, r), j = gr(p, s, a), Y = {
    version: 1,
    reportId: g,
    preset: t.preset,
    period: {
      startDate: e.format("YYYY-MM-DD"),
      endDate: n.format("YYYY-MM-DD"),
      label: p,
      generatedAt: v,
      timezone: dr()
    },
    generation: {
      requestedSections: r,
      entryInsightPolicy: i.entryInsightPolicy,
      reusedEntryInsightCount: i.reusedEntryInsightCount,
      generatedEntryInsightCount: i.generatedEntryInsightCount,
      skippedEmptyDays: s.missingDays,
      warnings: [...i.warnings]
    },
    summary: j,
    source: s,
    dailyEntries: a,
    sections: h
  };
  Y.summary = await pr(Y, j);
  const K = fr(t.workspacePath, t.preset, g, e);
  return await yr(K, Y), Y;
}
function Lr(t, e) {
  if (e.startsWith("month_")) {
    const n = e.slice(6);
    return [
      ce(t, n),
      dn(t, n)
    ];
  }
  if (e.startsWith("year_")) {
    const n = e.slice(5);
    return [
      le(t, n),
      fn(t, n)
    ];
  }
  return [
    me(t, e),
    yn(t, e)
  ];
}
async function Cr(t) {
  let e = null;
  for (const n of t)
    try {
      return await Ke(n);
    } catch (r) {
      if (r.code === "ENOENT") {
        e = r;
        continue;
      }
      throw r;
    }
  throw e ?? new Error("报告不存在。");
}
async function Or(t) {
  return Cr(Lr(t.workspacePath, t.reportId));
}
async function Wr(t) {
  if (!t.trim())
    return [];
  const [e, n, r, o, i, a] = await Promise.all([
    Z(te(t)),
    Z(ee(t)),
    Z(ne(t)),
    Z(re(t)),
    Z(oe(t)),
    Z(ae(t))
  ]), s = [
    ...e,
    ...n,
    ...r,
    ...o,
    ...i,
    ...a
  ], p = await Promise.all(
    s.map(async (v) => {
      const h = await Ke(v);
      return {
        reportId: h.reportId,
        preset: h.preset,
        label: h.period.label,
        startDate: h.period.startDate,
        endDate: h.period.endDate,
        generatedAt: h.period.generatedAt,
        summaryText: h.summary.text
      };
    })
  ), g = /* @__PURE__ */ new Map();
  for (const v of p)
    g.has(v.reportId) || g.set(v.reportId, v);
  return [...g.values()].sort((v, h) => h.generatedAt.localeCompare(v.generatedAt));
}
let D = null, ut = !1, st = !1;
function Ir() {
  return D;
}
function br(t) {
  ut = t;
}
function Sr() {
  if (D) {
    if (D.webContents.isDevToolsOpened()) {
      D.webContents.focus();
      return;
    }
    D.webContents.openDevTools({ mode: "detach" });
  }
}
function Me() {
  Je.setApplicationMenu(null), ut = !1, st = !1, D = new Ht({
    width: 1440,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: Be,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: L.join(Re, "preload.mjs")
    }
  }), vt ? D.loadURL(vt) : D.loadFile(L.join(Pt, "index.html")), D.on("close", async (t) => {
    if (st || !ut || !D)
      return;
    t.preventDefault();
    const { response: e } = await ht.showMessageBox(D, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    e === 0 && (st = !0, D.close());
  }), D.on("closed", () => {
    ut = !1, st = !1, D = null;
  });
}
function wr() {
  H.on("window-all-closed", () => {
    process.platform !== "darwin" && (H.quit(), D = null);
  }), H.on("activate", () => {
    Ht.getAllWindows().length === 0 && Me();
  });
}
function jr() {
  W.handle(I.getBootstrap, async () => ({ config: await M() })), W.handle(I.getAiSettingsStatus, () => sn()), W.handle(I.saveAiSettings, (t, e) => un(e)), W.handle(I.saveAiApiKey, (t, e) => an(e)), W.handle(
    I.setJournalHeatmapEnabled,
    (t, e) => Ve(e)
  ), W.handle(I.setDayStartHour, (t, e) => tn(e)), W.handle(
    I.setFrontmatterVisibility,
    (t, e) => en(e)
  ), W.handle(I.setWindowDirtyState, (t, e) => {
    br(e.isDirty);
  }), W.handle(I.openExternalLink, async (t, e) => {
    const n = e.url.trim();
    if (!/^https:\/\/.+/i.test(n) && !/^mailto:.+/i.test(n))
      throw new Error("暂不支持打开这个地址。");
    await Ne.openExternal(n);
  }), W.handle(I.openDevTools, () => {
    Sr();
  }), W.handle(I.chooseWorkspace, async () => {
    const t = await M(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = Ir(), r = n ? await ht.showOpenDialog(n, e) : await ht.showOpenDialog(e);
    if (r.canceled || r.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const o = r.filePaths[0], i = rn(o, t);
    return await tt(i), {
      canceled: !1,
      workspacePath: o,
      config: i
    };
  }), W.handle(I.getWorkspaceTags, (t, e) => we(e)), W.handle(I.setWorkspaceTags, (t, e) => Hn(e)), W.handle(I.getWorkspaceWeatherOptions, (t, e) => $n(e)), W.handle(
    I.setWorkspaceWeatherOptions,
    (t, e) => Jn(e)
  ), W.handle(I.getWorkspaceLocationOptions, (t, e) => Nn(e)), W.handle(
    I.setWorkspaceLocationOptions,
    (t, e) => Pn(e)
  ), W.handle(I.readJournalEntry, (t, e) => je(e)), W.handle(I.createJournalEntry, (t, e) => Bn(e)), W.handle(I.saveJournalEntryBody, (t, e) => Rn(e)), W.handle(
    I.saveJournalEntryMetadata,
    (t, e) => xn(e)
  ), W.handle(I.getJournalMonthActivity, (t, e) => Zn(e)), W.handle(I.generateDailyInsights, (t, e) => Oe(e)), W.handle(I.generateRangeReport, (t, e) => vr(e)), W.handle(I.getRangeReport, (t, e) => Or(e)), W.handle(I.listRangeReports, (t, e) => Wr(e));
}
wr();
H.whenReady().then(() => {
  jr(), Me();
});
