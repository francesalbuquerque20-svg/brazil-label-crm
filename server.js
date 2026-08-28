
const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_FILE || "brazillabel.db");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clients(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, company TEXT, phone TEXT, email TEXT, city TEXT, segment TEXT, notes TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS deals(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_id INTEGER, product TEXT NOT NULL, value REAL DEFAULT 0, stage TEXT DEFAULT 'Prospecção',
 forecast TEXT, next_action TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES clients(id)
);
CREATE TABLE IF NOT EXISTS quotes(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_id INTEGER, name TEXT NOT NULL, company TEXT, phone TEXT, product TEXT NOT NULL,
 quantity TEXT, measure TEXT, material TEXT, printing TEXT, finish TEXT, art TEXT,
 deadline TEXT, observations TEXT, status TEXT DEFAULT 'Novo', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task TEXT NOT NULL, client_id INTEGER, due_date TEXT, priority TEXT DEFAULT 'Média',
 status TEXT DEFAULT 'Pendente', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES clients(id)
);
`);

const adminEmail = process.env.ADMIN_EMAIL || "francesalbuquerque20@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD;

const admin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);

if (admin) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare("UPDATE users SET password = ?, name = ? WHERE email = ?")
    .run(hash, "Administrador", adminEmail);
} else {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)")
    .run("Administrador", adminEmail, hash);
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
 secret: process.env.SESSION_SECRET || "troque-esta-chave",
 resave:false, saveUninitialized:false,
 cookie:{httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production"}
}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next){
 if(!req.session.user) return res.status(401).json({error:"Não autenticado"});
 next();
}
const safeUser = r => ({id:r.id,name:r.name,email:r.email});

app.post("/api/login",(req,res)=>{
 const {email,password}=req.body;
 const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if(!u || !bcrypt.compareSync(password||"",u.password)) return res.status(401).json({error:"E-mail ou senha inválidos"});
 req.session.user=safeUser(u); res.json(req.session.user);
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json(req.session.user||null));

app.get("/api/dashboard",auth,(req,res)=>{
 const clients=db.prepare("SELECT COUNT(*) c FROM clients").get().c;
 const deals=db.prepare("SELECT COUNT(*) c FROM deals").get().c;
 const quotes=db.prepare("SELECT COUNT(*) c FROM quotes").get().c;
 const value=db.prepare("SELECT COALESCE(SUM(value),0) v FROM deals WHERE stage!='Fechado'").get().v;
 res.json({clients,deals,quotes,value});
});

app.get("/api/clients",auth,(req,res)=>res.json(db.prepare("SELECT * FROM clients ORDER BY id DESC").all()));
app.post("/api/clients",auth,(req,res)=>{
 const {name,company,phone,email,city,segment,notes}=req.body;
 if(!name) return res.status(400).json({error:"Nome obrigatório"});
 const info=db.prepare("INSERT INTO clients(name,company,phone,email,city,segment,notes) VALUES(?,?,?,?,?,?,?)")
 .run(name,company,phone,email,city,segment,notes);
 res.json(db.prepare("SELECT * FROM clients WHERE id=?").get(info.lastInsertRowid));
});

app.get("/api/deals",auth,(req,res)=>res.json(db.prepare(`
SELECT d.*, c.name client_name, c.company FROM deals d LEFT JOIN clients c ON c.id=d.client_id ORDER BY d.id DESC`).all()));
app.post("/api/deals",auth,(req,res)=>{
 const {client_id,product,value,stage,forecast,next_action,notes}=req.body;
 const info=db.prepare("INSERT INTO deals(client_id,product,value,stage,forecast,next_action,notes) VALUES(?,?,?,?,?,?,?)")
 .run(client_id||null,product,Number(value)||0,stage||"Prospecção",forecast,next_action,notes);
 res.json({id:info.lastInsertRowid});
});
app.patch("/api/deals/:id",auth,(req,res)=>{
 const {stage}=req.body;
 db.prepare("UPDATE deals SET stage=? WHERE id=?").run(stage,req.params.id); res.json({ok:true});
});

app.get("/api/quotes",auth,(req,res)=>res.json(db.prepare(`
SELECT q.*, c.name client_name FROM quotes q LEFT JOIN clients c ON c.id=q.client_id ORDER BY q.id DESC`).all()));
app.post("/api/quotes",auth,(req,res)=>{
 const q=req.body;
 const info=db.prepare(`INSERT INTO quotes
(client_id,name,company,phone,product,quantity,measure,material,printing,finish,art,deadline,observations)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
 q.client_id||null,q.name,q.company,q.phone,q.product,q.quantity,q.measure,q.material,q.printing,q.finish,q.art,q.deadline,q.observations);
 res.json({id:info.lastInsertRowid});
});
app.patch("/api/quotes/:id",auth,(req,res)=>{
 db.prepare("UPDATE quotes SET status=? WHERE id=?").run(req.body.status,req.params.id); res.json({ok:true});
});

app.get("/api/tasks",auth,(req,res)=>res.json(db.prepare(`
SELECT t.*, c.name client_name FROM tasks t LEFT JOIN clients c ON c.id=t.client_id ORDER BY t.id DESC`).all()));
app.post("/api/tasks",auth,(req,res)=>{
 const t=req.body;
 const info=db.prepare("INSERT INTO tasks(task,client_id,due_date,priority) VALUES(?,?,?,?)")
 .run(t.task,t.client_id||null,t.due_date,t.priority||"Média");
 res.json({id:info.lastInsertRowid});
});
app.patch("/api/tasks/:id",auth,(req,res)=>{
 db.prepare("UPDATE tasks SET status=? WHERE id=?").run(req.body.status,req.params.id); res.json({ok:true});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Brazil Label CRM rodando na porta ${PORT}`));
