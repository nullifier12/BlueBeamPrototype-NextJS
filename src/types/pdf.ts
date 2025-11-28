export interface PDFDocument {
  id: string;
  name: string;
  url: string;
  file_url?: string;
  file_path?: string;
  file_data?: string;
  page_count?: number;
  pageCount?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_size?: number;
  createdAt?: Date;
  updatedAt?: Date;
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
  sweepFlag?: number;
  largeArcFlag?: number;
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
  username: string;
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
  documentId?: string;
  description: string;
  demarcation: string;
  demarcationId?: string; // A, B, C, D, etc.
  demarcationImage?: string; // Base64 image data of the demarcated area
  location: string;
  page?: number;
  position?: { x: number; y: number };
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
  project_id?: string;
  name: string;
  location?: string;
  target_completion?: string;
  company_name?: string;
  calibration_factor?: number | string;
  calibrationFactor?: number;
  scale?: number;
  project_notes?: string;
  inspectionNotes?: string;
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
