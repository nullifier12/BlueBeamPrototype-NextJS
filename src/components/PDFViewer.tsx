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
}

export default function PDFViewer({
  // ...existing code...

  // ...existing code...
  documentUrl,
  documentId,
  annotations,
  currentUser,
  activeTool,
  viewport,
  onViewportChange,
  onAnnotationCreate,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

      console.log("PDF document loaded:", pdf);
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setIsLoading(false);

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
    if (documentUrl) {
      // Ensure pdfjsLib is available before attempting to load PDF
      if (window.pdfjsLib) {
        loadPDF(documentUrl);
      } else {
        // If pdfjsLib is not yet loaded, wait for it
        const checkPdfjs = setInterval(() => {
          if (window.pdfjsLib) {
            clearInterval(checkPdfjs);
            loadPDF(documentUrl);
          }
        }, 100);
        return () => clearInterval(checkPdfjs);
      }
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
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

      // Ensure SVG overlay is properly sized before allowing drawing
      const rect = svgOverlayRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          "SVG overlay not ready for drawing, please wait for PDF to load"
        );
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const p = getPointerPos(e); // Base scale coordinates for storage
      const currentP = getCurrentZoomPointerPos(e); // Current zoom coordinates for temporary elements

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
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreating || !dragStart || !activeTool || !svgOverlayRef.current) {
        // console.log(
        //   "Mouse move blocked - isCreating:",
        //   isCreating,
        //   "dragStart:",
        //   !!dragStart,
        //   "activeTool:",
        //   activeTool,
        //   "svg:",
        //   !!svgOverlayRef.current
        // );
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
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
      console.log("Mouse up event triggered");

      if (!isCreating || !dragStart || !activeTool || !svgOverlayRef.current) {
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
            </div>
          </div>
        ) : (
          <div className="p-4 flex justify-center items-start">
            {documentUrl ? (
              <div id="pdfContainer" className="relative inline-block">
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
    </div>
  );
}

