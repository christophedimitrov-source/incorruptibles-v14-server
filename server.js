const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const HTML = path.join(__dirname, 'incorruptibles-v14.html');
const rooms = new Map();

function code(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';
  do { s=''; for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)]; } while(rooms.has(s));
  return s;
}
function send(ws,msg){ if(ws && ws.readyState===1) ws.send(JSON.stringify(msg)); }
function cleanup(ws){
  for(const [room,r] of rooms){
    if(r.host===ws){
      if(r.guest) send(r.guest,{type:'opponent_left'});
      rooms.delete(room);
    } else if(r.guest===ws){
      r.guest=null;
      send(r.host,{type:'opponent_left'});
    }
  }
}

const server=http.createServer((req,res)=>{
  if(req.url==='/' || req.url==='/incorruptibles-v14.html'){
    fs.createReadStream(HTML).on('error',()=>{res.writeHead(500);res.end('V14 introuvable');}).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let msg; try{msg=JSON.parse(raw.toString());}catch(e){return;}
    if(msg.type==='create'){
      const room=code();
      rooms.set(room,{host:ws,guest:null});
      ws._room=room; ws._role='host';
      send(ws,{type:'room_created',room});
      return;
    }
    if(msg.type==='join'){
      const room=String(msg.room||'').trim().toUpperCase();
      const r=rooms.get(room);
      if(!r){send(ws,{type:'error',message:'Partie introuvable.'});return;}
      if(r.guest){send(ws,{type:'error',message:'Cette partie est déjà complète.'});return;}
      r.guest=ws; ws._room=room; ws._role='guest';
      send(ws,{type:'waiting',room});
      send(r.host,{type:'opponent_joined',room});
      return;
    }
    const room=ws._room, r=room && rooms.get(room);
    if(!r) return;
    if(msg.type==='action' && ws===r.guest){
      send(r.host,{type:'action',action:msg.action});
    }
    // The host sends authoritative, redacted state snapshots directly to the guest.
  });
  ws.on('close',()=>cleanup(ws));
});

server.listen(PORT,()=>console.log(`Les Incorruptibles V14 : http://localhost:${PORT}`));
