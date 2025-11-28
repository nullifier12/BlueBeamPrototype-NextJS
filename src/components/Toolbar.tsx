"use client";

import React from "react";
import {
  FileText,
  Download,
  Upload,
  Save,
  Undo,
  Redo,
  Search,
  Settings,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Highlighter,
  Type,
  StickyNote,
  Square,
  Circle,
  Ruler,
  ArrowRight,
  Cloud,
  PenTool,
  Target,
  CircleDot,
  Minus,
  FileDown,
  FileUp,
  CurlyBraces,
  LogOut,
} from "lucide-react";
import { Tool, AnnotationType } from "@/types";
import { cn } from "@/utils/cn";

interface ToolbarProps {
  activeTool: AnnotationType | null;
  onToolSelect: (tool: AnnotationType | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onUpload: () => void;
  onExport: () => void;
  onImport: () => void;
  onLogout?: () => void;
  zoom: number;
}

const tools: Tool[] = [
  { id: "select", name: "Select", icon: "cursor", type: null, isActive: false },
  {
    id: "highlight",
    name: "Highlight",
    icon: "highlighter",
    type: "highlight",
    shortcut: "H",
    isActive: false,
  },
  {
    id: "text",
    name: "Text",
    icon: "type",
    type: "text",
    shortcut: "T",
    isActive: false,
  },
  {
    id: "sticky-note",
    name: "Sticky Note",
    icon: "sticky-note",
    type: "sticky-note",
    shortcut: "S",
    isActive: false,
  },
  {
    id: "rectangle",
    name: "Rectangle",
    icon: "square",
    type: "rectangle",
    shortcut: "R",
    isActive: false,
  },
  {
    id: "circle",
    name: "Circle",
    icon: "circle",
    type: "circle",
    shortcut: "C",
    isActive: false,
  },
  {
    id: "ellipse",
    name: "Ellipse",
    icon: "ellipse",
    type: "ellipse",
    shortcut: "E",
    isActive: false,
  },
  {
    id: "line",
    name: "Line",
    icon: "minus",
    type: "line",
    shortcut: "L",
    isActive: false,
  },
  {
    id: "arrow",
    name: "Arrow",
    icon: "arrow-right",
    type: "arrow",
    shortcut: "A",
    isActive: false,
  },
  {
    id: "measurement",
    name: "Measurement",
    icon: "ruler",
    type: "measurement",
    shortcut: "M",
    isActive: false,
  },
  {
    id: "calibrate",
    name: "Calibrate",
    icon: "target",
    type: "calibrate",
    shortcut: "K",
    isActive: false,
  },
  {
    id: "arc",
    name: "Arc",
    icon: "curly-braces",
    type: "arc",
    shortcut: "G",
    isActive: false,
  },
  {
    id: "cloud",
    name: "Cloud",
    icon: "cloud",
    type: "cloud",
    shortcut: "D",
    isActive: false,
  },
  {
    id: "freehand",
    name: "Freehand",
    icon: "pen-tool",
    type: "freehand",
    shortcut: "F",
    isActive: false,
  },
];

const getIcon = (iconName: string, size: number = 16) => {
  const iconMap: {
    [key: string]: React.ComponentType<{ size?: number; className?: string }>;
  } = {
    cursor: FileText,
    highlighter: Highlighter,
    type: Type,
    "sticky-note": StickyNote,
    square: Square,
    circle: Circle,
    ellipse: CircleDot,
    "arrow-right": ArrowRight,
    minus: Minus,
    ruler: Ruler,
    target: Target,
    "curly-braces": CurlyBraces,
    cloud: Cloud,
    "pen-tool": PenTool,
  };

  const IconComponent = iconMap[iconName] || FileText;
  return <IconComponent size={size} />;
};

export default function Toolbar({
  activeTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  onRotate,
  onSave,
  onUndo,
  onRedo,
  onUpload,
  onExport,
  onImport,
  onLogout,
  zoom,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      {/* File Operations */}
      <div className="flex gap-1">
        <button
          className="toolbar-button"
          onClick={onUpload}
          title="Upload Document"
        >
          <Upload size={16} />
        </button>
        <button className="toolbar-button" title="Download Document">
          <Download size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          <Save size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={onExport}
          title="Export JSON"
        >
          <FileDown size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={onImport}
          title="Import JSON"
        >
          <FileUp size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* Edit Operations */}
      <div className="flex gap-1">
        <button
          className="toolbar-button"
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={onRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* View Controls */}
      <div className="flex gap-1">
        <button className="toolbar-button" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <span className="px-2 py-1 text-sm font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <button className="toolbar-button" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="toolbar-button" onClick={onRotate} title="Rotate">
          <RotateCw size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* Annotation Tools */}
      <div className="flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={cn(
              "toolbar-button",
              activeTool === tool.type && "active"
            )}
            onClick={() => onToolSelect(tool.type)}
            title={`${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
          >
            {getIcon(tool.icon)}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Right side tools */}
      <div className="flex gap-1">
        <button className="toolbar-button" title="Search">
          <Search size={16} />
        </button>
        <button className="toolbar-button" title="Settings">
          <Settings size={16} />
        </button>
        {onLogout && (
          <button 
            className="toolbar-button" 
            onClick={onLogout}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
