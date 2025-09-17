"use client";

import React, { useState, useCallback } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Paperclip,
} from "lucide-react";
import { PunchListItem, PunchListSummary } from "@/types";
import { cn } from "@/utils/cn";

interface PunchListPanelProps {
  punchItems: PunchListItem[];
  onPunchItemCreate: (
    item: Omit<PunchListItem, "id" | "createdAt" | "updatedAt">
  ) => void;
  onPunchItemUpdate: (item: PunchListItem) => void;
  onPunchItemDelete: (id: string) => void;
  onAnnotationSelect: (annotationId: string) => void;
}

export default function PunchListPanel({
  punchItems,
  onPunchItemCreate,
  onPunchItemUpdate,
  onPunchItemDelete,
  onAnnotationSelect,
}: PunchListPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const summary: PunchListSummary = {
    total: punchItems.length,
    open: punchItems.filter((item) => item.status === "Open").length,
    inProgress: punchItems.filter((item) => item.status === "In-Progress")
      .length,
    closed: punchItems.filter((item) => item.status === "Closed").length,
    progressPercent:
      punchItems.length > 0
        ? Math.round(
            (punchItems.filter((item) => item.status === "Closed").length /
              punchItems.length) *
              100
          )
        : 0,
  };

  const handleCreatePunchItem = useCallback(() => {
    const newItem: Omit<PunchListItem, "id" | "createdAt" | "updatedAt"> = {
      description: "New Issue",
      demarcation: "",
      location: "",
      status: "Open",
      percentComplete: 0,
      assignedTo: "",
      attachments: [],
      comments: "",
    };
    onPunchItemCreate(newItem);
  }, [onPunchItemCreate]);

  const handleStatusChange = useCallback(
    (item: PunchListItem, status: PunchListItem["status"]) => {
      const updatedItem = { ...item, status, updatedAt: new Date() };
      if (status === "Closed") {
        updatedItem.percentComplete = 100;
      } else if (status === "Open") {
        updatedItem.percentComplete = 0;
      }
      onPunchItemUpdate(updatedItem);
    },
    [onPunchItemUpdate]
  );

  const handlePercentChange = useCallback(
    (item: PunchListItem, percent: number) => {
      const status: PunchListItem["status"] =
        percent === 100 ? "Closed" : percent > 0 ? "In-Progress" : "Open";
      const updatedItem = {
        ...item,
        percentComplete: percent,
        status,
        updatedAt: new Date(),
      };
      onPunchItemUpdate(updatedItem);
    },
    [onPunchItemUpdate]
  );

  const getStatusColor = (status: PunchListItem["status"]) => {
    switch (status) {
      case "Open":
        return "text-red-600 bg-red-50";
      case "In-Progress":
        return "text-yellow-600 bg-yellow-50";
      case "Closed":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getProgressBarColor = (percent: number) => {
    if (percent < 30) return "bg-red-500";
    if (percent < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Punch List</h2>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        </div>

        {/* Summary */}
        {!isCollapsed && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-red-600">{summary.open} Open</span>
              <span className="text-yellow-600">
                {summary.inProgress} In-Progress
              </span>
              <span className="text-green-600">{summary.closed} Closed</span>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    getProgressBarColor(summary.progressPercent)
                  )}
                  style={{ width: `${summary.progressPercent}%` }}
                />
              </div>
              <div className="text-center text-sm font-medium">
                {summary.progressPercent}% complete
              </div>
            </div>

            <button
              onClick={handleCreatePunchItem}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              New Item
            </button>
          </div>
        )}
      </div>

      {/* Punch Items List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {punchItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No punch items yet</p>
                <p className="text-xs">
                  Create annotations to automatically generate punch items
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {punchItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border border-border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {item.description}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.location}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-1 text-xs rounded-full whitespace-nowrap",
                          getStatusColor(item.status)
                        )}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(
                              item,
                              e.target.value as PunchListItem["status"]
                            )
                          }
                          className="text-xs border border-border rounded px-2 py-1 bg-background"
                        >
                          <option value="Open">Open</option>
                          <option value="In-Progress">In-Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.percentComplete}
                          onChange={(e) =>
                            handlePercentChange(
                              item,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="text-xs border border-border rounded px-2 py-1 bg-background w-16"
                          placeholder="%"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={item.assignedTo}
                          onChange={(e) =>
                            onPunchItemUpdate({
                              ...item,
                              assignedTo: e.target.value,
                              updatedAt: new Date(),
                              status: item.status as PunchListItem["status"],
                            })
                          }
                          placeholder="Assigned to"
                          className="text-xs border border-border rounded px-2 py-1 bg-background flex-1"
                        />
                      </div>

                      <textarea
                        value={item.comments}
                        onChange={(e) =>
                          onPunchItemUpdate({
                            ...item,
                            comments: e.target.value,
                            updatedAt: new Date(),
                            status: item.status as PunchListItem["status"],
                          })
                        }
                        placeholder="Comments..."
                        className="text-xs border border-border rounded px-2 py-1 bg-background w-full h-16 resize-none"
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {item.attachments.length > 0 && (
                            <Paperclip
                              size={12}
                              className="text-muted-foreground"
                            />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {item.attachments.length} attachments
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              item.annotationId &&
                              onAnnotationSelect(item.annotationId)
                            }
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Go to annotation"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => onPunchItemDelete(item.id)}
                            className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                            title="Delete item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
