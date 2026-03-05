import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AppRole } from "@/types";
import { DEMO_MODE } from "@/lib/env";

// Entra ID group IDs → application roles mapping
// Configure these in your Azure AD app registration
const GROUP_ROLE_MAP: Record<string, AppRole["name"]> = {
  [process.env.ENTRA_GROUP_ANALYSTS ?? ""]: "analyst",
  [process.env.ENTRA_GROUP_REVIEWERS ?? ""]: "reviewer",
  [process.env.ENTRA_GROUP_ADMINS ?? ""]: "admin",
  [process.env.ENTRA_GROUP_VIEWONLY ?? ""]: "readonly",
};

function resolveRole(groups: string[]): AppRole["name"] {
  // Highest privilege wins
  const priority: AppRole["name"][] = ["admin", "reviewer", "analyst", "readonly"];
  for (const role of priority) {
    const groupId = Object.entries(GROUP_ROLE_MAP).find(([, r]) => r === role)?.[0];
    if (groupId && groups.includes(groupId)) return role;
  }
  return "readonly";
}

const demoProvider = CredentialsProvider({
  id: "demo",
  name: "Demo",
  credentials: {},
  async authorize() {
    return { id: "demo-user", name: "Demo User", email: "demo@example.com" };
  },
});

const azureProvider = {
  id: "azure-ad",
  name: "Microsoft Entra ID",
  type: "oauth" as const,
  wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: "openid profile email User.Read GroupMember.Read.All",
    },
  },
  profile(profile: Record<string, string>) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email ?? profile.preferred_username,
      image: null,
    };
  },
};

export const authOptions: NextAuthOptions = {
  providers: DEMO_MODE ? [demoProvider] : [azureProvider],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (DEMO_MODE) {
        token.upn = "demo@example.com";
        token.role = "admin";
        token.groups = [];
        return token;
      }
      if (account && profile) {
        token.accessToken = account.access_token;
        token.upn =
          (profile as Record<string, unknown>).preferred_username as string ??
          (profile as Record<string, unknown>).email as string;
        token.groupsRefreshedAt = Date.now();
        // Fetch group memberships from Microsoft Graph
        try {
          const res = await fetch(
            "https://graph.microsoft.com/v1.0/me/memberOf",
            { headers: { Authorization: `Bearer ${account.access_token}` } }
          );
          const data = await res.json();
          const groupIds = (data.value ?? [])
            .filter((m: Record<string, string>) => m["@odata.type"] === "#microsoft.graph.group")
            .map((g: Record<string, string>) => g.id);
          token.groups = groupIds;
          token.role = resolveRole(groupIds);
        } catch {
          token.groups = [];
          token.role = "readonly";
        }
      }

      // #14: Re-check group membership every hour to catch role changes / terminations
      const groupsAge = Date.now() - ((token.groupsRefreshedAt as number) ?? 0);
      if (groupsAge > 60 * 60 * 1000 && token.accessToken) {
        try {
          const res = await fetch(
            "https://graph.microsoft.com/v1.0/me/memberOf",
            { headers: { Authorization: `Bearer ${token.accessToken}` } }
          );
          if (res.ok) {
            const data = await res.json();
            const groupIds = (data.value ?? [])
              .filter((m: Record<string, string>) => m["@odata.type"] === "#microsoft.graph.group")
              .map((g: Record<string, string>) => g.id);
            token.groups = groupIds;
            token.role = resolveRole(groupIds);
            token.groupsRefreshedAt = Date.now();
          }
        } catch {
          // Keep existing groups on refresh failure
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      return {
        ...session,
        user: {
          ...session.user,
          upn: token.upn as string,
          role: token.role as AppRole["name"],
          groups: token.groups as string[],
        },
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // #13: 8 hours — one business day
  },
};

export function hasPermission(
  role: AppRole["name"],
  permission: string
): boolean {
  const { ROLE_PERMISSIONS } = require("@/types");
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
