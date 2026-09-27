import { defineConfig } from "astro/config";

// Fixed port: the Worker only accepts posts from the origins registered for the site.
export default defineConfig({
  server: { port: 4321 },
  vite: { server: { strictPort: true } },
});
