// simple Vercel Serverless function to serve and (best-effort) save tabs
const fs = require('fs');
const path = require('path');

const DEFAULT_TABS = [
  { name: 'Basic Scale', tab: 'def#gabc#', readOnly: true },
  { name: 'Extended Scale', tab: 'def# gab c#\nd+e+f#+ g+a+b+ c#+\nd++e++f#++ g++a++b++ c#++', readOnly: true }
];

const TABS_FILE = path.join(__dirname, '..', 'tabs.json');

// initialize in-memory store from file or default
let tabsStore = DEFAULT_TABS.slice();
try {
  if (fs.existsSync(TABS_FILE)) {
    const s = fs.readFileSync(TABS_FILE, 'utf8');
    tabsStore = JSON.parse(s);
  }
} catch (e) {
  tabsStore = DEFAULT_TABS.slice();
}

module.exports = (req, res) => {
  // GET -> return tabs
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(tabsStore));
  }

  // POST -> attempt to save (requires SECRET header match)
  if (req.method === 'POST') {
    const secretHeader = req.headers['secret'] || req.headers['Secret'] || req.headers['SECRET'];
    const SECRET = process.env.SECRET;

    if (!SECRET || secretHeader !== SECRET) {
      return res.status(403).send('Forbidden');
    }

    let bodyData = [];
    req.on('data', (chunk) => bodyData.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(bodyData).toString();
        const payload = JSON.parse(raw);
        // update in-memory store
        tabsStore = payload;

        // best-effort: write to tabs.json (may not persist across cold-starts on serverless)
        try {
          fs.writeFileSync(TABS_FILE, JSON.stringify(tabsStore), 'utf8');
        } catch (writeErr) {
          // ignore write errors (but still return success) — user warned about persistence in README
          console.warn('Unable to write tabs file on serverless environment:', writeErr && writeErr.message);
        }

        return res.status(204).send('');
      } catch (err) {
        console.error('Failed to parse/handle POST body:', err && err.message);
        return res.status(400).send('Bad Request');
      }
    });
    return;
  }

  // other methods not allowed
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).send('Method Not Allowed');
};