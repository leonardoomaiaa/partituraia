import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBillingStatus } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth-context";
import { FREE_SONG_LIMIT, type PlanId } from "@/lib/billing";

const STATUS_KEY = ["billing-status"];

export function useSubscription() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => getBillingStatus(),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const plan: PlanId = user ? (query.data?.plan ?? "free") : "free";

  return {
    plan,
    isPro: plan === "pro",
    signedIn: !!user,
    loading: loading || (!!user && query.isPending),
    subscriptionEnd: query.data?.subscriptionEnd ?? null,
    email: query.data?.email ?? user?.email ?? null,
    testMode: query.data?.testMode ?? false,
    simulated: query.data?.simulated ?? false,
    freeLimit: FREE_SONG_LIMIT,
    refresh: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  };
}
