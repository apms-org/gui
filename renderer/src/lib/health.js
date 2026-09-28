import U from "./util.js";
import { titleOf, getType, passwordKey } from "./types.js";

const DAY = 86400000;

export function trustOf(it, now) {
  const t = now || Date.now();
  let score = 100;
  const reasons = [];
  if (it.exposed) { score -= 45; reasons.push({ text: "Marked as exposed", delta: -45 }); }
  const since = it.rotated || it.created;
  const age = since ? (t - since) / DAY : 0;
  if (age > 365) { score -= 35; reasons.push({ text: "Not rotated in over a year", delta: -35 }); }
  else if (age > 180) { score -= 20; reasons.push({ text: "Not rotated in 6 months", delta: -20 }); }
  else if (age > 90) { score -= 10; reasons.push({ text: "Not rotated in 90 days", delta: -10 }); }
  if (it.uses > 200) { score -= 20; reasons.push({ text: "Accessed " + it.uses + " times", delta: -20 }); }
  else if (it.uses > 75) { score -= 10; reasons.push({ text: "Accessed " + it.uses + " times", delta: -10 }); }
  if (["critical", "root", "admin"].includes(it.privilege)) { score -= 15; reasons.push({ text: "Privilege: " + it.privilege, delta: -15 }); }
  else if (it.privilege === "elevated") { score -= 8; reasons.push({ text: "Privilege: elevated", delta: -8 }); }
  score = Math.max(0, score);
  const level = score >= 80 ? "low" : score >= 55 ? "medium" : score >= 35 ? "high" : "critical";
  return { score, level, reasons, ageDays: Math.floor(age) };
}

export const LEVEL_TONE = { low: "success", medium: "accent", high: "warning", critical: "danger" };
export const LEVEL_LABEL = { low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical" };

export function analyze(disk, now) {
  const t = now || Date.now();
  const items = disk.items;
  const pwItems = items.filter((i) => passwordKey(i.type) && i.f[passwordKey(i.type)]);
  const weak = pwItems.filter((i) => String(i.f.password).length < 8);
  const lowScore = pwItems.filter((i) => U.score(U.entropy(i.f.password)) <= 1 && String(i.f.password).length >= 8);
  const byPw = {};
  pwItems.forEach((i) => { const k = i.f.password; (byPw[k] = byPw[k] || []).push(i); });
  const reused = Object.values(byPw).filter((g) => g.length > 1);
  const reusedIds = new Set(reused.flat().map((i) => i.id));
  const trust = items.map((i) => ({ item: i, ...trustOf(i, t) }));
  const high = trust.filter((x) => x.score < 55);
  const critical = trust.filter((x) => x.score < 35);
  const old = trust.filter((x) => passwordKey(x.item.type) && (x.item.rotated || x.item.created) && x.ageDays > 180);
  const exposed = items.filter((i) => i.exposed);
  const expiring = items.filter((i) => {
    const d = i.f.expiry || i.f.expiration;
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const ms = new Date(d).getTime() - t;
    return ms < 30 * DAY;
  });

  const lines = [];
  let score = 100;
  const p = disk.meta.profile === "custom" ? "custom" : disk.meta.profile;
  if (p === "hardened" || p === "paranoid") lines.push({ text: "Profile: " + p, delta: 0, tone: "success", note: "Memory-hard key derivation" });
  else if (p === "legacy") { score -= 20; lines.push({ text: "Legacy profile", delta: -20, tone: "danger" }); }
  else if (p === "custom") lines.push({ text: "Profile: custom", delta: 0, tone: "neutral", note: "Your own parameters" });
  else lines.push({ text: "Profile: standard", delta: 0, tone: "neutral", note: "OK" });
  if (disk.meta.alerts) { score += 10; lines.push({ text: "Security alerts on", delta: 10, tone: "success" }); }
  else { score -= 10; lines.push({ text: "Security alerts off", delta: -10, tone: "warning" }); }
  if (weak.length) { score -= 5 * weak.length; lines.push({ text: "Short passwords: " + weak.length, delta: -5 * weak.length, tone: "danger" }); }
  if (high.length) { score -= 2 * high.length; lines.push({ text: "High-risk secrets: " + high.length, delta: -2 * high.length, tone: "warning" }); }
  if (critical.length) { score -= 3 * critical.length; lines.push({ text: "Critical secrets: " + critical.length, delta: -3 * critical.length, tone: "danger" }); }
  const app = lowScore.length * 3 + reusedIds.size * 2 + old.length * 2 + exposed.length * 10 + expiring.length;
  if (app) { score -= app; lines.push({ text: "App checks: " + [lowScore.length && lowScore.length + " easy to guess", reusedIds.size && reusedIds.size + " reused", old.length && old.length + " old", exposed.length && exposed.length + " exposed", expiring.length && expiring.length + " expiring"].filter(Boolean).join(", "), delta: -app, tone: "warning" }); }
  score = U.clamp(score, 0, 100);

  const issues = [];
  weak.forEach((i) => issues.push({ id: "weak-" + i.id, kind: "weak", item: i, title: "Short password", body: "Only " + String(i.f.password).length + " characters. APM counts anything under 8 as weak.", tone: "danger" }));
  lowScore.forEach((i) => issues.push({ id: "guess-" + i.id, kind: "weak", item: i, title: "Easy to guess", body: "About " + U.entropy(i.f.password) + " bits. Cracked in " + U.crackTime(U.entropy(i.f.password)) + " offline.", tone: "warning" }));
  reused.forEach((g) => g.forEach((i) => issues.push({ id: "reuse-" + i.id, kind: "reused", item: i, title: "Reused password", body: "Also used by " + g.filter((x) => x !== i).map(titleOf).join(", ") + ".", tone: "warning" })));
  old.forEach((x) => issues.push({ id: "old-" + x.item.id, kind: "old", item: x.item, title: "Not rotated in " + Math.floor(x.ageDays / 30) + " months", body: "Last changed " + U.date(x.item.rotated || x.item.created) + ".", tone: "warning" }));
  exposed.forEach((i) => issues.push({ id: "exp-" + i.id, kind: "exposed", item: i, title: "Marked as exposed", body: "Rotate this secret and clear the flag.", tone: "danger" }));
  expiring.forEach((i) => { const d = i.f.expiry || i.f.expiration; const days = Math.round((new Date(d).getTime() - t) / DAY); issues.push({ id: "expiry-" + i.id, kind: "expiring", item: i, title: days < 0 ? "Expired " + Math.abs(days) + " days ago" : "Expires in " + days + " days", body: getType(i.type).label + " expires on " + d + ".", tone: days < 0 ? "danger" : "warning" }); });

  return { score, lines, weak, reused, reusedIds, trust, high, critical, old, exposed, expiring, issues };
}

export function cleanupScan(disk) {
  const out = [];
  const spaces = new Set(disk.spaces.map((s) => s.name));
  disk.items.forEach((i) => {
    const t = getType(i.type);
    if (!i.f[t.titleKey] || !String(i.f[t.titleKey]).trim()) out.push({ id: "name-" + i.id, fix: true, title: "Item with no name", detail: t.label + " created " + U.date(i.created), apply: (d) => { const x = d.items.find((y) => y.id === i.id); if (x) x.f[t.titleKey] = "Untitled " + t.label.toLowerCase(); } });
    if (i.type === "totp" && !i.f.secret) out.push({ id: "totp-" + i.id, fix: true, title: "Authenticator with no setup key", detail: titleOf(i), apply: (d) => { d.items = d.items.filter((y) => y.id !== i.id); } });
    if (i.space && !spaces.has(i.space)) out.push({ id: "space-" + i.id, fix: true, title: "Item in a missing space", detail: titleOf(i) + " points to “" + i.space + "”", apply: (d) => { const x = d.items.find((y) => y.id === i.id); if (x) x.space = ""; } });
    if (i.type === "password" && !i.f.username && !i.f.password) out.push({ id: "empty-" + i.id, fix: false, title: "Login with no username or password", detail: titleOf(i) });
    if (i.type === "totp" && i.f.secret && i.f.secret.replace(/\s/g, "").length < 16) out.push({ id: "short-" + i.id, fix: false, title: "Short setup key", detail: titleOf(i) + " has " + i.f.secret.replace(/\s/g, "").length + " characters. Most services use 16 or 32." });
  });
  const totps = disk.items.filter((i) => i.type === "totp");
  const seen = {};
  totps.forEach((i) => { const k = (i.f.secret || "").replace(/\s/g, "").toUpperCase(); if (!k) return; if (seen[k]) out.push({ id: "dup-" + i.id, fix: false, title: "Duplicate authenticator", detail: titleOf(i) + " and " + titleOf(seen[k]) + " share a setup key" }); else seen[k] = i; });
  return out;
}
