const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const Database=require("better-sqlite3");
const crypto=require("crypto");
const app=express();
const PORT=process.env.PORT||3000;
const ROOT=__dirname, PUBLIC=path.join(ROOT,"public"), UP=path.join(ROOT,"uploads");
if(!fs.existsSync(UP))fs.mkdirSync(UP,{recursive:true});
const db=new Database(path.join(ROOT,"inventory.db"));
db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS inspections(
 id TEXT PRIMARY KEY, trailer TEXT NOT NULL, seal TEXT, emptyBox INTEGER NOT NULL,
 status TEXT NOT NULL, tags TEXT, comments TEXT, inspector TEXT, created INTEGER NOT NULL
); CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY AUTOINCREMENT, inspection_id TEXT NOT NULL, filename TEXT NOT NULL, FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE);`);
const storage=multer.diskStorage({destination:UP,filename:(req,file,cb)=>cb(null,Date.now()+"-"+crypto.randomBytes(5).toString("hex")+path.extname(file.originalname).toLowerCase())});
const upload=multer({storage,limits:{files:20,fileSize:12*1024*1024},fileFilter:(req,file,cb)=>cb(null,file.mimetype.startsWith("image/"))});
app.use(express.json({limit:"2mb"})); app.use(express.urlencoded({extended:true}));
app.use(express.static(PUBLIC));
app.use("/uploads",express.static(UP));
function row(r){if(!r)return null;return {...r,emptyBox:!!r.emptyBox,tags:JSON.parse(r.tags||"[]"),photos:db.prepare("SELECT filename FROM photos WHERE inspection_id=? ORDER BY id").all(r.id).map(p=>"/uploads/"+p.filename)}}
app.get("/api/inspections",(req,res)=>{const rows=db.prepare("SELECT * FROM inspections ORDER BY created DESC").all();res.json(rows.map(row))});
app.get("/api/inspections/:id",(req,res)=>{const r=row(db.prepare("SELECT * FROM inspections WHERE id=?").get(req.params.id));if(!r)return res.status(404).json({error:"No encontrado"});res.json(r)});
app.post("/api/inspections",upload.array("photos",20),(req,res)=>{
 try{
  const b=req.body;if(!b.trailer||!b.status)return res.status(400).json({error:"Trailer y estado son obligatorios"});
  if(!["Decente","50/50","Dañada"].includes(b.status))return res.status(400).json({error:"Estado inválido"});
  const id=crypto.randomUUID(),created=Date.now(),tags=Array.isArray(b.tags)?b.tags:(b.tags?[b.tags]:[]);
  db.prepare("INSERT INTO inspections VALUES(?,?,?,?,?,?,?,?,?)").run(id,b.trailer.trim(),(b.seal||"").trim(),b.emptyBox==="true"||b.emptyBox==="1"?1:0,b.status,JSON.stringify(tags),(b.comments||"").trim(),(b.inspector||"").trim(),created);
  const ins=db.prepare("INSERT INTO photos(inspection_id,filename) VALUES(?,?)");
  for(const f of (req.files||[]))ins.run(id,f.filename);
  res.status(201).json(row(db.prepare("SELECT * FROM inspections WHERE id=?").get(id)));
 }catch(e){console.error(e);res.status(500).json({error:"No se pudo guardar"})}
});
app.delete("/api/inspections/:id",(req,res)=>{
 const photos=db.prepare("SELECT filename FROM photos WHERE inspection_id=?").all(req.params.id);
 const tx=db.transaction(()=>{db.prepare("DELETE FROM photos WHERE inspection_id=?").run(req.params.id);db.prepare("DELETE FROM inspections WHERE id=?").run(req.params.id)});
 tx();photos.forEach(p=>{const f=path.join(UP,p.filename);if(fs.existsSync(f))fs.unlinkSync(f)});res.json({ok:true});
});
app.get("/api/share/:id",(req,res)=>{const r=row(db.prepare("SELECT * FROM inspections WHERE id=?").get(req.params.id));if(!r)return res.status(404).send("No encontrado");res.sendFile(path.join(PUBLIC,"share.html"))});
app.get("/api/report.csv",(req,res)=>{
 const rows=db.prepare("SELECT * FROM inspections ORDER BY created DESC").all();
 const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
 const out="\ufeff"+[["Trailer","Sello","Estado","Caja vacía","Observaciones","Comentarios","Inspector","Fecha","Fotos"],...rows.map(x=>[x.trailer,x.seal,x.status,x.emptyBox?"Sí":"No",JSON.parse(x.tags||"[]").join(" | "),x.comments,x.inspector,new Date(x.created).toLocaleString("es-MX"),db.prepare("SELECT COUNT(*) c FROM photos WHERE inspection_id=?").get(x.id).c])].map(r=>r.map(q).join(",")).join("\n");
 res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=inventario-trailers.csv");res.send(out);
});
app.get("/api/report.json",(req,res)=>{const rows=db.prepare("SELECT * FROM inspections ORDER BY created DESC").all().map(row);res.setHeader("Content-Disposition","attachment; filename=inventario-trailers.json");res.json(rows)});
app.listen(PORT,()=>console.log(`Inventario Trailers V2: http://localhost:${PORT}`));