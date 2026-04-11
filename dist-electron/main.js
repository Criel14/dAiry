import { app as g, BrowserWindow as z, Menu as ft, dialog as T, ipcMain as s } from "electron";
import { readFile as A, mkdir as m, writeFile as h, stat as $, readdir as yt } from "node:fs/promises";
import { fileURLToPath as pt } from "node:url";
import o from "node:path";
const H = o.dirname(pt(import.meta.url));
process.env.APP_ROOT = o.join(H, "..");
const gt = process.platform === "win32" ? "app.ico" : "app.png", mt = o.join(process.env.APP_ROOT, "build", "icons", gt), i = {
  getBootstrap: "app:get-bootstrap",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
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
    frontmatterVisibility: {
      weather: !0,
      location: !0,
      summary: !0,
      tags: !0
    }
  }
}, ht = {
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
], B = ["学校", "公司", "家"], U = ["上班", "加班", "原神", "杀戮尖塔"], C = process.env.VITE_DEV_SERVER_URL, Kt = o.join(process.env.APP_ROOT, "dist-electron"), q = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = C ? o.join(process.env.APP_ROOT, "public") : q;
let l, L = !1, k = !1;
function G() {
  return o.join(g.getPath("userData"), "config.json");
}
function wt(t) {
  var u, d, f, b, y;
  if (!t || typeof t != "object")
    return Y;
  const e = t, r = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((S) => typeof S == "string") : [], n = ((u = e.ui) == null ? void 0 : u.theme) === "light" || ((d = e.ui) == null ? void 0 : d.theme) === "dark" || ((f = e.ui) == null ? void 0 : f.theme) === "system" ? e.ui.theme : "system", a = ((b = e.ui) == null ? void 0 : b.journalHeatmapEnabled) === !0, c = Z((y = e.ui) == null ? void 0 : y.frontmatterVisibility);
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: r,
    ui: {
      theme: n,
      journalHeatmapEnabled: a,
      frontmatterVisibility: c
    }
  };
}
function Z(t) {
  return {
    weather: (t == null ? void 0 : t.weather) !== !1,
    location: (t == null ? void 0 : t.location) !== !1,
    summary: (t == null ? void 0 : t.summary) !== !1,
    tags: (t == null ? void 0 : t.tags) !== !1
  };
}
async function N() {
  try {
    const t = await A(G(), "utf-8"), e = wt(JSON.parse(t));
    return Wt(e);
  } catch (t) {
    if (t.code === "ENOENT")
      return Y;
    throw t;
  }
}
async function I(t) {
  await m(g.getPath("userData"), { recursive: !0 }), await h(G(), JSON.stringify(t, null, 2), "utf-8");
}
async function R(t) {
  try {
    return (await $(t)).isDirectory();
  } catch (e) {
    if (e.code === "ENOENT")
      return !1;
    throw e;
  }
}
async function Wt(t) {
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
async function Ot(t) {
  const e = await N(), r = {
    ...e,
    ui: {
      ...e.ui,
      journalHeatmapEnabled: t.enabled
    }
  };
  return await I(r), r;
}
async function Et(t) {
  const e = await N(), r = {
    ...e,
    ui: {
      ...e.ui,
      frontmatterVisibility: Z(t.visibility)
    }
  };
  return await I(r), r;
}
function At(t, e) {
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
function bt(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function vt(t) {
  if (!/^\d{4}-\d{2}$/.test(t))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function K(t, e) {
  bt(e);
  const [r, n] = e.split("-");
  return o.join(t, "journal", r, n, `${e}.md`);
}
function D({ workspacePath: t, date: e }) {
  return K(t, e);
}
function w(t) {
  return o.join(t, ".dairy");
}
function X(t) {
  return o.join(w(t), "tags.json");
}
function Q(t) {
  return o.join(w(t), "weather.json");
}
function V(t) {
  return o.join(w(t), "locations.json");
}
function _(t) {
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
function tt(t) {
  return {
    weather: typeof (t == null ? void 0 : t.weather) == "string" ? t.weather.trim() : "",
    location: typeof (t == null ? void 0 : t.location) == "string" ? t.location.trim() : "",
    summary: typeof (t == null ? void 0 : t.summary) == "string" ? t.summary.trim() : "",
    tags: _(t == null ? void 0 : t.tags)
  };
}
function et(t, e) {
  const r = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...tt(t),
    createdAt: typeof (t == null ? void 0 : t.createdAt) == "string" && t.createdAt.trim() ? t.createdAt : (e == null ? void 0 : e.createdAt) ?? r,
    updatedAt: typeof (t == null ? void 0 : t.updatedAt) == "string" && t.updatedAt.trim() ? t.updatedAt : (e == null ? void 0 : e.updatedAt) ?? (e == null ? void 0 : e.createdAt) ?? r
  };
}
function rt() {
  const t = (/* @__PURE__ */ new Date()).toISOString();
  return et(
    {
      ...ht,
      createdAt: t,
      updatedAt: t
    },
    {
      createdAt: t,
      updatedAt: t
    }
  );
}
function W(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    tags: [...U]
  } : {
    version: 1,
    tags: _(t.tags).sort((r, n) => r.localeCompare(n, "zh-Hans-CN"))
  };
}
function O(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...j]
  } : {
    version: 1,
    items: _(t.items ?? j).sort(
      (r, n) => r.localeCompare(n, "zh-Hans-CN")
    )
  };
}
function E(t) {
  return !t || typeof t != "object" ? {
    version: 1,
    items: [...B]
  } : {
    version: 1,
    items: _(t.items).sort(
      (r, n) => r.localeCompare(n, "zh-Hans-CN")
    )
  };
}
function kt(t) {
  const e = t.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  return e ? {
    frontmatterText: e[1],
    body: t.slice(e[0].length)
  } : {
    frontmatterText: null,
    body: t
  };
}
function J(t) {
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
function Lt(t) {
  const e = t.trim();
  if (e === "[]")
    return [];
  if (!e.startsWith("[") || !e.endsWith("]"))
    return [];
  const r = e.slice(1, -1).trim();
  return r ? r.split(",").map((n) => J(n)) : [];
}
function Nt(t) {
  const e = {};
  let r = null;
  for (const n of t.split(/\r?\n/)) {
    if (!n.trim())
      continue;
    const a = n.match(/^\s*-\s*(.*)$/);
    if (a && r === "tags") {
      const f = e.tags ?? [];
      e.tags = [...f, J(a[1])];
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
      e.tags = Lt(d);
      continue;
    }
    (u === "createdAt" || u === "updatedAt" || u === "weather" || u === "location" || u === "summary") && (e[u] = J(d));
  }
  return e;
}
function p(t) {
  return JSON.stringify(t);
}
function Dt(t) {
  const e = [
    "---",
    `createdAt: ${p(t.createdAt)}`,
    `updatedAt: ${p(t.updatedAt)}`,
    `weather: ${p(t.weather)}`,
    `location: ${p(t.location)}`,
    `summary: ${p(t.summary)}`
  ];
  if (t.tags.length === 0)
    e.push("tags: []");
  else {
    e.push("tags:");
    for (const r of t.tags)
      e.push(`  - ${p(r)}`);
  }
  return e.push("---"), e.join(`
`);
}
function nt(t, e) {
  const r = e.replace(/\r\n/g, `
`);
  return `${Dt(t)}
${r}`;
}
async function P(t) {
  const [e, r] = await Promise.all([A(t, "utf-8"), $(t)]), { frontmatterText: n, body: a } = kt(e), c = n ? Nt(n) : null;
  return {
    frontmatter: et(c, {
      createdAt: r.birthtime.toISOString(),
      updatedAt: r.mtime.toISOString()
    }),
    body: a
  };
}
async function at(t) {
  try {
    return await P(t);
  } catch (e) {
    if (e.code === "ENOENT")
      return {
        frontmatter: rt(),
        body: ""
      };
    throw e;
  }
}
async function ot(t, e, r) {
  await m(o.dirname(t), { recursive: !0 }), await h(t, nt(e, r), "utf-8");
}
function _t(t) {
  const e = t.trim();
  return e ? e.replace(/\s+/g, "").length : 0;
}
function Pt(t) {
  vt(t);
  const [e, r] = t.split("-"), n = Number(e), a = Number(r);
  return new Date(n, a, 0).getDate();
}
async function st(t) {
  const e = D(t);
  try {
    const r = await P(e);
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
async function St(t) {
  const e = D(t);
  await m(o.dirname(e), { recursive: !0 });
  try {
    await h(e, nt(rt(), ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (r) {
    if (r.code !== "EEXIST")
      throw r;
  }
  return st(t);
}
async function Tt(t) {
  const e = D(t), r = await at(e), n = (/* @__PURE__ */ new Date()).toISOString();
  return await ot(
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
async function jt(t) {
  const e = D(t), r = await at(e), n = (/* @__PURE__ */ new Date()).toISOString(), a = tt(t.metadata);
  return await ot(
    e,
    {
      ...r.frontmatter,
      ...a,
      updatedAt: n
    },
    r.body
  ), await It(t.workspacePath, a.tags), await xt(
    t.workspacePath,
    a.weather ? [a.weather] : []
  ), await $t(
    t.workspacePath,
    a.location ? [a.location] : []
  ), {
    filePath: e,
    savedAt: n
  };
}
async function Ct(t) {
  const { workspacePath: e, month: r } = t, n = Pt(r), [a, c] = r.split("-"), u = await Promise.all(
    Array.from({ length: n }, async (d, f) => {
      const b = String(f + 1).padStart(2, "0"), y = `${a}-${c}-${b}`, S = K(e, y);
      try {
        const v = await P(S);
        return {
          date: y,
          hasEntry: !0,
          wordCount: _t(v.body)
        };
      } catch (v) {
        if (v.code === "ENOENT")
          return {
            date: y,
            hasEntry: !1,
            wordCount: 0
          };
        throw v;
      }
    })
  );
  return {
    month: r,
    days: u
  };
}
async function it(t) {
  try {
    const e = await yt(t, { withFileTypes: !0 });
    return (await Promise.all(
      e.map(async (n) => {
        const a = o.join(t, n.name);
        return n.isDirectory() ? it(a) : n.isFile() && n.name.toLowerCase().endsWith(".md") ? [a] : [];
      })
    )).flat();
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function Jt(t) {
  const e = o.join(t, "journal"), r = await it(e), n = /* @__PURE__ */ new Set();
  for (const a of r)
    try {
      const c = await P(a);
      for (const u of c.frontmatter.tags)
        n.add(u);
    } catch (c) {
      if (c.code === "ENOENT")
        continue;
      throw c;
    }
  return [...n].sort((a, c) => a.localeCompare(c, "zh-Hans-CN"));
}
async function ct(t) {
  const e = X(t);
  try {
    const r = await A(e, "utf-8");
    return W(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = await Jt(t), a = W({
        tags: [...U, ...n]
      });
      return await F(t, a), a;
    }
    throw r;
  }
}
async function F(t, e) {
  const r = w(t);
  await m(r, { recursive: !0 }), await h(
    X(t),
    JSON.stringify(W(e), null, 2),
    "utf-8"
  );
}
async function It(t, e) {
  const r = await ct(t), n = W({
    tags: [...r.tags, ...e]
  });
  await F(t, n);
}
async function Ft(t) {
  return (await ct(t)).tags;
}
async function Mt(t) {
  const e = W({
    tags: t.items
  });
  return await F(t.workspacePath, e), e.tags;
}
async function ut(t) {
  const e = Q(t);
  try {
    const r = await A(e, "utf-8");
    return O(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = O({
        items: j
      });
      return await M(t, n), n;
    }
    throw r;
  }
}
async function M(t, e) {
  const r = w(t);
  await m(r, { recursive: !0 }), await h(
    Q(t),
    JSON.stringify(O(e), null, 2),
    "utf-8"
  );
}
async function xt(t, e) {
  const r = await ut(t), n = O({
    items: [...r.items, ...e]
  });
  await M(t, n);
}
async function Rt(t) {
  return (await ut(t)).items;
}
async function zt(t) {
  const e = O({
    items: t.items
  });
  return await M(t.workspacePath, e), e.items;
}
async function lt(t) {
  const e = V(t);
  try {
    const r = await A(e, "utf-8");
    return E(JSON.parse(r));
  } catch (r) {
    if (r.code === "ENOENT") {
      const n = E({
        items: B
      });
      return await x(t, n), n;
    }
    throw r;
  }
}
async function x(t, e) {
  const r = w(t);
  await m(r, { recursive: !0 }), await h(
    V(t),
    JSON.stringify(E(e), null, 2),
    "utf-8"
  );
}
async function $t(t, e) {
  const r = await lt(t), n = E({
    items: [...r.items, ...e]
  });
  await x(t, n);
}
async function Ht(t) {
  return (await lt(t)).items;
}
async function Yt(t) {
  const e = E({
    items: t.items
  });
  return await x(t.workspacePath, e), e.items;
}
function Bt() {
  s.handle(i.getBootstrap, async () => ({ config: await N() })), s.handle(
    i.setJournalHeatmapEnabled,
    (t, e) => Ot(e)
  ), s.handle(
    i.setFrontmatterVisibility,
    (t, e) => Et(e)
  ), s.handle(i.setWindowDirtyState, (t, e) => {
    L = e.isDirty;
  }), s.handle(i.chooseWorkspace, async () => {
    const t = await N(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, r = l ? await T.showOpenDialog(l, e) : await T.showOpenDialog(e);
    if (r.canceled || r.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const n = r.filePaths[0], a = At(n, t);
    return await I(a), {
      canceled: !1,
      workspacePath: n,
      config: a
    };
  }), s.handle(i.getWorkspaceTags, (t, e) => Ft(e)), s.handle(i.setWorkspaceTags, (t, e) => Mt(e)), s.handle(i.getWorkspaceWeatherOptions, (t, e) => Rt(e)), s.handle(
    i.setWorkspaceWeatherOptions,
    (t, e) => zt(e)
  ), s.handle(i.getWorkspaceLocationOptions, (t, e) => Ht(e)), s.handle(
    i.setWorkspaceLocationOptions,
    (t, e) => Yt(e)
  ), s.handle(i.readJournalEntry, (t, e) => st(e)), s.handle(i.createJournalEntry, (t, e) => St(e)), s.handle(i.saveJournalEntryBody, (t, e) => Tt(e)), s.handle(
    i.saveJournalEntryMetadata,
    (t, e) => jt(e)
  ), s.handle(i.getJournalMonthActivity, (t, e) => Ct(e));
}
function dt() {
  ft.setApplicationMenu(null), L = !1, k = !1, l = new z({
    width: 1440,
    height: 1e3,
    minWidth: 1080,
    minHeight: 720,
    icon: mt,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: o.join(H, "preload.mjs")
    }
  }), C ? l.loadURL(C) : l.loadFile(o.join(q, "index.html")), l.on("close", async (t) => {
    if (k || !L || !l)
      return;
    t.preventDefault();
    const { response: e } = await T.showMessageBox(l, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: !0
    });
    e === 0 && (k = !0, l.close());
  }), l.on("closed", () => {
    L = !1, k = !1, l = null;
  });
}
g.on("window-all-closed", () => {
  process.platform !== "darwin" && (g.quit(), l = null);
});
g.on("activate", () => {
  z.getAllWindows().length === 0 && dt();
});
g.whenReady().then(() => {
  Bt(), dt();
});
export {
  Kt as MAIN_DIST,
  q as RENDERER_DIST,
  C as VITE_DEV_SERVER_URL
};
