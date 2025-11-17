import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

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

    // Get punch item to check project access
    const items = await query('SELECT project_id FROM punch_list_items WHERE id = ?', [id]);
    if (items.length === 0) {
      return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
    }

    // Verify user has access to project
    const access = await query(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [items[0].project_id, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    await query(
      `UPDATE punch_list_items SET
        description = ?,
        demarcation = ?,
        demarcation_id = ?,
        demarcation_image = ?,
        location = ?,
        page = ?,
        position_x = ?,
        position_y = ?,
        status = ?,
        percent_complete = ?,
        assigned_to = ?,
        attachments = ?,
        comments = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.description,
        body.demarcation || null,
        body.demarcationId || null,
        body.demarcationImage || null,
        body.location || null,
        body.page || null,
        body.position?.x || null,
        body.position?.y || null,
        body.status,
        body.percentComplete || 0,
        body.assignedTo || null,
        body.attachments ? JSON.stringify(body.attachments) : null,
        body.comments || null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update punch item error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
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

    // Get punch item to check project access
    const items = await query('SELECT project_id FROM punch_list_items WHERE id = ?', [id]);
    if (items.length === 0) {
      return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
    }

    // Verify user has access to project
    const access = await query(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [items[0].project_id, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    await query('DELETE FROM punch_list_items WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete punch item error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

