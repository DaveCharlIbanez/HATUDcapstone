"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

import { createContext, useContext } from "react";

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed right-6 bottom-6 z-[100] flex flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            onClose={() => removeToast(toast.id)}
            toast={toast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, 3700);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <FaCheckCircle className="text-emerald-400 text-lg" />,
    error: <FaExclamationCircle className="text-lg text-red-400" />,
    info: <FaInfoCircle className="text-lg text-sky-400" />,
  };

  const borders = {
    success: "border-emerald-500/30",
    error: "border-red-500/30",
    info: "border-sky-500/30",
  };

  const backgrounds = {
    success: "bg-emerald-500/10",
    error: "bg-red-500/10",
    info: "bg-sky-500/10",
  };

  return (
    <div
      className={`flex min-w-[280px] max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm ${backgrounds[toast.type]} ${borders[toast.type]}
        ${isExiting ? "animate-slide-out" : "animate-slide-in"}
      `}
    >
      {icons[toast.type]}
      <p className="flex-1 text-slate-200 text-sm">{toast.message}</p>
      <button
        className="text-slate-400 transition-colors hover:text-slate-200"
        onClick={() => {
          setIsExiting(true);
          setTimeout(onClose, 300);
        }}
      >
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
