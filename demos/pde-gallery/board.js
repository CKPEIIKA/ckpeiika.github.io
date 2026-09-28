/** Drawing adapter shared by the PDE lecture galleries. Experiments draw with the
 * site's Chalkish engine, text included; catalogue thumbnails and `?engine=canvas` use
 * plain Canvas 2D with the labels on an overlay. Design coordinates are 1000 x 610.
 */
import {formatTick} from '../../lib/chalkish/src/ticks.js';
import {PlotFrame} from '../../lib/chalkish/src/plot-frame.js';
import {contourSegments,joinSegments} from '../../lib/chalkish/src/vector-field.js';
import {layoutTex,canvasMeasure,paintTex} from '../../lib/chalkish/src/tex.js';
const C={white:'#f4f1e7',muted:'#a6b8ad',grid:'#2a3a31',yellow:'#f0d477',blue:'#8ac8db',red:'#ef9685',green:'#b6d3a0',bg:'#0d1712',dim:'#506358'};
const W=1000,H=610,FONT='"Neucha", "Shantell Sans", "Open Sans", system-ui, sans-serif';
// Numbers (ticks, bar values): a face whose decimal point stays visible at 12px, like the
// metric values under the board. Text commands with font: 'number' use it.
const NUMBER_FONT='"Shantell Sans", "Neucha", "Open Sans", system-ui, sans-serif';
const family=p=>p.font==='number'?NUMBER_FONT:FONT;
let libraryPromise;
function getLibrary(){
  if(new URLSearchParams(location.search).get('engine')==='canvas')return Promise.resolve(null);
  return libraryPromise??=import('../../lib/chalkish/src/index.js').catch(error=>{console.error('Chalkish could not be loaded; using the Canvas 2D renderer.',error);return null;});
}
class Ink {
  constructor(){this.cmd=[];}
  line(x1,y1,x2,y2,color=C.white,width=1.5,dash=false){this.cmd.push({type:'line',x1,y1,x2,y2,color,width,dash});return this;}
  arrow(x1,y1,x2,y2,color=C.yellow,width=1.8){this.cmd.push({type:'arrow',x1,y1,x2,y2,color,width});return this;}
  rect(x,y,w,h,fill=null,color=C.grid,width=1){if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}if(w<1e-12||h<1e-12){if(color)this.line(x,y,x+w,y+h,color,width);return this;}this.cmd.push({type:'rect',x,y,w,h,fill,color,width});return this;}
  dot(x,y,r=4,color=C.yellow,fill=color){this.cmd.push({type:'dot',x,y,r,color,fill,width:1.5});return this;}
  path(points,color=C.white,width=2,dash=false){this.cmd.push({type:'path',points,color,width,dash});return this;}
  text(x,y,text,size=16,color=C.white,align='left'){this.cmd.push({type:'text',x,y,text:String(text),size,color,align});return this;}
  // A formula in the TeX subset of lib/chalkish/src/tex.js, e.g. String.raw`u^{n+1}_i = ${fmtTex(v)}`.
  math(x,y,tex,size=20,color=C.white,align='left'){this.cmd.push({type:'math',x,y,tex:String(tex),size,color,align});return this;}
  title(text,sub=''){this.text(42,31,text,20,C.white);this.cmd.at(-1).maxWidth=835;if(sub){this.text(42,57,sub,14,C.muted);this.cmd.at(-1).maxWidth=915;}return this;}
  badge(x,y,text,color=C.yellow){this.text(x,y,text,15,color);return this;}
}
// graph(): a framed plot on the board (lib/chalkish/src/plot-frame.js does the arithmetic).
// Ticks: a number asks for about that many intervals at round values (1, 2, 2.5, 5 × 10^k;
// decades on a log axis); an array gives values or [value, label] pairs, e.g.
// [[Math.PI, 'π']]; 0 draws none. xscale/yscale: 'linear' or 'log'. Tick labels are
// optional text: on a small board the Board drops the lower-priority ones that would collide.
// The returned object maps (X, Y, inverse, contains) and draws: curve, series, dot, scatter,
// bars and histogram, all cut at the frame.
function graph(ink,{x=72,y=115,w=858,h=295,xmin=0,xmax=1,ymin=-1,ymax=1,xticks=4,yticks=4,xlabel='x',ylabel='u',labels=true,xscale='linear',yscale='linear'}={}){
  const f=new PlotFrame({left:x,right:x+w,bottom:y+h,top:y,xRange:[xmin,xmax],yRange:[ymin,ymax],xScale:xscale,yScale:yscale});
  const X=v=>f.x(v),Y=v=>f.y(v),label=(value,step)=>step?formatTick(value,step):fmt(value,3);
  const xs=f.ticks('x',xticks,label),ys=f.ticks('y',yticks,label);
  if(xs.length||ys.length){ink.line(x+w,y,x+w,y+h,C.grid,1);ink.line(x,y,x+w,y,C.grid,1);}
  for(const t of xs){const px=t.position;if(px>x+.5&&px<x+w-.5)ink.line(px,y,px,y+h,C.grid,1);if(labels){ink.text(px,y+h+20,t.label,12,C.muted,'center');Object.assign(ink.cmd.at(-1),{optional:1+t.priority,font:'number'});}}
  for(const t of ys){const py=t.position;if(py>y+.5&&py<y+h-.5)ink.line(x,py,x+w,py,C.grid,1);if(labels){ink.text(x-12,py+4,t.label,12,C.muted,'right');Object.assign(ink.cmd.at(-1),{optional:1+t.priority,font:'number'});}}
  ink.line(x,y+h,x+w+9,y+h,C.muted,1.2);ink.line(x,y,x,y+h,C.muted,1.2);
  if(xscale==='linear'&&xmin<0&&xmax>0)ink.line(X(0),y,X(0),y+h,C.dim,1.3);
  if(yscale==='linear'&&ymin<0&&ymax>0)ink.line(x,Y(0),x+w,Y(0),C.dim,1.3);
  ink.text(x+w+14,y+h+5,xlabel,14,C.muted);ink.text(x-4,y-16,ylabel,15,C.muted);
  // Lines are cut at the frame edge, so a deliberately unstable curve cannot hide the axes.
  const clipped=(xv,yv,color,width=2,dash=false)=>{for(const run of f.clip(xv,yv)){const pts=[];for(let i=0;i<run.length;i+=2)pts.push([run[i],run[i+1]]);ink.path(pts,color,width,dash);}};
  const inside=(a,b)=>f.contains(X(a),Y(b));
  return {X,Y,x,y,w,h,xmin,xmax,ymin,ymax,frame:f,contains:(px,py)=>f.contains(px,py),
    inverse:(px,py)=>f.value(px,py),
    curve:(fn,color=C.white,width=2,n=400,dash=false)=>{const xv=[],yv=[];for(let i=0;i<=n;i++){const v=f.valueAt('x',i/n);xv.push(v);yv.push(fn(v));}clipped(xv,yv,color,width,dash);},
    series:(xv,yv,color=C.yellow,width=2,dots=false)=>{clipped(xv,yv,color,width);if(dots)xv.forEach((v,i)=>{if(inside(v,yv[i]))ink.dot(X(v),Y(yv[i]),3.2,color);});},
    dot:(a,b,r=4,col=C.yellow)=>{if(inside(a,b))ink.dot(X(a),Y(b),r,col);},
    // Packed data-space polylines [x0, y0, x1, y1, …] (e.g. from contourLines), clipped.
    lines:(polylines,color=C.blue,width=1.4,dash=false)=>{for(const p of polylines){const xv=[],yv=[];for(let i=0;i<p.length;i+=2){xv.push(p[i]);yv.push(p[i+1]);}clipped(xv,yv,color,width,dash);}},
    scatter:(xv,yv,{r=3.2,color=C.yellow}={})=>xv.forEach((v,i)=>{if(inside(v,yv[i]))ink.dot(X(v),Y(yv[i]),r,color);}),
    // Bars from 0 (or the nearest frame edge) to each value; a value beyond the frame runs to its
    // edge. width is in data units, or pixels in board units; color may be (value, i) => colour.
    bars:(values,{at=values.map((_,i)=>i),width=.66,pixels=null,color=C.yellow,stroke,labels=false,format=fmt,labelSize=14}={})=>{
      const lo=Math.min(ymin,ymax),hi=Math.max(ymin,ymax),clampY=v=>Math.min(hi,Math.max(lo,v)),base=Y(clampY(0));
      values.forEach((v,i)=>{if(!Number.isFinite(v))return;const col=typeof color==='function'?color(v,i):color,x0=pixels?X(at[i])-pixels/2:X(at[i]-width/2),bw=pixels??(X(at[i]+width/2)-X(at[i]-width/2)),top=Y(clampY(v));
        ink.rect(x0,Math.min(top,base),bw,Math.abs(top-base),col,stroke===undefined?col:stroke);
        if(labels){ink.text(X(at[i]),top+(v<0?23:-9),format(v),labelSize,col,'center');ink.cmd.at(-1).font='number';}});
    },
    // Counts of samples in equal bins over [xmin, xmax], drawn as touching bars; returns the counts.
    histogram:(samples,{bins=20,color=C.blue,stroke=C.dim}={})=>{
      const counts=new Array(bins).fill(0),span=(xmax-xmin)/bins;
      for(const v of samples){if(!(v>=xmin&&v<=xmax))continue;counts[Math.min(bins-1,Math.floor((v-xmin)/span))]++;}
      const lo=Math.min(ymin,ymax),hi=Math.max(ymin,ymax);
      counts.forEach((c,i)=>{const top=Y(Math.min(hi,Math.max(lo,c))),base=Y(Math.min(hi,Math.max(lo,0)));ink.rect(X(xmin+i*span),Math.min(top,base),X(xmin+(i+1)*span)-X(xmin+i*span),Math.abs(top-base),color,stroke);});
      return counts;
    }
  };
}
// Level curve fn(x, y) = level over [xmin, xmax] × [ymin, ymax] on an n × n grid, as joined
// data-space polylines for g.lines (Chalkish marching squares).
function contourLines(fn,{xmin,xmax,ymin,ymax,n=64,level=0}){return joinSegments(contourSegments({fn,level,columns:n,rows:n,minX:xmin,maxX:xmax,minY:ymin,maxY:ymax}),Math.max(xmax-xmin,ymax-ymin)*1e-9);}
// A matrix of values as cells (sign-coloured, zero cells left blank) from its top-left
// corner; returns cellAt(px, py) → [row, column] or null for clicks.
function matrix(ink,M,{x,y,cell,fill=v=>v>1e-10?'#38503a':v< -1e-10?'#603f39':null,textColor=()=>C.white,format=v=>fmt(v,2),hide=v=>Math.abs(v)<=1e-10,selected=null}={}){
  M.forEach((row,i)=>row.forEach((v,j)=>{const cx=x+j*cell,cy=y+i*cell;ink.rect(cx,cy,cell-1,cell-1,fill(v,i,j),C.grid,.7);if(!hide(v)){ink.text(cx+cell/2,cy+cell*.67,format(v),Math.min(17,cell*.56),textColor(v,i,j),'center');ink.cmd.at(-1).font='number';}}));
  if(selected)ink.rect(x+selected[1]*cell,y+selected[0]*cell,cell,cell,null,C.yellow,2.5);
  const rows=M.length,cols=Math.max(0,...M.map(r=>r.length));
  return {x,y,cell,cellAt:(px,py)=>{const i=Math.floor((py-y)/cell),j=Math.floor((px-x)/cell);return i>=0&&j>=0&&i<rows&&j<cols?[i,j]:null;}};
}
function fmt(x,d=4){if(!Number.isFinite(x))return String(x);if(x===0)return '0';return Math.abs(x)>=1e4||Math.abs(x)<1e-3?x.toExponential(2):Number(x.toPrecision(d)).toString();}
// fmt for formulas: 1.86e-4 becomes 1.86·10⁻⁴, 1.00e-6 becomes 10⁻⁶ and Infinity ∞.
function fmtTex(x,d=4){if(Number.isNaN(x))return '\\text{NaN}';if(!Number.isFinite(x))return x>0?'\\infty':'-\\infty';const s=fmt(x,d),[m,e]=s.split('e');if(e===undefined)return s;const k=Number(m);return Math.abs(k)===1?`${k<0?'-':''}10^{${Number(e)}}`:`${k}\\cdot 10^{${Number(e)}}`;}
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
// Optional text (tick labels) is dropped where it would overlap other text at the size it is
// actually painted: the enlarged labels of a narrow board keep the higher-priority ticks.
function uncrowded(commands,ctx,fontScale){
  const optional=commands.filter(p=>p.type==='text'&&p.optional);
  if(!optional.length)return commands;
  const box=p=>{ctx.font=`${p.size*fontScale}px ${family(p)}`;const width=ctx.measureText(p.text).width,size=p.size*fontScale;
    const left=p.align==='center'?p.x-width/2:p.align==='right'?p.x-width:p.x;return [left-2,p.y-.8*size,left+width+2,p.y+.25*size];};
  const overlaps=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
  const kept=commands.filter(p=>p.type==='text'&&!p.optional).map(box),hidden=new Set();
  for(const p of [...optional].sort((a,b)=>a.optional-b.optional)){const b=box(p);if(kept.some(k=>overlaps(k,b)))hidden.add(p);else kept.push(b);}
  return hidden.size?commands.filter(p=>!hidden.has(p)):commands;
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
        if(!document.querySelector('[data-chalkish-fonts]')){for(const href of [new URL('../../assets/fonts/open-sans/open-sans.css',import.meta.url).href,new URL('../shell.css',import.meta.url).href]){const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.chalkishFonts='';link.onload=()=>this.paint();document.head.append(link);}}
        this.lib=lib;this.scene=new lib.Scene({background:C.bg});
        this.camera=new lib.Camera2D({centerX:W/2,centerY:H/2,height:H,flipY:false});
        // The frame loop runs only while the board is being written in.
        this.app=lib.mount(this.canvas,{scene:this.scene,camera:this.camera,fixedStep:null,adaptiveQuality:false,dprMax:2,update:({scene,app})=>{if(!scene.animating){app.stop();this.writeStart=null;}}});
        this.engine='chalkish';
      }catch(e){console.warn('Chalkish initialization failed; using standalone renderer.',e);this.app?.destroy();this.app=null;this.engine='canvas';}}
      this.onEngine(this.engine);this.paint();
      // Canvas text never triggers a web-font download: load both faces, then repaint.
      Promise.all([document.fonts?.load(`16px ${FONT}`),document.fonts?.load(`16px ${NUMBER_FONT}`,'0.5')]).then(()=>{if(!this.dead)this.paint();},error=>console.error('Board fonts could not be loaded.',error));
    });
  }
  // write: draw the board in stroke by stroke (Chalkish Write), unless motion is reduced.
  render(ink,{write=false}={}){this.commands=ink.cmd||ink;if(write)this.pendingWrite=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.paint();}
  view(){const r=this.host.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),s=Math.min(w/W,h/H);return {w,h,s,ox:(w-W*s)/2,oy:(h-H*s)/2};}
  point(ev){const r=this.host.getBoundingClientRect(),v=this.view();return [(ev.clientX-r.left-v.ox)/v.s,(ev.clientY-r.top-v.oy)/v.s];}
  paint(){
    if(this.dead||!this.host.isConnected)return;
    const {w,h,s,ox,oy}=this.view();if(w<2||h<2)return;
    const dpr=Math.min(devicePixelRatio||1,2),overlay=this.labels.getContext('2d');
    this.labels.width=Math.round(w*dpr);this.labels.height=Math.round(h*dpr);
    overlay.setTransform(dpr,0,0,dpr,0,0);overlay.clearRect(0,0,w,h);overlay.translate(ox,oy);overlay.scale(s,s);
    const commands=uncrowded(this.commands,overlay,Math.min(2,Math.max(1,W/w)));
    if(this.engine==='chalkish'){
      const L=this.lib;this.scene.clear();
      const fontScale=Math.min(2,Math.max(1,W/w));
      for(const p of commands){
        // Labels are chalk text on the board: board-unit size (enlarged on narrow boards as
        // before), never below the site's 10 px text minimum.
        if(p.type==='text'){this.scene.add(new L.TextLabel(p.text,{x:p.x,y:p.y,size:p.size*fontScale,minPixelSize:10,font:`16px ${family(p)}`,align:p.align,baseline:'alphabetic',maxWidth:p.maxWidth||(p.align==='left'?W-p.x-20:undefined),style:{fill:p.color,passes:1}}));continue;}
        if(p.type==='math'){this.scene.add(new L.MathLabel(p.tex,{x:p.x,y:p.y,size:p.size*fontScale,minPixelSize:10,family:FONT,align:p.align,baseline:'alphabetic',maxWidth:p.align==='left'?W-p.x-20:undefined,style:{fill:p.color,passes:1}}));continue;}
        const style=L.chalkStyle('dusty',{stroke:p.color,fill:p.fill||null,width:p.width||1.5,passes:2,roughness:this.preview ? .15 : .24,dash:p.dash?[7,6]:null});
        if(p.type==='line')this.scene.add(new L.Line(p.x1,p.y1,p.x2,p.y2,{style}));
        if(p.type==='arrow')this.scene.add(new L.Arrow(p.x1,p.y1,p.x2,p.y2,{headLength:8,style}));
        if(p.type==='dot')this.scene.add(new L.Circle(p.r,{x:p.x,y:p.y,style}));
        if(p.type==='rect')this.scene.add(new L.Rectangle(p.w,p.h,{x:p.x+p.w/2,y:p.y+p.h/2,style}));
        if(p.type==='path'&&p.points.length>1)this.scene.add(new L.CurveLayer({x:Float32Array.from(p.points,p=>p[0]),y:Float32Array.from(p.points,p=>p[1]),count:p.points.length,style}));
      }
      // Chalkish pins the canvas to an inline pixel size; clear it so the CSS size (100% of the host) is measured.
      this.canvas.style.removeProperty('width');this.canvas.style.removeProperty('height');
      this.camera.setCenter(W/2,H/2);this.camera.setHeight(h/s);this.app.resize();
      // A repaint during the write (fonts arriving, a resize) continues it at the same point.
      if(this.pendingWrite||this.writeStart!=null){
        const now=performance.now();if(this.pendingWrite){this.pendingWrite=false;this.writeStart=now;}
        this.scene.play(new L.Write(this.scene.roots.slice(),{duration:L.CHALK_TIMING.writeMs/1000,lag:.125})).advance((now-this.writeStart)/1000);
        this.app.start();
      }
      this.app.render();
    }else{
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
      const ctx=this.canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.bg;ctx.fillRect(0,0,w,h);ctx.translate(ox,oy);ctx.scale(s,s);
      ctx.lineCap='round';ctx.lineJoin='round';for(const p of commands)if(p.type!=='text'&&p.type!=='math')drawShape(ctx,p);
      const fontScale=Math.min(2,Math.max(1,W/w));
      for(const p of commands)if(p.type==='text'){
        overlay.font=`${p.size*fontScale}px ${family(p)}`;
        overlay.fillStyle=p.color;overlay.textAlign=p.align;overlay.textBaseline='alphabetic';
        const maxWidth=p.maxWidth||(p.align==='left'?W-p.x-20:undefined);
        if(maxWidth)overlay.fillText(p.text,p.x,p.y,maxWidth);else overlay.fillText(p.text,p.x,p.y);
      }
      for(const p of commands)if(p.type==='math'){
        paintTex(overlay,layoutTex(p.tex,canvasMeasure(overlay,FONT)),{x:p.x,y:p.y,pixels:p.size*fontScale,family:FONT,color:p.color,align:p.align,maxWidth:p.align==='left'?W-p.x-20:undefined});
      }
    }
  }
  destroy(){this.dead=true;this.ro.disconnect();this.app?.destroy();this.canvas.remove();this.labels.remove();}
}

export {C,W,H,Ink,graph,fmt,fmtTex,legend,matrix,contourLines,Board};
