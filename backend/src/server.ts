import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

app.listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    const adminLoginPath = `${env.API_PREFIX}/auth/admin/login`;
    app.log.info(`Backend started on port ${env.PORT}`);
    app.log.info(`API prefix: ${env.API_PREFIX}`);
    app.log.info(`Expected admin login route: POST ${adminLoginPath}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
