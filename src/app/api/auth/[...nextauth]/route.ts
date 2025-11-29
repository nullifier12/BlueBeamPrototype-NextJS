import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { UserRow, ProjectRow } from "@/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Required for NextAuth v5 in production
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        projectId: { label: "Project ID", type: "text", required: false },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Get user from database
          const users = await query<
            UserRow & { username: string; password: string }
          >(
            "SELECT id, username, password, name, email, avatar, color FROM users WHERE username = ?",
            [credentials.username as string]
          );

          if (users.length === 0) {
            return null;
          }

          const user = users[0];
          const isValid = await verifyPassword(
            credentials.password as string,
            user.password
          );

          if (!isValid) {
            return null;
          }

          // If projectId is provided, verify project exists (no access check - any user can access any project)
          let projectId: string | undefined;
          if (credentials.projectId) {
            const projectIdValue = credentials.projectId as string;
            const projects = await query<ProjectRow>(
              `SELECT id, project_id 
               FROM projects 
               WHERE project_id = ? OR id = ?`,
              [projectIdValue, projectIdValue]
            );

            if (projects.length > 0) {
              projectId = projects[0].id;
            }
          }

          return {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            avatar: user.avatar || undefined,
            color: user.color,
            projectId: projectId,
          };
        } catch (error) {
          console.error("NextAuth authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.color = (user as any).color;
        token.projectId = (user as any).projectId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).username = token.username as string;
        (session.user as any).color = token.color as string;
        (session as any).projectId = token.projectId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Use the existing login page
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
});

export const { GET, POST } = handlers;
