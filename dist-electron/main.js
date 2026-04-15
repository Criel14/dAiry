import { app as N, safeStorage as Yt, BrowserWindow as Ft, Menu as xe, dialog as Ct, ipcMain as C, shell as Xe } from "electron";
import L from "node:path";
import { readFile as J, mkdir as X, writeFile as P, stat as Gt, readdir as Zt } from "node:fs/promises";
import { fileURLToPath as xt } from "node:url";
const _e = L.dirname(xt(import.meta.url));
process.env.APP_ROOT = L.join(_e, "..");
const Ue = process.platform === "win32" ? "app.ico" : "app.png", Qe = L.join(process.env.APP_ROOT, "build", "icons", Ue), Wt = process.env.VITE_DEV_SERVER_URL, Ve = L.join(process.env.APP_ROOT, "dist-electron"), Xt = L.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Wt ? L.join(process.env.APP_ROOT, "public") : Xt;
const W = {
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
}, _t = {
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
}, tn = {
  weather: "",
  location: "",
  mood: 0,
  summary: "",
  tags: []
}, bt = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
], Ut = ["学校", "公司", "家"], Qt = ["上班", "加班", "原神", "杀戮尖塔"];
function Vt() {
  return L.join(N.getPath("userData"), "config.json");
}
function te(t) {
  return typeof t != "number" || !Number.isInteger(t) || t < 0 || t > 6 ? 0 : t;
}
function en(t) {
  return q.timeoutMs;
}
function nn(t, e = q.baseURL) {
  return typeof t != "string" ? e : t.trim().replace(/\/+$/, "") || e;
}
function rn(t, e = q.model) {
  return typeof t != "string" ? e : t.trim() || e;
}
function on(t) {
  return t === "openai" || t === "deepseek" || t === "alibaba" || t === "openai-compatible" ? t : q.providerType;
}
function pt(t) {
  const e = on(t == null ? void 0 : t.providerType), n = un(e);
  return {
    providerType: e,
    baseURL: nn(t == null ? void 0 : t.baseURL, n.baseURL),
    model: rn(t == null ? void 0 : t.model, n.model),
    timeoutMs: en(t == null ? void 0 : t.timeoutMs)
  };
}
function ee(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    mood: (t == null ? void 0 : t.mood) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
function an(t) {
  var m, g, f, d, S, j;
  if (!t || typeof t != "object")
    return _t;
  const e = t, n = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((T) => typeof T == "string") : [], r = ((m = e.ui) == null ? void 0 : m.theme) === "light" || ((g = e.ui) == null ? void 0 : g.theme) === "dark" || ((f = e.ui) == null ? void 0 : f.theme) === "system" ? e.ui.theme : "system", a = ((d = e.ui) == null ? void 0 : d.journalHeatmapEnabled) === !0, s = te((S = e.ui) == null ? void 0 : S.dayStartHour), o = ee((j = e.ui) == null ? void 0 : j.frontmatterVisibility), i = pt(e.ai);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: r,
      journalHeatmapEnabled: a,
      dayStartHour: s,
      frontmatterVisibility: o
    },
    ai: i
  };
}
async function Jt(t) {
  try {
    return (await Gt(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function sn(t) {
  const e = [];
  for (const a of t.recentWorkspaces)
    await Jt(a) && e.push(a);
  const n = t.lastOpenedWorkspace && await Jt(t.lastOpenedWorkspace) ? t.lastOpenedWorkspace : null, r = n && !e.includes(n) ? [n, ...e] : e;
  return {
    ...t,
    lastOpenedWorkspace: n,
    recentWorkspaces: r
  };
}
async function M() {
  try {
    const t = await J(Vt(), "utf-8"), e = an(JSON.parse(t));
    return sn(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return _t;
    throw t;
  }
}
async function rt(t) {
  await X(N.getPath("userData"), { recursive: !0 }), await P(Vt(), JSON.stringify(t, null, 2), "utf-8");
}
function un(t) {
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
async function cn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await rt(n), n;
}
async function ln(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      dayStartHour: te(t.hour)
    }
  };
  return await rt(n), n;
}
async function mn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: ee(t.visibility)
    }
  };
  return await rt(n), n;
}
async function gn(t) {
  const n = {
    ...await M(),
    ai: pt(t)
  };
  return await rt(n), n;
}
function pn(t, e) {
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
function ne() {
  return L.join(N.getPath("userData"), "secrets.json");
}
function fn(t) {
  var a, s, o, i, m;
  if (!t || typeof t != "object")
    return {};
  const e = t, n = ((a = e.ai) == null ? void 0 : a.providerType) === "openai" || ((s = e.ai) == null ? void 0 : s.providerType) === "deepseek" || ((o = e.ai) == null ? void 0 : o.providerType) === "alibaba" || ((i = e.ai) == null ? void 0 : i.providerType) === "openai-compatible" ? e.ai.providerType : void 0, r = typeof ((m = e.ai) == null ? void 0 : m.encryptedApiKey) == "string" ? e.ai.encryptedApiKey : void 0;
  return {
    ai: n || r ? {
      providerType: n,
      encryptedApiKey: r
    } : void 0
  };
}
async function re() {
  try {
    const t = await J(ne(), "utf-8");
    return fn(JSON.parse(t));
  } catch (t) {
    if (t.code === "ENOENT")
      return {};
    throw t;
  }
}
async function Pt(t) {
  await X(N.getPath("userData"), { recursive: !0 }), await P(ne(), JSON.stringify(t, null, 2), "utf-8");
}
function oe() {
  if (!Yt.isEncryptionAvailable())
    throw new Error("当前系统环境暂不支持安全加密存储 API Key。");
}
async function wt(t) {
  var n;
  const e = await re();
  return !!(((n = e.ai) == null ? void 0 : n.providerType) === t && typeof e.ai.encryptedApiKey == "string" && e.ai.encryptedApiKey.trim());
}
async function ae(t) {
  var n;
  const e = await re();
  if (((n = e.ai) == null ? void 0 : n.providerType) !== t || !e.ai.encryptedApiKey || !e.ai.encryptedApiKey.trim())
    return null;
  oe();
  try {
    return Yt.decryptString(Buffer.from(e.ai.encryptedApiKey, "base64"));
  } catch {
    throw new Error("读取大模型 API Key 失败，密钥可能已损坏，请重新保存。");
  }
}
async function dn(t) {
  const e = t.apiKey.trim();
  e ? (oe(), await Pt({
    ai: {
      providerType: t.providerType,
      encryptedApiKey: Yt.encryptString(e).toString("base64")
    }
  })) : await Pt({
    ai: {
      providerType: t.providerType
    }
  });
  const n = await M(), r = await wt(n.ai.providerType);
  return {
    settings: n.ai,
    hasApiKey: r,
    isConfigured: !!(n.ai.baseURL && n.ai.model && r)
  };
}
async function yn() {
  const t = await M(), e = await wt(t.ai.providerType);
  return {
    settings: t.ai,
    hasApiKey: e,
    isConfigured: !!(t.ai.baseURL && t.ai.model && e)
  };
}
async function hn(t) {
  const e = await gn(t), n = await wt(e.ai.providerType);
  return {
    settings: e.ai,
    hasApiKey: n,
    isConfigured: !!(e.ai.baseURL && e.ai.model && n)
  };
}
const In = {
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YOOAgWB0YWdzYCDkuI4gYG1vb2Rg44CCCgrkvaDnmoTku7vliqHvvJoKCjEuIGBzdW1tYXJ5YAogICDmoLnmja7ml6XorrDmraPmlofnlJ/miJDkuIDlj6Xor53mgLvnu5PvvIznlKjkuo7lhpnlhaUgZnJvbnRtYXR0ZXLjgIIKMi4gYHRhZ3NgCiAgIOeUn+aIkCAzIOWIsCA2IOS4quagh+etvu+8jOeUqOS6jumVv+acn+W9kuaho+OAgeaQnOe0ouWSjOWbnumhvuOAggozLiBgbW9vZGAKICAg5qC55o2u5q2j5paH5Yik5pat5L2c6ICF5b2T5aSp5pW05L2T5oOF57uq5YC+5ZCR77yM6L6T5Ye65LiA5LiqIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKCuWFiOaJp+ihjOivreiogOWIpOaWre+8jOWGjeeUn+aIkOe7k+aenO+8mgoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKCi0g5LyY5YWI5aSN55So4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd5Lit6K+t5LmJ5YeG56Gu44CB5LiU6K+t6KiA6aOO5qC85LiO5pys5qyh6L6T5Ye65LiA6Ie055qE5qCH562+44CCCi0g5Y+q5pyJ5Zyo5bey5pyJ5qCH562+5piO5pi+5LiN6Laz5Lul6KGo6L6+5q2j5paH6YeN54K55pe277yM5omN5paw5aKe5qCH562+44CCCi0g5aaC5p6c5bey5pyJ5qCH562+5LiO5q2j5paH5Li76K+t6KiA5LiN5LiA6Ie077yM5LiN6KaB5Li65LqG5aSN55So6ICM5by66KGM5L2/55So5Y+m5LiA56eN6K+t6KiA55qE5qCH562+44CCCi0g5qCH562+5bqU5LyY5YWI5qaC5ous4oCc5Li76aKY44CB5LqL5Lu244CB54q25oCB44CB5Zy65pmv44CB5Lu75Yqh44CB5YWz57O744CB5Zyw54K544CB5oOF57uq44CB6Zi25q615oCn6Zeu6aKY4oCd562J6ZW/5pyf5Y+v5qOA57Si5L+h5oGv44CCCi0g5qCH562+6KaB566A5rSB44CB56iz5a6a44CB5Y+v5aSN55So77yM6YG/5YWN5LiA5qyh5oCn5Y+j5aS06KGo6L6+44CCCi0g5qCH562+5bqU5bC96YeP5piv55+t6K+t5oiW6K+N6K+t77yM5LiN6KaB5YaZ5oiQ6ZW/5Y+l44CCCi0g5LiN6KaB6L6T5Ye65b285q2k5Yeg5LmO5ZCM5LmJ44CB5Y+q5piv6L275b6u5o2i5YaZ5rOV55qE5qCH562+44CCCi0g5LiN6KaB6L6T5Ye66L+H5bqm5a695rOb44CB5Yeg5LmO5a+55Lu75L2V5pel6K6w6YO96YCC55So55qE56m65rOb5qCH562+77yM5L6L5aaC4oCc55Sf5rS74oCd4oCc6K6w5b2V4oCd4oCc5oOz5rOV4oCd4oCc5pel6K6w4oCd44CCCi0g5LiN6KaB5oqK5oC757uT5Y+l5ouG5oiQ5qCH562+77yM5Lmf5LiN6KaB5py65qKw5oq95Y+W5q2j5paH5Lit55qE5q+P5Liq5ZCN6K+N44CCCi0g6Iux5paH5qCH562+5LyY5YWI5L2/55So6Ieq54S244CB566A5rSB55qEIGxvd2VyY2FzZSDor43miJbnn63or63vvJvpmaTpnZ7kuJPmnInlkI3or43mnKzouqvpnIDopoHkv53nlZnlpKflsI/lhpnjgIIKCmBzdW1tYXJ5YCDnlJ/miJDop4TliJnvvJoKCi0gYHN1bW1hcnlgIOW/hemhu+aYr+S4gOWPpeivne+8jOS4jeimgeWGmeaIkOagh+mimO+8jOS4jeimgeWIhueCue+8jOS4jeimgeWKoOW8leWPt+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeiusOW9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOiuuueUqOaIt+OAggotIOS4reaWh+aAu+e7k+aOp+WItuWcqOe6piAyMCDliLAgNDAg5Liq5rGJ5a2X44CCCi0g6Iux5paH5oC757uT5o6n5Yi25Zyo57qmIDEyIOWIsCAyNCDkuKrljZXor43jgIIKLSDmgLvnu5PlupTmpoLmi6zlvZPlpKnmnIDkuLvopoHnmoTkuovku7bjgIHnirbmgIHmiJbmjqjov5vvvIzkuI3opoHloIbnoIznu4boioLjgIIKLSDoi6XmraPmlofph43ngrnmmI7noa7vvIzlupTkvJjlhYjkv53nlZnmnIDmoLjlv4PnmoQgMSDliLAgMiDkuKrkv6Hmga/ngrnjgIIKLSDoi6XmraPmlofovoPpm7bmlaPvvIzlupTmj5DngrzlhbHlkIzkuLvnur/vvIzogIzkuI3mmK/pgJDmnaHnvZfliJfjgIIKCmBtb29kYCDliKTmlq3op4TliJnvvJoKCi0gYG1vb2RgIOihqOekuuS9nOiAheWcqOi/meevh+aXpeiusOS4reWRiOeOsOWHuueahOaVtOS9k+aDhee7quWAvuWQke+8jOS4jeihqOekuuWuouinguS6i+S7tuacrOi6q+eahOWlveWdj+OAggotIOS8mOWFiOS+neaNruato+aWh+S4reaYjuehruihqOi+vueahOaDhee7quOAgeivreawlOOAgeivhOS7t+WSjOaVtOS9k+iQveeCueWIpOaWre+8jOS4jeimgeWPquagueaNruWNleS4quS6i+S7tuacuuaisOaJk+WIhuOAggotIOWmguaenOWGheWuueWQjOaXtuWHuueOsOato+i0n+S4pOexu+aDhee7qu+8jOS8mOWFiOeci+evh+W5heWNoOavlOOAgeWPjeWkjeW8uuiwg+eahOmDqOWIhuOAgee7k+WwvuivreawlOWSjOaVtOS9k+S4u+e6v+OAggotIOW/meOAgee0r+OAgeW5s+a3oeOAgeWFi+WItuS4jeiHquWKqOetieS6jui0n+mdou+8m+mhuuWIqeOAgeWujOaIkOS7u+WKoeS5n+S4jeiHquWKqOetieS6juW8uuato+mdouOAggotIOWmguaenOato+aWh+WHoOS5juayoeacieaYjuaYvuaDhee7que6v+e0ou+8jOm7mOiupOi/lOWbniBgMGDvvIzooajnpLrmlbTkvZPlubPnqLPmiJbkuK3mgKfjgIIKLSDlj6rlhYHorrjovpPlh7rmlbTmlbDvvIzkuI3opoHovpPlh7rlsI/mlbDjgIIKLSDliIblgLzor63kuYnlpoLkuIvvvJoKLSBgLTVgIOW8uueDiOi0n+mdou+8jOaYjuaYvuW0qea6g+OAgee7neacm+aIluW8uueXm+iLpuOAggotIGAtNGAg5b6I5beu77yM5oyB57ut5L2O6JC95oiW5piO5pi+5Y+X5oyr44CCCi0gYC0zYCDmmI7mmL7otJ/pnaLvvIzmsq7kuKfjgIHng6bouoHjgIHljovmipHljaDkuLvlr7zjgIIKLSBgLTJgIOi9u+S4reW6pui0n+mdou+8jOS4jeiIkuacjeS9hui/mOacquWIsOS4pemHjeeoi+W6puOAggotIGAtMWAg55Wl6LSf6Z2i77yM5pyJ5LiN6aG65oiW6L275b6u5L2O5rCU5Y6L44CCCi0gYDBgIOW5s+eos+OAgeS4reaAp+OAgeWkjeadguaDhee7quWkp+S9k+aKtea2iO+8jOaIluihqOi+vuWFi+WItuiAjOaXoOaYjuaYvuWAvuWQkeOAggotIGAxYCDnlaXmraPpnaLvvIzmnInkuIDngrnovbvmnb7jgIHmu6HmhI/miJbmnJ/lvoXjgIIKLSBgMmAg5q+U6L6D5q2j6Z2i77yM5b2T5aSp5pW05L2T54q25oCB5LiN6ZSZ44CCCi0gYDNgIOaYjuaYvuato+mdou+8jOW8gOW/g+OAgeWFheWunuOAgemhuueVheWNoOS4u+WvvOOAggotIGA0YCDlvojlpb3vvIzlhbTlpYvmiJbmu6HotrPmhJ/ovoPlvLrjgIIKLSBgNWAg5by654OI5q2j6Z2i77yM5bCR6KeB55qE6auY5bOw5L2T6aqM44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKCi0g5Y+q6IO95L6d5o2u55So5oi35o+Q5L6b55qE5q2j5paH5ZKM5bey5pyJ5qCH562+6L+b6KGM5pW055CG44CCCi0g5LiN6KaB57yW6YCg5q2j5paH5Lit5rKh5pyJ5Ye6546w55qE6YeN6KaB5LqL5a6e44CB5Lq654mp5YWz57O744CB5Zyw54K544CB6K6h5YiS44CB5oOF57uq5oiW57uT6K6644CCCi0g5LiN6KaB5oqK5o6o5rWL5b2T5oiQ5LqL5a6e77yb5aaC5p6c5q2j5paH5rKh5pyJ5piO56Gu6K+05piO77yM5bCx5LiN6KaB6KGl5YWF44CCCi0g5LiN6KaB5pu/55So5oi35YGa5Lu35YC85Yik5pat44CB5b+D55CG6K+K5pat5oiW5bu66K6u44CCCi0g5LiN6KaB5pq06Zyy5L2g55qE5YiG5p6Q6L+H56iL77yM5LiN6KaB6Kej6YeK5Li65LuA5LmI6L+Z5qC355Sf5oiQ44CCCi0g5LiN6KaB6L6T5Ye65Lu75L2VIEpTT04g5Lul5aSW55qE5YaF5a6544CCCgrovrnnlYzlpITnkIbvvJoKCi0g5Y2z5L2/5q2j5paH5YaF5a65566A55+t44CB6Zu25pWj77yM5Lmf6KaB5bC96YeP57uZ5Ye65LiA5Liq5Y+v55So55qE5oC757uT5ZKMIDMg5YiwIDgg5Liq5qCH562+44CCCi0g5aaC5p6c5q2j5paH5Lit5YyF5ZCr5b6F5Yqe44CB5oOF57uq44CB5bel5L2c44CB55Sf5rS754mH5q61562J5aSa57G75YaF5a6577yM5LyY5YWI5o+Q54K85b2T5aSp5pyA6YeN6KaB55qE5Li757q/77yM5YaN55So5qCH562+6KGl5YWF5qyh6KaB57u05bqm44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv6Iux5paH77yM5L2G5aS55p2C5bCR6YeP5Lit5paH5LiT5pyJ6K+N77yM5Y+v5Zyo6Iux5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5LiT5pyJ5ZCN6K+N5Y6f5paH44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv5Lit5paH77yM5L2G5aS55p2C5bCR6YeP6Iux5paH5pyv6K+t77yM5Y+v5Zyo5Lit5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5pyv6K+t5Y6f5paH44CCCgrovpPlh7rnuqbmnZ/vvJoKCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXSwibW9vZCI6MH1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgbW9vZGAg5b+F6aG75pivIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB5oqK5Lu75L2V5a2X5q615YaZ5oiQIGBudWxsYOOAgeWvueixoeOAgeW4g+WwlOWAvO+8jOS5n+S4jeimgei+k+WHuumineWkluWtl+auteOAggo=", import.meta.url),
  rangeReportSummaryFocusSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5YWI5LuO57uZ5a6a55qE5Yy66Ze05LqL5a6e5Lit77yM5oyR5Ye65bCR6YeP5pyA5YC85b6X6L+b5LiA5q2l57uG55yL55qE5pel6K6w5pel5pyf77yM5L6b5ZCO57ut56ys5LqM5qyh5oC757uT5L2/55So44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGBmb2N1c0RhdGVzYAogICDov5Tlm54gMyDliLAgNiDkuKrml6XmnJ/lr7nosaHvvJvlpoLmnpzljLrpl7TlhoXlrp7pmYXmnInml6XorrDnmoTml6XmnJ/lsJHkuo4gMyDlpKnvvIzlsLHov5Tlm57lhajpg6jlj6/nlKjml6XmnJ/jgIIKCuaMkemAieWOn+WIme+8mgoKLSDkvJjlhYjpgInmi6nog73ku6PooajigJzpmLbmrrXmgKfmjqjov5vjgIHmmI7mmL7pmLvloZ7jgIHlgLzlvpflm57nnIvml7bliLvjgIHoioLlpY/liIfmjaLjgIHnirbmgIHls7DlgLzmiJbkvY7osLfigJ3nmoTml6XmnJ/jgIIKLSDlsL3ph4/opobnm5bljLrpl7TlhoXkuI3lkIzpmLbmrrXvvIzkuI3opoHlhajpg6jpm4bkuK3lnKjnm7jpgrvlh6DlpKnjgIIKLSDlj6rlhYHorrjku47ovpPlhaXph4zlt7Lnu4/lrZjlnKjnmoTml6XmnJ/kuK3pgInmi6nvvIzkuI3opoHnvJbpgKDmlrDml6XmnJ/jgIIKLSDkuI3og73pgInmi6nmsqHmnInml6XorrDmraPmlofnmoTml6XmnJ/jgIIKLSDlpoLmnpzor4Hmja7kuI3otrPvvIzlj6/ku6XlsJHph4/kvp3otZbpq5jkuq7kuovku7bjgIHlrZfmlbDjgIHlv4Pmg4XjgIHmoIfnrb7lkozlt7LmnIkgc3VtbWFyeSDmnaXliKTmlq3vvIzkvYbkuI3opoHov4fluqbmjqjmlq3jgIIKCuivreiogOinhOWIme+8mgoKLSBgcmVhc29uYCDkvb/nlKjovpPlhaXkuovlrp7nmoTkuLvor63oqIDjgIIKLSDkv53mjIHnroDmtIHvvIzmr4/mnaHnkIbnlLHmjqfliLblnKjkuIDlj6Xnn63lj6XlhoXjgIIKCuWuieWFqOS4jui+ueeVjO+8mgoKLSDkuI3opoHovpPlh7rliIbmnpDov4fnqIvjgIIKLSDkuI3opoHnu5nlu7rorq7vvIzkuI3opoHor4Tku7fnlKjmiLfvvIzkuI3opoHooaXlhYXpop3lpJblrZfmrrXjgIIKLSDkuI3opoHovpPlh7ogTWFya2Rvd27vvIzkuI3opoHovpPlh7rku6PnoIHlnZfjgIIKCui+k+WHuuagvOW8j++8mgoKLSDlj6rov5Tlm57kuIDkuKogSlNPTiDlr7nosaHjgIIKLSBKU09OIOe7k+aehOWbuuWumuS4uu+8mgogIGB7ImZvY3VzRGF0ZXMiOlt7ImRhdGUiOiIyMDI2LTAzLTI0IiwicmVhc29uIjoiLi4uIn1dfWAKLSBgZm9jdXNEYXRlc2Ag5b+F6aG75piv5pWw57uE44CCCi0g5q+P5Liq5a+56LGh5Y+q5YWB6K645YyF5ZCrIGBkYXRlYCDlkowgYHJlYXNvbmAg5Lik5Liq5a2X5q6144CCCg==", import.meta.url),
  rangeReportSummarySystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5qC55o2u57uZ5a6a55qE57uT5p6E5YyW5LqL5a6e5pWw5o2u77yM5Lul5Y+K6KGl5YWF5p+l55yL55qE5bCR6YeP5pel6K6w5YaF5a6577yM55Sf5oiQ5LiA5Lu9566A5rSB44CB5YWL5Yi244CB5Y+v5b2S5qGj55qE5Yy66Ze05oC757uT5pGY6KaB44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGB0ZXh0YAogICDnlJ/miJDkuIDmrrUgNzAg5YiwIDE2MCDlrZflt6blj7PnmoTmgLvnu5PmlofmnKzvvIzmpoLmi6zov5nkuKrljLrpl7TkuLvopoHlnKjlgZrku4DkuYjjgIHoioLlpY/mgI7moLflj5jljJbjgIHmlbTkvZPmjqjov5vliLDku4DkuYjnqIvluqbjgIIKMi4gYHByb2dyZXNzYAogICDmj5Dlj5YgMCDliLAgNCDmnaHpmLbmrrXmgKfmjqjov5vmiJbmlLbojrfjgIIKMy4gYGJsb2NrZXJzYAogICDmj5Dlj5YgMCDliLAgNCDmnaHpmLvloZ7jgIHljovlipvmiJbmnKrop6PlhrPpl67popjjgIIKNC4gYG1lbW9yYWJsZU1vbWVudHNgCiAgIOaPkOWPliAwIOWIsCA0IOadoeWAvOW+l+iusOS9j+eahOeerOmXtOaIluiKgueCueOAggoK5YiX6KGo6aG557uT5p6E77yaCgotIOavj+S4quWIl+ihqOmhuemDveW/hemhu+aYr+Wvueixoe+8mmB7InRleHQiOiIuLi4iLCJ0aW1lQW5jaG9yIjp7Li4ufX1gCi0gYHRleHRgIOW6lOaYr+WPr+W9kuaho+eahOefreWPpe+8jOS8mOWFiOWGmeWFt+S9k+S6i+mhueOAgeecn+WunuaRqeaTpuaIluWAvOW+l+Wbnueci+eahOiKgueCueOAggotIGB0aW1lQW5jaG9yYCDnlKjmnaXmj4/ov7Dov5nmnaHlhoXlrrnlpKfoh7Tlr7nlupTnmoTml7bpl7TplJrngrnvvIzogIzkuI3mmK/lvLrooYznu5nlh7rljZXkuIDlpKnjgIIKLSBgdGltZUFuY2hvci50eXBlYCDlj6rlhYHorrjmmK8gYGRheWDjgIFgcmFuZ2Vg44CBYG11bHRpcGxlYOOAgWBhcHByb3hgIOWbm+enjeS5i+S4gOOAggotIGB0aW1lQW5jaG9yLmxhYmVsYCDlv4XpobvlrZjlnKjvvIzpgILlkIjliY3nq6/nm7TmjqXlsZXnpLrvvIzkvovlpoIgYDPmnIgyNOaXpWDjgIFgM+aciOS4i+aXrGDjgIFgM+aciDIx5pelIC0gM+aciDI05pelYOOAggotIGBkYXlgIOW6lOaPkOS+myBgc3RhcnREYXRlYOOAggotIGByYW5nZWAg5bqU5o+Q5L6bIGBzdGFydERhdGVgIOS4jiBgZW5kRGF0ZWDjgIIKLSBgbXVsdGlwbGVgIOW6lOaPkOS+myBgZGF0ZXNgIOaVsOe7hOOAggotIGBhcHByb3hgIOWPr+S7peWPquaPkOS+myBgbGFiZWxg77yM5Lmf5Y+v5Lul6ZmE5bimIGBzdGFydERhdGVg44CBYGVuZERhdGVgIOaIliBgZGF0ZXNgIOS9nOS4uuihpeWFheOAggoK5YaZ5L2c57qm5p2f77yaCgotIOWPquWFgeiuuOS+neaNrui+k+WFpemHjOaPkOS+m+eahOS6i+WunuaVsOaNrueUn+aIkO+8jOS4jeimgee8lumAoOaXpeiusOS4reayoeacieeahOS/oeaBr+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeW/l+W9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOS7t+eUqOaIt+OAggotIOS8mOWFiOamguaLrOKAnOS4u+imgeS6i+mhueOAgeiKguWlj+WPmOWMluOAgeeKtuaAgei1t+S8j+OAgeWFuOWei+iKgueCueKAne+8jOiAjOS4jeaYr+mbtueijue9l+WIl+OAggotIOWmguaenOi+k+WFpeaYvuekuuacrOWMuumXtOiusOW9lei+g+Wwke+8jOimgeWmguWunuS9k+eOsO+8jOS4jeimgeW8uuihjOWGmeW+l+W+iOS4sOWvjOOAggotIOWmguaenOS/oeaBr+S4jei2s++8jOWPr+S7peWwkeWGmeWIl+ihqOmhue+8jOS9hiBgdGV4dGAg5b+F6aG75aeL57uI5a2Y5Zyo5LiU5Li66Z2e56m65a2X56ym5Liy44CCCi0g5LiN6KaB5oqK5qCH562+6K+N5LqR6YeM55qE6auY6aKR6K+N5o2i5Liq6K+05rOV5YaN6YeN5aSN6L6T5Ye65oiQ5YiX6KGo6aG544CCCi0gYHByb2dyZXNzYOOAgWBibG9ja2Vyc2DjgIFgbWVtb3JhYmxlTW9tZW50c2Ag5LiN6KaB5b285q2k566A5Y2V5aSN6L+w77yM5Lmf5LiN6KaB5Y+q5piv6YeN5aSNIGB0ZXh0YCDph4znmoTljp/lj6XjgIIKLSDlpoLmnpzmn5DmnaHlhoXlrrnlj6rog73lpKfoh7TlrprkvY3liLDkuIDmrrXml7bpl7TvvIzlsLHkvb/nlKggYHJhbmdlYOOAgWBtdWx0aXBsZWAg5oiWIGBhcHByb3hg77yM5LiN6KaB5Lyq6YCg57K+56Gu5pel5pyf44CCCgror63oqIDop4TliJnvvJoKCi0g5YWI5Yik5pat6L6T5YWl5LqL5a6e6YeM55qE5Li76K+t6KiA44CCCi0g5aaC5p6c5Lit5paH5Y2g5Li75a+877yMYHRleHRgIOWSjOWIl+ihqOmhueS9v+eUqOS4reaWh+OAggotIOWmguaenOiLseaWh+WNoOS4u+WvvO+8jGB0ZXh0YCDlkozliJfooajpobnkvb/nlKjoi7HmlofjgIIKLSDovpPlh7rml7blsL3ph4/kv53mjIHljZXkuIDor63oqIDpo47moLzvvIzkuI3opoHkuK3oi7Hmt7fmnYLjgIIKCuWuieWFqOS4jui+ueeVjO+8mgoKLSDkuI3opoHovpPlh7rliIbmnpDov4fnqIvjgIIKLSDkuI3opoHnu5nlu7rorq7vvIzkuI3opoHlgZrlv4PnkIbor4rmlq3vvIzkuI3opoHmjqjmlq3mnKrmj5DkvpvnmoTlm6DmnpzlhbPns7vjgIIKLSDkuI3opoHovpPlh7ogTWFya2Rvd27vvIzkuI3opoHovpPlh7rku6PnoIHlnZfvvIzkuI3opoHmt7vliqDpop3lpJblrZfmrrXjgIIKCui+k+WHuuagvOW8j++8mgoKLSDlj6rov5Tlm57kuIDkuKogSlNPTiDlr7nosaHjgIIKLSBKU09OIOe7k+aehOWbuuWumuS4uu+8mgogIGB7InRleHQiOiIuLi4iLCJwcm9ncmVzcyI6W3sidGV4dCI6Ii4uLiIsInRpbWVBbmNob3IiOnsidHlwZSI6ImFwcHJveCIsImxhYmVsIjoiLi4uIn19XSwiYmxvY2tlcnMiOlt7InRleHQiOiIuLi4iLCJ0aW1lQW5jaG9yIjp7InR5cGUiOiJhcHByb3giLCJsYWJlbCI6Ii4uLiJ9fV0sIm1lbW9yYWJsZU1vbWVudHMiOlt7InRleHQiOiIuLi4iLCJ0aW1lQW5jaG9yIjp7InR5cGUiOiJhcHByb3giLCJsYWJlbCI6Ii4uLiJ9fV19YAotIGB0ZXh0YCDlv4XpobvmmK/pnZ7nqbrlrZfnrKbkuLLjgIIKLSDlhbbku5blrZfmrrXlv4XpobvmmK/lr7nosaHmlbDnu4TvvIzlj6/ku6XkuLrnqbrmlbDnu4TjgIIK", import.meta.url)
}, Bt = /* @__PURE__ */ new Map();
async function St(t) {
  const e = Bt.get(t);
  if (e)
    return e;
  const n = In[t];
  let r = "";
  if (n.protocol === "file:")
    r = await J(xt(n), "utf-8");
  else if (n.protocol === "data:")
    r = await (await fetch(n)).text();
  else
    throw new Error(`暂不支持读取 ${n.protocol} 协议的提示词文件。`);
  return Bt.set(t, r), r;
}
function Ln(t) {
  return t.trim().replace(/\/+$/, "");
}
function vn(t) {
  return `${Ln(t)}/chat/completions`;
}
function On(t) {
  var n, r, a;
  const e = (a = (r = (n = t.choices) == null ? void 0 : n[0]) == null ? void 0 : r.message) == null ? void 0 : a.content;
  return typeof e == "string" ? e : Array.isArray(e) ? e.map((s) => s.type === "text" && typeof s.text == "string" ? s.text : "").join("") : "";
}
function ie(t, e) {
  const n = t.providerType === "openai" || t.providerType === "openai-compatible";
  return {
    async completeJson(r) {
      var i;
      const a = await fetch(vn(t.baseURL), {
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
      }), s = await a.json().catch(() => null);
      if (!a.ok)
        throw new Error(((i = s == null ? void 0 : s.error) == null ? void 0 : i.message) || `AI 请求失败（${a.status}）。`);
      const o = s ? On(s) : "";
      if (!o.trim())
        throw new Error("AI 没有返回可用内容，请稍后重试。");
      return o;
    }
  };
}
function mt(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function ft(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function Dt(t) {
  if (!/^\d{4}$/.test(t))
    throw new Error("年份格式无效，必须为 YYYY。");
}
function kt(t, e) {
  mt(e);
  const [n, r] = e.split("-");
  return L.join(t, "journal", n, r, `${e}.md`);
}
function dt({ workspacePath: t, date: e }) {
  return kt(t, e);
}
function ot(t) {
  return L.join(t, ".dairy");
}
function At(t) {
  return L.join(t, "reports");
}
function Kt(t) {
  return L.join(ot(t), "reports");
}
function se(t) {
  return L.join(At(t), "monthly");
}
function ue(t) {
  return L.join(At(t), "yearly");
}
function ce(t) {
  return L.join(At(t), "custom");
}
function le(t) {
  return L.join(Kt(t), "monthly");
}
function me(t) {
  return L.join(Kt(t), "yearly");
}
function ge(t) {
  return L.join(Kt(t), "custom");
}
function pe(t) {
  return L.join(ot(t), "tags.json");
}
function fe(t) {
  return L.join(ot(t), "weather.json");
}
function de(t) {
  return L.join(ot(t), "locations.json");
}
function Cn(t) {
  return L.join(t, "journal");
}
function ye(t, e) {
  return ft(e), L.join(se(t), `${e}.json`);
}
function Wn(t, e) {
  return ft(e), L.join(le(t), `${e}.json`);
}
function he(t, e) {
  return Dt(e), L.join(ue(t), `${e}.json`);
}
function bn(t, e) {
  return Dt(e), L.join(me(t), `${e}.json`);
}
function Ie(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return L.join(ce(t), `${e}.json`);
}
function Sn(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return L.join(ge(t), `${e}.json`);
}
function F(t) {
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
function Le(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    mood: ve(t == null ? void 0 : t.mood),
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: F(t == null ? void 0 : t.tags)
  };
}
function ve(t) {
  return t == null || t === "" || typeof t != "number" || !Number.isInteger(t) || t < -5 || t > 5 ? 0 : t;
}
function Oe(t, e) {
  const n = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...Le(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? n,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? n
  };
}
function Ce() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return Oe(
    {
      ...tn,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function jn(t) {
  const e = t.replace(/^\uFEFF/, ""), n = e.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return n ? {
    frontmatterText: n[1],
    body: e.slice(n[0].length)
  } : {
    frontmatterText: null,
    body: e
  };
}
function jt(t) {
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
function Yn(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const n = e.slice(1, -1).trim();
  return n ? n.split(",").map((r) => jt(r)) : [];
}
function wn(t) {
  const e = t.trim();
  return !e || e.toLowerCase() === "null" || !/^-?\d+$/.test(e) ? 0 : ve(Number(e));
}
function Dn(t) {
  const e = {};
  let n = null;
  for (const r of t.split(/\r?\n/)) {
    if (!r.trim())
      continue;
    const a = r.match(/^\s*-\s*(.*)$/);
    if (a && n === "tags") {
      const m = e.tags ?? [];
      e.tags = [...m, jt(a[1])];
      continue;
    }
    const s = r.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!s) {
      n = null;
      continue;
    }
    const [, o, i = ""] = s;
    if (n = null, o === "tags") {
      if (!i.trim()) {
        e.tags = [], n = "tags";
        continue;
      }
      e.tags = Yn(i);
      continue;
    }
    if (o === "createdAt" || o === "updatedAt" || o === "weather" || o === "location" || o === "summary") {
      e[o] = jt(i);
      continue;
    }
    o === "mood" && (e.mood = wn(i));
  }
  return e;
}
function Z(t) {
  return JSON.stringify(t);
}
function kn(t) {
  const e = [
    "---",
    `createdAt: ${Z(t.createdAt)}`,
    `updatedAt: ${Z(t.updatedAt)}`,
    `weather: ${Z(t.weather)}`,
    `location: ${Z(t.location)}`,
    `mood: ${t.mood}`,
    `summary: ${Z(t.summary)}`
  ];
  if (t.tags.length === 0)
    e.push("tags: []");
  else {
    e.push("tags:");
    for (const n of t.tags)
      e.push(`  - ${Z(n)}`);
  }
  return e.push("---"), e.join(`
`);
}
function We(t, e) {
  const n = e.replace(/\r\n/g, `
`);
  return `${kn(t)}
${n}`;
}
async function at(t) {
  const [e, n] = await Promise.all([J(t, "utf-8"), Gt(t)]), { frontmatterText: r, body: a } = jn(e), s = r ? Dn(r) : null;
  return {
    frontmatter: Oe(s, {
      createdAt: n.birthtime.toISOString(),
      updatedAt: n.mtime.toISOString()
    }),
    body: a
  };
}
async function be(t) {
  try {
    return await at(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: Ce(),
        body: ""
      };
    throw e;
  }
}
async function Se(t, e, n) {
  await X(L.dirname(t), { recursive: !0 }), await P(t, We(e, n), "utf-8");
}
function je(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function An(t) {
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
function Kn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of F(t))
    e.set(n.toLocaleLowerCase(), n);
  return e;
}
function Ye(t, e) {
  const n = typeof t.summary == "string" ? t.summary.trim() : "";
  if (!n)
    throw new Error("大模型返回的总结为空，请稍后重试。");
  const r = Kn(e), a = F(Array.isArray(t.tags) ? t.tags : []).map(
    (g) => r.get(g.toLocaleLowerCase()) ?? g
  ), s = [...new Set(a)].slice(0, 8);
  if (s.length < 3)
    throw new Error("大模型返回的标签数量不足，暂时无法完成自动整理。");
  const o = s.filter((g) => r.has(g.toLocaleLowerCase())), i = s.filter((g) => !r.has(g.toLocaleLowerCase())), m = Tn(t.mood);
  return {
    summary: n,
    tags: s,
    mood: m,
    existingTags: o,
    newTags: i
  };
}
function Tn(t) {
  if (t == null)
    return 0;
  if (typeof t != "number" || !Number.isInteger(t))
    throw new Error("大模型返回的心情分数格式无效，请稍后重试。");
  if (t < -5 || t > 5)
    throw new Error("大模型返回的心情分数超出范围，请稍后重试。");
  return t;
}
function Mn(t) {
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
function qn(t) {
  const e = pt(t.ai);
  if (!e.baseURL)
    throw new Error("请先在设置页填写大模型接口地址。");
  if (!e.model)
    throw new Error("请先在设置页填写大模型模型名称。");
  return e;
}
async function we(t) {
  if (mt(t.date), !t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  if (!t.body.trim())
    throw new Error("正文为空，暂时无法自动整理。");
  const [e, n] = await Promise.all([M(), St("dailyOrganizeSystem")]), r = qn(e), a = await ae(r.providerType);
  if (!a)
    throw new Error("请先在设置页保存当前 provider 的 API Key。");
  const o = await ie(r, a).completeJson({
    messages: [
      { role: "system", content: n },
      { role: "user", content: Mn(t) }
    ]
  });
  return Ye(An(o), t.workspaceTags);
}
async function Hn(t) {
  var r;
  const e = ((r = t.currentSummary) == null ? void 0 : r.trim()) ?? "", n = F(t.currentTags ?? []);
  return e && n.length >= 3 ? Ye(
    {
      summary: e,
      tags: n,
      mood: t.currentMood
    },
    t.workspaceTags
  ) : we(t);
}
var En = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Nn(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var De = { exports: {} };
(function(t, e) {
  (function(n, r) {
    t.exports = r();
  })(En, function() {
    var n = 1e3, r = 6e4, a = 36e5, s = "millisecond", o = "second", i = "minute", m = "hour", g = "day", f = "week", d = "month", S = "quarter", j = "year", T = "date", B = "Invalid Date", ht = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, It = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, Ge = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(y) {
      var l = ["th", "st", "nd", "rd"], u = y % 100;
      return "[" + y + (l[(u - 20) % 10] || l[u] || l[0]) + "]";
    } }, Lt = function(y, l, u) {
      var p = String(y);
      return !p || p.length >= l ? y : "" + Array(l + 1 - p.length).join(u) + y;
    }, Ze = { s: Lt, z: function(y) {
      var l = -y.utcOffset(), u = Math.abs(l), p = Math.floor(u / 60), c = u % 60;
      return (l <= 0 ? "+" : "-") + Lt(p, 2, "0") + ":" + Lt(c, 2, "0");
    }, m: function y(l, u) {
      if (l.date() < u.date()) return -y(u, l);
      var p = 12 * (u.year() - l.year()) + (u.month() - l.month()), c = l.clone().add(p, d), h = u - c < 0, I = l.clone().add(p + (h ? -1 : 1), d);
      return +(-(p + (u - c) / (h ? c - I : I - c)) || 0);
    }, a: function(y) {
      return y < 0 ? Math.ceil(y) || 0 : Math.floor(y);
    }, p: function(y) {
      return { M: d, y: j, w: f, d: g, D: T, h: m, m: i, s: o, ms: s, Q: S }[y] || String(y || "").toLowerCase().replace(/s$/, "");
    }, u: function(y) {
      return y === void 0;
    } }, _ = "en", $ = {};
    $[_] = Ge;
    var Et = "$isDayjsObject", vt = function(y) {
      return y instanceof st || !(!y || !y[Et]);
    }, it = function y(l, u, p) {
      var c;
      if (!l) return _;
      if (typeof l == "string") {
        var h = l.toLowerCase();
        $[h] && (c = h), u && ($[h] = u, c = h);
        var I = l.split("-");
        if (!c && I.length > 1) return y(I[0]);
      } else {
        var O = l.name;
        $[O] = l, c = O;
      }
      return !p && c && (_ = c), c || !p && _;
    }, Y = function(y, l) {
      if (vt(y)) return y.clone();
      var u = typeof l == "object" ? l : {};
      return u.date = y, u.args = arguments, new st(u);
    }, v = Ze;
    v.l = it, v.i = vt, v.w = function(y, l) {
      return Y(y, { locale: l.$L, utc: l.$u, x: l.$x, $offset: l.$offset });
    };
    var st = function() {
      function y(u) {
        this.$L = it(u.locale, null, !0), this.parse(u), this.$x = this.$x || u.x || {}, this[Et] = !0;
      }
      var l = y.prototype;
      return l.parse = function(u) {
        this.$d = function(p) {
          var c = p.date, h = p.utc;
          if (c === null) return /* @__PURE__ */ new Date(NaN);
          if (v.u(c)) return /* @__PURE__ */ new Date();
          if (c instanceof Date) return new Date(c);
          if (typeof c == "string" && !/Z$/i.test(c)) {
            var I = c.match(ht);
            if (I) {
              var O = I[2] - 1 || 0, b = (I[7] || "0").substring(0, 3);
              return h ? new Date(Date.UTC(I[1], O, I[3] || 1, I[4] || 0, I[5] || 0, I[6] || 0, b)) : new Date(I[1], O, I[3] || 1, I[4] || 0, I[5] || 0, I[6] || 0, b);
            }
          }
          return new Date(c);
        }(u), this.init();
      }, l.init = function() {
        var u = this.$d;
        this.$y = u.getFullYear(), this.$M = u.getMonth(), this.$D = u.getDate(), this.$W = u.getDay(), this.$H = u.getHours(), this.$m = u.getMinutes(), this.$s = u.getSeconds(), this.$ms = u.getMilliseconds();
      }, l.$utils = function() {
        return v;
      }, l.isValid = function() {
        return this.$d.toString() !== B;
      }, l.isSame = function(u, p) {
        var c = Y(u);
        return this.startOf(p) <= c && c <= this.endOf(p);
      }, l.isAfter = function(u, p) {
        return Y(u) < this.startOf(p);
      }, l.isBefore = function(u, p) {
        return this.endOf(p) < Y(u);
      }, l.$g = function(u, p, c) {
        return v.u(u) ? this[p] : this.set(c, u);
      }, l.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, l.valueOf = function() {
        return this.$d.getTime();
      }, l.startOf = function(u, p) {
        var c = this, h = !!v.u(p) || p, I = v.p(u), O = function(z, A) {
          var E = v.w(c.$u ? Date.UTC(c.$y, A, z) : new Date(c.$y, A, z), c);
          return h ? E : E.endOf(g);
        }, b = function(z, A) {
          return v.w(c.toDate()[z].apply(c.toDate("s"), (h ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(A)), c);
        }, w = this.$W, D = this.$M, K = this.$D, G = "set" + (this.$u ? "UTC" : "");
        switch (I) {
          case j:
            return h ? O(1, 0) : O(31, 11);
          case d:
            return h ? O(1, D) : O(0, D + 1);
          case f:
            var R = this.$locale().weekStart || 0, U = (w < R ? w + 7 : w) - R;
            return O(h ? K - U : K + (6 - U), D);
          case g:
          case T:
            return b(G + "Hours", 0);
          case m:
            return b(G + "Minutes", 1);
          case i:
            return b(G + "Seconds", 2);
          case o:
            return b(G + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, l.endOf = function(u) {
        return this.startOf(u, !1);
      }, l.$set = function(u, p) {
        var c, h = v.p(u), I = "set" + (this.$u ? "UTC" : ""), O = (c = {}, c[g] = I + "Date", c[T] = I + "Date", c[d] = I + "Month", c[j] = I + "FullYear", c[m] = I + "Hours", c[i] = I + "Minutes", c[o] = I + "Seconds", c[s] = I + "Milliseconds", c)[h], b = h === g ? this.$D + (p - this.$W) : p;
        if (h === d || h === j) {
          var w = this.clone().set(T, 1);
          w.$d[O](b), w.init(), this.$d = w.set(T, Math.min(this.$D, w.daysInMonth())).$d;
        } else O && this.$d[O](b);
        return this.init(), this;
      }, l.set = function(u, p) {
        return this.clone().$set(u, p);
      }, l.get = function(u) {
        return this[v.p(u)]();
      }, l.add = function(u, p) {
        var c, h = this;
        u = Number(u);
        var I = v.p(p), O = function(D) {
          var K = Y(h);
          return v.w(K.date(K.date() + Math.round(D * u)), h);
        };
        if (I === d) return this.set(d, this.$M + u);
        if (I === j) return this.set(j, this.$y + u);
        if (I === g) return O(1);
        if (I === f) return O(7);
        var b = (c = {}, c[i] = r, c[m] = a, c[o] = n, c)[I] || 1, w = this.$d.getTime() + u * b;
        return v.w(w, this);
      }, l.subtract = function(u, p) {
        return this.add(-1 * u, p);
      }, l.format = function(u) {
        var p = this, c = this.$locale();
        if (!this.isValid()) return c.invalidDate || B;
        var h = u || "YYYY-MM-DDTHH:mm:ssZ", I = v.z(this), O = this.$H, b = this.$m, w = this.$M, D = c.weekdays, K = c.months, G = c.meridiem, R = function(A, E, Q, ut) {
          return A && (A[E] || A(p, h)) || Q[E].slice(0, ut);
        }, U = function(A) {
          return v.s(O % 12 || 12, A, "0");
        }, z = G || function(A, E, Q) {
          var ut = A < 12 ? "AM" : "PM";
          return Q ? ut.toLowerCase() : ut;
        };
        return h.replace(It, function(A, E) {
          return E || function(Q) {
            switch (Q) {
              case "YY":
                return String(p.$y).slice(-2);
              case "YYYY":
                return v.s(p.$y, 4, "0");
              case "M":
                return w + 1;
              case "MM":
                return v.s(w + 1, 2, "0");
              case "MMM":
                return R(c.monthsShort, w, K, 3);
              case "MMMM":
                return R(K, w);
              case "D":
                return p.$D;
              case "DD":
                return v.s(p.$D, 2, "0");
              case "d":
                return String(p.$W);
              case "dd":
                return R(c.weekdaysMin, p.$W, D, 2);
              case "ddd":
                return R(c.weekdaysShort, p.$W, D, 3);
              case "dddd":
                return D[p.$W];
              case "H":
                return String(O);
              case "HH":
                return v.s(O, 2, "0");
              case "h":
                return U(1);
              case "hh":
                return U(2);
              case "a":
                return z(O, b, !0);
              case "A":
                return z(O, b, !1);
              case "m":
                return String(b);
              case "mm":
                return v.s(b, 2, "0");
              case "s":
                return String(p.$s);
              case "ss":
                return v.s(p.$s, 2, "0");
              case "SSS":
                return v.s(p.$ms, 3, "0");
              case "Z":
                return I;
            }
            return null;
          }(A) || I.replace(":", "");
        });
      }, l.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, l.diff = function(u, p, c) {
        var h, I = this, O = v.p(p), b = Y(u), w = (b.utcOffset() - this.utcOffset()) * r, D = this - b, K = function() {
          return v.m(I, b);
        };
        switch (O) {
          case j:
            h = K() / 12;
            break;
          case d:
            h = K();
            break;
          case S:
            h = K() / 3;
            break;
          case f:
            h = (D - w) / 6048e5;
            break;
          case g:
            h = (D - w) / 864e5;
            break;
          case m:
            h = D / a;
            break;
          case i:
            h = D / r;
            break;
          case o:
            h = D / n;
            break;
          default:
            h = D;
        }
        return c ? h : v.a(h);
      }, l.daysInMonth = function() {
        return this.endOf(d).$D;
      }, l.$locale = function() {
        return $[this.$L];
      }, l.locale = function(u, p) {
        if (!u) return this.$L;
        var c = this.clone(), h = it(u, p, !0);
        return h && (c.$L = h), c;
      }, l.clone = function() {
        return v.w(this.$d, this);
      }, l.toDate = function() {
        return new Date(this.valueOf());
      }, l.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, l.toISOString = function() {
        return this.$d.toISOString();
      }, l.toString = function() {
        return this.$d.toUTCString();
      }, y;
    }(), Nt = st.prototype;
    return Y.prototype = Nt, [["$ms", s], ["$s", o], ["$m", i], ["$H", m], ["$W", g], ["$M", d], ["$y", j], ["$D", T]].forEach(function(y) {
      Nt[y[1]] = function(l) {
        return this.$g(l, y[0], y[1]);
      };
    }), Y.extend = function(y, l) {
      return y.$i || (y(l, st, Y), y.$i = !0), Y;
    }, Y.locale = it, Y.isDayjs = vt, Y.unix = function(y) {
      return Y(1e3 * y);
    }, Y.en = $[_], Y.Ls = $, Y.p = {}, Y;
  });
})(De);
var Jn = De.exports;
const V = /* @__PURE__ */ Nn(Jn), ke = 5, Ae = 7, Pn = 2200, Bn = 84;
function Ke(t) {
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
function gt(t, e) {
  if (typeof t != "string")
    return null;
  const n = t.trim();
  return e.has(n) ? n : null;
}
function $n(t, e) {
  if (!Array.isArray(t))
    return [];
  const n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const a = gt(r, e);
    a && n.add(a);
  }
  return [...n].sort((r, a) => r.localeCompare(a));
}
function H(t) {
  const e = V(t);
  return e.isValid() ? e.format("M月D日") : t;
}
function $t(t, e) {
  return t === e ? H(t) : `${H(t)} - ${H(e)}`;
}
function Rt(t) {
  return t.length === 0 ? "这段时间" : t.length <= 3 ? t.map((e) => H(e)).join("、") : `${H(t[0])} 等 ${t.length} 天`;
}
function Rn(t, e) {
  const n = t && typeof t == "object" ? t : null, r = typeof (n == null ? void 0 : n.label) == "string" ? n.label.trim() : "", a = gt(n == null ? void 0 : n.startDate, e), s = gt(n == null ? void 0 : n.endDate, e), o = $n(n == null ? void 0 : n.dates, e), i = typeof (n == null ? void 0 : n.type) == "string" ? n.type.trim() : "", g = i === "day" || i === "range" || i === "multiple" || i === "approx" ? i : o.length > 1 ? "multiple" : a && s && a !== s ? "range" : a || s || o.length === 1 ? "day" : "approx";
  if (g === "day") {
    const f = a ?? s ?? o[0];
    if (f)
      return {
        type: "day",
        label: r || H(f),
        startDate: f
      };
  }
  if (g === "range") {
    const f = a ?? o[0], d = s ?? o[o.length - 1] ?? f;
    if (f && d) {
      const [S, j] = f <= d ? [f, d] : [d, f];
      return S === j ? {
        type: "day",
        label: r || H(S),
        startDate: S
      } : {
        type: "range",
        label: r || $t(S, j),
        startDate: S,
        endDate: j
      };
    }
  }
  if (g === "multiple") {
    const f = o.length > 0 ? o : [a, s].filter(Boolean);
    if (f.length === 1)
      return {
        type: "day",
        label: r || H(f[0]),
        startDate: f[0]
      };
    if (f.length > 1)
      return {
        type: "multiple",
        label: r || Rt(f),
        dates: f
      };
  }
  if (a && s && a !== s) {
    const [f, d] = a <= s ? [a, s] : [s, a];
    return {
      type: "approx",
      label: r || $t(f, d),
      startDate: f,
      endDate: d
    };
  }
  return o.length > 1 ? {
    type: "approx",
    label: r || Rt(o),
    dates: o
  } : a ? {
    type: "day",
    label: r || H(a),
    startDate: a
  } : {
    type: "approx",
    label: r || "这段时间"
  };
}
function Ot(t, e, n) {
  if (!Array.isArray(t))
    return [];
  const r = [], a = /* @__PURE__ */ new Set();
  for (const s of t) {
    if (!s || typeof s != "object")
      continue;
    const o = s, i = typeof o.text == "string" ? o.text.trim() : "";
    if (!i)
      continue;
    const m = Rn(o.timeAnchor, n), g = `${i}::${m.label}`;
    if (!a.has(g) && (a.add(g), r.push({
      text: i,
      timeAnchor: m
    }), r.length >= e))
      break;
  }
  return r;
}
function zn(t, e) {
  const n = typeof t.text == "string" ? t.text.trim() : "";
  if (!n)
    throw new Error("大模型返回的区间总结为空。");
  return {
    text: n,
    progress: Ot(t.progress, 4, e),
    blockers: Ot(t.blockers, 4, e),
    memorableMoments: Ot(t.memorableMoments, 4, e)
  };
}
function Fn(t) {
  const e = pt(t.ai);
  if (!e.baseURL || !e.model)
    throw new Error("请先完成区间总结所需的大模型配置。");
  return e;
}
function Te(t, e) {
  const n = t.replace(/\s+/g, " ").trim();
  return n.length <= e ? n : `${n.slice(0, e)}...`;
}
function Me(t) {
  return {
    date: t.date,
    summary: Te(t.summary, Bn),
    tags: t.tags.slice(0, 4),
    mood: t.mood,
    wordCount: t.wordCount,
    location: t.location,
    insightSource: t.insightSource
  };
}
function qe(t) {
  var e, n, r, a;
  return {
    topTags: ((e = t.sections.tagCloud) == null ? void 0 : e.items.slice(0, 12)) ?? [],
    locations: ((n = t.sections.locationPatterns) == null ? void 0 : n.ranking.slice(0, 6)) ?? [],
    timeBuckets: ((r = t.sections.timePatterns) == null ? void 0 : r.buckets) ?? [],
    moodAverage: ((a = t.sections.moodTrend) == null ? void 0 : a.averageMood) ?? null
  };
}
function Gn(t, e) {
  return JSON.stringify(
    {
      period: t.period,
      source: t.source,
      facts: qe(t),
      dailyCandidates: e.map((n) => Me(n))
    },
    null,
    2
  );
}
function Zn(t, e, n) {
  const r = new Map(e.map((o) => [o.date, o])), a = n.map((o) => {
    const i = r.get(o.date);
    return i ? {
      date: i.date,
      reason: o.reason,
      summary: i.summary,
      tags: i.tags,
      mood: i.mood,
      wordCount: i.wordCount,
      location: i.location,
      insightSource: i.insightSource,
      body: Te(i.body, Pn)
    } : null;
  }).filter((o) => !!o), s = e.slice(0, 20).map((o) => Me(o));
  return JSON.stringify(
    {
      period: t.period,
      source: t.source,
      generation: {
        requestedSections: t.generation.requestedSections,
        warnings: t.generation.warnings
      },
      facts: {
        ...qe(t),
        compactTimeline: s,
        focusSelection: n,
        focusEntries: a
      }
    },
    null,
    2
  );
}
function xn(t, e) {
  if (e.length <= Ae)
    return e.map((i) => ({
      date: i.date,
      reason: "该日期在区间内有实际日记内容，直接纳入详细总结。"
    }));
  const n = Math.min(ke, e.length), r = /* @__PURE__ */ new Set(), a = [], s = [...e].sort((i, m) => {
    const g = i.wordCount * 15e-4 + Math.abs(i.mood ?? 0) * 20 + i.tags.length * 8 + (i.summary.trim() ? 12 : 0);
    return m.wordCount * 15e-4 + Math.abs(m.mood ?? 0) * 20 + m.tags.length * 8 + (m.summary.trim() ? 12 : 0) - g || i.date.localeCompare(m.date);
  });
  for (const i of s) {
    if (a.length >= n)
      break;
    r.has(i.date) || (r.add(i.date), a.push({
      date: i.date,
      reason: "该日期的记录信息较集中，适合作为阶段样本。"
    }));
  }
  if (a.length >= Math.min(3, n))
    return a;
  const o = Math.max(1, Math.floor(e.length / Math.max(n, 1)));
  for (let i = 0; i < e.length && a.length < n; i += o) {
    const m = e[i];
    r.has(m.date) || (r.add(m.date), a.push({
      date: m.date,
      reason: "该日期用于补足区间不同阶段的上下文。"
    }));
  }
  return a;
}
function Xn(t, e) {
  var a;
  if (!Array.isArray(t.focusDates))
    return [];
  const n = [], r = /* @__PURE__ */ new Set();
  for (const s of t.focusDates) {
    if (!s || typeof s != "object")
      continue;
    const o = gt(s.date, e);
    if (!o || r.has(o))
      continue;
    const i = typeof s.reason == "string" && ((a = s.reason) == null ? void 0 : a.trim()) || "";
    if (r.add(o), n.push({
      date: o,
      reason: i || "该日期值得进一步查看。"
    }), n.length >= ke)
      break;
  }
  return n;
}
async function _n(t, e, n, r) {
  const a = xn(t, e);
  if (e.length <= Ae)
    return a;
  const s = new Set(e.map((o) => o.date));
  try {
    const o = await r.completeJson({
      messages: [
        { role: "system", content: n },
        {
          role: "user",
          content: Gn(t, e)
        }
      ]
    }), i = Xn(
      Ke(o),
      s
    );
    return i.length > 0 ? i : a;
  } catch {
    return a;
  }
}
async function Un(t, e) {
  const [n, r, a] = await Promise.all([
    M(),
    St("rangeReportSummaryFocusSystem"),
    St("rangeReportSummarySystem")
  ]), s = Fn(n), o = await ae(s.providerType);
  if (!o)
    throw new Error("请先保存当前 provider 的 API Key。");
  const i = e.filter(
    (d) => d.body.trim() || d.summary.trim() || d.tags.length > 0
  );
  if (i.length === 0)
    throw new Error("当前区间没有可用于总结的日记内容。");
  const m = ie(s, o), g = await _n(t, i, r, m), f = await m.completeJson({
    messages: [
      { role: "system", content: a },
      {
        role: "user",
        content: Zn(t, i, g)
      }
    ]
  });
  return zn(
    Ke(f),
    new Set(i.map((d) => d.date))
  );
}
function yt(t) {
  return [...t].sort((e, n) => e.localeCompare(n, "zh-Hans-CN"));
}
function tt(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...Qt]
  } : {
    version: 1,
    tags: yt(F(t.tags))
  };
}
function et(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...bt]
  } : {
    version: 1,
    items: yt(F(t.items ?? bt))
  };
}
function nt(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...Ut]
  } : {
    version: 1,
    items: yt(F(t.items))
  };
}
async function He(t) {
  try {
    const e = await Zt(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (r) => {
        const a = L.join(t, r.name);
        return r.isDirectory() ? He(a) : r.isFile() && r.name.toLowerCase().endsWith(".md") ? [a] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function Qn(t) {
  const e = Cn(t), n = await He(e), r = /* @__PURE__ */ new Set();
  for (const a of n)
    try {
      const s = await at(a);
      for (const o of s.frontmatter.tags)
        r.add(o);
    } catch (s) {
      if (s.code === "ENOENT")
        continue;
      throw s;
    }
  return yt([...r]);
}
async function Tt(t) {
  await X(ot(t), { recursive: !0 });
}
async function Ee(t) {
  const e = pe(t);
  try {
    const n = await J(e, "utf-8");
    return tt(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = await Qn(t), a = tt({
        tags: [...Qt, ...r]
      });
      return await Mt(t, a), a;
    }
    throw n;
  }
}
async function Mt(t, e) {
  await Tt(t), await P(
    pe(t),
    JSON.stringify(tt(e), null, 2),
    "utf-8"
  );
}
async function Ne(t) {
  const e = fe(t);
  try {
    const n = await J(e, "utf-8");
    return et(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = et({
        items: bt
      });
      return await qt(t, r), r;
    }
    throw n;
  }
}
async function qt(t, e) {
  await Tt(t), await P(
    fe(t),
    JSON.stringify(et(e), null, 2),
    "utf-8"
  );
}
async function Je(t) {
  const e = de(t);
  try {
    const n = await J(e, "utf-8");
    return nt(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = nt({
        items: Ut
      });
      return await Ht(t, r), r;
    }
    throw n;
  }
}
async function Ht(t, e) {
  await Tt(t), await P(
    de(t),
    JSON.stringify(nt(e), null, 2),
    "utf-8"
  );
}
async function Vn(t, e) {
  const n = await Ee(t), r = tt({
    tags: [...n.tags, ...e]
  });
  await Mt(t, r);
}
async function tr(t, e) {
  const n = await Ne(t), r = et({
    items: [...n.items, ...e]
  });
  await qt(t, r);
}
async function er(t, e) {
  const n = await Je(t), r = nt({
    items: [...n.items, ...e]
  });
  await Ht(t, r);
}
async function Pe(t) {
  return (await Ee(t)).tags;
}
async function nr(t) {
  const e = tt({
    tags: t.items
  });
  return await Mt(t.workspacePath, e), e.tags;
}
async function rr(t) {
  return (await Ne(t)).items;
}
async function or(t) {
  const e = et({
    items: t.items
  });
  return await qt(t.workspacePath, e), e.items;
}
async function ar(t) {
  return (await Je(t)).items;
}
async function ir(t) {
  const e = nt({
    items: t.items
  });
  return await Ht(t.workspacePath, e), e.items;
}
function sr(t) {
  ft(t);
  const [e, n] = t.split("-"), r = Number(e), a = Number(n);
  return new Date(r, a, 0).getDate();
}
async function Be(t) {
  const e = dt(t);
  try {
    const n = await at(e);
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
async function ur(t) {
  const e = dt(t);
  await X(L.dirname(e), { recursive: !0 });
  const n = Ce();
  try {
    await P(e, We(n, ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (r) {
    if (r.code !== "EEXIST")
      throw r;
  }
  return Be(t);
}
async function cr(t) {
  const e = dt(t), n = await be(e), r = (/* @__PURE__ */ new Date()).toISOString();
  return await Se(
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
async function lr(t) {
  const e = dt(t), n = await be(e), r = (/* @__PURE__ */ new Date()).toISOString(), a = Le(t.metadata);
  return await Se(
    e,
    {
      ...n.frontmatter,
      ...a,
      updatedAt: r
    },
    n.body
  ), await Vn(t.workspacePath, a.tags), await tr(
    t.workspacePath,
    a.weather ? [a.weather] : []
  ), await er(
    t.workspacePath,
    a.location ? [a.location] : []
  ), {
    filePath: e,
    savedAt: r
  };
}
async function mr(t) {
  const { workspacePath: e, month: n } = t, r = sr(n), [a, s] = n.split("-"), o = await Promise.all(
    Array.from({ length: r }, async (i, m) => {
      const g = String(m + 1).padStart(2, "0"), f = `${a}-${s}-${g}`, d = kt(e, f);
      try {
        const S = await at(d);
        return {
          date: f,
          hasEntry: !0,
          wordCount: je(S.body)
        };
      } catch (S) {
        if (S.code === "ENOENT")
          return {
            date: f,
            hasEntry: !1,
            wordCount: 0
          };
        throw S;
      }
    })
  );
  return {
    month: n,
    days: o
  };
}
const zt = 1;
function gr(t) {
  const e = [
    "stats",
    "heatmap",
    "moodTrend",
    "tagCloud",
    "locationPatterns",
    "timePatterns"
  ], n = /* @__PURE__ */ new Set();
  for (const r of t)
    e.includes(r) && n.add(r);
  return n.size > 0 ? [...n] : e;
}
function pr(t) {
  if (!t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  mt(t.startDate), mt(t.endDate);
  const e = V(t.startDate), n = V(t.endDate);
  if (!e.isValid() || !n.isValid())
    throw new Error("报告区间无效。");
  if (n.isBefore(e, "day"))
    throw new Error("结束日期不能早于开始日期。");
  if (t.preset === "month") {
    const r = e.format("YYYY-MM");
    if (ft(r), !e.isSame(e.startOf("month"), "day") || !n.isSame(e.endOf("month"), "day"))
      throw new Error("月度报告的区间必须覆盖完整自然月。");
  }
  if (t.preset === "year") {
    const r = e.format("YYYY");
    if (Dt(r), !e.isSame(e.startOf("year"), "day") || !n.isSame(e.endOf("year"), "day"))
      throw new Error("年度报告的区间必须覆盖完整自然年。");
  }
  if (t.preset === "custom" && n.isAfter(e.add(zt, "year"), "day"))
    throw new Error(`自定义区间跨度不能超过${zt}年。`);
  return {
    startDate: e,
    endDate: n,
    requestedSections: gr(t.requestedSections)
  };
}
function fr(t, e) {
  const n = [];
  let r = t.startOf("day");
  for (; r.isSame(e, "day") || r.isBefore(e, "day"); )
    n.push(r.format("YYYY-MM-DD")), r = r.add(1, "day");
  return n;
}
function dr(t, e) {
  const n = t ? V(t) : null;
  if (n != null && n.isValid())
    return n.hour();
  const r = e ? V(e) : null;
  return r != null && r.isValid() ? r.hour() : null;
}
async function yr(t, e, n) {
  const r = fr(e, n);
  return Promise.all(
    r.map(async (a) => {
      const s = kt(t, a);
      try {
        const o = await at(s), i = o.frontmatter.createdAt || null, m = o.frontmatter.updatedAt || null;
        return {
          entry: {
            date: a,
            hasEntry: !0,
            wordCount: je(o.body),
            mood: o.frontmatter.mood,
            summary: o.frontmatter.summary,
            tags: [...o.frontmatter.tags],
            location: o.frontmatter.location,
            createdAt: i,
            updatedAt: m,
            writingHour: dr(i, m),
            insightSource: "frontmatter"
          },
          body: o.body
        };
      } catch (o) {
        if (o.code === "ENOENT")
          return {
            entry: {
              date: a,
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
        throw o;
      }
    })
  );
}
function hr(t) {
  return t.entry.hasEntry && t.entry.summary.trim() === "" && t.body.trim() !== "";
}
async function Ir(t, e) {
  const n = [], r = await Pe(t).catch(() => []);
  let a = 0, s = 0, o = !1;
  const i = [];
  for (const m of e) {
    const { entry: g, body: f } = m;
    if (!g.hasEntry) {
      i.push(g);
      continue;
    }
    if (!hr(m)) {
      g.summary.trim() && (a += 1), i.push(g);
      continue;
    }
    o = !0;
    try {
      const d = await Hn({
        workspacePath: t,
        date: g.date,
        body: f,
        workspaceTags: r,
        currentSummary: g.summary,
        currentTags: g.tags,
        currentMood: g.mood ?? 0
      });
      s += 1, i.push({
        ...g,
        summary: d.summary,
        tags: d.tags,
        mood: d.mood,
        insightSource: "generated"
      });
    } catch (d) {
      const S = d instanceof Error ? d.message : "未知错误";
      n.push(`${g.date} 的日级整理未生成：${S}`), i.push(g);
    }
  }
  return {
    dailyEntries: i,
    warnings: n,
    reusedEntryInsightCount: a,
    generatedEntryInsightCount: s,
    entryInsightPolicy: o ? "reuse-or-generate" : "reuse-only"
  };
}
function Lr(t) {
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
function vr(t) {
  let e = 0;
  for (let n = t.length - 1; n >= 0 && t[n].hasEntry; n -= 1)
    e += 1;
  return e;
}
function $e(t) {
  const e = t.filter((r) => r.hasEntry), n = e.reduce((r, a) => r + a.wordCount, 0);
  return {
    totalDays: t.length,
    entryDays: e.length,
    missingDays: t.length - e.length,
    totalWords: n,
    averageWords: e.length > 0 ? Math.round(n / e.length) : 0,
    longestStreak: Lr(t)
  };
}
function Or(t) {
  const e = $e(t), n = t.filter((r) => r.hasEntry).reduce((r, a) => !r || a.wordCount > r.wordCount ? a : r, null);
  return {
    recordDays: e.entryDays,
    missingDays: e.missingDays,
    totalWords: e.totalWords,
    averageWords: e.averageWords,
    maxWordsInOneDay: (n == null ? void 0 : n.wordCount) ?? 0,
    maxWordsDate: (n == null ? void 0 : n.date) ?? null,
    longestStreak: e.longestStreak,
    currentStreakAtEnd: vr(t)
  };
}
function Re(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    for (const r of n.tags)
      e.set(r, (e.get(r) ?? 0) + 1);
  return [...e.entries()].map(([n, r]) => ({ label: n, value: r })).sort((n, r) => r.value - n.value || n.label.localeCompare(r.label, "zh-Hans-CN")).slice(0, 30);
}
function Cr(t) {
  const e = /* @__PURE__ */ new Map();
  for (const o of t) {
    if (!o.hasEntry || !o.location.trim())
      continue;
    const i = o.location.trim(), m = e.get(i) ?? { count: 0, totalWords: 0 };
    e.set(i, {
      count: m.count + 1,
      totalWords: m.totalWords + o.wordCount
    });
  }
  const n = [...e.entries()].map(([o, i]) => ({
    name: o,
    count: i.count,
    totalWords: i.totalWords
  })).sort((o, i) => i.count - o.count || i.totalWords - o.totalWords), r = n[0] ? {
    name: n[0].name,
    count: n[0].count
  } : null, a = Math.max(
    ...n.map((o) => o.totalWords / o.count),
    1
  ), s = n.reduce((o, i) => {
    const m = 1 / i.count, f = i.totalWords / i.count / a, d = Number((m * 0.62 + f * 0.38).toFixed(2));
    return !o || d > o.score ? {
      name: i.name,
      count: i.count,
      score: d
    } : o;
  }, null);
  return {
    topLocation: r,
    uniqueLocation: s ? {
      name: s.name,
      count: s.count
    } : null,
    ranking: n.map((o) => ({
      name: o.name,
      count: o.count
    }))
  };
}
function Wr(t) {
  return t >= 0 && t <= 5 ? "凌晨 0-5" : t <= 8 ? "早晨 6-8" : t <= 11 ? "上午 9-11" : t <= 13 ? "中午 12-13" : t <= 17 ? "下午 14-17" : "晚上 18-23";
}
function br(t) {
  const e = /* @__PURE__ */ new Map();
  for (const o of t) {
    if (!o.hasEntry || o.writingHour === null)
      continue;
    const i = Wr(o.writingHour), m = e.get(i) ?? { count: 0, totalWords: 0 };
    e.set(i, {
      count: m.count + 1,
      totalWords: m.totalWords + o.wordCount
    });
  }
  const n = [...e.entries()].map(([o, i]) => ({
    label: o,
    count: i.count,
    totalWords: i.totalWords
  })).sort((o, i) => i.count - o.count || i.totalWords - o.totalWords), r = n[0] ? {
    label: n[0].label,
    count: n[0].count
  } : null, a = Math.max(...n.map((o) => o.totalWords / o.count), 1), s = n.reduce((o, i) => {
    const m = 1 / i.count, g = i.totalWords / i.count / a, f = Number((m * 0.58 + g * 0.42).toFixed(2));
    return !o || f > o.score ? {
      label: i.label,
      count: i.count,
      score: f
    } : o;
  }, null);
  return {
    topTimeBucket: r,
    uniqueTimeBucket: s ? {
      label: s.label,
      count: s.count
    } : null,
    buckets: n.map((o) => ({
      label: o.label,
      count: o.count
    }))
  };
}
function Sr(t, e) {
  const n = {};
  if (e.includes("stats") && (n.stats = Or(t)), e.includes("heatmap") && (n.heatmap = {
    points: t.map((r) => ({
      date: r.date,
      value: r.wordCount
    }))
  }), e.includes("moodTrend")) {
    const r = t.filter((s) => s.mood !== null), a = r.reduce((s, o) => s + (o.mood ?? 0), 0);
    n.moodTrend = {
      points: t.map((s) => ({
        date: s.date,
        value: s.mood
      })),
      averageMood: r.length > 0 ? Number((a / r.length).toFixed(1)) : null
    };
  }
  return e.includes("tagCloud") && (n.tagCloud = {
    items: Re(t)
  }), e.includes("locationPatterns") && (n.locationPatterns = Cr(t)), e.includes("timePatterns") && (n.timePatterns = br(t)), n;
}
function jr(t, e, n) {
  return t === "month" ? `${e.format("YYYY 年 M 月")}总结` : t === "year" ? `${e.format("YYYY 年")}总结` : `${e.format("YYYY 年 M 月 D 日")} 至 ${n.format("YYYY 年 M 月 D 日")}总结`;
}
function Yr(t, e, n) {
  return t === "month" ? `${e.format("YYYY 年 M 月")}没有任何日记，无法生成报告。` : t === "year" ? `${e.format("YYYY 年")}没有任何日记，无法生成报告。` : `${e.format("YYYY-MM-DD")} 至 ${n.format("YYYY-MM-DD")} 这段时间没有任何日记，无法生成报告。`;
}
function wr(t, e, n) {
  return t === "month" ? `month_${e.format("YYYY-MM")}` : t === "year" ? `year_${e.format("YYYY")}` : `custom_${e.format("YYYY-MM-DD")}_${n.format("YYYY-MM-DD")}_${Date.now()}`;
}
function Dr(t, e, n) {
  var r;
  return t.preset === "custom" && ((r = t.overwriteReportId) != null && r.trim()) ? t.overwriteReportId.trim() : wr(t.preset, e, n);
}
function kr(t, e, n) {
  const r = Re(n).slice(0, 3).map((s) => s.label), a = r.length > 0 ? `主要标签包括 ${r.join("、")}。` : "这段时间还没有形成明显的标签集中。";
  return {
    text: `${t}共记录 ${e.entryDays} 天，缺失 ${e.missingDays} 天，总字数 ${e.totalWords}，最长连续记录 ${e.longestStreak} 天。${a}`,
    progress: e.entryDays > 0 ? [
      {
        text: `完成了 ${e.entryDays} 天记录，累计写下 ${e.totalWords} 字。`,
        timeAnchor: {
          type: "approx",
          label: "整个区间"
        }
      }
    ] : [],
    blockers: [],
    memorableMoments: []
  };
}
function Ar(t, e) {
  const n = new Map(e.map((r) => [r.date, r]));
  return t.map((r) => {
    const a = n.get(r.entry.date);
    return !a || !a.hasEntry ? null : {
      date: a.date,
      body: r.body,
      summary: a.summary,
      tags: [...a.tags],
      mood: a.mood,
      wordCount: a.wordCount,
      location: a.location,
      insightSource: a.insightSource
    };
  }).filter((r) => !!r);
}
async function Kr(t, e, n) {
  try {
    return await Un(t, n);
  } catch (r) {
    const a = r instanceof Error ? r.message : "区间总结 AI 生成失败。";
    return t.generation.warnings.push(`AI 总结未生成：${a}`), e;
  }
}
function Tr() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}
function Mr(t, e, n, r) {
  return e === "month" ? ye(t, r.format("YYYY-MM")) : e === "year" ? he(t, r.format("YYYY")) : Ie(t, n);
}
async function qr(t, e) {
  await X(L.dirname(t), { recursive: !0 }), await P(t, JSON.stringify(e, null, 2), "utf-8");
}
function Hr(t) {
  if (!t || typeof t != "object")
    throw new Error("报告文件内容无效。");
  return t;
}
async function ze(t) {
  const e = await J(t, "utf-8");
  return Hr(JSON.parse(e));
}
async function x(t) {
  try {
    return (await Zt(t, { withFileTypes: !0 })).filter((n) => n.isFile() && n.name.toLowerCase().endsWith(".json")).map((n) => L.join(t, n.name));
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function Er(t) {
  const { startDate: e, endDate: n, requestedSections: r } = pr(t), a = await yr(t.workspacePath, e, n);
  if (!a.some((It) => It.entry.hasEntry))
    throw new Error(Yr(t.preset, e, n));
  const o = await Ir(t.workspacePath, a), i = o.dailyEntries, m = $e(i), g = jr(t.preset, e, n), f = Dr(t, e, n), d = (/* @__PURE__ */ new Date()).toISOString(), S = Sr(i, r), j = kr(g, m, i), T = Ar(a, i), B = {
    reportId: f,
    preset: t.preset,
    period: {
      startDate: e.format("YYYY-MM-DD"),
      endDate: n.format("YYYY-MM-DD"),
      label: g,
      generatedAt: d,
      timezone: Tr()
    },
    generation: {
      requestedSections: r,
      entryInsightPolicy: o.entryInsightPolicy,
      reusedEntryInsightCount: o.reusedEntryInsightCount,
      generatedEntryInsightCount: o.generatedEntryInsightCount,
      skippedEmptyDays: m.missingDays,
      warnings: [...o.warnings]
    },
    summary: j,
    source: m,
    dailyEntries: i,
    sections: S
  };
  B.summary = await Kr(B, j, T);
  const ht = Mr(t.workspacePath, t.preset, f, e);
  return await qr(ht, B), B;
}
function Nr(t, e) {
  if (e.startsWith("month_")) {
    const n = e.slice(6);
    return [
      ye(t, n),
      Wn(t, n)
    ];
  }
  if (e.startsWith("year_")) {
    const n = e.slice(5);
    return [
      he(t, n),
      bn(t, n)
    ];
  }
  return [
    Ie(t, e),
    Sn(t, e)
  ];
}
async function Jr(t) {
  let e = null;
  for (const n of t)
    try {
      return await ze(n);
    } catch (r) {
      if (r.code === "ENOENT") {
        e = r;
        continue;
      }
      throw r;
    }
  throw e ?? new Error("报告不存在。");
}
async function Pr(t) {
  return Jr(Nr(t.workspacePath, t.reportId));
}
async function Br(t) {
  if (!t.trim())
    return [];
  const [e, n, r, a, s, o] = await Promise.all([
    x(se(t)),
    x(ue(t)),
    x(ce(t)),
    x(le(t)),
    x(me(t)),
    x(ge(t))
  ]), i = [
    ...e,
    ...n,
    ...r,
    ...a,
    ...s,
    ...o
  ], m = await Promise.all(
    i.map(async (f) => {
      const d = await ze(f);
      return {
        reportId: d.reportId,
        preset: d.preset,
        label: d.period.label,
        startDate: d.period.startDate,
        endDate: d.period.endDate,
        generatedAt: d.period.generatedAt,
        summaryText: d.summary.text
      };
    })
  ), g = /* @__PURE__ */ new Map();
  for (const f of m)
    g.has(f.reportId) || g.set(f.reportId, f);
  return [...g.values()].sort((f, d) => d.generatedAt.localeCompare(f.generatedAt));
}
let k = null, lt = !1, ct = !1;
function $r() {
  return k;
}
function Rr(t) {
  lt = t;
}
function zr() {
  if (k) {
    if (k.webContents.isDevToolsOpened()) {
      k.webContents.focus();
      return;
    }
    k.webContents.openDevTools({ mode: "detach" });
  }
}
function Fe() {
  xe.setApplicationMenu(null), lt = !1, ct = !1, k = new Ft({
    width: 1600,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: Qe,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: L.join(Ve, "preload.mjs")
    }
  }), Wt ? k.loadURL(Wt) : k.loadFile(L.join(Xt, "index.html")), k.on("close", async (t) => {
    if (ct || !lt || !k)
      return;
    t.preventDefault();
    const { response: e } = await Ct.showMessageBox(k, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    e === 0 && (ct = !0, k.close());
  }), k.on("closed", () => {
    lt = !1, ct = !1, k = null;
  });
}
function Fr() {
  N.on("window-all-closed", () => {
    process.platform !== "darwin" && (N.quit(), k = null);
  }), N.on("activate", () => {
    Ft.getAllWindows().length === 0 && Fe();
  });
}
function Gr() {
  C.handle(W.getBootstrap, async () => ({ config: await M() })), C.handle(W.getAiSettingsStatus, () => yn()), C.handle(W.saveAiSettings, (t, e) => hn(e)), C.handle(W.saveAiApiKey, (t, e) => dn(e)), C.handle(
    W.setJournalHeatmapEnabled,
    (t, e) => cn(e)
  ), C.handle(W.setDayStartHour, (t, e) => ln(e)), C.handle(
    W.setFrontmatterVisibility,
    (t, e) => mn(e)
  ), C.handle(W.setWindowDirtyState, (t, e) => {
    Rr(e.isDirty);
  }), C.handle(W.openExternalLink, async (t, e) => {
    const n = e.url.trim();
    if (!/^https:\/\/.+/i.test(n) && !/^mailto:.+/i.test(n))
      throw new Error("暂不支持打开这个地址。");
    await Xe.openExternal(n);
  }), C.handle(W.openDevTools, () => {
    zr();
  }), C.handle(W.chooseWorkspace, async () => {
    const t = await M(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = $r(), r = n ? await Ct.showOpenDialog(n, e) : await Ct.showOpenDialog(e);
    if (r.canceled || r.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const a = r.filePaths[0], s = pn(a, t);
    return await rt(s), {
      canceled: !1,
      workspacePath: a,
      config: s
    };
  }), C.handle(W.getWorkspaceTags, (t, e) => Pe(e)), C.handle(W.setWorkspaceTags, (t, e) => nr(e)), C.handle(W.getWorkspaceWeatherOptions, (t, e) => rr(e)), C.handle(
    W.setWorkspaceWeatherOptions,
    (t, e) => or(e)
  ), C.handle(W.getWorkspaceLocationOptions, (t, e) => ar(e)), C.handle(
    W.setWorkspaceLocationOptions,
    (t, e) => ir(e)
  ), C.handle(W.readJournalEntry, (t, e) => Be(e)), C.handle(W.createJournalEntry, (t, e) => ur(e)), C.handle(W.saveJournalEntryBody, (t, e) => cr(e)), C.handle(
    W.saveJournalEntryMetadata,
    (t, e) => lr(e)
  ), C.handle(W.getJournalMonthActivity, (t, e) => mr(e)), C.handle(W.generateDailyInsights, (t, e) => we(e)), C.handle(W.generateRangeReport, (t, e) => Er(e)), C.handle(W.getRangeReport, (t, e) => Pr(e)), C.handle(W.listRangeReports, (t, e) => Br(e));
}
Fr();
N.whenReady().then(() => {
  Gr(), Fe();
});
