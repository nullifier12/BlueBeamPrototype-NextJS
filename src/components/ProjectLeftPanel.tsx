"use client";

import React, { useState, useCallback } from "react";
import { 
  FileText, 
  Calendar, 
  MoreHorizontal, 
  Upload, 
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Paperclip,
  Save,
  Ruler
} from "lucide-react";
import { PDFDocument, PunchListItem, PunchListSummary, User } from "@/types";
import { cn } from "@/utils/cn";
import ProjectNotes from "./ProjectNotes";

interface ProjectLeftPanelProps {
  documents: PDFDocument[];
  selectedDocument: PDFDocument | null;
  onDocumentSelect: (document: PDFDocument) => void;
  onUploadDocument: () => void;
  // Project Details (set by team/project leader)
  projectId: string;
  onProjectIdChange: (id: string) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  projectLocation: string;
  onProjectLocationChange: (location: string) => void;
  projectTargetCompletion: string;
  onProjectTargetCompletionChange: (completion: string) => void;
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  calibrationFactor: number;
  onCalibrationChange: (factor: number) => void;
  currentUser: User | null;
}

export default function ProjectLeftPanel({
  documents,
  selectedDocument,
  onDocumentSelect,
  onUploadDocument,
  projectId,
  onProjectIdChange,
  projectName,
  onProjectNameChange,
  projectLocation,
  onProjectLocationChange,
  projectTargetCompletion,
  onProjectTargetCompletionChange,
  companyName,
  onCompanyNameChange,
  calibrationFactor,
  onCalibrationChange,
  currentUser,
}: ProjectLeftPanelProps) {

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="w-80 border-r border-border bg-secondary flex flex-col">
      {/* Documents Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Documents</h2>
          <button
            onClick={onUploadDocument}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Upload Document"
          >
            <Upload size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted rounded-md transition-colors">
            <FolderOpen size={16} />
            Recent Documents
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted rounded-md transition-colors">
            <FolderOpen size={16} />
            Shared Documents
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted rounded-md transition-colors">
            <FolderOpen size={16} />
            My Documents
          </button>
        </div>
      </div>

      {/* Recent Files */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Recent Files
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">No documents yet</p>
              <p className="text-xs">Upload your first PDF to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                    selectedDocument?.id === document.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => onDocumentSelect(document)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText
                        size={20}
                        className="text-primary mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {document.name}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {document.updatedAt ? formatDate(document.updatedAt) : 'N/A'}
                          </span>
                          <span>{formatFileSize(document.size)}</span>
                          <span>{document.pageCount} pages</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-full",
                        document.status === "active" && "bg-success/10 text-success",
                        document.status === "archived" && "bg-warning/10 text-warning",
                        document.status === "deleted" && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {document.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Details Section */}
        <div className="p-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Ruler size={16} />
            Project Details
          </h3>
          <div className="space-y-3">
            {/* Company Name */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Company Name + Logo
              </label>
              <input
                type="text"
                placeholder="Enter company name..."
                value={companyName}
                onChange={(e) => onCompanyNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Project ID */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Project ID
              </label>
              <input
                type="text"
                placeholder="Enter project ID..."
                value={projectId}
                onChange={(e) => onProjectIdChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Project Name
              </label>
              <input
                type="text"
                placeholder="Enter project name..."
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Project Location */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Project Location
              </label>
              <input
                type="text"
                placeholder="Enter project location..."
                value={projectLocation}
                onChange={(e) => onProjectLocationChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Project Target Completion */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Project Target Completion
              </label>
              <input
                type="date"
                value={projectTargetCompletion}
                onChange={(e) => onProjectTargetCompletionChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Scale/Calibration */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Scale (optional) - override calibration
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="1.0"
                value={calibrationFactor}
                onChange={(e) => onCalibrationChange(parseFloat(e.target.value) || 1.0)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Project Notes Section - Collaborative Messaging Style */}
        <ProjectNotes projectId={projectId} currentUser={currentUser} />

      </div>
    </div>
  );
}
