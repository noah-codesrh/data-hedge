import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendEnv = loadEnv(
  process.env.NODE_ENV ?? "development",
  path.resolve(here, "../frontend"),
  "",
);
for (const [key, value] of Object.entries(frontendEnv)) {
  if (process.env[key] == null || process.env[key] === "") {
    process.env[key] = value;
  }
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
