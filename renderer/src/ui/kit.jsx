import { A } from "../lib/ds.js";
import { useStore } from "../lib/store.js";

// App-only pieces that read the store. Everything generic comes from the
// design system as A.<Name>.

export function Cli({ cmd, className }) {
  const prefs = useStore((s) => s.prefs);
  if (prefs.showCli === false || !cmd) return null;
  return <A.Command cmd={cmd} label="Copy the pm command" className={className} />;
}
