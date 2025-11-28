import { User, Project, PDFDocument, Annotation, PunchListItem } from "@/types";

const API_BASE = "/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  // Read response body only once
  const data = await response.json().catch(() => ({ error: "Unknown error" }));

  if (!response.ok) {
    throw new Error((data as any).error || `HTTP error! status: ${response.status}`);
  }

  return data as T;
}

// Auth
export async function login(
  username: string,
  password: string,
  projectId?: string
) {
  return apiRequest<{ success: boolean; user: User; projectId?: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password, projectId }),
    }
  );
}

export async function getCurrentSession() {
  return apiRequest<{ success: boolean; user: User; projectId?: string }>(
    "/auth/me"
  );
}

export async function logout() {
  return apiRequest<{ success: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function register(
  username: string,
  password: string,
  email: string,
  name: string
) {
  return apiRequest<{ success: boolean; user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, email, name }),
  });
}

// Projects
export async function getProject(projectId: string) {
  return apiRequest<{ project: Project }>(`/projects/${projectId}`);
}

export async function updateProject(projectId: string, data: Partial<Project>) {
  return apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Documents
export async function getDocuments(projectId: string) {
  return apiRequest<{ documents: PDFDocument[] }>(
    `/documents?projectId=${projectId}`
  );
}

export async function createDocument(
  data: Partial<PDFDocument> & {
    projectId: string;
    name: string;
    fileSize: number;
    filePath?: string;
    fileUrl?: string;
    fileData?: string;
    pageCount?: number;
  }
) {
  return apiRequest<{
    document: PDFDocument;
    projectUuid?: string;
    projectId?: string;
  }>("/documents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Annotations
export async function getAnnotations(projectId: string, documentId?: string) {
  const url = documentId
    ? `/annotations?projectId=${projectId}&documentId=${documentId}`
    : `/annotations?projectId=${projectId}`;
  return apiRequest<{ annotations: Annotation[] }>(url);
}

export async function createAnnotation(
  data: Partial<Annotation> & {
    documentId: string;
    projectId: string;
    type: string;
    page: number;
    position: { x: number; y: number };
    style: { color: string; opacity: number };
  }
) {
  return apiRequest<{ annotation: Annotation }>("/annotations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAnnotation(id: string, data: Partial<Annotation>) {
  return apiRequest<{ success: boolean }>(`/annotations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAnnotation(id: string) {
  return apiRequest<{ success: boolean }>(`/annotations/${id}`, {
    method: "DELETE",
  });
}

// Punch Items
export async function getPunchItems(projectId: string) {
  return apiRequest<{ punchItems: PunchListItem[] }>(
    `/punch-items?projectId=${projectId}`
  );
}

export async function createPunchItem(
  data: Partial<PunchListItem> & { projectId: string; description: string }
) {
  return apiRequest<{ punchItem: PunchListItem }>("/punch-items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePunchItem(
  id: string,
  data: Partial<PunchListItem>
) {
  return apiRequest<{ success: boolean }>(`/punch-items/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePunchItem(id: string) {
  return apiRequest<{ success: boolean }>(`/punch-items/${id}`, {
    method: "DELETE",
  });
}
