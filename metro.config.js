const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Dev only: the app posts its push token here (src/services/push.js tellDevServer) so `npm run push:in|out` can reach the phone.
const PUSH_FILE = path.join(__dirname, '.push-token.json');
const passOn = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = passOn ? passOn(middleware, server) : middleware;
  return (req, res, fallthrough) => {
    if (req.method !== 'POST' || req.url !== '/__push-token') return next(req, res, fallthrough);
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const phone = JSON.parse(body);
        // One entry per phone token, so push:in|out reaches every phone; the newest token-less report explains why.
        let phones = {};
        try { phones = JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8')); } catch {}
        if (phones.os) phones = {}; // older one-phone file
        phones[phone.token || '_noToken'] = phone;
        fs.writeFileSync(PUSH_FILE, JSON.stringify(phones, null, 2));
        res.end('ok');
      } catch {
        res.statusCode = 400;
        res.end('bad json');
      }
    });
  };
};

module.exports = withNativeWind(config, { input: './src/global.css' });
