import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectToDatabase();
        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Whatever is returned here becomes the `user` argument in the jwt
        // callback below, on this first sign-in only.
        return {
          id: user._id.toString(),
          name: user.username,
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
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.bountyPoints = token.bountyPoints;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
