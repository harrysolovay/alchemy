import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Resource } from "../resource";

export interface BundleProps {
  /**
   * Entry point for the bundle
   */
  entryPoint: string;
  /**
   * Output directory for the bundle
   */
  outdir?: string;
  /**
   * Output filename for the bundle
   */
  outfile?: string;
  /**
   * Bundle format (iife, cjs, esm)
   */
  format?: "iife" | "cjs" | "esm";
  /**
   * Target environment (e.g., 'node16', 'es2020')
   */
  target?: string | string[];
  /**
   * Whether to minify the output
   */
  minify?: boolean;
  /**
   * Whether to generate sourcemaps
   */
  sourcemap?: boolean | "inline" | "external" | "both";
  /**
   * External packages to exclude from bundle
   */
  external?: string[];
  /**
   * Platform to target (browser, node, neutral)
   */
  platform?: "browser" | "node" | "neutral";
  /**
   * Additional esbuild options
   */
  options?: Partial<esbuild.BuildOptions>;
}

export interface BundleOutput {
  /**
   * Path to the bundled file
   */
  path: string;
  /**
   * SHA-256 hash of the bundle contents
   */
  hash: string;
}

export class Bundle extends Resource(
  "esbuild::Bundle",
  async (ctx, props: BundleProps): Promise<BundleOutput> => {
    // Determine output path
    const outputPath =
      props.outfile ||
      path.join(
        props.outdir || "dist",
        path.basename(props.entryPoint, path.extname(props.entryPoint)) + ".js",
      );

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    if (ctx.event === "delete") {
      await fs.promises.unlink(outputPath).catch(() => {});
      // Also clean up sourcemap if it exists
      await fs.promises.unlink(outputPath + ".map").catch(() => {});
      return { path: outputPath, hash: "" };
    }

    // Build the bundle
    const result = await esbuild.build({
      entryPoints: [props.entryPoint],
      outfile: outputPath,
      bundle: true,
      format: props.format,
      target: props.target,
      minify: props.minify,
      sourcemap: props.sourcemap,
      external: props.external,
      platform: props.platform,
      metafile: true,
      write: true,
      ...props.options,
    });

    // Calculate hash of the output
    const contents = await fs.promises.readFile(outputPath);
    const hash = crypto.createHash("sha256").update(contents).digest("hex");

    // Store metadata in context
    await ctx.set("metafile", result.metafile);
    await ctx.set("hash", hash);

    // Return output info
    return {
      path: outputPath,
      hash,
    };
  },
) {
  /**
   * Get the metafile from the last build
   */
  public async getMetafile(ctx: {
    get<T>(key: string): Promise<T | undefined>;
  }) {
    return ctx.get<esbuild.Metafile>("metafile");
  }

  /**
   * Get the hash from the last build
   */
  public async getHash(ctx: { get<T>(key: string): Promise<T | undefined> }) {
    return ctx.get<string>("hash");
  }
}
