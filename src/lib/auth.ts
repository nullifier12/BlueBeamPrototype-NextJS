import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { UserRow, ProjectRow } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(username: string, password: string, projectId?: string): Promise<{ user: User; token: string; projectId?: string } | null> {
  const users = await query<UserRow & { username: string; password: string }>(
    'SELECT id, username, password, name, email, avatar, color FROM users WHERE username = ?',
    [username]
  );

  if (users.length === 0) {
    return null;
  }

  const user = users[0];
  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    return null;
  }

  // If projectId is provided, verify user has access to it
  if (projectId) {
    const projectAccess = await query<ProjectRow & { project_id: string }>(
      `SELECT p.id, p.project_id 
       FROM projects p
       INNER JOIN project_users pu ON p.id = pu.project_id
       WHERE pu.user_id = ? AND (p.project_id = ? OR p.id = ?)`,
      [user.id, projectId, projectId]
    );

    if (projectAccess.length === 0) {
      return null;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, projectId: projectAccess[0].id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar || undefined,
        color: user.color,
      },
      token,
      projectId: projectAccess[0].id,
    };
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: user.avatar || undefined,
      color: user.color,
    },
    token,
  };
}

interface JwtPayload {
  userId: string;
  username: string;
  projectId?: string;
}

export function verifyToken(token: string): { userId: string; username: string; projectId?: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return {
      userId: decoded.userId,
      username: decoded.username,
      projectId: decoded.projectId,
    };
  } catch {
    return null;
  }
}



