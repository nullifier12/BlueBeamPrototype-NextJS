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
  onPunchItemImageUpdate?: (annotationId: string, imageData: string) => void;
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
  onPunchItemImageUpdate,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Arc drawing state
  const [arcStartPoint, setArcStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [arcCenter, setArcCenter] = useState<{ x: number; y: number } | null>(null);
  const [isDrawingArc, setIsDrawingArc] = useState(false);
  const [arcPhase, setArcPhase] = useState<'start' | 'center' | 'end'>('start');
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
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
  const createAnnotationElement = useCallback(
    (annotation: Annotation): SVGElement | null => {
      const svgNS = "http://www.w3.org/2000/svg";

      // Scale coordinates from base scale (1:1) to current zoom level for rendering
      const scale = viewport.zoom;
      const x = annotation.position.x * scale;
      const y = annotation.position.y * scale;
      const width = (annotation.position.width || 0) * scale;
      const height = (annotation.position.height || 0) * scale;

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
          circle.setAttribute("stroke", "#0b74de");
          circle.setAttribute("stroke-width", "2");
          circle.setAttribute("fill", "none");
          return circle;

        case "ellipse":
          const ellipse = document.createElementNS(svgNS, "ellipse");
          ellipse.setAttribute("cx", x.toString());
          ellipse.setAttribute("cy", y.toString());
          ellipse.setAttribute("rx", width.toString());
          ellipse.setAttribute("ry", height.toString());
          ellipse.setAttribute("stroke", "#0b74de");
          ellipse.setAttribute("stroke-width", "2");
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
          line.setAttribute("stroke", strokeColor);
          line.setAttribute("stroke-width", "2");
          return line;

        case "text":
          const text = document.createElementNS(svgNS, "text");
          text.setAttribute("x", x.toString());
          text.setAttribute("y", y.toString());
          text.setAttribute("fill", "#000");
          text.setAttribute("font-size", (12 * scale).toString());
          text.setAttribute("font-family", "Arial");
          text.textContent = annotation.content || "Text";
          return text;

        case "highlight":
          const highlight = document.createElementNS(svgNS, "rect");
          highlight.setAttribute("x", x.toString());
          highlight.setAttribute("y", y.toString());
          highlight.setAttribute("width", width.toString());
          highlight.setAttribute("height", height.toString());
          highlight.setAttribute("fill", "rgba(255, 255, 0, 0.3)");
          highlight.setAttribute("stroke", "none");
          return highlight;

        case "arc":
          // Arc annotations (from my-app implementation)
          console.log("🎨 Rendering arc annotation:", annotation);
          const path = document.createElementNS(svgNS, "path");
          if (annotation.position.points && annotation.position.points.length >= 3) {
            const [startPoint, center, endPoint] = annotation.position.points;
            console.log("🎨 Arc points:", { startPoint, center, endPoint, scale });
            
            // Scale coordinates for current zoom
            const scaledStart = {
              x: startPoint.x * scale,
              y: startPoint.y * scale
            };
            const scaledCenter = {
              x: center.x * scale,
              y: center.y * scale
            };
            const scaledEnd = {
              x: endPoint.x * scale,
              y: endPoint.y * scale
            };
            
            // Calculate radius from center to start point
            const radius = Math.sqrt(
              Math.pow(scaledCenter.x - scaledStart.x, 2) + 
              Math.pow(scaledCenter.y - scaledStart.y, 2)
            );
            
            const startAngle = Math.atan2(scaledStart.y - scaledCenter.y, scaledStart.x - scaledCenter.x);
            const endAngle = Math.atan2(scaledEnd.y - scaledCenter.y, scaledEnd.x - scaledCenter.x);
            
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
            const arcPath = `M ${x} ${y} A ${width} ${height} 0 0 1 ${x + width} ${y + height}`;
            path.setAttribute("d", arcPath);
          }
          path.setAttribute("stroke", "#0b74de");
          path.setAttribute("stroke-width", "2");
          path.setAttribute("fill", "none");
          console.log("🎨 Arc path element created:", path);
          return path;

        default:
          return null;
      }
    },
    [viewport.zoom]
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
        cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;

      console.log("✅ PDF document loaded successfully:", {
        numPages: pdf.numPages,
        pdfDoc: !!pdf
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
      const element = createAnnotationElement(annotation);
      if (element) {
        svgOverlayRef.current?.appendChild(element);
      }
    });
  }, [annotations, viewport.page, createAnnotationElement]);
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
      const existingTemp = svgOverlayRef.current.querySelectorAll('.temp-arc-element');
      existingTemp.forEach(el => svgOverlayRef.current?.removeChild(el));

      if (arcStartPoint) {
        const scale = viewport.zoom;
        const screenStartPoint = {
          x: arcStartPoint.x * scale,
          y: arcStartPoint.y * scale
        };

        // Draw start point indicator (AutoCAD style - small filled circle)
        const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startCircle.setAttribute('cx', screenStartPoint.x.toString());
        startCircle.setAttribute('cy', screenStartPoint.y.toString());
        startCircle.setAttribute('r', '3');
        startCircle.setAttribute('fill', '#ff0000'); // Red like AutoCAD
        startCircle.setAttribute('stroke', '#ffffff');
        startCircle.setAttribute('stroke-width', '1');
        startCircle.classList.add('temp-arc-element');
        svgOverlayRef.current.appendChild(startCircle);

        // Add start point label
        const startLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        startLabel.setAttribute('x', (screenStartPoint.x + 8).toString());
        startLabel.setAttribute('y', (screenStartPoint.y - 8).toString());
        startLabel.setAttribute('fill', '#ff0000');
        startLabel.setAttribute('font-size', '12');
        startLabel.setAttribute('font-family', 'Arial, sans-serif');
        startLabel.textContent = 'Start';
        startLabel.classList.add('temp-arc-element');
        svgOverlayRef.current.appendChild(startLabel);

        if (arcCenter) {
          const screenCenter = {
            x: arcCenter.x * scale,
            y: arcCenter.y * scale
          };

          // Draw center point indicator (AutoCAD style - crosshairs)
          const centerCrosshair = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          centerCrosshair.classList.add('temp-arc-element');

          // Horizontal crosshair line
          const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          hLine.setAttribute('x1', (screenCenter.x - 15).toString());
          hLine.setAttribute('y1', screenCenter.y.toString());
          hLine.setAttribute('x2', (screenCenter.x + 15).toString());
          hLine.setAttribute('y2', screenCenter.y.toString());
          hLine.setAttribute('stroke', '#00ff00'); // Green like AutoCAD
          hLine.setAttribute('stroke-width', '1');

          // Vertical crosshair line
          const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          vLine.setAttribute('x1', screenCenter.x.toString());
          vLine.setAttribute('y1', (screenCenter.y - 15).toString());
          vLine.setAttribute('x2', screenCenter.x.toString());
          vLine.setAttribute('y2', (screenCenter.y + 15).toString());
          vLine.setAttribute('stroke', '#00ff00');
          vLine.setAttribute('stroke-width', '1');

          centerCrosshair.appendChild(hLine);
          centerCrosshair.appendChild(vLine);
          svgOverlayRef.current.appendChild(centerCrosshair);

          // Add center point label
          const centerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          centerLabel.setAttribute('x', (screenCenter.x + 8).toString());
          centerLabel.setAttribute('y', (screenCenter.y - 8).toString());
          centerLabel.setAttribute('fill', '#00ff00');
          centerLabel.setAttribute('font-size', '12');
          centerLabel.setAttribute('font-family', 'Arial, sans-serif');
          centerLabel.textContent = 'Center';
          centerLabel.classList.add('temp-arc-element');
          svgOverlayRef.current.appendChild(centerLabel);
        }
      }
    }
  }, [isDrawingArc, arcStartPoint, arcCenter, viewport.zoom]);

  // Handle keyboard events for arc tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDrawingArc) {
        if (e.key === 'Escape') {
          // Cancel arc drawing
          setArcStartPoint(null);
          setArcCenter(null);
          setIsDrawingArc(false);
          setArcPhase('start');
          
          // Clear temporary elements
          if (svgOverlayRef.current) {
            const existingTemp = svgOverlayRef.current.querySelectorAll('.temp-arc-element');
            existingTemp.forEach(el => svgOverlayRef.current?.removeChild(el));
            const existingPreview = svgOverlayRef.current.querySelector('.temp-arc-preview');
            if (existingPreview) {
              svgOverlayRef.current.removeChild(existingPreview);
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
  const calculateDistance = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }, []);

  // Calculate circle center from three points (AutoCAD method)
  const calculateCircleCenter = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
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
  }, []);

  // Complete arc creation (from my-app implementation)
  const completeArc = useCallback((startPoint: { x: number; y: number }, center: { x: number; y: number }, endPoint: { x: number; y: number }) => {
    console.log("🔧 completeArc called with:", { startPoint, center, endPoint });
    
    if (center && startPoint && endPoint) {
      const radius = calculateDistance(center.x, center.y, startPoint.x, startPoint.y);

      const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
      const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);

      let angleDiff = endAngle - startAngle;

      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
      const sweepFlag = angleDiff > 0 ? 1 : 0;

      const pathData = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endPoint.x} ${endPoint.y}`;

      const arcLength = Math.abs(angleDiff) * radius;

      const newAnnotation: Omit<Annotation, "id" | "createdAt" | "updatedAt"> = {
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
            { x: endPoint.x, y: endPoint.y }
          ]
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
        }
      };
      
        console.log("🔧 About to create annotation:", newAnnotation);
        onAnnotationCreate(newAnnotation);
        console.log("✅ Arc completed successfully! Annotation should be visible now.");
    }

    // Clear any existing calculation elements
    if (svgOverlayRef.current) {
      const existingCalc = svgOverlayRef.current.querySelector('.real-time-calculation');
      if (existingCalc) {
        svgOverlayRef.current.removeChild(existingCalc);
      }
    }

    // Reset arc drawing state
    setArcStartPoint(null);
    setArcCenter(null);
    setIsDrawingArc(false);
    setArcPhase('start');
  }, [calculateDistance, documentId, viewport.page, currentUser, onAnnotationCreate]);

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
            y: e.clientY - rect.top + container.scrollTop
          });
        }
        return;
      }

      console.log("Mouse down event triggered, activeTool:", activeTool);

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
        console.warn(
          "❌ PDF not loaded yet - pdfDoc is null",
          {
            documentUrl: documentUrl?.substring(0, 50),
            isLoading,
            hasPdfjsLib: !!window.pdfjsLib,
            numPages
          }
        );
        // Don't show alert on every click, just log
        console.log("Please wait for the PDF to finish loading before drawing.");
        return;
      }
      
      console.log("✅ PDF is loaded, allowing drawing", {
        pdfDoc: !!pdfDoc,
        numPages,
        activeTool
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

        case "arc":
          // AutoCAD-style arc drawing: Start point, Center, End point
          console.log("🎯 Arc tool clicked! Current state:", { isDrawingArc, arcPhase, arcStartPoint, arcCenter });
          
          if (!isDrawingArc) {
            // Phase 1: Set start point (like AutoCAD: "Specify start point of arc")
            setArcStartPoint(p);
            setArcPhase('center');
            setIsDrawingArc(true);
            setIsPointerDown(false);
            console.log("✅ Arc: Start point set at", p, "- Next: Specify center point");
            return;
          } else if (arcPhase === 'center') {
            // Phase 2: Set center point (like AutoCAD: "Specify center point of arc")
            setArcCenter(p);
            setArcPhase('end');
            setIsPointerDown(false);
            console.log("✅ Arc: Center point set at", p, "- Next: Specify end point");
            return;
          } else if (arcPhase === 'end') {
            // Phase 3: Complete the arc with end point (like AutoCAD: "Specify end point of arc")
            console.log("🎯 Completing arc with points:", { start: arcStartPoint, center: arcCenter, end: p });
            if (arcStartPoint && arcCenter) {
              completeArc(arcStartPoint, arcCenter, p);
              console.log("✅ Arc completed successfully!");
            } else {
              console.error("❌ Missing arc points:", { arcStartPoint, arcCenter });
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
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle panning
      if (isPanning && panStart && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left + container.scrollLeft;
        const currentY = e.clientY - rect.top + container.scrollTop;
        
        const deltaX = currentX - panStart.x;
        const deltaY = currentY - panStart.y;
        
        setPanOffset(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        
        setPanStart({
          x: currentX,
          y: currentY
        });
        return;
      }

      // Handle arc preview drawing (from my-app implementation)
      if (isDrawingArc && arcPhase === 'end' && arcCenter && arcStartPoint && svgOverlayRef.current) {
        const currentP = getCurrentZoomPointerPos(e);
        
        // Remove existing preview
        const existingPreview = svgOverlayRef.current.querySelector('.temp-arc-preview');
        if (existingPreview) {
          svgOverlayRef.current.removeChild(existingPreview);
        }
        
        // Create new preview arc using center-based approach
        const scale = viewport.zoom;
        const screenStartPoint = {
          x: arcStartPoint.x * scale,
          y: arcStartPoint.y * scale
        };
        const screenCenter = {
          x: arcCenter.x * scale,
          y: arcCenter.y * scale
        };
        
        const radius = calculateDistance(screenCenter.x, screenCenter.y, screenStartPoint.x, screenStartPoint.y);
        const startAngle = Math.atan2(screenStartPoint.y - screenCenter.y, screenStartPoint.x - screenCenter.x);
        const endAngle = Math.atan2(currentP.y - screenCenter.y, currentP.x - screenCenter.x);
        
        let angleDiff = endAngle - startAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
        const sweepFlag = angleDiff > 0 ? 1 : 0;
        
        const arcPath = `M ${screenStartPoint.x} ${screenStartPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${currentP.x} ${currentP.y}`;
        
        const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        previewPath.setAttribute('d', arcPath);
        previewPath.setAttribute('stroke', '#ffff00'); // Yellow like AutoCAD preview
        previewPath.setAttribute('stroke-width', '2');
        previewPath.setAttribute('fill', 'none');
        previewPath.setAttribute('stroke-dasharray', '8,4'); // More AutoCAD-like dash pattern
        previewPath.classList.add('temp-arc-preview');
        
        svgOverlayRef.current.appendChild(previewPath);
        return;
      }

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
          const startCurrentX = dragStart.x * viewport.zoom; // Convert stored base scale to current zoom
          const startCurrentY = dragStart.y * viewport.zoom;
          const x = Math.min(currentP.x, startCurrentX);
          const y = Math.min(currentP.y, startCurrentY);
          const width = Math.abs(currentP.x - startCurrentX);
          const height = Math.abs(currentP.y - startCurrentY);
          currentElement.setAttribute("x", x.toString());
          currentElement.setAttribute("y", y.toString());
          currentElement.setAttribute("width", width.toString());
          currentElement.setAttribute("height", height.toString());
          break;

        case "circle":
          const startCurrentCircleX = dragStart.x * viewport.zoom;
          const startCurrentCircleY = dragStart.y * viewport.zoom;
          const radius = Math.sqrt(
            Math.pow(currentP.x - startCurrentCircleX, 2) +
              Math.pow(currentP.y - startCurrentCircleY, 2)
          );
          currentElement.setAttribute("r", radius.toString());
          break;

        case "ellipse":
          const startCurrentEllipseX = dragStart.x * viewport.zoom;
          const startCurrentEllipseY = dragStart.y * viewport.zoom;
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
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
      console.log("Mouse up event triggered");

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

      if (!isCreating || !dragStart || !activeTool || !svgOverlayRef.current || !isPointerDown) {
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

      const startX = dragStart.x;
      const startY = dragStart.y;

      // If movement is too small, treat this as a click and DO NOT create an annotation
      const minMove = 5; // pixels
      const deltaX = Math.abs(p.x - startX);
      const deltaY = Math.abs(p.y - startY);
      if (deltaX < minMove && deltaY < minMove) {
        console.log("Mouse movement too small, skipping annotation creation");
        if (currentElement && svgOverlayRef.current) {
          svgOverlayRef.current.removeChild(currentElement);
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
        svgOverlayRef.current.removeChild(currentElement);
        (
          svgOverlayRef.current as SVGSVGElement & {
            currentDrawingElement?: SVGElement;
          }
        ).currentDrawingElement = undefined;
      }

      setIsCreating(false);
      setDragStart(null);
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
      if (e.code === 'Space' && !isPanning) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        if (isPanning) {
          setIsPanning(false);
          setPanStart(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning]);

  // Apply pan transform to container
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (container) {
      container.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
      container.style.transformOrigin = '0 0';
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
          <button
            onClick={rotateDocument}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title="Rotate"
          >
            <RotateCw size={20} />
          </button>
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
              <p className="text-xs text-muted-foreground mt-2">Please wait before drawing</p>
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
              <div id="pdfContainer" ref={pdfContainerRef} className="relative inline-block">
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
              {arcPhase === 'center' ? 'Specify center point of arc:' :
                arcPhase === 'end' ? 'Specify end point of arc:' :
                'Specify start point of arc:'}
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









