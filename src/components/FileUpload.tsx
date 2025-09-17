"use client";

import React, { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { PDFDocument } from "@/types";
import { cn } from "@/utils/cn";

interface FileUploadProps {
  onDocumentUpload: (document: PDFDocument) => void;
  onClose: () => void;
}

export default function FileUpload({
  onDocumentUpload,
  onClose,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);

    try {
      // Create object URL for the file
      const fileUrl = URL.createObjectURL(file);

      // Create PDF document object
      const newDocument: PDFDocument = {
        id: Date.now().toString(),
        name: file.name,
        url: fileUrl,
        pageCount: 1, // We'll update this when the PDF loads
        createdAt: new Date(),
        updatedAt: new Date(),
        size: file.size,
        status: "active",
      };

      onDocumentUpload(newDocument);
      onClose();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [onDocumentUpload, onClose]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Upload Document</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Upload size={24} className="text-primary" />
              </div>

              <div>
                <p className="text-lg font-medium mb-2">
                  Drop your PDF here, or{" "}
                  <label className="text-primary cursor-pointer hover:underline">
                    browse
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleChange}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF files up to 50MB
                </p>
              </div>

              {uploading && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm">Uploading...</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground text-center">
            <p>
              Your files are processed locally and not uploaded to any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
