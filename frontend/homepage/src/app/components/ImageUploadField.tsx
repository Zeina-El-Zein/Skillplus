import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { resolveApiAssetUrl } from "../api";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ImageUploadFieldProps = {
  label: string;
  currentUrl?: string | null;
  currentAlt: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  shape?: "circle" | "rounded";
};

export default function ImageUploadField({
  label,
  currentUrl,
  currentAlt,
  selectedFile,
  onFileChange,
  disabled = false,
  shape = "rounded",
}: ImageUploadFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    resolveApiAssetUrl(currentUrl),
  );

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(resolveApiAssetUrl(currentUrl));
      return;
    }

    if (typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [currentUrl, selectedFile]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Only JPG, PNG and WEBP images are allowed.");
      onFileChange(null);
      event.currentTarget.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image must be 5 MB or smaller.");
      onFileChange(null);
      event.currentTarget.value = "";
      return;
    }

    setError("");
    onFileChange(file);
  }

  function clearSelection() {
    setError("");
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-5">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden border border-blue-100 bg-blue-50 text-blue-700 ${
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          }`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={currentAlt} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden="true" className="h-8 w-8" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <label
            htmlFor={inputId}
            className={`inline-flex items-center gap-2 rounded-full border border-blue-200 px-5 py-2.5 text-sm font-semibold text-blue-900 transition-colors ${
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-blue-50"
            }`}
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            {selectedFile ? "Change selected image" : currentUrl ? "Replace image" : "Choose image"}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={handleChange}
            aria-label={label}
            aria-describedby={hintId}
            className="sr-only"
          />

          {selectedFile && (
            <div className="flex max-w-full items-center gap-2 text-sm text-gray-600">
              <span className="truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={clearSelection}
                disabled={disabled}
                className="inline-flex flex-shrink-0 items-center gap-1 font-semibold text-red-700 hover:text-red-600 disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Remove selection
              </button>
            </div>
          )}

          <p id={hintId} className="text-xs font-normal text-gray-500">
            JPG, PNG or WEBP. Maximum 5 MB. The image is uploaded when you save.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
