import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ProjectRow, ProjectUserRow } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

    const { projectId } = await params;
    const projects = await query<ProjectRow>(
      `SELECT p.*, u.name as created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ? OR p.project_id = ?`,
      [projectId, projectId]
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Verify user has access
    const access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [project.id, decoded.userId]
    );

    if (access.length === 0) {
      return NextResponse.json({ error: 'No access to project' }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

    const { projectId } = await params;
    const body = await request.json();

    // Verify user has access
    const access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [projectId, decoded.userId]
    );

    if (access.length === 0 || (access[0].role !== 'owner' && access[0].role !== 'admin')) {
      return NextResponse.json({ error: 'No permission to update project' }, { status: 403 });
    }

    // Build dynamic UPDATE query - only update fields that are provided
    const updateFields: string[] = [];
    const updateValues: (string | number | null | undefined)[] = [];
    
    // Only include fields that are explicitly provided in the request body
    if (body.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(body.name);
    }
    if (body.location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(body.location === null ? null : body.location);
    }
    if (body.target_completion !== undefined) {
      updateFields.push('target_completion = ?');
      updateValues.push(body.target_completion === null ? null : body.target_completion);
    }
    if (body.company_name !== undefined) {
      updateFields.push('company_name = ?');
      updateValues.push(body.company_name === null ? null : body.company_name);
    }
    if (body.calibration_factor !== undefined) {
      updateFields.push('calibration_factor = ?');
      updateValues.push(body.calibration_factor === null ? null : body.calibration_factor);
    }
    if (body.project_notes !== undefined) {
      updateFields.push('project_notes = ?');
      updateValues.push(body.project_notes === null ? null : body.project_notes);
    }
    
    // Always update updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updateFields.length === 1) {
      // Only updated_at would be updated, which is fine but not very useful
      // Still proceed with the update
    }
    
    // Add WHERE clause parameters
    updateValues.push(projectId, projectId);
    
    await query(
      `UPDATE projects SET ${updateFields.join(', ')}
       WHERE id = ? OR project_id = ?`,
      updateValues
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update project error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

