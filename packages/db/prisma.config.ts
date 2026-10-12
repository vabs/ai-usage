import { loadRootEnv } from "@app/shared/paths";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/url";

loadRootEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
