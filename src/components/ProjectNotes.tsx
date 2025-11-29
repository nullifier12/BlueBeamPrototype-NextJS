"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, AtSign, ChevronDown, ChevronRight } from "lucide-react";
import { ProjectNote, User } from "@/types";
import * as api from "@/lib/api";

interface ProjectNotesProps {
  projectId: string;
  currentUser: User | null;
}

export default function ProjectNotes({
  projectId,
  currentUser,
}: ProjectNotesProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [message, setMessage] = useState("");
  const [projectUsers, setProjectUsers] = useState<User[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Load project notes
  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getProjectNotes(projectId);
      setNotes(data.notes);
    } catch (error) {
      console.error("Error loading project notes:", error);
    }
  }, [projectId]);

  // Load project users for mentions
  const loadProjectUsers = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getProjectUsers(projectId);
      setProjectUsers(data.users);
    } catch (error) {
      console.error("Error loading project users:", error);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadNotes();
      loadProjectUsers();
    }
  }, [projectId, loadNotes, loadProjectUsers]);

  // Handle message input with mention detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setMessage(value);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionPosition(cursorPos);
      setShowMentionList(true);
    } else {
      setShowMentionList(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (user: User) => {
    const textBeforeMention = message.substring(
      0,
      mentionPosition - mentionQuery.length - 1
    );
    const textAfterMention = message.substring(mentionPosition);
    const newMessage = `${textBeforeMention}@${user.username} ${textAfterMention}`;

    setMessage(newMessage);
    setShowMentionList(false);
    setMentionQuery("");

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos =
          textBeforeMention.length + user.username.length + 2; // +2 for @ and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Filter users for mention autocomplete
  const filteredUsers = projectUsers.filter(
    (user) =>
      user.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Extract mentions from message
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      const user = projectUsers.find((u) => u.username === username);
      if (user) {
        mentions.push(user.id);
      }
    }

    return [...new Set(mentions)]; // Remove duplicates
  };

  // Parse message with highlighted mentions
  const parseMessage = (text: string) => {
    const parts: (string | React.ReactElement)[] = [];
    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add mention
      const username = match[1];
      const user = projectUsers.find((u) => u.username === username);
      if (user) {
        parts.push(
          <span key={match.index} className="font-bold">
            @{username}
          </span>
        );
      } else {
        parts.push(`@${username}`);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!message.trim() || !currentUser || !projectId) return;

    setLoading(true);
    try {
      const mentions = extractMentions(message);
      const data = await api.createProjectNote(
        projectId,
        message.trim(),
        mentions
      );
      setNotes((prev) => [...prev, data.note]);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key (Shift+Enter for new line, Enter to send)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!showMentionList) {
        handleSendMessage();
      }
    } else if (
      e.key === "ArrowDown" &&
      showMentionList &&
      filteredUsers.length > 0
    ) {
      e.preventDefault();
      // Focus first mention option
      if (mentionListRef.current) {
        const firstOption = mentionListRef.current.querySelector(
          "button"
        ) as HTMLButtonElement;
        firstOption?.focus();
      }
    }
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";

    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }

    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj);
    } catch (e) {
      console.error("Error formatting time:", e, date);
      return "N/A";
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";

    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }

    try {
      const today = new Date();
      const noteDate = dateObj;
      const isToday =
        noteDate.getDate() === today.getDate() &&
        noteDate.getMonth() === today.getMonth() &&
        noteDate.getFullYear() === today.getFullYear();

      if (isToday) {
        return "Today";
      }

      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year:
          noteDate.getFullYear() !== today.getFullYear()
            ? "numeric"
            : undefined,
      }).format(dateObj);
    } catch (e) {
      console.error("Error formatting date:", e, date);
      return "N/A";
    }
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Project Notes</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground mb-2"></div>

          {/* Messages List */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {notes.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                No messages yet. Start the conversation!
              </div>
            ) : (
              notes.map((note) => {
                const isCurrentUser = currentUser?.id === note.author.id;
                const showDate =
                  notes.indexOf(note) === 0 ||
                  (notes[notes.indexOf(note) - 1] &&
                    formatDate(notes[notes.indexOf(note) - 1].createdAt) !==
                      formatDate(note.createdAt));

                return (
                  <div key={note.id} className="space-y-1">
                    {showDate && (
                      <div className="text-center text-xs text-muted-foreground py-2">
                        {formatDate(note.createdAt)}
                      </div>
                    )}
                    <div
                      className={`flex gap-2 ${
                        isCurrentUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: note.author.color || "#0066cc",
                        }}
                      >
                        {note.author.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Message */}
                      <div
                        className={`flex flex-col max-w-[75%] ${
                          isCurrentUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-3 py-2 rounded-lg text-sm ${
                            isCurrentUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <div className="break-words">
                            {parseMessage(note.message)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{note.author.name}</span>
                          <span>•</span>
                          <span>{formatTime(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder="Write a message... (Use @ to mention someone)"
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-border rounded-md bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
            />

            {/* Mention Autocomplete */}
            {showMentionList && filteredUsers.length > 0 && (
              <div
                ref={mentionListRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto z-10"
              >
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleMentionSelect(user)}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
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
                ))}
              </div>
            )}
          </div>

          {/* Send Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Send size={12} />
              Send Message
            </button>
            <span className="text-xs text-muted-foreground">
              Team collaboration notes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
