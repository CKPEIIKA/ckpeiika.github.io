/**
 * Chalkish collision-3d: an additive, dependency-free 3D entry point.
 * No imports from, or modifications to, Chalkish's existing 2D renderer.
 * World units are arbitrary. Canvas dimensions, line widths and labels use CSS px.
 * Transparent educational geometry uses painter sorting, not a WebGL depth buffer.
 */
export const Vec3 = Object.freeze({
  add: (a,b) => a.map((x,i)=>x+b[i]), sub:(a,b)=>a.map((x,i)=>x-b[i]),
  mul:(a,s)=>a.map(x=>x*s), dot:(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  length:a=>Math.hypot(...a), unit:a=>{const n=Math.hypot(...a);return n>1e-14?a.map(x=>x/n):[0,0,0];},
  lerp:(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t)
});
const V=Vec3, TAU=Math.PI*2;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function basisFor(normal) {
  const n=V.unit(normal);
  if(V.length(n)<.5) throw new RangeError('A nonzero normal is required');
  const u=V.unit(V.cross(Math.abs(n[1])<.85?[0,1,0]:[1,0,0],n));
  return [u,V.cross(n,u)];
}
export function circlePoints(center,normal,radius,segments=96,start=0,end=TAU) {
  const [u,v]=basisFor(normal);
  return Array.from({length:segments+1},(_,i)=>{
    const t=start+(end-start)*i/segments;
    return V.add(center,V.add(V.mul(u,radius*Math.cos(t)),V.mul(v,radius*Math.sin(t))));
  });
}
export class Camera3D {
  constructor(options={}) {
    this.yaw=-.38;this.pitch=.24;this.distance=14;this.zoom=1;this.target=[0,0,0];
    this.projection='orthographic';this.near=.15;this.fov=42*Math.PI/180;
    Object.assign(this,options);this.update();
  }
  update() {
    this.pitch=clamp(this.pitch,-Math.PI/2+.005,Math.PI/2-.005);
    this.distance=Math.max(.5,this.distance);this.zoom=clamp(this.zoom,.4,3.4);
    this.eye=V.add(this.target,[this.distance*Math.sin(this.yaw)*Math.cos(this.pitch),this.distance*Math.sin(this.pitch),this.distance*Math.cos(this.yaw)*Math.cos(this.pitch)]);
    this.forward=V.unit(V.sub(this.target,this.eye));this.right=V.unit(V.cross(this.forward,[0,1,0]));this.up=V.cross(this.right,this.forward);return this;
  }
  coordinates(p) {const q=V.sub(p,this.eye);return [V.dot(q,this.right),V.dot(q,this.up),V.dot(q,this.forward)];}
  project(p,width,height) {
    const q=this.coordinates(p);if(q[2]<this.near)return null;
    const scale=this.projection==='perspective'?height/(2*Math.tan(this.fov/2)*q[2])*this.zoom:Math.min(width/11.3,height/7.1)*this.zoom;
    return {x:width/2+q[0]*scale,y:height/2-q[1]*scale,depth:q[2],scale};
  }
  /** Clip in world space before perspective projection: no exploding near-plane lines. */
  clipSegment(a,b) {
    const za=this.coordinates(a)[2],zb=this.coordinates(b)[2];
    if(za<this.near&&zb<this.near)return null;
    if(za<this.near)return [V.lerp(a,b,(this.near-za)/(zb-za)+1e-10),b];
    if(zb<this.near)return [a,V.lerp(a,b,(za-this.near)/(za-zb)-1e-10)];
    return [a,b];
  }
  /** Screen ray; supports picking on an arbitrary world-space plane. */
  ray(x,y,width,height) {
    if(this.projection==='perspective'){
      const s=height/(2*Math.tan(this.fov/2))*this.zoom;
      return {origin:this.eye,direction:V.unit(V.add(this.forward,V.add(V.mul(this.right,(x-width/2)/s),V.mul(this.up,(height/2-y)/s))))};
    }
    const s=Math.min(width/11.3,height/7.1)*this.zoom;
    return {origin:V.add(this.eye,V.add(V.mul(this.right,(x-width/2)/s),V.mul(this.up,(height/2-y)/s))),direction:this.forward};
  }
  pickPlane(x,y,width,height,point,normal) {
    const ray=this.ray(x,y,width,height),den=V.dot(ray.direction,normal);
    if(Math.abs(den)<1e-9)return null;
    const t=V.dot(V.sub(point,ray.origin),normal)/den;return t>=0?V.add(ray.origin,V.mul(ray.direction,t)):null;
  }
}
export class OrbitControls3D {
  constructor(canvas,camera,onChange=()=>{},onTap=()=>{}) {
    this.canvas=canvas;this.camera=camera;this.onChange=onChange;this.onTap=onTap;this.handlers=[];this.drag=null;
    const listen=(name,fn,options)=>{canvas.addEventListener(name,fn,options);this.handlers.push([name,fn,options]);};
    listen('pointerdown',e=>{if(e.button!==0)return;this.drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,yaw:camera.yaw,pitch:camera.pitch};canvas.setPointerCapture(e.pointerId);});
    listen('pointermove',e=>{if(!this.drag)return;const d=this.drag;camera.yaw=d.yaw-(e.clientX-d.x)*.007;camera.pitch=d.pitch+(e.clientY-d.y)*.006;camera.update();onChange();});
    listen('pointerup',e=>{if(!this.drag)return;const d=this.drag;this.drag=null;if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<5){const r=canvas.getBoundingClientRect();onTap(e.clientX-r.left,e.clientY-r.top);}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
    listen('pointercancel',()=>{this.drag=null;});listen('lostpointercapture',()=>{this.drag=null;});
    listen('wheel',e=>{e.preventDefault();camera.zoom*=Math.exp(-e.deltaY*.001);camera.update();onChange();},{passive:false});
    canvas.style.touchAction='none';
  }
  dispose(){this.handlers.forEach(([n,f,o])=>this.canvas.removeEventListener(n,f,o));this.handlers=[];}
}
/** Generic retained 3D scene. project() is an explicit integration boundary for other renderers. */
export class Scene3D {
  constructor(){this.items=[];}
  clear(){this.items.length=0;return this;}
  add(type,geometry,style={}){this.items.push({type,...geometry,style});return this;}
  line(a,b,style={}){return this.add('line',{a,b},style);}
  polyline(points,style={}){return this.add('polyline',{points},style);}
  polygon(points,style={}){return this.add('polygon',{points},style);}
  sphere(center,radius,style={}){return this.add('sphere',{center,radius},style);}
  point(center,radius=3,style={}){return this.add('point',{center,radius},style);}
  label(point,text,style={}){return this.add('label',{point,text},style);}
  circle(center,normal,radius,style={}){return this.polyline(circlePoints(center,normal,radius,style.segments||96),style);}
  arrow(a,b,style={}){return this.add('arrow',{a,b},style);}
  arc(center,u,v,radius,start,end,style={}){
    const count=Math.max(8,Math.ceil(Math.abs(end-start)*28));
    const points=Array.from({length:count+1},(_,i)=>{const t=start+(end-start)*i/count;return V.add(center,V.add(V.mul(u,radius*Math.cos(t)),V.mul(v,radius*Math.sin(t))));});
    return this.polyline(points,style);
  }
  cylinder(a,b,radius,style={}) {
    const n=V.unit(V.sub(b,a)),[u,v]=basisFor(n),N=style.segments||48;
    const ring=(p,t)=>V.add(p,V.add(V.mul(u,radius*Math.cos(t)),V.mul(v,radius*Math.sin(t))));
    for(let i=0;i<N;i++){
      const t=i*TAU/N,s=(i+1)*TAU/N;
      this.polygon([ring(a,t),ring(a,s),ring(b,s),ring(b,t)],{color:style.color,fill:style.color,alpha:style.fillAlpha??.025,stroke:false});
      if(i%Math.max(1,Math.floor(N/12))===0)this.line(ring(a,t),ring(b,t),{color:style.color,alpha:.17,width:.7});
    }
    this.circle(a,n,radius,{...style,alpha:style.alpha??.65});this.circle(b,n,radius,{...style,alpha:style.alpha??.65});return this;
  }
  cone(origin,axis,length,angle,style={}) {
    const n=V.unit(axis),[u,v]=basisFor(n),base=V.add(origin,V.mul(n,length*Math.cos(angle))),radius=length*Math.sin(angle),N=48;
    const p=t=>V.add(base,V.add(V.mul(u,radius*Math.cos(t)),V.mul(v,radius*Math.sin(t))));
    for(let i=0;i<N;i++){
      this.polygon([origin,p(i*TAU/N),p((i+1)*TAU/N)],{fill:style.color,color:style.color,alpha:style.fillAlpha??.028,stroke:false});
      if(i%6===0)this.line(origin,p(i*TAU/N),{color:style.color,alpha:.15,width:.7});
    }
    this.circle(base,n,radius,{...style,alpha:.6});return this;
  }
  /** Ring on a sphere, measured from +x; phi is measured from +y toward +z. */
  sphericalBand(center,radius,lo,hi,style={}) {
    const N=96,p=(th,ph)=>V.add(center,[radius*Math.cos(th),radius*Math.sin(th)*Math.cos(ph),radius*Math.sin(th)*Math.sin(ph)]);
    for(let i=0;i<N;i++){
      const a=i*TAU/N,b=(i+1)*TAU/N;
      this.polygon([p(lo,a),p(lo,b),p(hi,b),p(hi,a)],{fill:style.color,color:style.color,alpha:style.fillAlpha??.22,stroke:false});
    }
    for(const t of [lo,hi])this.polyline(Array.from({length:N+1},(_,i)=>p(t,i*TAU/N)),{color:style.color,alpha:.8,width:1.15});return this;
  }
  annulus(center,normal,lo,hi,style={}){
    const [u,v]=basisFor(normal),N=96,p=(r,t)=>V.add(center,V.add(V.mul(u,r*Math.cos(t)),V.mul(v,r*Math.sin(t))));
    for(let i=0;i<N;i++){const a=i*TAU/N,b=(i+1)*TAU/N;this.polygon([p(lo,a),p(lo,b),p(hi,b),p(hi,a)],{fill:style.color,color:style.color,alpha:style.fillAlpha??.25,stroke:false});}
    this.circle(center,normal,lo,style);this.circle(center,normal,hi,style);return this;
  }
  project(camera,width,height){return this.items.map(item=>({item,depth:camera.coordinates(item.center||item.point||item.a||item.points[0])[2]})).sort((a,b)=>b.depth-a.depth);}
}
export class ChalkRenderer3D {
  constructor(canvas,{camera=new Camera3D(),background='#141d20',chalk=true,onLayout=null}={}) {
    if(!canvas?.getContext)throw new TypeError('A canvas element is required');
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.camera=camera;this.background=background;this.chalk=chalk;this.width=1;this.height=1;this.labels=[];
    this.resize=()=>{const r=canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dpr=Math.min(2,globalThis.devicePixelRatio||1);canvas.width=Math.round(this.width*this.dpr);canvas.height=Math.round(this.height*this.dpr);onLayout?.();};
    this.observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(this.resize):null;this.observer?.observe(canvas);this.resize();
    this.noise=document.createElement('canvas');this.noise.width=256;this.noise.height=256;const ctx=this.noise.getContext('2d');let s=7733;for(let i=0;i<2200;i++){s=(1664525*s+1013904223)>>>0;const x=(s>>>16)%256;s=(1664525*s+1013904223)>>>0;ctx.fillStyle=`rgba(239,239,224,${.012+((s>>>16)%30)/1600})`;ctx.fillRect(x,(s>>>16)%256,1,1);}
  }
  project(p){return this.camera.project(p,this.width,this.height);}
  draw(scene){
    const c=this.ctx,w=this.width,h=this.height;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalAlpha=1;c.fillStyle=this.background;c.fillRect(0,0,w,h);
    if(this.chalk){c.fillStyle=c.createPattern(this.noise,'repeat');c.fillRect(0,0,w,h);}
    const q=[];this.labels=[];
    const stroke=(a,b,style,arrow=false)=>{const ab=this.camera.clipSegment(a,b);if(!ab)return;const p=this.project(ab[0]),r=this.project(ab[1]);if(!p||!r)return;q.push({type:arrow?'arrow':'line',points:[p,r],depth:(p.depth+r.depth)/2,style});};
    for(const item of scene.items){
      const s=item.style;
      if(item.type==='label'){const p=this.project(item.point);if(p)this.labels.push({p,text:item.text,style:s});continue;}
      if(item.type==='line'||item.type==='arrow'){stroke(item.a,item.b,s,item.type==='arrow');continue;}
      if(item.type==='polyline'){
        // Depth-sort short groups of segments, preserving coherent strokes.
        const pts=item.points,chunk=s.chunk||12;
        for(let i=0;i<pts.length-1;i+=chunk){const sub=pts.slice(i,i+chunk+1),p=sub.map(x=>this.project(x));if(p.every(Boolean))q.push({type:'line',points:p,depth:p.reduce((a,b)=>a+b.depth,0)/p.length,style:s});else for(let j=i;j<Math.min(i+chunk,pts.length-1);j++)stroke(pts[j],pts[j+1],s);}
        continue;
      }
      if(item.type==='polygon'){
        const p=item.points.map(x=>this.project(x));if(p.every(Boolean))q.push({type:'polygon',points:p,depth:p.reduce((a,b)=>a+b.depth,0)/p.length,style:s});continue;
      }
      const p=this.project(item.center);if(!p)continue;
      q.push({type:item.type,p,radius:item.type==='sphere'?item.radius*p.scale:item.radius,depth:p.depth,style:s});
    }
    q.sort((a,b)=>b.depth-a.depth);
    for(const it of q){
      const s=it.style;c.save();c.globalAlpha=s.alpha??1;c.strokeStyle=s.color||'#e6e5d9';c.fillStyle=s.fill||s.color||'#e6e5d9';c.lineWidth=s.width??1.35;c.lineJoin='round';c.lineCap='round';c.setLineDash(s.dash||[]);
      if(it.type==='line'||it.type==='arrow'||it.type==='polygon'){
        const p=it.points;c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));
        if(it.type==='polygon'){c.closePath();c.fill();if(s.stroke!==false)c.stroke();}
        else {c.stroke();if(this.chalk){const width=s.width??1.35;c.save();c.globalAlpha=(s.alpha??1)*.16;c.lineWidth=Math.max(.45,width*.68);c.translate(.38,-.25);c.stroke();c.restore();c.save();c.globalAlpha=(s.alpha??1)*.1;c.lineWidth=Math.max(.45,width*.52);c.translate(-.3,.2);c.stroke();c.restore();}}
        if(it.type==='arrow'){
          const a=p[0],b=p[p.length-1],t=Math.atan2(b.y-a.y,b.x-a.x),r=s.head??8;c.setLineDash([]);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-r*Math.cos(t-.4),b.y-r*Math.sin(t-.4));c.lineTo(b.x-r*.73*Math.cos(t),b.y-r*.73*Math.sin(t));c.lineTo(b.x-r*Math.cos(t+.4),b.y-r*Math.sin(t+.4));c.closePath();c.fill();
        }
      }else if(it.type==='point'){c.beginPath();c.arc(it.p.x,it.p.y,it.radius,0,TAU);c.fill();}
      else if(it.type==='sphere'){
        const {x,y}=it.p,r=Math.max(.5,it.radius);
        if(s.ghost){c.globalAlpha=(s.alpha??1)*.065;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.globalAlpha=s.alpha??.5;c.lineWidth=.9;c.stroke();}
        else{
          const grad=c.createRadialGradient(x-r*.34,y-r*.36,r*.04,x+r*.13,y+r*.2,r*1.08);grad.addColorStop(0,s.highlight||'#f2f2e5');grad.addColorStop(.22,s.color||'#c4d7d0');grad.addColorStop(.74,s.shadow||'#415856');grad.addColorStop(1,'#1b292b');c.fillStyle=grad;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.globalAlpha=(s.alpha??1)*.8;c.strokeStyle=s.color||'#d1dfd7';c.lineWidth=1.1;c.stroke();
          c.globalAlpha=(s.alpha??1)*.16;c.beginPath();c.ellipse(x,y,r*.46,r,.2,0,TAU);c.stroke();
        }
      }
      c.restore();
    }
    this.drawLabels();
  }
  drawLabels(){
    const c=this.ctx,occupied=[];
    for(const {p,text,style:s} of this.labels){
      const size=s.size||18;c.font=`${s.italic===false?'':'italic '}${size}px ${s.family||'Neucha, "Shantell Sans", sans-serif'}`;
      const width=c.measureText(text).width+12,height=size+9;
      let x=p.x+(s.dx??12),y=p.y+(s.dy??-12);
      const candidate=[[x,y],[x,y+26],[x-width-18,y],[x,y-26],[x-width-18,y+26]];
      let found=false;
      for(const a of candidate){const b={x:clamp(a[0],9,this.width-width-9),y:clamp(a[1],height+5,this.height-12),w:width,h:height};if(!occupied.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y-b.h<o.y&&b.y>o.y-o.h)){x=b.x;y=b.y;found=true;break;}}
      if(!found){x=clamp(x,9,this.width-width-9);y=clamp(y,height+5,this.height-12);}
      occupied.push({x,y,w:width,h:height});c.save();c.globalAlpha=s.alpha??1;c.fillStyle=this.background;c.fillRect(x-4,y-size-2,width,height);c.fillStyle=s.color||'#e8e8dd';c.textBaseline='alphabetic';c.fillText(text,x+1,y);c.restore();
    }
  }
  dispose(){this.observer?.disconnect();}
}
