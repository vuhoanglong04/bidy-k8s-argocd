import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks";
import {
  fetchAdminOverviewAuctions,
  fetchAdminOverviewCategories,
  fetchAdminOverviewUsers,
} from "./admin-overview.fetcher";

export const adminOverviewKeys = {
  all: ["admin", "overview"] as const,
  users: () => [...adminOverviewKeys.all, "users"] as const,
  auctions: () => [...adminOverviewKeys.all, "auctions"] as const,
  categories: () => [...adminOverviewKeys.all, "categories"] as const,
};

export const useAdminOverviewUsers = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminOverviewKeys.users(),
    queryFn: fetchAdminOverviewUsers,
    enabled: isAuthenticated,
  });

  return {
    overviewUsers: data ?? null,
    refetchOverviewUsers: refetch,
    isLoading,
    isError,
    error,
  };
};

export const useAdminOverviewAuctions = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminOverviewKeys.auctions(),
    queryFn: fetchAdminOverviewAuctions,
    enabled: isAuthenticated,
  });

  return {
    overviewAuctions: data ?? null,
    refetchOverviewAuctions: refetch,
    isLoading,
    isError,
    error,
  };
};

export const useAdminOverviewCategories = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminOverviewKeys.categories(),
    queryFn: fetchAdminOverviewCategories,
    enabled: isAuthenticated,
  });

  return {
    overviewCategories: data ?? null,
    refetchOverviewCategories: refetch,
    isLoading,
    isError,
    error,
  };
};
