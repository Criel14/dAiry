import { app as m, BrowserWindow as H, Menu as pt, dialog as C, ipcMain as s } from "electron";
import { readFile as v, mkdir as h, writeFile as w, stat as z, readdir as gt } from "node:fs/promises";
import { fileURLToPath as mt } from "node:url";
import o from "node:path";
const $ = o.dirname(mt(import.meta.url));
process.env.APP_ROOT = o.join($, "..");
const ht = process.platform === "win32" ? "app.ico" : "app.png", wt = o.join(process.env.APP_ROOT, "build", "icons", ht), i = {
  getBootstrap: "app:get-bootstrap",
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
  getJournalMonthActivity: "journal:get-month-activity"
}, Y = {
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
  }
}, Wt = {
  weather: "",
  location: "",
  summary: "",
  tags: []
}, j = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
], B = ["学校", "公司", "家"], U = ["上班", "加班", "原神", "杀戮尖塔"], J = process.env.VITE_DEV_SERVER_URL, Vt = o.join(process.env.APP_ROOT, "dist-electron"), q = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = J ? o.join(process.env.APP_ROOT, "public") : q;
let l, D = !1, S = !1;
function G() {
  return o.join(m.getPath("userData"), "config.json");
}
function Ot(t) {
  var d, y, k, p, L, f;
  if (!t || typeof t != "object")
    return Y;
  const e = t, r = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((yt) => typeof yt == "string") : [], n = ((d = e.ui) == null ? void 0 : d.theme) === "light" || ((y = e.ui) == null ? void 0 : y.theme) === "dark" || ((k = e.ui) == null ? void 0 : k.theme) === "system" ? e.ui.theme : "system", a = ((p = e.ui) == null ? void 0 : p.journalHeatmapEnabled) === !0, c = Z((L = e.ui) == null ? void 0 : L.dayStartHour), u = K((f = e.ui) == null ? void 0 : f.frontmatterVisibility);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: r,
    ui: {
      theme: n,
      journalHeatmapEnabled: a,
      dayStartHour: c,
      frontmatterVisibility: u
    }
  };
}
function Z(t) {
  return typeof t != "number" || !Number.isInteger(t) || t < 0 || t > 6 ? 0 : t;
}
function K(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
async function O() {
  try {
    const t = await v(G(), "utf-8"), e = Ot(JSON.parse(t));
    return Et(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return Y;
    throw t;
  }
}
async function N(t) {
  await h(m.getPath("userData"), { recursive: !0 }), await w(G(), JSON.stringify(t, null, 2), "utf-8");
}
async function R(t) {
  try {
    return (await z(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function Et(t) {
  const e = [];
  for (const a of t.recentWorkspaces)
    await R(a) && e.push(a);
  const r = t.lastOpenedWorkspace && await R(t.lastOpenedWorkspace) ? t.lastOpenedWorkspace : null, n = r && !e.includes(r) ? [r, ...e] : e;
  return {
    ...t,
    lastOpenedWorkspace: r,
    recentWorkspaces: n
  };
}
async function bt(t) {
  const e = await O(), r = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await N(r), r;
}
async function At(t) {
  const e = await O(), r = {
    ...e,
    ui: {
      ...e.ui,
      dayStartHour: Z(t.hour)
    }
  };
  return await N(r), r;
}
async function vt(t) {
  const e = await O(), r = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: K(t.visibility)
    }
  };
  return await N(r), r;
}
function kt(t, e) {
  const r = [
    t,
    ...e.recentWorkspaces.filter((n) => n !== t)
  ];
  return {
    ...e,
    lastOpenedWorkspace: t,
    recentWorkspaces: r.slice(0, 8)
  };
}
function Lt(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function St(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function X(t, e) {
  Lt(e);
  const [r, n] = e.split("-");
  return o.join(t, "journal", r, n, `${e}.md`);
}
function _({ workspacePath: t, date: e }) {
  return X(t, e);
}
function W(t) {
  return o.join(t, ".dairy");
}
function Q(t) {
  return o.join(W(t), "tags.json");
}
function V(t) {
  return o.join(W(t), "weather.json");
}
function tt(t) {
  return o.join(W(t), "locations.json");
}
function P(t) {
  if (!Array.isArray(t))
    return [];
  const e = /* @__PURE__ */ new Set();
  for (const r of t) {
    if (typeof r != "string")
      continue;
    const n = r.trim();
    n && e.add(n);
  }
  return [...e];
}
function et(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: P(t == null ? void 0 : t.tags)
  };
}
function rt(t, e) {
  const r = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...et(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? r,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? r
  };
}
function nt() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return rt(
    {
      ...Wt,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function E(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...U]
  } : {
    version: 1,
    tags: P(t.tags).sort((r, n) => r.localeCompare(n, "zh-Hans-CN"))
  };
}
function b(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...j]
  } : {
    version: 1,
    items: P(t.items ?? j).sort(
      (r, n) => r.localeCompare(n, "zh-Hans-CN")
    )
  };
}
function A(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...B]
  } : {
    version: 1,
    items: P(t.items).sort(
      (r, n) => r.localeCompare(n, "zh-Hans-CN")
    )
  };
}
function Dt(t) {
  const e = t.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return e ? {
    frontmatterText: e[1],
    body: t.slice(e[0].length)
  } : {
    frontmatterText: null,
    body: t
  };
}
function I(t) {
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
function Nt(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const r = e.slice(1, -1).trim();
  return r ? r.split(",").map((n) => I(n)) : [];
}
function _t(t) {
  const e = {};
  let r = null;
  for (const n of t.split(/\r?\n/)) {
    if (!n.trim())
      continue;
    const a = n.match(/^\s*-\s*(.*)$/);
    if (a && r === "tags") {
      const y = e.tags ?? [];
      e.tags = [...y, I(a[1])];
      continue;
    }
    const c = n.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!c) {
      r = null;
      continue;
    }
    const [, u, d = ""] = c;
    if (r = null, u === "tags") {
      if (!d.trim()) {
        e.tags = [], r = "tags";
        continue;
      }
      e.tags = Nt(d);
      continue;
    }
    (u === "createdAt" || u === "updatedAt" || u === "weather" || u === "location" || u === "summary") && (e[u] = I(d));
  }
  return e;
}
function g(t) {
  return JSON.stringify(t);
}
function Pt(t) {
  const e = [
    "---",
    `createdAt: ${g(t.createdAt)}`,
    `updatedAt: ${g(t.updatedAt)}`,
    `weather: ${g(t.weather)}`,
    `location: ${g(t.location)}`,
    `summary: ${g(t.summary)}`
  ];
  if (t.tags.length === 0)
    e.push("tags: []");
  else {
    e.push("tags:");
    for (const r of t.tags)
      e.push(`  - ${g(r)}`);
  }
  return e.push("---"), e.join(`
`);
}
function at(t, e) {
  const r = e.replace(/\r\n/g, `
`);
  return `${Pt(t)}
${r}`;
}
async function T(t) {
  const [e, r] = await Promise.all([v(t, "utf-8"), z(t)]), { frontmatterText: n, body: a } = Dt(e), c = n ? _t(n) : null;
  return {
    frontmatter: rt(c, {
      createdAt: r.birthtime.toISOString(),
      updatedAt: r.mtime.toISOString()
    }),
    body: a
  };
}
async function ot(t) {
  try {
    return await T(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: nt(),
        body: ""
      };
    throw e;
  }
}
async function st(t, e, r) {
  await h(o.dirname(t), { recursive: !0 }), await w(t, at(e, r), "utf-8");
}
function Tt(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function Ct(t) {
  St(t);
  const [e, r] = t.split("-"), n = Number(e), a = Number(r);
  return new Date(n, a, 0).getDate();
}
async function it(t) {
  const e = _(t);
  try {
    const r = await T(e);
    return {
      status: "ready",
      filePath: e,
      frontmatter: r.frontmatter,
      body: r.body
    };
  } catch (r) {
    if (r.code === "ENOENT")
      return {
        status: "missing",
        filePath: e,
        frontmatter: null,
        body: null
      };
    throw r;
  }
}
async function jt(t) {
  const e = _(t);
  await h(o.dirname(e), { recursive: !0 });
  try {
    await w(e, at(nt(), ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (r) {
    if (r.code !== "EEXIST")
      throw r;
  }
  return it(t);
}
async function Jt(t) {
  const e = _(t), r = await ot(e), n = (/* @__PURE__ */ new Date()).toISOString();
  return await st(
    e,
    {
      ...r.frontmatter,
      updatedAt: n
    },
    t.body
  ), {
    filePath: e,
    savedAt: n
  };
}
async function It(t) {
  const e = _(t), r = await ot(e), n = (/* @__PURE__ */ new Date()).toISOString(), a = et(t.metadata);
  return await st(
    e,
    {
      ...r.frontmatter,
      ...a,
      updatedAt: n
    },
    r.body
  ), await Mt(t.workspacePath, a.tags), await zt(
    t.workspacePath,
    a.weather ? [a.weather] : []
  ), await Bt(
    t.workspacePath,
    a.location ? [a.location] : []
  ), {
    filePath: e,
    savedAt: n
  };
}
async function xt(t) {
  const { workspacePath: e, month: r } = t, n = Ct(r), [a, c] = r.split("-"), u = await Promise.all(
    Array.from({ length: n }, async (d, y) => {
      const k = String(y + 1).padStart(2, "0"), p = `${a}-${c}-${k}`, L = X(e, p);
      try {
        const f = await T(L);
        return {
          date: p,
          hasEntry: !0,
          wordCount: Tt(f.body)
        };
      } catch (f) {
        if (f.code === "ENOENT")
          return {
            date: p,
            hasEntry: !1,
            wordCount: 0
          };
        throw f;
      }
    })
  );
  return {
    month: r,
    days: u
  };
}
async function ct(t) {
  try {
    const e = await gt(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (n) => {
        const a = o.join(t, n.name);
        return n.isDirectory() ? ct(a) : n.isFile() && n.name.toLowerCase().endsWith(".md") ? [a] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function Ft(t) {
  const e = o.join(t, "journal"), r = await ct(e), n = /* @__PURE__ */ new Set();
  for (const a of r)
    try {
      const c = await T(a);
      for (const u of c.frontmatter.tags)
        n.add(u);
    } catch (c) {
      if (c.code === "ENOENT")
        continue;
      throw c;
    }
  return [...n].sort((a, c) => a.localeCompare(c, "zh-Hans-CN"));
}
async function ut(t) {
  const e = Q(t);
  try {
    const r = await v(e, "utf-8");
    return E(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = await Ft(t), a = E({
        tags: [...U, ...n]
      });
      return await x(t, a), a;
    }
    throw r;
  }
}
async function x(t, e) {
  const r = W(t);
  await h(r, { recursive: !0 }), await w(
    Q(t),
    JSON.stringify(E(e), null, 2),
    "utf-8"
  );
}
async function Mt(t, e) {
  const r = await ut(t), n = E({
    tags: [...r.tags, ...e]
  });
  await x(t, n);
}
async function Rt(t) {
  return (await ut(t)).tags;
}
async function Ht(t) {
  const e = E({
    tags: t.items
  });
  return await x(t.workspacePath, e), e.tags;
}
async function lt(t) {
  const e = V(t);
  try {
    const r = await v(e, "utf-8");
    return b(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = b({
        items: j
      });
      return await F(t, n), n;
    }
    throw r;
  }
}
async function F(t, e) {
  const r = W(t);
  await h(r, { recursive: !0 }), await w(
    V(t),
    JSON.stringify(b(e), null, 2),
    "utf-8"
  );
}
async function zt(t, e) {
  const r = await lt(t), n = b({
    items: [...r.items, ...e]
  });
  await F(t, n);
}
async function $t(t) {
  return (await lt(t)).items;
}
async function Yt(t) {
  const e = b({
    items: t.items
  });
  return await F(t.workspacePath, e), e.items;
}
async function dt(t) {
  const e = tt(t);
  try {
    const r = await v(e, "utf-8");
    return A(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = A({
        items: B
      });
      return await M(t, n), n;
    }
    throw r;
  }
}
async function M(t, e) {
  const r = W(t);
  await h(r, { recursive: !0 }), await w(
    tt(t),
    JSON.stringify(A(e), null, 2),
    "utf-8"
  );
}
async function Bt(t, e) {
  const r = await dt(t), n = A({
    items: [...r.items, ...e]
  });
  await M(t, n);
}
async function Ut(t) {
  return (await dt(t)).items;
}
async function qt(t) {
  const e = A({
    items: t.items
  });
  return await M(t.workspacePath, e), e.items;
}
function Gt() {
  s.handle(i.getBootstrap, async () => ({ config: await O() })), s.handle(
    i.setJournalHeatmapEnabled,
    (t, e) => bt(e)
  ), s.handle(
    i.setDayStartHour,
    (t, e) => At(e)
  ), s.handle(
    i.setFrontmatterVisibility,
    (t, e) => vt(e)
  ), s.handle(i.setWindowDirtyState, (t, e) => {
    D = e.isDirty;
  }), s.handle(i.chooseWorkspace, async () => {
    const t = await O(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, r = l ? await C.showOpenDialog(l, e) : await C.showOpenDialog(e);
    if (r.canceled || r.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const n = r.filePaths[0], a = kt(n, t);
    return await N(a), {
      canceled: !1,
      workspacePath: n,
      config: a
    };
  }), s.handle(i.getWorkspaceTags, (t, e) => Rt(e)), s.handle(i.setWorkspaceTags, (t, e) => Ht(e)), s.handle(i.getWorkspaceWeatherOptions, (t, e) => $t(e)), s.handle(
    i.setWorkspaceWeatherOptions,
    (t, e) => Yt(e)
  ), s.handle(i.getWorkspaceLocationOptions, (t, e) => Ut(e)), s.handle(
    i.setWorkspaceLocationOptions,
    (t, e) => qt(e)
  ), s.handle(i.readJournalEntry, (t, e) => it(e)), s.handle(i.createJournalEntry, (t, e) => jt(e)), s.handle(i.saveJournalEntryBody, (t, e) => Jt(e)), s.handle(
    i.saveJournalEntryMetadata,
    (t, e) => It(e)
  ), s.handle(i.getJournalMonthActivity, (t, e) => xt(e));
}
function ft() {
  pt.setApplicationMenu(null), D = !1, S = !1, l = new H({
    width: 1440,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: wt,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: o.join($, "preload.mjs")
    }
  }), J ? l.loadURL(J) : l.loadFile(o.join(q, "index.html")), l.on("close", async (t) => {
    if (S || !D || !l)
      return;
    t.preventDefault();
    const { response: e } = await C.showMessageBox(l, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    e === 0 && (S = !0, l.close());
  }), l.on("closed", () => {
    D = !1, S = !1, l = null;
  });
}
m.on("window-all-closed", () => {
  process.platform !== "darwin" && (m.quit(), l = null);
});
m.on("activate", () => {
  H.getAllWindows().length === 0 && ft();
});
m.whenReady().then(() => {
  Gt(), ft();
});
export {
  Vt as MAIN_DIST,
  q as RENDERER_DIST,
  J as VITE_DEV_SERVER_URL
};
