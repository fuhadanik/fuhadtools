import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'sf_session';

export function createSessionToken(data) {
  return jwt.sign(data, SESSION_SECRET, {
    expiresIn: '8h',
  });
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch (error) {
    return null;
  }
}

export function setSessionCookie(res, data) {
  const token = createSessionToken(data);
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60, // 8 hours
    path: '/',
  });
  res.setHeader('Set-Cookie', cookie);
}

export function getSessionFromRequest(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function clearSessionCookie(res) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  res.setHeader('Set-Cookie', cookie);
}
