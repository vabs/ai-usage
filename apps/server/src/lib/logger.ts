import { createLogger } from "@app/shared";
import { env } from "../config";

export const logger = createLogger("server", env.LOG_LEVEL);
