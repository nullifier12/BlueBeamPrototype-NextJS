import { RowDataPacket } from 'mysql2';

export interface AnnotationRow extends RowDataPacket {
  id: string;
  document_id: string;
  project_id: string;
  type: string;
  page: number;
  position_x: number | string;
  position_y: number | string;
  position_width: number | string | null;
  position_height: number | string | null;
  position_radius: number | string | null;
  position_points: string | null;
  position_path_data: string | null;
  position_center: string | null;
  position_start_point: string | null;
  position_end_point: string | null;
  position_start_angle: number | string | null;
  position_end_angle: number | string | null;
  position_sweep_flag: number | null;
  position_large_arc_flag: number | null;
  content: string | null;
  style_color: string;
  style_opacity: number | string;
  style_stroke_width: number | string | null;
  style_stroke_color: string | null;
  style_fill_color: string | null;
  style_font_size: number | null;
  style_font_family: string | null;
  metrics_area: number | string | null;
  metrics_perimeter: number | string | null;
  metrics_length: number | string | null;
  metrics_radius: number | string | null;
  metrics_rx: number | string | null;
  metrics_ry: number | string | null;
  metrics_area_px: number | string | null;
  metrics_length_px: number | string | null;
  metrics_text: string | null;
  author_id: string;
  is_visible: boolean | number;
  created_at: Date;
  updated_at: Date;
  author_name?: string;
  author_email?: string;
  author_color?: string;
}

export interface PunchListItemRow extends RowDataPacket {
  id: string;
  project_id: string;
  annotation_id: string | null;
  document_id: string | null;
  description: string;
  demarcation: string | null;
  demarcation_id: string | null;
  demarcation_image: string | null;
  location: string | null;
  page: number | null;
  position_x: number | string | null;
  position_y: number | string | null;
  status: string;
  percent_complete: number;
  assigned_to: string | null;
  attachments: string | null;
  comments: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  created_by_name?: string;
}

export interface DocumentRow extends RowDataPacket {
  id: string;
  project_id: string;
  name: string;
  url: string;
  page_count: number;
  size: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectRow extends RowDataPacket {
  id: string;
  project_id?: string;
  name: string;
  calibration_factor: number | string;
  scale: number | string;
  inspection_notes: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectUserRow extends RowDataPacket {
  project_id: string;
  user_id: string;
  role: string;
}

export type QueryResult<T extends RowDataPacket> = T[];
export type QueryParams = (string | number | null | undefined)[];

