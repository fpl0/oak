// `bun server/src/main.ts [--serve-dist]`: Oak's server on 127.0.0.1:8787 only (contracts §11.1).
import { createServer } from "./app.ts";
import { loadConfig } from "./config.ts";
import { ContentIndex } from "./content/index.ts";
import { loadContent } from "./content/loader.ts";
import { MAX_BINARY_BYTES } from "./routes/define.ts";
import { namedToolbox, serverGraderHosts } from "./seams.ts";
import { Secrets } from "./secrets.ts";

const config = loadConfig();
const log = (msg: string) => console.error(`[oak] ${msg}`);
// The API key is read, and deleted from the environment, before any worker or child starts (§11.5).
const secrets = new Secrets(config.secretsDir, { env: process.env, rootDir: config.rootDir });
const content = await loadContent({ contentDir: config.contentDir });
const problems = content.problems.filter((p) => p.message !== "lesson not authored yet");
for (const p of problems.slice(0, 20)) log(`content: ${p.id}: ${p.message}`);
const authored = content.lessons.length;
log(`content ${content.contentVersion ?? "(not built)"}: ${authored} lessons authored`);
const index = new ContentIndex(content);
const graders = serverGraderHosts({ toolbox: () => namedToolbox(index) });

const server = await createServer({ config, content, graders, secrets, log });

const bun = Bun.serve({
  hostname: config.hostname,
  port: config.port,
  // Bun's default is 128 MB, below the audio (300 MB) and backup (1 GB) uploads the routes accept; the
  // routes bound every body themselves while it streams (routes/define.ts readBounded).
  maxRequestBodySize: MAX_BINARY_BYTES + 1024 * 1024,
  // The tutor's SSE routes lift the idle timeout per request (`server.timeout(req, 0)`): c.env is this server.
  fetch: (req, srv) => server.app.fetch(req, srv),
});
log(
  `listening on http://${bun.hostname}:${bun.port}${config.dev ? " (dev)" : ""}; data in ${config.dataDir}`,
);

const stop = async () => {
  await bun.stop();
  await server.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
