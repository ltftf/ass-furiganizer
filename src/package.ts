import fs from 'fs/promises';
import { join } from "path"

const pkg = JSON.parse(
  await fs.readFile(
    join(import.meta.dirname, "..", "package.json"),
    { encoding: 'utf-8' }
  )
);

export const PKG_NAME = pkg.name;
export const PKG_VERSION = pkg.version;
export const PKG_HOMEPAGE = pkg.homepage;