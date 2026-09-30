import type { DefaultSession } from "next-auth";
import type { Viewer } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: { owner: Viewer | null } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // sekunde (epoch)
  }
}
