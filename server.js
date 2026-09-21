const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const UP = path.join(DATA, 'uploads');
const DBFILE = path.join(DATA, 'inventory.json');

fs.mkdirSync(UP, { recursive: true });
if (!fs.existsSync(DBFILE)) fs.writeFileSync(DBFILE, JSON.stringify({ inspections: [] }, null, 2));

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DBFILE, 'utf8')); }
  catch { return { inspections: [] }; }
}
function saveDB(db) {
  const tmp = DBFILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DBFILE);
}
function publicRow(r) {
  return { ...r, photos: (r.photos || []).map(f => '/uploads/' + f) };
}

const storage = multer.diskStorage({
  destination: UP,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(5).toString('hex') + path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits: { files: 20, fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC));
app.use('/uploads', express.static(UP));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/inspections', (req, res) => {
  const db = loadDB();
  res.json([...db.inspections].sort((a,b) => b.created-a.created).map(publicRow));
});
app.get('/api/inspections/:id', (req, res) => {
  const r = loadDB().inspections.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  res.json(publicRow(r));
});
app.post('/api/inspections', upload.array('photos', 20), (req, res) => {
  try {
    const b = req.body;
    if (!b.trailer || !b.status) return res.status(400).json({ error: 'Trailer y estado son obligatorios' });
    if (!['Decente','50/50','Dañada'].includes(b.status)) return res.status(400).json({ error: 'Estado inválido' });
    const tags = Array.isArray(b.tags) ? b.tags : (b.tags ? [b.tags] : []);
    const r = {
      id: crypto.randomUUID(), trailer: b.trailer.trim(), seal: (b.seal || '').trim(),
      emptyBox: b.emptyBox === 'true' || b.emptyBox === '1', status: b.status, tags,
      client: (b.client || '').trim(), model: (b.model || '').trim(),
      entryDate: b.entryDate || new Date().toISOString().slice(0,10), inPatio: true, exitDate: null,
      travelCondition: (b.travelCondition || 'Apta para viaje').trim(),
      comments: (b.comments || '').trim(), inspector: (b.inspector || '').trim(),
      created: Date.now(), photos: (req.files || []).map(f => f.filename)
    };
    const db = loadDB(); db.inspections.push(r); saveDB(db);
    res.status(201).json(publicRow(r));
  } catch (e) { console.error(e); res.status(500).json({ error: 'No se pudo guardar' }); }
});
app.patch('/api/inspections/:id/exit', (req, res) => {
  const db = loadDB(); const r = db.inspections.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  const exitDate = req.body.exitDate || new Date().toISOString().slice(0,10);
  if (r.entryDate && exitDate < r.entryDate) return res.status(400).json({ error: 'La fecha de salida no puede ser anterior al ingreso' });
  r.inPatio = false; r.exitDate = exitDate; saveDB(db); res.json(publicRow(r));
});

app.delete('/api/inspections/:id', (req, res) => {
  const db = loadDB(); const i = db.inspections.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'No encontrado' });
  const [r] = db.inspections.splice(i, 1); saveDB(db);
  for (const name of (r.photos || [])) { const f = path.join(UP, name); try { fs.unlinkSync(f); } catch {} }
  res.json({ ok: true });
});
app.get('/api/share/:id', (req, res) => {
  const r = loadDB().inspections.find(x => x.id === req.params.id);
  if (!r) return res.status(404).send('No encontrado');
  res.sendFile(path.join(PUBLIC, 'share.html'));
});
app.get('/api/report.csv', (req, res) => {
  const rows = [...loadDB().inspections].sort((a,b)=>b.created-a.created);
  const q = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const data = [['Trailer','Sello','Cliente','Modelo','Tipo','Estado','Condición para viaje','En patio','Fecha ingreso','Fecha salida','Observaciones','Comentarios','Inspector','Fotos'], ...rows.map(x => [x.trailer,x.seal,x.client||'',x.model||'',x.emptyBox?'Vacía':'Cargada',x.status,x.travelCondition||'',x.inPatio===false?'No':'Sí',x.entryDate||'',x.exitDate||'',(x.tags||[]).join(' | '),x.comments,x.inspector,(x.photos||[]).length])];
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename=inventario-trailers.csv');
  res.send('\ufeff' + data.map(r => r.map(q).join(',')).join('\n'));
});
app.get('/api/report.json', (req, res) => {
  res.setHeader('Content-Disposition','attachment; filename=inventario-trailers.json');
  res.json(loadDB().inspections.map(publicRow));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Inventario Trailers listo en puerto ${PORT}`));
