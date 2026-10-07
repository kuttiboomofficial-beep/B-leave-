const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leave-register-data.json');
const PORT = Number(process.env.PORT || 3000);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({workers:[], entries:[]}, null, 2));

function readData(){
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {workers:Array.isArray(d.workers)?d.workers:[], entries:Array.isArray(d.entries)?d.entries:[]};
  } catch(e){ return {workers:[], entries:[]}; }
}
function saveData(d){
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({workers:d.workers||[], entries:d.entries||[]}, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
function getLanIP(){
  const nets=os.networkInterfaces();
  for(const name of Object.keys(nets)) for(const n of nets[name]||[]){
    if(n.family==='IPv4' && !n.internal) return n.address;
  }
  return '127.0.0.1';
}
function send(res,status,type,body){
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  res.end(body);
}
function sendJSON(res,status,obj){ send(res,status,'application/json; charset=utf-8',JSON.stringify(obj)); }
function safePath(urlPath){
  let p;
  try{ p=decodeURIComponent(urlPath.split('?')[0]); }catch(e){return null;}
  if(p==='/' || p==='') p='/index.html';
  const full=path.resolve(ROOT,'.'+p);
  if(!full.startsWith(path.resolve(ROOT))) return null;
  return full;
}

const server=http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){
    res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); return res.end();
  }
  if(req.url.startsWith('/api/info')) return sendJSON(res,200,{mode:'local-network',ip:getLanIP(),port:PORT,computer:os.hostname()});
  if(req.url.startsWith('/api/data')){
    if(req.method==='GET') return sendJSON(res,200,readData());
    if(req.method==='PUT'){
      let raw=''; req.on('data',c=>{raw+=c; if(raw.length>20*1024*1024) req.destroy();});
      req.on('end',()=>{try{const d=JSON.parse(raw); if(!Array.isArray(d.workers)||!Array.isArray(d.entries)) throw new Error('Invalid data'); saveData(d); sendJSON(res,200,{ok:true});}catch(e){sendJSON(res,400,{ok:false,error:e.message});}}); return;
    }
    return sendJSON(res,405,{error:'Method not allowed'});
  }
  const file=safePath(req.url); if(!file) return send(res,403,'text/plain','Forbidden');
  fs.stat(file,(err,st)=>{
    if(err || !st.isFile()) return send(res,404,'text/plain','Not found');
    const ext=path.extname(file).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'}); fs.createReadStream(file).pipe(res);
  });
});
server.listen(PORT,'0.0.0.0',()=>{
  const ip=getLanIP();
  console.log('\nLeave Register Local Network Server');
  console.log('Computer: http://localhost:'+PORT);
  console.log('Phone:    http://'+ip+':'+PORT);
  console.log('\nKeep this window open while using the phone.\n');
});
