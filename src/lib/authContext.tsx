"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";

type UserRole = "commuter" | "operator" | "admin";

interface User {
  email: string;
  name: string;
  role: UserRole;
  userId: string; // read-only: used only for getByUserId profile lookups
}

interface AuthContextType {
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  sessionToken: string | null;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  user: User | null;
}

interface SignupData {
  email: string;
  licenseNumber?: string;
  name: string;
  password: string;
  phone: string;
  role: "commuter" | "operator";
  vehicleInfo?: {
    plateNumber: string;
    model: string;
    color: string;
  };
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * The session token is kept in localStorage and passed to Convex explicitly
 * on every call. It is deliberately not mirrored into a cookie: nothing reads
 * it, and a cookie written from JavaScript can never be HttpOnly, so it would
 * only widen the attack surface. Moving to an HttpOnly cookie requires a
 * server runtime, which the Capacitor static export does not have.
 */
const STORAGE_KEY = "hatud_session_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY)
  );
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Reactively validate the token against the server on every load
  const sessionData = useQuery(
    api.auth.getSession,
    sessionToken ? { sessionToken } : "skip"
  );

  useEffect(() => {
    if (sessionToken === null) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    // sessionData is undefined while the query is loading
    if (sessionData === undefined) {
      return;
    }

    if (sessionData === null) {
      // Token invalid or expired — clear it
      localStorage.removeItem(STORAGE_KEY);
      setSessionToken(null);
      setUser(null);
    } else {
      setUser({
        userId: sessionData.userId,
        role: sessionData.role,
        name: sessionData.name,
        email: sessionData.email,
      });
    }
    setIsLoading(false);
  }, [sessionData, sessionToken]);

  const loginMutation = useMutation(api.auth.login);
  const signupMutation = useMutation(api.auth.signup);
  const logoutMutation = useMutation(api.auth.logout);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await loginMutation({ email, password });
      localStorage.setItem(STORAGE_KEY, result.sessionToken);
      setSessionToken(result.sessionToken);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  };

  const signup = async (
    data: SignupData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signupMutation({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        licenseNumber: data.licenseNumber,
        vehicleInfo: data.vehicleInfo,
      });
      localStorage.setItem(STORAGE_KEY, result.sessionToken);
      setSessionToken(result.sessionToken);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
      };
    }
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await logoutMutation({ sessionToken });
      } catch {
        // Best-effort server revocation; always clear locally
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setSessionToken(null);
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, sessionToken, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
