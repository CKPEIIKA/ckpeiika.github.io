const moduleValue = (() => {
/** Drawing adapter. The deployed gallery uses the site's genuine Chalkish engine.
 * Standalone preview: an independent Canvas 2D renderer, explicitly identified in UI.
 * Design coordinates are 1000 x 610; labels share the exact same viewport transform.
 */
const C={white:'#f4f1e7',muted:'#a6b8ad',grid:'#2a3a31',yellow:'#f0d477',blue:'#8ac8db',red:'#ef9685',green:'#b6d3a0',bg:'#0d1712',dim:'#506358'};
const W=1000,H=610;
let libraryPromise;
function getLibrary(){
  if(globalThis.PDE4_OFFLINE || new URLSearchParams(location.search).get('engine')==='canvas')return Promise.resolve(null);
  return libraryPromise??=import('../../../lib/chalkish/src/index.js').catch(()=>null);
}
class Ink {
  constructor(){this.cmd=[];}
  line(x1,y1,x2,y2,color=C.white,width=1.5,dash=false){this.cmd.push({type:'line',x1,y1,x2,y2,color,width,dash});return this;}
  arrow(x1,y1,x2,y2,color=C.yellow,width=1.8){this.cmd.push({type:'arrow',x1,y1,x2,y2,color,width});return this;}
  rect(x,y,w,h,fill=null,color=C.grid,width=1){if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}if(w<1e-12||h<1e-12){if(color)this.line(x,y,x+w,y+h,color,width);return this;}this.cmd.push({type:'rect',x,y,w,h,fill,color,width});return this;}
  dot(x,y,r=4,color=C.yellow,fill=color){this.cmd.push({type:'dot',x,y,r,color,fill,width:1.5});return this;}
  path(points,color=C.white,width=2,dash=false){this.cmd.push({type:'path',points,color,width,dash});return this;}
  text(x,y,text,size=16,color=C.white,align='left'){this.cmd.push({type:'text',x,y,text:String(text),size,color,align});return this;}
  title(text,sub=''){this.text(42,31,text,20,C.white);this.cmd.at(-1).maxWidth=835;if(sub){this.text(42,57,sub,14,C.muted);this.cmd.at(-1).maxWidth=915;}return this;}
  badge(x,y,text,color=C.yellow){this.text(x,y,text,15,color);return this;}
}
function graph(ink,{x=72,y=115,w=858,h=295,xmin=0,xmax=1,ymin=-1,ymax=1,xticks=4,yticks=4,xlabel='x',ylabel='u',labels=true}={}){
  const X=v=>x+(v-xmin)/(xmax-xmin)*w,Y=v=>y+h-(v-ymin)/(ymax-ymin)*h;
  for(let i=0;xticks>0&&i<=xticks;i++){const v=xmin+(xmax-xmin)*i/xticks,px=X(v);ink.line(px,y,px,y+h,C.grid,1);if(labels)ink.text(px,y+h+20,fmt(v,3),12,C.muted,'center');}
  for(let i=0;yticks>0&&i<=yticks;i++){const v=ymin+(ymax-ymin)*i/yticks,py=Y(v);ink.line(x,py,x+w,py,C.grid,1);if(labels)ink.text(x-12,py+4,fmt(v,3),12,C.muted,'right');}
  ink.line(x,y+h,x+w+9,y+h,C.muted,1.2);ink.line(x,y,x,y+h,C.muted,1.2);
  if(xmin<0&&xmax>0)ink.line(X(0),y,X(0),y+h,C.dim,1.3);
  if(ymin<0&&ymax>0)ink.line(x,Y(0),x+w,Y(0),C.dim,1.3);
  ink.text(x+w+14,y+h+5,xlabel,14,C.muted);ink.text(x-4,y-16,ylabel,15,C.muted);
  const clipped=(pts,color,width=2,dash=false)=>{
    // Segment clipping prevents a deliberately unstable curve from hiding its axes.
    let group=[]; const flush=()=>{if(group.length>1)ink.path(group,color,width,dash);group=[];};
    for(const p of pts){if(Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=xmin-1e-10&&p[0]<=xmax+1e-10&&p[1]>=ymin&&p[1]<=ymax){group.push([X(p[0]),Y(p[1])]);}else flush();}flush();
  };
  return {X,Y,x,y,w,h,xmin,xmax,ymin,ymax,contains:(px,py)=>px>=x&&px<=x+w&&py>=y&&py<=y+h,
    inverse:(px,py)=>[xmin+(px-x)/w*(xmax-xmin),ymax-(py-y)/h*(ymax-ymin)],
    curve:(fn,color=C.white,width=2,n=400,dash=false)=>clipped(Array.from({length:n+1},(_,i)=>{const v=xmin+(xmax-xmin)*i/n;return [v,fn(v)];}),color,width,dash),
    series:(xs,ys,color=C.yellow,width=2,dots=false)=>{clipped(xs.map((v,i)=>[v,ys[i]]),color,width);if(dots)xs.forEach((v,i)=>{if(v>=xmin&&v<=xmax&&ys[i]>=ymin&&ys[i]<=ymax)ink.dot(X(v),Y(ys[i]),3.2,color);});},
    dot:(a,b,r=4,col=C.yellow)=>{if(a>=xmin&&a<=xmax&&b>=ymin&&b<=ymax)ink.dot(X(a),Y(b),r,col);}
  };
}
function fmt(x,d=4){if(!Number.isFinite(x))return String(x);if(x===0)return '0';return Math.abs(x)>=1e4||Math.abs(x)<1e-3?x.toExponential(2):Number(x.toPrecision(d)).toString();}
function legend(ink,items,y=492,x=72,step=260){items.forEach(([s,c],i)=>{ink.line(x+i*step,y-5,x+27+i*step,y-5,c,2.5);ink.text(x+37+i*step,y,s,15,c);});}
function drawShape(ctx,p){
  ctx.strokeStyle=p.color||C.white;ctx.fillStyle=p.fill||'transparent';ctx.lineWidth=p.width||1.5;ctx.setLineDash(p.dash?[7,6]:[]);ctx.beginPath();
  if(p.type==='line'||p.type==='arrow'){ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);}
  if(p.type==='rect')ctx.rect(p.x,p.y,p.w,p.h);
  if(p.type==='dot')ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
  if(p.type==='path'){p.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));}
  if(p.fill)ctx.fill();if(p.color)ctx.stroke();
  if(p.type==='arrow'){const a=Math.atan2(p.y2-p.y1,p.x2-p.x1),r=8;ctx.beginPath();ctx.moveTo(p.x2-r*Math.cos(a-.4),p.y2-r*Math.sin(a-.4));ctx.lineTo(p.x2,p.y2);ctx.lineTo(p.x2-r*Math.cos(a+.4),p.y2-r*Math.sin(a+.4));ctx.stroke();}
}
class Board {
  constructor(host,{preview=false,onEngine=()=>{}}={}){
    this.host=host;this.preview=preview;this.commands=[];this.dead=false;this.engine='canvas';this.onEngine=onEngine;this.renderError=null;
    this.canvas=document.createElement('canvas');this.labels=document.createElement('canvas');
    this.canvas.className='board-canvas';this.labels.className='board-labels';this.labels.setAttribute('aria-hidden','true');
    this.canvas.setAttribute('aria-label','Интерактивная математическая диаграмма');this.host.append(this.canvas,this.labels);
    this.ro=new ResizeObserver(()=>this.paint());this.ro.observe(host);
    this.ready=(preview?Promise.resolve(null):getLibrary()).then(lib=>{
      if(this.dead)return;
      if(lib){try{
        if(!document.querySelector('[data-chalkish-fonts]')){for(const href of ['../../assets/fonts/open-sans/open-sans.css','./site-fonts.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.chalkishFonts='';link.onload=()=>this.paint();document.head.append(link);}}
        this.lib=lib;this.scene=new lib.Scene({background:C.bg});
        this.camera=new lib.Camera2D({centerX:W/2,centerY:H/2,height:H,flipY:false});
        this.app=lib.mount(this.canvas,{scene:this.scene,camera:this.camera,fixedStep:null,adaptiveQuality:false,dprMax:2});
        this.engine='chalkish';
      }catch(e){console.warn('Chalkish initialization failed; using standalone renderer.',e);this.app?.destroy();this.app=null;this.engine='canvas';}}
      this.onEngine(this.engine);this.paint();document.fonts?.ready.then(()=>{if(!this.dead)this.paint();});
    });
  }
  render(ink){this.commands=ink.cmd||ink;this.paint();}
  view(){const r=this.host.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),s=Math.min(w/W,h/H);return {w,h,s,ox:(w-W*s)/2,oy:(h-H*s)/2};}
  point(ev){const r=this.host.getBoundingClientRect(),v=this.view();return [(ev.clientX-r.left-v.ox)/v.s,(ev.clientY-r.top-v.oy)/v.s];}
  paint(){
    if(this.dead||!this.host.isConnected)return;
    const {w,h,s,ox,oy}=this.view();if(w<2||h<2)return;
    const dpr=Math.min(devicePixelRatio||1,2),overlay=this.labels.getContext('2d');
    this.labels.width=Math.round(w*dpr);this.labels.height=Math.round(h*dpr);
    overlay.setTransform(dpr,0,0,dpr,0,0);overlay.clearRect(0,0,w,h);overlay.translate(ox,oy);overlay.scale(s,s);
    if(this.engine==='chalkish'){
      const L=this.lib;this.scene.clear();
      for(const p of this.commands){if(p.type==='text')continue;
        const style=L.chalkStyle('dusty',{stroke:p.color,fill:p.fill||null,width:p.width||1.5,passes:2,roughness:this.preview ? .15 : .24,dash:p.dash?[7,6]:null});
        if(p.type==='line')this.scene.add(new L.Line(p.x1,p.y1,p.x2,p.y2,{style}));
        if(p.type==='arrow')this.scene.add(new L.Arrow(p.x1,p.y1,p.x2,p.y2,{headLength:8,style}));
        if(p.type==='dot')this.scene.add(new L.Circle(p.r,{x:p.x,y:p.y,style}));
        if(p.type==='rect')this.scene.add(new L.Rectangle(p.w,p.h,{x:p.x+p.w/2,y:p.y+p.h/2,style}));
        if(p.type==='path'&&p.points.length>1)this.scene.add(new L.CurveLayer({x:Float32Array.from(p.points,p=>p[0]),y:Float32Array.from(p.points,p=>p[1]),count:p.points.length,style}));
      }
      this.camera.setCenter(W/2,H/2);this.camera.setHeight(h/s);this.app.resize();this.app.render();
    }else{
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
      const ctx=this.canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.bg;ctx.fillRect(0,0,w,h);ctx.translate(ox,oy);ctx.scale(s,s);
      ctx.lineCap='round';ctx.lineJoin='round';for(const p of this.commands)if(p.type!=='text')drawShape(ctx,p);
    }
    const fontScale=matchMedia('(max-width:800px)').matches?1.3:1;
    for(const p of this.commands)if(p.type==='text'){
      overlay.font=`${p.size*fontScale}px "Neucha", "Shantell Sans", "Open Sans", system-ui, sans-serif`;
      overlay.fillStyle=p.color;overlay.textAlign=p.align;overlay.textBaseline='alphabetic';
      const maxWidth=p.maxWidth||(p.align==='left'?W-p.x-20:undefined);
      if(maxWidth)overlay.fillText(p.text,p.x,p.y,maxWidth);else overlay.fillText(p.text,p.x,p.y);
    }
  }
  destroy(){this.dead=true;this.ro.disconnect();this.app?.destroy();this.canvas.remove();this.labels.remove();}
}

return {C,W,Ink,graph,fmt,legend,Board};
})();
export default moduleValue;
