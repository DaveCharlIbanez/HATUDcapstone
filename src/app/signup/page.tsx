"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaCamera, FaCheck, FaFileImage } from "react-icons/fa";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { useAuth } from "@/lib/authContext";

const UPPERCASE_LETTER = /[A-Z]/;
const DIGIT = /\d/;

type Step = "details" | "documents" | "submitted" | "vehicle";

const FIELD_CLASS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20";

interface FormData {
  color: string;
  confirmPassword: string;
  email: string;
  licenseNumber: string;
  model: string;
  name: string;
  password: string;
  phone: string;
  plateNumber: string;
  role: "commuter" | "operator";
}

const EMPTY_FORM: FormData = {
  color: "",
  confirmPassword: "",
  email: "",
  licenseNumber: "",
  model: "",
  name: "",
  password: "",
  phone: "",
  plateNumber: "",
  role: "commuter",
};

type FormUpdater = (key: keyof FormData) => (value: string) => void;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-[var(--text-muted)] text-sm">
        <span className="font-semibold">
          Step {current} of {total}
        </span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full bg-sky-500 transition-all"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Field({
  hint,
  id,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label
        className="mb-2 block font-medium text-[var(--foreground)] text-sm"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        className={FIELD_CLASS}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {hint ? (
        <p className="mt-1 text-[var(--text-muted)] text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

function DetailsStep({
  formData,
  onChange,
  onContinue,
  onRoleChange,
}: {
  formData: FormData;
  onChange: FormUpdater;
  onContinue: () => void;
  onRoleChange: (role: "commuter" | "operator") => void;
}) {
  const isOperator = formData.role === "operator";

  return (
    <div className="space-y-4">
      <div>
        <label
          className="mb-2 block font-medium text-[var(--foreground)] text-sm"
          htmlFor="role"
        >
          I am a
        </label>
        <select
          className={FIELD_CLASS}
          id="role"
          onChange={(event) =>
            onRoleChange(event.target.value as "commuter" | "operator")
          }
          value={formData.role}
        >
          <option value="commuter">Commuter</option>
          <option value="operator">Operator (Driver)</option>
        </select>
        {isOperator ? (
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            Drivers need to upload four credentials before they can drive.
          </p>
        ) : null}
      </div>

      <Field
        id="name"
        label="Full Name"
        onChange={onChange("name")}
        placeholder="Enter your full name"
        value={formData.name}
      />
      <Field
        id="email"
        label="Email"
        onChange={onChange("email")}
        placeholder="Enter your email"
        type="email"
        value={formData.email}
      />
      <Field
        id="phone"
        label="Phone Number"
        onChange={onChange("phone")}
        placeholder="+63 9XX XXX XXXX"
        type="tel"
        value={formData.phone}
      />
      <Field
        id="password"
        label="Password"
        onChange={onChange("password")}
        placeholder="Create a password"
        type="password"
        value={formData.password}
      />
      <Field
        id="confirmPassword"
        label="Confirm Password"
        onChange={onChange("confirmPassword")}
        placeholder="Repeat your password"
        type="password"
        value={formData.confirmPassword}
      />

      <button
        className="mt-2 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onContinue}
        type="button"
      >
        Continue
      </button>
    </div>
  );
}

function VehicleStep({
  formData,
  isLoading,
  onBack,
  onChange,
  onContinue,
}: {
  formData: FormData;
  isLoading: boolean;
  onBack: () => void;
  onChange: FormUpdater;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <Field
        hint="The number printed on your LTO licence"
        id="licenseNumber"
        label="License Number"
        onChange={onChange("licenseNumber")}
        placeholder="DR-XXXX-XXXX"
        value={formData.licenseNumber}
      />
      <Field
        id="plateNumber"
        label="Plate Number"
        onChange={onChange("plateNumber")}
        placeholder="ABC 123"
        value={formData.plateNumber}
      />
      <Field
        id="model"
        label="Vehicle Model"
        onChange={onChange("model")}
        placeholder="Yamaha NMAX 155"
        value={formData.model}
      />
      <Field
        id="color"
        label="Vehicle Color"
        onChange={onChange("color")}
        placeholder="White"
        value={formData.color}
      />

      <div className="flex gap-3">
        <button
          className="flex-1 rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
          onClick={onBack}
          type="button"
        >
          Back
        </button>
        <button
          className="flex-1 rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          onClick={onContinue}
          type="button"
        >
          {isLoading ? "Creating..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

function DocumentsStep({
  documentsReady,
  onDocumentsReady,
  onSubmit,
}: {
  documentsReady: boolean;
  onDocumentsReady: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-[var(--foreground)]">
          Upload your credentials
        </h2>
        <p className="mt-1 text-[var(--text-muted)] text-sm">
          Take a photo of each document, or select one you already saved. PNG
          and JPG only.
        </p>
      </div>

      <DocumentUploader onUploaded={onDocumentsReady} />

      <div className="flex gap-3">
        <Link
          className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
          href="/login"
        >
          Finish later
        </Link>
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!documentsReady}
          onClick={onSubmit}
          type="button"
        >
          <FaCheck />
          Submit
        </button>
      </div>

      <p className="flex items-start gap-2 text-[var(--text-muted)] text-xs">
        <FaFileImage className="mt-0.5 shrink-0" />
        Your application is reviewed by an administrator. You will be able to go
        online once it is approved.
      </p>
    </div>
  );
}

function SubmittedStep({ isOperator }: { isOperator: boolean }) {
  const router = useRouter();

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        {isOperator ? (
          <FaCamera className="text-2xl" />
        ) : (
          <FaCheck className="text-2xl" />
        )}
      </div>
      <div>
        <h2 className="font-bold text-2xl text-[var(--foreground)]">
          {isOperator ? "Application submitted" : "Account created"}
        </h2>
        <p className="mt-2 text-[var(--text-muted)] text-sm">
          {isOperator
            ? "An administrator is reviewing your credentials. We will let you know once your application is approved."
            : "Your account is ready. Sign in to start booking rides."}
        </p>
      </div>
      <button
        className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400"
        onClick={() => {
          router.push("/login");
        }}
        type="button"
      >
        Go to sign in
      </button>
    </div>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>("details");
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentsReady, setDocumentsReady] = useState(false);
  const { signup } = useAuth();

  const isOperator = formData.role === "operator";
  const totalSteps = isOperator ? 3 : 2;

  const update: FormUpdater = (key) => (value) =>
    setFormData((previous) => ({ ...previous, [key]: value }));

  const validateDetails = (): string | null => {
    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match";
    }
    if (formData.password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!UPPERCASE_LETTER.test(formData.password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!DIGIT.test(formData.password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const validateVehicle = (): string | null => {
    const missing = [
      ["license number", formData.licenseNumber],
      ["plate number", formData.plateNumber],
      ["vehicle model", formData.model],
      ["vehicle colour", formData.color],
    ].filter(([, value]) => !value);
    if (missing.length > 0) {
      return `Please fill in your ${missing.map(([label]) => label).join(", ")}`;
    }
    return null;
  };

  /**
   * Creates the account. An operator stays pending until an admin reviews
   * the uploaded documents.
   */
  const createAccount = async (): Promise<boolean> => {
    setIsLoading(true);
    setError("");

    const result = await signup({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: formData.role,
      licenseNumber: isOperator ? formData.licenseNumber : undefined,
      vehicleInfo: isOperator
        ? {
            plateNumber: formData.plateNumber,
            model: formData.model,
            color: formData.color,
          }
        : undefined,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Signup failed");
      return false;
    }
    return true;
  };

  const handleDetailsContinue = async () => {
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    if (!isOperator) {
      const created = await createAccount();
      if (created) {
        setStep("submitted");
      }
      return;
    }
    setStep("vehicle");
  };

  const handleVehicleContinue = async () => {
    const problem = validateVehicle();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    const created = await createAccount();
    if (created) {
      setStep("documents");
    }
  };

  const handleSubmitApplication = () => {
    if (!documentsReady) {
      setError("Please upload all four documents before submitting");
      return;
    }
    setStep("submitted");
  };

  const stepIndex = (() => {
    if (step === "details") {
      return 1;
    }
    if (step === "vehicle") {
      return 2;
    }
    if (step === "documents") {
      return 3;
    }
    return totalSteps;
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/90 p-8 shadow-slate-950/50 shadow-xl backdrop-blur">
          <div className="mb-8 text-center">
            <h1 className="font-bold text-3xl text-[var(--foreground)]">
              HATUD
            </h1>
            <p className="mt-2 text-[var(--text-muted)] text-sm">
              {step === "submitted" ? "You are all set" : "Create your account"}
            </p>
          </div>

          {step === "submitted" ? null : (
            <StepIndicator current={stepIndex} total={totalSteps} />
          )}

          {error ? (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
              {error}
            </div>
          ) : null}

          {step === "details" ? (
            <DetailsStep
              formData={formData}
              onChange={update}
              onContinue={handleDetailsContinue}
              onRoleChange={(role) =>
                setFormData((previous) => ({ ...previous, role }))
              }
            />
          ) : null}

          {step === "vehicle" ? (
            <VehicleStep
              formData={formData}
              isLoading={isLoading}
              onBack={() => setStep("details")}
              onChange={update}
              onContinue={handleVehicleContinue}
            />
          ) : null}

          {step === "documents" ? (
            <DocumentsStep
              documentsReady={documentsReady}
              onDocumentsReady={() => setDocumentsReady(true)}
              onSubmit={handleSubmitApplication}
            />
          ) : null}

          {step === "submitted" ? (
            <SubmittedStep isOperator={isOperator} />
          ) : null}

          {step === "submitted" ? null : (
            <p className="mt-4 text-center text-[var(--text-muted)] text-sm">
              Already have an account?{" "}
              <Link
                className="font-medium text-sky-500 transition-colors hover:text-sky-400"
                href="/login"
              >
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
