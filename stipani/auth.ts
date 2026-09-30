import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail, viewerForEmail } from "@/lib/config";
import { GOOGLE_SCOPES } from "@/lib/scopes";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // refresh token za server-side Calendar pozive
          prompt: "select_account consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    // Server-side allowlist: nedopušteni korisnik nikad ne dobije sesiju.
    signIn({ user, profile }) {
      return profile?.email_verified === true && isAllowedEmail(user.email);
    },
    jwt({ token, account }) {
      // Ako je email kasnije maknut s allowliste, sesija prestaje vrijediti.
      if (!isAllowedEmail(token.email)) return null;
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    // Tokeni se NIKAD ne kopiraju u session objekt koji ide klijentu.
    session({ session, token }) {
      session.user.owner = viewerForEmail(token.email);
      return session;
    },
  },
});
