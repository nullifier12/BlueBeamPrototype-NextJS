"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Annotation, AnnotationType, Viewport, User } from "@/types";

import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

interface PDFViewerProps {
  documentUrl: string;
  documentId: string;
  annotations: Annotation[];
  currentUser: User;
  activeTool: AnnotationType | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  onAnnotationCreate: (
    annotation: Omit<Annotation, "id" | "createdAt" | "updatedAt">
  ) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onPunchItemImageUpdate?: (annotationId: string, imageData: string) => void;
  selectedAnnotationId?: string | null;
  onSelectedAnnotationIdChange?: (id: string | null) => void;
}

export default function PDFViewer({
  documentUrl,
  documentId,
  annotations,
  currentUser,
  activeTool,
  viewport,
  onViewportChange,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  onPunchItemImageUpdate,
  selectedAnnotationId,
  onSelectedAnnotationIdChange,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Arc drawing state
  const [arcStartPoint, setArcStartPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [arcCenter, setArcCenter] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isDrawingArc, setIsDrawingArc] = useState(false);
  const [arcPhase, setArcPhase] = useState<"start" | "center" | "end">("start");
  const [isPointerDown, setIsPointerDown] = useState(false);
  // Freehand drawing state
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  
  // Handle external annotation selection (from punch list)
  useEffect(() => {
    if (selectedAnnotationId) {
      const annotation = annotations.find((ann) => ann.id === selectedAnnotationId);
      if (annotation) {
        setSelectedAnnotation(annotation);
        // Start blinking animation
        setIsBlinking(true);
        // Stop blinking after 2 seconds
        const blinkTimeout = setTimeout(() => {
          setIsBlinking(false);
        }, 2000);
        
        // Navigate to the annotation's page
        if (annotation.page !== viewport.page) {
          onViewportChange({ ...viewport, page: annotation.page });
        }
        // Scroll to annotation position after a short delay to allow page to render
        setTimeout(() => {
          if (containerRef.current && annotation.position) {
            const scale = viewport.zoom;
            const x = annotation.position.x * scale;
            const y = annotation.position.y * scale;
            // Scroll to annotation position
            containerRef.current.scrollLeft = x - containerRef.current.clientWidth / 2;
            containerRef.current.scrollTop = y - containerRef.current.clientHeight / 2;
          }
        }, 300);
        
        return () => {
          clearTimeout(blinkTimeout);
        };
      }
    } else {
      setSelectedAnnotation(null);
      setIsBlinking(false);
    }
  }, [selectedAnnotationId, annotations, viewport, onViewportChange]);
  
  // Clear selected annotation when page changes manually (not from navigation)
  const prevPageRef = useRef(viewport.page);
  const prevSelectedAnnotationIdRef = useRef(selectedAnnotationId);
  useEffect(() => {
    // Track if selectedAnnotationId changed (user clicked demarcation)
    const annotationIdChanged = prevSelectedAnnotationIdRef.current !== selectedAnnotationId;
    prevSelectedAnnotationIdRef.current = selectedAnnotationId;
    
    // If page changed manually (not from annotation navigation) and there's a selected annotation
    if (prevPageRef.current !== viewport.page && selectedAnnotation && !annotationIdChanged) {
      // If the selected annotation is not on the current page, clear selection
      if (selectedAnnotation.page !== viewport.page) {
        setSelectedAnnotation(null);
        setIsBlinking(false);
        // Clear selectedAnnotationId in parent component
        if (onSelectedAnnotationIdChange) {
          onSelectedAnnotationIdChange(null);
        }
      }
    }
    prevPageRef.current = viewport.page;
  }, [viewport.page, selectedAnnotation, selectedAnnotationId, onSelectedAnnotationIdChange]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [originalAnnotationPos, setOriginalAnnotationPos] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartCurrentRef = useRef<{ x: number; y: number } | null>(null);
  // Local state for dragged annotation (for visual feedback only, no API call)
  const [localDraggedAnnotation, setLocalDraggedAnnotation] = useState<Annotation | null>(null);
  // Store original arc points when dragging starts
  const originalArcPointsRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const [pdfDoc, setPdfDoc] = useState<
    typeof window.pdfjsLib.PDFDocumentProxy | null
  >(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderOperationRef = useRef<
    typeof window.pdfjsLib.PDFRenderTask | null
  >(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Helper to zoom in centered on a clicked area
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement | SVGSVGElement, MouseEvent>) => {
      console.log("🎯 DOUBLE-CLICK EVENT TRIGGERED!", e.target);

      if (!canvasRef.current || !pdfDoc) {
        console.log(
          "❌ Missing requirements - canvas:",
          !!canvasRef.current,
          "pdfDoc:",
          !!pdfDoc
        );
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Get the canvas and container rectangles
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!containerRect) {
        console.log("❌ Container rect not available");
        return;
      }

      // Get click position relative to canvas
      const clickX = e.clientX - canvasRect.left;
      const clickY = e.clientY - canvasRect.top;

      // Get current scroll position
      const currentScrollLeft = containerRef.current?.scrollLeft || 0;
      const currentScrollTop = containerRef.current?.scrollTop || 0;

      // Get the PDF container position
      const pdfContainer = document.getElementById("pdfContainer");
      const pdfContainerRect = pdfContainer?.getBoundingClientRect();

      console.log("📍 Raw click position:", { x: clickX, y: clickY });
      console.log("📍 Current scroll:", {
        scrollLeft: currentScrollLeft,
        scrollTop: currentScrollTop,
      });
      console.log("📍 Canvas rect:", {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
      console.log("📍 Container rect:", {
        left: containerRect.left,
        top: containerRect.top,
        width: containerRect.width,
        height: containerRect.height,
      });
      console.log("📍 PDF Container rect:", pdfContainerRect);
      console.log("📍 Current zoom:", viewport.zoom);

      // Calculate the absolute position on the canvas accounting for scroll
      const absoluteClickX = clickX + currentScrollLeft;
      const absoluteClickY = clickY + currentScrollTop;

      console.log("📍 Absolute click position:", {
        x: absoluteClickX,
        y: absoluteClickY,
      });

      // Calculate new zoom
      let newZoom;
      if (viewport.zoom >= 4) {
        newZoom = 1;
        console.log("🔄 Zooming OUT to 100%");
      } else {
        newZoom = Math.min(viewport.zoom * 2, 4);
        console.log("🔍 Zooming IN to:", newZoom);
      }

      // Calculate how much the canvas will grow with the new zoom
      const zoomRatio = newZoom / viewport.zoom;
      const newCanvasWidth = canvasRect.width * zoomRatio;
      const newCanvasHeight = canvasRect.height * zoomRatio;

      console.log("📐 Zoom calculations:", {
        zoomRatio,
        newCanvasWidth,
        newCanvasHeight,
        oldCanvasWidth: canvasRect.width,
        oldCanvasHeight: canvasRect.height,
      });

      // Calculate scroll position to center the clicked area
      let scrollX = 0;
      let scrollY = 0;

      if (newZoom > viewport.zoom) {
        // Zooming in - center on clicked area
        // Calculate the new position of the clicked point after zoom
        const newClickX = absoluteClickX * zoomRatio;
        const newClickY = absoluteClickY * zoomRatio;

        // Calculate scroll position to center the clicked point in the viewport
        scrollX = Math.max(0, newClickX - containerRect.width / 2);
        scrollY = Math.max(0, newClickY - containerRect.height / 2);

        console.log("🎯 Centering calculations:", {
          absoluteClickX,
          absoluteClickY,
          zoomRatio,
          newClickX,
          newClickY,
          containerWidth: containerRect.width,
          containerHeight: containerRect.height,
          scrollX,
          scrollY,
        });
      } else {
        // Zooming out - center the content
        scrollX = Math.max(0, (newCanvasWidth - containerRect.width) / 2);
        scrollY = Math.max(0, (newCanvasHeight - containerRect.height) / 2);
        console.log("🔄 Centering content:", { scrollX, scrollY });
      }

      // Update viewport with new zoom
      onViewportChange({
        ...viewport,
        zoom: newZoom,
      });

      // Scroll to center the clicked area after a delay to allow rendering
      setTimeout(() => {
        if (containerRef.current) {
          console.log("📍 Setting scroll position:", { scrollX, scrollY });
          containerRef.current.scrollLeft = scrollX;
          containerRef.current.scrollTop = scrollY;

          // Log actual scroll position after setting
          setTimeout(() => {
            console.log("📍 Actual scroll position:", {
              scrollLeft: containerRef.current?.scrollLeft,
              scrollTop: containerRef.current?.scrollTop,
            });
          }, 50);
        }
      }, 150);

      // Add a temporary visual indicator to show where the click was detected
      if (svgOverlayRef.current) {
        const indicator = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        indicator.setAttribute("cx", absoluteClickX.toString());
        indicator.setAttribute("cy", absoluteClickY.toString());
        indicator.setAttribute("r", "5");
        indicator.setAttribute("fill", "red");
        indicator.setAttribute("stroke", "white");
        indicator.setAttribute("stroke-width", "2");
        indicator.setAttribute("opacity", "0.8");
        svgOverlayRef.current.appendChild(indicator);

        // Remove the indicator after 2 seconds
        setTimeout(() => {
          if (svgOverlayRef.current && indicator.parentNode) {
            svgOverlayRef.current.removeChild(indicator);
          }
        }, 2000);
      }

      console.log("✅ Zoom changed from", viewport.zoom, "to", newZoom);
    },
    [viewport, onViewportChange, pdfDoc]
  );

  // Set up PDF.js worker dynamically to avoid SSR issues
  useEffect(() => {
    const setupPDFWorker = () => {
      if (!window.pdfjsLib) {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          console.log("PDF.js loaded successfully");
        };
        script.onerror = () => {
          console.warn(
            "Failed to load PDF.js from CDN. PDF functionality will be limited."
          );
        };
        document.head.appendChild(script);
      } else {
        console.log("PDF.js already loaded");
      }
    };

    setupPDFWorker();
  }, []);
  
  // Helper function to generate cloud path (series of arcs)
  const generateCloudPath = useCallback((x: number, y: number, width: number, height: number, scale: number): string => {
    if (width < 10 || height < 10) {
      // If too small, just return a simple arc
      return `M ${x} ${y} A 5 5 0 1 1 ${x + 10} ${y}`;
    }
    
    const arcSize = Math.min(width, height) * 0.15; // Arc size proportional to shape
    const numArcs = 8; // Number of arcs around the rectangle
    
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const halfW = width / 2;
    const halfH = height / 2;
    
    let path = "";
    const points: { x: number; y: number }[] = [];
    
    // Generate points around the rectangle
    for (let i = 0; i < numArcs; i++) {
      const angle = (i / numArcs) * Math.PI * 2;
      const offsetX = Math.cos(angle) * halfW;
      const offsetY = Math.sin(angle) * halfH;
      points.push({
        x: centerX + offsetX,
        y: centerY + offsetY,
      });
    }
    
    // Create path with arcs connecting the points
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      
      if (i === 0) {
        path += `M ${current.x} ${current.y} `;
      }
      
      // Create arc to next point
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      const dist = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
      const arcRadius = Math.min(arcSize, dist / 2);
      
      path += `A ${arcRadius} ${arcRadius} 0 0 1 ${next.x} ${next.y} `;
    }
    
    path += "Z"; // Close the path
    return path;
  }, []);
  
  const createAnnotationElement = useCallback(
    (annotation: Annotation): SVGElement | null => {
      const svgNS = "http://www.w3.org/2000/svg";

      // Scale coordinates from base scale (1:1) to current zoom level for rendering
      const scale = viewport.zoom;
      const x = annotation.position.x * scale;
      const y = annotation.position.y * scale;
      const width = (annotation.position.width || 0) * scale;
      const height = (annotation.position.height || 0) * scale;
      
      // Check if this annotation should be blinking
      const shouldBlink = isBlinking && selectedAnnotation?.id === annotation.id;

      // Debug logging for line annotations
      if (annotation.type === "line") {
        console.log("🔧 Line annotation scaling:", {
          annotationId: annotation.id,
          originalPosition: annotation.position,
          currentZoom: viewport.zoom,
          scaledCoords: { x, y, width, height },
        });
      }

      switch (annotation.type) {
        case "rectangle":
          const rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", x.toString());
          rect.setAttribute("y", y.toString());
          rect.setAttribute("width", width.toString());
          rect.setAttribute("height", height.toString());
          rect.setAttribute("fill", "rgba(11,116,222,0.3)");
          rect.setAttribute("stroke", "#0b74de");
          rect.setAttribute("stroke-width", "1");
          return rect;

        case "circle":
          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttribute("cx", x.toString());
          circle.setAttribute("cy", y.toString());
          circle.setAttribute("r", width.toString());
          if (shouldBlink) {
            circle.setAttribute("stroke", "#ff0000");
            circle.setAttribute("stroke-width", "4");
            circle.setAttribute("opacity", "1");
            circle.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            circle.setAttribute("stroke", "#0b74de");
            circle.setAttribute("stroke-width", "2");
          }
          circle.setAttribute("fill", "none");
          return circle;

        case "ellipse":
          const ellipse = document.createElementNS(svgNS, "ellipse");
          ellipse.setAttribute("cx", x.toString());
          ellipse.setAttribute("cy", y.toString());
          ellipse.setAttribute("rx", width.toString());
          ellipse.setAttribute("ry", height.toString());
          if (shouldBlink) {
            ellipse.setAttribute("stroke", "#ff0000");
            ellipse.setAttribute("stroke-width", "4");
            ellipse.setAttribute("opacity", "1");
            ellipse.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            ellipse.setAttribute("stroke", "#0b74de");
            ellipse.setAttribute("stroke-width", "2");
          }
          ellipse.setAttribute("fill", "none");
          return ellipse;

        case "line":
        case "measurement":
        case "calibrate":
          const strokeColor =
            annotation.type === "measurement"
              ? "#ff6b00"
              : annotation.type === "calibrate"
              ? "red"
              : "#000";
          const line = document.createElementNS(svgNS, "line");

          // Scale the end coordinates properly
          const x2 =
            (annotation.position.width || annotation.position.x) * scale;
          const y2 =
            (annotation.position.height || annotation.position.y) * scale;

          line.setAttribute("x1", x.toString());
          line.setAttribute("y1", y.toString());
          line.setAttribute("x2", x2.toString());
          line.setAttribute("y2", y2.toString());
          if (shouldBlink) {
            line.setAttribute("stroke", "#ff0000");
            line.setAttribute("stroke-width", "4");
            line.setAttribute("opacity", "1");
            line.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            line.setAttribute("stroke", strokeColor);
            line.setAttribute("stroke-width", "2");
          }
          return line;

        case "arrow":
          // Create arrow as a group (line + arrowhead)
          const arrowGroup = document.createElementNS(svgNS, "g");
          
          // Scale the end coordinates properly
          const arrowX2 = (annotation.position.width || annotation.position.x) * scale;
          const arrowY2 = (annotation.position.height || annotation.position.y) * scale;
          
          // Draw the line
          const arrowLine = document.createElementNS(svgNS, "line");
          arrowLine.setAttribute("x1", x.toString());
          arrowLine.setAttribute("y1", y.toString());
          arrowLine.setAttribute("x2", arrowX2.toString());
          arrowLine.setAttribute("y2", arrowY2.toString());
          if (shouldBlink) {
            arrowLine.setAttribute("stroke", "#ff0000");
            arrowLine.setAttribute("stroke-width", "4");
            arrowLine.setAttribute("opacity", "1");
            arrowLine.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            arrowLine.setAttribute("stroke", "#000");
            arrowLine.setAttribute("stroke-width", "2");
          }
          arrowGroup.appendChild(arrowLine);
          
          // Calculate arrowhead direction and size
          const dx = arrowX2 - x;
          const dy = arrowY2 - y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            const arrowheadSize = 10 * scale;
            const angle = Math.atan2(dy, dx);
            
            // Arrowhead points (triangle pointing in direction of line)
            const arrowheadX1 = arrowX2 - arrowheadSize * Math.cos(angle - Math.PI / 6);
            const arrowheadY1 = arrowY2 - arrowheadSize * Math.sin(angle - Math.PI / 6);
            const arrowheadX2 = arrowX2 - arrowheadSize * Math.cos(angle + Math.PI / 6);
            const arrowheadY2 = arrowY2 - arrowheadSize * Math.sin(angle + Math.PI / 6);
            
            // Create arrowhead as polygon
            const arrowhead = document.createElementNS(svgNS, "polygon");
            const arrowheadPoints = `${arrowX2},${arrowY2} ${arrowheadX1},${arrowheadY1} ${arrowheadX2},${arrowheadY2}`;
            arrowhead.setAttribute("points", arrowheadPoints);
            if (shouldBlink) {
              arrowhead.setAttribute("fill", "#ff0000");
              arrowhead.setAttribute("opacity", "1");
              arrowhead.style.animation = "blink 0.5s ease-in-out infinite";
            } else {
              arrowhead.setAttribute("fill", "#000");
            }
            arrowhead.setAttribute("stroke", "none");
            arrowGroup.appendChild(arrowhead);
          }
          
          return arrowGroup;

        case "freehand":
          // Render freehand path
          if (annotation.position.pathData) {
            const freehandPath = document.createElementNS(svgNS, "path");
            // Scale the path data points
            const scaledPathData = annotation.position.pathData
              .replace(/([ML])\s+([\d.-]+)\s+([\d.-]+)/g, (match, cmd, x, y) => {
                const scaledX = parseFloat(x) / scale * viewport.zoom;
                const scaledY = parseFloat(y) / scale * viewport.zoom;
                return `${cmd} ${scaledX} ${scaledY}`;
              });
            freehandPath.setAttribute("d", scaledPathData);
            if (shouldBlink) {
              freehandPath.setAttribute("stroke", "#ff0000");
              freehandPath.setAttribute("stroke-width", "4");
              freehandPath.setAttribute("opacity", "1");
              freehandPath.style.animation = "blink 0.5s ease-in-out infinite";
            } else {
              freehandPath.setAttribute("stroke", "#000");
              freehandPath.setAttribute("stroke-width", "2");
            }
            freehandPath.setAttribute("fill", "none");
            freehandPath.setAttribute("stroke-linecap", "round");
            freehandPath.setAttribute("stroke-linejoin", "round");
            return freehandPath;
          } else if (annotation.position.points && Array.isArray(annotation.position.points)) {
            // Fallback: generate path from points
            const points = annotation.position.points;
            const pathData = points
              .map((point: { x: number; y: number }, index: number) => {
                const scaledX = point.x * scale;
                const scaledY = point.y * scale;
                return index === 0 ? `M ${scaledX} ${scaledY}` : `L ${scaledX} ${scaledY}`;
              })
              .join(" ");
            const freehandPath = document.createElementNS(svgNS, "path");
            freehandPath.setAttribute("d", pathData);
            if (shouldBlink) {
              freehandPath.setAttribute("stroke", "#ff0000");
              freehandPath.setAttribute("stroke-width", "4");
              freehandPath.setAttribute("opacity", "1");
              freehandPath.style.animation = "blink 0.5s ease-in-out infinite";
            } else {
              freehandPath.setAttribute("stroke", "#000");
              freehandPath.setAttribute("stroke-width", "2");
            }
            freehandPath.setAttribute("fill", "none");
            freehandPath.setAttribute("stroke-linecap", "round");
            freehandPath.setAttribute("stroke-linejoin", "round");
            return freehandPath;
          }
          return null;

        case "text":
          const text = document.createElementNS(svgNS, "text");
          text.setAttribute("x", x.toString());
          text.setAttribute("y", y.toString());
          text.setAttribute("fill", "#000");
          text.setAttribute("font-size", (12 * scale).toString());
          text.setAttribute("font-family", "Arial");
          text.textContent = annotation.content || "Text";
          return text;

        case "sticky-note":
          // Create sticky note as a rectangle with text
          const stickyNote = document.createElementNS(svgNS, "g");
          
          // Background rectangle (yellow/orange sticky note)
          const stickyRect = document.createElementNS(svgNS, "rect");
          const stickyWidth = width && width > 0 ? width : 100 * scale;
          const stickyHeight = height && height > 0 ? height : 80 * scale;
          stickyRect.setAttribute("x", x.toString());
          stickyRect.setAttribute("y", y.toString());
          stickyRect.setAttribute("width", stickyWidth.toString());
          stickyRect.setAttribute("height", stickyHeight.toString());
          stickyRect.setAttribute("fill", "#FFA500");
          stickyRect.setAttribute("stroke", "#000");
          stickyRect.setAttribute("stroke-width", "1");
          stickyRect.setAttribute("opacity", "0.9");
          stickyNote.appendChild(stickyRect);
          
          // Text content
          const stickyText = document.createElementNS(svgNS, "text");
          stickyText.setAttribute("x", (x + 5 * scale).toString());
          stickyText.setAttribute("y", (y + 15 * scale).toString());
          stickyText.setAttribute("fill", "#000");
          stickyText.setAttribute("font-size", (10 * scale).toString());
          stickyText.setAttribute("font-family", "Arial");
          stickyText.setAttribute("font-weight", "normal");
          // Wrap text if needed
          const content = annotation.content || "Sticky Note";
          const maxChars = Math.floor((stickyWidth - 10 * scale) / (6 * scale));
          stickyText.textContent = content.length > maxChars ? content.substring(0, maxChars) + "..." : content;
          stickyNote.appendChild(stickyText);
          
          return stickyNote;

        case "highlight":
          const highlight = document.createElementNS(svgNS, "rect");
          highlight.setAttribute("x", x.toString());
          highlight.setAttribute("y", y.toString());
          highlight.setAttribute("width", width.toString());
          highlight.setAttribute("height", height.toString());
          highlight.setAttribute("fill", "rgba(255, 255, 0, 0.3)");
          highlight.setAttribute("stroke", "none");
          return highlight;

        case "cloud":
          // Create cloud shape using path with arcs
          const cloudPath = generateCloudPath(x, y, width, height, scale);
          const cloud = document.createElementNS(svgNS, "path");
          cloud.setAttribute("d", cloudPath);
          if (shouldBlink) {
            cloud.setAttribute("stroke", "#ff0000");
            cloud.setAttribute("stroke-width", "4");
            cloud.setAttribute("opacity", "1");
            cloud.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            cloud.setAttribute("fill", "rgba(0,204,204,0.3)");
            cloud.setAttribute("stroke", "#00CCCC");
            cloud.setAttribute("stroke-width", "2");
          }
          return cloud;

        case "arc":
          // Arc annotations (from my-app implementation)
          console.log("🎨 Rendering arc annotation:", annotation);
          const path = document.createElementNS(svgNS, "path");
          if (
            annotation.position.points &&
            annotation.position.points.length >= 3
          ) {
            const [startPoint, center, endPoint] = annotation.position.points;
            console.log("🎨 Arc points:", {
              startPoint,
              center,
              endPoint,
              scale,
            });

            // Scale coordinates for current zoom
            const scaledStart = {
              x: startPoint.x * scale,
              y: startPoint.y * scale,
            };
            const scaledCenter = {
              x: center.x * scale,
              y: center.y * scale,
            };
            const scaledEnd = {
              x: endPoint.x * scale,
              y: endPoint.y * scale,
            };

            // Calculate radius from center to start point
            const radius = Math.sqrt(
              Math.pow(scaledCenter.x - scaledStart.x, 2) +
                Math.pow(scaledCenter.y - scaledStart.y, 2)
            );

            const startAngle = Math.atan2(
              scaledStart.y - scaledCenter.y,
              scaledStart.x - scaledCenter.x
            );
            const endAngle = Math.atan2(
              scaledEnd.y - scaledCenter.y,
              scaledEnd.x - scaledCenter.x
            );

            let angleDiff = endAngle - startAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
            const sweepFlag = angleDiff > 0 ? 1 : 0;

            const arcPath = `M ${scaledStart.x} ${scaledStart.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${scaledEnd.x} ${scaledEnd.y}`;
            console.log("🎨 Arc path:", arcPath);
            path.setAttribute("d", arcPath);
          } else {
            // Fallback for old arc annotations
            console.log("🎨 Using fallback arc path");
            const arcPath = `M ${x} ${y} A ${width} ${height} 0 0 1 ${
              x + width
            } ${y + height}`;
            path.setAttribute("d", arcPath);
          }
          if (shouldBlink) {
            path.setAttribute("stroke", "#ff0000");
            path.setAttribute("stroke-width", "4");
            path.setAttribute("opacity", "1");
            path.style.animation = "blink 0.5s ease-in-out infinite";
          } else {
            path.setAttribute("stroke", "#0b74de");
            path.setAttribute("stroke-width", "2");
          }
          path.setAttribute("fill", "none");
          console.log("🎨 Arc path element created:", path);
          return path;

        case "freehand":
          // Render freehand path
          if (annotation.position.pathData) {
            const freehandPath = document.createElementNS(svgNS, "path");
            // Scale the path data points to current zoom
            const scaledPathData = annotation.position.pathData
              .replace(/([ML])\s+([\d.-]+)\s+([\d.-]+)/g, (match, cmd, x, y) => {
                const scaledX = parseFloat(x) * scale;
                const scaledY = parseFloat(y) * scale;
                return `${cmd} ${scaledX} ${scaledY}`;
              });
            freehandPath.setAttribute("d", scaledPathData);
            if (shouldBlink) {
              freehandPath.setAttribute("stroke", "#ff0000");
              freehandPath.setAttribute("stroke-width", "4");
              freehandPath.setAttribute("opacity", "1");
              freehandPath.style.animation = "blink 0.5s ease-in-out infinite";
            } else {
              freehandPath.setAttribute("stroke", "#000");
              freehandPath.setAttribute("stroke-width", "2");
            }
            freehandPath.setAttribute("fill", "none");
            freehandPath.setAttribute("stroke-linecap", "round");
            freehandPath.setAttribute("stroke-linejoin", "round");
            return freehandPath;
          } else if (annotation.position.points && Array.isArray(annotation.position.points)) {
            // Fallback: generate path from points
            const points = annotation.position.points;
            const pathData = points
              .map((point: { x: number; y: number }, index: number) => {
                const scaledX = point.x * scale;
                const scaledY = point.y * scale;
                return index === 0 ? `M ${scaledX} ${scaledY}` : `L ${scaledX} ${scaledY}`;
              })
              .join(" ");
            const freehandPath = document.createElementNS(svgNS, "path");
            freehandPath.setAttribute("d", pathData);
            if (shouldBlink) {
              freehandPath.setAttribute("stroke", "#ff0000");
              freehandPath.setAttribute("stroke-width", "4");
              freehandPath.setAttribute("opacity", "1");
              freehandPath.style.animation = "blink 0.5s ease-in-out infinite";
            } else {
              freehandPath.setAttribute("stroke", "#000");
              freehandPath.setAttribute("stroke-width", "2");
            }
            freehandPath.setAttribute("fill", "none");
            freehandPath.setAttribute("stroke-linecap", "round");
            freehandPath.setAttribute("stroke-linejoin", "round");
            return freehandPath;
          }
          return null;

        default:
          return null;
      }
    },
    [viewport.zoom, selectedAnnotation, isBlinking]
  );
  // Load PDF document
  const loadPDF = useCallback(async (url: string) => {
    if (!window.pdfjsLib) {
      console.error("PDF.js not loaded");
      setError("PDF.js not loaded");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setNumPages(0); // Reset page count

      console.log("Loading PDF from URL:", url);

      // Clear any existing timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }

      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setError("PDF loading timeout - please try again");
        setIsLoading(false);
      }, 10000); // 10 second timeout
      loadTimeoutRef.current = timeout;

      // Handle blob URLs and regular URLs
      let pdfData;
      if (url.startsWith("blob:")) {
        console.log("Loading blob URL...");
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        pdfData = new Uint8Array(arrayBuffer);
        console.log("Blob data size:", pdfData.length);
      } else {
        console.log("Loading regular URL...");
        pdfData = url;
      }

      console.log("Calling pdfjsLib.getDocument...");
      const loadingTask = window.pdfjsLib.getDocument(pdfData, {
        cMapUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;

      console.log("✅ PDF document loaded successfully:", {
        numPages: pdf.numPages,
        pdfDoc: !!pdf,
      });
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setIsLoading(false);
      console.log("✅ PDF state updated - pdfDoc is now available for drawing");

      // Clear timeout on success
      clearTimeout(timeout);
      loadTimeoutRef.current = null;

      console.log("PDF loaded successfully, pages:", pdf.numPages);
    } catch (error) {
      console.error("Failed to load PDF:", error);
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to load PDF: ${message}`);
      setIsLoading(false);

      // Clear timeout on error
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }
  }, []);
  const redrawAnnotations = useCallback(() => {
    if (!svgOverlayRef.current) return;

    // Clear existing annotations
    while (svgOverlayRef.current.firstChild) {
      svgOverlayRef.current.removeChild(svgOverlayRef.current.firstChild);
    }

    // Draw annotations for current page
    const pageAnnotations = annotations.filter(
      (ann) => ann.page === viewport.page
    );

    pageAnnotations.forEach((annotation) => {
      // Use local dragged annotation if it exists and matches this annotation
      const annotationToRender = 
        localDraggedAnnotation && 
        localDraggedAnnotation.id === annotation.id
          ? localDraggedAnnotation
          : annotation;
      
      const element = createAnnotationElement(annotationToRender);
      if (element) {
        svgOverlayRef.current?.appendChild(element);
      }
    });
  }, [annotations, viewport.page, createAnnotationElement, localDraggedAnnotation]);
  // Render PDF page to canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) {
        console.warn("PDF document not available for rendering");
        return;
      }

      if (!canvasRef.current) {
        console.warn(
          "Canvas ref not available for rendering - PDF:",
          !!pdfDoc,
          "Page:",
          pageNum
        );
        return;
      }

      try {
        // Cancel any existing render operation
        if (renderOperationRef.current) {
          renderOperationRef.current.cancel();
          renderOperationRef.current = null;
        }

        const page = await pdfDoc.getPage(pageNum);
        const pdfViewport = page.getViewport({ scale: viewport.zoom });
        const canvas = canvasRef.current;

        if (!canvas) {
          console.warn("Canvas not available for rendering");
          return;
        }

        const ctx = canvas.getContext("2d");
        const ratio = window.devicePixelRatio || 1;

        if (!ctx) {
          console.warn("Canvas context not available");
          return;
        }

        canvas.width = Math.floor(pdfViewport.width * ratio);
        canvas.height = Math.floor(pdfViewport.height * ratio);
        canvas.style.width = pdfViewport.width + "px";
        canvas.style.height = pdfViewport.height + "px";
        canvas.style.zIndex = "1";

        // Set SVG overlay size and position
        if (svgOverlayRef.current) {
          svgOverlayRef.current.setAttribute(
            "width",
            pdfViewport.width.toString()
          );
          svgOverlayRef.current.setAttribute(
            "height",
            pdfViewport.height.toString()
          );
          svgOverlayRef.current.style.width = pdfViewport.width + "px";
          svgOverlayRef.current.style.height = pdfViewport.height + "px";
          svgOverlayRef.current.style.position = "absolute";
          svgOverlayRef.current.style.top = "0";
          svgOverlayRef.current.style.left = "0";
          svgOverlayRef.current.style.pointerEvents = "all";
          svgOverlayRef.current.style.zIndex = "10";

          console.log(
            "SVG overlay sized:",
            pdfViewport.width,
            "x",
            pdfViewport.height
          );
          console.log(
            "Container size:",
            containerRef.current?.clientWidth,
            "x",
            containerRef.current?.clientHeight
          );
          console.log("Canvas size:", canvas.width, "x", canvas.height);
          console.log(
            "Canvas style size:",
            canvas.style.width,
            "x",
            canvas.style.height
          );
        }

        // Set container positioning
        if (containerRef.current) {
          containerRef.current.style.position = "relative";
          containerRef.current.style.overflow = "auto";

          // Debug scrollbar requirements
          setTimeout(() => {
            const container = containerRef.current;
            if (container) {
              const needsHorizontalScroll =
                pdfViewport.width > container.clientWidth;
              const needsVerticalScroll =
                pdfViewport.height > container.clientHeight;

              console.log("📏 Scrollbar Debug:", {
                canvasWidth: pdfViewport.width,
                canvasHeight: pdfViewport.height,
                containerWidth: container.clientWidth,
                containerHeight: container.clientHeight,
                needsHorizontalScroll,
                needsVerticalScroll,
                scrollWidth: container.scrollWidth,
                scrollHeight: container.scrollHeight,
                zoom: viewport.zoom,
              });

              // Force scrollbars to be visible if content is larger
              if (needsHorizontalScroll || needsVerticalScroll) {
                container.style.overflowX = "scroll";
                container.style.overflowY = "scroll";
                console.log("📏 Forced scrollbars to be visible");
              }
            }
          }, 100);
        }

        // Render page
        const renderContext = {
          canvasContext: ctx,
          viewport: page.getViewport({ scale: viewport.zoom * ratio }),
        };

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Start render operation and store reference
        const renderOperation = page.render(renderContext);
        renderOperationRef.current = renderOperation;

        await renderOperation.promise;

        // Clear render operation reference on completion
        renderOperationRef.current = null;

        // Redraw annotations with a small delay
        setTimeout(() => {
          redrawAnnotations();
        }, 10);
      } catch (error) {
        // Handle rendering cancellation gracefully - this is expected when cancelling operations
        const errorName = error instanceof Error ? error.name : String(error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (
          errorName === "RenderingCancelledException" ||
          errorMessage?.includes("Rendering cancelled")
        ) {
          console.log("Render operation was cancelled (expected behavior)");
          renderOperationRef.current = null;
          return; // Don't treat cancellation as an error
        }

        console.error("Failed to render page:", error);
        renderOperationRef.current = null; // Clear reference on actual error
      }
    },
    [pdfDoc, viewport.zoom, redrawAnnotations]
  );

  // Debounced render function to prevent too many rapid renders
  const debouncedRenderPage = useCallback(
    (pageNum: number) => {
      // Clear any pending render timeout
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }

      // Set a new timeout for rendering
      renderTimeoutRef.current = setTimeout(() => {
        renderPage(pageNum);
      }, 100); // 100ms debounce
    },
    [renderPage]
  );

  // Load PDF when document URL changes
  useEffect(() => {
    console.log("🔄 PDFViewer useEffect - documentUrl changed:", {
      hasUrl: !!documentUrl,
      url: documentUrl?.substring(0, 50) + "...",
      hasPdfjsLib: !!window.pdfjsLib,
    });

    if (documentUrl) {
      // Ensure pdfjsLib is available before attempting to load PDF
      if (window.pdfjsLib) {
        console.log("✅ pdfjsLib available, loading PDF...");
        loadPDF(documentUrl);
      } else {
        console.log("⏳ Waiting for pdfjsLib to load...");
        // If pdfjsLib is not yet loaded, wait for it
        const checkPdfjs = setInterval(() => {
          if (window.pdfjsLib) {
            console.log("✅ pdfjsLib loaded, loading PDF...");
            clearInterval(checkPdfjs);
            loadPDF(documentUrl);
          }
        }, 100);
        return () => clearInterval(checkPdfjs);
      }
    } else {
      console.warn("⚠️ No documentUrl provided to PDFViewer");
    }
  }, [documentUrl, loadPDF]);

  // Render page when PDF document is loaded (debounced)
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      // Use debounced render to prevent rapid re-renders
      debouncedRenderPage(viewport.page);
    }
  }, [pdfDoc, viewport.page, debouncedRenderPage]);
  
  // Re-render annotations when blinking state changes
  useEffect(() => {
    if (isBlinking) {
      redrawAnnotations();
    }
  }, [isBlinking, redrawAnnotations]);

  // Cleanup timeout and render operations on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (renderOperationRef.current) {
        renderOperationRef.current.cancel();
        renderOperationRef.current = null;
      }
    };
  }, []);

  // Create SVG element for annotation

  // Redraw annotations on SVG overlay

  // Redraw annotations when annotations array changes
  useEffect(() => {
    if (pdfDoc && svgOverlayRef.current) {
      redrawAnnotations();
    }
  }, [annotations, pdfDoc, redrawAnnotations]);

  // Redraw annotations when zoom level changes
  useEffect(() => {
    if (pdfDoc && svgOverlayRef.current && annotations.length > 0) {
      console.log(
        "🔄 Zoom changed, redrawing annotations at zoom:",
        viewport.zoom
      );
      redrawAnnotations();
    }
  }, [viewport.zoom, pdfDoc, redrawAnnotations, annotations.length]);

  // Show arc drawing indicators (AutoCAD style)
  useEffect(() => {
    if (isDrawingArc && svgOverlayRef.current) {
      // Clear existing temporary elements
      const existingTemp =
        svgOverlayRef.current.querySelectorAll(".temp-arc-element");
      existingTemp.forEach((el) => svgOverlayRef.current?.removeChild(el));

      if (arcStartPoint) {
        const scale = viewport.zoom;
        const screenStartPoint = {
          x: arcStartPoint.x * scale,
          y: arcStartPoint.y * scale,
        };

        // Draw start point indicator (AutoCAD style - small filled circle)
        const startCircle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        startCircle.setAttribute("cx", screenStartPoint.x.toString());
        startCircle.setAttribute("cy", screenStartPoint.y.toString());
        startCircle.setAttribute("r", "3");
        startCircle.setAttribute("fill", "#ff0000"); // Red like AutoCAD
        startCircle.setAttribute("stroke", "#ffffff");
        startCircle.setAttribute("stroke-width", "1");
        startCircle.classList.add("temp-arc-element");
        svgOverlayRef.current.appendChild(startCircle);

        // Add start point label
        const startLabel = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        startLabel.setAttribute("x", (screenStartPoint.x + 8).toString());
        startLabel.setAttribute("y", (screenStartPoint.y - 8).toString());
        startLabel.setAttribute("fill", "#ff0000");
        startLabel.setAttribute("font-size", "12");
        startLabel.setAttribute("font-family", "Arial, sans-serif");
        startLabel.textContent = "Start";
        startLabel.classList.add("temp-arc-element");
        svgOverlayRef.current.appendChild(startLabel);

        if (arcCenter) {
          const screenCenter = {
            x: arcCenter.x * scale,
            y: arcCenter.y * scale,
          };

          // Draw center point indicator (AutoCAD style - crosshairs)
          const centerCrosshair = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g"
          );
          centerCrosshair.classList.add("temp-arc-element");

          // Horizontal crosshair line
          const hLine = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          hLine.setAttribute("x1", (screenCenter.x - 15).toString());
          hLine.setAttribute("y1", screenCenter.y.toString());
          hLine.setAttribute("x2", (screenCenter.x + 15).toString());
          hLine.setAttribute("y2", screenCenter.y.toString());
          hLine.setAttribute("stroke", "#00ff00"); // Green like AutoCAD
          hLine.setAttribute("stroke-width", "1");

          // Vertical crosshair line
          const vLine = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          vLine.setAttribute("x1", screenCenter.x.toString());
          vLine.setAttribute("y1", (screenCenter.y - 15).toString());
          vLine.setAttribute("x2", screenCenter.x.toString());
          vLine.setAttribute("y2", (screenCenter.y + 15).toString());
          vLine.setAttribute("stroke", "#00ff00");
          vLine.setAttribute("stroke-width", "1");

          centerCrosshair.appendChild(hLine);
          centerCrosshair.appendChild(vLine);
          svgOverlayRef.current.appendChild(centerCrosshair);

          // Add center point label
          const centerLabel = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          centerLabel.setAttribute("x", (screenCenter.x + 8).toString());
          centerLabel.setAttribute("y", (screenCenter.y - 8).toString());
          centerLabel.setAttribute("fill", "#00ff00");
          centerLabel.setAttribute("font-size", "12");
          centerLabel.setAttribute("font-family", "Arial, sans-serif");
          centerLabel.textContent = "Center";
          centerLabel.classList.add("temp-arc-element");
          svgOverlayRef.current.appendChild(centerLabel);
        }
      }
    }
  }, [isDrawingArc, arcStartPoint, arcCenter, viewport.zoom]);

  // Handle keyboard events for arc tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDrawingArc) {
        if (e.key === "Escape") {
          // Cancel arc drawing
          setArcStartPoint(null);
          setArcCenter(null);
          setIsDrawingArc(false);
          setArcPhase("start");

          // Clear temporary elements
          if (svgOverlayRef.current) {
            const existingTemp =
              svgOverlayRef.current.querySelectorAll(".temp-arc-element");
            existingTemp.forEach((el) =>
              svgOverlayRef.current?.removeChild(el)
            );
            const existingPreview =
              svgOverlayRef.current.querySelector(".temp-arc-preview");
            if (existingPreview) {
              svgOverlayRef.current.removeChild(existingPreview);
            }
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawingArc]);

  // Get pointer position at current zoom level (for temporary drawing elements)
  const getCurrentZoomPointerPos = useCallback(
    (e: React.MouseEvent) => {
      if (!svgOverlayRef.current || !pdfDoc) return { x: 0, y: 0 };

      const rect = svgOverlayRef.current.getBoundingClientRect();

      // Defensive check: ensure SVG has non-zero dimensions
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          "SVG overlay has zero dimensions, cannot calculate pointer position"
        );
        return { x: 0, y: 0 };
      }

      // Calculate mouse position relative to SVG overlay
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Scale to match the SVG coordinate system
      const scaleX = svgOverlayRef.current.clientWidth / rect.width;
      const scaleY = svgOverlayRef.current.clientHeight / rect.height;

      return {
        x: mouseX * scaleX,
        y: mouseY * scaleY,
      };
    },
    [pdfDoc]
  );

  // Find annotation at point (for select tool)
  const findAnnotationAtPoint = useCallback(
    (point: { x: number; y: number }): Annotation | null => {
      const scale = viewport.zoom;
      const pageAnnotations = annotations.filter(
        (ann) => ann.page === viewport.page && ann.documentId === documentId
      );

      // Convert point from base scale to current zoom scale for comparison
      const scaledPoint = {
        x: point.x * scale,
        y: point.y * scale,
      };

      for (const annotation of pageAnnotations) {
        const pos = annotation.position;
        if (!pos) continue;

        switch (annotation.type) {
          case "rectangle":
          case "highlight":
          case "sticky-note":
            if (
              pos.x !== undefined &&
              pos.y !== undefined &&
              pos.width !== undefined &&
              pos.height !== undefined
            ) {
              const scaledX = pos.x * scale;
              const scaledY = pos.y * scale;
              // Use default size if width/height is 0
              const scaledW = (pos.width && pos.width > 0) ? pos.width * scale : 100 * scale;
              const scaledH = (pos.height && pos.height > 0) ? pos.height * scale : 80 * scale;
              if (
                scaledPoint.x >= scaledX &&
                scaledPoint.x <= scaledX + scaledW &&
                scaledPoint.y >= scaledY &&
                scaledPoint.y <= scaledY + scaledH
              ) {
                return annotation;
              }
            }
            break;

          case "circle":
            if (pos.x !== undefined && pos.y !== undefined && pos.width) {
              const scaledX = pos.x * scale;
              const scaledY = pos.y * scale;
              const scaledR = pos.width * scale; // width is used as radius
              const distance = Math.sqrt(
                Math.pow(scaledPoint.x - scaledX, 2) + Math.pow(scaledPoint.y - scaledY, 2)
              );
              if (distance <= scaledR) {
                return annotation;
              }
            }
            break;

          case "ellipse":
            if (
              pos.x !== undefined &&
              pos.y !== undefined &&
              pos.width &&
              pos.height
            ) {
              const scaledX = pos.x * scale;
              const scaledY = pos.y * scale;
              const scaledRX = pos.width * scale; // width is used as rx
              const scaledRY = pos.height * scale; // height is used as ry
              // Check if point is inside ellipse using ellipse equation
              const dx = (scaledPoint.x - scaledX) / scaledRX;
              const dy = (scaledPoint.y - scaledY) / scaledRY;
              const distance = dx * dx + dy * dy;
              if (distance <= 1) {
                return annotation;
              }
            }
            break;

          case "arc":
            // Check if point is near the arc path (simplified detection)
            if (pos.points && Array.isArray(pos.points) && pos.points.length >= 3) {
              const [startPoint, center, endPoint] = pos.points;
              const scaledCenter = {
                x: center.x * scale,
                y: center.y * scale,
              };
              
              // Calculate radius
              const radius = Math.sqrt(
                Math.pow(center.x * scale - startPoint.x * scale, 2) +
                Math.pow(center.y * scale - startPoint.y * scale, 2)
              );
              
              // Check if point is near the arc center or on the arc path (simpler detection)
              const distanceToCenter = Math.sqrt(
                Math.pow(scaledPoint.x - scaledCenter.x, 2) +
                Math.pow(scaledPoint.y - scaledCenter.y, 2)
              );
              
              // Allow clicking anywhere near the arc (within radius ± 10px) for easier selection
              if (Math.abs(distanceToCenter - radius) <= 10 * scale || distanceToCenter <= radius + 10 * scale) {
                return annotation;
              }
            }
            // Also check if arc has center/startPoint/endPoint properties separately
            else if (pos.center) {
              const scaledCenter = {
                x: pos.center.x * scale,
                y: pos.center.y * scale,
              };
              const distanceToCenter = Math.sqrt(
                Math.pow(scaledPoint.x - scaledCenter.x, 2) +
                Math.pow(scaledPoint.y - scaledCenter.y, 2)
              );
              // Allow clicking near the center or on the arc
              if (distanceToCenter <= 50 * scale) {
                return annotation;
              }
            }
            break;

          case "line":
          case "measurement":
          case "calibrate":
          case "arrow":
            if (
              pos.x !== undefined &&
              pos.y !== undefined &&
              pos.width !== undefined &&
              pos.height !== undefined
            ) {
              // Check if point is near the line
              const x1 = pos.x * scale;
              const y1 = pos.y * scale;
              const x2 = pos.width * scale;
              const y2 = pos.height * scale;
              const distance = distanceToLine(scaledPoint, { x1, y1, x2, y2 });
              if (distance <= 5 * scale) {
                return annotation;
              }
            }
            break;

          case "cloud":
          case "highlight":
          case "rectangle":
            // Check if point is inside the rectangle/cloud/highlight
            if (
              pos.x !== undefined &&
              pos.y !== undefined &&
              pos.width !== undefined &&
              pos.height !== undefined
            ) {
              const rectX = pos.x * scale;
              const rectY = pos.y * scale;
              const rectW = pos.width * scale;
              const rectH = pos.height * scale;
              
              // For cloud, check if point is within the bounding box (simplified detection)
              if (
                scaledPoint.x >= rectX &&
                scaledPoint.x <= rectX + rectW &&
                scaledPoint.y >= rectY &&
                scaledPoint.y <= rectY + rectH
              ) {
                return annotation;
              }
            }
            break;

          case "freehand":
            // Check if point is near the freehand path
            if (pos.pathData || (pos.points && Array.isArray(pos.points))) {
              const points = pos.points || [];
              if (points.length > 0) {
                // Check if point is near any segment of the path
                for (let i = 0; i < points.length - 1; i++) {
                  const p1 = { x: points[i].x * scale, y: points[i].y * scale };
                  const p2 = { x: points[i + 1].x * scale, y: points[i + 1].y * scale };
                  const distance = distanceToLine(scaledPoint, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
                  if (distance <= 5 * scale) {
                    return annotation;
                  }
                }
              }
            }
            break;
        }
      }
      return null;
    },
    [annotations, viewport.page, viewport.zoom, documentId]
  );

  // Calculate distance from point to line
  const distanceToLine = (
    point: { x: number; y: number },
    line: { x1: number; y1: number; x2: number; y2: number }
  ): number => {
    const { x1, y1, x2, y2 } = line;
    const A = point.x - x1;
    const B = point.y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    let param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get pointer position relative to SVG element (stored at base scale for zoom independence)
  const getPointerPos = useCallback(
    (e: React.MouseEvent) => {
      if (!svgOverlayRef.current || !pdfDoc) return { x: 0, y: 0 };

      const rect = svgOverlayRef.current.getBoundingClientRect();

      // Defensive check: ensure SVG has non-zero dimensions
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          "SVG overlay has zero dimensions, cannot calculate pointer position"
        );
        return { x: 0, y: 0 };
      }

      // Calculate mouse position relative to SVG overlay
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Scale to match the SVG coordinate system
      const scaleX = svgOverlayRef.current.clientWidth / rect.width;
      const scaleY = svgOverlayRef.current.clientHeight / rect.height;

      const currentZoomX = mouseX * scaleX;
      const currentZoomY = mouseY * scaleY;

      // Convert to base scale (1:1) for storage - this makes annotations zoom-independent
      return {
        x: currentZoomX / viewport.zoom,
        y: currentZoomY / viewport.zoom,
      };
    },
    [pdfDoc, viewport.zoom]
  );

  // Calculate distance between two points
  const calculateDistance = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    []
  );

  // Calculate circle center from three points (AutoCAD method)
  const calculateCircleCenter = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => {
      const A = p2.x - p1.x;
      const B = p2.y - p1.y;
      const C = p3.x - p1.x;
      const D = p3.y - p1.y;

      const E = A * (p1.x + p2.x) + B * (p1.y + p2.y);
      const F = C * (p1.x + p3.x) + D * (p1.y + p3.y);

      const G = 2 * (A * (p3.y - p1.y) - B * (p3.x - p1.x));

      if (Math.abs(G) < 1e-10) {
        // Points are collinear, return null
        return null;
      }

      const centerX = (D * E - B * F) / G;
      const centerY = (A * F - C * E) / G;

      return { x: centerX, y: centerY };
    },
    []
  );

  // Complete arc creation (from my-app implementation)
  const completeArc = useCallback(
    (
      startPoint: { x: number; y: number },
      center: { x: number; y: number },
      endPoint: { x: number; y: number }
    ) => {
      console.log("🔧 completeArc called with:", {
        startPoint,
        center,
        endPoint,
      });

      if (center && startPoint && endPoint) {
        const radius = calculateDistance(
          center.x,
          center.y,
          startPoint.x,
          startPoint.y
        );

        const startAngle = Math.atan2(
          startPoint.y - center.y,
          startPoint.x - center.x
        );
        const endAngle = Math.atan2(
          endPoint.y - center.y,
          endPoint.x - center.x
        );

        let angleDiff = endAngle - startAngle;

        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
        const sweepFlag = angleDiff > 0 ? 1 : 0;

        const pathData = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endPoint.x} ${endPoint.y}`;

        const arcLength = Math.abs(angleDiff) * radius;

        const newAnnotation: Omit<
          Annotation,
          "id" | "createdAt" | "updatedAt"
        > = {
          documentId: documentId,
          type: "arc",
          page: viewport.page,
          position: {
            x: startPoint.x,
            y: startPoint.y,
            width: radius,
            height: radius,
            points: [
              { x: startPoint.x, y: startPoint.y },
              { x: center.x, y: center.y },
              { x: endPoint.x, y: endPoint.y },
            ],
          },
          style: {
            color: "#0b74de",
            opacity: 1,
            strokeWidth: 2,
            strokeColor: "#0b74de",
          },
          author: currentUser,
          isVisible: true,
          metrics: {
            length: arcLength,
            length_px: arcLength,
            radius: radius,
          },
        };

        console.log("🔧 About to create annotation:", newAnnotation);
        onAnnotationCreate(newAnnotation);
        console.log(
          "✅ Arc completed successfully! Annotation should be visible now."
        );
      }

      // Clear any existing calculation elements
      if (svgOverlayRef.current) {
        const existingCalc = svgOverlayRef.current.querySelector(
          ".real-time-calculation"
        );
        if (existingCalc) {
          svgOverlayRef.current.removeChild(existingCalc);
        }
      }

      // Reset arc drawing state
      setArcStartPoint(null);
      setArcCenter(null);
      setIsDrawingArc(false);
      setArcPhase("start");
    },
    [
      calculateDistance,
      documentId,
      viewport.page,
      currentUser,
      onAnnotationCreate,
    ]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
      // Check for panning: spacebar + mouse or middle mouse button
      const isMiddleMouse = e.button === 1;
      const shouldPan = isSpacePressed || isMiddleMouse;

      if (shouldPan) {
        e.preventDefault();
        setIsPanning(true);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          setPanStart({
            x: e.clientX - rect.left + container.scrollLeft,
            y: e.clientY - rect.top + container.scrollTop,
          });
        }
        return;
      }

      console.log("Mouse down event triggered, activeTool:", activeTool);

      // Handle erase tool
      if (activeTool === "erase") {
        const p = getPointerPos(e);
        const clickedAnnotation = findAnnotationAtPoint(p);
        if (clickedAnnotation && onAnnotationDelete) {
          console.log("Erasing annotation:", clickedAnnotation.id);
          onAnnotationDelete(clickedAnnotation.id);
          setIsPointerDown(false);
          return;
        } else {
          setIsPointerDown(false);
          return;
        }
      }

      // Handle select tool (activeTool is null)
      if (activeTool === null) {
        const p = getPointerPos(e);
        const currentP = getCurrentZoomPointerPos(e);
        const clickedAnnotation = findAnnotationAtPoint(p);
        if (clickedAnnotation) {
          setSelectedAnnotation(clickedAnnotation);
          setIsDragging(true);
          setDragStart(p);
          dragStartCurrentRef.current = currentP;
          // Store original position for dragging
          setOriginalAnnotationPos({
            x: clickedAnnotation.position.x || 0,
            y: clickedAnnotation.position.y || 0,
            width: clickedAnnotation.position.width,
            height: clickedAnnotation.position.height,
          });
          // Store original arc points if it's an arc
          if (clickedAnnotation.type === "arc" && clickedAnnotation.position.points) {
            originalArcPointsRef.current = [...clickedAnnotation.position.points];
          } else {
            originalArcPointsRef.current = null;
          }
          // Initialize local dragged annotation (for visual feedback)
          setLocalDraggedAnnotation(clickedAnnotation);
          setIsPointerDown(false);
          return;
        } else {
          setSelectedAnnotation(null);
          setIsPointerDown(false);
          return;
        }
      }

      if (!activeTool || !containerRef.current || !svgOverlayRef.current) {
        console.log(
          "Missing requirements - activeTool:",
          activeTool,
          "container:",
          !!containerRef.current,
          "svg:",
          !!svgOverlayRef.current
        );
        return;
      }

      // Check if PDF is loaded
      if (!pdfDoc) {
        console.warn("❌ PDF not loaded yet - pdfDoc is null", {
          documentUrl: documentUrl?.substring(0, 50),
          isLoading,
          hasPdfjsLib: !!window.pdfjsLib,
          numPages,
        });
        // Don't show alert on every click, just log
        console.log(
          "Please wait for the PDF to finish loading before drawing."
        );
        return;
      }

      console.log("✅ PDF is loaded, allowing drawing", {
        pdfDoc: !!pdfDoc,
        numPages,
        activeTool,
      });

      // Ensure SVG overlay is properly sized before allowing drawing
      const rect = svgOverlayRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          "SVG overlay not ready for drawing, please wait for PDF to load"
        );
        alert("Please wait for the PDF to finish rendering before drawing.");
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const p = getPointerPos(e); // Base scale coordinates for storage
      const currentP = getCurrentZoomPointerPos(e); // Current zoom coordinates for temporary elements

      // Set pointer down state
      setIsPointerDown(true);

      console.log(
        "Mouse down at position:",
        p,
        "current zoom pos:",
        currentP,
        "for tool:",
        activeTool
      );

      // Handle different tools based on my-app implementation
      switch (activeTool) {
        case "text":
          // For text, show prompt immediately
          const textContent = prompt("Enter comment text:");
          if (textContent) {
            const newAnnotation: Omit<
              Annotation,
              "id" | "createdAt" | "updatedAt"
            > = {
              documentId: documentId,
              type: "text",
              page: pageNumber,
              position: { x: p.x, y: p.y, width: 0, height: 0 },
              content: textContent,
              style: { color: currentUser.color, opacity: 1, fontSize: 12 },
              author: currentUser,
              isVisible: true,
            };
            onAnnotationCreate(newAnnotation);
          }
          return;

        case "sticky-note":
          // Handle sticky note tool - drag to create box first
          setIsCreating(true);
          setDragStart(p);
          const stickyNoteElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          stickyNoteElement.setAttribute("x", currentP.x.toString());
          stickyNoteElement.setAttribute("y", currentP.y.toString());
          stickyNoteElement.setAttribute("width", "0");
          stickyNoteElement.setAttribute("height", "0");
          stickyNoteElement.setAttribute("fill", "#FFA500");
          stickyNoteElement.setAttribute("stroke", "#000");
          stickyNoteElement.setAttribute("stroke-width", "1");
          stickyNoteElement.setAttribute("opacity", "0.9");
          svgOverlayRef.current.appendChild(stickyNoteElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = stickyNoteElement;
          return;

        case "arc":
          // AutoCAD-style arc drawing: Start point, Center, End point
          console.log("🎯 Arc tool clicked! Current state:", {
            isDrawingArc,
            arcPhase,
            arcStartPoint,
            arcCenter,
          });

          if (!isDrawingArc) {
            // Phase 1: Set start point (like AutoCAD: "Specify start point of arc")
            setArcStartPoint(p);
            setArcPhase("center");
            setIsDrawingArc(true);
            setIsPointerDown(false);
            console.log(
              "✅ Arc: Start point set at",
              p,
              "- Next: Specify center point"
            );
            return;
          } else if (arcPhase === "center") {
            // Phase 2: Set center point (like AutoCAD: "Specify center point of arc")
            setArcCenter(p);
            setArcPhase("end");
            setIsPointerDown(false);
            console.log(
              "✅ Arc: Center point set at",
              p,
              "- Next: Specify end point"
            );
            return;
          } else if (arcPhase === "end") {
            // Phase 3: Complete the arc with end point (like AutoCAD: "Specify end point of arc")
            console.log("🎯 Completing arc with points:", {
              start: arcStartPoint,
              center: arcCenter,
              end: p,
            });
            if (arcStartPoint && arcCenter) {
              completeArc(arcStartPoint, arcCenter, p);
              console.log("✅ Arc completed successfully!");
            } else {
              console.error("❌ Missing arc points:", {
                arcStartPoint,
                arcCenter,
              });
            }
            setIsPointerDown(false);
            return;
          }
          return;

        case "highlight":
          // Handle highlight tool
          setIsCreating(true);
          setDragStart(p);
          const highlightElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          highlightElement.setAttribute("x", currentP.x.toString());
          highlightElement.setAttribute("y", currentP.y.toString());
          highlightElement.setAttribute("width", "0");
          highlightElement.setAttribute("height", "0");
          highlightElement.setAttribute("fill", "rgba(255, 255, 0, 0.3)");
          highlightElement.setAttribute("stroke", "none");
          svgOverlayRef.current.appendChild(highlightElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = highlightElement;
          return;

        case "rectangle":
          setIsCreating(true);
          setDragStart(p);
          const rectElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          rectElement.setAttribute("x", currentP.x.toString());
          rectElement.setAttribute("y", currentP.y.toString());
          rectElement.setAttribute("width", "0");
          rectElement.setAttribute("height", "0");
          rectElement.setAttribute("fill", "rgba(11,116,222,0.3)");
          rectElement.setAttribute("stroke", "#0b74de");
          rectElement.setAttribute("stroke-width", "1");
          svgOverlayRef.current.appendChild(rectElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = rectElement;
          return;

        case "circle":
          setIsCreating(true);
          setDragStart(p);
          const circleElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          circleElement.setAttribute("cx", currentP.x.toString());
          circleElement.setAttribute("cy", currentP.y.toString());
          circleElement.setAttribute("r", "0");
          circleElement.setAttribute("stroke", "#0b74de");
          circleElement.setAttribute("stroke-width", "2");
          circleElement.setAttribute("fill", "none");
          svgOverlayRef.current.appendChild(circleElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = circleElement;
          return;

        case "ellipse":
          setIsCreating(true);
          setDragStart(p);
          const ellipseElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "ellipse"
          );
          ellipseElement.setAttribute("cx", currentP.x.toString());
          ellipseElement.setAttribute("cy", currentP.y.toString());
          ellipseElement.setAttribute("rx", "0");
          ellipseElement.setAttribute("ry", "0");
          ellipseElement.setAttribute("stroke", "#0b74de");
          ellipseElement.setAttribute("stroke-width", "2");
          ellipseElement.setAttribute("fill", "none");
          svgOverlayRef.current.appendChild(ellipseElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = ellipseElement;
          return;

        case "line":
        case "measurement":
        case "calibrate":
        case "arrow":
          setIsCreating(true);
          setDragStart(p);
          const lineElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          lineElement.setAttribute("x1", currentP.x.toString());
          lineElement.setAttribute("y1", currentP.y.toString());
          lineElement.setAttribute("x2", currentP.x.toString());
          lineElement.setAttribute("y2", currentP.y.toString());
          const strokeColor =
            activeTool === "measurement"
              ? "#ff6b00"
              : activeTool === "calibrate"
              ? "red"
              : activeTool === "arrow"
              ? "#000"
              : "#000";
          lineElement.setAttribute("stroke", strokeColor);
          lineElement.setAttribute("stroke-width", "2");
          svgOverlayRef.current.appendChild(lineElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = lineElement;
          return;

        case "cloud":
          // Handle cloud tool - drag to create cloud shape
          setIsCreating(true);
          setDragStart(p);
          const cloudElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          cloudElement.setAttribute("d", `M ${currentP.x} ${currentP.y}`);
          cloudElement.setAttribute("fill", "rgba(0,204,204,0.3)");
          cloudElement.setAttribute("stroke", "#00CCCC");
          cloudElement.setAttribute("stroke-width", "2");
          svgOverlayRef.current.appendChild(cloudElement);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = cloudElement;
          return;

        case "freehand":
          // Start freehand drawing
          setIsDrawingFreehand(true);
          setIsCreating(true);
          setDragStart(p); // Set dragStart so handleMouseMove works
          setFreehandPoints([p]); // Start with first point (base scale)
          const freehandPath = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          freehandPath.setAttribute("d", `M ${currentP.x} ${currentP.y}`);
          freehandPath.setAttribute("fill", "none");
          freehandPath.setAttribute("stroke", "#000");
          freehandPath.setAttribute("stroke-width", "2");
          freehandPath.setAttribute("stroke-linecap", "round");
          freehandPath.setAttribute("stroke-linejoin", "round");
          svgOverlayRef.current.appendChild(freehandPath);
          (
            svgOverlayRef.current as SVGSVGElement & {
              currentDrawingElement?: SVGElement;
            }
          ).currentDrawingElement = freehandPath;
          return;

        default:
          console.log("Tool not implemented yet:", activeTool);
          return;
      }
    },
    [
      activeTool,
      getPointerPos,
      getCurrentZoomPointerPos,
      documentId,
      currentUser,
      onAnnotationCreate,
      isPointerDown,
      pdfDoc,
      isDrawingArc,
      arcPhase,
      arcStartPoint,
      arcCenter,
      findAnnotationAtPoint,
      onAnnotationDelete,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle dragging annotations (select tool)
      if (isDragging && selectedAnnotation && dragStartCurrentRef.current && originalAnnotationPos) {
        e.preventDefault();
        const currentP = getCurrentZoomPointerPos(e);
        const scale = viewport.zoom;
        
        // Calculate delta in screen coordinates (incremental from last position, like my-app)
        const screenDeltaX = currentP.x - dragStartCurrentRef.current.x;
        const screenDeltaY = currentP.y - dragStartCurrentRef.current.y;
        
        // Convert screen delta to base scale delta (like my-app: baseDelta = screenDelta * (baseScale / scale))
        // baseScale is 1.0, so: baseDelta = screenDelta / scale
        const baseDeltaX = screenDeltaX / scale;
        const baseDeltaY = screenDeltaY / scale;

        // Calculate new position based on original position + accumulated delta
        const newX = originalAnnotationPos.x + baseDeltaX;
        const newY = originalAnnotationPos.y + baseDeltaY;
        const newWidth = (originalAnnotationPos.width || 0) + baseDeltaX;
        const newHeight = (originalAnnotationPos.height || 0) + baseDeltaY;

        // Update annotation position (LOCAL STATE ONLY - NO API CALL)
        let updatedAnnotation: Annotation = {
          ...selectedAnnotation,
          position: {
            ...selectedAnnotation.position,
          },
        };

        // Handle different annotation types
        if (
          selectedAnnotation.type === "line" ||
          selectedAnnotation.type === "measurement" ||
          selectedAnnotation.type === "calibrate" ||
          selectedAnnotation.type === "arrow"
        ) {
          // For lines and arrows, update both start and end points
          updatedAnnotation.position.x = newX;
          updatedAnnotation.position.y = newY;
          updatedAnnotation.position.width = newWidth;
          updatedAnnotation.position.height = newHeight;
        } else if (
          selectedAnnotation.type === "circle" ||
          selectedAnnotation.type === "ellipse"
        ) {
          // For circles and ellipses, move center only, keep size the same
          updatedAnnotation.position.x = newX;
          updatedAnnotation.position.y = newY;
          // Keep width and height unchanged (size stays the same)
        } else if (
          selectedAnnotation.type === "cloud" ||
          selectedAnnotation.type === "highlight" ||
          selectedAnnotation.type === "rectangle" ||
          selectedAnnotation.type === "sticky-note"
        ) {
          // For rectangles, clouds, highlights, and sticky notes, move position
          updatedAnnotation.position.x = newX;
          updatedAnnotation.position.y = newY;
          // Keep width and height unchanged (size stays the same)
        } else if (selectedAnnotation.type === "arc") {
          // For arcs, move all points (startPoint, center, endPoint) by the same delta
          // Use original points stored when dragging started
          if (originalArcPointsRef.current && originalArcPointsRef.current.length >= 3) {
            const [originalStart, originalCenter, originalEnd] = originalArcPointsRef.current;
            
            // Move all points by the delta
            updatedAnnotation.position.points = [
              { x: originalStart.x + baseDeltaX, y: originalStart.y + baseDeltaY },
              { x: originalCenter.x + baseDeltaX, y: originalCenter.y + baseDeltaY },
              { x: originalEnd.x + baseDeltaX, y: originalEnd.y + baseDeltaY },
            ];
          } else if (selectedAnnotation.position.points && Array.isArray(selectedAnnotation.position.points)) {
            // Fallback: use current points if original not stored
            updatedAnnotation.position.points = selectedAnnotation.position.points.map((point: { x: number; y: number }) => ({
              x: point.x + baseDeltaX,
              y: point.y + baseDeltaY,
            }));
          }
          // Also update center, startPoint, endPoint if they exist separately
          if (selectedAnnotation.position.center) {
            const originalCenter = selectedAnnotation.position.center;
            updatedAnnotation.position.center = {
              x: originalCenter.x + baseDeltaX,
              y: originalCenter.y + baseDeltaY,
            };
          }
          if (selectedAnnotation.position.startPoint) {
            const originalStart = selectedAnnotation.position.startPoint;
            updatedAnnotation.position.startPoint = {
              x: originalStart.x + baseDeltaX,
              y: originalStart.y + baseDeltaY,
            };
          }
          if (selectedAnnotation.position.endPoint) {
            const originalEnd = selectedAnnotation.position.endPoint;
            updatedAnnotation.position.endPoint = {
              x: originalEnd.x + baseDeltaX,
              y: originalEnd.y + baseDeltaY,
            };
          }
        } else {
          // For other types (rectangle, highlight, text, etc.), move position
          updatedAnnotation.position.x = newX;
          updatedAnnotation.position.y = newY;
        }

        // Update local state only (NO API CALL during dragging for performance)
        setLocalDraggedAnnotation(updatedAnnotation);
        
        // Update drag start for next incremental update (like my-app line 882: setDragStart(pos))
        dragStartCurrentRef.current = currentP;
        // Update original position for next frame to accumulate deltas
        setOriginalAnnotationPos({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });
        return;
      }

      // Handle panning
      if (isPanning && panStart && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left + container.scrollLeft;
        const currentY = e.clientY - rect.top + container.scrollTop;

        const deltaX = currentX - panStart.x;
        const deltaY = currentY - panStart.y;

        setPanOffset((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));

        setPanStart({
          x: currentX,
          y: currentY,
        });
        return;
      }

      // Handle arc preview drawing (from my-app implementation)
      if (
        isDrawingArc &&
        arcPhase === "end" &&
        arcCenter &&
        arcStartPoint &&
        svgOverlayRef.current
      ) {
        const currentP = getCurrentZoomPointerPos(e);

        // Remove existing preview
        const existingPreview =
          svgOverlayRef.current.querySelector(".temp-arc-preview");
        if (existingPreview) {
          svgOverlayRef.current.removeChild(existingPreview);
        }

        // Create new preview arc using center-based approach
        const scale = viewport.zoom;
        const screenStartPoint = {
          x: arcStartPoint.x * scale,
          y: arcStartPoint.y * scale,
        };
        const screenCenter = {
          x: arcCenter.x * scale,
          y: arcCenter.y * scale,
        };

        const radius = calculateDistance(
          screenCenter.x,
          screenCenter.y,
          screenStartPoint.x,
          screenStartPoint.y
        );
        const startAngle = Math.atan2(
          screenStartPoint.y - screenCenter.y,
          screenStartPoint.x - screenCenter.x
        );
        const endAngle = Math.atan2(
          currentP.y - screenCenter.y,
          currentP.x - screenCenter.x
        );

        let angleDiff = endAngle - startAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
        const sweepFlag = angleDiff > 0 ? 1 : 0;

        const arcPath = `M ${screenStartPoint.x} ${screenStartPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${currentP.x} ${currentP.y}`;

        const previewPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        previewPath.setAttribute("d", arcPath);
        previewPath.setAttribute("stroke", "#ffff00"); // Yellow like AutoCAD preview
        previewPath.setAttribute("stroke-width", "2");
        previewPath.setAttribute("fill", "none");
        previewPath.setAttribute("stroke-dasharray", "8,4"); // More AutoCAD-like dash pattern
        previewPath.classList.add("temp-arc-preview");

        svgOverlayRef.current.appendChild(previewPath);
        return;
      }

      // Handle freehand separately (doesn't need dragStart)
      if (activeTool === "freehand" && isDrawingFreehand && svgOverlayRef.current) {
        const currentElement = (
          svgOverlayRef.current as SVGSVGElement & {
            currentDrawingElement?: SVGElement;
          }
        ).currentDrawingElement;
        
        if (currentElement) {
          const p = getPointerPos(e); // Base scale coordinates
          setFreehandPoints((prev) => {
            const newPoints = [...prev, p];
            // Update path element with current zoom coordinates
            const currentP = getCurrentZoomPointerPos(e);
            const pathData = newPoints
              .map((point, index) => {
                const scaledX = point.x * viewport.zoom;
                const scaledY = point.y * viewport.zoom;
                return index === 0 ? `M ${scaledX} ${scaledY}` : `L ${scaledX} ${scaledY}`;
              })
              .join(" ");
            currentElement.setAttribute("d", pathData);
            return newPoints;
          });
        }
        return;
      }

      // For other tools, check normal conditions
      if (!isCreating || !dragStart || !activeTool || !svgOverlayRef.current) {
        return;
      }

      const p = getPointerPos(e); // Base scale coordinates for storage
      const currentP = getCurrentZoomPointerPos(e); // Current zoom coordinates for temporary elements
      const currentElement = (
        svgOverlayRef.current as SVGSVGElement & {
          currentDrawingElement?: SVGElement;
        }
      ).currentDrawingElement;

      if (currentElement) {
        console.log("Mouse move updating element at position:", p);
      } else {
        console.log("No current element to update");
      }

      if (!currentElement) return;

      // const startX = dragStart.x;
      // const startY = dragStart.y;

      // Handle real-time drawing based on tool type (use current zoom coordinates for temporary elements)
      switch (activeTool) {
        case "highlight":
        case "rectangle":
        case "sticky-note":
        case "cloud":
          const startCurrentX = dragStart!.x * viewport.zoom; // Convert stored base scale to current zoom
          const startCurrentY = dragStart!.y * viewport.zoom;
          const x = Math.min(currentP.x, startCurrentX);
          const y = Math.min(currentP.y, startCurrentY);
          const width = Math.abs(currentP.x - startCurrentX);
          const height = Math.abs(currentP.y - startCurrentY);
          
          if (activeTool === "cloud") {
            // For cloud, update path
            const cloudPath = generateCloudPath(x, y, width, height, viewport.zoom);
            currentElement.setAttribute("d", cloudPath);
          } else {
            // For rectangle/highlight/sticky-note, update rect attributes
            currentElement.setAttribute("x", x.toString());
            currentElement.setAttribute("y", y.toString());
            currentElement.setAttribute("width", width.toString());
            currentElement.setAttribute("height", height.toString());
            // Update fill color for sticky note
            if (activeTool === "sticky-note") {
              currentElement.setAttribute("fill", "#FFA500");
              currentElement.setAttribute("stroke", "#000");
              currentElement.setAttribute("stroke-width", "1");
              currentElement.setAttribute("opacity", "0.9");
            }
          }
          break;

        case "circle":
          const startCurrentCircleX = dragStart!.x * viewport.zoom;
          const startCurrentCircleY = dragStart!.y * viewport.zoom;
          const radius = Math.sqrt(
            Math.pow(currentP.x - startCurrentCircleX, 2) +
              Math.pow(currentP.y - startCurrentCircleY, 2)
          );
          currentElement.setAttribute("r", radius.toString());
          break;

        case "ellipse":
          const startCurrentEllipseX = dragStart!.x * viewport.zoom;
          const startCurrentEllipseY = dragStart!.y * viewport.zoom;
          currentElement.setAttribute(
            "rx",
            Math.abs(currentP.x - startCurrentEllipseX).toString()
          );
          currentElement.setAttribute(
            "ry",
            Math.abs(currentP.y - startCurrentEllipseY).toString()
          );
          break;

        case "line":
        case "measurement":
        case "calibrate":
        case "arrow":
          currentElement.setAttribute("x2", currentP.x.toString());
          currentElement.setAttribute("y2", currentP.y.toString());
          break;
      }
      // For now, we'll just track the movement
    },
    [
      isCreating,
      dragStart,
      activeTool,
      getPointerPos,
      getCurrentZoomPointerPos,
      viewport.zoom,
      isDrawingArc,
      arcPhase,
      arcCenter,
      arcStartPoint,
      calculateDistance,
      isPanning,
      panStart,
      isDragging,
      selectedAnnotation,
      dragStart,
      originalAnnotationPos,
      onAnnotationUpdate,
      getPointerPos,
      generateCloudPath, // Added dependency for cloud rendering
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
      console.log("Mouse up event triggered");

      // Handle dragging end (select tool)
      if (isDragging && selectedAnnotation) {
        // Call API update only when dragging ends
        if (localDraggedAnnotation) {
          onAnnotationUpdate(localDraggedAnnotation);
        }
        
        setIsDragging(false);
        setDragStart(null);
        setOriginalAnnotationPos(null);
        dragStartCurrentRef.current = null;
        isDraggingRef.current = false;
        originalArcPointsRef.current = null; // Clear original arc points
        setLocalDraggedAnnotation(null); // Clear local state
        setIsPointerDown(false);
        return;
      }

      // Handle panning end
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        return;
      }

      // Allow arc tool to proceed even without isCreating/dragStart
      if (activeTool === "arc" && isDrawingArc) {
        console.log("Arc tool mouse up - allowing to proceed");
        setIsPointerDown(false);
        return;
      }

      if (
        !isCreating ||
        !dragStart ||
        !activeTool ||
        !svgOverlayRef.current ||
        !isPointerDown
      ) {
        console.log(
          "Mouse up blocked - isCreating:",
          isCreating,
          "dragStart:",
          !!dragStart,
          "activeTool:",
          activeTool,
          "svg:",
          !!svgOverlayRef.current
        );
        return;
      }

      const p = getPointerPos(e);
      const currentElement = (
        svgOverlayRef.current as SVGSVGElement & {
          currentDrawingElement?: SVGElement;
        }
      ).currentDrawingElement;

      console.log(
        "Mouse up with element:",
        !!currentElement,
        "at position:",
        p
      );

      if (!currentElement) {
        setIsCreating(false);
        setDragStart(null);
        return;
      }

      // If movement is too small, treat this as a click and DO NOT create an annotation
      // Skip this check for freehand since it needs to track all movements
      if (activeTool !== "freehand") {
        if (!dragStart) {
          setIsCreating(false);
          setIsPointerDown(false);
          return;
        }
        const startX = dragStart.x;
        const startY = dragStart.y;
        const minMove = 5; // pixels
        const deltaX = Math.abs(p.x - startX);
        const deltaY = Math.abs(p.y - startY);
        if (deltaX < minMove && deltaY < minMove) {
          console.log("Mouse movement too small, skipping annotation creation");
          if (currentElement && svgOverlayRef.current) {
            // Check if element is actually a child before removing
            if (currentElement.parentNode === svgOverlayRef.current) {
              svgOverlayRef.current.removeChild(currentElement);
            }
            (
              svgOverlayRef.current as SVGSVGElement & {
                currentDrawingElement?: SVGElement;
              }
            ).currentDrawingElement = undefined;
          }
          setIsCreating(false);
          setDragStart(null);
          setIsPointerDown(false);
          return;
        }
      }
      
      // Get startX and startY for non-freehand tools
      const startX = dragStart?.x ?? 0;
      const startY = dragStart?.y ?? 0;

      let newAnnotation: Omit<
        Annotation,
        "id" | "createdAt" | "updatedAt"
      > | null = null;

      // Create annotation based on tool type
      switch (activeTool) {
        case "highlight":
          const hX = Math.min(p.x, startX);
          const hY = Math.min(p.y, startY);
          const hW = Math.abs(p.x - startX);
          const hH = Math.abs(p.y - startY);
          newAnnotation = {
            documentId: documentId,
            type: "highlight",
            page: pageNumber,
            position: { x: hX, y: hY, width: hW, height: hH },
            style: { color: "#FFFF00", opacity: 0.3 },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "rectangle":
          const rX = Math.min(p.x, startX);
          const rY = Math.min(p.y, startY);
          const rW = Math.abs(p.x - startX);
          const rH = Math.abs(p.y - startY);
          newAnnotation = {
            documentId: documentId,
            type: "rectangle",
            page: pageNumber,
            position: { x: rX, y: rY, width: rW, height: rH },
            style: {
              color: "#0b74de",
              opacity: 0.3,
              strokeWidth: 1,
              strokeColor: "#0b74de",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "cloud":
          const cloudX = Math.min(p.x, startX);
          const cloudY = Math.min(p.y, startY);
          const cloudW = Math.abs(p.x - startX);
          const cloudH = Math.abs(p.y - startY);
          newAnnotation = {
            documentId: documentId,
            type: "cloud",
            page: pageNumber,
            position: { x: cloudX, y: cloudY, width: cloudW, height: cloudH },
            style: {
              color: "#00CCCC",
              opacity: 0.3,
              strokeWidth: 2,
              strokeColor: "#00CCCC",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "freehand":
          // Complete freehand drawing
          console.log("Freehand mouse up - points:", freehandPoints.length);
          if (freehandPoints.length > 1) {
            // Create path data from points (base scale)
            const pathData = freehandPoints
              .map((point, index) => {
                return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
              })
              .join(" ");
            
            // Calculate bounding box
            const minX = Math.min(...freehandPoints.map((p) => p.x));
            const minY = Math.min(...freehandPoints.map((p) => p.y));
            const maxX = Math.max(...freehandPoints.map((p) => p.x));
            const maxY = Math.max(...freehandPoints.map((p) => p.y));
            
            newAnnotation = {
              documentId: documentId,
              type: "freehand",
              page: pageNumber,
              position: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                pathData: pathData,
                points: freehandPoints,
              },
              style: {
                color: "#000",
                opacity: 1,
                strokeWidth: 2,
                strokeColor: "#000",
              },
              author: currentUser,
              isVisible: true,
            };
            console.log("Freehand annotation created:", newAnnotation);
          } else {
            // If no points or only one point, don't create annotation
            console.log("Freehand drawing too short, skipping annotation creation");
            if (currentElement && svgOverlayRef.current) {
              // Check if element is actually a child before removing
              if (currentElement.parentNode === svgOverlayRef.current) {
                svgOverlayRef.current.removeChild(currentElement);
              }
            }
            setIsDrawingFreehand(false);
            setFreehandPoints([]);
            setIsCreating(false);
            setDragStart(null);
            setIsPointerDown(false);
            return;
          }
          setIsDrawingFreehand(false);
          setFreehandPoints([]);
          break;

        case "sticky-note":
          const sX = Math.min(p.x, startX);
          const sY = Math.min(p.y, startY);
          const sW = Math.abs(p.x - startX);
          const sH = Math.abs(p.y - startY);
          // Show prompt for sticky note text after box is created
          const stickyNoteContent = prompt("Enter sticky note text:");
          if (stickyNoteContent) {
            newAnnotation = {
              documentId: documentId,
              type: "sticky-note",
              page: pageNumber,
              position: { x: sX, y: sY, width: sW, height: sH },
              content: stickyNoteContent,
              style: { color: "#FFA500", opacity: 0.9, fontSize: 12 },
              author: currentUser,
              isVisible: true,
            };
          } else {
            // User cancelled, don't create annotation
            if (currentElement && svgOverlayRef.current) {
              // Check if element is actually a child before removing
              if (currentElement.parentNode === svgOverlayRef.current) {
                svgOverlayRef.current.removeChild(currentElement);
              }
            }
            setIsCreating(false);
            setDragStart(null);
            setIsPointerDown(false);
            return;
          }
          break;

        case "circle":
          const cX = startX;
          const cY = startY;
          const cR = Math.sqrt(
            Math.pow(p.x - startX, 2) + Math.pow(p.y - startY, 2)
          );
          newAnnotation = {
            documentId: documentId,
            type: "circle",
            page: pageNumber,
            position: { x: cX, y: cY, width: cR, height: 0 }, // Using width as radius
            style: {
              color: "#0b74de",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "#0b74de",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "ellipse":
          const eX = startX;
          const eY = startY;
          const eRX = Math.abs(p.x - startX);
          const eRY = Math.abs(p.y - startY);
          newAnnotation = {
            documentId: documentId,
            type: "ellipse",
            page: pageNumber,
            position: { x: eX, y: eY, width: eRX, height: eRY }, // Using width/height as rx/ry
            style: {
              color: "#0b74de",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "#0b74de",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "line":
          newAnnotation = {
            documentId: documentId,
            type: "line",
            page: pageNumber,
            position: { x: startX, y: startY, width: p.x, height: p.y }, // Using width/height as x2/y2
            style: {
              color: "#000",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "#000",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "arrow":
          newAnnotation = {
            documentId: documentId,
            type: "arrow",
            page: pageNumber,
            position: { x: startX, y: startY, width: p.x, height: p.y }, // Using width/height as x2/y2
            style: {
              color: "#000",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "#000",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "measurement":
          newAnnotation = {
            documentId: documentId,
            type: "measurement",
            page: pageNumber,
            position: { x: startX, y: startY, width: p.x, height: p.y },
            style: {
              color: "#ff6b00",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "#ff6b00",
            },
            author: currentUser,
            isVisible: true,
          };
          break;

        case "calibrate":
          newAnnotation = {
            documentId: documentId,
            type: "calibrate",
            page: pageNumber,
            position: { x: startX, y: startY, width: p.x, height: p.y },
            style: {
              color: "red",
              opacity: 1,
              strokeWidth: 2,
              strokeColor: "red",
            },
            author: currentUser,
            isVisible: true,
          };
          break;
      }

      // Create the annotation if we have valid data
      if (newAnnotation) {
        console.log("Creating annotation:", newAnnotation);
        onAnnotationCreate(newAnnotation);
      }

      // Remove temporary element after annotation is created
      if (currentElement && svgOverlayRef.current) {
        // Check if element is actually a child before removing
        if (currentElement.parentNode === svgOverlayRef.current) {
          svgOverlayRef.current.removeChild(currentElement);
        }
        (
          svgOverlayRef.current as SVGSVGElement & {
            currentDrawingElement?: SVGElement;
          }
        ).currentDrawingElement = undefined;
      }

      setIsCreating(false);
      setDragStart(null);
      setIsPointerDown(false);
    },
    [
      isCreating,
      dragStart,
      activeTool,
      getPointerPos,
      documentId,
      currentUser,
      onAnnotationCreate,
      isDrawingArc,
      isPointerDown,
      isDragging,
      selectedAnnotation,
      originalAnnotationPos,
      freehandPoints,
      isDrawingFreehand,
    ]
  );

  const goToPreviousPage = useCallback(async () => {
    if (viewport.page > 1) {
      const newPage = viewport.page - 1;
      onViewportChange({ ...viewport, page: newPage });
      await renderPage(newPage);
    }
  }, [viewport, onViewportChange, renderPage]);

  const goToNextPage = useCallback(async () => {
    if (viewport.page < numPages) {
      const newPage = viewport.page + 1;
      onViewportChange({ ...viewport, page: newPage });
      await renderPage(newPage);
    }
  }, [viewport, numPages, onViewportChange, renderPage]);

  const rotateDocument = useCallback(() => {
    onViewportChange({ ...viewport, rotation: (viewport.rotation + 90) % 360 });
  }, [viewport, onViewportChange]);

  // Keyboard event listeners for spacebar panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isPanning) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(false);
        if (isPanning) {
          setIsPanning(false);
          setPanStart(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPanning]);

  // Apply pan transform to container
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (container) {
      container.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
      container.style.transformOrigin = "0 0";
    }
  }, [panOffset]);

  // Reset pan offset when page changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [viewport.page]);

  // const renderAnnotation = (annotation: Annotation, pageNumber: number) => {
  //   if (annotation.page !== pageNumber) return null;

  //   const style = {
  //     left: annotation.position.x,
  //     top: annotation.position.y,
  //     width: annotation.position.width,
  //     height: annotation.position.height,
  //     backgroundColor: annotation.style.color,
  //     opacity: annotation.style.opacity,
  //     borderColor: annotation.style.color,
  //     borderWidth: annotation.style.strokeWidth,
  //     fontSize: annotation.style.fontSize,
  //     fontFamily: annotation.style.fontFamily,
  //   };

  //   return (
  //     <div
  //       key={annotation.id}
  //       className={cn(
  //         "annotation",
  //         `annotation.${annotation.type}`,
  //         !annotation.isVisible && "opacity-30"
  //       )}
  //       style={style}
  //       onClick={() => onAnnotationUpdate(annotation)}
  //     >
  //       {annotation.content && (
  //         <span className="text-xs">{annotation.content}</span>
  //       )}
  //     </div>
  //   );
  // };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading PDF</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* Page Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousPage}
            disabled={viewport.page <= 1}
            className="p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium">
            Page {viewport.page} of {numPages}
          </span>

          <button
            onClick={goToNextPage}
            disabled={viewport.page >= numPages}
            className="p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {Math.round(viewport.zoom * 100)}%
          </span>
          {/* <button
            onClick={rotateDocument}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title="Rotate"
          >
            <RotateCw size={20} />
          </button> */}
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="pdf-viewer-container bg-gray-100"
        style={{
          height: "600px",
          width: "100%",
          maxWidth: "100%",
          overflow: "auto",
          overflowX: "auto",
          overflowY: "auto",
          border: "1px solid #ccc",
          position: "relative",
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading PDF...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Please wait before drawing
              </p>
            </div>
          </div>
        ) : !pdfDoc ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Preparing PDF...</p>
            </div>
          </div>
        ) : (
          <div className="p-4 flex justify-center items-start">
            {documentUrl ? (
              <div
                id="pdfContainer"
                ref={pdfContainerRef}
                className="relative inline-block"
              >
                <canvas
                  ref={canvasRef}
                  id="pdfCanvas"
                  className="pdfPage shadow-lg border border-border block"
                  onDoubleClick={handleDoubleClick}
                />
                <svg
                  ref={svgOverlayRef}
                  id="svgOverlay"
                  className="absolute top-0 left-0"
                  onMouseDown={(e) => handleMouseDown(e, viewport.page)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={(e) => handleMouseUp(e, viewport.page)}
                  onDoubleClick={handleDoubleClick}
                  style={{ pointerEvents: "auto" }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No document selected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Arc Drawing Status Indicator - AutoCAD Style */}
      {isDrawingArc && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-md shadow-lg z-50 font-mono">
          <div className="text-sm">
            <div className="font-bold">ARC Command</div>
            <div className="text-xs mt-1">
              {arcPhase === "center"
                ? "Specify center point of arc:"
                : arcPhase === "end"
                ? "Specify end point of arc:"
                : "Specify start point of arc:"}
            </div>
            <div className="text-xs text-blue-200 mt-1">
              Press ESC to cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
