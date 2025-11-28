import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { PunchListItem, PunchListItemRow, ProjectUserRow, ProjectRow } from '@/types';

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
    console.log("📥 GET punch-items request received");
    
    const session = await auth();
    if (!session || !session.user) {
      console.error("❌ No session");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    console.log("🔍 Request params:", { projectId, userId: session.user.id });

    if (!projectId) {
      console.error("❌ No projectId in request");
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Find project by ID or project_id to get the UUID
    const projects = await query<ProjectRow>(
      'SELECT id FROM projects WHERE id = ? OR project_id = ?',
      [projectId, projectId]
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectUuid = projects[0].id;

    // Verify user has access to project
    console.log("🔐 Verifying project access...");
    let access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [projectUuid, session.user.id]
    );

    console.log("🔐 Access check result:", { hasAccess: access.length > 0, role: access[0]?.role });

    // Auto-assign user to project as a member if they don't have access
    if (access.length === 0) {
      const assignId = randomUUID();
      await query(
        'INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
        [assignId, projectUuid, session.user.id, 'member']
      );
      console.log(`Auto-assigned user ${session.user.id} to project ${projectUuid} as member`);
      // Re-fetch access
      access = await query<ProjectUserRow>(
        'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
        [projectUuid, session.user.id]
      );
    }

    console.log("📋 Fetching punch items from database...");
    const punchItems = await query<PunchListItemRow>(
      `SELECT p.*, u.name as created_by_name
       FROM punch_list_items p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.project_id = ?
       ORDER BY p.created_at DESC`,
      [projectId]
    );

    console.log("✅ Found punch items:", punchItems.length);

    const transformed = punchItems.map((item: PunchListItemRow): PunchListItem | null => {
      try {
        return {
          id: item.id,
          annotationId: item.annotation_id || undefined,
          documentId: item.document_id || undefined,
          description: item.description,
          demarcation: item.demarcation || '',
          demarcationId: item.demarcation_id || undefined,
          demarcationImage: item.demarcation_image || undefined,
          location: item.location || '',
          page: item.page || undefined,
          position: item.position_x !== null && item.position_y !== null
            ? { x: safeParseFloat(item.position_x), y: safeParseFloat(item.position_y) }
            : undefined,
          status: item.status as 'Open' | 'In-Progress' | 'Closed',
          percentComplete: item.percent_complete,
          assignedTo: item.assigned_to || '',
      attachments: (() => {
        if (!item.attachments || item.attachments === 'null' || item.attachments === '') {
          return [];
        }
        try {
          if (typeof item.attachments === 'string') {
            const parsed = JSON.parse(item.attachments);
            return Array.isArray(parsed) ? parsed : [];
          }
          return Array.isArray(item.attachments) ? item.attachments : [];
        } catch (e) {
          console.warn('Failed to parse attachments JSON:', item.attachments, e);
          return [];
        }
      })(),
          comments: item.comments || '',
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      } catch (transformError) {
        console.error("❌ Error transforming punch item:", item.id, transformError);
        return null;
      }
    }).filter((item: PunchListItem | null): item is PunchListItem => item !== null);

    console.log("✅ Returning transformed punch items:", transformed.length);
    return NextResponse.json({ punchItems: transformed });
  } catch (error) {
    console.error('❌ Get punch items error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
    } : {};
    console.error('Error stack:', errorStack);
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
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
    console.log("📥 Creating punch item, received data:", {
      projectId: body.projectId,
      hasDescription: !!body.description,
      hasAnnotationId: !!body.annotationId,
      hasDocumentId: !!body.documentId,
    });

    const {
      projectId,
      annotationId,
      documentId,
      description,
      demarcation,
      demarcationId,
      demarcationImage,
      location,
      page,
      position,
      status,
      percentComplete,
      assignedTo,
      attachments,
      comments,
    } = body;

    if (!projectId || !description) {
      console.error("❌ Missing required fields:", { projectId: !!projectId, description: !!description });
      return NextResponse.json(
        { error: 'projectId and description are required' },
        { status: 400 }
      );
    }

    // Find project by ID or project_id to get the UUID
    const projects = await query<ProjectRow>(
      'SELECT id FROM projects WHERE id = ? OR project_id = ?',
      [projectId, projectId]
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectUuid = projects[0].id;

    // Verify user has access to project
    let access = await query<ProjectUserRow>(
      'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
      [projectUuid, session.user.id]
    );

    // Auto-assign user to project as a member if they don't have access
    if (access.length === 0) {
      const assignId = randomUUID();
      await query(
        'INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
        [assignId, projectUuid, session.user.id, 'member']
      );
      console.log(`Auto-assigned user ${session.user.id} to project ${projectUuid} as member`);
    }

    const id = randomUUID();
    console.log("💾 Inserting punch item to database:", {
      id,
      projectId,
      description: description.substring(0, 50),
      userId: session.user.id,
    });

    try {
      await query(
        `INSERT INTO punch_list_items (
          id, project_id, annotation_id, document_id, description,
          demarcation, demarcation_id, demarcation_image, location,
          page, position_x, position_y, status, percent_complete,
          assigned_to, attachments, comments, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectUuid,
          annotationId || null,
          documentId || null,
          description,
          demarcation || null,
          demarcationId || null,
          demarcationImage || null,
          location || null,
          page || null,
          position?.x || null,
          position?.y || null,
          status || 'Open',
          percentComplete || 0,
          assignedTo || null,
          attachments ? JSON.stringify(attachments) : null,
          comments || null,
          session.user.id,
        ]
      );
      console.log("✅ Punch item inserted successfully");
    } catch (dbError) {
      console.error("❌ Database error inserting punch item:", dbError);
      if (dbError instanceof Error) {
        console.error("SQL Error details:", {
          message: dbError.message,
          name: dbError.name,
        });
      }
      throw dbError;
    }

    const items = await query<PunchListItemRow>('SELECT * FROM punch_list_items WHERE id = ?', [id]);
    const item = items[0];
    if (!item) {
      return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
    }

    const newItem = {
      id: item.id,
      annotationId: item.annotation_id || undefined,
      documentId: item.document_id || undefined,
      description: item.description,
      demarcation: item.demarcation || '',
      demarcationId: item.demarcation_id || undefined,
      demarcationImage: item.demarcation_image || undefined,
      location: item.location || '',
      page: item.page || undefined,
        position: item.position_x !== null && item.position_y !== null
        ? { x: safeParseFloat(item.position_x), y: safeParseFloat(item.position_y) }
        : undefined,
      status: item.status,
      percentComplete: item.percent_complete,
      assignedTo: item.assigned_to || '',
      attachments: (() => {
        if (!item.attachments || item.attachments === 'null' || item.attachments === '') {
          return [];
        }
        try {
          if (typeof item.attachments === 'string') {
            const parsed = JSON.parse(item.attachments);
            return Array.isArray(parsed) ? parsed : [];
          }
          return Array.isArray(item.attachments) ? item.attachments : [];
        } catch (e) {
          console.warn('Failed to parse attachments JSON:', item.attachments, e);
          return [];
        }
      })(),
      comments: item.comments || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };

    return NextResponse.json({ punchItem: newItem }, { status: 201 });
  } catch (error) {
    console.error('❌ Create punch item error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
    } : {};
    console.error('Error stack:', errorStack);
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

