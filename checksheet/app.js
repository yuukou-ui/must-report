const $=s=>document.querySelector(s);
const sections=[['共用部',9],['玄関',4],['キッチン',6],['U.B（浴室）',4],['トイレ',4],['洗面所',4],['洋間',5],['ベランダ',4]];
const key='cleaning-inspection-v1';
const personKey='cleaning-inspection-person-v1';
const fields=['property','date','person','notes'];
let draft={};
try{draft=JSON.parse(localStorage.getItem(key))||{}}catch{}
if(!draft || typeof draft!=='object' || Array.isArray(draft))draft={};
function todayValue(){const now=new Date();return new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const today=new Date();
for(const id of fields) $('#'+id).value=typeof draft[id]==='string'?draft[id]:(id==='date'?todayValue():'');
let rememberedPerson='';
try{rememberedPerson=localStorage.getItem(personKey)||''}catch{}
$('#person').value=typeof draft.person==='string'?draft.person:rememberedPerson;
function normalizeDate(){
 const input=$('#date');
 if(!input.value){input.value=todayValue();$('#dateHelp').textContent='日付をリセットしたため、今日の日付に戻しました。'}
 else if(!input.validity.valid){$('#dateHelp').textContent='2019年5月1日〜2117年12月31日の日付を選んでください。'}
 else $('#dateHelp').textContent='日付を消した場合は、今日の日付に戻ります。';
}
normalizeDate();
const values=items.map((_,i)=>({mark:draft.rows?.[i]?.mark==='×'?'×':'○',note:typeof draft.rows?.[i]?.note==='string'?draft.rows[i].note:''}));
$('#fallback').checked=draft.fallback===true;
let file,url,imported=false,building=false,renderTask=null,previewVersion=0;
function cancelPreview(){previewVersion++;if(renderTask){renderTask.cancel();renderTask=null;}$('#pdfPreview').hidden=true;$('#preview').disabled=false;}
const parts=[];
function update(){
 let issues=0;
 parts.forEach(({start,end,badge,buttons})=>{
  const count=values.slice(start,end).filter(r=>r.mark==='×').length;
  issues+=count;badge.textContent=count?'× '+count+'件':'全て○';
  buttons.forEach(([i,button,mark])=>button.setAttribute('aria-pressed',String(values[i].mark===mark)));
 });
 $('#count').textContent='要改善 '+issues+'件';
 cancelPreview();$('#result').hidden=true; file=null;
 if(url){URL.revokeObjectURL(url);url=null}
 $('#message').textContent='';
 try{localStorage.setItem(personKey,$('#person').value);localStorage.setItem(key,JSON.stringify({...Object.fromEntries(fields.map(id=>[id,$('#'+id).value])),rows:values,fallback:$('#fallback').checked}));$('#saveState').textContent='入力内容はこのブラウザに自動保存されます。'}catch{$('#saveState').textContent='このブラウザでは下書きを保存できません。'}
}
function el(tag,txt){let n=document.createElement(tag);n.textContent=txt;return n}
function button(label,action){let b=el('button',label);b.type='button';b.onclick=action;return b}
let index=0;
for(const [name,size] of sections){
 const start=index,end=start+size,details=el('details',''),summary=el('summary',name),badge=el('span',''),buttons=[];
 summary.append(badge);details.append(summary);details.open=start===0;
 for(;index<end;index++){
  const i=index,[label,description]=items[i],row=el('div','');
  row.className='row';row.append(el('strong',label),el('p',description));
  const actions=el('div','');actions.className='actions';
  for(const mark of ['○','×']){
   const b=button(mark,()=>{values[i].mark=mark;update()});
   b.setAttribute('aria-label',name+' '+label+' '+(mark==='○'?'良好・実施':'不備・要改善'));if(mark==='×')b.className='bad';
   buttons.push([i,b,mark]);actions.append(b);
  }
  const note=el('input','');note.placeholder='備考を入力';note.setAttribute('aria-label',name+' '+label+'の備考');note.value=values[i].note;note.hidden=!note.value;
  note.oninput=()=>{values[i].note=note.value;update()};
  actions.append(button('備考',()=>{note.hidden=!note.hidden;if(!note.hidden)note.focus()}));row.append(actions,note);details.append(row);
 }
 parts.push({start,end,badge,buttons});$('#groups').append(details);
}
for(const id of [...fields,'fallback'])$('#'+id).addEventListener('input',()=>{if(id==='date')normalizeDate();$('#'+id).setCustomValidity('');update()});
for(const event of ['change','blur'])$('#date').addEventListener(event,()=>{normalizeDate();update()});
update();
function nextProperty(){
 if(building)return;
 cancelPreview();
 $('#property').value='';
 $('#notes').value='';
 const now=new Date();
 $('#date').value=new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 normalizeDate();
 values.forEach(row=>{row.mark='○';row.note=''});
 document.querySelectorAll('#groups input').forEach(input=>{input.value='';input.hidden=true});
 $('#pdfPreview').hidden=true;
 $('#pdfCanvas').width=0;
 $('#form').hidden=false;
 $('header').hidden=false;
 update();
 window.scrollTo({top:0,behavior:'smooth'});
}
$('#reset').onclick=nextProperty;
// Read the face name before accepting a user-supplied Meiryo UI font.
// TTC files hold multiple faces with shared tables. Extract just the matching face.
function meiryoFace(buf){
 const v=new DataView(buf),u16=o=>v.getUint16(o),u32=o=>v.getUint32(o),tag=o=>String.fromCharCode(...new Uint8Array(buf,o,4));
 const faces=tag(0)==='ttcf'?Array.from({length:u32(8)},(_,i)=>u32(12+i*4)):[0];
 for(const face of faces){
  const n=u16(face+4),tables=Array.from({length:n},(_,i)=>{const o=face+12+i*16;return {tag:tag(o),offset:u32(o+8),len:u32(o+12),o}});
  const names=tables.find(t=>t.tag==='name');if(!names)continue;
  const o=names.offset;
  const match=Array.from({length:u16(o+2)},(_,i)=>o+6+i*12).some(r=>{
   if(u16(r+6)!==6||![0,3].includes(u16(r)))return false;
   const name=new TextDecoder('utf-16be').decode(new Uint8Array(buf,o+u16(o+4)+u16(r+10),u16(r+8)));
   return /^MeiryoUI(?:-Regular)?$/i.test(name);
  });if(!match)continue;
  if(faces.length===1 && face===0)return buf;
  let pos=12+16*n;const bytes=new Uint8Array(pos+tables.reduce((n,t)=>n+Math.ceil(t.len/4)*4,0));
  bytes.set(new Uint8Array(buf,face,pos));const out=new DataView(bytes.buffer);let head=0;
  tables.forEach((t,i)=>{out.setUint32(12+i*16+8,pos);bytes.set(new Uint8Array(buf,t.offset,t.len),pos);if(t.tag==='head')head=pos;pos+=Math.ceil(t.len/4)*4});
  out.setUint32(head+8,0);let sum=0;for(let i=0;i<pos;i+=4)sum=(sum+out.getUint32(i))>>>0;
  out.setUint32(head+8,(0xB1B0AFBA-sum)>>>0);return bytes.buffer;
 }
 throw Error('通常書体の Meiryo UI を含むファイルを選んでください。');
}
async function fontStore(mode,work){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('inspection-typeface',1);req.onupgradeneeded=()=>req.result.createObjectStore('faces');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('faces',mode),request=work(tx.objectStore('faces'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}
async function useFont(buf){const face=new FontFace('InspectionMeiryo',buf);await face.load();document.fonts.add(face);imported=true}
const restored=fontStore('readonly',s=>s.get('regular')).then(async buf=>{if(buf){await useFont(buf);$('#fontmsg').textContent='保存済みの Meiryo UI を使用します。'}}).catch(()=>{});
$('#fontFile').onchange=async e=>{
 if(!e.target.files?.length)return;
 await restored;update();
 try{const buf=meiryoFace(await e.target.files[0].arrayBuffer());await useFont(buf);
 try{await fontStore('readwrite',s=>s.put(buf,'regular'));$('#fontmsg').textContent='このブラウザに Meiryo UI を保存しました。'}catch{$('#fontmsg').textContent='今回の入力に Meiryo UI を使用します。'}
 }catch(err){$('#fontmsg').textContent=err.message}
};
let template;
async function buildPdf(){
 await restored;
 const P=PDFLib;
 template??=await fetch('sheet.pdf').then(r=>{if(!r.ok)throw Error('原本を読み込めません。再度お試しください。');return r.arrayBuffer()});
 const doc=await P.PDFDocument.load(template,{updateMetadata:false}),page=doc.getPages()[0],H=page.getHeight();
 const ctx=document.createElement('canvas').getContext('2d');
 let local=false;
 if(!imported){try{const face=new FontFace('InspectionLocal','local("Meiryo UI")');await face.load();document.fonts.add(face);local=true}catch{}}
 const family=imported?'InspectionMeiryo':local?'InspectionLocal':'sans-serif';
 function width(c,size){
  if(glyphs[c])return glyphs[c][1]*size;
  if(!imported&&!local&&!$('#fallback').checked){$('.font').open=true;throw Error('原本には「'+c+'」の字形がありません。「PDFの記入文字について」でメイリオを選ぶか、不足する文字の端末書体を許可してください。')}
  ctx.font=size+'px '+family;return ctx.measureText(c).width;
 }
 async function line(str,x,baseline,size){
  for(const c of str){
   const w=width(c,size),g=glyphs[c];
   if(g){page.pushOperators(P.pushGraphicsState(),P.setFillingRgbColor(0,0,0),P.beginText(),P.setFontAndSize('F1',size),P.setTextMatrix(1,0,0,1,x,H-baseline),P.showText(P.PDFHexString.of(g[0].toString(16).padStart(4,'0'))),P.endText(),P.popGraphicsState())}
   else {
    const scale=4,canvas=document.createElement('canvas');canvas.width=Math.ceil((w+4)*scale);canvas.height=Math.ceil(size*2*scale);
    const c2=canvas.getContext('2d');c2.scale(scale,scale);c2.font=size+'px '+family;c2.fillText(c,2,size*1.32);
    const img=await doc.embedPng(canvas.toDataURL());page.drawImage(img,{x:x-2,y:H-baseline+size*1.32-canvas.height/scale,width:canvas.width/scale,height:canvas.height/scale});
   }
   x+=w;
  }
 }
 async function box(str,x,top,w,h,label,max=9.84,multi=false,center=false){
  if(!str)return;
  for(let size=max;size>=6;size-=.25){
   const lines=[];for(const para of str.split('\n')){
    let l='',used=0;for(const c of para){const adv=width(c,size);if(used+adv>w && multi && l){lines.push(l);l='';used=0}l+=c;used+=adv}lines.push(l)
   }
   const widths=lines.map(l=>Array.from(l).reduce((n,c)=>n+width(c,size),0));
   if(widths.some(n=>n>w)||lines.length*size*1.25>h)continue;
   const first=top+(h-lines.length*size*1.25)/2+size;
   for(let i=0;i<lines.length;i++)await line(lines[i],x+(center?(w-widths[i])/2:0),first+i*size*1.25,size);
   return;
  }throw Error(label+'が記入欄に収まりません。文章を短くしてください。');
 }
 await box($('#property').value.trim(),157,51,225,22,'物件名・号室');
 await box($('#person').value.trim(),427,51,141,22,'点検者');
 const [y,m,d]=$('#date').value.split('-').map(Number);
 for(const [num,x,w] of [[y-2018,479,22],[m,514.2,15],[d,541.5,15]])await box(String(num),x,30,w,16,'点検日',10,false,true);
 for(const [i,r] of values.entries()){
  const cy=items[i][2];await box(r.mark,389,cy-7,34,14,'判定',10,false,true);await box(r.note,427,cy-7.4,141,14.8,items[i][0]+'の備考',9,true);
 }
 await box($('#notes').value,76,748,492,73,'特記事項',9.84,true);
 return doc.save();
}
$('#form').onsubmit=async e=>{
 e.preventDefault();if(building)return;normalizeDate();
 for(const id of ['property','person']){const input=$('#'+id);input.setCustomValidity(input.value.trim()?'':'空白だけでは入力できません。');}
 if(!$('#form').reportValidity())return;
 building=true;const controls=[...document.querySelectorAll('#form input,#form textarea,#form button,#reset')];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);$('#form').setAttribute('aria-busy','true');$('#message').textContent='PDFを作成中…';
 try{
  const bytes=await buildPdf(),name='空室清掃_'+$('#property').value.trim().replace(/[\\/:*?"<>|]/g,'_')+'_'+$('#date').value+'.pdf';
  file=new File([bytes],name,{type:'application/pdf'});if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);
  $('#filename').textContent=name;
  $('#pdfPreview').hidden=true;
  $('#pdfCanvas').width=0;
  // Keep the completed report available in memory while starting a fresh draft on the next visit.
  try {
   localStorage.setItem(key,JSON.stringify({person:$('#person').value,fallback:$('#fallback').checked}));
  } catch {}

  $('#message').textContent='';
  $('#shareMessage').textContent='';
  $('#shareHelp').open=false;
  $('#form').hidden=true;
  $('header').hidden=true;
  $('#result').hidden=false;
  window.scrollTo({top:0,behavior:'smooth'});
 }catch(err){$('#message').textContent=err.message}finally{building=false;controls.forEach((c,i)=>c.disabled=disabled[i]);$('#form').removeAttribute('aria-busy')}
};
$('#edit').onclick=()=>{
 $('#form').hidden=false;
 $('header').hidden=false;
 update();
 window.scrollTo({top:0,behavior:'smooth'});
};
$('#share').onclick=async()=>{
 if(!file)return;
 const button=$('#share'),sharedFile=file;
 $('#shareMessage').textContent='';
 if(typeof navigator.share!=='function' || (typeof navigator.canShare==='function' && !navigator.canShare({files:[file]}))){
  $('#shareHelp').open=true;
  $('#download').click();
  $('#shareMessage').textContent='この画面はPDF共有に対応していないため、PDFの保存を要求しました。LINEへの送信は行われていません。';
  return;
 }
 button.disabled=true;
 try{
  await navigator.share({files:[sharedFile],title:sharedFile.name});
  if(file!==sharedFile)return;
  $('#shareMessage').textContent='共有画面を閉じました。この画面ではLINEへの送信完了を確認できません。';
 }catch(error){
  if(file!==sharedFile)return;
  if(error.name==='AbortError'){
   $('#shareMessage').textContent='共有をキャンセルしました。もう一度送るボタンを押せます。';
  }else{
   $('#shareHelp').open=true;
   $('#shareMessage').textContent='このブラウザではPDFを直接共有できませんでした。下の方法でLINEに添付してください。';
  }
 }finally{button.disabled=false}
};

let pdfRenderer;
$('#preview').onclick=async()=>{
 if(!file)return;
 const button=$('#preview');
 button.disabled=true;
 const selectedFile=file,version=++previewVersion;
 $('#pdfPreview').hidden=false;
 $('#previewStatus').textContent='PDFを表示しています…';
 try{
  pdfRenderer??=await import('./pdfjs/pdf.mjs');
  pdfRenderer.GlobalWorkerOptions.workerSrc='./pdfjs/pdf.worker.mjs';
  const pdf=await pdfRenderer.getDocument({data:new Uint8Array(await selectedFile.arrayBuffer()),isEvalSupported:false}).promise;
  try {
   if(file!==selectedFile || version!==previewVersion)return;
   const page=await pdf.getPage(1);
   if(file!==selectedFile || version!==previewVersion)return;
   const viewport=page.getViewport({scale:2});
   const canvas=$('#pdfCanvas');
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
   if(file!==selectedFile || version!==previewVersion)return;
   renderTask=null;
   $('#previewStatus').textContent='';
   $('#pdfPreview').scrollIntoView({block:'start',behavior:'smooth'});
  }finally{await pdf.destroy()}
 }catch(error){
  if(version!==previewVersion || error.name==='RenderingCancelledException')return;
  $('#previewStatus').textContent='PDFの表示に失敗しました。もう一度「PDFを開いて確認」を押してください。';
 }finally{if(version===previewVersion){button.disabled=false;renderTask=null}}
};
$('#download').onclick=()=>{
 if(!file)return;
 // Use a real anchor click in the same document to retain the user's download gesture.
 const link=document.createElement('a');
 link.href=url;link.download=file.name;
 document.body.append(link);
 link.click();link.remove();
 $('#shareMessage').textContent='PDFの保存を要求しました。この画面では端末への保存完了を確認できません。';
};
