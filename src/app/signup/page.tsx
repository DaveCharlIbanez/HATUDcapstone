"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FaCamera,
  FaCheck,
  FaEnvelope,
  FaFileImage,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { AppLoader } from "@/components/AppLoader";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { TermsDialog } from "@/components/TermsDialog";
import { useAuth } from "@/lib/authContext";
import { RouteStage } from "@/lib/routeTransition";
import { TERMS_VERSION } from "@/lib/terms";
import {
  type LocationPermissionState,
  useLocationPermission,
} from "@/lib/useLocationPermission";
import { api } from "../../../convex/_generated/api";
import {
  isGmailAddress,
  isValidPhone,
  normaliseEmail,
} from "../../../convex/lib/signupRules";

const UPPERCASE_LETTER = /[A-Z]/;
const DIGIT = /\d/;

type Step =
  | "code"
  | "details"
  | "documents"
  | "location"
  | "submitted"
  | "vehicle";

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
          {isLoading ? (
            <AppLoader label="Creating your account" variant="inline" />
          ) : (
            "Continue"
          )}
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

/**
 * Asks for the code that was emailed.
 *
 * Nothing exists yet — no account, no session. The code has to be entered
 * before the terms are even asked for, and the terms have to be accepted
 * before the account is created.
 */
function CodeStep({
  code,
  email,
  error,
  isLoading,
  onChange,
  onContinue,
  onResend,
  sandboxCode,
  sentTo,
}: {
  code: string;
  email: string;
  error: string | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onContinue: () => void;
  onResend: () => void;
  /** The code, shown only when the deployment has the sandbox on. */
  sandboxCode: string | null;
  sentTo: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <FaEnvelope className="text-2xl" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-bold text-2xl text-[var(--foreground)]">
          Enter your code
        </h2>
        <p className="mt-2 text-[var(--text-muted)] text-sm">
          We sent a six-digit code to{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {sentTo || email}
          </span>
          . It is good for ten minutes.
        </p>
      </div>

      <div>
        <label
          className="mb-2 block font-medium text-[var(--foreground)] text-sm"
          htmlFor="signup-code"
        >
          Verification code
        </label>
        <input
          autoComplete="one-time-code"
          className={FIELD_CLASS}
          id="signup-code"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="123456"
          type="text"
          value={code}
        />
      </div>

      {sandboxCode ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-center">
          <p className="text-[var(--text-muted)] text-xs">
            Sandbox mailbox — the code is here because no mail provider is
            configured
          </p>
          <p className="mt-1 font-mono font-semibold text-lg text-sky-600 dark:text-sky-400">
            {sandboxCode}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-500 text-sm">
          {error}
        </div>
      ) : null}

      <button
        className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading || code.length !== 6}
        onClick={onContinue}
        type="button"
      >
        {isLoading ? "Checking…" : "Continue"}
      </button>

      <button
        className="w-full rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
        disabled={isLoading}
        onClick={onResend}
        type="button"
      >
        Send the code again
      </button>
    </div>
  );
}

/**
 * Asks for the location permission, right after the account is created.
 *
 * The app cannot do its job without knowing where the user is: the rider
 * cannot be picked up, and the driver cannot be found. Asking here — at the
 * moment the account is made, in an app the user has just signed up for — is
 * the one place the request is obviously wanted rather than surprising.
 *
 * It is not a gate. The screen can be left at any time, and the permission
 * can be asked for again from the map.
 */
function LocationStep({
  error,
  isOperator,
  onContinue,
  onRequest,
  state,
}: {
  error: string | null;
  isOperator: boolean;
  onContinue: () => void;
  onRequest: () => void;
  state: LocationPermissionState;
}) {
  const isGranted = state === "granted";
  const isAsking = state === "asking";

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-3xl ${
            isGranted
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
          }`}
        >
          {isGranted ? (
            <FaCheck className="text-2xl" />
          ) : (
            <FaMapMarkerAlt className="text-2xl" />
          )}
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-bold text-2xl text-[var(--foreground)]">
          {isGranted ? "Location is on" : "Turn on your location"}
        </h2>
        <p className="mt-2 text-[var(--text-muted)] text-sm">
          {isOperator
            ? "HATUD shows riders and drivers where they are, so the two can find each other. Your location is only shared while you are on a trip."
            : "HATUD shows your driver where you are and sets your pickup for you. Your location is only shared while you are on a trip."}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 text-sm dark:text-amber-400">
          {error}
        </div>
      ) : null}

      {isGranted ? null : (
        <button
          className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isAsking}
          onClick={onRequest}
          type="button"
        >
          {isAsking ? "Waiting for permission…" : "Turn on location"}
        </button>
      )}

      <button
        className="w-full rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
        onClick={onContinue}
        type="button"
      >
        {isGranted ? "Continue" : "Not now"}
      </button>
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
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState("");
  const { requestSignupCode, verifySignupCode } = useAuth();
  const sandboxCodeQuery = useQuery(
    api.signupCodes.sandboxCodeForEmail,
    codeSentTo ? { email: normaliseEmail(codeSentTo) } : "skip"
  );
  const location = useLocationPermission();

  const isOperator = formData.role === "operator";
  const totalSteps = isOperator ? 3 : 2;

  // The prompt goes up as soon as the step is on the screen. The step is not a
  // gate — it can be left at any time — but the request should not have to be
  // asked for twice.
  useEffect(() => {
    if (step === "location" && location.state === "unknown") {
      location.request();
    }
  }, [location.request, location.state, step]);

  const update: FormUpdater = (key) => (value) =>
    setFormData((previous) => ({ ...previous, [key]: value }));

  const validateDetails = (): string | null => {
    if (!isGmailAddress(formData.email)) {
      return "Use a Gmail address, for example you@gmail.com";
    }
    if (!isValidPhone(formData.phone)) {
      return "Enter your 11-digit mobile number, for example 09171234567";
    }
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
   * Asks for a sign-up code and sends it to the address.
   *
   * Nothing is created yet. The account only exists once the code has been
   * entered, so a wrong address cannot be signed up with.
   */
  const sendSignupCode = async (): Promise<boolean> => {
    setIsLoading(true);
    setError("");

    const result = await requestSignupCode({
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
      setError(result.error || "Could not send the code");
      return false;
    }

    const sentTo = result.sentTo ?? formData.email;
    setCodeSentTo(sentTo);
    setStep("code");

    return true;
  };

  /**
   * The code is entered, and the terms have been accepted. The account is
   * created. An operator stays pending until an admin reviews the uploaded
   * documents.
   */
  const createAccount = async (): Promise<boolean> => {
    setIsLoading(true);
    setError("");

    const result = await verifySignupCode({
      // The terms have been read and accepted. The server refuses a signup
      // without it, so this is not a promise — it is the record.
      acceptedTerms: true,
      acceptedTermsVersion: TERMS_VERSION,
      code,
      email: formData.email,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Could not create the account");
      return false;
    }
    return true;
  };

  /**
   * Opens the terms.
   *
   * The dialog opens on the step that actually creates the account. A
   * passenger creates theirs on the details step; a driver creates theirs on
   * the vehicle step, because the details step creates nothing. Either way,
   * accepting the terms is what creates the account, and the location step
   * comes after it.
   */
  const requestTermsAcceptance = () => {
    setIsTermsOpen(true);
  };

  /** The heading for the screen the user is on. */
  function headingForStep(current: Step): string {
    if (current === "submitted") {
      return "You are all set";
    }
    if (current === "location") {
      return "One more thing";
    }
    if (current === "code") {
      return "Check your email";
    }
    return "Create your account";
  }

  /**
   * The terms were accepted. The account is created.
   */
  const handleTermsAccepted = async () => {
    setIsTermsOpen(false);

    // The step only moves on once the account exists. A signup that is
    // refused — a duplicate email, for one — leaves the user on the form
    // with the error, not on a success screen for an account that is not
    // there.
    const created = await createAccount();
    if (!created) {
      return;
    }
    setStep("location");
  };

  /**
   * The location step is done, one way or the other.
   *
   * A driver still has credentials to upload; a passenger is finished.
   */
  const handleLocationContinue = () => {
    setStep(isOperator ? "documents" : "submitted");
  };

  /**
   * The code is entered. The terms are asked for, and accepting them is what
   * creates the account.
   */
  const handleCodeContinue = () => {
    requestTermsAcceptance();
  };

  /**
   * A new code is asked for.
   */
  const handleResendCode = async () => {
    await sendSignupCode();
  };

  /**
   * The terms were not accepted. Nothing is created and the form keeps
   * everything that was typed into it.
   */
  const handleTermsDeclined = () => {
    setIsTermsOpen(false);
  };

  const handleDetailsContinue = async () => {
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    if (!isOperator) {
      await sendSignupCode();
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

    await sendSignupCode();
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
    // fixoct50: arrives with the same push as sign in when opened from the
    // landing page.
    <RouteStage>
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/90 p-8 shadow-slate-950/50 shadow-xl backdrop-blur">
            <div className="mb-8 text-center">
              <h1 className="font-bold text-3xl text-[var(--foreground)]">
                HATUD
              </h1>
              <p className="mt-2 text-[var(--text-muted)] text-sm">
                {headingForStep(step)}
              </p>
            </div>

            {step === "submitted" ||
            step === "location" ||
            step === "code" ? null : (
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

            {step === "code" ? (
              <CodeStep
                code={code}
                email={formData.email}
                error={error}
                isLoading={isLoading}
                onChange={setCode}
                onContinue={handleCodeContinue}
                onResend={handleResendCode}
                sandboxCode={sandboxCodeQuery?.code ?? null}
                sentTo={codeSentTo}
              />
            ) : null}

            {step === "location" ? (
              <LocationStep
                error={location.error}
                isOperator={isOperator}
                onContinue={handleLocationContinue}
                onRequest={location.request}
                state={location.state}
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

            {step === "submitted" ||
            step === "location" ||
            step === "code" ? null : (
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

        {/* The terms have to be read and accepted before an account exists. */}
        <TermsDialog
          isOpen={isTermsOpen}
          onAccept={handleTermsAccepted}
          onClose={handleTermsDeclined}
        />
      </div>
    </RouteStage>
  );
}
