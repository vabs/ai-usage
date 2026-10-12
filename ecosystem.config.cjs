// pm2 process file. Runs the *built* apps (npm run build first).
//   Bare metal: npm run pm2:start | pm2:reload | pm2:logs | pm2:stop
//   Docker:     each container runs `pm2-runtime ecosystem.config.cjs --only <app>`
const path = require("node:path");

const root = __dirname;
const envFile = path.join(root, ".env");

module.exports = {
  apps: [
    {
      name: "server",
      cwd: path.join(root, "apps/server"),
      script: "dist/index.js",
      // Cluster mode shares the port across instances. SQLite (WAL) is fine with a few.
      exec_mode: "cluster",
      instances: process.env.WEB_CONCURRENCY || 1,
      // Loads .env when present (bare metal). In Docker, Compose provides the env.
      node_args: `--enable-source-maps --env-file-if-exists=${envFile}`,
      // Wait for process.send("ready") so reloads are zero-downtime.
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 10000,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "worker",
      cwd: path.join(root, "apps/worker"),
      script: "dist/index.js",
      exec_mode: "fork",
      instances: 1,
      node_args: `--enable-source-maps --env-file-if-exists=${envFile}`,
      // Give in-flight jobs time to finish on stop/reload.
      kill_timeout: 30000,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
    },
  ],
};
