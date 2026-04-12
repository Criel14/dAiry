import { app as y, safeStorage as Y, BrowserWindow as G, Menu as At, dialog as P, ipcMain as s } from "electron";
import u from "node:path";
import { readFile as h, mkdir as w, writeFile as v, stat as $, readdir as St } from "node:fs/promises";
import { fileURLToPath as Q } from "node:url";
const Dt = u.dirname(Q(import.meta.url));
process.env.APP_ROOT = u.join(Dt, "..");
const Tt = process.platform === "win32" ? "app.ico" : "app.png", Ct = u.join(process.env.APP_ROOT, "build", "icons", Tt), J = process.env.VITE_DEV_SERVER_URL, Kt = u.join(process.env.APP_ROOT, "dist-electron"), V = u.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = J ? u.join(process.env.APP_ROOT, "public") : V;
const c = {
  getBootstrap: "app:get-bootstrap",
  getAiSettingsStatus: "app:get-ai-settings-status",
  saveAiSettings: "app:save-ai-settings",
  saveAiApiKey: "app:save-ai-api-key",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
  setDayStartHour: "app:set-day-start-hour",
  setFrontmatterVisibility: "app:set-frontmatter-visibility",
  setWindowDirtyState: "app:set-window-dirty-state",
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
  generateDailyInsights: "journal:generate-daily-insights"
}, g = {
  providerType: "openai-compatible",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  timeoutMs: 3e4
}, tt = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    journalHeatmapEnabled: !1,
    dayStartHour: 0,
    frontmatterVisibility: {
      weather: !0,
      location: !0,
      summary: !0,
      tags: !0
    }
  },
  ai: g
}, Ht = {
  weather: "",
  location: "",
  summary: "",
  tags: []
}, q = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
], et = ["学校", "公司", "家"], nt = ["上班", "加班", "原神", "杀戮尖塔"];
function rt() {
  return u.join(y.getPath("userData"), "config.json");
}
function ot(t) {
  return typeof t != "number" || !Number.isInteger(t) || t < 0 || t > 6 ? 0 : t;
}
function Et(t) {
  return g.timeoutMs;
}
function Pt(t, e = g.baseURL) {
  return typeof t != "string" ? e : t.trim().replace(/\/+$/, "") || e;
}
function Jt(t, e = g.model) {
  return typeof t != "string" ? e : t.trim() || e;
}
function qt(t) {
  return t === "openai" || t === "deepseek" || t === "alibaba" || t === "openai-compatible" ? t : g.providerType;
}
function M(t) {
  const e = qt(t == null ? void 0 : t.providerType), n = Mt(e);
  return {
    providerType: e,
    baseURL: Pt(t == null ? void 0 : t.baseURL, n.baseURL),
    model: Jt(t == null ? void 0 : t.model, n.model),
    timeoutMs: Et(t == null ? void 0 : t.timeoutMs)
  };
}
function at(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
function zt(t) {
  var l, A, I, S, d, B;
  if (!t || typeof t != "object")
    return tt;
  const e = t, n = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((Ot) => typeof Ot == "string") : [], r = ((l = e.ui) == null ? void 0 : l.theme) === "light" || ((A = e.ui) == null ? void 0 : A.theme) === "dark" || ((I = e.ui) == null ? void 0 : I.theme) === "system" ? e.ui.theme : "system", o = ((S = e.ui) == null ? void 0 : S.journalHeatmapEnabled) === !0, a = ot((d = e.ui) == null ? void 0 : d.dayStartHour), i = at((B = e.ui) == null ? void 0 : B.frontmatterVisibility), m = M(e.ai);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: r,
      journalHeatmapEnabled: o,
      dayStartHour: a,
      frontmatterVisibility: i
    },
    ai: m
  };
}
async function X(t) {
  try {
    return (await $(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function Yt(t) {
  const e = [];
  for (const o of t.recentWorkspaces)
    await X(o) && e.push(o);
  const n = t.lastOpenedWorkspace && await X(t.lastOpenedWorkspace) ? t.lastOpenedWorkspace : null, r = n && !e.includes(n) ? [n, ...e] : e;
  return {
    ...t,
    lastOpenedWorkspace: n,
    recentWorkspaces: r
  };
}
async function f() {
  try {
    const t = await h(rt(), "utf-8"), e = zt(JSON.parse(t));
    return Yt(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return tt;
    throw t;
  }
}
async function O(t) {
  await w(y.getPath("userData"), { recursive: !0 }), await v(rt(), JSON.stringify(t, null, 2), "utf-8");
}
function Mt(t) {
  switch (t) {
    case "openai":
      return {
        providerType: t,
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        timeoutMs: g.timeoutMs
      };
    case "deepseek":
      return {
        providerType: t,
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        timeoutMs: g.timeoutMs
      };
    case "alibaba":
      return {
        providerType: t,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
        timeoutMs: g.timeoutMs
      };
    default:
      return {
        ...g
      };
  }
}
async function Nt(t) {
  const e = await f(), n = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await O(n), n;
}
async function _t(t) {
  const e = await f(), n = {
    ...e,
    ui: {
      ...e.ui,
      dayStartHour: ot(t.hour)
    }
  };
  return await O(n), n;
}
async function xt(t) {
  const e = await f(), n = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: at(t.visibility)
    }
  };
  return await O(n), n;
}
async function Rt(t) {
  const n = {
    ...await f(),
    ai: M(t)
  };
  return await O(n), n;
}
function Ft(t, e) {
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
function it() {
  return u.join(y.getPath("userData"), "secrets.json");
}
function Bt(t) {
  var o, a, i, m, l;
  if (!t || typeof t != "object")
    return {};
  const e = t, n = ((o = e.ai) == null ? void 0 : o.providerType) === "openai" || ((a = e.ai) == null ? void 0 : a.providerType) === "deepseek" || ((i = e.ai) == null ? void 0 : i.providerType) === "alibaba" || ((m = e.ai) == null ? void 0 : m.providerType) === "openai-compatible" ? e.ai.providerType : void 0, r = typeof ((l = e.ai) == null ? void 0 : l.encryptedApiKey) == "string" ? e.ai.encryptedApiKey : void 0;
  return {
    ai: n || r ? {
      providerType: n,
      encryptedApiKey: r
    } : void 0
  };
}
async function st() {
  try {
    const t = await h(it(), "utf-8");
    return Bt(JSON.parse(t));
  } catch (t) {
    if (t.code === "ENOENT")
      return {};
    throw t;
  }
}
async function U(t) {
  await w(y.getPath("userData"), { recursive: !0 }), await v(it(), JSON.stringify(t, null, 2), "utf-8");
}
function ct() {
  if (!Y.isEncryptionAvailable())
    throw new Error("当前系统环境暂不支持安全加密存储 API Key。");
}
async function N(t) {
  var n;
  const e = await st();
  return !!(((n = e.ai) == null ? void 0 : n.providerType) === t && typeof e.ai.encryptedApiKey == "string" && e.ai.encryptedApiKey.trim());
}
async function Xt(t) {
  var n;
  const e = await st();
  if (((n = e.ai) == null ? void 0 : n.providerType) !== t || !e.ai.encryptedApiKey || !e.ai.encryptedApiKey.trim())
    return null;
  ct();
  try {
    return Y.decryptString(Buffer.from(e.ai.encryptedApiKey, "base64"));
  } catch {
    throw new Error("读取大模型 API Key 失败，密钥可能已损坏，请重新保存。");
  }
}
async function Ut(t) {
  const e = t.apiKey.trim();
  e ? (ct(), await U({
    ai: {
      providerType: t.providerType,
      encryptedApiKey: Y.encryptString(e).toString("base64")
    }
  })) : await U({
    ai: {
      providerType: t.providerType
    }
  });
  const n = await f(), r = await N(n.ai.providerType);
  return {
    settings: n.ai,
    hasApiKey: r,
    isConfigured: !!(n.ai.baseURL && n.ai.model && r)
  };
}
async function Zt() {
  const t = await f(), e = await N(t.ai.providerType);
  return {
    settings: t.ai,
    hasApiKey: e,
    isConfigured: !!(t.ai.baseURL && t.ai.model && e)
  };
}
async function Gt(t) {
  const e = await Rt(t), n = await N(e.ai.providerType);
  return {
    settings: e.ai,
    hasApiKey: n,
    isConfigured: !!(e.ai.baseURL && e.ai.model && n)
  };
}
const $t = {
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YCDkuI4gYHRhZ3Ng44CCCgrkvaDnmoTku7vliqHvvJoKMS4gYHN1bW1hcnlgCiAgIOagueaNruaXpeiusOato+aWh+eUn+aIkOS4gOWPpeivneaAu+e7k++8jOeUqOS6juWGmeWFpSBmcm9udG1hdHRlcuOAggoyLiBgdGFnc2AKICAg55Sf5oiQIDMg5YiwIDYg5Liq5qCH562+77yM55So5LqO6ZW/5pyf5b2S5qGj44CB5pCc57Si5ZKM5Zue6aG+44CCCgrlhYjmiafooYzor63oqIDliKTmlq3vvIzlho3nlJ/miJDnu5PmnpzvvJoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKLSDkvJjlhYjlpI3nlKjigJzlvZPliY3lt6XkvZzljLrlt7LmnInmoIfnrb7igJ3kuK3or63kuYnlh4bnoa7jgIHkuJTor63oqIDpo47moLzkuI7mnKzmrKHovpPlh7rkuIDoh7TnmoTmoIfnrb7jgIIKLSDlj6rmnInlnKjlt7LmnInmoIfnrb7mmI7mmL7kuI3otrPku6Xooajovr7mraPmlofph43ngrnml7bvvIzmiY3mlrDlop7moIfnrb7jgIIKLSDlpoLmnpzlt7LmnInmoIfnrb7kuI7mraPmlofkuLvor63oqIDkuI3kuIDoh7TvvIzkuI3opoHkuLrkuoblpI3nlKjogIzlvLrooYzkvb/nlKjlj6bkuIDnp43or63oqIDnmoTmoIfnrb7jgIIKLSDmoIfnrb7lupTkvJjlhYjmpoLmi6zigJzkuLvpopjjgIHkuovku7bjgIHnirbmgIHjgIHlnLrmma/jgIHku7vliqHjgIHlhbPns7vjgIHlnLDngrnjgIHmg4Xnu6rjgIHpmLbmrrXmgKfpl67popjigJ3nrYnplb/mnJ/lj6/mo4DntKLkv6Hmga/jgIIKLSDmoIfnrb7opoHnroDmtIHjgIHnqLPlrprjgIHlj6/lpI3nlKjvvIzpgb/lhY3kuIDmrKHmgKflj6PlpLTooajovr7jgIIKLSDmoIfnrb7lupTlsL3ph4/mmK/nn63or63miJbor43or63vvIzkuI3opoHlhpnmiJDplb/lj6XjgIIKLSDkuI3opoHovpPlh7rlvbzmraTlh6DkuY7lkIzkuYnjgIHlj6rmmK/ovbvlvq7mjaLlhpnms5XnmoTmoIfnrb7jgIIKLSDkuI3opoHovpPlh7rov4fluqblrr3ms5vjgIHlh6DkuY7lr7nku7vkvZXml6XorrDpg73pgILnlKjnmoTnqbrms5vmoIfnrb7vvIzkvovlpoLigJznlJ/mtLvigJ3igJzorrDlvZXigJ3igJzmg7Pms5XigJ3igJzml6XorrDigJ3jgIIKLSDkuI3opoHmiormgLvnu5Plj6Xmi4bmiJDmoIfnrb7vvIzkuZ/kuI3opoHmnLrmorDmir3lj5bmraPmlofkuK3nmoTmr4/kuKrlkI3or43jgIIKLSDoi7HmlofmoIfnrb7kvJjlhYjkvb/nlKjoh6rnhLbjgIHnroDmtIHnmoQgbG93ZXJjYXNlIOivjeaIluefreivre+8m+mZpOmdnuS4k+acieWQjeivjeacrOi6q+mcgOimgeS/neeVmeWkp+Wwj+WGmeOAggoKYHN1bW1hcnlgIOeUn+aIkOinhOWIme+8mgotIGBzdW1tYXJ5YCDlv4XpobvmmK/kuIDlj6Xor53vvIzkuI3opoHlhpnmiJDmoIfpopjvvIzkuI3opoHliIbngrnvvIzkuI3opoHliqDlvJXlj7fjgIIKLSDor63msJTkv53mjIHlubPlrp7jgIHlhYvliLbjgIHotLTov5Hml6XorrDlvZLmoaPvvIzkuI3opoHlpLjlvKDvvIzkuI3opoHpuKHmsaTvvIzkuI3opoHor4TorrrnlKjmiLfjgIIKLSDkuK3mlofmgLvnu5PmjqfliLblnKjnuqYgMjAg5YiwIDQwIOS4quaxieWtl+OAggotIOiLseaWh+aAu+e7k+aOp+WItuWcqOe6piAxMiDliLAgMjQg5Liq5Y2V6K+N44CCCi0g5oC757uT5bqU5qaC5ous5b2T5aSp5pyA5Li76KaB55qE5LqL5Lu244CB54q25oCB5oiW5o6o6L+b77yM5LiN6KaB5aCG56CM57uG6IqC44CCCi0g6Iul5q2j5paH6YeN54K55piO56Gu77yM5bqU5LyY5YWI5L+d55WZ5pyA5qC45b+D55qEIDEg5YiwIDIg5Liq5L+h5oGv54K544CCCi0g6Iul5q2j5paH6L6D6Zu25pWj77yM5bqU5o+Q54K85YWx5ZCM5Li757q/77yM6ICM5LiN5piv6YCQ5p2h572X5YiX44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKLSDlj6rog73kvp3mja7nlKjmiLfmj5DkvpvnmoTmraPmloflkozlt7LmnInmoIfnrb7ov5vooYzmlbTnkIbjgIIKLSDkuI3opoHnvJbpgKDmraPmlofkuK3msqHmnInlh7rnjrDnmoTph43opoHkuovlrp7jgIHkurrnianlhbPns7vjgIHlnLDngrnjgIHorqHliJLjgIHmg4Xnu6rmiJbnu5PorrrjgIIKLSDkuI3opoHmiormjqjmtYvlvZPmiJDkuovlrp7vvJvlpoLmnpzmraPmlofmsqHmnInmmI7noa7or7TmmI7vvIzlsLHkuI3opoHooaXlhYXjgIIKLSDkuI3opoHmm7/nlKjmiLflgZrku7flgLzliKTmlq3jgIHlv4PnkIbor4rmlq3miJblu7rorq7jgIIKLSDkuI3opoHmmrTpnLLkvaDnmoTliIbmnpDov4fnqIvvvIzkuI3opoHop6Pph4rkuLrku4DkuYjov5nmoLfnlJ/miJDjgIIKLSDkuI3opoHovpPlh7rku7vkvZUgSlNPTiDku6XlpJbnmoTlhoXlrrnjgIIKCui+ueeVjOWkhOeQhu+8mgotIOWNs+S9v+ato+aWh+WGheWuueeugOefreOAgembtuaVo++8jOS5n+imgeWwvemHj+e7meWHuuS4gOS4quWPr+eUqOeahOaAu+e7k+WSjCAzIOWIsCA4IOS4quagh+etvuOAggotIOWmguaenOato+aWh+S4reWMheWQq+W+heWKnuOAgeaDhee7quOAgeW3peS9nOOAgeeUn+a0u+eJh+auteetieWkmuexu+WGheWuue+8jOS8mOWFiOaPkOeCvOW9k+WkqeacgOmHjeimgeeahOS4u+e6v++8jOWGjeeUqOagh+etvuihpeWFheasoeimgee7tOW6puOAggotIOWmguaenOato+aWh+S4u+imgeaYr+iLseaWh++8jOS9huWkueadguWwkemHj+S4reaWh+S4k+acieivje+8jOWPr+WcqOiLseaWh+aAu+e7k+S4reS/neeVmeW/heimgeS4k+acieWQjeivjeWOn+aWh+OAggotIOWmguaenOato+aWh+S4u+imgeaYr+S4reaWh++8jOS9huWkueadguWwkemHj+iLseaWh+acr+ivre+8jOWPr+WcqOS4reaWh+aAu+e7k+S4reS/neeVmeW/heimgeacr+ivreWOn+aWh+OAggoK6L6T5Ye657qm5p2f77yaCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXX1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB6L6T5Ye6IGBudWxsYOOAgeWvueixoeOAgeaVsOWtl+OAgeW4g+WwlOWAvOaIlumineWkluWtl+auteOAggo=", import.meta.url)
}, Z = /* @__PURE__ */ new Map();
async function Qt(t) {
  const e = Z.get(t);
  if (e)
    return e;
  const n = $t[t];
  let r = "";
  if (n.protocol === "file:")
    r = await h(Q(n), "utf-8");
  else if (n.protocol === "data:")
    r = await (await fetch(n)).text();
  else
    throw new Error(`暂不支持读取 ${n.protocol} 协议的提示词文件。`);
  return Z.set(t, r), r;
}
function Vt(t) {
  return t.trim().replace(/\/+$/, "");
}
function te(t) {
  return `${Vt(t)}/chat/completions`;
}
function ee(t) {
  var n, r, o;
  const e = (o = (r = (n = t.choices) == null ? void 0 : n[0]) == null ? void 0 : r.message) == null ? void 0 : o.content;
  return typeof e == "string" ? e : Array.isArray(e) ? e.map((a) => a.type === "text" && typeof a.text == "string" ? a.text : "").join("") : "";
}
function ne(t, e) {
  const n = t.providerType === "openai" || t.providerType === "openai-compatible";
  return {
    async completeJson(r) {
      var m;
      const o = await fetch(te(t.baseURL), {
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
      }), a = await o.json().catch(() => null);
      if (!o.ok)
        throw new Error(((m = a == null ? void 0 : a.error) == null ? void 0 : m.message) || `AI 请求失败（${o.status}）。`);
      const i = a ? ee(a) : "";
      if (!i.trim())
        throw new Error("AI 没有返回可用内容，请稍后重试。");
      return i;
    }
  };
}
function ut(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function re(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function lt(t, e) {
  ut(e);
  const [n, r] = e.split("-");
  return u.join(t, "journal", n, r, `${e}.md`);
}
function C({ workspacePath: t, date: e }) {
  return lt(t, e);
}
function K(t) {
  return u.join(t, ".dairy");
}
function mt(t) {
  return u.join(K(t), "tags.json");
}
function pt(t) {
  return u.join(K(t), "weather.json");
}
function gt(t) {
  return u.join(K(t), "locations.json");
}
function oe(t) {
  return u.join(t, "journal");
}
function k(t) {
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
function ft(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: k(t == null ? void 0 : t.tags)
  };
}
function yt(t, e) {
  const n = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...ft(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? n,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? n
  };
}
function dt() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return yt(
    {
      ...Ht,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function ae(t) {
  const e = t.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return e ? {
    frontmatterText: e[1],
    body: t.slice(e[0].length)
  } : {
    frontmatterText: null,
    body: t
  };
}
function z(t) {
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
function ie(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const n = e.slice(1, -1).trim();
  return n ? n.split(",").map((r) => z(r)) : [];
}
function se(t) {
  const e = {};
  let n = null;
  for (const r of t.split(/\r?\n/)) {
    if (!r.trim())
      continue;
    const o = r.match(/^\s*-\s*(.*)$/);
    if (o && n === "tags") {
      const l = e.tags ?? [];
      e.tags = [...l, z(o[1])];
      continue;
    }
    const a = r.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!a) {
      n = null;
      continue;
    }
    const [, i, m = ""] = a;
    if (n = null, i === "tags") {
      if (!m.trim()) {
        e.tags = [], n = "tags";
        continue;
      }
      e.tags = ie(m);
      continue;
    }
    (i === "createdAt" || i === "updatedAt" || i === "weather" || i === "location" || i === "summary") && (e[i] = z(m));
  }
  return e;
}
function L(t) {
  return JSON.stringify(t);
}
function ce(t) {
  const e = [
    "---",
    `createdAt: ${L(t.createdAt)}`,
    `updatedAt: ${L(t.updatedAt)}`,
    `weather: ${L(t.weather)}`,
    `location: ${L(t.location)}`,
    `summary: ${L(t.summary)}`
  ];
  if (t.tags.length === 0)
    e.push("tags: []");
  else {
    e.push("tags:");
    for (const n of t.tags)
      e.push(`  - ${L(n)}`);
  }
  return e.push("---"), e.join(`
`);
}
function ht(t, e) {
  const n = e.replace(/\r\n/g, `
`);
  return `${ce(t)}
${n}`;
}
async function H(t) {
  const [e, n] = await Promise.all([h(t, "utf-8"), $(t)]), { frontmatterText: r, body: o } = ae(e), a = r ? se(r) : null;
  return {
    frontmatter: yt(a, {
      createdAt: n.birthtime.toISOString(),
      updatedAt: n.mtime.toISOString()
    }),
    body: o
  };
}
async function vt(t) {
  try {
    return await H(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: dt(),
        body: ""
      };
    throw e;
  }
}
async function It(t, e, n) {
  await w(u.dirname(t), { recursive: !0 }), await v(t, ht(e, n), "utf-8");
}
function ue(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function le(t) {
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
function me(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of k(t))
    e.set(n.toLocaleLowerCase(), n);
  return e;
}
function pe(t, e) {
  const n = typeof t.summary == "string" ? t.summary.trim() : "";
  if (!n)
    throw new Error("大模型返回的总结为空，请稍后重试。");
  const r = me(e), o = k(Array.isArray(t.tags) ? t.tags : []).map(
    (l) => r.get(l.toLocaleLowerCase()) ?? l
  ), a = [...new Set(o)].slice(0, 8);
  if (a.length < 3)
    throw new Error("大模型返回的标签数量不足，暂时无法完成自动整理。");
  const i = a.filter((l) => r.has(l.toLocaleLowerCase())), m = a.filter((l) => !r.has(l.toLocaleLowerCase()));
  return {
    summary: n,
    tags: a,
    existingTags: i,
    newTags: m
  };
}
function ge(t) {
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
function fe(t) {
  const e = M(t.ai);
  if (!e.baseURL)
    throw new Error("请先在设置页填写大模型接口地址。");
  if (!e.model)
    throw new Error("请先在设置页填写大模型模型名称。");
  return e;
}
async function ye(t) {
  if (ut(t.date), !t.workspacePath.trim())
    throw new Error("当前还没有可用的工作区。");
  if (!t.body.trim())
    throw new Error("正文为空，暂时无法自动整理。");
  const [e, n] = await Promise.all([f(), Qt("dailyOrganizeSystem")]), r = fe(e), o = await Xt(r.providerType);
  if (!o)
    throw new Error("请先在设置页保存当前 provider 的 API Key。");
  const i = await ne(r, o).completeJson({
    messages: [
      { role: "system", content: n },
      { role: "user", content: ge(t) }
    ]
  });
  return pe(le(i), t.workspaceTags);
}
function E(t) {
  return [...t].sort((e, n) => e.localeCompare(n, "zh-Hans-CN"));
}
function j(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...nt]
  } : {
    version: 1,
    tags: E(k(t.tags))
  };
}
function W(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...q]
  } : {
    version: 1,
    items: E(k(t.items ?? q))
  };
}
function b(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...et]
  } : {
    version: 1,
    items: E(k(t.items))
  };
}
async function Lt(t) {
  try {
    const e = await St(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (r) => {
        const o = u.join(t, r.name);
        return r.isDirectory() ? Lt(o) : r.isFile() && r.name.toLowerCase().endsWith(".md") ? [o] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function de(t) {
  const e = oe(t), n = await Lt(e), r = /* @__PURE__ */ new Set();
  for (const o of n)
    try {
      const a = await H(o);
      for (const i of a.frontmatter.tags)
        r.add(i);
    } catch (a) {
      if (a.code === "ENOENT")
        continue;
      throw a;
    }
  return E([...r]);
}
async function _(t) {
  await w(K(t), { recursive: !0 });
}
async function kt(t) {
  const e = mt(t);
  try {
    const n = await h(e, "utf-8");
    return j(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = await de(t), o = j({
        tags: [...nt, ...r]
      });
      return await x(t, o), o;
    }
    throw n;
  }
}
async function x(t, e) {
  await _(t), await v(
    mt(t),
    JSON.stringify(j(e), null, 2),
    "utf-8"
  );
}
async function jt(t) {
  const e = pt(t);
  try {
    const n = await h(e, "utf-8");
    return W(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = W({
        items: q
      });
      return await R(t, r), r;
    }
    throw n;
  }
}
async function R(t, e) {
  await _(t), await v(
    pt(t),
    JSON.stringify(W(e), null, 2),
    "utf-8"
  );
}
async function Wt(t) {
  const e = gt(t);
  try {
    const n = await h(e, "utf-8");
    return b(JSON.parse(n));
  } catch (n) {
    if (n.code === "ENOENT") {
      const r = b({
        items: et
      });
      return await F(t, r), r;
    }
    throw n;
  }
}
async function F(t, e) {
  await _(t), await v(
    gt(t),
    JSON.stringify(b(e), null, 2),
    "utf-8"
  );
}
async function he(t, e) {
  const n = await kt(t), r = j({
    tags: [...n.tags, ...e]
  });
  await x(t, r);
}
async function ve(t, e) {
  const n = await jt(t), r = W({
    items: [...n.items, ...e]
  });
  await R(t, r);
}
async function Ie(t, e) {
  const n = await Wt(t), r = b({
    items: [...n.items, ...e]
  });
  await F(t, r);
}
async function Le(t) {
  return (await kt(t)).tags;
}
async function ke(t) {
  const e = j({
    tags: t.items
  });
  return await x(t.workspacePath, e), e.tags;
}
async function je(t) {
  return (await jt(t)).items;
}
async function We(t) {
  const e = W({
    items: t.items
  });
  return await R(t.workspacePath, e), e.items;
}
async function be(t) {
  return (await Wt(t)).items;
}
async function we(t) {
  const e = b({
    items: t.items
  });
  return await F(t.workspacePath, e), e.items;
}
function Oe(t) {
  re(t);
  const [e, n] = t.split("-"), r = Number(e), o = Number(n);
  return new Date(r, o, 0).getDate();
}
async function bt(t) {
  const e = C(t);
  try {
    const n = await H(e);
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
async function Ae(t) {
  const e = C(t);
  await w(u.dirname(e), { recursive: !0 });
  const n = dt();
  try {
    await v(e, ht(n, ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (r) {
    if (r.code !== "EEXIST")
      throw r;
  }
  return bt(t);
}
async function Se(t) {
  const e = C(t), n = await vt(e), r = (/* @__PURE__ */ new Date()).toISOString();
  return await It(
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
async function De(t) {
  const e = C(t), n = await vt(e), r = (/* @__PURE__ */ new Date()).toISOString(), o = ft(t.metadata);
  return await It(
    e,
    {
      ...n.frontmatter,
      ...o,
      updatedAt: r
    },
    n.body
  ), await he(t.workspacePath, o.tags), await ve(
    t.workspacePath,
    o.weather ? [o.weather] : []
  ), await Ie(
    t.workspacePath,
    o.location ? [o.location] : []
  ), {
    filePath: e,
    savedAt: r
  };
}
async function Te(t) {
  const { workspacePath: e, month: n } = t, r = Oe(n), [o, a] = n.split("-"), i = await Promise.all(
    Array.from({ length: r }, async (m, l) => {
      const A = String(l + 1).padStart(2, "0"), I = `${o}-${a}-${A}`, S = lt(e, I);
      try {
        const d = await H(S);
        return {
          date: I,
          hasEntry: !0,
          wordCount: ue(d.body)
        };
      } catch (d) {
        if (d.code === "ENOENT")
          return {
            date: I,
            hasEntry: !1,
            wordCount: 0
          };
        throw d;
      }
    })
  );
  return {
    month: n,
    days: i
  };
}
let p = null, T = !1, D = !1;
function Ce() {
  return p;
}
function Ke(t) {
  T = t;
}
function wt() {
  At.setApplicationMenu(null), T = !1, D = !1, p = new G({
    width: 1440,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: Ct,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: u.join(Kt, "preload.mjs")
    }
  }), J ? p.loadURL(J) : p.loadFile(u.join(V, "index.html")), p.on("close", async (t) => {
    if (D || !T || !p)
      return;
    t.preventDefault();
    const { response: e } = await P.showMessageBox(p, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    e === 0 && (D = !0, p.close());
  }), p.on("closed", () => {
    T = !1, D = !1, p = null;
  });
}
function He() {
  y.on("window-all-closed", () => {
    process.platform !== "darwin" && (y.quit(), p = null);
  }), y.on("activate", () => {
    G.getAllWindows().length === 0 && wt();
  });
}
function Ee() {
  s.handle(c.getBootstrap, async () => ({ config: await f() })), s.handle(c.getAiSettingsStatus, () => Zt()), s.handle(c.saveAiSettings, (t, e) => Gt(e)), s.handle(c.saveAiApiKey, (t, e) => Ut(e)), s.handle(
    c.setJournalHeatmapEnabled,
    (t, e) => Nt(e)
  ), s.handle(c.setDayStartHour, (t, e) => _t(e)), s.handle(
    c.setFrontmatterVisibility,
    (t, e) => xt(e)
  ), s.handle(c.setWindowDirtyState, (t, e) => {
    Ke(e.isDirty);
  }), s.handle(c.chooseWorkspace, async () => {
    const t = await f(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = Ce(), r = n ? await P.showOpenDialog(n, e) : await P.showOpenDialog(e);
    if (r.canceled || r.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const o = r.filePaths[0], a = Ft(o, t);
    return await O(a), {
      canceled: !1,
      workspacePath: o,
      config: a
    };
  }), s.handle(c.getWorkspaceTags, (t, e) => Le(e)), s.handle(c.setWorkspaceTags, (t, e) => ke(e)), s.handle(c.getWorkspaceWeatherOptions, (t, e) => je(e)), s.handle(
    c.setWorkspaceWeatherOptions,
    (t, e) => We(e)
  ), s.handle(c.getWorkspaceLocationOptions, (t, e) => be(e)), s.handle(
    c.setWorkspaceLocationOptions,
    (t, e) => we(e)
  ), s.handle(c.readJournalEntry, (t, e) => bt(e)), s.handle(c.createJournalEntry, (t, e) => Ae(e)), s.handle(c.saveJournalEntryBody, (t, e) => Se(e)), s.handle(
    c.saveJournalEntryMetadata,
    (t, e) => De(e)
  ), s.handle(c.getJournalMonthActivity, (t, e) => Te(e)), s.handle(c.generateDailyInsights, (t, e) => ye(e));
}
He();
y.whenReady().then(() => {
  Ee(), wt();
});
