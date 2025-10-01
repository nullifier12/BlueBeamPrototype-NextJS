export interface PDFDocument {
  id: string;
  name: string;
  url: string;
  pageCount: number;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  status: 'active' | 'archived' | 'deleted';
}

export interface Annotation {
  id: string;
  documentId: string;
  type: AnnotationType;
  page: number;
  position: Position;
  content?: string;
  style: AnnotationStyle;
  author: User;
  createdAt: Date;
  updatedAt: Date;
  isVisible: boolean;
  metrics?: AnnotationMetrics;
}

export type AnnotationType = 
  | 'highlight'
  | 'text'
  | 'sticky-note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'measurement'
  | 'calibrate'
  | 'ellipse'
  | 'polyline'
  | 'arc'
  | 'cloud'
  | 'freehand';

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  // Arc-specific properties (my-app format)
  pathData?: string;
  center?: { x: number; y: number };
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface AnnotationStyle {
  color: string;
  opacity: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

export interface DocumentSession {
  id: string;
  documentId: string;
  participants: User[];
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface Tool {
  id: string;
  name: string;
  icon: string;
  type: AnnotationType | null;
  shortcut?: string;
  isActive: boolean;
}

export interface Viewport {
  zoom: number;
  rotation: number;
  page: number;
  scrollX: number;
  scrollY: number;
}

export interface PunchListItem {
  id: string;
  annotationId?: string;
  description: string;
  demarcation: string;
  location: string;
  status: 'Open' | 'In-Progress' | 'Closed';
  percentComplete: number;
  assignedTo: string;
  attachments: string[];
  comments: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  calibrationFactor: number;
  scale: number;
  inspectionNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnotationMetrics {
  area?: number;
  perimeter?: number;
  length?: number;
  radius?: number;
  rx?: number;
  ry?: number;
  area_px?: number;
  length_px?: number;
  text?: string;
}

export interface PunchListSummary {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  progressPercent: number;
}
