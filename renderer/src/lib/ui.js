const listeners = new Set();
const HASH = (location.hash || "").slice(1).toLowerCase();

const initialRoute = () => {
  const m = HASH.match(/(vault|authenticator|watchtower|history|settings)(?:-([a-z]+))?/);
  if (!m) return { view: "vault", filter: "all", section: "general" };
  if (m[1] === "settings") return { view: "settings", filter: "all", section: m[2] || "general" };
  return { view: m[1], filter: "all", section: "general" };
};

const U = {
  route: initialRoute(),
  selected: null,
  multi: [],
  query: "",
  dialog: null,
  toast: null,
  cmd: false,
  editing: null,
  quick: null,
  v: 0
};
const emit = () => { U.v++; listeners.forEach((l) => l()); };

export const ui = {
  get: () => U,
  subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  go: (patch) => { U.route = Object.assign({}, U.route, patch); if (patch.view && patch.view !== "vault") { U.multi = []; } if (patch.filter !== undefined) { U.multi = []; U.editing = null; } emit(); },
  select: (id) => { U.selected = id; U.editing = null; emit(); },
  setMulti: (ids) => { U.multi = ids; emit(); },
  query: (q) => { U.query = q; emit(); },
  open: (name, props) => { U.dialog = { name, props: props || {}, key: Date.now() }; emit(); },
  close: () => { U.dialog = null; emit(); },
  toast: (t) => { U.toast = Object.assign({ key: Date.now() + Math.random() }, t); emit(); },
  clearToast: (key) => { if (!key || (U.toast && U.toast.key === key)) { U.toast = null; emit(); } },
  cmd: (open) => { U.cmd = open; emit(); },
  edit: (id) => { U.editing = id; emit(); },
  quick: (id) => { U.quick = id; emit(); },
  emit
};

export function useUi() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => ui.subscribe(force), []);
  return U;
}

export const HASHFLAGS = HASH;

export function openUrl(url) {
  if (!url) return;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "https://" + url;
  if (!/^https?:/i.test(href)) return;
  if (window.apm && window.apm.shell) window.apm.shell.openExternal(href); else window.open(href, "_blank", "noopener");
}

export async function saveFile(name, data, mime, okToast) {
  const api = window.apm;
  if (!api) return false;
  const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1];
  const path = await api.dialog.save({ title: "Save " + name, defaultPath: name, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined });
  if (!path) return false;
  const binary = typeof data === "string" && data.startsWith("data:");
  try {
    await api.files.write(path, binary ? data.slice(data.indexOf(",") + 1) : String(data), { encoding: binary ? "base64" : "utf8" });
  } catch (e) {
    ui.toast({ title: "Could not save " + name, description: e && e.message, tone: "danger" });
    return false;
  }
  const file = path.split(/[\\/]/).pop();
  ui.toast(Object.assign({ title: "Saved " + file, icon: "download" }, okToast || {}, { action: { label: "Show", onClick: () => api.shell.showItemInFolder(path) } }));
  return true;
}
