"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { PropsWithChildren } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { createAccountApi, defaultAccountRequirements } from "../api/account";
import type { AccountApi, AccountSession } from "../api/account";
import { ApiError } from "../api/http";

type AccountContextValue = {
  api: AccountApi;
  session: AccountSession;
  isPending: boolean;
  error: Error | null;
  adoptSession: (session: AccountSession) => void;
  adoptAnonymousSession: () => Promise<void>;
  refreshSession: () => Promise<AccountSession | undefined>;
  invalidateAccountData: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const accountEndpoint = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "/react-api.php");
const anonymousSession: AccountSession = { authenticated: false, csrfToken: "", user: null, requirements: defaultAccountRequirements };
const sessionQueryKey = ["account", "session"] as const;
const permissionScopedQueryKeys = [["home"], ["navigation"], ["content"], ["content-detail"], ["playback"]] as const;

function retryTransientSessionFailure(failureCount: number, error: Error) {
  return failureCount < 2 && error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function isPrivateAccountQuery(queryKey: readonly unknown[]) {
  return queryKey[0] === "account" && queryKey[1] !== "session";
}

function anonymousFrom(session: AccountSession | undefined): AccountSession {
  return {
    authenticated: false,
    csrfToken: session?.csrfToken ?? "",
    user: null,
    requirements: session?.requirements ?? defaultAccountRequirements
  };
}

async function synchronizeAnonymousSession(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey, exact: true });
  const session = queryClient.getQueryData<AccountSession>(sessionQueryKey);
  queryClient.setQueryData(sessionQueryKey, anonymousFrom(session));
}

async function clearSessionBoundData(queryClient: QueryClient) {
  await queryClient.cancelQueries({ predicate: (query) => isPrivateAccountQuery(query.queryKey) });
  queryClient.removeQueries({ predicate: (query) => isPrivateAccountQuery(query.queryKey) });
  await Promise.all(permissionScopedQueryKeys.map((queryKey) => queryClient.resetQueries({ queryKey })));
}

function recoverUnauthorized<Args extends unknown[], Result>(request: (...args: Args) => Promise<Result>, queryClient: QueryClient) {
  return async (...args: Args) => {
    try {
      return await request(...args);
    } catch (error) {
      if (isUnauthorized(error)) {
        await synchronizeAnonymousSession(queryClient);
        await clearSessionBoundData(queryClient);
      }
      throw error;
    }
  };
}

export function AccountProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const baseApi = useMemo(
    () =>
      createAccountApi({
        endpoint: accountEndpoint,
        csrfToken: () => queryClient.getQueryData<AccountSession>(sessionQueryKey)?.csrfToken
      }),
    [queryClient]
  );
  const api = useMemo<AccountApi>(
    () => ({
      ...baseApi,
      logout: recoverUnauthorized(baseApi.logout, queryClient),
      getFavorites: recoverUnauthorized(baseApi.getFavorites, queryClient),
      setFavorite: recoverUnauthorized(baseApi.setFavorite, queryClient),
      deleteFavorites: recoverUnauthorized(baseApi.deleteFavorites, queryClient),
      getHistory: recoverUnauthorized(baseApi.getHistory, queryClient),
      saveHistory: recoverUnauthorized(baseApi.saveHistory, queryClient),
      deleteHistory: recoverUnauthorized(baseApi.deleteHistory, queryClient),
      getDevices: recoverUnauthorized(baseApi.getDevices, queryClient),
      revokeDevice: recoverUnauthorized(baseApi.revokeDevice, queryClient)
    }),
    [baseApi, queryClient]
  );
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      try {
        return await api.getSession();
      } catch (error) {
        if (isUnauthorized(error)) return anonymousFrom(queryClient.getQueryData<AccountSession>(sessionQueryKey));
        throw error;
      }
    },
    retry: retryTransientSessionFailure,
    retryDelay: 250,
    staleTime: 30_000
  });

  const adoptSession = (session: AccountSession) => {
    queryClient.setQueryData(sessionQueryKey, session);
  };

  const adoptAnonymousSession = async () => {
    await synchronizeAnonymousSession(queryClient);
  };

  const refreshSession = async () => {
    const result = await sessionQuery.refetch();
    if (!result.isSuccess || !result.data) return undefined;
    adoptSession(result.data);
    return result.data;
  };

  const invalidateAccountData = async () => {
    await clearSessionBoundData(queryClient);
  };

  return (
    <AccountContext.Provider
      value={{
        api,
        session: sessionQuery.data ?? anonymousSession,
        isPending: sessionQuery.isPending,
        error: sessionQuery.data ? null : sessionQuery.error,
        adoptSession,
        adoptAnonymousSession,
        refreshSession,
        invalidateAccountData
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount 必须在 AccountProvider 内使用");
  return context;
}
