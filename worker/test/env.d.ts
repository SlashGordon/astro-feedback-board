// Vite's import.meta, used by the tests to find wrangler.jsonc and load the D1 migrations.
interface ImportMeta {
  url: string;
  glob<T>(pattern: string, options: { query: "?raw"; import: "default"; eager: true }): Record<string, T>;
}
