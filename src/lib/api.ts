const API_BASE = '/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Auth
export async function login(username: string, password: string, projectId?: string) {
  return apiRequest<{ success: boolean; user: any; projectId?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, projectId }),
  });
}

// Projects
export async function getProject(projectId: string) {
  return apiRequest<{ project: any }>(`/projects/${projectId}`);
}

export async function updateProject(projectId: string, data: any) {
  return apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Documents
export async function getDocuments(projectId: string) {
  return apiRequest<{ documents: any[] }>(`/documents?projectId=${projectId}`);
}

export async function createDocument(data: any) {
  return apiRequest<{ document: any }>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Annotations
export async function getAnnotations(projectId: string, documentId?: string) {
  const url = documentId
    ? `/annotations?projectId=${projectId}&documentId=${documentId}`
    : `/annotations?projectId=${projectId}`;
  return apiRequest<{ annotations: any[] }>(url);
}

export async function createAnnotation(data: any) {
  return apiRequest<{ annotation: any }>('/annotations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAnnotation(id: string, data: any) {
  return apiRequest<{ success: boolean }>(`/annotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAnnotation(id: string) {
  return apiRequest<{ success: boolean }>(`/annotations/${id}`, {
    method: 'DELETE',
  });
}

// Punch Items
export async function getPunchItems(projectId: string) {
  return apiRequest<{ punchItems: any[] }>(`/punch-items?projectId=${projectId}`);
}

export async function createPunchItem(data: any) {
  return apiRequest<{ punchItem: any }>('/punch-items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePunchItem(id: string, data: any) {
  return apiRequest<{ success: boolean }>(`/punch-items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePunchItem(id: string) {
  return apiRequest<{ success: boolean }>(`/punch-items/${id}`, {
    method: 'DELETE',
  });
}

