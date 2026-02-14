import { useStats } from "@/components/stats-provider";

export const useLotofacilStats = () => {
  const { stats, loading, refresh } = useStats();
  return { stats, loading, refresh };
};