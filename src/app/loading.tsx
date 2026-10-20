import { FaSpinner } from "react-icons/fa";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <FaSpinner className="animate-spin text-2xl text-sky-400" />
    </div>
  );
}
