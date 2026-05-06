/**
 * Raw Cognito authentication helpers using amazon-cognito-identity-js.
 *
 * This library is one level below Amplify — it makes the actual Cognito
 * API calls directly. You can see exactly what's happening:
 *   signIn → calls InitiateAuth on Cognito's endpoint
 *   confirms JWT tokens → stores them in AsyncStorage (or memory on web)
 *
 * Cognito auth flow (USER_PASSWORD_AUTH):
 *   1. App sends email + password to Cognito
 *   2. Cognito validates, returns 3 tokens:
 *      - IdToken: who the user is (email, sub/userId, etc.)
 *      - AccessToken: what the user can do (used in API Authorization header)
 *      - RefreshToken: used to get new tokens without re-entering password
 *   3. App stores tokens, includes AccessToken in every API request
 *   4. API Gateway checks AccessToken against Cognito's public keys
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { CONFIG } from './config';

// The User Pool represents your Cognito pool.
// poolId + clientId come from your CDK stack outputs.
const userPool = new CognitoUserPool({
  UserPoolId: CONFIG.COGNITO_USER_POOL_ID,
  ClientId: CONFIG.COGNITO_CLIENT_ID,
});

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  userId: string;      // Cognito sub (unique user ID)
  email: string;
}

/**
 * Sign in with email + password.
 * Returns tokens on success, throws on failure.
 */
export function signIn(email: string, password: string): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve(extractTokens(session));
      },
      onFailure: (err) => {
        reject(err);
      },
      // Called if user must change password on first login
      newPasswordRequired: () => {
        reject(new Error('Password change required'));
      },
    });
  });
}

/**
 * Register a new user. Cognito sends a verification email automatically.
 * After this, the user must call verifyEmail() with the code from the email.
 */
export function register(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
    ];

    userPool.signUp(email, password, attributes, [], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Verify email with the 6-digit code Cognito sends after registration.
 */
export function verifyEmail(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Send a password reset code to the user's email.
 */
export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

/**
 * Confirm password reset with the code from the email.
 */
export function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

/**
 * Sign out and clear all local tokens.
 */
export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

/**
 * Get valid tokens for the currently signed-in user.
 * Automatically refreshes the AccessToken if it has expired.
 * Returns null if not signed in.
 */
export function getTokens(): Promise<AuthTokens | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(extractTokens(session));
    });
  });
}

function extractTokens(session: CognitoUserSession): AuthTokens {
  const idPayload = session.getIdToken().decodePayload();
  return {
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    userId: idPayload.sub,
    email: idPayload.email,
  };
}
