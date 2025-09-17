'use client';

import React, { useState, useCallback } from 'react';
import Toolbar from '@/components/Toolbar';
import DocumentList from '@/components/DocumentList';
import PDFViewer from '@/components/PDFViewer';
import AnnotationPanel from '@/components/AnnotationPanel';
import FileUpload from '@/components/FileUpload';
import { PDFDocument, Annotation, AnnotationType, Viewport, User } from '@/types';

// Mock data for demonstration
const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  color: '#0066cc'
};

const mockDocuments: PDFDocument[] = [
  {
    id: '1',
    name: 'Sample PDF Document.pdf',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    pageCount: 1,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    size: 13264,
    status: 'active'
  },
  {
    id: '2',
    name: 'Test PDF Document.pdf',
    url: 'https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-file.pdf',
    pageCount: 5,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
    size: 3028,
    status: 'active'
  }
];

const mockAnnotations: Annotation[] = [
  {
    id: '1',
    documentId: '1',
    type: 'highlight',
    page: 1,
    position: { x: 100, y: 200, width: 150, height: 20 },
    content: 'Important section',
    style: {
      color: '#ffff00',
      opacity: 0.3,
      strokeWidth: 1
    },
    author: mockUser,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    isVisible: true
  },
  {
    id: '2',
    documentId: '1',
    type: 'text',
    page: 2,
    position: { x: 200, y: 300, width: 100, height: 30 },
    content: 'Check this measurement',
    style: {
      color: '#0066cc',
      opacity: 1,
      strokeWidth: 2,
      fontSize: 12,
      fontFamily: 'Arial'
    },
    author: mockUser,
    createdAt: new Date('2024-01-19'),
    updatedAt: new Date('2024-01-19'),
    isVisible: true
  }
];

export default function BlueBeamApp() {
  const [documents, setDocuments] = useState<PDFDocument[]>(mockDocuments);
  const [selectedDocument, setSelectedDocument] = useState<PDFDocument | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(mockAnnotations);
  const [activeTool, setActiveTool] = useState<AnnotationType | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({
    zoom: 1,
    rotation: 0,
    page: 1,
    scrollX: 0,
    scrollY: 0
  });

  const handleDocumentSelect = useCallback((document: PDFDocument) => {
    setSelectedDocument(document);
    setViewport(prev => ({ ...prev, page: 1 }));
  }, []);

  const handleToolSelect = useCallback((tool: AnnotationType | null) => {
    setActiveTool(tool);
  }, []);

  const handleZoomIn = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.25) }));
  }, []);

  const handleRotate = useCallback(() => {
    setViewport(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  }, []);

  const handleSave = useCallback(() => {
    console.log('Saving document...');
  }, []);

  const handleUndo = useCallback(() => {
    console.log('Undo action...');
  }, []);

  const handleRedo = useCallback(() => {
    console.log('Redo action...');
  }, []);

  const handleAnnotationCreate = useCallback((annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const handleAnnotationUpdate = useCallback((updatedAnnotation: Annotation) => {
    setAnnotations(prev => prev.map(ann => 
      ann.id === updatedAnnotation.id 
        ? { ...updatedAnnotation, updatedAt: new Date() }
        : ann
    ));
  }, []);

  const handleAnnotationDelete = useCallback((annotationId: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
  }, []);


  const handleUploadDocument = useCallback(() => {
    setShowUploadModal(true);
  }, []);

  const handleDocumentUpload = useCallback((newDocument: PDFDocument) => {
    setDocuments(prev => [newDocument, ...prev]);
    setSelectedDocument(newDocument);
    setShowUploadModal(false);
  }, []);

  const handleExport = useCallback(() => {
    if (!selectedDocument) return;
    
    const exportData = {
      document: selectedDocument,
      annotations: annotations.filter(ann => ann.documentId === selectedDocument.id),
      viewport,
      project: {
        id: 'default',
        name: 'Default Project',
        calibrationFactor: 1,
        scale: 1,
        inspectionNotes: '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDocument.name.replace('.pdf', '')}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Exported project data:', exportData);
  }, [selectedDocument, annotations, viewport]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target?.result as string);
          console.log('Imported project data:', importData);
          
          // Handle imported data
          if (importData.annotations) {
            setAnnotations(prev => [...prev, ...importData.annotations]);
          }
          
          if (importData.viewport) {
            setViewport(importData.viewport);
          }
          
          alert('Project data imported successfully!');
        } catch (error) {
          console.error('Failed to import project data:', error);
          alert('Failed to import project data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
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
        onExport={handleExport}
        onImport={handleImport}
        zoom={viewport.zoom}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <DocumentList
          documents={documents}
          selectedDocument={selectedDocument}
          onDocumentSelect={handleDocumentSelect}
          onUploadDocument={handleUploadDocument}
        />
        
        <div className="flex-1 flex">
          {selectedDocument ? (
            <>
              <PDFViewer
                documentUrl={selectedDocument.url}
                documentId={selectedDocument.id}
                annotations={annotations.filter(ann => ann.documentId === selectedDocument.id)}
                currentUser={mockUser}
                activeTool={activeTool}
                viewport={viewport}
                onViewportChange={setViewport}
                onAnnotationCreate={handleAnnotationCreate}
                onAnnotationUpdate={handleAnnotationUpdate}
              />
              
              <AnnotationPanel
                annotations={annotations.filter(ann => ann.documentId === selectedDocument.id)}
                onAnnotationSelect={(annotation) => {
                  setViewport(prev => ({ ...prev, page: annotation.page }));
                }}
                onAnnotationDelete={handleAnnotationDelete}
                onAnnotationUpdate={handleAnnotationUpdate}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-4">Welcome to BlueBeam Prototype</h2>
                <p className="text-muted-foreground mb-6">
                  Select a document from the sidebar to get started with PDF annotation and collaboration.
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
        <span>{selectedDocument ? `${selectedDocument.name} - Page ${viewport.page}` : 'No document selected'}</span>
      </div>

      {showUploadModal && (
        <FileUpload
          onDocumentUpload={handleDocumentUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
