import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or email", type: "text" },
        email: { label: "Email", type: "email" }, // older callers (account switcher) still send this
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier || credentials?.email || "").trim();
        if (!identifier || !credentials?.password) return null;

        await connectToDatabase();
        // Usernames are matched ignoring case, so "Sokha" and "sokha" are the same person.
        const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const user = await User.findOne({
          $or: [{ email: identifier.toLowerCase() }, { username: new RegExp(`^${escaped}$`, "i") }],
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Whatever is returned here becomes the `user` argument in the jwt
        // callback below, on this first sign-in only.
        return {
          id: user._id.toString(),
          name: user.username,
          fullName: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          bountyPoints: user.bountyPoints,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present right after a successful authorize() call —
      // on every later request we just carry the existing token forward.
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.bountyPoints = user.bountyPoints;
        token.fullName = user.fullName;
        token.username = user.username;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.bountyPoints = token.bountyPoints;
      session.user.fullName = token.fullName;
      session.user.username = token.username;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
