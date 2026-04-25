import type { AnalysisResult, HorizonKey, PipelineInput } from "@/lib/intelligence/types";
import { shortTermPipeline } from "@/lib/intelligence/pipelines/shortTerm";
import { fundamental3mPipeline } from "@/lib/intelligence/pipelines/fundamental3m";
import { fundamental6mPipeline } from "@/lib/intelligence/pipelines/fundamental6m";
import { fundamental1yPipeline } from "@/lib/intelligence/pipelines/fundamental1y";

const pipelineMap: Record<HorizonKey, (input: PipelineInput) => Promise<AnalysisResult>> = {
  shortTerm: shortTermPipeline,
  fundamental3m: fundamental3mPipeline,
  fundamental6m: fundamental6mPipeline,
  fundamental1y: fundamental1yPipeline,
};

function normalizeHorizon(horizon?: string | null): HorizonKey | "all" {
  if (!horizon) return "all";

  const value = horizon.toLowerCase().trim();

  if (
    value.includes("under") ||
    value.includes("short") ||
    value.includes("swing") ||
    value.includes("1m") ||
    value.includes("2m")
  ) {
    return "shortTerm";
  }

  if (value === "3m" || value.includes("3 month") || value.includes("three month")) {
    return "fundamental3m";
  }

  if (value === "6m" || value.includes("6 month") || value.includes("six month")) {
    return "fundamental6m";
  }

  if (
    value === "1y" ||
    value.includes("1 year") ||
    value.includes("12 month") ||
    value.includes("year+")
  ) {
    return "fundamental1y";
  }

  return "all";
}

export async function routeAnalysis(
  symbol: string,
  horizon: string | null | undefined,
  input: Omit<PipelineInput, "symbol">
): Promise<Array<{ moduleName: HorizonKey; result: AnalysisResult }>> {
  const selected = normalizeHorizon(horizon);
  const runList: HorizonKey[] =
    selected === "all"
      ? ["shortTerm", "fundamental3m", "fundamental6m", "fundamental1y"]
      : [selected];

  const runs = await Promise.all(
    runList.map(async (moduleName) => {
      const result = await pipelineMap[moduleName]({ ...input, symbol });
      return { moduleName, result };
    })
  );

  return runs;
}
