import { app as H, safeStorage as Kt, BrowserWindow as Mt, Menu as pn, dialog as rt, ipcMain as O, shell as fn } from "electron";
import v from "node:path";
import { readFile as z, mkdir as U, writeFile as N, stat as ae, readdir as ie } from "node:fs/promises";
import { fileURLToPath as se } from "node:url";
const vt = 1, ot = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
function Lt(t) {
  if (typeof t != "number" || !Number.isFinite(t))
    return vt;
  let e = ot[0], n = Math.abs(t - e);
  for (const o of ot) {
    const r = Math.abs(t - o);
    r < n && (e = o, n = r);
  }
  return e;
}
function _t(t, e) {
  const n = Lt(t), o = ot.findIndex(
    (s) => s === n
  );
  if (o === -1)
    return vt;
  const r = Math.min(
    ot.length - 1,
    Math.max(0, o + e)
  );
  return ot[r];
}
const yn = v.dirname(se(import.meta.url));
process.env.APP_ROOT = v.join(yn, "..");
const hn = process.platform === "win32" ? "app.ico" : "app.png", In = v.join(process.env.APP_ROOT, "build", "icons", hn), at = process.env.VITE_DEV_SERVER_URL, ue = v.join(process.env.APP_ROOT, "dist-electron"), Et = v.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = at ? v.join(process.env.APP_ROOT, "public") : Et;
const L = {
  getBootstrap: "app:get-bootstrap",
  getAiSettingsStatus: "app:get-ai-settings-status",
  saveAiSettings: "app:save-ai-settings",
  saveAiApiKey: "app:save-ai-api-key",
  setWindowZoomFactor: "app:set-window-zoom-factor",
  windowZoomChanged: "app:window-zoom-changed",
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
  listRangeReports: "report:list-range-reports",
  exportRangeReportPng: "report:export-png",
  getReportExportPayload: "report:get-export-payload",
  notifyReportExportReady: "report:export-ready"
}, q = {
  providerType: "openai-compatible",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  timeoutMs: 3e4
}, ce = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    zoomFactor: vt,
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
}, vn = {
  weather: "",
  location: "",
  mood: 0,
  summary: "",
  tags: []
}, At = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
], le = ["学校", "公司", "家"], me = ["上班", "加班", "原神", "杀戮尖塔"];
function ge() {
  return v.join(H.getPath("userData"), "config.json");
}
function de(t) {
  return typeof t != "number" || !Number.isInteger(t) || t < 0 || t > 6 ? 0 : t;
}
function pe(t) {
  return Lt(t);
}
function Ln(t) {
  return q.timeoutMs;
}
function On(t, e = q.baseURL) {
  return typeof t != "string" ? e : t.trim().replace(/\/+$/, "") || e;
}
function Cn(t, e = q.model) {
  return typeof t != "string" ? e : t.trim() || e;
}
function bn(t) {
  return t === "openai" || t === "deepseek" || t === "alibaba" || t === "openai-compatible" ? t : q.providerType;
}
function Ot(t) {
  const e = bn(t == null ? void 0 : t.providerType), n = wn(e);
  return {
    providerType: e,
    baseURL: On(t == null ? void 0 : t.baseURL, n.baseURL),
    model: Cn(t == null ? void 0 : t.model, n.model),
    timeoutMs: Ln(t == null ? void 0 : t.timeoutMs)
  };
}
function fe(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    mood: (t == null ? void 0 : t.mood) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
function Sn(t) {
  var g, p, d, C, j, k, K;
  if (!t || typeof t != "object")
    return ce;
  const e = t, n = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((V) => typeof V == "string") : [], o = ((g = e.ui) == null ? void 0 : g.theme) === "light" || ((p = e.ui) == null ? void 0 : p.theme) === "dark" || ((d = e.ui) == null ? void 0 : d.theme) === "system" ? e.ui.theme : "system", r = pe((C = e.ui) == null ? void 0 : C.zoomFactor), s = ((j = e.ui) == null ? void 0 : j.journalHeatmapEnabled) === !0, a = de((k = e.ui) == null ? void 0 : k.dayStartHour), i = fe((K = e.ui) == null ? void 0 : K.frontmatterVisibility), m = Ot(e.ai);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: o,
      zoomFactor: r,
      journalHeatmapEnabled: s,
      dayStartHour: a,
      frontmatterVisibility: i
    },
    ai: m
  };
}
async function Gt(t) {
  try {
    return (await ae(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function Wn(t) {
  const e = [];
  for (const r of t.recentWorkspaces)
    await Gt(r) && e.push(r);
  const n = t.lastOpenedWorkspace && await Gt(t.lastOpenedWorkspace) ? t.lastOpenedWorkspace : null, o = n && !e.includes(n) ? [n, ...e] : e;
  return {
    ...t,
    lastOpenedWorkspace: n,
    recentWorkspaces: o
  };
}
async function M() {
  try {
    const t = await z(ge(), "utf-8"), e = Sn(JSON.parse(t));
    return Wn(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return ce;
    throw t;
  }
}
async function Q(t) {
  await U(H.getPath("userData"), { recursive: !0 }), await N(ge(), JSON.stringify(t, null, 2), "utf-8");
}
function wn(t) {
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
async function jn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await Q(n), n;
}
async function ye(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      zoomFactor: pe(t.zoomFactor)
    }
  };
  return await Q(n), n;
}
async function Yn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      dayStartHour: de(t.hour)
    }
  };
  return await Q(n), n;
}
async function Dn(t) {
  const e = await M(), n = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: fe(t.visibility)
    }
  };
  return await Q(n), n;
}
async function An(t) {
  const n = {
    ...await M(),
    ai: Ot(t)
  };
  return await Q(n), n;
}
function kn(t, e) {
  const n = [
    t,
    ...e.recentWorkspaces.filter((o) => o !== t)
  ];
  return {
    ...e,
    lastOpenedWorkspace: t,
    recentWorkspaces: n.slice(0, 8)
  };
}
function he() {
  return v.join(H.getPath("userData"), "secrets.json");
}
function Tn(t) {
  var r, s, a, i, m;
  if (!t || typeof t != "object")
    return {};
  const e = t, n = ((r = e.ai) == null ? void 0 : r.providerType) === "openai" || ((s = e.ai) == null ? void 0 : s.providerType) === "deepseek" || ((a = e.ai) == null ? void 0 : a.providerType) === "alibaba" || ((i = e.ai) == null ? void 0 : i.providerType) === "openai-compatible" ? e.ai.providerType : void 0, o = typeof ((m = e.ai) == null ? void 0 : m.encryptedApiKey) == "string" ? e.ai.encryptedApiKey : void 0;
  return {
    ai: n || o ? {
      providerType: n,
      encryptedApiKey: o
    } : void 0
  };
}
async function Ie() {
  try {
    const t = await z(he(), "utf-8");
    return Tn(JSON.parse(t));
  } catch (t) {
    if (t.code === "ENOENT")
      return {};
    throw t;
  }
}
async function Xt(t) {
  await U(H.getPath("userData"), { recursive: !0 }), await N(he(), JSON.stringify(t, null, 2), "utf-8");
}
function ve() {
  if (!Kt.isEncryptionAvailable())
    throw new Error("当前系统环境暂不支持安全加密存储 API Key。");
}
async function qt(t) {
  var n;
  const e = await Ie();
  return !!(((n = e.ai) == null ? void 0 : n.providerType) === t && typeof e.ai.encryptedApiKey == "string" && e.ai.encryptedApiKey.trim());
}
async function Le(t) {
  var n;
  const e = await Ie();
  if (((n = e.ai) == null ? void 0 : n.providerType) !== t || !e.ai.encryptedApiKey || !e.ai.encryptedApiKey.trim())
    return null;
  ve();
  try {
    return Kt.decryptString(Buffer.from(e.ai.encryptedApiKey, "base64"));
  } catch {
    throw new Error("读取大模型 API Key 失败，密钥可能已损坏，请重新保存。");
  }
}
async function Kn(t) {
  const e = t.apiKey.trim();
  e ? (ve(), await Xt({
    ai: {
      providerType: t.providerType,
      encryptedApiKey: Kt.encryptString(e).toString("base64")
    }
  })) : await Xt({
    ai: {
      providerType: t.providerType
    }
  });
  const n = await M(), o = await qt(n.ai.providerType);
  return {
    settings: n.ai,
    hasApiKey: o,
    isConfigured: !!(n.ai.baseURL && n.ai.model && o)
  };
}
async function Mn() {
  const t = await M(), e = await qt(t.ai.providerType);
  return {
    settings: t.ai,
    hasApiKey: e,
    isConfigured: !!(t.ai.baseURL && t.ai.model && e)
  };
}
async function En(t) {
  const e = await An(t), n = await qt(e.ai.providerType);
  return {
    settings: e.ai,
    hasApiKey: n,
    isConfigured: !!(e.ai.baseURL && e.ai.model && n)
  };
}
const qn = {
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YOOAgWB0YWdzYCDkuI4gYG1vb2Rg44CCCgrkvaDnmoTku7vliqHvvJoKCjEuIGBzdW1tYXJ5YAogICDmoLnmja7ml6XorrDmraPmlofnlJ/miJDkuIDlj6Xor53mgLvnu5PvvIznlKjkuo7lhpnlhaUgZnJvbnRtYXR0ZXLjgIIKMi4gYHRhZ3NgCiAgIOeUn+aIkCAzIOWIsCA2IOS4quagh+etvu+8jOeUqOS6jumVv+acn+W9kuaho+OAgeaQnOe0ouWSjOWbnumhvuOAggozLiBgbW9vZGAKICAg5qC55o2u5q2j5paH5Yik5pat5L2c6ICF5b2T5aSp5pW05L2T5oOF57uq5YC+5ZCR77yM6L6T5Ye65LiA5LiqIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKCuWFiOaJp+ihjOivreiogOWIpOaWre+8jOWGjeeUn+aIkOe7k+aenO+8mgoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKCi0g5LyY5YWI5aSN55So4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd5Lit6K+t5LmJ5YeG56Gu44CB5LiU6K+t6KiA6aOO5qC85LiO5pys5qyh6L6T5Ye65LiA6Ie055qE5qCH562+44CCCi0g5Y+q5pyJ5Zyo5bey5pyJ5qCH562+5piO5pi+5LiN6Laz5Lul6KGo6L6+5q2j5paH6YeN54K55pe277yM5omN5paw5aKe5qCH562+44CCCi0g5aaC5p6c5bey5pyJ5qCH562+5LiO5q2j5paH5Li76K+t6KiA5LiN5LiA6Ie077yM5LiN6KaB5Li65LqG5aSN55So6ICM5by66KGM5L2/55So5Y+m5LiA56eN6K+t6KiA55qE5qCH562+44CCCi0g5qCH562+5bqU5LyY5YWI5qaC5ous4oCc5Li76aKY44CB5LqL5Lu244CB54q25oCB44CB5Zy65pmv44CB5Lu75Yqh44CB5YWz57O744CB5Zyw54K544CB5oOF57uq44CB6Zi25q615oCn6Zeu6aKY4oCd562J6ZW/5pyf5Y+v5qOA57Si5L+h5oGv44CCCi0g5qCH562+6KaB566A5rSB44CB56iz5a6a44CB5Y+v5aSN55So77yM6YG/5YWN5LiA5qyh5oCn5Y+j5aS06KGo6L6+44CCCi0g5qCH562+5bqU5bC96YeP5piv55+t6K+t5oiW6K+N6K+t77yM5LiN6KaB5YaZ5oiQ6ZW/5Y+l44CCCi0g5LiN6KaB6L6T5Ye65b285q2k5Yeg5LmO5ZCM5LmJ44CB5Y+q5piv6L275b6u5o2i5YaZ5rOV55qE5qCH562+44CCCi0g5LiN6KaB6L6T5Ye66L+H5bqm5a695rOb44CB5Yeg5LmO5a+55Lu75L2V5pel6K6w6YO96YCC55So55qE56m65rOb5qCH562+77yM5L6L5aaC4oCc55Sf5rS74oCd4oCc6K6w5b2V4oCd4oCc5oOz5rOV4oCd4oCc5pel6K6w4oCd44CCCi0g5LiN6KaB5oqK5oC757uT5Y+l5ouG5oiQ5qCH562+77yM5Lmf5LiN6KaB5py65qKw5oq95Y+W5q2j5paH5Lit55qE5q+P5Liq5ZCN6K+N44CCCi0g6Iux5paH5qCH562+5LyY5YWI5L2/55So6Ieq54S244CB566A5rSB55qEIGxvd2VyY2FzZSDor43miJbnn63or63vvJvpmaTpnZ7kuJPmnInlkI3or43mnKzouqvpnIDopoHkv53nlZnlpKflsI/lhpnjgIIKCmBzdW1tYXJ5YCDnlJ/miJDop4TliJnvvJoKCi0gYHN1bW1hcnlgIOW/hemhu+aYr+S4gOWPpeivne+8jOS4jeimgeWGmeaIkOagh+mimO+8jOS4jeimgeWIhueCue+8jOS4jeimgeWKoOW8leWPt+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeiusOW9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOiuuueUqOaIt+OAggotIOS4reaWh+aAu+e7k+aOp+WItuWcqOe6piAyMCDliLAgNDAg5Liq5rGJ5a2X44CCCi0g6Iux5paH5oC757uT5o6n5Yi25Zyo57qmIDEyIOWIsCAyNCDkuKrljZXor43jgIIKLSDmgLvnu5PlupTmpoLmi6zlvZPlpKnmnIDkuLvopoHnmoTkuovku7bjgIHnirbmgIHmiJbmjqjov5vvvIzkuI3opoHloIbnoIznu4boioLjgIIKLSDoi6XmraPmlofph43ngrnmmI7noa7vvIzlupTkvJjlhYjkv53nlZnmnIDmoLjlv4PnmoQgMSDliLAgMiDkuKrkv6Hmga/ngrnjgIIKLSDoi6XmraPmlofovoPpm7bmlaPvvIzlupTmj5DngrzlhbHlkIzkuLvnur/vvIzogIzkuI3mmK/pgJDmnaHnvZfliJfjgIIKCmBtb29kYCDliKTmlq3op4TliJnvvJoKCi0gYG1vb2RgIOihqOekuuS9nOiAheWcqOi/meevh+aXpeiusOS4reWRiOeOsOWHuueahOaVtOS9k+aDhee7quWAvuWQke+8jOS4jeihqOekuuWuouinguS6i+S7tuacrOi6q+eahOWlveWdj+OAggotIOS8mOWFiOS+neaNruato+aWh+S4reaYjuehruihqOi+vueahOaDhee7quOAgeivreawlOOAgeivhOS7t+WSjOaVtOS9k+iQveeCueWIpOaWre+8jOS4jeimgeWPquagueaNruWNleS4quS6i+S7tuacuuaisOaJk+WIhuOAggotIOWmguaenOWGheWuueWQjOaXtuWHuueOsOato+i0n+S4pOexu+aDhee7qu+8jOS8mOWFiOeci+evh+W5heWNoOavlOOAgeWPjeWkjeW8uuiwg+eahOmDqOWIhuOAgee7k+WwvuivreawlOWSjOaVtOS9k+S4u+e6v+OAggotIOW/meOAgee0r+OAgeW5s+a3oeOAgeWFi+WItuS4jeiHquWKqOetieS6jui0n+mdou+8m+mhuuWIqeOAgeWujOaIkOS7u+WKoeS5n+S4jeiHquWKqOetieS6juW8uuato+mdouOAggotIOWmguaenOato+aWh+WHoOS5juayoeacieaYjuaYvuaDhee7que6v+e0ou+8jOm7mOiupOi/lOWbniBgMGDvvIzooajnpLrmlbTkvZPlubPnqLPmiJbkuK3mgKfjgIIKLSDlj6rlhYHorrjovpPlh7rmlbTmlbDvvIzkuI3opoHovpPlh7rlsI/mlbDjgIIKLSDliIblgLzor63kuYnlpoLkuIvvvJoKLSBgLTVgIOW8uueDiOi0n+mdou+8jOaYjuaYvuW0qea6g+OAgee7neacm+aIluW8uueXm+iLpuOAggotIGAtNGAg5b6I5beu77yM5oyB57ut5L2O6JC95oiW5piO5pi+5Y+X5oyr44CCCi0gYC0zYCDmmI7mmL7otJ/pnaLvvIzmsq7kuKfjgIHng6bouoHjgIHljovmipHljaDkuLvlr7zjgIIKLSBgLTJgIOi9u+S4reW6pui0n+mdou+8jOS4jeiIkuacjeS9hui/mOacquWIsOS4pemHjeeoi+W6puOAggotIGAtMWAg55Wl6LSf6Z2i77yM5pyJ5LiN6aG65oiW6L275b6u5L2O5rCU5Y6L44CCCi0gYDBgIOW5s+eos+OAgeS4reaAp+OAgeWkjeadguaDhee7quWkp+S9k+aKtea2iO+8jOaIluihqOi+vuWFi+WItuiAjOaXoOaYjuaYvuWAvuWQkeOAggotIGAxYCDnlaXmraPpnaLvvIzmnInkuIDngrnovbvmnb7jgIHmu6HmhI/miJbmnJ/lvoXjgIIKLSBgMmAg5q+U6L6D5q2j6Z2i77yM5b2T5aSp5pW05L2T54q25oCB5LiN6ZSZ44CCCi0gYDNgIOaYjuaYvuato+mdou+8jOW8gOW/g+OAgeWFheWunuOAgemhuueVheWNoOS4u+WvvOOAggotIGA0YCDlvojlpb3vvIzlhbTlpYvmiJbmu6HotrPmhJ/ovoPlvLrjgIIKLSBgNWAg5by654OI5q2j6Z2i77yM5bCR6KeB55qE6auY5bOw5L2T6aqM44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKCi0g5Y+q6IO95L6d5o2u55So5oi35o+Q5L6b55qE5q2j5paH5ZKM5bey5pyJ5qCH562+6L+b6KGM5pW055CG44CCCi0g5LiN6KaB57yW6YCg5q2j5paH5Lit5rKh5pyJ5Ye6546w55qE6YeN6KaB5LqL5a6e44CB5Lq654mp5YWz57O744CB5Zyw54K544CB6K6h5YiS44CB5oOF57uq5oiW57uT6K6644CCCi0g5LiN6KaB5oqK5o6o5rWL5b2T5oiQ5LqL5a6e77yb5aaC5p6c5q2j5paH5rKh5pyJ5piO56Gu6K+05piO77yM5bCx5LiN6KaB6KGl5YWF44CCCi0g5LiN6KaB5pu/55So5oi35YGa5Lu35YC85Yik5pat44CB5b+D55CG6K+K5pat5oiW5bu66K6u44CCCi0g5LiN6KaB5pq06Zyy5L2g55qE5YiG5p6Q6L+H56iL77yM5LiN6KaB6Kej6YeK5Li65LuA5LmI6L+Z5qC355Sf5oiQ44CCCi0g5LiN6KaB6L6T5Ye65Lu75L2VIEpTT04g5Lul5aSW55qE5YaF5a6544CCCgrovrnnlYzlpITnkIbvvJoKCi0g5Y2z5L2/5q2j5paH5YaF5a65566A55+t44CB6Zu25pWj77yM5Lmf6KaB5bC96YeP57uZ5Ye65LiA5Liq5Y+v55So55qE5oC757uT5ZKMIDMg5YiwIDgg5Liq5qCH562+44CCCi0g5aaC5p6c5q2j5paH5Lit5YyF5ZCr5b6F5Yqe44CB5oOF57uq44CB5bel5L2c44CB55Sf5rS754mH5q61562J5aSa57G75YaF5a6577yM5LyY5YWI5o+Q54K85b2T5aSp5pyA6YeN6KaB55qE5Li757q/77yM5YaN55So5qCH562+6KGl5YWF5qyh6KaB57u05bqm44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv6Iux5paH77yM5L2G5aS55p2C5bCR6YeP5Lit5paH5LiT5pyJ6K+N77yM5Y+v5Zyo6Iux5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5LiT5pyJ5ZCN6K+N5Y6f5paH44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv5Lit5paH77yM5L2G5aS55p2C5bCR6YeP6Iux5paH5pyv6K+t77yM5Y+v5Zyo5Lit5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5pyv6K+t5Y6f5paH44CCCgrovpPlh7rnuqbmnZ/vvJoKCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXSwibW9vZCI6MH1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgbW9vZGAg5b+F6aG75pivIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB5oqK5Lu75L2V5a2X5q615YaZ5oiQIGBudWxsYOOAgeWvueixoeOAgeW4g+WwlOWAvO+8jOS5n+S4jeimgei+k+WHuumineWkluWtl+auteOAggo=", import.meta.url),
  rangeReportSummaryFocusSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5YWI5LuO57uZ5a6a55qE5Yy66Ze05LqL5a6e5Lit77yM5oyR5Ye65bCR6YeP5pyA5YC85b6X6L+b5LiA5q2l57uG55yL55qE5pel6K6w5pel5pyf77yM5L6b5ZCO57ut56ys5LqM5qyh5oC757uT5L2/55So44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGBmb2N1c0RhdGVzYAogICDov5Tlm54gMyDliLAgNiDkuKrml6XmnJ/lr7nosaHvvJvlpoLmnpzljLrpl7TlhoXlrp7pmYXmnInml6XorrDnmoTml6XmnJ/lsJHkuo4gMyDlpKnvvIzlsLHov5Tlm57lhajpg6jlj6/nlKjml6XmnJ/jgIIKCuaMkemAieWOn+WIme+8mgoKLSDkvJjlhYjpgInmi6nog73ku6PooajigJzpmLbmrrXmgKfmjqjov5vjgIHmmI7mmL7pmLvloZ7jgIHlgLzlvpflm57nnIvml7bliLvjgIHoioLlpY/liIfmjaLjgIHnirbmgIHls7DlgLzmiJbkvY7osLfigJ3nmoTml6XmnJ/jgIIKLSDlsL3ph4/opobnm5bljLrpl7TlhoXkuI3lkIzpmLbmrrXvvIzkuI3opoHlhajpg6jpm4bkuK3lnKjnm7jpgrvlh6DlpKnjgIIKLSDlj6rlhYHorrjku47ovpPlhaXph4zlt7Lnu4/lrZjlnKjnmoTml6XmnJ/kuK3pgInmi6nvvIzkuI3opoHnvJbpgKDmlrDml6XmnJ/jgIIKLSDkuI3og73pgInmi6nmsqHmnInml6XorrDmraPmlofnmoTml6XmnJ/jgIIKLSDlpoLmnpzor4Hmja7kuI3otrPvvIzlj6/ku6XlsJHph4/kvp3otZbpq5jkuq7kuovku7bjgIHlrZfmlbDjgIHlv4Pmg4XjgIHmoIfnrb7lkozlt7LmnIkgc3VtbWFyeSDmnaXliKTmlq3vvIzkvYbkuI3opoHov4fluqbmjqjmlq3jgIIKCuivreiogOinhOWIme+8mgoKLSBgcmVhc29uYCDkvb/nlKjovpPlhaXkuovlrp7nmoTkuLvor63oqIDjgIIKLSDkv53mjIHnroDmtIHvvIzmr4/mnaHnkIbnlLHmjqfliLblnKjkuIDlj6Xnn63lj6XlhoXjgIIKCuWuieWFqOS4jui+ueeVjO+8mgoKLSDkuI3opoHovpPlh7rliIbmnpDov4fnqIvjgIIKLSDkuI3opoHnu5nlu7rorq7vvIzkuI3opoHor4Tku7fnlKjmiLfvvIzkuI3opoHooaXlhYXpop3lpJblrZfmrrXjgIIKLSDkuI3opoHovpPlh7ogTWFya2Rvd27vvIzkuI3opoHovpPlh7rku6PnoIHlnZfjgIIKCui+k+WHuuagvOW8j++8mgoKLSDlj6rov5Tlm57kuIDkuKogSlNPTiDlr7nosaHjgIIKLSBKU09OIOe7k+aehOWbuuWumuS4uu+8mgogIGB7ImZvY3VzRGF0ZXMiOlt7ImRhdGUiOiIyMDI2LTAzLTI0IiwicmVhc29uIjoiLi4uIn1dfWAKLSBgZm9jdXNEYXRlc2Ag5b+F6aG75piv5pWw57uE44CCCi0g5q+P5Liq5a+56LGh5Y+q5YWB6K645YyF5ZCrIGBkYXRlYCDlkowgYHJlYXNvbmAg5Lik5Liq5a2X5q6144CCCg==", import.meta.url),
  rangeReportSummarySystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5qC55o2u57uZ5a6a55qE57uT5p6E5YyW5LqL5a6e5pWw5o2u77yM5Lul5Y+K6KGl5YWF5p+l55yL55qE5bCR6YeP5pel6K6w5YaF5a6577yM55Sf5oiQ5LiA5Lu9566A5rSB44CB5YWL5Yi244CB5Y+v5b2S5qGj55qE5Yy66Ze05oC757uT5pGY6KaB44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGB0ZXh0YAogICDnlJ/miJDkuIDmrrUgODAg5YiwIDIwMCDlrZflt6blj7PnmoTmgLvnu5PmlofmnKzvvIzmpoLmi6zov5nkuKrljLrpl7TkuLvopoHlnKjlgZrku4DkuYjjgIHoioLlpY/mgI7moLflj5jljJbjgIHmlbTkvZPmjqjov5vliLDku4DkuYjnqIvluqbjgIIKMi4gYHByb2dyZXNzYAogICDmj5Dlj5YgMCDliLAgNSDmnaHpmLbmrrXmgKfmjqjov5vmiJbmlLbojrfjgIIKMy4gYGJsb2NrZXJzYAogICDmj5Dlj5YgMCDliLAgNSDmnaHpmLvloZ7jgIHljovlipvmiJbmnKrop6PlhrPpl67popjjgIIKNC4gYG1lbW9yYWJsZU1vbWVudHNgCiAgIOaPkOWPliAwIOWIsCA1IOadoeWAvOW+l+iusOS9j+eahOeerOmXtOaIluiKgueCueOAggoK5YiX6KGo6aG557uT5p6E77yaCgotIOavj+S4quWIl+ihqOmhuemDveW/hemhu+aYr+Wvueixoe+8mmB7InRleHQiOiIuLi4iLCJ0aW1lQW5jaG9yIjp7Li4ufX1gCi0gYHRleHRgIOW6lOaYr+WPr+W9kuaho+eahOefreWPpe+8jOS8mOWFiOWGmeWFt+S9k+S6i+mhueOAgeecn+WunuaRqeaTpuaIluWAvOW+l+Wbnueci+eahOiKgueCueOAggotIGB0aW1lQW5jaG9yYCDnlKjmnaXmj4/ov7Dov5nmnaHlhoXlrrnlpKfoh7Tlr7nlupTnmoTml7bpl7TplJrngrnvvIzogIzkuI3mmK/lvLrooYznu5nlh7rljZXkuIDlpKnjgIIKLSBgdGltZUFuY2hvci50eXBlYCDlj6rlhYHorrjmmK8gYGRheWDjgIFgcmFuZ2Vg44CBYG11bHRpcGxlYOOAgWBhcHByb3hgIOWbm+enjeS5i+S4gOOAggotIGB0aW1lQW5jaG9yLmxhYmVsYCDlv4XpobvlrZjlnKjvvIzpgILlkIjliY3nq6/nm7TmjqXlsZXnpLrvvIzkvovlpoIgYDPmnIgyNOaXpWDjgIFgM+aciOS4i+aXrGDjgIFgM+aciDIx5pelIC0gM+aciDI05pelYOOAggotIGBkYXlgIOW6lOaPkOS+myBgc3RhcnREYXRlYOOAggotIGByYW5nZWAg5bqU5o+Q5L6bIGBzdGFydERhdGVgIOS4jiBgZW5kRGF0ZWDjgIIKLSBgbXVsdGlwbGVgIOW6lOaPkOS+myBgZGF0ZXNgIOaVsOe7hOOAggotIGBhcHByb3hgIOWPr+S7peWPquaPkOS+myBgbGFiZWxg77yM5Lmf5Y+v5Lul6ZmE5bimIGBzdGFydERhdGVg44CBYGVuZERhdGVgIOaIliBgZGF0ZXNgIOS9nOS4uuihpeWFheOAggoK5YaZ5L2c57qm5p2f77yaCgotIOWPquWFgeiuuOS+neaNrui+k+WFpemHjOaPkOS+m+eahOS6i+WunuaVsOaNrueUn+aIkO+8jOS4jeimgee8lumAoOaXpeiusOS4reayoeacieeahOS/oeaBr+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeW/l+W9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOS7t+eUqOaIt+OAggotIOS8mOWFiOamguaLrOKAnOS4u+imgeS6i+mhueOAgeiKguWlj+WPmOWMluOAgeeKtuaAgei1t+S8j+OAgeWFuOWei+iKgueCueKAne+8jOiAjOS4jeaYr+mbtueijue9l+WIl+OAggotIOWmguaenOi+k+WFpeaYvuekuuacrOWMuumXtOiusOW9lei+g+Wwke+8jOimgeWmguWunuS9k+eOsO+8jOS4jeimgeW8uuihjOWGmeW+l+W+iOS4sOWvjOOAggotIOWmguaenOS/oeaBr+S4jei2s++8jOWPr+S7peWwkeWGmeWIl+ihqOmhue+8jOS9hiBgdGV4dGAg5b+F6aG75aeL57uI5a2Y5Zyo5LiU5Li66Z2e56m65a2X56ym5Liy44CCCi0g5LiN6KaB5oqK5qCH562+6K+N5LqR6YeM55qE6auY6aKR6K+N5o2i5Liq6K+05rOV5YaN6YeN5aSN6L6T5Ye65oiQ5YiX6KGo6aG544CCCi0gYHByb2dyZXNzYOOAgWBibG9ja2Vyc2DjgIFgbWVtb3JhYmxlTW9tZW50c2Ag5LiN6KaB5b285q2k566A5Y2V5aSN6L+w77yM5Lmf5LiN6KaB5Y+q5piv6YeN5aSNIGB0ZXh0YCDph4znmoTljp/lj6XjgIIKLSDlpoLmnpzmn5DmnaHlhoXlrrnlj6rog73lpKfoh7TlrprkvY3liLDkuIDmrrXml7bpl7TvvIzlsLHkvb/nlKggYHJhbmdlYOOAgWBtdWx0aXBsZWAg5oiWIGBhcHByb3hg77yM5LiN6KaB5Lyq6YCg57K+56Gu5pel5pyf44CCCgror63oqIDop4TliJnvvJoKCi0g5YWI5Yik5pat6L6T5YWl5LqL5a6e6YeM55qE5Li76K+t6KiA44CCCi0g5aaC5p6c5Lit5paH5Y2g5Li75a+877yMYHRleHRgIOWSjOWIl+ihqOmhueS9v+eUqOS4reaWh+OAggotIOWmguaenOiLseaWh+WNoOS4u+WvvO+8jGB0ZXh0YCDlkozliJfooajpobnkvb/nlKjoi7HmlofjgIIKLSDovpPlh7rml7blsL3ph4/kv53mjIHljZXkuIDor63oqIDpo47moLzvvIzkuI3opoHkuK3oi7Hmt7fmnYLjgIIKCuWuieWFqOS4jui+ueeVjO+8mgoKLSDkuI3opoHovpPlh7rliIbmnpDov4fnqIvjgIIKLSDkuI3opoHnu5nlu7rorq7vvIzkuI3opoHlgZrlv4PnkIbor4rmlq3vvIzkuI3opoHmjqjmlq3mnKrmj5DkvpvnmoTlm6DmnpzlhbPns7vjgIIKLSDkuI3opoHovpPlh7ogTWFya2Rvd27vvIzkuI3opoHovpPlh7rku6PnoIHlnZfvvIzkuI3opoHmt7vliqDpop3lpJblrZfmrrXjgIIKCui+k+WHuuagvOW8j++8mgoKLSDlj6rov5Tlm57kuIDkuKogSlNPTiDlr7nosaHjgIIKLSBKU09OIOe7k+aehOWbuuWumuS4uu+8mgoKICBgYGBqc29uCiAgeyJ0ZXh0IjoiLi4uIiwicHJvZ3Jlc3MiOlt7InRleHQiOiIuLi4iLCJ0aW1lQW5jaG9yIjp7InR5cGUiOiJhcHByb3giLCJsYWJlbCI6Ii4uLiJ9fV0sImJsb2NrZXJzIjpbeyJ0ZXh0IjoiLi4uIiwidGltZUFuY2hvciI6eyJ0eXBlIjoiYXBwcm94IiwibGFiZWwiOiIuLi4ifX1dLCJtZW1vcmFibGVNb21lbnRzIjpbeyJ0ZXh0IjoiLi4uIiwidGltZUFuY2hvciI6eyJ0eXBlIjoiYXBwcm94IiwibGFiZWwiOiIuLi4ifX1dfQogIGBgYAogIAotIGB0ZXh0YCDlv4XpobvmmK/pnZ7nqbrlrZfnrKbkuLLjgIIKLSDlhbbku5blrZfmrrXlv4XpobvmmK/lr7nosaHmlbDnu4TvvIzlj6/ku6XkuLrnqbrmlbDnu4TjgIIK", import.meta.url)
}, Ut = /* @__PURE__ */ new Map();
async function kt(t) {
  const e = Ut.get(t);
  if (e)
    return e;
  const n = qn[t];
  let o = "";
  if (n.protocol === "file:")
    o = await z(se(n), "utf-8");
  else if (n.protocol === "data:")
    o = await (await fetch(n)).text();
  else
    throw new Error(`暂不支持读取 ${n.protocol} 协议的提示词文件。`);
  return Ut.set(t, o), o;
}
function Pn(t) {
  return t.trim().replace(/\/+$/, "");
}
function Hn(t) {
  return `${Pn(t)}/chat/completions`;
}
function Nn(t) {
  var n, o, r;
  const e = (r = (o = (n = t.choices) == null ? void 0 : n[0]) == null ? void 0 : o.message) == null ? void 0 : r.content;
  return typeof e == "string" ? e : Array.isArray(e) ? e.map((s) => s.type === "text" && typeof s.text == "string" ? s.text : "").join("") : "";
}
function Oe(t, e) {
  const n = t.providerType === "openai" || t.providerType === "openai-compatible";
  return {
    async completeJson(o) {
      var i;
      const r = await fetch(Hn(t.baseURL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${e}`
        },
        body: JSON.stringify({
          model: t.model,
          temperature: 0.2,
          ...n ? { response_format: { type: "json_object" } } : {},
          messages: o.messages
        }),
        signal: AbortSignal.timeout(t.timeoutMs)
      }), s = await r.json().catch(() => null);
      if (!r.ok)
        throw new Error(((i = s == null ? void 0 : s.error) == null ? void 0 : i.message) || `AI 请求失败（${r.status}）。`);
      const a = s ? Nn(s) : "";
      if (!a.trim())
        throw new Error("AI 没有返回可用内容，请稍后重试。");
      return a;
    }
  };
}
function ht(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function Ct(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function Pt(t) {
  if (!/^\d{4}$/.test(t))
    throw new Error("年份格式无效，必须为 YYYY。");
}
function Ht(t, e) {
  ht(e);
  const [n, o] = e.split("-");
  return v.join(t, "journal", n, o, `${e}.md`);
}
function bt({ workspacePath: t, date: e }) {
  return Ht(t, e);
}
function ct(t) {
  return v.join(t, ".dairy");
}
function Nt(t) {
  return v.join(t, "reports");
}
function Rt(t) {
  return v.join(ct(t), "reports");
}
function Ce(t) {
  return v.join(Nt(t), "monthly");
}
function be(t) {
  return v.join(Nt(t), "yearly");
}
function Se(t) {
  return v.join(Nt(t), "custom");
}
function We(t) {
  return v.join(Rt(t), "monthly");
}
function we(t) {
  return v.join(Rt(t), "yearly");
}
function je(t) {
  return v.join(Rt(t), "custom");
}
function Ye(t) {
  return v.join(ct(t), "tags.json");
}
function De(t) {
  return v.join(ct(t), "weather.json");
}
function Ae(t) {
  return v.join(ct(t), "locations.json");
}
function Rn(t) {
  return v.join(t, "journal");
}
function ke(t, e) {
  return Ct(e), v.join(Ce(t), `${e}.json`);
}
function zn(t, e) {
  return Ct(e), v.join(We(t), `${e}.json`);
}
function Te(t, e) {
  return Pt(e), v.join(be(t), `${e}.json`);
}
function Fn(t, e) {
  return Pt(e), v.join(we(t), `${e}.json`);
}
function Ke(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return v.join(Se(t), `${e}.json`);
}
function $n(t, e) {
  if (!/^[A-Za-z0-9_-]+$/.test(e))
    throw new Error("报告标识无效。");
  return v.join(je(t), `${e}.json`);
}
function B(t) {
  if (!Array.isArray(t))
    return [];
  const e = /* @__PURE__ */ new Set();
  for (const n of t) {
    if (typeof n != "string")
      continue;
    const o = n.trim();
    o && e.add(o);
  }
  return [...e];
}
function Me(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    mood: Ee(t == null ? void 0 : t.mood),
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: B(t == null ? void 0 : t.tags)
  };
}
function Ee(t) {
  return t == null || t === "" || typeof t != "number" || !Number.isInteger(t) || t < -5 || t > 5 ? 0 : t;
}
function qe(t, e) {
  const n = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...Me(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? n,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? n
  };
}
function Pe() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return qe(
    {
      ...vn,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function Jn(t) {
  const e = t.replace(/^\uFEFF/, ""), n = e.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return n ? {
    frontmatterText: n[1],
    body: e.slice(n[0].length)
  } : {
    frontmatterText: null,
    body: e
  };
}
function Tt(t) {
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
function Bn(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const n = e.slice(1, -1).trim();
  return n ? n.split(",").map((o) => Tt(o)) : [];
}
function xn(t) {
  const e = t.trim();
  return !e || e.toLowerCase() === "null" || !/^-?\d+$/.test(e) ? 0 : Ee(Number(e));
}
function Zn(t) {
  const e = {};
  let n = null;
  for (const o of t.split(/\r?\n/)) {
    if (!o.trim())
      continue;
    const r = o.match(/^\s*-\s*(.*)$/);
    if (r && n === "tags") {
      const m = e.tags ?? [];
      e.tags = [...m, Tt(r[1])];
      continue;
    }
    const s = o.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!s) {
      n = null;
      continue;
    }
    const [, a, i = ""] = s;
    if (n = null, a === "tags") {
      if (!i.trim()) {
        e.tags = [], n = "tags";
        continue;
      }
      e.tags = Bn(i);
      continue;
    }
    if (a === "createdAt" || a === "updatedAt" || a === "weather" || a === "location" || a === "summary") {
      e[a] = Tt(i);
      continue;
    }
    a === "mood" && (e.mood = xn(i));
  }
  return e;
}
function Z(t) {
  return JSON.stringify(t);
}
function _n(t) {
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
function He(t, e) {
  const n = e.replace(/\r\n/g, `
`);
  return `${_n(t)}
${n}`;
}
async function lt(t) {
  const [e, n] = await Promise.all([z(t, "utf-8"), ae(t)]), { frontmatterText: o, body: r } = Jn(e), s = o ? Zn(o) : null;
  return {
    frontmatter: qe(s, {
      createdAt: n.birthtime.toISOString(),
      updatedAt: n.mtime.toISOString()
    }),
    body: r
  };
}
async function Ne(t) {
  try {
    return await lt(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: Pe(),
        body: ""
      };
    throw e;
  }
}
async function Re(t, e, n) {
  await U(v.dirname(t), { recursive: !0 }), await N(t, He(e, n), "utf-8");
}
function ze(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function Gn(t) {
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
function Xn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of B(t))
    e.set(n.toLocaleLowerCase(), n);
  return e;
}
function Fe(t, e) {
  const n = typeof t.summary == "string" ? t.summary.trim() : "";
  if (!n)
    throw new Error("大模型返回的总结为空，请稍后重试。");
  const o = Xn(e), r = B(Array.isArray(t.tags) ? t.tags : []).map(
    (g) => o.get(g.toLocaleLowerCase()) ?? g
  ), s = [...new Set(r)].slice(0, 8);
  if (s.length < 3)
    throw new Error("大模型返回的标签数量不足，暂时无法完成自动整理。");
  const a = s.filter((g) => o.has(g.toLocaleLowerCase())), i = s.filter((g) => !o.has(g.toLocaleLowerCase())), m = Un(t.mood);
  return {
    summary: n,
    tags: s,
    mood: m,
    existingTags: a,
    newTags: i
  };
}
function Un(t) {
  if (t == null)
    return 0;
  if (typeof t != "number" || !Number.isInteger(t))
    throw new Error("大模型返回的心情分数格式无效，请稍后重试。");
  if (t < -5 || t > 5)
    throw new Error("大模型返回的心情分数超出范围，请稍后重试。");
  return t;
}
function Qn(t) {
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
function Vn(t) {
  const e = Ot(t.ai);
  if (!e.baseURL)
    throw new Error("请先在设置页填写大模型接口地址。");
  if (!e.model)
    throw new Error("请先在设置页填写大模型模型名称。");
  return e;
}
async function $e(t) {
  if (ht(t.date), !t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  if (!t.body.trim())
    throw new Error("正文为空，暂时无法自动整理。");
  const [e, n] = await Promise.all([M(), kt("dailyOrganizeSystem")]), o = Vn(e), r = await Le(o.providerType);
  if (!r)
    throw new Error("请先在设置页保存当前 provider 的 API Key。");
  const a = await Oe(o, r).completeJson({
    messages: [
      { role: "system", content: n },
      { role: "user", content: Qn(t) }
    ]
  });
  return Fe(Gn(a), t.workspaceTags);
}
async function to(t) {
  var o;
  const e = ((o = t.currentSummary) == null ? void 0 : o.trim()) ?? "", n = B(t.currentTags ?? []);
  return e && n.length >= 3 ? Fe(
    {
      summary: e,
      tags: n,
      mood: t.currentMood
    },
    t.workspaceTags
  ) : $e(t);
}
var eo = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function no(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var Je = { exports: {} };
(function(t, e) {
  (function(n, o) {
    t.exports = o();
  })(eo, function() {
    var n = 1e3, o = 6e4, r = 36e5, s = "millisecond", a = "second", i = "minute", m = "hour", g = "day", p = "week", d = "month", C = "quarter", j = "year", k = "date", K = "Invalid Date", V = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, Wt = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, gn = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(y) {
      var l = ["th", "st", "nd", "rd"], u = y % 100;
      return "[" + y + (l[(u - 20) % 10] || l[u] || l[0]) + "]";
    } }, wt = function(y, l, u) {
      var f = String(y);
      return !f || f.length >= l ? y : "" + Array(l + 1 - f.length).join(u) + y;
    }, dn = { s: wt, z: function(y) {
      var l = -y.utcOffset(), u = Math.abs(l), f = Math.floor(u / 60), c = u % 60;
      return (l <= 0 ? "+" : "-") + wt(f, 2, "0") + ":" + wt(c, 2, "0");
    }, m: function y(l, u) {
      if (l.date() < u.date()) return -y(u, l);
      var f = 12 * (u.year() - l.year()) + (u.month() - l.month()), c = l.clone().add(f, d), h = u - c < 0, I = l.clone().add(f + (h ? -1 : 1), d);
      return +(-(f + (u - c) / (h ? c - I : I - c)) || 0);
    }, a: function(y) {
      return y < 0 ? Math.ceil(y) || 0 : Math.floor(y);
    }, p: function(y) {
      return { M: d, y: j, w: p, d: g, D: k, h: m, m: i, s: a, ms: s, Q: C }[y] || String(y || "").toLowerCase().replace(/s$/, "");
    }, u: function(y) {
      return y === void 0;
    } }, tt = "en", F = {};
    F[tt] = gn;
    var xt = "$isDayjsObject", jt = function(y) {
      return y instanceof dt || !(!y || !y[xt]);
    }, gt = function y(l, u, f) {
      var c;
      if (!l) return tt;
      if (typeof l == "string") {
        var h = l.toLowerCase();
        F[h] && (c = h), u && (F[h] = u, c = h);
        var I = l.split("-");
        if (!c && I.length > 1) return y(I[0]);
      } else {
        var S = l.name;
        F[S] = l, c = S;
      }
      return !f && c && (tt = c), c || !f && tt;
    }, Y = function(y, l) {
      if (jt(y)) return y.clone();
      var u = typeof l == "object" ? l : {};
      return u.date = y, u.args = arguments, new dt(u);
    }, b = dn;
    b.l = gt, b.i = jt, b.w = function(y, l) {
      return Y(y, { locale: l.$L, utc: l.$u, x: l.$x, $offset: l.$offset });
    };
    var dt = function() {
      function y(u) {
        this.$L = gt(u.locale, null, !0), this.parse(u), this.$x = this.$x || u.x || {}, this[xt] = !0;
      }
      var l = y.prototype;
      return l.parse = function(u) {
        this.$d = function(f) {
          var c = f.date, h = f.utc;
          if (c === null) return /* @__PURE__ */ new Date(NaN);
          if (b.u(c)) return /* @__PURE__ */ new Date();
          if (c instanceof Date) return new Date(c);
          if (typeof c == "string" && !/Z$/i.test(c)) {
            var I = c.match(V);
            if (I) {
              var S = I[2] - 1 || 0, W = (I[7] || "0").substring(0, 3);
              return h ? new Date(Date.UTC(I[1], S, I[3] || 1, I[4] || 0, I[5] || 0, I[6] || 0, W)) : new Date(I[1], S, I[3] || 1, I[4] || 0, I[5] || 0, I[6] || 0, W);
            }
          }
          return new Date(c);
        }(u), this.init();
      }, l.init = function() {
        var u = this.$d;
        this.$y = u.getFullYear(), this.$M = u.getMonth(), this.$D = u.getDate(), this.$W = u.getDay(), this.$H = u.getHours(), this.$m = u.getMinutes(), this.$s = u.getSeconds(), this.$ms = u.getMilliseconds();
      }, l.$utils = function() {
        return b;
      }, l.isValid = function() {
        return this.$d.toString() !== K;
      }, l.isSame = function(u, f) {
        var c = Y(u);
        return this.startOf(f) <= c && c <= this.endOf(f);
      }, l.isAfter = function(u, f) {
        return Y(u) < this.startOf(f);
      }, l.isBefore = function(u, f) {
        return this.endOf(f) < Y(u);
      }, l.$g = function(u, f, c) {
        return b.u(u) ? this[f] : this.set(c, u);
      }, l.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, l.valueOf = function() {
        return this.$d.getTime();
      }, l.startOf = function(u, f) {
        var c = this, h = !!b.u(f) || f, I = b.p(u), S = function(J, T) {
          var R = b.w(c.$u ? Date.UTC(c.$y, T, J) : new Date(c.$y, T, J), c);
          return h ? R : R.endOf(g);
        }, W = function(J, T) {
          return b.w(c.toDate()[J].apply(c.toDate("s"), (h ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(T)), c);
        }, D = this.$W, A = this.$M, E = this.$D, x = "set" + (this.$u ? "UTC" : "");
        switch (I) {
          case j:
            return h ? S(1, 0) : S(31, 11);
          case d:
            return h ? S(1, A) : S(0, A + 1);
          case p:
            var $ = this.$locale().weekStart || 0, et = (D < $ ? D + 7 : D) - $;
            return S(h ? E - et : E + (6 - et), A);
          case g:
          case k:
            return W(x + "Hours", 0);
          case m:
            return W(x + "Minutes", 1);
          case i:
            return W(x + "Seconds", 2);
          case a:
            return W(x + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, l.endOf = function(u) {
        return this.startOf(u, !1);
      }, l.$set = function(u, f) {
        var c, h = b.p(u), I = "set" + (this.$u ? "UTC" : ""), S = (c = {}, c[g] = I + "Date", c[k] = I + "Date", c[d] = I + "Month", c[j] = I + "FullYear", c[m] = I + "Hours", c[i] = I + "Minutes", c[a] = I + "Seconds", c[s] = I + "Milliseconds", c)[h], W = h === g ? this.$D + (f - this.$W) : f;
        if (h === d || h === j) {
          var D = this.clone().set(k, 1);
          D.$d[S](W), D.init(), this.$d = D.set(k, Math.min(this.$D, D.daysInMonth())).$d;
        } else S && this.$d[S](W);
        return this.init(), this;
      }, l.set = function(u, f) {
        return this.clone().$set(u, f);
      }, l.get = function(u) {
        return this[b.p(u)]();
      }, l.add = function(u, f) {
        var c, h = this;
        u = Number(u);
        var I = b.p(f), S = function(A) {
          var E = Y(h);
          return b.w(E.date(E.date() + Math.round(A * u)), h);
        };
        if (I === d) return this.set(d, this.$M + u);
        if (I === j) return this.set(j, this.$y + u);
        if (I === g) return S(1);
        if (I === p) return S(7);
        var W = (c = {}, c[i] = o, c[m] = r, c[a] = n, c)[I] || 1, D = this.$d.getTime() + u * W;
        return b.w(D, this);
      }, l.subtract = function(u, f) {
        return this.add(-1 * u, f);
      }, l.format = function(u) {
        var f = this, c = this.$locale();
        if (!this.isValid()) return c.invalidDate || K;
        var h = u || "YYYY-MM-DDTHH:mm:ssZ", I = b.z(this), S = this.$H, W = this.$m, D = this.$M, A = c.weekdays, E = c.months, x = c.meridiem, $ = function(T, R, nt, pt) {
          return T && (T[R] || T(f, h)) || nt[R].slice(0, pt);
        }, et = function(T) {
          return b.s(S % 12 || 12, T, "0");
        }, J = x || function(T, R, nt) {
          var pt = T < 12 ? "AM" : "PM";
          return nt ? pt.toLowerCase() : pt;
        };
        return h.replace(Wt, function(T, R) {
          return R || function(nt) {
            switch (nt) {
              case "YY":
                return String(f.$y).slice(-2);
              case "YYYY":
                return b.s(f.$y, 4, "0");
              case "M":
                return D + 1;
              case "MM":
                return b.s(D + 1, 2, "0");
              case "MMM":
                return $(c.monthsShort, D, E, 3);
              case "MMMM":
                return $(E, D);
              case "D":
                return f.$D;
              case "DD":
                return b.s(f.$D, 2, "0");
              case "d":
                return String(f.$W);
              case "dd":
                return $(c.weekdaysMin, f.$W, A, 2);
              case "ddd":
                return $(c.weekdaysShort, f.$W, A, 3);
              case "dddd":
                return A[f.$W];
              case "H":
                return String(S);
              case "HH":
                return b.s(S, 2, "0");
              case "h":
                return et(1);
              case "hh":
                return et(2);
              case "a":
                return J(S, W, !0);
              case "A":
                return J(S, W, !1);
              case "m":
                return String(W);
              case "mm":
                return b.s(W, 2, "0");
              case "s":
                return String(f.$s);
              case "ss":
                return b.s(f.$s, 2, "0");
              case "SSS":
                return b.s(f.$ms, 3, "0");
              case "Z":
                return I;
            }
            return null;
          }(T) || I.replace(":", "");
        });
      }, l.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, l.diff = function(u, f, c) {
        var h, I = this, S = b.p(f), W = Y(u), D = (W.utcOffset() - this.utcOffset()) * o, A = this - W, E = function() {
          return b.m(I, W);
        };
        switch (S) {
          case j:
            h = E() / 12;
            break;
          case d:
            h = E();
            break;
          case C:
            h = E() / 3;
            break;
          case p:
            h = (A - D) / 6048e5;
            break;
          case g:
            h = (A - D) / 864e5;
            break;
          case m:
            h = A / r;
            break;
          case i:
            h = A / o;
            break;
          case a:
            h = A / n;
            break;
          default:
            h = A;
        }
        return c ? h : b.a(h);
      }, l.daysInMonth = function() {
        return this.endOf(d).$D;
      }, l.$locale = function() {
        return F[this.$L];
      }, l.locale = function(u, f) {
        if (!u) return this.$L;
        var c = this.clone(), h = gt(u, f, !0);
        return h && (c.$L = h), c;
      }, l.clone = function() {
        return b.w(this.$d, this);
      }, l.toDate = function() {
        return new Date(this.valueOf());
      }, l.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, l.toISOString = function() {
        return this.$d.toISOString();
      }, l.toString = function() {
        return this.$d.toUTCString();
      }, y;
    }(), Zt = dt.prototype;
    return Y.prototype = Zt, [["$ms", s], ["$s", a], ["$m", i], ["$H", m], ["$W", g], ["$M", d], ["$y", j], ["$D", k]].forEach(function(y) {
      Zt[y[1]] = function(l) {
        return this.$g(l, y[0], y[1]);
      };
    }), Y.extend = function(y, l) {
      return y.$i || (y(l, dt, Y), y.$i = !0), Y;
    }, Y.locale = gt, Y.isDayjs = jt, Y.unix = function(y) {
      return Y(1e3 * y);
    }, Y.en = F[tt], Y.Ls = F, Y.p = {}, Y;
  });
})(Je);
var oo = Je.exports;
const X = /* @__PURE__ */ no(oo), Be = 5, xe = 7, ro = 2200, ao = 84;
function Ze(t) {
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
function It(t, e) {
  if (typeof t != "string")
    return null;
  const n = t.trim();
  return e.has(n) ? n : null;
}
function io(t, e) {
  if (!Array.isArray(t))
    return [];
  const n = /* @__PURE__ */ new Set();
  for (const o of t) {
    const r = It(o, e);
    r && n.add(r);
  }
  return [...n].sort((o, r) => o.localeCompare(r));
}
function P(t) {
  const e = X(t);
  return e.isValid() ? e.format("M月D日") : t;
}
function Qt(t, e) {
  return t === e ? P(t) : `${P(t)} - ${P(e)}`;
}
function Vt(t) {
  return t.length === 0 ? "这段时间" : t.length <= 3 ? t.map((e) => P(e)).join("、") : `${P(t[0])} 等 ${t.length} 天`;
}
function so(t, e) {
  const n = t && typeof t == "object" ? t : null, o = typeof (n == null ? void 0 : n.label) == "string" ? n.label.trim() : "", r = It(n == null ? void 0 : n.startDate, e), s = It(n == null ? void 0 : n.endDate, e), a = io(n == null ? void 0 : n.dates, e), i = typeof (n == null ? void 0 : n.type) == "string" ? n.type.trim() : "", g = i === "day" || i === "range" || i === "multiple" || i === "approx" ? i : a.length > 1 ? "multiple" : r && s && r !== s ? "range" : r || s || a.length === 1 ? "day" : "approx";
  if (g === "day") {
    const p = r ?? s ?? a[0];
    if (p)
      return {
        type: "day",
        label: o || P(p),
        startDate: p
      };
  }
  if (g === "range") {
    const p = r ?? a[0], d = s ?? a[a.length - 1] ?? p;
    if (p && d) {
      const [C, j] = p <= d ? [p, d] : [d, p];
      return C === j ? {
        type: "day",
        label: o || P(C),
        startDate: C
      } : {
        type: "range",
        label: o || Qt(C, j),
        startDate: C,
        endDate: j
      };
    }
  }
  if (g === "multiple") {
    const p = a.length > 0 ? a : [r, s].filter(Boolean);
    if (p.length === 1)
      return {
        type: "day",
        label: o || P(p[0]),
        startDate: p[0]
      };
    if (p.length > 1)
      return {
        type: "multiple",
        label: o || Vt(p),
        dates: p
      };
  }
  if (r && s && r !== s) {
    const [p, d] = r <= s ? [r, s] : [s, r];
    return {
      type: "approx",
      label: o || Qt(p, d),
      startDate: p,
      endDate: d
    };
  }
  return a.length > 1 ? {
    type: "approx",
    label: o || Vt(a),
    dates: a
  } : r ? {
    type: "day",
    label: o || P(r),
    startDate: r
  } : {
    type: "approx",
    label: o || "这段时间"
  };
}
function Yt(t, e, n) {
  if (!Array.isArray(t))
    return [];
  const o = [], r = /* @__PURE__ */ new Set();
  for (const s of t) {
    if (!s || typeof s != "object")
      continue;
    const a = s, i = typeof a.text == "string" ? a.text.trim() : "";
    if (!i)
      continue;
    const m = so(a.timeAnchor, n), g = `${i}::${m.label}`;
    if (!r.has(g) && (r.add(g), o.push({
      text: i,
      timeAnchor: m
    }), o.length >= e))
      break;
  }
  return o;
}
function uo(t, e) {
  const n = typeof t.text == "string" ? t.text.trim() : "";
  if (!n)
    throw new Error("大模型返回的区间总结为空。");
  return {
    text: n,
    progress: Yt(t.progress, 4, e),
    blockers: Yt(t.blockers, 4, e),
    memorableMoments: Yt(t.memorableMoments, 4, e)
  };
}
function co(t) {
  const e = Ot(t.ai);
  if (!e.baseURL || !e.model)
    throw new Error("请先完成区间总结所需的大模型配置。");
  return e;
}
function _e(t, e) {
  const n = t.replace(/\s+/g, " ").trim();
  return n.length <= e ? n : `${n.slice(0, e)}...`;
}
function Ge(t) {
  return {
    date: t.date,
    summary: _e(t.summary, ao),
    tags: t.tags.slice(0, 4),
    mood: t.mood,
    wordCount: t.wordCount,
    location: t.location,
    insightSource: t.insightSource
  };
}
function Xe(t) {
  var e, n, o, r;
  return {
    topTags: ((e = t.sections.tagCloud) == null ? void 0 : e.items.slice(0, 12)) ?? [],
    locations: ((n = t.sections.locationPatterns) == null ? void 0 : n.ranking.slice(0, 6)) ?? [],
    timeBuckets: ((o = t.sections.timePatterns) == null ? void 0 : o.buckets) ?? [],
    moodAverage: ((r = t.sections.moodTrend) == null ? void 0 : r.averageMood) ?? null
  };
}
function lo(t, e) {
  return JSON.stringify(
    {
      period: t.period,
      source: t.source,
      facts: Xe(t),
      dailyCandidates: e.map((n) => Ge(n))
    },
    null,
    2
  );
}
function mo(t, e, n) {
  const o = new Map(e.map((a) => [a.date, a])), r = n.map((a) => {
    const i = o.get(a.date);
    return i ? {
      date: i.date,
      reason: a.reason,
      summary: i.summary,
      tags: i.tags,
      mood: i.mood,
      wordCount: i.wordCount,
      location: i.location,
      insightSource: i.insightSource,
      body: _e(i.body, ro)
    } : null;
  }).filter((a) => !!a), s = e.slice(0, 20).map((a) => Ge(a));
  return JSON.stringify(
    {
      period: t.period,
      source: t.source,
      generation: {
        requestedSections: t.generation.requestedSections,
        warnings: t.generation.warnings
      },
      facts: {
        ...Xe(t),
        compactTimeline: s,
        focusSelection: n,
        focusEntries: r
      }
    },
    null,
    2
  );
}
function go(t, e) {
  if (e.length <= xe)
    return e.map((i) => ({
      date: i.date,
      reason: "该日期在区间内有实际日记内容，直接纳入详细总结。"
    }));
  const n = Math.min(Be, e.length), o = /* @__PURE__ */ new Set(), r = [], s = [...e].sort((i, m) => {
    const g = i.wordCount * 15e-4 + Math.abs(i.mood ?? 0) * 20 + i.tags.length * 8 + (i.summary.trim() ? 12 : 0);
    return m.wordCount * 15e-4 + Math.abs(m.mood ?? 0) * 20 + m.tags.length * 8 + (m.summary.trim() ? 12 : 0) - g || i.date.localeCompare(m.date);
  });
  for (const i of s) {
    if (r.length >= n)
      break;
    o.has(i.date) || (o.add(i.date), r.push({
      date: i.date,
      reason: "该日期的记录信息较集中，适合作为阶段样本。"
    }));
  }
  if (r.length >= Math.min(3, n))
    return r;
  const a = Math.max(1, Math.floor(e.length / Math.max(n, 1)));
  for (let i = 0; i < e.length && r.length < n; i += a) {
    const m = e[i];
    o.has(m.date) || (o.add(m.date), r.push({
      date: m.date,
      reason: "该日期用于补足区间不同阶段的上下文。"
    }));
  }
  return r;
}
function po(t, e) {
  var r;
  if (!Array.isArray(t.focusDates))
    return [];
  const n = [], o = /* @__PURE__ */ new Set();
  for (const s of t.focusDates) {
    if (!s || typeof s != "object")
      continue;
    const a = It(s.date, e);
    if (!a || o.has(a))
      continue;
    const i = typeof s.reason == "string" && ((r = s.reason) == null ? void 0 : r.trim()) || "";
    if (o.add(a), n.push({
      date: a,
      reason: i || "该日期值得进一步查看。"
    }), n.length >= Be)
      break;
  }
  return n;
}
async function fo(t, e, n, o) {
  const r = go(t, e);
  if (e.length <= xe)
    return r;
  const s = new Set(e.map((a) => a.date));
  try {
    const a = await o.completeJson({
      messages: [
        { role: "system", content: n },
        {
          role: "user",
          content: lo(t, e)
        }
      ]
    }), i = po(
      Ze(a),
      s
    );
    return i.length > 0 ? i : r;
  } catch {
    return r;
  }
}
async function yo(t, e) {
  const [n, o, r] = await Promise.all([
    M(),
    kt("rangeReportSummaryFocusSystem"),
    kt("rangeReportSummarySystem")
  ]), s = co(n), a = await Le(s.providerType);
  if (!a)
    throw new Error("请先保存当前 provider 的 API Key。");
  const i = e.filter(
    (d) => d.body.trim() || d.summary.trim() || d.tags.length > 0
  );
  if (i.length === 0)
    throw new Error("当前区间没有可用于总结的日记内容。");
  const m = Oe(s, a), g = await fo(t, i, o, m), p = await m.completeJson({
    messages: [
      { role: "system", content: r },
      {
        role: "user",
        content: mo(t, i, g)
      }
    ]
  });
  return uo(
    Ze(p),
    new Set(i.map((d) => d.date))
  );
}
function St(t) {
  return [...t].sort((e, n) => e.localeCompare(n, "zh-Hans-CN"));
}
function it(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...me]
  } : {
    version: 1,
    tags: St(B(t.tags))
  };
}
function st(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...At]
  } : {
    version: 1,
    items: St(B(t.items ?? At))
  };
}
function ut(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...le]
  } : {
    version: 1,
    items: St(B(t.items))
  };
}
async function Ue(t) {
  try {
    const e = await ie(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (o) => {
        const r = v.join(t, o.name);
        return o.isDirectory() ? Ue(r) : o.isFile() && o.name.toLowerCase().endsWith(".md") ? [r] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function ho(t) {
  const e = Rn(t), n = await Ue(e), o = /* @__PURE__ */ new Set();
  for (const r of n)
    try {
      const s = await lt(r);
      for (const a of s.frontmatter.tags)
        o.add(a);
    } catch (s) {
      if (s.code === "ENOENT")
        continue;
      throw s;
    }
  return St([...o]);
}
async function zt(t) {
  await U(ct(t), { recursive: !0 });
}
async function Qe(t) {
  const e = Ye(t);
  try {
    const n = await z(e, "utf-8");
    return it(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const o = await ho(t), r = it({
        tags: [...me, ...o]
      });
      return await Ft(t, r), r;
    }
    throw n;
  }
}
async function Ft(t, e) {
  await zt(t), await N(
    Ye(t),
    JSON.stringify(it(e), null, 2),
    "utf-8"
  );
}
async function Ve(t) {
  const e = De(t);
  try {
    const n = await z(e, "utf-8");
    return st(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const o = st({
        items: At
      });
      return await $t(t, o), o;
    }
    throw n;
  }
}
async function $t(t, e) {
  await zt(t), await N(
    De(t),
    JSON.stringify(st(e), null, 2),
    "utf-8"
  );
}
async function tn(t) {
  const e = Ae(t);
  try {
    const n = await z(e, "utf-8");
    return ut(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const o = ut({
        items: le
      });
      return await Jt(t, o), o;
    }
    throw n;
  }
}
async function Jt(t, e) {
  await zt(t), await N(
    Ae(t),
    JSON.stringify(ut(e), null, 2),
    "utf-8"
  );
}
async function Io(t, e) {
  const n = await Qe(t), o = it({
    tags: [...n.tags, ...e]
  });
  await Ft(t, o);
}
async function vo(t, e) {
  const n = await Ve(t), o = st({
    items: [...n.items, ...e]
  });
  await $t(t, o);
}
async function Lo(t, e) {
  const n = await tn(t), o = ut({
    items: [...n.items, ...e]
  });
  await Jt(t, o);
}
async function en(t) {
  return (await Qe(t)).tags;
}
async function Oo(t) {
  const e = it({
    tags: t.items
  });
  return await Ft(t.workspacePath, e), e.tags;
}
async function Co(t) {
  return (await Ve(t)).items;
}
async function bo(t) {
  const e = st({
    items: t.items
  });
  return await $t(t.workspacePath, e), e.items;
}
async function So(t) {
  return (await tn(t)).items;
}
async function Wo(t) {
  const e = ut({
    items: t.items
  });
  return await Jt(t.workspacePath, e), e.items;
}
function wo(t) {
  Ct(t);
  const [e, n] = t.split("-"), o = Number(e), r = Number(n);
  return new Date(o, r, 0).getDate();
}
async function nn(t) {
  const e = bt(t);
  try {
    const n = await lt(e);
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
async function jo(t) {
  const e = bt(t);
  await U(v.dirname(e), { recursive: !0 });
  const n = Pe();
  try {
    await N(e, He(n, ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (o) {
    if (o.code !== "EEXIST")
      throw o;
  }
  return nn(t);
}
async function Yo(t) {
  const e = bt(t), n = await Ne(e), o = (/* @__PURE__ */ new Date()).toISOString();
  return await Re(
    e,
    {
      ...n.frontmatter,
      updatedAt: o
    },
    t.body
  ), {
    filePath: e,
    savedAt: o
  };
}
async function Do(t) {
  const e = bt(t), n = await Ne(e), o = (/* @__PURE__ */ new Date()).toISOString(), r = Me(t.metadata);
  return await Re(
    e,
    {
      ...n.frontmatter,
      ...r,
      updatedAt: o
    },
    n.body
  ), await Io(t.workspacePath, r.tags), await vo(
    t.workspacePath,
    r.weather ? [r.weather] : []
  ), await Lo(
    t.workspacePath,
    r.location ? [r.location] : []
  ), {
    filePath: e,
    savedAt: o
  };
}
async function Ao(t) {
  const { workspacePath: e, month: n } = t, o = wo(n), [r, s] = n.split("-"), a = await Promise.all(
    Array.from({ length: o }, async (i, m) => {
      const g = String(m + 1).padStart(2, "0"), p = `${r}-${s}-${g}`, d = Ht(e, p);
      try {
        const C = await lt(d);
        return {
          date: p,
          hasEntry: !0,
          wordCount: ze(C.body)
        };
      } catch (C) {
        if (C.code === "ENOENT")
          return {
            date: p,
            hasEntry: !1,
            wordCount: 0
          };
        throw C;
      }
    })
  );
  return {
    month: n,
    days: a
  };
}
const te = 1;
function ko(t) {
  const e = [
    "stats",
    "heatmap",
    "moodTrend",
    "tagCloud",
    "locationPatterns",
    "timePatterns"
  ], n = /* @__PURE__ */ new Set();
  for (const o of t)
    e.includes(o) && n.add(o);
  return n.size > 0 ? [...n] : e;
}
function To(t) {
  if (!t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  ht(t.startDate), ht(t.endDate);
  const e = X(t.startDate), n = X(t.endDate);
  if (!e.isValid() || !n.isValid())
    throw new Error("报告区间无效。");
  if (n.isBefore(e, "day"))
    throw new Error("结束日期不能早于开始日期。");
  if (t.preset === "month") {
    const o = e.format("YYYY-MM");
    if (Ct(o), !e.isSame(e.startOf("month"), "day") || !n.isSame(e.endOf("month"), "day"))
      throw new Error("月度报告的区间必须覆盖完整自然月。");
  }
  if (t.preset === "year") {
    const o = e.format("YYYY");
    if (Pt(o), !e.isSame(e.startOf("year"), "day") || !n.isSame(e.endOf("year"), "day"))
      throw new Error("年度报告的区间必须覆盖完整自然年。");
  }
  if (t.preset === "custom" && n.isAfter(e.add(te, "year"), "day"))
    throw new Error(`自定义区间跨度不能超过${te}年。`);
  return {
    startDate: e,
    endDate: n,
    requestedSections: ko(t.requestedSections)
  };
}
function Ko(t, e) {
  const n = [];
  let o = t.startOf("day");
  for (; o.isSame(e, "day") || o.isBefore(e, "day"); )
    n.push(o.format("YYYY-MM-DD")), o = o.add(1, "day");
  return n;
}
function Mo(t, e) {
  const n = t ? X(t) : null;
  if (n != null && n.isValid())
    return n.hour();
  const o = e ? X(e) : null;
  return o != null && o.isValid() ? o.hour() : null;
}
async function Eo(t, e, n) {
  const o = Ko(e, n);
  return Promise.all(
    o.map(async (r) => {
      const s = Ht(t, r);
      try {
        const a = await lt(s), i = a.frontmatter.createdAt || null, m = a.frontmatter.updatedAt || null;
        return {
          entry: {
            date: r,
            hasEntry: !0,
            wordCount: ze(a.body),
            mood: a.frontmatter.mood,
            summary: a.frontmatter.summary,
            tags: [...a.frontmatter.tags],
            location: a.frontmatter.location,
            createdAt: i,
            updatedAt: m,
            writingHour: Mo(i, m),
            insightSource: "frontmatter"
          },
          body: a.body
        };
      } catch (a) {
        if (a.code === "ENOENT")
          return {
            entry: {
              date: r,
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
function qo(t) {
  return t.entry.hasEntry && t.entry.summary.trim() === "" && t.body.trim() !== "";
}
async function Po(t, e) {
  const n = [], o = await en(t).catch(() => []);
  let r = 0, s = 0, a = !1;
  const i = [];
  for (const m of e) {
    const { entry: g, body: p } = m;
    if (!g.hasEntry) {
      i.push(g);
      continue;
    }
    if (!qo(m)) {
      g.summary.trim() && (r += 1), i.push(g);
      continue;
    }
    a = !0;
    try {
      const d = await to({
        workspacePath: t,
        date: g.date,
        body: p,
        workspaceTags: o,
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
      const C = d instanceof Error ? d.message : "未知错误";
      n.push(`${g.date} 的日级整理未生成：${C}`), i.push(g);
    }
  }
  return {
    dailyEntries: i,
    warnings: n,
    reusedEntryInsightCount: r,
    generatedEntryInsightCount: s,
    entryInsightPolicy: a ? "reuse-or-generate" : "reuse-only"
  };
}
function Ho(t) {
  let e = 0, n = 0;
  for (const o of t) {
    if (o.hasEntry) {
      n += 1, e = Math.max(e, n);
      continue;
    }
    n = 0;
  }
  return e;
}
function No(t) {
  let e = 0;
  for (let n = t.length - 1; n >= 0 && t[n].hasEntry; n -= 1)
    e += 1;
  return e;
}
function on(t) {
  const e = t.filter((o) => o.hasEntry), n = e.reduce((o, r) => o + r.wordCount, 0);
  return {
    totalDays: t.length,
    entryDays: e.length,
    missingDays: t.length - e.length,
    totalWords: n,
    averageWords: e.length > 0 ? Math.round(n / e.length) : 0,
    longestStreak: Ho(t)
  };
}
function Ro(t) {
  const e = on(t), n = t.filter((o) => o.hasEntry).reduce((o, r) => !o || r.wordCount > o.wordCount ? r : o, null);
  return {
    recordDays: e.entryDays,
    missingDays: e.missingDays,
    totalWords: e.totalWords,
    averageWords: e.averageWords,
    maxWordsInOneDay: (n == null ? void 0 : n.wordCount) ?? 0,
    maxWordsDate: (n == null ? void 0 : n.date) ?? null,
    longestStreak: e.longestStreak,
    currentStreakAtEnd: No(t)
  };
}
function rn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    for (const o of n.tags)
      e.set(o, (e.get(o) ?? 0) + 1);
  return [...e.entries()].map(([n, o]) => ({ label: n, value: o })).sort((n, o) => o.value - n.value || n.label.localeCompare(o.label, "zh-Hans-CN")).slice(0, 30);
}
function zo(t) {
  const e = /* @__PURE__ */ new Map();
  for (const a of t) {
    if (!a.hasEntry || !a.location.trim())
      continue;
    const i = a.location.trim(), m = e.get(i) ?? { count: 0, totalWords: 0 };
    e.set(i, {
      count: m.count + 1,
      totalWords: m.totalWords + a.wordCount
    });
  }
  const n = [...e.entries()].map(([a, i]) => ({
    name: a,
    count: i.count,
    totalWords: i.totalWords
  })).sort((a, i) => i.count - a.count || i.totalWords - a.totalWords), o = n[0] ? {
    name: n[0].name,
    count: n[0].count
  } : null, r = Math.max(
    ...n.map((a) => a.totalWords / a.count),
    1
  ), s = n.reduce((a, i) => {
    const m = 1 / i.count, p = i.totalWords / i.count / r, d = Number((m * 0.62 + p * 0.38).toFixed(2));
    return !a || d > a.score ? {
      name: i.name,
      count: i.count,
      score: d
    } : a;
  }, null);
  return {
    topLocation: o,
    uniqueLocation: s ? {
      name: s.name,
      count: s.count
    } : null,
    ranking: n.map((a) => ({
      name: a.name,
      count: a.count
    }))
  };
}
function Fo(t) {
  return t >= 0 && t <= 5 ? "凌晨 0-5" : t <= 8 ? "早晨 6-8" : t <= 11 ? "上午 9-11" : t <= 13 ? "中午 12-13" : t <= 17 ? "下午 14-17" : "晚上 18-23";
}
function $o(t) {
  const e = /* @__PURE__ */ new Map();
  for (const a of t) {
    if (!a.hasEntry || a.writingHour === null)
      continue;
    const i = Fo(a.writingHour), m = e.get(i) ?? { count: 0, totalWords: 0 };
    e.set(i, {
      count: m.count + 1,
      totalWords: m.totalWords + a.wordCount
    });
  }
  const n = [...e.entries()].map(([a, i]) => ({
    label: a,
    count: i.count,
    totalWords: i.totalWords
  })).sort((a, i) => i.count - a.count || i.totalWords - a.totalWords), o = n[0] ? {
    label: n[0].label,
    count: n[0].count
  } : null, r = Math.max(...n.map((a) => a.totalWords / a.count), 1), s = n.reduce((a, i) => {
    const m = 1 / i.count, g = i.totalWords / i.count / r, p = Number((m * 0.58 + g * 0.42).toFixed(2));
    return !a || p > a.score ? {
      label: i.label,
      count: i.count,
      score: p
    } : a;
  }, null);
  return {
    topTimeBucket: o,
    uniqueTimeBucket: s ? {
      label: s.label,
      count: s.count
    } : null,
    buckets: n.map((a) => ({
      label: a.label,
      count: a.count
    }))
  };
}
function Jo(t, e) {
  const n = {};
  if (e.includes("stats") && (n.stats = Ro(t)), e.includes("heatmap") && (n.heatmap = {
    points: t.map((o) => ({
      date: o.date,
      value: o.wordCount
    }))
  }), e.includes("moodTrend")) {
    const o = t.filter((s) => s.mood !== null), r = o.reduce((s, a) => s + (a.mood ?? 0), 0);
    n.moodTrend = {
      points: t.map((s) => ({
        date: s.date,
        value: s.mood
      })),
      averageMood: o.length > 0 ? Number((r / o.length).toFixed(1)) : null
    };
  }
  return e.includes("tagCloud") && (n.tagCloud = {
    items: rn(t)
  }), e.includes("locationPatterns") && (n.locationPatterns = zo(t)), e.includes("timePatterns") && (n.timePatterns = $o(t)), n;
}
function Bo(t, e, n) {
  return t === "month" ? `${e.format("YYYY 年 M 月")}总结` : t === "year" ? `${e.format("YYYY 年")}总结` : `${e.format("YYYY 年 M 月 D 日")} 至 ${n.format("YYYY 年 M 月 D 日")}总结`;
}
function xo(t, e, n) {
  return t === "month" ? `${e.format("YYYY 年 M 月")}没有任何日记，无法生成报告。` : t === "year" ? `${e.format("YYYY 年")}没有任何日记，无法生成报告。` : `${e.format("YYYY-MM-DD")} 至 ${n.format("YYYY-MM-DD")} 这段时间没有任何日记，无法生成报告。`;
}
function Zo(t, e, n) {
  return t === "month" ? `month_${e.format("YYYY-MM")}` : t === "year" ? `year_${e.format("YYYY")}` : `custom_${e.format("YYYY-MM-DD")}_${n.format("YYYY-MM-DD")}_${Date.now()}`;
}
function _o(t, e, n) {
  var o;
  return t.preset === "custom" && ((o = t.overwriteReportId) != null && o.trim()) ? t.overwriteReportId.trim() : Zo(t.preset, e, n);
}
function Go(t, e, n) {
  const o = rn(n).slice(0, 3).map((s) => s.label), r = o.length > 0 ? `主要标签包括 ${o.join("、")}。` : "这段时间还没有形成明显的标签集中。";
  return {
    text: `${t}共记录 ${e.entryDays} 天，缺失 ${e.missingDays} 天，总字数 ${e.totalWords}，最长连续记录 ${e.longestStreak} 天。${r}`,
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
function Xo(t, e) {
  const n = new Map(e.map((o) => [o.date, o]));
  return t.map((o) => {
    const r = n.get(o.entry.date);
    return !r || !r.hasEntry ? null : {
      date: r.date,
      body: o.body,
      summary: r.summary,
      tags: [...r.tags],
      mood: r.mood,
      wordCount: r.wordCount,
      location: r.location,
      insightSource: r.insightSource
    };
  }).filter((o) => !!o);
}
async function Uo(t, e, n) {
  try {
    return await yo(t, n);
  } catch (o) {
    const r = o instanceof Error ? o.message : "区间总结 AI 生成失败。";
    return t.generation.warnings.push(`AI 总结未生成：${r}`), e;
  }
}
function Qo() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}
function Vo(t, e, n, o) {
  return e === "month" ? ke(t, o.format("YYYY-MM")) : e === "year" ? Te(t, o.format("YYYY")) : Ke(t, n);
}
async function tr(t, e) {
  await U(v.dirname(t), { recursive: !0 }), await N(t, JSON.stringify(e, null, 2), "utf-8");
}
function er(t) {
  if (!t || typeof t != "object")
    throw new Error("报告文件内容无效。");
  return t;
}
async function an(t) {
  const e = await z(t, "utf-8");
  return er(JSON.parse(e));
}
async function _(t) {
  try {
    return (await ie(t, { withFileTypes: !0 })).filter((n) => n.isFile() && n.name.toLowerCase().endsWith(".json")).map((n) => v.join(t, n.name));
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function nr(t) {
  const { startDate: e, endDate: n, requestedSections: o } = To(t), r = await Eo(t.workspacePath, e, n);
  if (!r.some((Wt) => Wt.entry.hasEntry))
    throw new Error(xo(t.preset, e, n));
  const a = await Po(t.workspacePath, r), i = a.dailyEntries, m = on(i), g = Bo(t.preset, e, n), p = _o(t, e, n), d = (/* @__PURE__ */ new Date()).toISOString(), C = Jo(i, o), j = Go(g, m, i), k = Xo(r, i), K = {
    reportId: p,
    preset: t.preset,
    period: {
      startDate: e.format("YYYY-MM-DD"),
      endDate: n.format("YYYY-MM-DD"),
      label: g,
      generatedAt: d,
      timezone: Qo()
    },
    generation: {
      requestedSections: o,
      entryInsightPolicy: a.entryInsightPolicy,
      reusedEntryInsightCount: a.reusedEntryInsightCount,
      generatedEntryInsightCount: a.generatedEntryInsightCount,
      skippedEmptyDays: m.missingDays,
      warnings: [...a.warnings]
    },
    summary: j,
    source: m,
    dailyEntries: i,
    sections: C
  };
  K.summary = await Uo(K, j, k);
  const V = Vo(t.workspacePath, t.preset, p, e);
  return await tr(V, K), K;
}
function or(t, e) {
  if (e.startsWith("month_")) {
    const n = e.slice(6);
    return [
      ke(t, n),
      zn(t, n)
    ];
  }
  if (e.startsWith("year_")) {
    const n = e.slice(5);
    return [
      Te(t, n),
      Fn(t, n)
    ];
  }
  return [
    Ke(t, e),
    $n(t, e)
  ];
}
async function rr(t) {
  let e = null;
  for (const n of t)
    try {
      return await an(n);
    } catch (o) {
      if (o.code === "ENOENT") {
        e = o;
        continue;
      }
      throw o;
    }
  throw e ?? new Error("报告不存在。");
}
async function sn(t) {
  return rr(or(t.workspacePath, t.reportId));
}
async function ar(t) {
  if (!t.trim())
    return [];
  const [e, n, o, r, s, a] = await Promise.all([
    _(Ce(t)),
    _(be(t)),
    _(Se(t)),
    _(We(t)),
    _(we(t)),
    _(je(t))
  ]), i = [
    ...e,
    ...n,
    ...o,
    ...r,
    ...s,
    ...a
  ], m = await Promise.all(
    i.map(async (p) => {
      const d = await an(p);
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
  for (const p of m)
    g.has(p.reportId) || g.set(p.reportId, p);
  return [...g.values()].sort((p, d) => d.generatedAt.localeCompare(p.generatedAt));
}
let w = null, yt = !1, ft = !1;
function un() {
  return w;
}
function ir(t) {
  yt = t;
}
function sr() {
  if (w) {
    if (w.webContents.isDevToolsOpened()) {
      w.webContents.focus();
      return;
    }
    w.webContents.openDevTools({ mode: "detach" });
  }
}
function Bt(t) {
  w && w.webContents.setZoomFactor(Lt(t));
}
function cn(t) {
  !w || w.isDestroyed() || w.webContents.send(L.windowZoomChanged, {
    zoomFactor: Lt(t)
  });
}
function ur(t) {
  return t.type !== "keyDown" || !(t.control || t.meta) || t.alt ? null : t.code === "Equal" || t.code === "NumpadAdd" || t.key === "+" || t.key === "=" ? "zoom-in" : t.code === "Minus" || t.code === "NumpadSubtract" || t.key === "-" || t.key === "_" ? "zoom-out" : t.code === "Digit0" || t.code === "Numpad0" || t.key === "0" || t.key === ")" ? "reset" : null;
}
async function cr(t) {
  const e = await M(), n = t === "zoom-in" ? _t(e.ui.zoomFactor, 1) : t === "zoom-out" ? _t(e.ui.zoomFactor, -1) : vt, o = await ye({
    zoomFactor: n
  });
  Bt(o.ui.zoomFactor), cn(o.ui.zoomFactor);
}
async function lr(t) {
  const e = await ye({
    zoomFactor: t
  });
  return Bt(e.ui.zoomFactor), cn(e.ui.zoomFactor), e;
}
async function ln() {
  pn.setApplicationMenu(null), yt = !1, ft = !1;
  const e = (await M()).ui.zoomFactor;
  w = new Mt({
    width: 1600,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: In,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: v.join(ue, "preload.mjs"),
      zoomFactor: e
    }
  }), Bt(e), at ? w.loadURL(at) : w.loadFile(v.join(Et, "index.html")), w.webContents.on("before-input-event", (n, o) => {
    const r = ur(o);
    r && (n.preventDefault(), cr(r));
  }), w.on("close", async (n) => {
    if (ft || !yt || !w)
      return;
    n.preventDefault();
    const { response: o } = await rt.showMessageBox(w, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    o === 0 && (ft = !0, w.close());
  }), w.on("closed", () => {
    yt = !1, ft = !1, w = null;
  });
}
function mr() {
  H.on("window-all-closed", () => {
    process.platform !== "darwin" && (H.quit(), w = null);
  }), H.on("activate", () => {
    Mt.getAllWindows().length === 0 && ln();
  });
}
const G = 1200, mn = 900, gr = 420, ee = 12e3, dr = 2e4, ne = 1.5, pr = 1, fr = 4, oe = [
  "cover",
  "stats",
  "summary",
  "heatmap",
  "moodTrend",
  "tagCloud",
  "locationPatterns",
  "timePatterns"
], mt = /* @__PURE__ */ new Map();
function Dt(t) {
  return t.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "报告导出";
}
function yr(t) {
  const e = X(t.period.startDate);
  if (t.preset === "month") {
    const o = e.isValid() ? `${e.year()}年${e.month() + 1}月总结` : t.period.label;
    return Dt(o);
  }
  if (t.preset === "year") {
    const o = e.isValid() ? `${e.year()}年总结` : t.period.label;
    return Dt(o);
  }
  const n = `${t.period.startDate}至${t.period.endDate}总结`;
  return Dt(n);
}
function hr(t) {
  return v.extname(t).toLowerCase() === ".png" ? t : `${t}.png`;
}
function Ir(t) {
  const e = /* @__PURE__ */ new Set(["cover", "stats", "summary"]);
  return t.sections.heatmap && e.add("heatmap"), t.sections.moodTrend && e.add("moodTrend"), t.sections.tagCloud && e.add("tagCloud"), t.sections.locationPatterns && e.add("locationPatterns"), t.sections.timePatterns && e.add("timePatterns"), e;
}
function vr(t, e) {
  const n = Ir(e), o = /* @__PURE__ */ new Set();
  for (const r of t)
    oe.includes(r) && n.has(r) && o.add(r);
  return oe.filter((r) => o.has(r));
}
function Lr(t) {
  if (!Number.isFinite(t))
    return ne;
  const e = Math.round((t ?? ne) * 10) / 10;
  return Math.min(
    fr,
    Math.max(pr, e)
  );
}
function Or(t) {
  const e = `report_export_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let n = () => {
  };
  const o = new Promise((r) => {
    n = r;
  });
  return mt.set(e, {
    payload: t,
    readyPromise: o,
    resolveReady: n,
    isReady: !1
  }), e;
}
function Cr(t) {
  mt.delete(t);
}
async function br(t) {
  const e = new Mt({
    show: !1,
    useContentSize: !0,
    width: G,
    height: mn,
    backgroundColor: "#f6f2e8",
    webPreferences: {
      preload: v.join(ue, "preload.mjs")
    }
  });
  if (at) {
    const n = new URL(at);
    n.searchParams.set("mode", "report-export"), n.searchParams.set("sessionId", t), await e.loadURL(n.toString());
  } else
    await e.loadFile(v.join(Et, "index.html"), {
      query: {
        mode: "report-export",
        sessionId: t
      }
    });
  return e;
}
function re(t, e, n, o) {
  const r = o;
  if (r <= 1) {
    t.webContents.disableDeviceEmulation();
    return;
  }
  t.webContents.enableDeviceEmulation({
    screenPosition: "desktop",
    screenSize: {
      width: e,
      height: n
    },
    viewPosition: {
      x: 0,
      y: 0
    },
    deviceScaleFactor: r,
    viewSize: {
      width: e,
      height: n
    },
    scale: 1
  });
}
async function Sr(t) {
  const e = mt.get(t);
  if (!e)
    throw new Error("导出会话不存在，请重新尝试导出。");
  const n = new Promise((o, r) => {
    setTimeout(() => {
      r(new Error("导出页面准备超时，请稍后重试。"));
    }, dr);
  });
  return Promise.race([e.readyPromise, n]);
}
function Wr(t) {
  if (!Number.isFinite(t) || t <= 0)
    throw new Error("导出内容高度无效，请稍后重试。");
  const e = Math.ceil(t);
  if (e > ee)
    throw new Error(`导出内容过长（${e}px），超过单张长图上限（${ee}px）。`);
  return Math.max(e, gr);
}
function wr(t) {
  const e = H.getPath("downloads");
  return v.join(e, `${t}.png`);
}
function jr() {
  return new Promise((t) => {
    setTimeout(t, 120);
  });
}
async function Yr(t) {
  const e = t.workspacePath.trim(), n = t.reportId.trim(), o = Lr(t.imageScale);
  if (!e)
    throw new Error("当前没有可用工作区，无法导出报告。");
  if (!n)
    throw new Error("报告标识无效，无法导出。");
  const r = await sn({
    workspacePath: e,
    reportId: n
  }), s = vr(t.sections, r);
  if (s.length === 0)
    throw new Error("导出内容为空，请至少选择一个可导出的模块。");
  const a = yr(r), i = {
    title: "导出报告 PNG",
    buttonLabel: "保存图片",
    defaultPath: wr(a),
    filters: [
      { name: "PNG 图片", extensions: ["png"] }
    ]
  }, m = un(), g = m ? await rt.showSaveDialog(m, i) : await rt.showSaveDialog(i);
  if (g.canceled || !g.filePath)
    return {
      canceled: !0,
      filePaths: [],
      exportedSections: s,
      imageCount: 0
    };
  const p = hr(g.filePath), d = Or({
    report: r,
    sections: s,
    documentWidth: G
  });
  let C = null;
  try {
    C = await br(d), re(
      C,
      G,
      mn,
      o
    );
    const j = await Sr(d), k = Wr(j);
    C.setContentSize(G, k), re(
      C,
      G,
      k,
      o
    ), await jr();
    const K = await C.webContents.capturePage({
      x: 0,
      y: 0,
      width: G,
      height: k
    });
    if (K.isEmpty())
      throw new Error("导出失败，截图结果为空。");
    return await N(p, K.toPNG()), {
      canceled: !1,
      filePaths: [p],
      exportedSections: s,
      imageCount: 1
    };
  } finally {
    Cr(d), C && !C.isDestroyed() && C.destroy();
  }
}
async function Dr(t) {
  const e = t.sessionId.trim(), n = mt.get(e);
  if (!n)
    throw new Error("导出会话已失效，请重新开始导出。");
  return n.payload;
}
async function Ar(t) {
  const e = t.sessionId.trim(), n = mt.get(e);
  if (!n)
    throw new Error("导出会话已失效，请重新开始导出。");
  n.isReady || (n.isReady = !0, n.resolveReady(t.contentHeight));
}
function kr() {
  O.handle(L.getBootstrap, async () => ({ config: await M() })), O.handle(L.getAiSettingsStatus, () => Mn()), O.handle(L.setWindowZoomFactor, (t, e) => lr(e.zoomFactor)), O.handle(L.saveAiSettings, (t, e) => En(e)), O.handle(L.saveAiApiKey, (t, e) => Kn(e)), O.handle(
    L.setJournalHeatmapEnabled,
    (t, e) => jn(e)
  ), O.handle(L.setDayStartHour, (t, e) => Yn(e)), O.handle(
    L.setFrontmatterVisibility,
    (t, e) => Dn(e)
  ), O.handle(L.setWindowDirtyState, (t, e) => {
    ir(e.isDirty);
  }), O.handle(L.openExternalLink, async (t, e) => {
    const n = e.url.trim();
    if (!/^https:\/\/.+/i.test(n) && !/^mailto:.+/i.test(n))
      throw new Error("暂不支持打开这个地址。");
    await fn.openExternal(n);
  }), O.handle(L.openDevTools, () => {
    sr();
  }), O.handle(L.chooseWorkspace, async () => {
    const t = await M(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = un(), o = n ? await rt.showOpenDialog(n, e) : await rt.showOpenDialog(e);
    if (o.canceled || o.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const r = o.filePaths[0], s = kn(r, t);
    return await Q(s), {
      canceled: !1,
      workspacePath: r,
      config: s
    };
  }), O.handle(L.getWorkspaceTags, (t, e) => en(e)), O.handle(L.setWorkspaceTags, (t, e) => Oo(e)), O.handle(L.getWorkspaceWeatherOptions, (t, e) => Co(e)), O.handle(
    L.setWorkspaceWeatherOptions,
    (t, e) => bo(e)
  ), O.handle(L.getWorkspaceLocationOptions, (t, e) => So(e)), O.handle(
    L.setWorkspaceLocationOptions,
    (t, e) => Wo(e)
  ), O.handle(L.readJournalEntry, (t, e) => nn(e)), O.handle(L.createJournalEntry, (t, e) => jo(e)), O.handle(L.saveJournalEntryBody, (t, e) => Yo(e)), O.handle(
    L.saveJournalEntryMetadata,
    (t, e) => Do(e)
  ), O.handle(L.getJournalMonthActivity, (t, e) => Ao(e)), O.handle(L.generateDailyInsights, (t, e) => $e(e)), O.handle(L.generateRangeReport, (t, e) => nr(e)), O.handle(L.getRangeReport, (t, e) => sn(e)), O.handle(L.listRangeReports, (t, e) => ar(e)), O.handle(L.exportRangeReportPng, (t, e) => Yr(e)), O.handle(L.getReportExportPayload, (t, e) => Dr(e)), O.handle(L.notifyReportExportReady, (t, e) => Ar(e));
}
mr();
H.whenReady().then(() => {
  kr(), ln();
});
