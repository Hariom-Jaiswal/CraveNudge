"use client";
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Send, Loader2, X } from "lucide-react";

interface FoodInputProps {
  onSubmit: (type: "text" | "image", input: string) => Promise<void>;
  isLoading: boolean;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function FoodInput({ onSubmit, isLoading }: FoodInputProps) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setImageError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side size guard (WORKFLOW.md §10.3)
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setImageError("Image must be under 5 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setText(""); // Clear text when image is selected
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const clearImage = useCallback(() => {
    setImagePreview(null);
    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (imagePreview) {
      await onSubmit("image", imagePreview);
      clearImage();
    } else if (text.trim()) {
      await onSubmit("text", text);
      setText("");
    }
  };

  const canSubmit = !isLoading && (!!imagePreview || text.trim().length > 0);

  return (
    <motion.div
      className="glass-panel p-4 outline outline-1 outline-border-glass focus-within:outline-primary/50 transition-all rounded-2xl relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-4 relative w-full h-40 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Selected food for analysis"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black/90 transition-colors"
            aria-label="Remove selected image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {imageError && (
        <p role="alert" className="text-xs text-red-400 mb-2 ml-1">
          {imageError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Accessible file input with visible label */}
        <label htmlFor="food-image-upload" className="sr-only">
          Upload a photo of your food
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-text-muted hover:text-primary transition-colors bg-white/5 rounded-xl flex-shrink-0"
          aria-label="Upload a photo of your food"
          title="Upload photo"
        >
          <Camera className="w-5 h-5" />
        </button>
        <input
          id="food-image-upload"
          type="file"
          accept="image/jpeg, image/png"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
          aria-label="Upload food image"
        />

        <label htmlFor="food-text-input" className="sr-only">
          Describe your meal
        </label>
        <input
          id="food-text-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            imagePreview
              ? "Add an optional note…"
              : "What did you eat? e.g. Dal Makhani"
          }
          className="flex-grow bg-transparent border-none outline-none text-white placeholder-text-muted px-2 py-2"
          disabled={isLoading || !!imagePreview}
          maxLength={200}
          aria-describedby={imageError ? "image-error" : undefined}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="p-3 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:bg-primary/50 flex-shrink-0 shadow-lg shadow-primary/20"
          aria-label={isLoading ? "Analysing…" : "Submit meal"}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </form>
    </motion.div>
  );
}
