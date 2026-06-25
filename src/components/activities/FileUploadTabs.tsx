"use client";

import { useRef, useState } from "react";
import { FileImage, FileText, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  createAttachmentFromFile,
  FileAttachment,
} from "@/lib/activities";

interface FileUploadTabsProps {
  photos: FileAttachment[];
  pdfs: FileAttachment[];
  onPhotosChange: (photos: FileAttachment[]) => void;
  onPdfsChange: (pdfs: FileAttachment[]) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
}

export function FileUploadTabs({
  photos,
  pdfs,
  onPhotosChange,
  onPdfsChange,
  disabled,
  variant = "light",
}: FileUploadTabsProps) {
  const isDark = variant === "dark";
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "pdfs">("photos");

  async function handlePhotoUpload(files: FileList | null) {
    if (!files?.length) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2 * 1024 * 1024) {
        alert(`${file.name} exceeds 2 MB limit. Please use a smaller image.`);
        continue;
      }
      newAttachments.push(await createAttachmentFromFile(file));
    }
    onPhotosChange([...photos, ...newAttachments]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handlePdfUpload(files: FileList | null) {
    if (!files?.length) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") continue;
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} exceeds 5 MB limit.`);
        continue;
      }
      newAttachments.push(await createAttachmentFromFile(file));
    }
    onPdfsChange([...pdfs, ...newAttachments]);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  const tabClass = (tab: "photos" | "pdfs") =>
    cn(
      "flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
      activeTab === tab
        ? "border-brand-teal text-brand-teal"
        : isDark
          ? "border-transparent text-slate-400 hover:text-slate-200"
          : "border-transparent text-slate-500 hover:text-slate-700"
    );

  const cardClass = isDark
    ? "border-slate-700 bg-slate-900"
    : "border-slate-200 bg-white";

  return (
    <div className={cn("rounded-xl border", cardClass)}>
      <div className="flex border-b border-inherit">
        <button type="button" className={tabClass("photos")} onClick={() => setActiveTab("photos")}>
          <FileImage className="h-4 w-4" />
          Photos ({photos.length})
        </button>
        <button type="button" className={tabClass("pdfs")} onClick={() => setActiveTab("pdfs")}>
          <FileText className="h-4 w-4" />
          PDFs ({pdfs.length})
        </button>
      </div>

      <div className="p-4">
        {activeTab === "photos" ? (
          <div className="space-y-3">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={disabled}
              onChange={(e) => handlePhotoUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => photoInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload photos
            </Button>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <AttachmentCard
                    key={photo.id}
                    attachment={photo}
                    isDark={isDark}
                    isImage
                    onRemove={() => onPhotosChange(photos.filter((p) => p.id !== photo.id))}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
            {photos.length === 0 && (
              <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
                No photos uploaded yet. Activity evidence photos are required before completion.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              disabled={disabled}
              onChange={(e) => handlePdfUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => pdfInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload PDFs
            </Button>
            {pdfs.length > 0 && (
              <div className="space-y-2">
                {pdfs.map((pdf) => (
                  <AttachmentCard
                    key={pdf.id}
                    attachment={pdf}
                    isDark={isDark}
                    onRemove={() => onPdfsChange(pdfs.filter((p) => p.id !== pdf.id))}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
            {pdfs.length === 0 && (
              <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
                No PDF documents uploaded yet. Reports and forms can be attached here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentCard({
  attachment,
  isDark,
  isImage,
  onRemove,
  disabled,
}: {
  attachment: FileAttachment;
  isDark: boolean;
  isImage?: boolean;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border",
        isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"
      )}
    >
      {isImage ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex items-center gap-2 p-3">
          <FileText className="h-5 w-5 shrink-0 text-red-500" />
          <span className="truncate text-sm">{attachment.name}</span>
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Remove file"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
