import type { Strings } from "./i18n";

/** Props shared by all components. */
export interface SharedProps {
  /** Site id as registered in the admin panel. */
  site: string;
  /** Worker URL, for example "https://feedback.dieck-labs.de". */
  endpoint: string;
  /** "de", "en" or "es". Defaults to "en". */
  lang?: string;
  /** JSON-serializable data sent along with each post, for example app state. */
  context?: unknown;
  /** Overrides for built-in strings. */
  strings?: Partial<Strings>;
}
