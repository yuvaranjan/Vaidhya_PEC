import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Signed httpOnly cookie session. No NextAuth — its callback/adapter surface is
 * larger than anything this build needs.
 *
 *   Patient  → phone + OTP (demo OTP is 123456, shown on screen)
 *   Doctor   → phone + password (bcrypt against the seeded hash)
 *
 * There is NO nurse account: the nurse is physically present and works inside
 * the patient's session.
 */

export interface AppSession {
  role?: "patient" | "doctor";
  patientId?: string;
  doctorId?: string;
  name?: string;
  /** Set by the offline identity override — carried onto the visit row. */
  identityUnverifiedOffline?: boolean;
  visitId?: string;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "vaidhya_default_fallback_session_secret_key_32_chars",
  cookieName: "vaidhya_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    // Demo runs over plain http on a LAN — a secure cookie would never be sent.
    secure: false,
    maxAge: 60 * 60 * 12,
  },
};

export async function getSession() {
  return getIronSession<AppSession>(await cookies(), sessionOptions);
}

/** The demo OTP. Real phone lookup, fixed code, displayed on screen as "Demo OTP". */
export const DEMO_OTP = "123456";
