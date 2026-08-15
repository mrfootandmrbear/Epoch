/**
 * Node ESM resolver hook that lets `scripts/*.ts` import `src/` modules the way
 * the rest of the codebase writes them — extensionless (`./climate`), which is
 * what Vite and Vitest resolve but plain Node does not.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/<script>.ts
 *
 * Resolution only: Node 24 strips the types itself.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const HOOK = `
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") || /\\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    for (const suffix of [".ts", "/index.ts"]) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch { /* try the next suffix */ }
    }
    throw error;
  }
}
`;

register(`data:text/javascript,${encodeURIComponent(HOOK)}`, pathToFileURL("./"));
