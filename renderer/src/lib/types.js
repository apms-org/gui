export const CATEGORIES = [
  { id: "personal", label: "Identity & personal" },
  { id: "dev", label: "Developer & infrastructure" },
  { id: "finance", label: "Finance & legal" },
  { id: "media", label: "Media & files" }
];

const f = (key, label, kind, extra) => Object.assign({ key, label, kind: kind || "text" }, extra || {});

export const TYPES = [
  { id: "password", label: "Login", plural: "Logins", icon: "globe", cat: "personal", titleKey: "account", primary: "password",
    blurb: "A username and password for a website or app.",
    fields: [f("account", "Name", "text", { required: true, placeholder: "GitHub" }), f("username", "Username", "text", { icon: "user", placeholder: "you@example.com" }), f("password", "Password", "password", { required: true, icon: "key-round" }), f("website", "Website", "url", { icon: "globe", placeholder: "github.com" }), f("urls", "Other websites", "list", { icon: "link-2", placeholder: "Add a URL" })],
    sub: (x) => x.username || x.website || "" },
  { id: "totp", label: "Authenticator", plural: "Authenticator", icon: "timer", cat: "personal", titleKey: "account", primary: "secret",
    blurb: "A 6-digit two-factor code that changes every 30 seconds.",
    fields: [f("account", "Name", "text", { required: true, placeholder: "GitHub" }), f("secret", "Setup key", "totp", { required: true, icon: "timer", placeholder: "JBSW Y3DP EHPK 3PXP" }), f("domain", "Website", "url", { icon: "globe", placeholder: "github.com", hint: "Links this code to a site for autofill." })],
    sub: () => "6 digits · 30s" },
  { id: "note", label: "Secure note", plural: "Secure notes", icon: "sticky-note", cat: "personal", titleKey: "name", primary: "content",
    blurb: "Private text: runbooks, answers, anything.",
    fields: [f("name", "Title", "text", { required: true, placeholder: "Homelab runbook" }), f("content", "Note", "note", { icon: "file-text" })],
    sub: (x) => (x.content || "").split("\n")[0].slice(0, 60) },
  { id: "wifi", label: "Wi-Fi network", plural: "Wi-Fi", icon: "wifi", cat: "personal", titleKey: "ssid", primary: "password",
    blurb: "A network name and its password.",
    fields: [f("ssid", "Network name", "text", { required: true, placeholder: "Home-5G" }), f("password", "Password", "password", { required: true, icon: "key-round" }), f("security_type", "Security", "select", { icon: "shield-check", options: ["WPA3 Personal", "WPA2 Personal", "WPA2 Enterprise", "WEP", "Open"] }), f("router_ip", "Router address", "text", { icon: "server", mono: true, placeholder: "192.168.1.1" })],
    sub: (x) => [x.ssid, x.security_type].filter(Boolean).join(" · ") },
  { id: "govid", label: "Government ID", plural: "Identities", icon: "id-card", cat: "personal", titleKey: "name", primary: "id_number",
    blurb: "Passport, driver's license, voter or national ID.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Passport" }), f("type", "Document", "select", { icon: "id-card", options: ["Passport", "Driver's License", "Voter ID", "National ID"] }), f("id_number", "ID number", "secret", { required: true, icon: "hash", mono: true }), f("expiry", "Expires", "date", { icon: "calendar" })],
    sub: (x) => [x.type, x.expiry ? "expires " + x.expiry.slice(0, 4) : ""].filter(Boolean).join(" · ") },
  { id: "medical", label: "Medical record", plural: "Medical", icon: "heart-pulse", cat: "personal", titleKey: "label", primary: "insurance_id",
    blurb: "Insurance, prescriptions and allergies.",
    fields: [f("label", "Name", "text", { required: true, placeholder: "Health insurance" }), f("insurance_id", "Insurance ID", "text", { icon: "hash", mono: true }), f("prescriptions", "Prescriptions", "multiline", { icon: "pill" }), f("allergies", "Allergies", "text", { icon: "circle-alert" })],
    sub: (x) => x.insurance_id || "" },
  { id: "travel", label: "Travel", plural: "Travel", icon: "plane", cat: "personal", titleKey: "label", primary: "booking_code",
    blurb: "Tickets, booking codes and loyalty numbers.",
    fields: [f("label", "Name", "text", { required: true, placeholder: "Flight to Tokyo" }), f("ticket_number", "Ticket number", "text", { icon: "ticket", mono: true }), f("booking_code", "Booking code", "secret", { icon: "hash", mono: true }), f("loyalty_program", "Loyalty program", "text", { icon: "award" })],
    sub: (x) => x.ticket_number || x.loyalty_program || "" },
  { id: "contact", label: "Contact", plural: "Contacts", icon: "contact", cat: "personal", titleKey: "name", primary: "phone",
    blurb: "A person, with an emergency flag.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Riya Shah" }), f("phone", "Phone", "phone", { icon: "phone", mono: true }), f("email", "Email", "email", { icon: "at-sign" }), f("address", "Address", "multiline", { icon: "map-pin" }), f("emergency", "Emergency contact", "bool", { icon: "life-buoy" })],
    sub: (x) => x.email || x.phone || "" },
  { id: "recovery", label: "Recovery codes", plural: "Recovery codes", icon: "life-buoy", cat: "personal", titleKey: "service", primary: "codes",
    blurb: "Backup codes for when you lose your second factor.",
    fields: [f("service", "Service", "text", { required: true, placeholder: "GitHub" }), f("codes", "Codes", "codes", { required: true, icon: "list" })],
    sub: (x) => { const c = x.codes || []; const used = (x.used || []).length; return c.length + " codes · " + (c.length - used) + " unused"; } },

  { id: "apikey", label: "API key", plural: "API keys", icon: "key-round", cat: "dev", titleKey: "name", primary: "key",
    blurb: "A key for a service's API.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Stripe live key" }), f("service", "Service", "text", { icon: "server", placeholder: "Stripe" }), f("key", "Key", "secret", { required: true, icon: "key-round", mono: true })],
    sub: (x) => x.service || "" },
  { id: "token", label: "Token", plural: "Tokens", icon: "ticket", cat: "dev", titleKey: "name", primary: "token",
    blurb: "A bearer token, PAT or session token.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "GitHub PAT" }), f("token", "Token", "secret", { required: true, icon: "key-round", mono: true }), f("type", "Kind", "text", { icon: "tag", placeholder: "Bearer, PAT" })],
    sub: (x) => x.type || "" },
  { id: "ssh_key", label: "SSH key", plural: "SSH keys", icon: "key-square", cat: "dev", titleKey: "name", primary: "private_key",
    blurb: "A private key for SSH and commit signing.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "homelab ed25519" }), f("private_key", "Private key", "secretBlock", { required: true, icon: "key-round" })],
    sub: (x) => { const k = x.private_key || ""; return /ed25519|AAAAC3/i.test(k) ? "ed25519" : /RSA/.test(k) ? "RSA" : "Private key"; } },
  { id: "ssh_config", label: "SSH host", plural: "SSH hosts", icon: "server", cat: "dev", titleKey: "alias", primary: "private_key",
    blurb: "A host entry: alias, address, user, port and key.",
    fields: [f("alias", "Alias", "text", { required: true, placeholder: "homelab", mono: true }), f("host", "Host", "text", { required: true, icon: "server", mono: true, placeholder: "10.0.0.12" }), f("user", "User", "text", { icon: "user", mono: true, placeholder: "root" }), f("port", "Port", "number", { icon: "hash", mono: true, placeholder: "22" }), f("key_path", "Key path", "text", { icon: "file-key", mono: true, placeholder: "~/.ssh/id_ed25519" }), f("private_key", "Private key", "secretBlock", { icon: "key-round" }), f("fingerprint", "Fingerprint", "text", { icon: "fingerprint", mono: true })],
    sub: (x) => [x.user, x.host].filter(Boolean).join("@") + (x.port && x.port !== "22" ? ":" + x.port : "") },
  { id: "cloud", label: "Cloud credentials", plural: "Cloud credentials", icon: "cloud", cat: "dev", titleKey: "label", primary: "secret_key",
    blurb: "Access keys for AWS, GCP, Azure and others.",
    fields: [f("label", "Name", "text", { required: true, placeholder: "AWS root account" }), f("access_key", "Access key", "secret", { icon: "key", mono: true }), f("secret_key", "Secret key", "secret", { icon: "key-round", mono: true }), f("region", "Region", "text", { icon: "map-pin", mono: true, placeholder: "ap-south-1" }), f("account_id", "Account ID", "text", { icon: "hash", mono: true }), f("role", "Role", "text", { icon: "user" }), f("expiration", "Expires", "date", { icon: "calendar" })],
    sub: (x) => x.region || x.account_id || "" },
  { id: "k8s", label: "Kubernetes", plural: "Kubernetes", icon: "ship-wheel", cat: "dev", titleKey: "name", primary: "cluster_url",
    blurb: "A cluster endpoint and namespace.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "prod-cluster" }), f("cluster_url", "Cluster URL", "text", { icon: "globe", mono: true, placeholder: "https://10.0.4.2:6443" }), f("namespace", "Namespace", "text", { icon: "layers", mono: true, placeholder: "default" }), f("expiration", "Expires", "date", { icon: "calendar" })],
    sub: (x) => [x.namespace, x.cluster_url].filter(Boolean).join(" · ") },
  { id: "docker", label: "Docker registry", plural: "Docker registries", icon: "container", cat: "dev", titleKey: "name", primary: "token",
    blurb: "Registry login for pulling and pushing images.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Docker Hub" }), f("registry_url", "Registry", "text", { icon: "globe", mono: true, placeholder: "registry-1.docker.io" }), f("username", "Username", "text", { icon: "user" }), f("token", "Token", "secret", { icon: "key-round", mono: true })],
    sub: (x) => x.username ? x.username + " · " + (x.registry_url || "") : x.registry_url || "" },
  { id: "cicd", label: "CI/CD secret", plural: "CI/CD secrets", icon: "workflow", cat: "dev", titleKey: "name", primary: "webhook",
    blurb: "Deploy webhooks and environment variables.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Deploy hook" }), f("webhook", "Webhook", "secret", { icon: "webhook", mono: true }), f("env_vars", "Environment variables", "env", { icon: "terminal", hint: "One per line, or comma separated: KEY=value" })],
    sub: (x) => { const n = String(x.env_vars || "").split(/[\n,]/).filter((s) => s.includes("=")).length; return n ? n + " variables" : "Webhook"; } },
  { id: "certificate", label: "Certificate", plural: "Certificates", icon: "file-key", cat: "dev", titleKey: "label", primary: "private_key",
    blurb: "A TLS certificate and its private key.",
    fields: [f("label", "Name", "text", { required: true, placeholder: "api.example.com" }), f("issuer", "Issuer", "text", { icon: "badge-check" }), f("expiry", "Expires", "date", { icon: "calendar" }), f("cert_data", "Certificate", "secretBlock", { icon: "file-text" }), f("private_key", "Private key", "secretBlock", { icon: "key-round" })],
    sub: (x) => [x.issuer, x.expiry ? "expires " + x.expiry : ""].filter(Boolean).join(" · ") },

  { id: "banking", label: "Card or account", plural: "Banking", icon: "credit-card", cat: "finance", titleKey: "label", primary: "details",
    blurb: "A card, IBAN or SWIFT account.",
    fields: [f("label", "Name", "text", { required: true, placeholder: "Travel card" }), f("type", "Kind", "select", { icon: "landmark", options: ["Card", "IBAN", "SWIFT"] }), f("details", "Number", "secret", { required: true, icon: "credit-card", mono: true }), f("cvv", "CVV", "secret", { icon: "key-round", mono: true }), f("expiry", "Expires", "text", { icon: "calendar", mono: true, placeholder: "MM/YY" })],
    sub: (x) => { const d = String(x.details || "").replace(/\s/g, ""); return (x.type || "Card") + (d ? " ···· " + d.slice(-4) : ""); } },
  { id: "license", label: "Software license", plural: "Licenses", icon: "award", cat: "finance", titleKey: "product_name", primary: "serial_key",
    blurb: "Serial keys and activation details.",
    fields: [f("product_name", "Product", "text", { required: true, placeholder: "Sketch" }), f("serial_key", "Serial key", "secret", { required: true, icon: "key-round", mono: true }), f("activation_info", "Activation", "text", { icon: "info" }), f("expiration", "Expires", "date", { icon: "calendar" })],
    sub: (x) => x.activation_info || "" },
  { id: "legal", label: "Legal contract", plural: "Legal", icon: "scale", cat: "finance", titleKey: "name", primary: "summary",
    blurb: "Contracts, their parties and signing dates.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Apartment lease" }), f("summary", "Summary", "multiline", { icon: "file-text" }), f("parties_involved", "Parties", "text", { icon: "users" }), f("signed_date", "Signed", "date", { icon: "calendar" })],
    sub: (x) => x.parties_involved || "" },

  { id: "document", label: "Document", plural: "Documents", icon: "file-lock-2", cat: "media", titleKey: "name", primary: "password",
    blurb: "A file sealed with its own password.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Lease agreement" }), f("file", "File", "file", { required: true, accept: "*" }), f("password", "Document password", "password", { icon: "key-round", hint: "Needed to open the file, in addition to your vault." }), f("tags", "Tags", "tags", { icon: "tag" }), f("expiry", "Expires", "date", { icon: "calendar" })],
    sub: (x) => x.file ? x.file.name + " · " + fmtBytes(x.file.size) : "" },
  { id: "photo", label: "Photo", plural: "Photos", icon: "image", cat: "media", titleKey: "name", primary: null,
    blurb: "An image stored inside the vault.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Passport scan" }), f("file", "Image", "file", { required: true, accept: "image/*" })],
    sub: (x) => x.file ? x.file.name + " · " + fmtBytes(x.file.size) : "" },
  { id: "audio", label: "Audio", plural: "Audio", icon: "music", cat: "media", titleKey: "name", primary: null,
    blurb: "A voice memo or recording.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Seed phrase memo" }), f("file", "Audio file", "file", { required: true, accept: "audio/*" })],
    sub: (x) => x.file ? x.file.name + " · " + fmtBytes(x.file.size) : "" },
  { id: "video", label: "Video", plural: "Video", icon: "video", cat: "media", titleKey: "name", primary: null,
    blurb: "A video stored inside the vault.",
    fields: [f("name", "Name", "text", { required: true, placeholder: "Safe combination" }), f("file", "Video file", "file", { required: true, accept: "video/*" })],
    sub: (x) => x.file ? x.file.name + " · " + fmtBytes(x.file.size) : "" }
];

function fmtBytes(n) {
  if (!n && n !== 0) return "";
  return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB";
}

const BY = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const getType = (id) => BY[id] || BY.note;
export const titleOf = (it) => { const t = getType(it.type); return (it.f && it.f[t.titleKey]) || t.label; };
export const subOf = (it) => { try { return getType(it.type).sub(it.f || {}) || ""; } catch (e) { return ""; } };
export const passwordKey = (type) => (type === "password" || type === "wifi" ? "password" : null);
export const secretKeys = (type) => getType(type).fields.filter((x) => ["password", "secret", "secretBlock", "totp", "codes"].includes(x.kind)).map((x) => x.key);
export const primaryValue = (it) => {
  const t = getType(it.type);
  if (!t.primary) return "";
  const v = it.f[t.primary];
  return Array.isArray(v) ? v.join("\n") : v || "";
};
export const EXPORTABLE = ["password", "totp", "token", "note", "apikey", "ssh_key", "wifi", "recovery"];
export const INJECT = { password: "password", totp: "secret", token: "token", note: "content", apikey: "key", ssh_key: "private_key", wifi: "password", recovery: "codes", certificate: "private_key", cloud: "secret_key", docker: "token", ssh_config: "private_key" };
export const fmtSize = fmtBytes;
export const activePolicy = (disk) => {
  const p = disk && disk.meta && disk.meta.policy;
  if (!p) return null;
  if (typeof p === "string") return (disk.policies || []).find((x) => x.name === p) || { name: p, min_length: 0 };
  return p;
};
export const byAi = (it) => it.source === "ai" || String(it.createdBy || "").toLowerCase() === "ai";
