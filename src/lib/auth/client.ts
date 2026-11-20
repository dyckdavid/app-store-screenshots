"use client";

import { createAuthClient } from "@neon/auth/next";

/** Browser auth client; talks to our `/api/auth/*` proxy route. */
export const authClient = createAuthClient();
