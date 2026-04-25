import type { PipelineFn } from "@/lib/intelligence/types";
import { swingPipeline } from "@/lib/intelligence/pipelines/swing";

// Backward-compatible alias.
export const shortTermPipeline: PipelineFn = (input) => swingPipeline({ ...input, horizon: "swing" });
