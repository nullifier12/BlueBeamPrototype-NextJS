"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Toolbar from "@/components/Toolbar";
import ProjectLeftPanel from "@/components/ProjectLeftPanel";
import PDFViewer from "@/components/PDFViewer";
import AnnotationPanel from "@/components/AnnotationPanel";
import FileUpload from "@/components/FileUpload";
import PunchListPanel from "@/components/PunchListPanel";
import Login from "@/components/Login";
import {
  PDFDocument,
  Annotation,
  AnnotationType,
  Viewport,
  User,
  PunchListItem,
} from "@/types";
import * as api from "@/lib/api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function BlueBeamApp() {
  const { data: session, status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(
    undefined
  );
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PDFDocument | null>(
    null
  );
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationType | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [projectLocation, setProjectLocation] = useState<string>("");
  const [projectTargetCompletion, setProjectTargetCompletion] =
    useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [calibrationFactor, setCalibrationFactor] = useState<number>(1.0);
  const [projectNotes, setProjectNotes] = useState<string>("");
  const [punchItems, setPunchItems] = useState<PunchListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    zoom: 1,
    rotation: 0,
    page: 1,
    scrollX: 0,
    scrollY: 0,
  });

  // Sync NextAuth session with local state
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const user: User = {
        id: session.user.id,
        username: session.user.username,
        name: session.user.name || "",
        email: session.user.email || "",
        color: session.user.color,
      };
      setCurrentUser(user);
      if (session.projectId) {
        setCurrentProjectId(session.projectId);
      }
      setIsAuthenticated(true);
      console.log("✅ NextAuth session active:", {
        user: user.name,
        projectId: session.projectId || "NOT PROVIDED",
      });
    } else {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentProjectId(undefined);
    }
  }, [session, status]);

  // Load project data when authenticated
  useEffect(() => {
    console.log("🔄 useEffect check:", {
      isAuthenticated,
      currentProjectId,
      willLoad: isAuthenticated && !!currentProjectId,
    });
    if (isAuthenticated && currentProjectId) {
      loadProjectData();
    }
  }, [isAuthenticated, currentProjectId]);

  const loadProjectData = async () => {
    if (!currentProjectId) return;

    setLoading(true);
    try {
      // Load project details
      try {
        const projectData = await api.getProject(currentProjectId);
        if (projectData.project) {
          const p = projectData.project;
          setProjectId(p.project_id || p.id);
          setProjectName(p.name || "");
          setProjectLocation(p.location || "");
          setProjectTargetCompletion(p.target_completion || "");
          setCompanyName(p.company_name || "");
          setCalibrationFactor(
            p.calibration_factor
              ? (typeof p.calibration_factor === "number"
                  ? p.calibration_factor
                  : parseFloat(p.calibration_factor)) || 1.0
              : p.calibrationFactor || 1.0
          );
          setProjectNotes(p.project_notes || "");
        }
      } catch (projectError: any) {
        // Handle project not found gracefully
        if (projectError?.message?.includes("Project not found")) {
          console.warn("Project not found:", currentProjectId);
          // Clear project-related state
          setProjectId("");
          setProjectName("");
          setProjectLocation("");
          setProjectTargetCompletion("");
          setCompanyName("");
          setCalibrationFactor(1.0);
          setProjectNotes("");
          setDocuments([]);
          setAnnotations([]);
          setPunchItems([]);
          setLoading(false);
          return;
        }
        throw projectError; // Re-throw if it's a different error
      }

      // Load documents
      const docsData = await api.getDocuments(currentProjectId);
      const transformedDocs = docsData.documents.map((doc: PDFDocument) => {
        // If we have base64 data, convert it to blob URL
        // This is needed because blob URLs from previous sessions are invalid
        let url = doc.file_url || doc.file_path;

        if (doc.file_data) {
          try {
            console.log(
              "Converting base64 to blob URL for document:",
              doc.name
            );
            const base64Data = doc.file_data;

            // Handle base64 string (remove data URL prefix if present)
            const cleanBase64 = base64Data.includes(",")
              ? base64Data.split(",")[1]
              : base64Data;

            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/pdf" });
            url = URL.createObjectURL(blob);
            console.log(
              "Successfully created blob URL:",
              url.substring(0, 50) + "..."
            );
          } catch (error) {
            console.error("Error converting base64 to blob:", error);
            console.error("Base64 data length:", doc.file_data?.length);
            // Fallback to file_url if conversion fails
            url = doc.file_url || doc.file_path;
          }
        } else {
          console.warn(
            "No file_data found for document:",
            doc.name,
            "Using file_url:",
            doc.file_url
          );
        }

        if (!url) {
          console.error("No valid URL for document:", doc.name);
        }

        // Parse dates consistently - use existing dates or create from strings
        let createdAt: Date;
        let updatedAt: Date;

        if (doc.createdAt instanceof Date) {
          createdAt = doc.createdAt;
        } else if (doc.created_at) {
          createdAt = new Date(doc.created_at);
        } else {
          createdAt = new Date(); // Fallback only if no date exists
        }

        if (doc.updatedAt instanceof Date) {
          updatedAt = doc.updatedAt;
        } else if (doc.updated_at) {
          updatedAt = new Date(doc.updated_at);
        } else {
          updatedAt = createdAt; // Use createdAt as fallback
        }

        return {
          id: doc.id,
          name: doc.name,
          url: url || "",
          pageCount: doc.page_count || 0,
          createdAt,
          updatedAt,
          size: doc.file_size || 0,
          status: doc.status || "active",
        };
      });
      setDocuments(transformedDocs);
      console.log("Loaded documents:", transformedDocs.length);

      // Auto-select first document if only one exists and it has a valid URL
      if (transformedDocs.length === 1 && transformedDocs[0].url) {
        console.log(
          "📄 Auto-selecting single document:",
          transformedDocs[0].name
        );
        console.log(
          "📄 Document URL:",
          transformedDocs[0].url.substring(0, 50) + "..."
        );
        setSelectedDocument(transformedDocs[0]);
        setViewport((prev) => ({ ...prev, page: 1 }));
      }

      // Load annotations for the project (will filter by document when one is selected)
      const annsData = await api.getAnnotations(currentProjectId);
      setAnnotations(
        annsData.annotations.map((ann: Annotation) => ({
          ...ann,
          createdAt: new Date(ann.createdAt),
          updatedAt: new Date(ann.updatedAt),
        }))
      );

      // Load punch items
      const punchData = await api.getPunchItems(currentProjectId);
      setPunchItems(
        punchData.punchItems.map((item: PunchListItem) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }))
      );
    } catch (error) {
      console.error("Error loading project data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = useCallback((user: User, projectId?: string) => {
    console.log("🔐 Login successful:", {
      name: user.name,
      email: user.email,
      projectId: projectId || "NOT PROVIDED",
    });

    setCurrentUser(user);

    if (projectId) {
      setCurrentProjectId(projectId);
      console.log("✅ Project ID set:", projectId);
    } else {
      console.warn(
        "⚠️ No project ID provided in login. User needs to select a project."
      );
      // If no project ID, user needs to manually enter one or select from list
      // For now, we'll require project ID for uploads
    }

    setIsAuthenticated(true);
  }, []);

  const handleDocumentSelect = useCallback(
    (document: PDFDocument) => {
      console.log(
        "Selecting document:",
        document.name,
        "URL:",
        document.url?.substring(0, 50)
      );

      if (!document.url) {
        console.error("Document has no URL:", document);
        alert("Document URL is missing. Please re-upload the document.");
        return;
      }

      setSelectedDocument(document);
      setViewport((prev) => ({ ...prev, page: 1 }));

      // Load annotations for selected document
      if (currentProjectId) {
        api
          .getAnnotations(currentProjectId, document.id)
          .then((data) => {
            setAnnotations(
              data.annotations.map((ann: Annotation) => ({
                ...ann,
                createdAt: new Date(ann.createdAt),
                updatedAt: new Date(ann.updatedAt),
              }))
            );
          })
          .catch(console.error);
      }
    },
    [currentProjectId]
  );

  const handleToolSelect = useCallback((tool: AnnotationType | null) => {
    setActiveTool(tool);
  }, []);

  const handleZoomIn = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.25) }));
  }, []);

  const handleRotate = useCallback(() => {
    setViewport((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  }, []);

  const handleSave = useCallback(() => {
    console.log("Saving document...");
  }, []);

  const handleUndo = useCallback(() => {
    console.log("Undo action...");
  }, []);

  const handleRedo = useCallback(() => {
    console.log("Redo action...");
  }, []);

  // Helper functions for punch list integration
  const getDemarcationText = (annotation: Annotation) => {
    const typeIcons: Record<string, string> = {
      rectangle: "⬛ Rect",
      circle: "⚪ Circle",
      ellipse: "⭕ Ellipse",
      line: "📏 Line",
      polyline: "🔺 Polyline",
      arc: "〰 Arc",
      text: "💬 Comment",
    };
    return typeIcons[annotation.type] || annotation.type;
  };

  const getLocationText = (annotation: Annotation) => {
    let coordsText = `Page ${annotation.page}`;

    if (annotation.position) {
      const pos = annotation.position;
      if (annotation.type === "rectangle") {
        coordsText = `Page ${annotation.page}, X:${pos.x.toFixed(
          1
        )},Y:${pos.y.toFixed(1)} W:${(pos.width || 0).toFixed(1)} H:${(
          pos.height || 0
        ).toFixed(1)}`;
      } else if (annotation.type === "line") {
        coordsText = `Page ${annotation.page}, X:${pos.x.toFixed(
          1
        )},Y:${pos.y.toFixed(1)}`;
      } else if (
        annotation.type === "circle" ||
        annotation.type === "ellipse"
      ) {
        coordsText = `Page ${annotation.page}, C(X:${pos.x.toFixed(
          1
        )},Y:${pos.y.toFixed(1)})`;
      } else if (
        annotation.type === "arc" &&
        pos.points &&
        pos.points.length >= 3
      ) {
        const center = pos.points[1];
        coordsText = `Page ${annotation.page}, Center(X:${center.x.toFixed(
          1
        )},Y:${center.y.toFixed(1)})`;
      }
    }

    // Add metrics if available
    const metrics = [];
    if (annotation.metrics?.area)
      metrics.push(`Area: ${annotation.metrics.area.toFixed(2)}`);
    if (annotation.metrics?.perimeter)
      metrics.push(`Per: ${annotation.metrics.perimeter.toFixed(2)}`);
    if (annotation.metrics?.length)
      metrics.push(`Len: ${annotation.metrics.length.toFixed(2)}`);

    return `${coordsText}${metrics.length ? " • " + metrics.join(" • ") : ""}`;
  };

  const handlePunchItemImageUpdate = useCallback(
    async (annotationId: string, imageData: string) => {
      const punchItem = punchItems.find(
        (item) => item.annotationId === annotationId
      );
      if (punchItem) {
        try {
          await api.updatePunchItem(punchItem.id, {
            ...punchItem,
            demarcationImage: imageData,
          });
          setPunchItems((prev) =>
            prev.map((item) =>
              item.annotationId === annotationId
                ? {
                    ...item,
                    demarcationImage: imageData,
                    updatedAt: new Date(),
                  }
                : item
            )
          );
        } catch (error) {
          console.error("Error updating punch item image:", error);
        }
      }
    },
    [punchItems]
  );

  const handlePunchItemCreate = useCallback(
    async (item: Omit<PunchListItem, "id" | "createdAt" | "updatedAt">) => {
      if (!currentProjectId) return;

      try {
        const result = await api.createPunchItem({
          ...item,
          projectId: currentProjectId,
          documentId: selectedDocument?.id,
        });
        setPunchItems((prev) => [
          ...prev,
          {
            ...result.punchItem,
            createdAt: new Date(result.punchItem.createdAt),
            updatedAt: new Date(result.punchItem.updatedAt),
          },
        ]);
      } catch (error) {
        console.error("Error creating punch item:", error);
      }
    },
    [currentProjectId, selectedDocument]
  );

  const handleAnnotationCreate = useCallback(
    async (annotation: Omit<Annotation, "id" | "createdAt" | "updatedAt">) => {
      if (!selectedDocument) {
        console.error("❌ Cannot create annotation - no document selected");
        return;
      }

      // Get projectId - use currentProjectId or try to get from projectId state
      const projectIdToUse = currentProjectId || projectId;

      if (!projectIdToUse) {
        console.error("❌ Cannot create annotation - no project ID available", {
          currentProjectId,
          projectId,
          selectedDocument: selectedDocument.name,
        });
        alert(
          "Please set a Project ID in the Project Details section before creating annotations."
        );
        return;
      }

      console.log("✅ Creating annotation with projectId:", projectIdToUse);

      try {
        // Create annotation in database
        const result = await api.createAnnotation({
          ...annotation,
          documentId: selectedDocument.id,
          projectId: projectIdToUse,
        });

        const newAnnotation = {
          ...result.annotation,
          createdAt: new Date(result.annotation.createdAt),
          updatedAt: new Date(result.annotation.updatedAt),
        };

        setAnnotations((prev) => [...prev, newAnnotation]);

        // Only create punch list items for shape/measurement annotations,
        // not for every annotation type (e.g. text, highlight, etc.)
        const autoPunchTypes: AnnotationType[] = [
          "rectangle",
          "circle",
          "ellipse",
          "polyline",
          "arc",
          "measurement",
          "arrow",
          "line",
          "calibrate",
        ];

        if (autoPunchTypes.includes(annotation.type)) {
          const punchItem: Omit<
            PunchListItem,
            "id" | "createdAt" | "updatedAt"
          > = {
            annotationId: newAnnotation.id,
            description: `Issue with ${annotation.type}`,
            demarcation: getDemarcationText(newAnnotation),
            demarcationId: String.fromCharCode(65 + punchItems.length),
            location: getLocationText(newAnnotation),
            page: annotation.page,
            position: annotation.position,
            status: "Open",
            percentComplete: 0,
            assignedTo: "",
            attachments: [],
            comments: "",
          };

          await handlePunchItemCreate(punchItem);
        }

        // Capture demarcation image
        setTimeout(async () => {
          try {
            const canvas = document.querySelector(
              "canvas"
            ) as HTMLCanvasElement;
            if (!canvas) {
              console.warn("No canvas found for image capture");
              return;
            }

            const scale = viewport.zoom;
            const pos = annotation.position;
            let imageData: string | null = null;

            if (pos) {
              switch (annotation.type) {
                case "rectangle":
                  if (
                    pos.x !== undefined &&
                    pos.y !== undefined &&
                    pos.width &&
                    pos.height
                  ) {
                    const { captureDemarcatedArea } = await import(
                      "@/utils/imageCapture"
                    );
                    imageData = await captureDemarcatedArea(
                      canvas,
                      {
                        x: pos.x,
                        y: pos.y,
                        width: pos.width,
                        height: pos.height,
                        page: annotation.page,
                      },
                      scale
                    );
                  }
                  break;

                case "circle":
                case "ellipse":
                  if (
                    pos.x !== undefined &&
                    pos.y !== undefined &&
                    pos.radius
                  ) {
                    const { captureCircularArea } = await import(
                      "@/utils/imageCapture"
                    );
                    imageData = await captureCircularArea(
                      canvas,
                      pos.x,
                      pos.y,
                      pos.radius,
                      scale
                    );
                  }
                  break;

                default:
                  if (
                    pos.x !== undefined &&
                    pos.y !== undefined &&
                    pos.width &&
                    pos.height
                  ) {
                    const { captureDemarcatedArea } = await import(
                      "@/utils/imageCapture"
                    );
                    imageData = await captureDemarcatedArea(
                      canvas,
                      {
                        x: pos.x,
                        y: pos.y,
                        width: pos.width,
                        height: pos.height,
                        page: annotation.page,
                      },
                      scale
                    );
                  }
              }
            }

            if (imageData) {
              await handlePunchItemImageUpdate(newAnnotation.id, imageData);
            }
          } catch (error) {
            console.error("Error capturing demarcation image:", error);
          }
        }, 200);
      } catch (error) {
        console.error("Error creating annotation:", error);
      }
    },
    [
      currentProjectId,
      projectId,
      selectedDocument,
      punchItems.length,
      handlePunchItemCreate,
      handlePunchItemImageUpdate,
      viewport.zoom,
    ]
  );

  const handleAnnotationUpdate = useCallback(
    async (updatedAnnotation: Annotation) => {
      try {
        await api.updateAnnotation(updatedAnnotation.id, updatedAnnotation);
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === updatedAnnotation.id
              ? { ...updatedAnnotation, updatedAt: new Date() }
              : ann
          )
        );
        
        // Update corresponding punch item if it exists (without circular dependency)
        const relatedPunchItem = punchItems.find(
          (item) => item.annotationId === updatedAnnotation.id
        );
        if (relatedPunchItem) {
          // Update punch item position and page to match annotation
          const updatedPunchItem: PunchListItem = {
            ...relatedPunchItem,
            page: updatedAnnotation.page,
            position: updatedAnnotation.position,
            demarcation: getDemarcationText(updatedAnnotation),
            location: getLocationText(updatedAnnotation),
          };
          // Call API directly to avoid circular dependency
          try {
            await api.updatePunchItem(updatedPunchItem.id, updatedPunchItem);
            setPunchItems((prev) =>
              prev.map((punchItem) =>
                punchItem.id === updatedPunchItem.id
                  ? { ...updatedPunchItem, updatedAt: new Date() }
                  : punchItem
              )
            );
          } catch (error) {
            console.error("Error updating punch item from annotation update:", error);
          }
        }
      } catch (error) {
        console.error("Error updating annotation:", error);
      }
    },
    [punchItems]
  );

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    try {
      // Find and delete associated punch item first (without circular dependency)
      const relatedPunchItem = punchItems.find(
        (item) => item.annotationId === annotationId
      );
      if (relatedPunchItem) {
        console.log("Deleting associated punch item:", relatedPunchItem.id);
        // Delete punch item directly without calling handlePunchItemDelete to avoid circular dependency
        try {
          await api.deletePunchItem(relatedPunchItem.id);
          setPunchItems((prev) => prev.filter((item) => item.id !== relatedPunchItem.id));
        } catch (error) {
          console.error("Error deleting punch item:", error);
        }
      }
      
      // Delete the annotation
      await api.deleteAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((ann) => ann.id !== annotationId));
    } catch (error) {
      console.error("Error deleting annotation:", error);
    }
  }, [punchItems]);

  const handleProjectIdChange = useCallback((newProjectId: string) => {
    // Just update the projectId state - don't trigger API calls while typing
    // The projectId will be used when needed (e.g., uploads) without triggering loadProjectData
    setProjectId(newProjectId);
  }, []);

  const handleProjectNameChange = useCallback(
    async (name: string) => {
      setProjectName(name);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, { name });
        } catch (error) {
          console.error("Error updating project name:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handleCalibrationChange = useCallback(
    async (factor: number) => {
      setCalibrationFactor(factor);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, {
            calibration_factor: factor,
          });
        } catch (error) {
          console.error("Error updating calibration factor:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handleProjectLocationChange = useCallback(
    async (location: string) => {
      setProjectLocation(location);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, { location });
        } catch (error) {
          console.error("Error updating project location:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handleProjectTargetCompletionChange = useCallback(
    async (completion: string) => {
      setProjectTargetCompletion(completion);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, {
            target_completion: completion,
          });
        } catch (error) {
          console.error("Error updating target completion:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handleCompanyNameChange = useCallback(
    async (name: string) => {
      setCompanyName(name);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, { company_name: name });
        } catch (error) {
          console.error("Error updating company name:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handleProjectNotesChange = useCallback(
    async (notes: string) => {
      setProjectNotes(notes);
      if (currentProjectId) {
        try {
          await api.updateProject(currentProjectId, { project_notes: notes });
        } catch (error) {
          console.error("Error updating project notes:", error);
        }
      }
    },
    [currentProjectId]
  );

  const handlePunchItemUpdate = useCallback(async (item: PunchListItem) => {
    try {
      await api.updatePunchItem(item.id, item);
      setPunchItems((prev) =>
        prev.map((punchItem) =>
          punchItem.id === item.id
            ? { ...item, updatedAt: new Date() }
            : punchItem
        )
      );
      
      // Update corresponding annotation if it exists (without circular dependency)
      if (item.annotationId) {
        const relatedAnnotation = annotations.find(
          (ann) => ann.id === item.annotationId
        );
        if (relatedAnnotation) {
          // Update annotation position and page to match punch item
          const updatedAnnotation: Annotation = {
            ...relatedAnnotation,
            page: item.page || relatedAnnotation.page,
            position: item.position || relatedAnnotation.position,
          };
          // Call API directly to avoid circular dependency
          try {
            await api.updateAnnotation(updatedAnnotation.id, updatedAnnotation);
            setAnnotations((prev) =>
              prev.map((ann) =>
                ann.id === updatedAnnotation.id
                  ? { ...updatedAnnotation, updatedAt: new Date() }
                  : ann
              )
            );
          } catch (error) {
            console.error("Error updating annotation from punch item update:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error updating punch item:", error);
    }
  }, [annotations]);

  const handlePunchItemDelete = useCallback(async (id: string) => {
    try {
      // Find the punch item to get its annotationId
      const punchItem = punchItems.find((item) => item.id === id);
      
      // Delete the punch item
      await api.deletePunchItem(id);
      setPunchItems((prev) => prev.filter((item) => item.id !== id));
      
      // If punch item has an annotationId, delete the associated annotation
      if (punchItem?.annotationId) {
        console.log("🗑️ Deleting associated annotation:", punchItem.annotationId);
        await handleAnnotationDelete(punchItem.annotationId);
      }
    } catch (error) {
      console.error("Error deleting punch item:", error);
    }
  }, [punchItems, handleAnnotationDelete]);

  const handleUploadDocument = useCallback(() => {
    console.log("🔓 Opening upload modal...");
    setShowUploadModal(true);
  }, []);

  const handleDocumentUpload = useCallback(
    async (newDocument: PDFDocument & { base64?: string }) => {
      console.log("📤 handleDocumentUpload called", {
        documentName: newDocument.name,
        hasBase64: !!newDocument.base64,
        currentProjectId,
        projectId,
        documentSize: newDocument.size,
        isAuthenticated,
        hasUser: !!currentUser,
      });

      // Use currentProjectId if available, otherwise use projectId from Project Details input
      const projectIdToUse =
        currentProjectId ||
        (projectId && projectId.trim() !== "" ? projectId.trim() : null);

      if (!projectIdToUse) {
        console.error("❌ No project ID found, cannot upload");
        alert(
          "No project ID found. Please:\n" +
            "1. Enter a Project ID in the Project Details section (e.g., PROJ-001), OR\n" +
            "2. Logout and login again with a Project ID, OR\n" +
            "3. Contact your administrator to assign you to a project."
        );
        return;
      }

      // Update currentProjectId if we're using projectId from input
      // This is CRITICAL - without currentProjectId, annotations won't work!
      if (!currentProjectId) {
        if (projectId && projectId.trim() !== "") {
          console.log(
            "✅ Setting currentProjectId from projectId input:",
            projectId.trim()
          );
          setCurrentProjectId(projectId.trim());
        } else if (projectIdToUse) {
          // Also set it from projectIdToUse if currentProjectId is still not set
          console.log(
            "✅ Setting currentProjectId from projectIdToUse:",
            projectIdToUse
          );
          setCurrentProjectId(projectIdToUse);
        }
      }

      try {
        // Get base64 from document (added by FileUpload component)
        const base64 = newDocument.base64;

        if (!base64) {
          console.error("❌ No base64 data in document");
          alert("Error: Document data is missing. Please try uploading again.");
          return;
        }

        console.log("💾 Uploading document to database...", {
          projectId: projectIdToUse,
          name: newDocument.name,
          base64Length: base64.length,
        });

        // Upload document to server and save to database
        const result = await api.createDocument({
          projectId: projectIdToUse,
          name: newDocument.name,
          filePath: newDocument.url, // Keep original blob URL as file_path
          fileUrl: newDocument.url, // Keep for reference
          fileData: base64, // Store base64 in database
          fileSize: newDocument.size,
          pageCount: newDocument.pageCount,
        });

        console.log("✅ Document uploaded successfully:", result.document);
        console.log("📦 Server response includes:", {
          hasProjectUuid: !!result.projectUuid,
          projectUuid: result.projectUuid,
          projectId: result.projectId,
        });

        // Update currentProjectId if server returned a project UUID
        // This is CRITICAL - when user is auto-assigned to a project, we need to update currentProjectId
        // so that annotations and other operations work without requiring re-login
        if (result.projectUuid) {
          if (result.projectUuid !== currentProjectId) {
            console.log("🔄 Updating currentProjectId from server response:", {
              old: currentProjectId,
              new: result.projectUuid,
              reason:
                "User was auto-assigned to project or project was created",
            });
            setCurrentProjectId(result.projectUuid);
          }
        } else if (result.projectId && !currentProjectId) {
          // Fallback: If we got a projectId but no projectUuid, use the projectId
          // This can work because APIs accept both UUID and human-readable IDs
          console.log(
            "🔄 Setting currentProjectId from projectId (fallback):",
            result.projectId
          );
          setCurrentProjectId(result.projectId);
        }

        // Use the original blob URL from the upload - it's already valid and ready
        // We'll only convert from base64 if the original URL is not available
        let docUrl = newDocument.url; // Original blob URL from FileUpload component

        // Only convert from base64 if we don't have the original blob URL
        if (!docUrl && result.document.file_data) {
          try {
            console.log(
              "Converting base64 to blob URL for newly uploaded document:",
              result.document.name
            );
            const base64Data = result.document.file_data;

            // Handle base64 string (remove data URL prefix if present)
            const cleanBase64 = base64Data.includes(",")
              ? base64Data.split(",")[1]
              : base64Data;

            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/pdf" });
            docUrl = URL.createObjectURL(blob);
            console.log(
              "Successfully created blob URL from base64:",
              docUrl.substring(0, 50) + "..."
            );
          } catch (error) {
            console.error(
              "Error converting base64 to blob for new document:",
              error
            );
            // Fallback to file_url or file_path
            docUrl =
              result.document.file_url || result.document.file_path || "";
          }
        } else if (!docUrl && result.document.file_url) {
          docUrl = result.document.file_url;
        } else if (!docUrl && result.document.file_path) {
          docUrl = result.document.file_path;
        }

        console.log(
          "📄 Final document URL:",
          docUrl ? docUrl.substring(0, 50) + "..." : "MISSING!"
        );

        // Parse dates consistently from database
        let docCreatedAt: Date;
        let docUpdatedAt: Date;

        if (result.document.createdAt instanceof Date) {
          docCreatedAt = result.document.createdAt;
        } else if (result.document.created_at) {
          docCreatedAt = new Date(result.document.created_at);
        } else {
          docCreatedAt = new Date(); // Only use new Date() if no date exists
        }

        if (result.document.updatedAt instanceof Date) {
          docUpdatedAt = result.document.updatedAt;
        } else if (result.document.updated_at) {
          docUpdatedAt = new Date(result.document.updated_at);
        } else {
          docUpdatedAt = docCreatedAt; // Use createdAt as fallback
        }

        const doc: PDFDocument = {
          id: result.document.id,
          name: result.document.name || newDocument.name,
          url: docUrl || newDocument.url || "",
          pageCount: result.document.page_count || newDocument.pageCount || 0,
          createdAt: docCreatedAt,
          updatedAt: docUpdatedAt,
          size: result.document.file_size || newDocument.size || 0,
          status: result.document.status || "active",
        };

        if (!doc.url) {
          console.error("❌ No valid URL for uploaded document:", doc.name);
        } else {
          console.log(
            "✅ Document URL ready:",
            doc.url.substring(0, 50) + "..."
          );
        }

        setDocuments((prev) => [doc, ...prev]);
        console.log("📋 Document added to list, closing modal...");
        setShowUploadModal(false); // Close modal first

        // Ensure document has valid URL before selecting
        if (!doc.url) {
          console.error("❌ Cannot select document - no valid URL");
          alert(
            "Document uploaded but URL is missing. Please reload the page."
          );
          return;
        }

        // Set selected document immediately - don't wait
        // The PDFViewer will handle loading
        console.log("🎯 Setting selected document:", doc.name);
        console.log(
          "🎯 Document URL:",
          doc.url ? doc.url.substring(0, 50) + "..." : "MISSING!"
        );
        console.log("🎯 Document ID:", doc.id);
        console.log("🎯 Current Project ID:", currentProjectId);
        setSelectedDocument(doc);
        // Reset viewport to first page
        setViewport((prev) => ({ ...prev, page: 1 }));
      } catch (error) {
        console.error("❌ Error uploading document:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        alert(
          "Error uploading document. Please try again. Check console for details."
        );
        // Keep modal open on error so user can try again
      }
    },
    [currentProjectId, projectId]
  );

  const handleExport = useCallback(() => {
    if (!selectedDocument) return;

    const exportData = {
      document: selectedDocument,
      annotations: annotations.filter(
        (ann) => ann.documentId === selectedDocument.id
      ),
      viewport,
      project: {
        id: currentProjectId,
        name: projectName,
        calibrationFactor,
        scale: 1,
        inspectionNotes: projectNotes,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDocument.name.replace(".pdf", "")}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    selectedDocument,
    annotations,
    viewport,
    currentProjectId,
    projectName,
    calibrationFactor,
    projectNotes,
  ]);

  const handleDownload = useCallback(async () => {
    if (!selectedDocument || typeof window === "undefined" || !window.pdfjsLib) {
      console.error("Cannot download: missing document or PDF.js");
      return;
    }

    try {
      console.log("📥 Starting document download...");
      
      // Filter annotations and punch items for this document
      const docAnnotations = annotations.filter(
        (ann) => ann.documentId === selectedDocument.id
      );
      const docPunchItems = punchItems.filter(
        (item) => item.documentId === selectedDocument.id
      );

      // Calculate progress
      const totalItems = docPunchItems.length;
      const closedItems = docPunchItems.filter((item) => item.status === "Closed").length;
      const inProgressItems = docPunchItems.filter((item) => item.status === "In-Progress").length;
      const openItems = docPunchItems.filter((item) => item.status === "Open").length;
      const progressPercent = totalItems > 0 ? Math.round((closedItems / totalItems) * 100) : 0;
      const avgPercentComplete = totalItems > 0 
        ? Math.round(docPunchItems.reduce((sum, item) => sum + item.percentComplete, 0) / totalItems)
        : 0;

      // Load PDF document - handle blob URL or base64
      let pdfData: string | Uint8Array = selectedDocument.url;
      
      // If it's a blob URL, fetch it as array buffer
      if (selectedDocument.url.startsWith("blob:")) {
        try {
          const response = await fetch(selectedDocument.url);
          const arrayBuffer = await response.arrayBuffer();
          pdfData = new Uint8Array(arrayBuffer);
        } catch (fetchError) {
          console.error("Error fetching blob URL:", fetchError);
          // Fallback to URL
          pdfData = selectedDocument.url;
        }
      }
      
      const loadingTask = window.pdfjsLib.getDocument(pdfData, {
        cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      // Create jsPDF instance (A4 size)
      const pdfDoc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Add cover page with project info and progress
      pdfDoc.setFontSize(20);
      pdfDoc.text("Project Document Report", 105, 20, { align: "center" });
      
      pdfDoc.setFontSize(12);
      pdfDoc.text(`Project: ${projectName || "N/A"}`, 20, 35);
      pdfDoc.text(`Location: ${projectLocation || "N/A"}`, 20, 42);
      pdfDoc.text(`Company: ${companyName || "N/A"}`, 20, 49);
      pdfDoc.text(`Document: ${selectedDocument.name}`, 20, 56);
      pdfDoc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 63);

      // Progress section
      pdfDoc.setFontSize(14);
      pdfDoc.text("Progress Summary", 20, 75);
      pdfDoc.setFontSize(12);
      pdfDoc.text(`Total Items: ${totalItems}`, 20, 82);
      pdfDoc.text(`Open: ${openItems}`, 20, 89);
      pdfDoc.text(`In Progress: ${inProgressItems}`, 20, 96);
      pdfDoc.text(`Closed: ${closedItems}`, 20, 103);
      pdfDoc.text(`Progress: ${progressPercent}%`, 20, 110);
      pdfDoc.text(`Average Completion: ${avgPercentComplete}%`, 20, 117);

      // Render PDF pages with annotations
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (pageNum > 1) {
          pdfDoc.addPage();
        }

        try {
          // Get PDF page
          const page = await pdf.getPage(pageNum);
          
          // Get base viewport (scale 1.0) to understand actual PDF page dimensions
          const baseViewport = page.getViewport({ scale: 1.0 });
          
          // Use higher scale for better quality rendering
          const renderScale = 2.0;
          const viewport = page.getViewport({ scale: renderScale });
          
          // Create canvas for PDF page
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render PDF page
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Draw annotations on canvas
          // Annotations are stored in base scale coordinates (relative to PDF page at 100% zoom)
          // We need to scale them to match the render viewport
          const pageAnnotations = docAnnotations.filter((ann) => ann.page === pageNum);
          for (const annotation of pageAnnotations) {
            context.save();
            // Scale annotations from base scale (1.0) to render scale (2.0)
            const scale = renderScale;
            const x = annotation.position.x * scale;
            const y = annotation.position.y * scale;
            const width = (annotation.position.width || 0) * scale;
            const height = (annotation.position.height || 0) * scale;

            switch (annotation.type) {
              case "rectangle":
                context.fillStyle = "rgba(11,116,222,0.3)";
                context.strokeStyle = "#0b74de";
                context.lineWidth = 2 * scale;
                context.fillRect(x, y, width, height);
                context.strokeRect(x, y, width, height);
                break;
              case "circle":
                context.strokeStyle = "#0b74de";
                context.lineWidth = 2 * scale;
                context.beginPath();
                context.arc(x, y, width, 0, 2 * Math.PI);
                context.stroke();
                break;
              case "ellipse":
                context.strokeStyle = "#0b74de";
                context.lineWidth = 2 * scale;
                context.beginPath();
                context.ellipse(x, y, width, height, 0, 0, 2 * Math.PI);
                context.stroke();
                break;
              case "line":
              case "arrow":
              case "measurement":
              case "calibrate":
                const strokeColor = annotation.type === "measurement" ? "#ff6b00" 
                  : annotation.type === "calibrate" ? "red" : "#000";
                context.strokeStyle = strokeColor;
                context.lineWidth = 2 * scale;
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x + width, y + height);
                context.stroke();
                // Draw arrowhead for arrow
                if (annotation.type === "arrow") {
                  const angle = Math.atan2(height, width);
                  const arrowLength = 10 * scale;
                  context.beginPath();
                  context.moveTo(x + width, y + height);
                  context.lineTo(
                    x + width - arrowLength * Math.cos(angle - Math.PI / 6),
                    y + height - arrowLength * Math.sin(angle - Math.PI / 6)
                  );
                  context.moveTo(x + width, y + height);
                  context.lineTo(
                    x + width - arrowLength * Math.cos(angle + Math.PI / 6),
                    y + height - arrowLength * Math.sin(angle + Math.PI / 6)
                  );
                  context.stroke();
                }
                break;
              case "polyline":
                if (annotation.position.points && Array.isArray(annotation.position.points)) {
                  context.strokeStyle = "#0b74de";
                  context.lineWidth = 2 * scale;
                  context.beginPath();
                  annotation.position.points.forEach((point: { x: number; y: number }, index: number) => {
                    const px = point.x * scale;
                    const py = point.y * scale;
                    if (index === 0) {
                      context.moveTo(px, py);
                    } else {
                      context.lineTo(px, py);
                    }
                  });
                  context.stroke();
                }
                break;
              case "arc":
                if (annotation.position.points && annotation.position.points.length >= 3) {
                  context.strokeStyle = "#0b74de";
                  context.lineWidth = 2 * scale;
                  const [start, center, end] = annotation.position.points;
                  const scaledStart = { x: start.x * scale, y: start.y * scale };
                  const scaledCenter = { x: center.x * scale, y: center.y * scale };
                  const scaledEnd = { x: end.x * scale, y: end.y * scale };
                  const startAngle = Math.atan2(scaledStart.y - scaledCenter.y, scaledStart.x - scaledCenter.x);
                  const endAngle = Math.atan2(scaledEnd.y - scaledCenter.y, scaledEnd.x - scaledCenter.x);
                  const radius = Math.sqrt(
                    Math.pow(scaledStart.x - scaledCenter.x, 2) + Math.pow(scaledStart.y - scaledCenter.y, 2)
                  );
                  context.beginPath();
                  context.arc(scaledCenter.x, scaledCenter.y, radius, startAngle, endAngle);
                  context.stroke();
                }
                break;
              case "cloud":
              case "freehand":
                if (annotation.position.pathData) {
                  // Parse and scale path data
                  const pathCommands = annotation.position.pathData.split(/(?=[ML])/);
                  context.strokeStyle = annotation.type === "cloud" ? "#00CCCC" : "#000";
                  context.lineWidth = 2 * scale;
                  context.beginPath();
                  pathCommands.forEach((cmd: string) => {
                    if (cmd.startsWith("M") || cmd.startsWith("L")) {
                      const coords = cmd.substring(1).trim().split(/\s+/).map(Number);
                      if (coords.length >= 2) {
                        const px = coords[0] * scale;
                        const py = coords[1] * scale;
                        if (cmd.startsWith("M")) {
                          context.moveTo(px, py);
                        } else {
                          context.lineTo(px, py);
                        }
                      }
                    }
                  });
                  context.stroke();
                  if (annotation.type === "cloud") {
                    context.fillStyle = "rgba(0,204,204,0.3)";
                    context.fill();
                  }
                }
                break;
              case "sticky-note":
                context.fillStyle = "#FFA500";
                context.strokeStyle = "#000";
                context.lineWidth = 1 * scale;
                context.fillRect(x, y, width, height);
                context.strokeRect(x, y, width, height);
                if (annotation.content) {
                  context.fillStyle = "#000";
                  context.font = `${12 * scale}px Arial`;
                  context.fillText(annotation.content, x + 5 * scale, y + 15 * scale);
                }
                break;
            }
            context.restore();
          }

          // Convert canvas to image and add to PDF
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 190; // A4 width minus margins
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdfDoc.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
        } catch (pageError) {
          console.error(`Error rendering page ${pageNum}:`, pageError);
        }
      }

      // Add punch list table
      if (docPunchItems.length > 0) {
        pdfDoc.addPage();
        pdfDoc.setFontSize(16);
        pdfDoc.text("Punch List", 105, 20, { align: "center" });

        // Table headers
        pdfDoc.setFontSize(10);
        let yPos = 35;
        const colWidths = [15, 30, 50, 30, 30, 25, 30];
        const headers = ["ID", "Description", "Location", "Status", "Progress", "Page", "Assigned"];
        
        pdfDoc.setFillColor(200, 200, 200);
        pdfDoc.rect(10, yPos - 5, 190, 8, "F");
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFont("helvetica", "bold");
        
        let xPos = 10;
        headers.forEach((header, index) => {
          pdfDoc.text(header, xPos + 2, yPos, { maxWidth: colWidths[index] - 4 });
          xPos += colWidths[index];
        });

        // Table rows
        pdfDoc.setFont("helvetica", "normal");
        yPos = 45;
        docPunchItems.forEach((item, index) => {
          if (yPos > 270) {
            // New page if needed
            pdfDoc.addPage();
            yPos = 20;
            // Redraw headers
            pdfDoc.setFillColor(200, 200, 200);
            pdfDoc.rect(10, yPos - 5, 190, 8, "F");
            pdfDoc.setFont("helvetica", "bold");
            xPos = 10;
            headers.forEach((header, idx) => {
              pdfDoc.text(header, xPos + 2, yPos, { maxWidth: colWidths[idx] - 4 });
              xPos += colWidths[idx];
            });
            pdfDoc.setFont("helvetica", "normal");
            yPos = 30;
          }

          xPos = 10;
          pdfDoc.text(item.demarcationId || String(index + 1), xPos + 2, yPos, { maxWidth: colWidths[0] - 4 });
          xPos += colWidths[0];
          
          pdfDoc.text(item.description || "N/A", xPos + 2, yPos, { maxWidth: colWidths[1] - 4 });
          xPos += colWidths[1];
          
          pdfDoc.text(item.location || "N/A", xPos + 2, yPos, { maxWidth: colWidths[2] - 4 });
          xPos += colWidths[2];
          
          pdfDoc.text(item.status || "Open", xPos + 2, yPos, { maxWidth: colWidths[3] - 4 });
          xPos += colWidths[3];
          
          pdfDoc.text(`${item.percentComplete}%`, xPos + 2, yPos, { maxWidth: colWidths[4] - 4 });
          xPos += colWidths[4];
          
          pdfDoc.text(item.page?.toString() || "N/A", xPos + 2, yPos, { maxWidth: colWidths[5] - 4 });
          xPos += colWidths[5];
          
          pdfDoc.text(item.assignedTo || "N/A", xPos + 2, yPos, { maxWidth: colWidths[6] - 4 });
          
          yPos += 8;
        });
      }

      // Save PDF
      const fileName = `${selectedDocument.name.replace(".pdf", "")}_with_annotations.pdf`;
      pdfDoc.save(fileName);
      console.log("✅ Document downloaded successfully");
    } catch (error) {
      console.error("❌ Error downloading document:", error);
      alert("Error downloading document. Please try again.");
    }
  }, [
    selectedDocument,
    annotations,
    punchItems,
    projectName,
    projectLocation,
    companyName,
  ]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target?.result as string);
          console.log("Imported project data:", importData);

          if (importData.annotations) {
            setAnnotations((prev) => [...prev, ...importData.annotations]);
          }

          if (importData.viewport) {
            setViewport(importData.viewport);
          }

          alert("Project data imported successfully!");
        } catch (error) {
          console.error("Failed to import project data:", error);
          alert("Failed to import project data. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // Use NextAuth signOut to properly clear session
      await signOut({ redirect: false });
      console.log("✅ Logout successful");

      // Clear all state
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentProjectId(undefined);
      setDocuments([]);
      setSelectedDocument(null);
      setAnnotations([]);
      setPunchItems([]);
      setProjectId("");
      setProjectName("");
      setProjectLocation("");
      setProjectTargetCompletion("");
      setCompanyName("");
      setCalibrationFactor(1.0);
      setProjectNotes("");
    } catch (error) {
      console.error("❌ Logout error:", error);
      // Still clear state even if API call fails
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentProjectId(undefined);
      setDocuments([]);
      setSelectedDocument(null);
      setAnnotations([]);
      setPunchItems([]);
    }
  }, [signOut]);

  if (!isAuthenticated) {
    return (
      <div suppressHydrationWarning>
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col bg-background"
      suppressHydrationWarning
    >
      <Toolbar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onUpload={handleUploadDocument}
        onDownload={handleDownload}
        onExport={handleExport}
        onImport={handleImport}
        onLogout={handleLogout}
        zoom={viewport.zoom}
      />

      <div className="flex-1 flex overflow-hidden">
        <ProjectLeftPanel
          documents={documents}
          selectedDocument={selectedDocument}
          onDocumentSelect={handleDocumentSelect}
          onUploadDocument={handleUploadDocument}
          projectId={projectId}
          onProjectIdChange={handleProjectIdChange}
          projectName={projectName}
          onProjectNameChange={handleProjectNameChange}
          projectLocation={projectLocation}
          onProjectLocationChange={handleProjectLocationChange}
          projectTargetCompletion={projectTargetCompletion}
          onProjectTargetCompletionChange={handleProjectTargetCompletionChange}
          companyName={companyName}
          onCompanyNameChange={handleCompanyNameChange}
          calibrationFactor={calibrationFactor}
          onCalibrationChange={handleCalibrationChange}
          currentUser={currentUser}
        />

        <div className="flex-1 flex">
          {selectedDocument ? (
            <>
              {selectedDocument.url ? (
                <PDFViewer
                  documentUrl={selectedDocument.url}
                  documentId={selectedDocument.id}
                  annotations={annotations.filter(
                    (ann) => ann.documentId === selectedDocument.id
                  )}
                  currentUser={currentUser!}
                  activeTool={activeTool}
                  viewport={viewport}
                  onViewportChange={setViewport}
                  onAnnotationCreate={handleAnnotationCreate}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  onAnnotationDelete={handleAnnotationDelete}
                  onPunchItemImageUpdate={handlePunchItemImageUpdate}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectedAnnotationIdChange={setSelectedAnnotationId}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <p className="text-destructive mb-2">
                      Error: Document URL is missing
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Please re-upload the document or check the database.
                    </p>
                  </div>
                </div>
              )}

              <AnnotationPanel
                annotations={annotations.filter(
                  (ann) => ann.documentId === selectedDocument.id
                )}
                onAnnotationSelect={(annotation) => {
                  setViewport((prev) => ({ ...prev, page: annotation.page }));
                }}
                onAnnotationDelete={handleAnnotationDelete}
                onAnnotationUpdate={handleAnnotationUpdate}
                projectId={projectId}
                onProjectIdChange={handleProjectIdChange}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-4">
                  Welcome to Markup Inspection Tool
                </h2>
                <p className="text-muted-foreground mb-6">
                  Select a document from the sidebar to get started with PDF
                  annotation and collaboration.
                </p>
                <button
                  onClick={handleUploadDocument}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Upload Your First Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="status-bar">
        <span>Ready</span>
        <span>
          {selectedDocument
            ? `${selectedDocument.name} - Page ${viewport.page}`
            : "No document selected"}
        </span>
      </div>

      {showUploadModal && (
        <FileUpload
          onDocumentUpload={handleDocumentUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      <PunchListPanel
        punchItems={punchItems}
        onPunchItemCreate={handlePunchItemCreate}
        onPunchItemUpdate={handlePunchItemUpdate}
        onPunchItemDelete={handlePunchItemDelete}
        onDemarcationClick={(item) => {
          // Navigate to annotation if it has an annotationId
          if (item.annotationId) {
            setSelectedAnnotationId(item.annotationId);
            // Find the annotation
            const annotation = annotations.find((ann) => ann.id === item.annotationId);
            if (annotation) {
              // Navigate to the page
              setViewport((prev) => ({ ...prev, page: annotation.page }));
            }
          } else if (item.page) {
            // If no annotationId, just navigate to the page
            setViewport((prev) => ({ ...prev, page: item.page! }));
          }
        }}
      />
    </div>
  );
}
