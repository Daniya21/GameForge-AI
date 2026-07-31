"use client";

import * as pc from "playcanvas";

/**
 * Turbopack can occasionally produce a PlayCanvas application whose optional
 * resource-handler table is missing the GLB/container handler. The engine's
 * full Application normally registers it, but Gameforge verifies and restores
 * the handler before every generated-model load so Tripo GLBs never depend on
 * bundler side effects.
 */
export function ensurePlayCanvasContainerHandler(app: pc.Application): boolean {
  if (app.loader.getHandler("container")) return true;

  try {
    app.loader.addHandler("container", new pc.ContainerHandler(app));
  } catch (error) {
    console.warn("GameForge could not register the PlayCanvas GLB container handler.", error);
  }

  return Boolean(app.loader.getHandler("container"));
}

export function loadPlayCanvasGlb(
  app: pc.Application,
  url: string,
  filename: string,
): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    if (!ensurePlayCanvasContainerHandler(app)) {
      reject(new Error("PlayCanvas GLB support could not be initialized."));
      return;
    }

    app.assets.loadFromUrlAndFilename(url, filename, "container", (error, asset) => {
      if (error || !asset?.resource) {
        reject(new Error(typeof error === "string" && error.trim() ? error : "The GLB asset was empty."));
        return;
      }
      resolve(asset);
    });
  });
}
