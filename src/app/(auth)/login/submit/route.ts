import { NextResponse } from "next/server";
import { authenticateWithPassword, setAuthCookies } from "@/lib/auth";
import { formatAuthError } from "@/lib/auth-errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    const result = await authenticateWithPassword(email ?? "", password ?? "");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({ user: result.user });
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: formatAuthError(error) }, { status: 500 });
  }
}
