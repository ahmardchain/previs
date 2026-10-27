import { notFound } from "next/navigation";
import { getMarket } from "@/lib/markets";
import { MarketView } from "./MarketView";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = getMarket(id);
  if (!market) notFound();
  return <MarketView market={market} />;
}
