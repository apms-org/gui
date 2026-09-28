export const PROFILES = {
  standard: { id: "standard", name: "Standard", kdf: "Argon2id", time: 3, memory: 64, threads: 2, salt: 16, nonce: 12, cipher: "AES-256-GCM", unlock: "about 0.3s", blurb: "Fast unlocks on any machine. Strong against offline guessing." },
  hardened: { id: "hardened", name: "Hardened", kdf: "Argon2id", time: 5, memory: 256, threads: 4, salt: 32, nonce: 12, cipher: "AES-256-GCM", unlock: "about 1s", blurb: "Four times the memory cost. Recommended for most Macs." },
  paranoid: { id: "paranoid", name: "Paranoid", kdf: "Argon2id", time: 6, memory: 512, threads: 4, salt: 32, nonce: 24, cipher: "XChaCha20-Poly1305", unlock: "about 2s", blurb: "The highest cost APM offers. Each guess needs 512 MiB." },
  legacy: { id: "legacy", name: "Legacy", kdf: "PBKDF2", time: 600000, memory: 0, threads: 1, salt: 16, nonce: 12, cipher: "AES-256-GCM", unlock: "about 0.4s", blurb: "Compatibility only. Not memory-hard. Set from the CLI.", cliOnly: true }
};
export const CIPHERS = [
  { value: "AES-256-GCM", label: "AES-256-GCM", note: "Hardware accelerated on Apple silicon and modern x86." },
  { value: "XChaCha20-Poly1305", label: "XChaCha20-Poly1305", note: "Constant-time in software. Uses a 24-byte nonce." }
];
export const recommendProfile = (ramGB, cores) => (ramGB >= 16 && cores >= 8 ? "paranoid" : ramGB >= 8 && cores >= 4 ? "hardened" : "standard");
export const describe = (p) => p.kdf === "PBKDF2" ? "PBKDF2 · " + p.time.toLocaleString() + " iterations" : p.kdf + " · t=" + p.time + " · " + p.memory + " MiB · p=" + p.threads;
export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (s) => s.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (s) => /[A-Z]/.test(s) },
  { id: "lower", label: "A lowercase letter", test: (s) => /[a-z]/.test(s) },
  { id: "digit", label: "A number", test: (s) => /[0-9]/.test(s) },
  { id: "symbol", label: "A symbol from !@#$%^&*()-_=+", test: (s) => /[!@#$%^&*()\-_=+]/.test(s) }
];
