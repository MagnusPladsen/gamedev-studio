// electron-builder always drops node_modules from extraResources, so the bundled Next server is copied in here,
// after packing and before signing.
import { cpSync } from "node:fs";
import path from "node:path";

export default async function copyServer(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const resourcesDir =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");
  cpSync(path.resolve(import.meta.dirname, "..", "server"), path.join(resourcesDir, "server"), {
    recursive: true,
    verbatimSymlinks: true,
  });
}
