import {env} from 'cloudflare:workers';
import {createRoom,accessRoom,RoomError} from '../../../server/rooms.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return Response.json({error:'Origem não permitida.'},{status:403});
  const key=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  const code=(url.searchParams.get('code')||'').toUpperCase();
  let body=null;
  if(request.method==='POST'){
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new RoomError('Envie JSON.',415);
   const raw=await request.text();if(raw.length>4096)throw new RoomError('Pedido muito grande.',413);
   try{body=JSON.parse(raw);}catch{throw new RoomError('JSON inválido.');}
   if(!body||typeof body!=='object')throw new RoomError('Pedido inválido.');
  }
  const db=env.DB.withSession('first-primary');
  const result=code?await accessRoom(db,code,key,body):body?.type==='create'?await createRoom(db,body,key):null;
  if(!result)throw new RoomError('Sala não informada.');
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const known=error instanceof RoomError||error instanceof Error&&/Escolha|Créditos|Melhoria|Rota|reserva|circuito|partida já terminou/.test(error.message);
  return Response.json({error:known?error.message:'Servidor indisponível. Tente novamente.'},{status:known?(error.status||400):503,headers:{'Cache-Control':'no-store'}});
 }
}
export const GET=handle,POST=handle;
