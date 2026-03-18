import path from "path";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./remotion/index.ts");

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias as Record<string, string> | undefined),
      "@": path.resolve(process.cwd()),
    },
  },
}));
