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
    console.log("📁 File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!file.type.includes("pdf")) {
      console.warn("⚠️ Invalid file type:", file.type);
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);
    console.log("⏳ Starting file conversion to base64 and page count detection...");

    try {
      // Convert file to base64 for storage
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:application/pdf;base64, prefix
          const base64Data = result.split(',')[1] || result;
          console.log("✅ Base64 conversion complete, length:", base64Data.length);
          resolve(base64Data);
        };
        reader.onerror = (error) => {
          console.error("❌ FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(file);
      });

      // Detect page count using PDF.js
      let pageCount = 1; // Default to 1 if detection fails
      try {
        if (typeof window !== 'undefined' && window.pdfjsLib) {
          console.log("📄 Detecting PDF page count...");
          const arrayBuffer = await file.arrayBuffer();
          const pdfData = new Uint8Array(arrayBuffer);
          
          const loadingTask = window.pdfjsLib.getDocument(pdfData, {
            cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
            cMapPacked: true,
          });
          
          const pdf = await loadingTask.promise;
          pageCount = pdf.numPages;
          console.log(`✅ PDF has ${pageCount} page(s)`);
        } else {
          console.warn("⚠️ PDF.js not available, using default page count of 1");
        }
      } catch (pageCountError) {
        console.error("❌ Error detecting page count:", pageCountError);
        console.warn("⚠️ Using default page count of 1");
      }

      // Create object URL for immediate display
      const fileUrl = URL.createObjectURL(file);
      console.log("🔗 Created blob URL:", fileUrl.substring(0, 50) + "...");

      // Create PDF document object with base64 data
      // Use crypto.randomUUID() for consistent ID generation (client-side only)
      const documentId = typeof window !== 'undefined' 
        ? crypto.randomUUID() 
        : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const now = new Date();
      const newDocument: PDFDocument = {
        id: documentId,
        name: file.name,
        url: fileUrl,
        pageCount: pageCount, // Use detected page count
        createdAt: now,
        updatedAt: now,
        size: file.size,
        status: "active",
        // Store base64 for database
        base64: base64,
      } as PDFDocument & { base64?: string };

      console.log("📤 Calling onDocumentUpload with document:", {
        name: newDocument.name,
        hasBase64: !!base64,
        pageCount: newDocument.pageCount,
        url: newDocument.url.substring(0, 50) + "...",
      });

      // Call onDocumentUpload first, let it handle closing the modal
      onDocumentUpload(newDocument);
      // Don't close here - let the parent handle it after successful upload
    } catch (error) {
      console.error("❌ Error uploading file:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      alert("Error uploading file. Please try again. Check console for details.");
    } finally {
      setUploading(false);
      console.log("🏁 File upload process finished");
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
                  Upload PDF files of any size
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
