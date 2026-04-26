import { buildExecutionStrategy } from "@/lib/execution/strategyBuilder";
import type { ExecutionInput, ExecutionStrategyPlan } from "@/lib/execution/types";

export function routeExecutionStrategy(input: ExecutionInput): ExecutionStrategyPlan {
  return buildExecutionStrategy(input);
}
