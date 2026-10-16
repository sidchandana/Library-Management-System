function baseOptions() {
  const crossSite = process.env.CROSS_SITE_COOKIES === 'true';
  return {
    httpOnly: true,
    sameSite: crossSite ? 'none' : 'lax',
    secure: crossSite || process.env.NODE_ENV === 'production',
    path: '/',
  };
}

function authCookieOptions() {
  return { ...baseOptions(), maxAge: 25892000000 };
}

function clearCookieOptions() {
  return baseOptions();
}

const STUDENT_COOKIE = 'jwtoken';
const ADMIN_COOKIE = 'jwtoken_admin';

module.exports = { authCookieOptions, clearCookieOptions, STUDENT_COOKIE, ADMIN_COOKIE };
