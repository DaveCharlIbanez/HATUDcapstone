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

type User = {
  userId: string;  // read-only: used only for getByUserId profile lookups
  role: UserRole;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

type SignupData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "commuter" | "operator";
  licenseNumber?: string;
  vehicleInfo?: {
    plateNumber: string;
    model: string;
    color: string;
  };
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "hatud_session_token";
const COOKIE_NAME = "hatud_session_token";

function setSessionCookie(token: string) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
}

function clearSessionCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

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
    if (sessionData === undefined) return;

    if (sessionData === null) {
      // Token invalid or expired — clear it
      localStorage.removeItem(STORAGE_KEY);
      clearSessionCookie();
      setSessionToken(null);
      setUser(null);
    } else {
      setUser({ userId: sessionData.userId, role: sessionData.role, name: sessionData.name, email: sessionData.email });
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
      setSessionCookie(result.sessionToken);
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
      setSessionCookie(result.sessionToken);
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
    clearSessionCookie();
    setSessionToken(null);
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionToken, login, signup, logout }}>
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
