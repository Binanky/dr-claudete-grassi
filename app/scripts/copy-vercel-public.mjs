import { cp, mkdir, rm } from "node:fs/promises";

await rm("public", { recursive: true, force: true });
await mkdir("public", { recursive: true });
await cp("dist/public", "public", { recursive: true });
console.log("Vercel public assets copied from dist/public");
