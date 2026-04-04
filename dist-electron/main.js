import { app as i, BrowserWindow as m, Menu as R, ipcMain as c, dialog as y } from "electron";
import { readFile as E, mkdir as p, writeFile as f } from "node:fs/promises";
import { fileURLToPath as j } from "node:url";
import r from "node:path";
const P = r.dirname(j(import.meta.url));
process.env.APP_ROOT = r.join(P, "..");
const T = process.platform === "win32" ? "app.ico" : "app.png", D = r.join(process.env.APP_ROOT, "build", "icons", T), l = {
  getBootstrap: "app:get-bootstrap",
  chooseWorkspace: "workspace:choose",
  readJournalEntry: "journal:read-entry",
  createJournalEntry: "journal:create-entry",
  saveJournalEntry: "journal:save-entry"
}, O = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system"
  }
}, u = process.env.VITE_DEV_SERVER_URL, x = r.join(process.env.APP_ROOT, "dist-electron"), _ = r.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = u ? r.join(process.env.APP_ROOT, "public") : _;
let a;
function v() {
  return r.join(i.getPath("userData"), "config.json");
}
function C(t) {
  var s, h, g;
  if (!t || typeof t != "object")
    return O;
  const e = t, n = Array.isArray(e.recentWorkspaces) ? e.recentWorkspaces.filter((W) => typeof W == "string") : [], o = ((s = e.ui) == null ? void 0 : s.theme) === "light" || ((h = e.ui) == null ? void 0 : h.theme) === "dark" || ((g = e.ui) == null ? void 0 : g.theme) === "system" ? e.ui.theme : "system";
  return {
    lastOpenedWorkspace: typeof e.lastOpenedWorkspace == "string" ? e.lastOpenedWorkspace : null,
    recentWorkspaces: n,
    ui: {
      theme: o
    }
  };
}
async function w() {
  try {
    const t = await E(v(), "utf-8");
    return C(JSON.parse(t));
  } catch (t) {
    if (t.code === "ENOENT")
      return O;
    throw t;
  }
}
async function I(t) {
  await p(i.getPath("userData"), { recursive: !0 }), await f(v(), JSON.stringify(t, null, 2), "utf-8");
}
function N(t, e) {
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
function J(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
}
function d({ workspacePath: t, date: e }) {
  J(e);
  const [n, o] = e.split("-");
  return r.join(t, "journal", n, o, `${e}.md`);
}
async function A(t) {
  const e = d(t);
  try {
    const n = await E(e, "utf-8");
    return {
      status: "ready",
      filePath: e,
      content: n
    };
  } catch (n) {
    if (n.code === "ENOENT")
      return {
        status: "missing",
        filePath: e,
        content: null
      };
    throw n;
  }
}
async function S(t) {
  const e = d(t);
  await p(r.dirname(e), { recursive: !0 });
  try {
    await f(e, "", { encoding: "utf-8", flag: "wx" });
  } catch (n) {
    if (n.code !== "EEXIST")
      throw n;
  }
  return A(t);
}
async function b(t) {
  const e = d(t);
  return await p(r.dirname(e), { recursive: !0 }), await f(e, t.content, "utf-8"), {
    filePath: e,
    savedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function L() {
  c.handle(l.getBootstrap, async () => ({ config: await w() })), c.handle(l.chooseWorkspace, async () => {
    const t = await w(), e = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    }, n = a ? await y.showOpenDialog(a, e) : await y.showOpenDialog(e);
    if (n.canceled || n.filePaths.length === 0)
      return {
        canceled: !0,
        workspacePath: null,
        config: t
      };
    const o = n.filePaths[0], s = N(o, t);
    return await I(s), {
      canceled: !1,
      workspacePath: o,
      config: s
    };
  }), c.handle(l.readJournalEntry, (t, e) => A(e)), c.handle(l.createJournalEntry, (t, e) => S(e)), c.handle(
    l.saveJournalEntry,
    (t, e) => b(e)
  );
}
function k() {
  R.setApplicationMenu(null), a = new m({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    icon: D,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: r.join(P, "preload.mjs")
    }
  }), u ? a.loadURL(u) : a.loadFile(r.join(_, "index.html"));
}
i.on("window-all-closed", () => {
  process.platform !== "darwin" && (i.quit(), a = null);
});
i.on("activate", () => {
  m.getAllWindows().length === 0 && k();
});
i.whenReady().then(() => {
  L(), k();
});
export {
  x as MAIN_DIST,
  _ as RENDERER_DIST,
  u as VITE_DEV_SERVER_URL
};
