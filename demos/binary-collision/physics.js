/** Classical elastic binary scattering, reduced units l0 = epsilon = mu = 1.
 * b and E are asymptotic values. Finite-radius initial data preserve E and L.
 * Smooth forces: adaptive Dormand-Prince 5(4). HS: exact impact geometry.
 * Sutherland: smooth attractive tail + event-located elastic reflection at r=1.
 * Independent radial quadrature supplies deflection curves and verification.
 */
const PI=Math.PI,TAU=2*PI;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
export const POTENTIALS=Object.freeze({
  hs:{name:'Твёрдые сферы',short:'HS',formula:'U(r) = ∞, r < d;   U(r) = 0, r ≥ d'},
  ipl:{name:'Степенное отталкивание',short:'IPL',formula:'U(r) / ε = (ℓ₀ / r)ⁿ'},
  sutherland:{name:'Сазерленд',short:'Suth.',formula:'U(r) = ∞, r < d;   U(r) / ε = −(d / r)⁶, r ≥ d'},
  lj:{name:'Леннард–Джонс',short:'LJ',formula:'U(r) / ε = 4 [(ℓ₀ / r)¹² − (ℓ₀ / r)⁶]'},
  coulomb:{name:'Кулоновское отталкивание',short:'Coul.',formula:'U(r) / ε = ℓ₀ / r'}
});
export function potential(r,model='lj',n=12){
  if(r<=0)return Infinity;
  if(model==='hs')return r<1?Infinity:0;
  if(model==='ipl')return r**(-n);
  if(model==='sutherland')return -(r**(-6)); // smooth continuation ONLY for locating the hard-core event
  if(model==='coulomb')return 1/r;
  if(model==='lj'){const u=r**(-6);return 4*u*(u-1);}
  throw new RangeError(`Unknown potential: ${model}`);
}
export function radialForce(r,model='lj',n=12){
  if(model==='hs')return 0;
  if(model==='ipl')return n*r**(-n-1);
  if(model==='sutherland')return -6*r**(-7);
  if(model==='coulomb')return 1/(r*r);
  if(model==='lj'){const u=r**(-6);return 24*u*(2*u-1)/r;}
  throw new RangeError(`Unknown potential: ${model}`);
}
export function effectivePotential(r,{model='lj',E=1,b=.6,n=12}={}){return potential(r,model,n)+E*b*b/(r*r);}
export function hsAngle(b,d=1){return b>=d?0:2*Math.acos(cap(b/d,0,1));}
export function hsDcs(d=1){return d*d/4;}
export function vssAngle(b,d=1,alpha=1){if(!(alpha>0))throw new RangeError('alpha must be positive');return Math.acos(cap(2*(cap(b/d,0,1)**(2/alpha))-1,-1,1));}
export function vssDcs(chi,d=1,alpha=1){return alpha*d*d/4*((1+Math.cos(chi))/2)**(alpha-1);}
export function vhsDiameter(g,omega=.75,gRef=Math.sqrt(2),dRef=1){if(!(g>0))throw new RangeError('g must be positive');return dRef*(gRef/g)**(omega-.5);}
export function labFromRelative(r,v,m1=1,m2=1,R=[0,0],V=[0,0]){
  if(m1<=0||m2<=0)throw new RangeError('Masses must be positive');const M=m1+m2;
  return {r1:r.map((x,i)=>R[i]+m2/M*x),r2:r.map((x,i)=>R[i]-m1/M*x),v1:v.map((x,i)=>V[i]+m2/M*x),v2:v.map((x,i)=>V[i]-m1/M*x),mu:m1*m2/M};
}
export function mulberry32(seed=72631){let a=seed>>>0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function sampleDisk(count=1200,radius=1,seed=72631){const random=mulberry32(seed);return Array.from({length:count},()=>({b:radius*Math.sqrt(random()),phi:TAU*random()}));}
export function scatterEnsemble(count=1200,{alpha=1,d=1,seed=72631,bins=18}={}){
  const hits=sampleDisk(count,d,seed).map(p=>{const chi=vssAngle(p.b,d,alpha);return {...p,chi,mu:Math.cos(chi),dir:[Math.cos(chi),Math.sin(chi)*Math.cos(p.phi),Math.sin(chi)*Math.sin(p.phi)]};});
  const histogram=Array(bins).fill(0);hits.forEach(p=>histogram[Math.min(bins-1,Math.floor((p.mu+1)/2*bins))]++);
  return {hits,histogram};
}
export function integrateSimpson(fn,a,b,n=512){n+=n%2;const h=(b-a)/n;let sum=fn(a)+fn(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*fn(a+i*h);return sum*h/3;}
/** Asymptotic angular tail, with u=1/r. No finite-distance angle bias. */
function tailIntegral(R,{b,E,model,n}){
  if(b===0)return 0;
  return integrateSimpson(u=>{if(u===0)return b;const f=1-b*b*u*u-potential(1/u,model,n)/E;return b/Math.sqrt(Math.max(1e-16,f));},0,1/R,64);
}
export function criticalOrbit(E){
  if(!(E>0&&E<.8))return null;
  const z=(8-Math.sqrt(64-80*E))/40,r=z**(-1/6),b=Math.sqrt(12*z**(2/3)*(1-2*z)/E);
  return {r,b,E};
}
function bisect(fn,a,b,iterations=70){let fa=fn(a);for(let i=0;i<iterations;i++){const c=(a+b)/2,fc=fn(c);if(Math.sign(fc)===Math.sign(fa)){a=c;fa=fc;}else b=c;}return (a+b)/2;}
export function turningPoint({model='lj',E=1,b=.6,n=12}={}){
  if(!(E>0)||b<0)throw new RangeError('E > 0 and b >= 0 are required');
  if(model==='hs')return {r:Math.max(1,b),hard:b<1,critical:false};
  const f=r=>1-b*b/(r*r)-potential(r,model,n)/E;
  const R=Math.max(64,8*b,model==='coulomb'?8/E:0),lower=model==='sutherland'?1:.035;
  // Include stationary points explicitly, so a narrow forbidden interval near
  // an orbiting separatrix is not skipped by the logarithmic scan.
  const derivative=r=>2*b*b/(r*r*r)+radialForce(r,model,n)/E;
  const nodes=[R];let oldR=R,oldD=derivative(R);
  for(let i=1;i<=560;i++){
    const r=R*(lower/R)**(i/560),dd=derivative(r);
    if(dd*oldD<0)nodes.push(bisect(derivative,r,oldR));nodes.push(r);oldR=r;oldD=dd;
  }
  nodes.sort((a,b)=>b-a);let a=R,fa=f(a);
  for(const r of nodes.slice(1)){
    const fr=f(r);
    if(Math.abs(fr)<1e-12&&Math.abs(derivative(r))<1e-7)return {r,hard:false,critical:true};
    if(fr<0&&fa>=0)return {r:bisect(f,r,a),hard:false,critical:false};
    a=r;fa=fr;
  }
  if(model==='sutherland')return {r:1,hard:true,critical:false};
  throw new Error('No accessible turning point found in the supported range');
}
/** Signed deflection Theta = pi - 2 I; observed polar angle chi = acos(cos Theta). */
export function deflectionByQuadrature({model='lj',E=1,b=.6,n=12,panels=800}={}){
  if(model==='hs'){const chi=hsAngle(b);return {theta:chi,chi,rmin:Math.max(1,b),status:'ok'};}
  if(b<1e-10)return {theta:PI,chi:PI,rmin:turningPoint({model,E,b,n}).r,status:'ok'};
  if(model==='coulomb'){const chi=2*Math.atan(1/(2*E*b));return {theta:chi,chi,rmin:(1+Math.sqrt(1+4*E*E*b*b))/(2*E),status:'ok'};}
  const point=turningPoint({model,E,b,n}),r0=point.r;
  if(point.critical)return {theta:NaN,chi:NaN,rmin:r0,status:'critical'};
  const f=r=>1-b*b/(r*r)-potential(r,model,n)/E;
  let I;
  if(point.hard){
    I=(b/r0)*integrateSimpson(u=>1/Math.sqrt(Math.max(1e-20,u===0?1:f(r0/u))),0,1,panels);
  }else{
    const derivative=2*b*b/r0**3+radialForce(r0,model,n)/E;
    const limit=2/Math.sqrt(Math.max(1e-24,r0*derivative));
    I=b/r0*integrateSimpson(t=>{if(t<1e-5)return limit;if(t===1)return 2;return 2*t/Math.sqrt(Math.max(1e-24,f(r0/(1-t*t))));},0,1,panels);
  }
  const theta=PI-2*I;
  return {theta,chi:Math.acos(cap(Math.cos(theta),-1,1)),rmin:r0,status:'ok'};
}
const A=[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]];
const B5=[35/384,0,500/1113,125/192,-2187/6784,11/84,0];
const B4=[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40];
function rkStep(y,h,derivative){
  const k=[derivative(y)];
  for(let i=1;i<7;i++)k.push(derivative(y.map((v,j)=>v+h*A[i].reduce((s,a,q)=>s+a*k[q][j],0))));
  const next=y.map((v,j)=>v+h*B5.reduce((s,a,q)=>s+a*k[q][j],0)),err=y.map((_,j)=>h*B5.reduce((s,a,q)=>s+(a-B4[q])*k[q][j],0));
  return {next,err};
}
export function solveTrajectory({model='lj',E=1,b=.6,n=12,tolerance=2e-9,R=18,maxSteps=24000}={}){
  if(!POTENTIALS[model])throw new RangeError('Unknown potential');
  if(!(E>0&&b>=0&&n>2))throw new RangeError('Require E>0, b>=0, n>2');
  if(model==='hs')return hardSphereTrajectory(b,E);
  R=Math.max(R,b*3+6,model==='coulomb'?Math.min(120,12/E):0);
  const pars={model,E,b,n},g=Math.sqrt(2*E),L=-b*g,tail=tailIntegral(R,pars),angle=PI-tail;
  const ct=Math.cos(angle),st=Math.sin(angle),vr=-Math.sqrt(Math.max(0,2*(E-potential(R,model,n))-L*L/(R*R))),vt=L/R;
  let y=[R*ct,R*st,vr*ct-vt*st,vr*st+vt*ct],t=0,h=.04/g;
  const derivative=q=>{const r=Math.hypot(q[0],q[1]),a=radialForce(r,model,n)/r;return [q[2],q[3],a*q[0],a*q[1]];};
  const energy=q=>(q[2]**2+q[3]**2)/2+potential(Math.hypot(q[0],q[1]),model,n);
  const samples=[{t,x:y[0],y:y[1],vx:y[2],vy:y[3]}];let errorE=0,errorL=0,rmin=R,accepted=0,rejected=0,collisions=0,status='step-limit',winding=0,lastAngle=angle;
  for(let step=0;step<maxSteps;step++){
    const r=Math.hypot(y[0],y[1]);
    if(r<.03||!y.every(Number.isFinite)){status='numerical-failure';break;}
    if(model==='sutherland'&&r<1.5)h=Math.min(h,.012/g);
    const trial=rkStep(y,h,derivative),err=Math.max(...trial.err.map((e,j)=>Math.abs(e)/(1e-11+tolerance*Math.max(Math.abs(y[j]),Math.abs(trial.next[j])))));
    if(!Number.isFinite(err)||err>1){h*=Number.isFinite(err)?cap(.9*err**(-.2),.15,.8):.2;rejected++;if(h<1e-11){status='step-underflow';break;}continue;}
    let next=trial.next,usedH=h;
    if(model==='sutherland'&&Math.hypot(next[0],next[1])<1){
      let lo=0,hi=h;
      for(let i=0;i<44;i++){const mid=(lo+hi)/2,q=rkStep(y,mid,derivative).next;if(Math.hypot(q[0],q[1])<1)hi=mid;else lo=mid;}
      usedH=lo;next=rkStep(y,usedH,derivative).next;
      const rr=Math.hypot(next[0],next[1]),nx=next[0]/rr,ny=next[1]/rr,dot=next[2]*nx+next[3]*ny;
      // Preserve the instantaneous velocity jump in the sampled history.
      samples.push({t:t+usedH,x:next[0],y:next[1],vx:next[2],vy:next[3]});
      next[2]-=2*dot*nx;next[3]-=2*dot*ny;collisions++;
    }
    y=next;t+=usedH;accepted++;
    const a=Math.atan2(y[1],y[0]);winding+=Math.atan2(Math.sin(a-lastAngle),Math.cos(a-lastAngle));lastAngle=a;
    const rn=Math.hypot(y[0],y[1]);rmin=Math.min(rmin,rn);
    errorE=Math.max(errorE,Math.abs(energy(y)-E)/E);
    errorL=Math.max(errorL,Math.abs(y[0]*y[3]-y[1]*y[2]-L)/Math.max(1,Math.abs(L)));
    samples.push({t,x:y[0],y:y[1],vx:y[2],vy:y[3]});
    if(rn>=R&&y[0]*y[2]+y[1]*y[3]>0){status='ok';break;}
    if(t>Math.max(1600,120*R/g)){status='time-limit';break;}
    h=Math.min(.25/g,h*cap(.9*Math.max(err,1e-12)**(-.2),.25,4));
  }
  const rout=Math.hypot(y[0],y[1]);
  const thetaEnd=Math.atan2(y[1],y[0])-tailIntegral(rout,pars);
  const signedAngle=Math.atan2(Math.sin(thetaEnd),Math.cos(thetaEnd));
  const chi=Math.acos(cap(Math.cos(thetaEnd),-1,1));
  const theta=PI+winding-tail-tailIntegral(rout,pars);
  let view=samples.filter(s=>Math.hypot(s.x,s.y)<=5.35);
  if(view.length<3)view=samples;
  return {model,E,b,n,g,L,samples,view,chi,signedAngle,theta,rmin,errorE,errorL,accepted,rejected,collisions,status,turns:Math.abs(winding)/TAU};
}
export function hardSphereTrajectory(b=.6,E=1){
  const g=Math.sqrt(2*E),chi=hsAngle(b),cx=b<1?-Math.sqrt(1-b*b):0,cy=b,dx=Math.cos(chi),dy=Math.sin(chi);
  const inLength=cx+5,outLength=5,samples=[];
  for(let i=0;i<=100;i++){const x=-5+inLength*i/100;samples.push({t:(x+5)/g,x,y:b,vx:g,vy:0});}
  if(b<1)samples.push({t:inLength/g,x:cx,y:cy,vx:g*dx,vy:g*dy});
  for(let i=1;i<=120;i++){const s=outLength*i/120;samples.push({t:(inLength+s)/g,x:cx+dx*s,y:cy+dy*s,vx:g*dx,vy:g*dy});}
  return {model:'hs',E,b,n:12,g,L:-b*g,samples,view:samples,chi,signedAngle:chi,theta:chi,rmin:b<1?1:b,errorE:0,errorL:0,accepted:0,rejected:0,collisions:b<1?1:0,status:'ok',turns:0,contact:[cx,cy]};
}
export function trajectoryAt(result,fraction){
  const s=result.view,t=s[0].t+cap(fraction,0,1)*(s[s.length-1].t-s[0].t);
  let lo=0,hi=s.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(s[mid].t<=t)lo=mid;else hi=mid;}
  const a=s[lo],b=s[hi],f=b.t===a.t?0:(t-a.t)/(b.t-a.t);
  return Object.fromEntries(['t','x','y','vx','vy'].map(k=>[k,a[k]+(b[k]-a[k])*f]));
}
export function deflectionCurve({model='lj',E=1,n=12,bmax=2.8,count=130,panels=550}={}){
  const nodes=Array.from({length:count},(_,i)=>bmax*i/(count-1));
  const crit=model==='lj'?criticalOrbit(E):null;
  if(crit&&crit.b<bmax){
    nodes.push(crit.b);
    for(const delta of [.03,.01,.003,.001,.0003,.0001])for(const sign of [-1,1]){
      const b=crit.b*(1+sign*delta);if(b>0&&b<bmax)nodes.push(b);
    }
  }
  const arr=[];
  for(const b of [...new Set(nodes)].sort((a,b)=>a-b)){
    const refined=crit&&Math.abs(b/crit.b-1)<.0011?Math.max(panels,6000):panels;
    try{arr.push({b,...deflectionByQuadrature({model,E,b,n,panels:refined})});}
    catch{arr.push({b,theta:NaN,chi:NaN,status:'unresolved'});}
  }
  return arr;
}
/** Area-conservative b-annulus integration into equal-mu bins; all branches contribute.
 * Finite bmax is an explicit numerical cutoff, not a total cross section of LJ/IPL.
 */
export function areaBinnedDcs(curve,bins=30){
  const area=Array(bins).fill(0);let omitted=0;
  for(let i=0;i<curve.length-1;i++){
    const a=curve[i],b=curve[i+1],da=PI*(b.b*b.b-a.b*a.b);
    if(!Number.isFinite(a.chi)||!Number.isFinite(b.chi)){omitted+=da;continue;}
    const subdiv=12;
    for(let j=0;j<subdiv;j++){
      const areaFraction=(j+.5)/subdiv,bmid=Math.sqrt(a.b*a.b+(b.b*b.b-a.b*a.b)*areaFraction),t=(bmid-a.b)/(b.b-a.b),theta=a.theta+(b.theta-a.theta)*t,mu=Math.cos(theta),index=Math.min(bins-1,Math.floor((mu+1)/2*bins));
      area[index]+=da/subdiv;
    }
  }
  const domega=4*PI/bins;
  return {area,dcs:area.map(a=>a/domega),domega,omitted};
}
