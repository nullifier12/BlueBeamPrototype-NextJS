"use client";

import React, { useState, useCallback } from "react";
import { Settings, Save, Ruler } from "lucide-react";
import { Project } from "@/types";

interface ProjectSettingsPanelProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
  onCalibrate: () => void;
}

export default function ProjectSettingsPanel({
  project,
  onProjectUpdate,
  onCalibrate,
}: ProjectSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localProject, setLocalProject] = useState(project);

  const handleSave = useCallback(() => {
    onProjectUpdate({ ...localProject, updatedAt: new Date() });
  }, [localProject, onProjectUpdate]);

  const handleInputChange = useCallback(
    (field: keyof Project, value: string | number) => {
      setLocalProject((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  return (
    <div className="w-64 border-r border-border bg-secondary">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Settings size={16} />
            Project Settings
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={localProject.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., ABC Building Phase 1"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Scale Calibration */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Scale (units per pixel)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localProject.calibrationFactor}
                  onChange={(e) =>
                    handleInputChange(
                      "calibrationFactor",
                      parseFloat(e.target.value) || 1
                    )
                  }
                  step="0.000001"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={onCalibrate}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  title="Calibrate scale"
                >
                  <Ruler size={16} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {localProject.calibrationFactor.toFixed(6)} units/px
              </p>
            </div>

            {/* Manual Scale Override */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Manual Scale Override
              </label>
              <input
                type="number"
                value={localProject.scale}
                onChange={(e) =>
                  handleInputChange("scale", parseFloat(e.target.value) || 1)
                }
                step="0.1"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Override calibration factor
              </p>
            </div>

            {/* Inspection Notes */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Inspection Notes
              </label>
              <textarea
                value={localProject.inspectionNotes}
                onChange={(e) =>
                  handleInputChange("inspectionNotes", e.target.value)
                }
                placeholder="Write inspection notes here..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-success text-white rounded text-xs hover:bg-success/90 transition-colors flex items-center gap-1"
                >
                  <Save size={12} />
                  Save
                </button>
                <span className="text-xs text-muted-foreground">
                  Notes attachable to annotations
                </span>
              </div>
            </div>

            {/* Project Info */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </div>
                <div>
                  Updated: {new Date(project.updatedAt).toLocaleDateString()}
                </div>
                <div>ID: {project.id}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {!isExpanded && (
        <div className="p-4 space-y-2">
          <div className="text-sm font-medium">{project.name}</div>
          <div className="text-xs text-muted-foreground">
            Scale: {project.calibrationFactor.toFixed(6)} units/px
          </div>
          <div className="text-xs text-muted-foreground">
            Notes: {project.inspectionNotes.length} chars
          </div>
        </div>
      )}
    </div>
  );
}




