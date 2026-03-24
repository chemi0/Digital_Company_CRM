export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        userId: string;
        organization: {
          id: string;
          slug: string;
          name: string;
        };
        membership: {
          id: string;
          role: "admin" | "manager" | "sales_rep";
        };
      };
    }
  }
}
