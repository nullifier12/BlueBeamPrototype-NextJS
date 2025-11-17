"use client";

import React, { useState } from "react";
import { Annotation } from "@/types";
import { cn } from "@/utils/cn";
import { MessageSquare, Eye, EyeOff, Trash2, Search, FileText } from "lucide-react";

interface AnnotationPanelProps {
  annotations: Annotation[];
  onAnnotationSelect: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  projectId?: string;
  onProjectIdChange?: (projectId: string) => void;
}

export default function AnnotationPanel({
  annotations,
  onAnnotationSelect,
  onAnnotationDelete,
  onAnnotationUpdate,
  projectId = "",
  onProjectIdChange,
}: AnnotationPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [localProjectId, setLocalProjectId] = useState(projectId);

  const filteredAnnotations = annotations.filter((annotation) => {
    const matchesSearch =
      annotation.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      annotation.author.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || annotation.type === filterType;
    const matchesVisibility = showHidden || annotation.isVisible;

    return matchesSearch && matchesType && matchesVisibility;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      highlight: "bg-yellow-100 text-yellow-800",
      text: "bg-blue-100 text-blue-800",
      "sticky-note": "bg-orange-100 text-orange-800",
      rectangle: "bg-green-100 text-green-800",
      circle: "bg-purple-100 text-purple-800",
      line: "bg-red-100 text-red-800",
      arrow: "bg-indigo-100 text-indigo-800",
      measurement: "bg-pink-100 text-pink-800",
      cloud: "bg-cyan-100 text-cyan-800",
      freehand: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getTypeIcon = (type: string) => {
    console.log(type);
    // You can add specific icons for each type here
    return <MessageSquare size={14} />;
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Annotations</h2>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search annotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Types</option>
          <option value="highlight">Highlights</option>
          <option value="text">Text</option>
          <option value="sticky-note">Sticky Notes</option>
          <option value="rectangle">Rectangles</option>
          <option value="circle">Circles</option>
          <option value="line">Lines</option>
          <option value="arrow">Arrows</option>
          <option value="measurement">Measurements</option>
          <option value="cloud">Clouds</option>
          <option value="freehand">Freehand</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Annotations List */}
        <div className="p-4">
          {filteredAnnotations.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">No annotations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAnnotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="p-2 border border-border rounded hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onAnnotationSelect(annotation)}
                >
                  <div className="text-xs text-muted-foreground">
                    User {annotation.author.name} added {annotation.type} @ X:{annotation.position.x} Y:{annotation.position.y}
                    {annotation.metrics?.area && `, Area ${annotation.metrics.area} SQ.M`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Annotation */}
        <div className="p-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-2">Selected Annotation</h3>
          <div className="text-xs text-muted-foreground">None</div>
        </div>

        {/* Share / Reports Section */}
        <div className="p-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-3">Share / Reports</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                const exportData = {
                  projectId: localProjectId,
                  annotations: filteredAnnotations,
                  timestamp: new Date().toISOString()
                };
                navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
                console.log('JSON copied to clipboard');
              }}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Copy JSON to Clipboard
            </button>
            <button
              onClick={() => {
                const exportData = {
                  projectId: localProjectId,
                  annotations: filteredAnnotations,
                  timestamp: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `project-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('Package downloaded');
              }}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Download Package
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Share the exported JSON package with stakeholders. They can import to view annotations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
