import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isRoot = pathname === '/';
      const isChatPage = pathname.startsWith('/chat');
      const isOnRegister = pathname === '/register';
      const isOnLogin = pathname === '/login';

      if (isRoot || isChatPage) return true;

      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
      }

      if (isOnRegister || isOnLogin) return true;

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;