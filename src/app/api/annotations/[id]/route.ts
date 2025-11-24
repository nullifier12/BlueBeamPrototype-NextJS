import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { AnnotationRow, ProjectUserRow } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { position, content, style, metrics, isVisible } = body;

    // Get annotation to check project access
    const annotations = await query<AnnotationRow>('SELECT project_id, author_id FROM annotations WHERE id = ?', [id]);
    if (annotations.length === 0) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const annotation = annotations[0];
    
    // Verify user has access to project
    const access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [annotation.project_id, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    // Update annotation
    await query(
      `UPDATE annotations SET
        position_x = ?,
        position_y = ?,
        position_width = ?,
        position_height = ?,
        position_radius = ?,
        position_points = ?,
        position_path_data = ?,
        position_center = ?,
        position_start_point = ?,
        position_end_point = ?,
        position_start_angle = ?,
        position_end_angle = ?,
        position_sweep_flag = ?,
        position_large_arc_flag = ?,
        content = ?,
        style_color = ?,
        style_opacity = ?,
        style_stroke_width = ?,
        style_stroke_color = ?,
        style_fill_color = ?,
        style_font_size = ?,
        style_font_family = ?,
        metrics_area = ?,
        metrics_perimeter = ?,
        metrics_length = ?,
        metrics_radius = ?,
        metrics_rx = ?,
        metrics_ry = ?,
        metrics_area_px = ?,
        metrics_length_px = ?,
        metrics_text = ?,
        is_visible = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        position?.x,
        position?.y,
        position?.width || null,
        position?.height || null,
        position?.radius || null,
        position?.points ? JSON.stringify(position.points) : null,
        position?.pathData || null,
        position?.center ? JSON.stringify(position.center) : null,
        position?.startPoint ? JSON.stringify(position.startPoint) : null,
        position?.endPoint ? JSON.stringify(position.endPoint) : null,
        position?.startAngle || null,
        position?.endAngle || null,
        position?.sweepFlag || null,
        position?.largeArcFlag || null,
        content || null,
        style?.color,
        style?.opacity || 1.0,
        style?.strokeWidth || null,
        style?.strokeColor || null,
        style?.fillColor || null,
        style?.fontSize || null,
        style?.fontFamily || null,
        metrics?.area || null,
        metrics?.perimeter || null,
        metrics?.length || null,
        metrics?.radius || null,
        metrics?.rx || null,
        metrics?.ry || null,
        metrics?.area_px || null,
        metrics?.length_px || null,
        metrics?.text || null,
        isVisible !== undefined ? isVisible : true,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update annotation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    // Get annotation to check project access
    const annotations = await query<AnnotationRow>('SELECT project_id FROM annotations WHERE id = ?', [id]);
    if (annotations.length === 0) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Verify user has access to project
    const access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [annotations[0].project_id, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    await query('DELETE FROM annotations WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

