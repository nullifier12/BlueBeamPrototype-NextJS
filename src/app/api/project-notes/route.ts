import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { ProjectNoteRow, ProjectUserRow } from '@/types';

// Helper function to safely parse dates
function safeDate(dateValue: any): Date {
  if (!dateValue) {
    return new Date(); // Return current date as fallback
  }
  
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? new Date() : date;
}

// Helper function to safely parse mentions JSON
function parseMentions(mentionsValue: any): string[] {
  if (!mentionsValue) {
    return [];
  }

  // If already an array, return it
  if (Array.isArray(mentionsValue)) {
    return mentionsValue;
  }

  // If it's a string, try to parse it
  if (typeof mentionsValue === 'string') {
    const trimmed = mentionsValue.trim();
    
    // Handle empty strings or null strings
    if (!trimmed || trimmed === 'null' || trimmed === '') {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parsing mentions JSON:', e, 'Raw value:', trimmed);
      return [];
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify project exists
    const projects = await query(
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
      console.log(`Auto-assigned user ${session.user.id} to project ${project.id} as member`);
    }

    // Get project notes with author information
    const notes = await query<ProjectNoteRow>(
      `SELECT 
        pn.id,
        pn.project_id,
        pn.author_id,
        pn.message,
        pn.mentions,
        pn.created_at,
        pn.updated_at,
        u.name as author_name,
        u.username as author_username,
        u.email as author_email,
        u.color as author_color
       FROM project_notes pn
       INNER JOIN users u ON pn.author_id = u.id
       WHERE pn.project_id = ?
       ORDER BY pn.created_at ASC`,
      [project.id]
    );

    // Transform notes to include parsed mentions
    const transformedNotes = notes.map((note) => {
      const mentions = parseMentions(note.mentions);

      return {
        id: note.id,
        projectId: note.project_id,
        author: {
          id: note.author_id,
          username: note.author_username || '',
          name: note.author_name || '',
          email: note.author_email || '',
          color: note.author_color || '#0066cc',
        },
        message: note.message,
        mentions,
        createdAt: safeDate(note.created_at),
        updatedAt: safeDate(note.updated_at),
      };
    });

    return NextResponse.json({ notes: transformedNotes });
  } catch (error) {
    console.error('Get project notes error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, message, mentions = [] } = body;

    if (!projectId || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'Project ID and message are required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const projects = await query(
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
      console.log(`Auto-assigned user ${session.user.id} to project ${project.id} as member`);
    }

    // Create new note
    const noteId = randomUUID();
    // Ensure mentions is an array and stringify it
    const mentionsArray = Array.isArray(mentions) ? mentions : [];
    const mentionsJson = mentionsArray.length > 0 ? JSON.stringify(mentionsArray) : null;

    await query(
      'INSERT INTO project_notes (id, project_id, author_id, message, mentions) VALUES (?, ?, ?, ?, ?)',
      [noteId, project.id, session.user.id, message.trim(), mentionsJson]
    );

    // Get the created note with author information
    const createdNotes = await query<ProjectNoteRow>(
      `SELECT 
        pn.id,
        pn.project_id,
        pn.author_id,
        pn.message,
        pn.mentions,
        pn.created_at,
        pn.updated_at,
        u.name as author_name,
        u.username as author_username,
        u.email as author_email,
        u.color as author_color
       FROM project_notes pn
       INNER JOIN users u ON pn.author_id = u.id
       WHERE pn.id = ?`,
      [noteId]
    );

    if (createdNotes.length === 0) {
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    const note = createdNotes[0];
    const parsedMentions = parseMentions(note.mentions);

    const transformedNote = {
      id: note.id,
      projectId: note.project_id,
      author: {
        id: note.author_id,
        username: note.author_username || '',
        name: note.author_name || '',
        email: note.author_email || '',
        color: note.author_color || '#0066cc',
      },
      message: note.message,
      mentions: parsedMentions,
      createdAt: safeDate(note.created_at),
      updatedAt: safeDate(note.updated_at),
    };

    return NextResponse.json({ note: transformedNote }, { status: 201 });
  } catch (error) {
    console.error('Create project note error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

