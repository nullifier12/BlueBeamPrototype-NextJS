import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { ProjectRow, ProjectUserRow, UserRow } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const projects = await query<ProjectRow>(
      'SELECT id FROM projects WHERE id = ? OR project_id = ?',
      [projectId, projectId]
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Verify user has access to project
    let access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [project.id, session.user.id]
    );

    // Auto-assign user to project if they don't have access
    if (access.length === 0) {
      const assignId = randomUUID();
      await query(
        'INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
        [assignId, project.id, session.user.id, 'member']
      );
    }

    // Get all users in the project
    const users = await query<UserRow & { username: string }>(
      `SELECT u.id, u.username, u.name, u.email, u.color, u.avatar
       FROM users u
       INNER JOIN project_users pu ON u.id = pu.user_id
       WHERE pu.project_id = ?
       ORDER BY u.name ASC`,
      [project.id]
    );

    const transformedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      color: user.color || '#0066cc',
      avatar: user.avatar || undefined,
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error('Get project users error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

