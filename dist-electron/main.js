import { app as l, BrowserWindow as A, Menu as T, ipcMain as i, dialog as O } from "electron";
import { readFile as E, mkdir as P, writeFile as v } from "node:fs/promises";
import { fileURLToPath as I } from "node:url";
import o from "node:path";
const j = o.dirname(I(import.meta.url));
process.env.APP_ROOT = o.join(j, "..");
const M = process.platform === "win32" ? "app.ico" : "app.png", S = o.join(process.env.APP_ROOT, "build", "icons", M), s = {
  getBootstrap: "app:get-bootstrap",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
  chooseWorkspace: "workspace:choose",
  readJournalEntry: "journal:read-entry",
  createJournalEntry: "journal:create-entry",
  saveJournalEntry: "journal:save-entry",
  getJournalMonthActivity: "journal:get-month-activity"
}, b = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    journalHeatmapEnabled: !1
  }
}, g = process.env.VITE_DEV_SERVER_URL, tt = o.join(process.env.APP_ROOT, "dist-electron"), k = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = g ? o.join(process.env.APP_ROOT, "public") : k;
let c;
function J() {
  return o.join(l.getPath("userData"), "config.json");
}
function H(e) {
  var u, p, h, d;
  if (!e || typeof e != "object")
    return b;
  const t = e, n = Array.isArray(t.recentWorkspaces) ? t.recentWorkspaces.filter((y) => typeof y == "string") : [], r = ((u = t.ui) == null ? void 0 : u.theme) === "light" || ((p = t.ui) == null ? void 0 : p.theme) === "dark" || ((h = t.ui) == null ? void 0 : h.theme) === "system" ? t.ui.theme : "system", a = ((d = t.ui) == null ? void 0 : d.journalHeatmapEnabled) === !0;
  return {
    lastOpenedWorkspace: typeof t.lastOpenedWorkspace == "string" ? t.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: r,
      journalHeatmapEnabled: a
    }
  };
}
async function w() {
  try {
    const e = await E(J(), "utf-8");
    return H(JSON.parse(e));
  } catch (e) {
    if (e.code === "ENOENT")
      return b;
    throw e;
  }
}
async function W(e) {
  await P(l.getPath("userData"), { recursive: !0 }), await v(J(), JSON.stringify(e, null, 2), "utf-8");
}
async function V(e) {
  const t = await w(), n = {
    ...t,
    ui: {
      ...t.ui,
      journalHeatmapEnabled: e.enabled
    }
  };
  return await W(n), n;
}
function F(e, t) {
  const n = [
    e,
    ...t.recentWorkspaces.filter((r) => r !== e)
  ];
  return {
    ...t,
    lastOpenedWorkspace: e,
    recentWorkspaces: n.slice(0, 8)
  };
}
function L(e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function Y(e) {
  if (!/^\d{4}-\d{2}$/.test(e))
    throw new Error("月份格式无效，必须为 YYYY-MM。");
}
function C(e, t) {
  L(t);
  const [n, r] = t.split("-");
  return o.join(e, "journal", n, r, `${t}.md`);
}
function _({ workspacePath: e, date: t }) {
  return C(e, t);
}
function x(e) {
  return e.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}
function $(e) {
  const t = x(e).trim();
  return t ? t.replace(/\s+/g, "").length : 0;
}
function U(e) {
  Y(e);
  const [t, n] = e.split("-"), r = Number(t), a = Number(n);
  return new Date(r, a, 0).getDate();
}
async function D(e) {
  const t = _(e);
  try {
    const n = await E(t, "utf-8");
    return {
      status: "ready",
      filePath: t,
      content: n
    };
  } catch (n) {
    if (n.code === "ENOENT")
      return {
        status: "missing",
        filePath: t,
        content: null
      };
    throw n;
  }
}
async function B(e) {
  const t = _(e);
  await P(o.dirname(t), { recursive: !0 });
  try {
    await v(t, "", { encoding: "utf-8", flag: "wx" });
  } catch (n) {
    if (n.code !== "EEXIST")
      throw n;
  }
  return D(e);
}
async function q(e) {
  const t = _(e);
  return await P(o.dirname(t), { recursive: !0 }), await v(t, e.content, "utf-8"), {
    filePath: t,
    savedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function z(e) {
  const { workspacePath: t, month: n } = e, r = U(n), [a, u] = n.split("-"), p = await Promise.all(
    Array.from({ length: r }, async (h, d) => {
      const y = String(d + 1).padStart(2, "0"), m = `${a}-${u}-${y}`, R = C(t, m);
      try {
        const f = await E(R, "utf-8");
        return {
          date: m,
          hasEntry: !0,
          wordCount: $(f)
        };
      } catch (f) {
        if (f.code === "ENOENT")
          return {
            date: m,
            hasEntry: !1,
            wordCount: 0
          };
        throw f;
      }
    })
  );
  return {
    month: n,
    days: p
  };
}
function G() {
  i.handle(s.getBootstrap, async () => ({ config: await w() })), i.handle(
    s.setJournalHeatmapEnabled,
    (e, t) => V(t)
  ), i.handle(s.chooseWorkspace, async () => {
    const e = await w(), t = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = c ? await O.showOpenDialog(c, t) : await O.showOpenDialog(t);
    if (n.canceled || n.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: e
      };
    const r = n.filePaths[0], a = F(r, e);
    return await W(a), {
      canceled: !1,
      workspacePath: r,
      config: a
    };
  }), i.handle(s.readJournalEntry, (e, t) => D(t)), i.handle(s.createJournalEntry, (e, t) => B(t)), i.handle(
    s.saveJournalEntry,
    (e, t) => q(t)
  ), i.handle(s.getJournalMonthActivity, (e, t) => z(t));
}
function N() {
  T.setApplicationMenu(null), c = new A({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    icon: S,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: o.join(j, "preload.mjs")
    }
  }), g ? c.loadURL(g) : c.loadFile(o.join(k, "index.html"));
}
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), c = null);
});
l.on("activate", () => {
  A.getAllWindows().length === 0 && N();
});
l.whenReady().then(() => {
  G(), N();
});
export {
  tt as MAIN_DIST,
  k as RENDERER_DIST,
  g as VITE_DEV_SERVER_URL
};
