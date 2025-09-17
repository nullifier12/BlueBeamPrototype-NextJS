"use client";

import React, { useState } from "react";
import { Annotation } from "@/types";
import { cn } from "@/utils/cn";
import { MessageSquare, Eye, EyeOff, Trash2, Search } from "lucide-react";

interface AnnotationPanelProps {
  annotations: Annotation[];
  onAnnotationSelect: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
}

export default function AnnotationPanel({
  annotations,
  onAnnotationSelect,
  onAnnotationDelete,
  onAnnotationUpdate,
}: AnnotationPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={cn(
                "p-2 rounded-md transition-colors",
                showHidden ? "bg-muted" : "hover:bg-muted"
              )}
              title={
                showHidden
                  ? "Hide hidden annotations"
                  : "Show hidden annotations"
              }
            >
              {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
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
        {filteredAnnotations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">No annotations found</p>
            {searchTerm && (
              <p className="text-xs mt-1">Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredAnnotations.map((annotation) => (
              <div
                key={annotation.id}
                className="p-3 border border-border rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => onAnnotationSelect(annotation)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs rounded-full flex items-center gap-1",
                        getTypeColor(annotation.type)
                      )}
                    >
                      {getTypeIcon(annotation.type)}
                      {annotation.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Page {annotation.page}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationUpdate({
                          ...annotation,
                          isVisible: !annotation.isVisible,
                        });
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title={
                        annotation.isVisible
                          ? "Hide annotation"
                          : "Show annotation"
                      }
                    >
                      {annotation.isVisible ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationDelete(annotation.id);
                      }}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                      title="Delete annotation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {annotation.content && (
                  <p className="text-sm text-foreground mb-2">
                    {annotation.content}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: annotation.author.color }}
                    />
                    <span>{annotation.author.name}</span>
                  </div>
                  <span>{formatDate(annotation.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
