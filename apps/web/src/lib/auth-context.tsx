import { createContext, useContext, type PropsWithChildren } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthSession, LoginCredentials } from "@agency-crm/shared";
import { authQueryKey, getCurrentSession, login, logout } from "@/lib/auth-api";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: (values: LoginCredentials) => Promise<AuthSession>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentSession,
  });

  const loginMutation = useMutation({
    mutationFn: login,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
  });

  async function handleLogin(values: LoginCredentials) {
    const session = await loginMutation.mutateAsync(values);
    queryClient.setQueryData(authQueryKey, session);
    return session;
  }

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    queryClient.clear();
    queryClient.setQueryData(authQueryKey, null);
  }

  return (
    <AuthContext.Provider
      value={{
        session: sessionQuery.data ?? null,
        isAuthenticated: Boolean(sessionQuery.data),
        isLoading: sessionQuery.isLoading,
        error: (sessionQuery.error as Error | null) ?? null,
        login: handleLogin,
        logout: handleLogout,
        isLoggingIn: loginMutation.isPending,
        isLoggingOut: logoutMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
