import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { AnnotationRow } from '@/types';

// Helper function to safely parse JSON
function safeJsonParse(value: unknown): unknown {
  if (!value || value === 'null' || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    return value; // Already an object
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('Failed to parse JSON:', value, e);
    return null;
  }
}

// Helper function to safely parse float from number or string
function safeParseFloat(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return parseFloat(value);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const documentId = searchParams.get('documentId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify user has access to project
    const access = await query(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [projectId, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    let sql = `SELECT a.*, u.name as author_name, u.email as author_email, u.color as author_color
               FROM annotations a
               INNER JOIN users u ON a.author_id = u.id
               WHERE a.project_id = ?`;
    const params: (string | null)[] = [projectId];

    if (documentId) {
      sql += ' AND a.document_id = ?';
      params.push(documentId);
    }

    sql += ' ORDER BY a.created_at DESC';

    const annotations = await query<AnnotationRow>(sql, params);

    // Transform annotations to match frontend format
    const transformed = annotations.map((ann) => ({
      id: ann.id,
      documentId: ann.document_id,
      type: ann.type,
      page: ann.page,
      position: {
        x: safeParseFloat(ann.position_x),
        y: safeParseFloat(ann.position_y),
        ...(ann.position_width && { width: safeParseFloat(ann.position_width) }),
        ...(ann.position_height && { height: safeParseFloat(ann.position_height) }),
        ...(ann.position_radius && { radius: safeParseFloat(ann.position_radius) }),
        ...(() => {
          const points = safeJsonParse(ann.position_points);
          return points ? { points } : {};
        })(),
        ...(ann.position_path_data && { pathData: ann.position_path_data }),
        ...(() => {
          const center = safeJsonParse(ann.position_center);
          return center ? { center } : {};
        })(),
        ...(() => {
          const startPoint = safeJsonParse(ann.position_start_point);
          return startPoint ? { startPoint } : {};
        })(),
        ...(() => {
          const endPoint = safeJsonParse(ann.position_end_point);
          return endPoint ? { endPoint } : {};
        })(),
        ...(ann.position_start_angle && { startAngle: safeParseFloat(ann.position_start_angle) }),
        ...(ann.position_end_angle && { endAngle: safeParseFloat(ann.position_end_angle) }),
        ...(ann.position_sweep_flag !== null && { sweepFlag: ann.position_sweep_flag }),
        ...(ann.position_large_arc_flag !== null && { largeArcFlag: ann.position_large_arc_flag }),
      },
      content: ann.content || undefined,
      style: {
        color: ann.style_color,
        opacity: safeParseFloat(ann.style_opacity),
        ...(ann.style_stroke_width && { strokeWidth: safeParseFloat(ann.style_stroke_width) }),
        ...(ann.style_stroke_color && { strokeColor: ann.style_stroke_color }),
        ...(ann.style_fill_color && { fillColor: ann.style_fill_color }),
        ...(ann.style_font_size && { fontSize: ann.style_font_size }),
        ...(ann.style_font_family && { fontFamily: ann.style_font_family }),
      },
      author: {
        id: ann.author_id,
        name: ann.author_name,
        email: ann.author_email,
        color: ann.author_color,
      },
      isVisible: Boolean(ann.is_visible),
      metrics: {
        ...(ann.metrics_area && { area: safeParseFloat(ann.metrics_area) }),
        ...(ann.metrics_perimeter && { perimeter: safeParseFloat(ann.metrics_perimeter) }),
        ...(ann.metrics_length && { length: safeParseFloat(ann.metrics_length) }),
        ...(ann.metrics_radius && { radius: safeParseFloat(ann.metrics_radius) }),
        ...(ann.metrics_rx && { rx: safeParseFloat(ann.metrics_rx) }),
        ...(ann.metrics_ry && { ry: safeParseFloat(ann.metrics_ry) }),
        ...(ann.metrics_area_px && { area_px: safeParseFloat(ann.metrics_area_px) }),
        ...(ann.metrics_length_px && { length_px: safeParseFloat(ann.metrics_length_px) }),
        ...(ann.metrics_text && { text: ann.metrics_text }),
      },
      createdAt: ann.created_at,
      updatedAt: ann.updated_at,
    }));

    return NextResponse.json({ annotations: transformed });
  } catch (error) {
    console.error('Get annotations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, projectId, type, page, position, content, style, metrics } = body;

    if (!documentId || !projectId || !type || !page || !position || !style) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user has access to project
    const access = await query(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [projectId, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    const id = randomUUID();
    await query(
      `INSERT INTO annotations (
        id, document_id, project_id, type, page,
        position_x, position_y, position_width, position_height, position_radius,
        position_points, position_path_data, position_center, position_start_point,
        position_end_point, position_start_angle, position_end_angle,
        position_sweep_flag, position_large_arc_flag,
        content, style_color, style_opacity, style_stroke_width, style_stroke_color,
        style_fill_color, style_font_size, style_font_family,
        metrics_area, metrics_perimeter, metrics_length, metrics_radius,
        metrics_rx, metrics_ry, metrics_area_px, metrics_length_px, metrics_text,
        author_id, is_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        documentId,
        projectId,
        type,
        page,
        position.x,
        position.y,
        position.width || null,
        position.height || null,
        position.radius || null,
        position.points ? JSON.stringify(position.points) : null,
        position.pathData || null,
        position.center ? JSON.stringify(position.center) : null,
        position.startPoint ? JSON.stringify(position.startPoint) : null,
        position.endPoint ? JSON.stringify(position.endPoint) : null,
        position.startAngle || null,
        position.endAngle || null,
        position.sweepFlag || null,
        position.largeArcFlag || null,
        content || null,
        style.color,
        style.opacity || 1.0,
        style.strokeWidth || null,
        style.strokeColor || null,
        style.fillColor || null,
        style.fontSize || null,
        style.fontFamily || null,
        metrics?.area || null,
        metrics?.perimeter || null,
        metrics?.length || null,
        metrics?.radius || null,
        metrics?.rx || null,
        metrics?.ry || null,
        metrics?.area_px || null,
        metrics?.length_px || null,
        metrics?.text || null,
        decoded.userId,
        true,
      ]
    );

    const annotations = await query<AnnotationRow>(
      `SELECT a.*, u.name as author_name, u.email as author_email, u.color as author_color
       FROM annotations a
       INNER JOIN users u ON a.author_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    const ann = annotations[0];
    if (!ann) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }
    const newAnnotation = {
      id: ann.id,
      documentId: ann.document_id,
      type: ann.type,
      page: ann.page,
      position: {
        x: safeParseFloat(ann.position_x),
        y: safeParseFloat(ann.position_y),
        ...(ann.position_width && { width: safeParseFloat(ann.position_width) }),
        ...(ann.position_height && { height: safeParseFloat(ann.position_height) }),
        ...(ann.position_radius && { radius: safeParseFloat(ann.position_radius) }),
        ...(() => {
          const points = safeJsonParse(ann.position_points);
          return points ? { points } : {};
        })(),
        ...(ann.position_path_data && { pathData: ann.position_path_data }),
        ...(() => {
          const center = safeJsonParse(ann.position_center);
          return center ? { center } : {};
        })(),
        ...(() => {
          const startPoint = safeJsonParse(ann.position_start_point);
          return startPoint ? { startPoint } : {};
        })(),
        ...(() => {
          const endPoint = safeJsonParse(ann.position_end_point);
          return endPoint ? { endPoint } : {};
        })(),
        ...(ann.position_start_angle && { startAngle: safeParseFloat(ann.position_start_angle) }),
        ...(ann.position_end_angle && { endAngle: safeParseFloat(ann.position_end_angle) }),
        ...(ann.position_sweep_flag !== null && { sweepFlag: ann.position_sweep_flag }),
        ...(ann.position_large_arc_flag !== null && { largeArcFlag: ann.position_large_arc_flag }),
      },
      content: ann.content || undefined,
      style: {
        color: ann.style_color,
        opacity: safeParseFloat(ann.style_opacity),
        ...(ann.style_stroke_width && { strokeWidth: safeParseFloat(ann.style_stroke_width) }),
        ...(ann.style_stroke_color && { strokeColor: ann.style_stroke_color }),
        ...(ann.style_fill_color && { fillColor: ann.style_fill_color }),
        ...(ann.style_font_size && { fontSize: ann.style_font_size }),
        ...(ann.style_font_family && { fontFamily: ann.style_font_family }),
      },
      author: {
        id: ann.author_id,
        name: ann.author_name,
        email: ann.author_email,
        color: ann.author_color,
      },
      isVisible: Boolean(ann.is_visible),
      metrics: {
        ...(ann.metrics_area && { area: safeParseFloat(ann.metrics_area) }),
        ...(ann.metrics_perimeter && { perimeter: safeParseFloat(ann.metrics_perimeter) }),
        ...(ann.metrics_length && { length: safeParseFloat(ann.metrics_length) }),
        ...(ann.metrics_radius && { radius: safeParseFloat(ann.metrics_radius) }),
        ...(ann.metrics_rx && { rx: safeParseFloat(ann.metrics_rx) }),
        ...(ann.metrics_ry && { ry: safeParseFloat(ann.metrics_ry) }),
        ...(ann.metrics_area_px && { area_px: safeParseFloat(ann.metrics_area_px) }),
        ...(ann.metrics_length_px && { length_px: safeParseFloat(ann.metrics_length_px) }),
        ...(ann.metrics_text && { text: ann.metrics_text }),
      },
      createdAt: ann.created_at,
      updatedAt: ann.updated_at,
    };

    return NextResponse.json({ annotation: newAnnotation }, { status: 201 });
  } catch (error) {
    console.error('Create annotation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

