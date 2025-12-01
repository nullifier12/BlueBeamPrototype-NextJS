import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Edit } from "lucide-react";
import { PunchListItem, PunchListSummary } from "@/types";

interface PunchListPanelProps {
  punchItems: PunchListItem[];
  onPunchItemCreate: (item: Omit<PunchListItem, "id" | "createdAt" | "updatedAt">) => void;
  onPunchItemUpdate: (item: PunchListItem) => void;
  onPunchItemDelete: (id: string) => void;
  onDemarcationClick?: (item: PunchListItem) => void;
}

export default function PunchListPanel({
  punchItems,
  onPunchItemCreate,
  onPunchItemUpdate,
  onPunchItemDelete,
  onDemarcationClick,
}: PunchListPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");

  const punchListSummary: PunchListSummary = {
    total: punchItems.length,
    open: punchItems.filter((item) => item.status === "Open").length,
    inProgress: punchItems.filter((item) => item.status === "In-Progress").length,
    closed: punchItems.filter((item) => item.status === "Closed").length,
    progressPercent: punchItems.length > 0 
      ? Math.round((punchItems.filter((item) => item.status === "Closed").length / punchItems.length) * 100)
      : 0,
  };

  const handleAddNewItem = useCallback(() => {
    if (newItemDescription.trim()) {
      const newItem: Omit<PunchListItem, "id" | "createdAt" | "updatedAt"> = {
        description: newItemDescription,
        demarcation: "",
        demarcationId: String.fromCharCode(65 + punchItems.length),
        location: "-",
        page: 1,
        position: { x: 0, y: 0 },
        status: "Open",
        percentComplete: 0,
        assignedTo: "",
        attachments: [],
        comments: "",
      };
      onPunchItemCreate(newItem);
      setNewItemDescription("");
    }
  }, [newItemDescription, punchItems.length, onPunchItemCreate]);

  const handleStatusChange = useCallback((id: string, newStatus: "Open" | "In-Progress" | "Closed") => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      let newPercent = item.percentComplete;
      if (newStatus === "Open") newPercent = 0;
      else if (newStatus === "Closed") newPercent = 100;
      
      onPunchItemUpdate({ ...item, status: newStatus, percentComplete: newPercent });
    }
  }, [punchItems, onPunchItemUpdate]);

  const handlePercentChange = useCallback((id: string, newPercent: number) => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      onPunchItemUpdate({ ...item, percentComplete: newPercent });
    }
  }, [punchItems, onPunchItemUpdate]);

  const handleDescriptionChange = useCallback((id: string, newDescription: string) => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      onPunchItemUpdate({ ...item, description: newDescription });
    }
  }, [punchItems, onPunchItemUpdate]);

  const handleAssignedToChange = useCallback((id: string, newAssignedTo: string) => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      onPunchItemUpdate({ ...item, assignedTo: newAssignedTo });
    }
  }, [punchItems, onPunchItemUpdate]);

  const handleCommentsChange = useCallback((id: string, newComments: string) => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      onPunchItemUpdate({ ...item, comments: newComments });
    }
  }, [punchItems, onPunchItemUpdate]);

  const handleDeleteItem = useCallback((id: string) => {
    if (window.confirm('Delete this punch item?')) {
      onPunchItemDelete(id);
    }
  }, [onPunchItemDelete]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border rounded-t-lg shadow-lg z-50 flex flex-col transition-all duration-300 ${
      isExpanded ? 'h-80' : 'h-12'
    }`}>
      {/* Header */}
      <div 
        className="flex justify-between items-center p-3 bg-muted border-b border-border cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Punch List</span>
          {!isExpanded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-red-600 font-medium">{punchListSummary.open} Open</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-orange-600 font-medium">{punchListSummary.inProgress} In-Progress</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-green-600 font-medium">{punchListSummary.closed} Closed</span>
              <span className="text-muted-foreground">({punchListSummary.progressPercent}%)</span>
            </div>
          )}
        </div>
        <button className="p-1 hover:bg-muted/80 rounded">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Summary */}
          <div className="p-3 border-b border-border bg-muted">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="text-red-600 font-medium">{punchListSummary.open} Open</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-orange-600 font-medium">{punchListSummary.inProgress} In-Progress</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-green-600 font-medium">{punchListSummary.closed} Closed</span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 bg-muted rounded-full mb-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${punchListSummary.progressPercent}%`,
                  backgroundColor: punchListSummary.progressPercent === 100 ? '#22c55e' : '#ef4444'
                }}
              />
            </div>
            <div className="text-sm font-medium">
              <strong>{punchListSummary.progressPercent}%</strong> complete
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Add New Item */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="New punch item description..."
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNewItem()}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleAddNewItem}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                + New Item
              </button>
            </div>

            {/* Punch List Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm bg-background rounded-lg overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Description</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Demarcation</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Location & Metrics</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">% Done</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Assigned To</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Comments</th>
                    <th className="border border-border p-2 text-left font-semibold text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {punchItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        No punch items yet
                      </td>
                    </tr>
                  ) : (
                    punchItems.map((item, index) => (
                      <tr key={item.id || `punch-item-${index}`} className="hover:bg-muted/50">
                        <td className="border border-border p-2 font-medium">{index + 1}</td>
                        <td className="border border-border p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="border border-border p-2">
                          {item.demarcationImage ? (
                            <div 
                              className="w-16 h-16 border border-border rounded overflow-hidden bg-muted cursor-pointer hover:border-primary hover:shadow-md transition-all"
                              onClick={() => onDemarcationClick?.(item)}
                              title={`Click to navigate to: ${item.demarcation || item.demarcationId || 'A'}`}
                            >
                              <img 
                                src={item.demarcationImage} 
                                alt={`Demarcation ${item.demarcationId || 'A'}`}
                                className="w-full h-full object-cover"
                                title={`Demarcated area: ${item.demarcation || item.demarcationId || 'A'}`}
                                onError={(e) => {
                                  console.error('Image failed to load:', item.demarcationImage);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div 
                              className="w-16 h-16 border border-border rounded bg-muted flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:border-primary hover:bg-primary/10 transition-all"
                              onClick={() => onDemarcationClick?.(item)}
                              title={`Click to navigate to: ${item.demarcation || item.demarcationId || 'A'}`}
                            >
                              {item.demarcation || item.demarcationId || 'A'}
                            </div>
                          )}
                        </td>
                        <td className="border border-border p-2 text-xs text-muted-foreground">
                          {item.location || `Page ${item.page || 1} / X:${item.position?.x || 0} Y:${item.position?.y || 0}`}
                        </td>
                        <td className="border border-border p-2">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value as "Open" | "In-Progress" | "Closed")}
                            className="px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="Open">Open</option>
                            <option value="In-Progress">In-Progress</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>
                        <td className="border border-border p-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.percentComplete}
                            onChange={(e) => handlePercentChange(item.id, parseInt(e.target.value) || 0)}
                            disabled={item.status === "Open" || item.status === "Closed"}
                            className={`w-16 px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary ${
                              item.status === "Open" || item.status === "Closed" ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          />
                        </td>
                        <td className="border border-border p-2">
                          <input
                            type="text"
                            value={item.assignedTo}
                            onChange={(e) => handleAssignedToChange(item.id, e.target.value)}
                            placeholder="Assignee"
                            className="w-full px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="border border-border p-2">
                          <textarea
                            value={item.comments}
                            onChange={(e) => handleCommentsChange(item.id, e.target.value)}
                            placeholder="Comments"
                            rows={2}
                            className="w-full px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          />
                        </td>
                        <td className="border border-border p-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}