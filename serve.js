const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'azhar');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end();}
if(p==='/index.html')d='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+d+'</body></html>';
s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});s.end(d);});}).listen(process.env.PORT||8766);
