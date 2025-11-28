import { NextRequest, NextResponse } from "next/server";
import { auth } from "../[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        username: session.user.username,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image || undefined,
        color: session.user.color,
      },
      projectId: session.projectId,
    });
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

