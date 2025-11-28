import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { randomUUID } from "crypto";
import { ProjectRow, DocumentRow, ProjectUserRow } from "@/types";

// Allow longer processing time for large file uploads
export const maxDuration = 300; // 5 minutes
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // First, find the project by project_id (human-readable) or id (UUID)
    const projects = await query<ProjectRow>(
      "SELECT id, project_id FROM projects WHERE id = ? OR project_id = ?",
      [projectId, projectId]
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projects[0];
    const projectUuid = project.id; // Use the UUID for project_users lookup

    // Verify user has access to project (using UUID)
    let access = await query<ProjectUserRow>(
      "SELECT role FROM project_users WHERE project_id = ? AND user_id = ?",
      [projectUuid, decoded.userId]
    );

    // Auto-assign user to project as a member if they don't have access
    if (access.length === 0) {
      const assignId = randomUUID();
      await query(
        "INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)",
        [assignId, projectUuid, decoded.userId, "member"]
      );
      console.log(
        `Auto-assigned user ${decoded.userId} to project ${projectUuid} as member`
      );
    }

    const documents = await query<DocumentRow>(
      `SELECT d.*, u.name as created_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.project_id = ? AND d.status != 'deleted'
       ORDER BY d.created_at DESC`,
      [projectUuid]
    );

    // Return documents with file_data (base64) - client will convert to blob URL
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Try to get token, but don't require it for uploads
    const token = request.cookies.get("auth_token")?.value;
    let decoded: { userId: string; username: string; projectId?: string } | null = null;
    
    if (token) {
      decoded = verifyToken(token);
      console.log("📥 POST /api/documents - Token found:", {
        hasToken: !!token,
        decoded: !!decoded,
        userId: decoded?.userId,
      });
    } else {
      console.log("📥 POST /api/documents - No token, allowing upload without auth");
    }

    const body = await request.json();
    const {
      projectId,
      name,
      filePath,
      fileUrl,
      fileSize,
      pageCount,
      fileData,
    } = body;

    if (!projectId || !name || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // First, find the project by project_id (human-readable) or id (UUID)
    const projects = await query<ProjectRow>(
      "SELECT id, project_id FROM projects WHERE id = ? OR project_id = ?",
      [projectId, projectId]
    );

    let projectUuid: string;

    if (projects.length === 0) {
      // Project doesn't exist - create it
      projectUuid = randomUUID();
      await query(
        `INSERT INTO projects (id, project_id, name, created_by, calibration_factor)
         VALUES (?, ?, ?, ?, 1.0)`,
        [projectUuid, projectId, projectId, decoded?.userId || null]
      );

      // Assign user as owner if authenticated, otherwise skip
      if (decoded?.userId) {
        const assignId = randomUUID();
        await query(
          "INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)",
          [assignId, projectUuid, decoded.userId, "owner"]
        );
        console.log(
          `Created new project ${projectId} (${projectUuid}) and assigned user ${decoded.userId} as owner`
        );
      } else {
        console.log(
          `Created new project ${projectId} (${projectUuid}) without owner (no auth)`
        );
      }
    } else {
      const project = projects[0];
      projectUuid = project.id; // Use the UUID for project_users lookup

      // Auto-assign user to project if authenticated
      if (decoded?.userId) {
        const access = await query<ProjectUserRow>(
          "SELECT role FROM project_users WHERE project_id = ? AND user_id = ?",
          [projectUuid, decoded.userId]
        );

        if (access.length === 0) {
          // Auto-assign user to project as a member if they don't have access
          const assignId = randomUUID();
          await query(
            "INSERT INTO project_users (id, project_id, user_id, role) VALUES (?, ?, ?, ?)",
            [assignId, projectUuid, decoded.userId, "member"]
          );
          console.log(
            `Auto-assigned user ${decoded.userId} to project ${projectUuid} as member`
          );
        }
      }
    }

    const id = randomUUID();
    await query(
      `INSERT INTO documents (id, project_id, name, file_path, file_url, file_data, file_size, page_count, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        id,
        projectUuid,
        name,
        filePath || null,
        fileUrl || null,
        fileData || null,
        fileSize,
        pageCount || 0,
        decoded?.userId || null,
      ]
    );

    const documents = await query<DocumentRow>(
      "SELECT * FROM documents WHERE id = ?",
      [id]
    );

    // Get the human-readable project_id from the project
    const projectInfo = await query<ProjectRow>(
      "SELECT project_id FROM projects WHERE id = ?",
      [projectUuid]
    );
    const humanReadableProjectId = projectInfo[0]?.project_id || projectId;

    // Return the document along with the project UUID so frontend can update currentProjectId
    return NextResponse.json(
      {
        document: documents[0],
        projectUuid: projectUuid,
        projectId: humanReadableProjectId, // Return the human-readable project ID
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create document error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
      { status: 500 }
    );
  }
}
