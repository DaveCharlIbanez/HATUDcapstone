"use client";

import { useMutation } from "convex/react";
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
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

type SignupData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  licenseNumber?: string;
  vehicleInfo?: {
    plateNumber: string;
    model: string;
    color: string;
  };
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const storedUser =
    typeof window === "undefined" ? null : localStorage.getItem("hatud_user");

  useEffect(() => {
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("hatud_user");
      }
    }
    setIsLoading(false);
  }, [storedUser]);

  const loginMutation = useMutation(api.auth.login);
  const signupMutation = useMutation(api.auth.signup);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await loginMutation({ email, password });

      let name = "";
      if (result.role === "commuter" && result.profile) {
        name = (result.profile as { name?: string }).name || "";
      } else if (result.role === "operator" && result.profile) {
        name = (result.profile as { name?: string }).name || "";
      } else if (result.role === "admin" && result.profile) {
        name = (result.profile as { name?: string }).name || "";
      }

      const userData: User = {
        userId: result.userId,
        role: result.role,
        name,
        email,
        phone: "",
      };

      setUser(userData);
      localStorage.setItem("hatud_user", JSON.stringify(userData));

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
      await signupMutation({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        licenseNumber: data.licenseNumber,
        vehicleInfo: data.vehicleInfo,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("hatud_user");
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
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
