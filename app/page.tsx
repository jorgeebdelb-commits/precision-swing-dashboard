import IntelligenceDashboardShell from "@/components/intelligence/IntelligenceDashboardShell";
import { getIntelligence, getWatchlistSymbols } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

export default async function Page() {
  const symbols = await getWatchlistSymbols();
  const initialData = await getIntelligence({ symbols });

  return <IntelligenceDashboardShell initialData={initialData} />;
}
