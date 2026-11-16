"use client";

import { useAction, useMutation, useQuery } from "convex/react";
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
  /**
   * True once the server has confirmed the stored token is a live session.
   * Authenticated queries must not be sent before this is true: a stale
   * token makes every guarded query throw, and a throw inside the root
   * layout takes the whole app down.
   */
  isSessionValidated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** Asks for a sign-up code and sends it to the address. */
  requestSignupCode: (
    data: SignupDetails
  ) => Promise<{ success: boolean; error?: string; sentTo?: string }>;
  sessionToken: string | null;
  user: User | null;
  /** Verifies the code and creates the account. */
  verifySignupCode: (
    data: SignupCodeVerification
  ) => Promise<{ success: boolean; error?: string }>;
}

/** Everything needed to ask for a sign-up code. */
export interface SignupDetails {
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

/** The code, and the acceptance of the terms. */
export interface SignupCodeVerification {
  /** The terms and conditions have been read and accepted. */
  acceptedTerms: boolean;
  /** The version of the terms that was accepted. */
  acceptedTermsVersion: string;
  /** The code that was emailed. */
  code: string;
  email: string;
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

/** How often a signed-in app tells the server it is open (fixoct51). */
const HEARTBEAT_INTERVAL_MS = 45 * 1000;

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

  // `sessionData` is undefined while the validation query is in flight.
  const isSessionValidated = sessionToken !== null && sessionData !== undefined;

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
  const requestSignupCodeMutation = useAction(api.auth.requestSignupCode);
  const verifySignupCodeMutation = useMutation(api.auth.verifySignupCode);
  const logoutMutation = useMutation(api.auth.logout);
  const heartbeatMutation = useMutation(api.presence.heartbeat);

  // Presence (fixoct51): tell the server the app is open, every 45 seconds
  // while the page is visible. A backgrounded WebView pauses its timers, so a
  // closed or hidden app drops out of "online" on its own after two minutes.
  const isSignedIn = isSessionValidated && sessionData !== null;
  useEffect(() => {
    if (!(isSignedIn && sessionToken)) {
      return;
    }
    const beat = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      heartbeatMutation({ sessionToken }).catch(() => {
        // Best effort: a missed beat only delays "online" by one interval.
      });
    };
    beat();
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [heartbeatMutation, isSignedIn, sessionToken]);

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

  const requestSignupCode = async (
    data: SignupDetails
  ): Promise<{ success: boolean; error?: string; sentTo?: string }> => {
    try {
      const result = await requestSignupCodeMutation({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        licenseNumber: data.licenseNumber,
        vehicleInfo: data.vehicleInfo,
      });
      return { success: true, sentTo: result.email };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not send the code",
      };
    }
  };

  const verifySignupCode = async (
    data: SignupCodeVerification
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await verifySignupCodeMutation({
        acceptedTerms: data.acceptedTerms,
        acceptedTermsVersion: data.acceptedTermsVersion,
        code: data.code,
        email: data.email,
      });
      localStorage.setItem(STORAGE_KEY, result.sessionToken);
      setSessionToken(result.sessionToken);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create the account",
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
      value={{
        user,
        isLoading,
        isSessionValidated,
        sessionToken,
        login,
        logout,
        requestSignupCode,
        verifySignupCode,
      }}
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
