import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // React and the Pipecat SDK change far less often than the app, so
          // each is a chunk of its own that browsers can keep cached.
          codeSplitting: {
            groups: [
              {
                name: "react",
                test: /node_modules\/(react|react-dom|scheduler)\//,
              },
              { name: "pipecat", test: /node_modules\/@pipecat-ai\/client-/ },
            ],
          },
        },
      },
    },
    server: {
      // In development /api is the bot's own runner (bot.py). In production
      // it's the function in api/, which starts sessions on Pipecat Cloud.
      proxy: {
        "/api": {
          target: env.BOT_URL ?? "http://localhost:7860",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
