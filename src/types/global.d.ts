declare global {
  interface Window {
    pdfjsLib: {
      GlobalWorkerOptions: {
        workerSrc: string;
      };
      getDocument: (src: string | ArrayBuffer | Uint8Array, options?: {
        cMapUrl?: string;
        cMapPacked?: boolean;
      }) => {
        promise: Promise<PDFDocumentProxy>;
      };
      PDFDocumentProxy: {
        getPage: (pageNumber: number) => Promise<PDFPageProxy>;
        numPages: number;
      };
      PDFPageProxy: {
        getViewport: (params: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (params: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => PDFRenderTask;
      };
      PDFRenderTask: {
        promise: Promise<void>;
        cancel: () => void;
      };
      version: string;
    };
  }
}

export {};


