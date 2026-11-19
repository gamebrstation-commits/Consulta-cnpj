/* Ponte para iPhone / navegador: substitui as funções do app Android */
(function(){
var last=null;
function baixar(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000)}
function de64(b,mime){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Blob([u],{type:mime})}
function load(src){return new Promise(function(ok,err){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){err(new Error('sem internet para carregar o leitor'))};document.head.appendChild(s)})}
async function ocrArquivo(file){
  if(!window.Tesseract)await load('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  var imgs=[];
  if(/pdf/.test(file.type)||/\.pdf$/i.test(file.name)){
    if(!window.pdfjsLib){await load('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'}
    var pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    for(var i=1;i<=Math.min(pdf.numPages,10);i++){var pg=await pdf.getPage(i),v=pg.getViewport({scale:1}),sc=2400/Math.max(v.width,v.height),vp=pg.getViewport({scale:sc}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
      var cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:cx,viewport:vp}).promise;imgs.push(cv)}
  }else imgs.push(file);
  var w=await Tesseract.createWorker('por'),out=[];await w.setParameters({tessedit_pageseg_mode:'6'});
  for(var p=0;p<imgs.length;p++){var cv=await prep(imgs[p]),r=await w.recognize(cv,{},{blocks:true}),L=[];
    (r.data.blocks||[]).forEach(function(bk){(bk.paragraphs||[]).forEach(function(pa){(pa.lines||[]).forEach(function(l){L.push(l)})})});
    L.forEach(function(l){var ws=(l.words||[]).filter(function(x){return x.text&&x.text.trim()}),hh=l.bbox.y1-l.bbox.y0,cell=null;
      var push=function(){if(cell&&cell.t.trim())out.push({p:p,t:cell.t.trim(),x:cell.x0,y:l.bbox.y0,w:cell.x1-cell.x0,h:hh});cell=null};
      ws.forEach(function(wd){var tx=wd.text.trim(),b=wd.bbox;if(/^[|\[\]()]+$/.test(tx)){push();return}
        if(cell&&b.x0-cell.x1>hh*1.4)push();tx=tx.replace(/^[|\[]+|[|\]]+$/g,'');if(!tx)return;
        if(!cell)cell={t:tx,x0:b.x0,x1:b.x1};else{cell.t+=' '+tx;cell.x1=b.x1}});push()})}
  await w.terminate();return out}
/* tira as bordas de tabela e aumenta a imagem: o leitor do navegador erra muito com linhas de grade */
function carregaImg(src){return new Promise(function(ok,err){if(src instanceof HTMLCanvasElement)return ok(src);var i=new Image();i.onload=function(){ok(i)};i.onerror=err;i.src=URL.createObjectURL(src)})}
async function prep(src){var im=await carregaImg(src),W=im.naturalWidth||im.width,H=im.naturalHeight||im.height,k=Math.min(2,3000/Math.max(W,H));if(k<1)k=1;
  var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.drawImage(im,0,0);var d=x.getImageData(0,0,W,H),px=d.data,g=new Uint8Array(W*H),dk=new Uint8Array(W*H);
  for(var i=0;i<W*H;i++){var v=(px[i*4]*299+px[i*4+1]*587+px[i*4+2]*114)/1000;g[i]=v;dk[i]=v<140?1:0}
  for(var y=0;y<H;y++){var s=0;for(var xx=0;xx<W;xx++)s+=dk[y*W+xx];if(s>W*0.35)for(xx=0;xx<W;xx++)g[y*W+xx]=255}
  for(var xx2=0;xx2<W;xx2++){var s2=0;for(var y2=0;y2<H;y2++)s2+=dk[y2*W+xx2];if(s2>H*0.25)for(y2=0;y2<H;y2++)g[y2*W+xx2]=255}
  for(i=0;i<W*H;i++){px[i*4]=px[i*4+1]=px[i*4+2]=g[i];px[i*4+3]=255}x.putImageData(d,0,0);
  var o=document.createElement('canvas');o.width=Math.round(W*k);o.height=Math.round(H*k);var ox=o.getContext('2d');ox.imageSmoothingQuality='high';ox.drawImage(c,0,0,o.width,o.height);return o}
window.WEBN={
  share:function(text,title){if(navigator.share)navigator.share({title:title||'Demandas',text:text}).catch(function(){});else WEBN.copy(text)},
  copy:function(t){try{navigator.clipboard.writeText(t)}catch(e){var x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}},
  saveBinary:function(name,b,mime){try{last={name:name,blob:de64(b,mime),mime:mime};baixar(last.blob,name);return 'ok'}catch(e){return 'erro'}},
  saveFile:function(name,txt){last={name:name,blob:new Blob([txt],{type:'application/json'})};baixar(last.blob,name);return 'Backup baixado ('+name+')'},
  openLast:function(){if(last)window.open(URL.createObjectURL(last.blob),'_blank')},
  shareLast:function(subject){if(!last)return;var f=new File([last.blob],last.name,{type:last.mime||last.blob.type});
    if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:subject}).catch(function(){});else baixar(last.blob,last.name)},
  printHtml:function(html){var w=window.open('','_blank');if(!w){alert('Permita pop-ups para gerar o PDF');return}w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print()},600)},
  ocrPick:function(){var i=document.createElement('input');i.type='file';i.accept='image/*,application/pdf';
    i.onchange=function(){var f=i.files&&i.files[0];if(!f){window.__ocrResult(null,'cancel');return}window.__ocrStart&&window.__ocrStart();
      ocrArquivo(f).then(function(L){window.__ocrResult(JSON.stringify(L))},function(e){window.__ocrResult(null,e.message||String(e))})};i.click()},
  setDark:function(d){var m=document.querySelector('meta[name=theme-color]');if(m)m.content=d?'#0e0e10':'#CC092F'},
  saveState:function(){},setUser:function(){},setPass:function(){},clearUser:function(){}
};
if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
})();
