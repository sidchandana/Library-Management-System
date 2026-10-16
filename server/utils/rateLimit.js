function rateLimit({ windowMs, max, message, key }) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(k);
    }
  }, Math.min(windowMs, 60 * 1000));
  cleanup.unref();

  return (req, res, next) => {
    const id = key ? key(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || 'Too many attempts. Please wait a few minutes and try again.' });
    }
    return next();
  };
}

module.exports = rateLimit;
