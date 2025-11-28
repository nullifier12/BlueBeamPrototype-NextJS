import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { UserRow } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email, name } = body;

    if (!username || !password || !email || !name) {
      return NextResponse.json(
        { error: "Username, password, email, and name are required" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUsers = await query<UserRow & { username: string }>(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate user ID
    const userId = uuidv4();

    // Generate random color for user
    const colors = [
      "#0066cc",
      "#cc0000",
      "#00cc00",
      "#cc00cc",
      "#00cccc",
      "#cccc00",
      "#cc6600",
      "#0066cc",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Insert new user
    await query(
      `INSERT INTO users (id, username, password, name, email, color) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, name, email, randomColor]
    );

    // Get the created user
    const newUsers = await query<UserRow & { username: string }>(
      "SELECT id, username, name, email, avatar, color FROM users WHERE id = ?",
      [userId]
    );

    if (newUsers.length === 0) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const user = newUsers[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar || undefined,
        color: user.color,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
      { status: 500 }
    );
  }
}

