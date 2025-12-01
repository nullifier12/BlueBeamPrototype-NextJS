import React, { useState, useCallback, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Edit } from "lucide-react";
import { PunchListItem, PunchListSummary, User } from "@/types";
import * as api from "@/lib/api";

interface PunchListPanelProps {
  punchItems: PunchListItem[];
  onPunchItemCreate: (item: Omit<PunchListItem, "id" | "createdAt" | "updatedAt">) => void;
  onPunchItemUpdate: (item: PunchListItem) => void;
  onPunchItemDelete: (id: string) => void;
  onDemarcationClick?: (item: PunchListItem) => void;
  projectId?: string;
  currentUser?: User | null;
}

export default function PunchListPanel({
  punchItems,
  onPunchItemCreate,
  onPunchItemUpdate,
  onPunchItemDelete,
  onDemarcationClick,
  projectId,
  currentUser,
}: PunchListPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [projectUsers, setProjectUsers] = useState<User[]>([]);
  const [mentionState, setMentionState] = useState<{
    itemId: string;
    showMentionList: boolean;
    mentionQuery: string;
    mentionPosition: number;
  } | null>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const assigneeInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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

  // Handle assignee input with mention detection
  const handleAssignedToChange = useCallback((id: string, value: string, cursorPos?: number) => {
    const item = punchItems.find(p => p.id === id);
    if (item) {
      onPunchItemUpdate({ ...item, assignedTo: value });
    }

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos ?? value.length);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionState({
        itemId: id,
        showMentionList: true,
        mentionQuery: mentionMatch[1],
        mentionPosition: cursorPos ?? value.length,
      });
    } else {
      if (mentionState?.itemId === id) {
        setMentionState(null);
      }
    }
  }, [punchItems, onPunchItemUpdate, mentionState]);

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

  // Load project users for mentions
  const loadProjectUsers = useCallback(async () => {
    if (!projectId || projectId.trim() === "") {
      setProjectUsers([]);
      return;
    }
    try {
      const data = await api.getProjectUsers(projectId);
      setProjectUsers(data.users);
    } catch (error) {
      // Only log unexpected errors (not "Project not found")
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.toLowerCase().includes("project not found")) {
        console.error("Error loading project users:", error);
      }
      setProjectUsers([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadProjectUsers();
    }
  }, [projectId, loadProjectUsers]);

  // Handle mention selection
  const handleMentionSelect = useCallback((user: User, itemId: string) => {
    const item = punchItems.find(p => p.id === itemId);
    if (!item) return;

    const currentValue = item.assignedTo || "";
    const mentionStateForItem = mentionState?.itemId === itemId ? mentionState : null;

    if (mentionStateForItem) {
      const textBeforeMention = currentValue.substring(
        0,
        mentionStateForItem.mentionPosition - mentionStateForItem.mentionQuery.length - 1
      );
      const textAfterMention = currentValue.substring(mentionStateForItem.mentionPosition);
      const newValue = `${textBeforeMention}@${user.username} ${textAfterMention}`;

      onPunchItemUpdate({ ...item, assignedTo: newValue });
      setMentionState(null);

      // Focus back to input and set cursor position
      setTimeout(() => {
        const inputRef = assigneeInputRefs.current[itemId];
        if (inputRef) {
          const newCursorPos = textBeforeMention.length + user.username.length + 2; // +2 for @ and space
          inputRef.focus();
          inputRef.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else {
      // If no mention state, just append the mention
      const newValue = currentValue.trim() ? `${currentValue} @${user.username} ` : `@${user.username} `;
      onPunchItemUpdate({ ...item, assignedTo: newValue });
      setMentionState(null);
    }
  }, [punchItems, onPunchItemUpdate, mentionState]);

  // Filter users for mention autocomplete
  const getFilteredUsers = useCallback((query: string) => {
    return projectUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [projectUsers]);

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
                        <td className="border border-border p-2 relative">
                          <input
                            ref={(el) => {
                              assigneeInputRefs.current[item.id] = el;
                            }}
                            type="text"
                            value={item.assignedTo}
                            onChange={(e) => {
                              const cursorPos = e.target.selectionStart;
                              handleAssignedToChange(item.id, e.target.value, cursorPos);
                            }}
                            onKeyDown={(e) => {
                              // Handle ArrowDown to navigate mention list
                              if (e.key === "ArrowDown" && mentionState?.itemId === item.id && mentionState.showMentionList) {
                                e.preventDefault();
                                const filteredUsers = getFilteredUsers(mentionState.mentionQuery);
                                if (filteredUsers.length > 0 && mentionListRef.current) {
                                  const firstOption = mentionListRef.current.querySelector("button") as HTMLButtonElement;
                                  firstOption?.focus();
                                }
                              }
                            }}
                            placeholder="@Assignee"
                            className="w-full px-2 py-1 text-xs border border-border rounded bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {/* Mention Autocomplete Dropdown */}
                          {mentionState?.itemId === item.id && mentionState.showMentionList && (
                            <div
                              ref={mentionListRef}
                              className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
                            >
                              {getFilteredUsers(mentionState.mentionQuery).length > 0 ? (
                                getFilteredUsers(mentionState.mentionQuery).map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => handleMentionSelect(user, item.id)}
                                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                                    type="button"
                                  >
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                      style={{ backgroundColor: user.color || "#0066cc" }}
                                    >
                                      {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-medium">{user.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        @{user.username}
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  No users found
                                </div>
                              )}
                            </div>
                          )}
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