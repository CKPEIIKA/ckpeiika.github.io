const moduleValue = (() => {
/** Independent numerical kernels. All lengths and times below are nondimensional.
 * No plotting dependencies, no DOM, no network. Pure functions unless documented.
 */
const TAU=2*Math.PI;
const range=(n,f=i=>i)=>Array.from({length:n},(_,i)=>f(i));
const sum=a=>a.reduce((s,x)=>s+x,0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const Cx=(re=0,im=0)=>({re,im});
const add=(a,b)=>Cx(a.re+b.re,a.im+b.im);
const sub=(a,b)=>Cx(a.re-b.re,a.im-b.im);
const mul=(a,b)=>Cx(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const scale=(a,s)=>Cx(a.re*s,a.im*s);
const abs=a=>Math.hypot(a.re,a.im);
const div=(a,b)=>{const q=b.re*b.re+b.im*b.im;return q?Cx((a.re*b.re+a.im*b.im)/q,(a.im*b.re-a.re*b.im)/q):Cx(Infinity,Infinity);};
const expi=t=>Cx(Math.cos(t),Math.sin(t));
function cpow(z,n){if(n===0)return Cx(1);const r=abs(z);if(r===0)return Cx();return scale(expi(Math.atan2(z.im,z.re)*n),Math.exp(Math.min(690,n*Math.log(r))));}
const norm2=(a,h=1/a.length)=>Math.sqrt(h*sum(a.map(x=>x*x)));
const normInf=a=>Math.max(...a.map(Math.abs));
function gain(scheme,c,t){switch(scheme){
 case 'upwind':return Cx(1-c+c*Math.cos(t),-c*Math.sin(t));
 case 'downwind':return Cx(1+c-c*Math.cos(t),-c*Math.sin(t));
 case 'ftcs':return Cx(1,-c*Math.sin(t));
 case 'lf':return Cx(Math.cos(t),-c*Math.sin(t));
 case 'lw':return Cx(1+c*c*(Math.cos(t)-1),-c*Math.sin(t));
 case 'heat':return Cx(1-4*c*Math.sin(t/2)**2);
 case 'beheat':return Cx(1/(1+4*c*Math.sin(t/2)**2));
 default:throw Error('Unknown scheme '+scheme);
}}
function mixedGain(w,c,t){return Cx(1+c*(1-2*w)*(Math.cos(t)-1),-c*Math.sin(t));}
function stability(method,z){if(method==='be')return div(Cx(1),sub(Cx(1),z));if(method==='cn')return div(add(Cx(1),scale(z,.5)),sub(Cx(1),scale(z,.5)));
 const order={euler:1,rk2:2,rk3:3,rk4:4}[method];if(!order)throw Error('Unknown method');let r=Cx(1),t=Cx(1);for(let k=1;k<=order;k++){t=scale(mul(t,z),1/k);r=add(r,t);}return r;}
function modalSpectrum(kind,s,n){return range(n,k=>{const t=TAU*k/n;return Cx(kind==='advection'?0:-4*s*(kind==='mixed'?.15:1)*Math.sin(t/2)**2,kind==='diffusion'?0:-s*Math.sin(t));});}
function dft(u){const N=u.length;return range(N,k=>{let re=0,im=0;for(let j=0;j<N;j++){const t=TAU*j*k/N;re+=u[j]*Math.cos(t);im-=u[j]*Math.sin(t);}return Cx(re/N,im/N);});}
function idft(c){const N=c.length;return range(N,j=>sum(c.map((v,k)=>v.re*Math.cos(TAU*j*k/N)-v.im*Math.sin(TAU*j*k/N))));}
function foldedEnergy(c){const N=c.length;return range(N/2+1,k=>abs(c[k])**2*(k===0||k===N/2?1:2));}
function ellipticError(N,iterations,k=1){const h=1/N,q=Math.cos(k*Math.PI*h),lam=4/h**2*Math.sin(k*Math.PI*h/2)**2,amp=(k*Math.PI)**2/lam;
 const xs=range(N+1,i=>i*h),exact=xs.map(x=>Math.sin(k*Math.PI*x)),star=exact.map(x=>amp*x),iterate=star.map(x=>x*(1-q**iterations));
 const disc=star.map((x,i)=>x-exact[i]),alg=iterate.map((x,i)=>x-star[i]),total=iterate.map((x,i)=>x-exact[i]),residual=exact.map(x=>-((k*Math.PI)**2)*q**iterations*x);
 return {xs,exact,star,iterate,disc,alg,total,residual,lam,q};}
function consistencyStudy(scheme,c,T,logeps=-12,noise=true){return [16,32,64,128,256].map(N=>{
 const h=1/N,n=Math.ceil(T/(c*h)),dt=T/n,co=dt/h,t=TAU*h,G=gain(scheme,co,t),U=cpow(G,n),truth=expi(-TAU*T);
 const Ds=scheme==='upwind'?scale(sub(Cx(1),expi(-t)),1/h):scale(sub(expi(t),Cx(1)),1/h);
 const defect=abs(add(scale(sub(expi(-TAU*dt),Cx(1)),1/dt),Ds));
 const e0=noise?10**logeps*h*h:0,high=e0*abs(cpow(gain(scheme,co,Math.PI),n)),error=Math.hypot(abs(sub(U,truth)),high);
 return {N,h,n,dt,co,defect,error,high,initialNoise:e0,U,truth};});}
function errorHistory(N,p,family,impulse=-1){const dt=1/N,h=1/N,G=family==='decay'?1-.8*dt:family==='physical'?1+.8*dt:1.06,local=h**p;
 const values=[0],forcing=[];for(let j=0;j<N;j++){const f=j===impulse?local*8:local;forcing.push(f);values.push(G*values[j]-dt*f);}return {N,dt,G,local,values,forcing};}
function leapfrogRoots(c,t){const a=c*Math.sin(t),d=1-a*a;if(d>=0)return [Cx(Math.sqrt(d),-a),Cx(-Math.sqrt(d),-a)];return [Cx(0,-a+Math.sqrt(-d)),Cx(0,-a-Math.sqrt(-d))];}
function leapfrogSequence(c,t,eps,n){const roots=leapfrogRoots(c,t),v=[Cx(1),add(roots[0],Cx(eps))];for(let j=1;j<n;j++)v.push(sub(v[j-1],mul(Cx(0,2*c*Math.sin(t)),v[j])));return {roots,v:v.slice(0,n+1)};}
const matMul2=(A,B)=>[A[0]*B[0]+A[1]*B[2],A[0]*B[1]+A[1]*B[3],A[2]*B[0]+A[3]*B[2],A[2]*B[1]+A[3]*B[3]];
function matPow2(A,n){let R=[1,0,0,1],B=A.slice();while(n>0){if(n&1)R=matMul2(R,B);B=matMul2(B,B);n=Math.floor(n/2);}return R;}
function normMat2(A){const tr=sum(A.map(x=>x*x)),det=(A[0]*A[3]-A[1]*A[2])**2;return Math.sqrt(Math.max(0,(tr+Math.sqrt(Math.max(0,tr*tr-4*det)))/2));}
function resolventNorm(r,s,K,z){const a=div(Cx(1),sub(z,Cx(r))),d=div(Cx(1),sub(z,Cx(s))),b=scale(mul(a,d),K);
 const tr=abs(a)**2+abs(b)**2+abs(d)**2,det=abs(mul(a,d))**2;return Math.sqrt(Math.max(0,(tr+Math.sqrt(Math.max(0,tr*tr-4*det)))/2));}
function sbp(N,weight=.5){const h=1/N,H=range(N+1,i=>h*(i===0||i===N?weight:1)),D=range(N+1,()=>range(N+1,()=>0));
 D[0][0]=-1/h;D[0][1]=1/h;D[N][N-1]=-1/h;D[N][N]=1/h;for(let j=1;j<N;j++){D[j][j-1]=-.5/h;D[j][j+1]=.5/h;}
 const Q=D.map((r,i)=>r.map(v=>H[i]*v)),B=range(N+1,i=>range(N+1,j=>i===j?(i===0?-1:i===N?1:0):0)),M=Q.map((r,i)=>r.map((v,j)=>v+Q[j][i])),defect=normInf(M.flatMap((r,i)=>r.map((v,j)=>v-B[i][j])));return {h,H,D,Q,B,M,defect};}
const mv=(A,x)=>A.map(r=>sum(r.map((v,i)=>v*x[i])));
function satRhs(u,g,sigma,h){const N=u.length-1,du=u.map((_,i)=>i===0?-(u[1]-u[0])/h:i===N?-(u[N]-u[N-1])/h:-(u[i+1]-u[i-1])/(2*h));du[0]-=2*sigma/h*(u[0]-g);return du;}
function satEnergy(u,g,sigma,h){const N=u.length-1,H=u.map((_,i)=>h*(i===0||i===N?.5:1)),rhs=satRhs(u,g,sigma,h),E=.5*sum(u.map((v,i)=>H[i]*v*v)),dot=sum(u.map((v,i)=>H[i]*v*rhs[i]));const out=-.5*u[N]**2,closure=(.5-sigma)*u[0]**2,inflow=sigma*u[0]*g;return {E,dot,out,closure,inflow,residual:dot-out-closure-inflow};}
function rk4step(u,t,dt,rhs){const k1=rhs(u,t),k2=rhs(u.map((v,i)=>v+dt*k1[i]/2),t+dt/2),k3=rhs(u.map((v,i)=>v+dt*k2[i]/2),t+dt/2),k4=rhs(u.map((v,i)=>v+dt*k3[i]),t+dt);return u.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);}
function boundaryMode(c,b){const den=b-1+c,kappa=Math.abs(den)<1e-14?Infinity:c/den;return {z:b,kappa,localized:Number.isFinite(kappa)&&Math.abs(kappa)<1};}
function boundaryStep(u,c,b){return u.map((v,j)=>j===0?b*v:(1-c)*v+c*u[j-1]);}
function modifiedRate(w,c,t){const mu=.5*c*(1-2*w-c);return {exact:Math.log(abs(mixedGain(w,c,t))),approx:-mu*t*t,mu};}
function dispersion(c,t){const q=c*Math.sin(t),omega=Math.asin(clamp(q,-1,1)),den=Math.sqrt(Math.max(0,1-q*q));return {omega,vp:t===0?1:omega/(c*t),vg:den?Math.cos(t)/den:NaN};}
function packet(c,k0,width,n,N=128){const ks=range(N/2-1,k=>k+1),weights=ks.map(k=>Math.exp(-.5*((k-k0)/width)**2)),Z=sum(weights);
 const coeffs=weights.map(w=>w/Z),xs=range(401,j=>j/400),x0=.22;
 const evalAt=(x,exact=false)=>{let re=0,im=0;for(let j=0;j<ks.length;j++){const k=ks[j],t=TAU*k/N,phase=TAU*k*(x-x0)-(exact?c*t:dispersion(c,t).omega)*n;re+=coeffs[j]*Math.cos(phase);im+=coeffs[j]*Math.sin(phase);}return [re,Math.hypot(re,im)];};
 const num=xs.map(x=>evalAt(x)),exact=xs.map(x=>evalAt(x,true));return {xs,u:num.map(v=>v[0]),env:num.map(v=>v[1]),exact:exact.map(v=>v[0]),exactEnv:exact.map(v=>v[1]),...dispersion(c,TAU*k0/N),time:n*c/N};}
function rungeStudy(base,path,T=.05,bias=0){const truth=Math.exp(-(Math.PI**2)*T),rows=range(6,l=>{const N=base*2**l,h=1/N,target=path==='h2'?.4*h*h:path==='h'?.3*h:.01,steps=Math.ceil(T/target),dt=T/steps,lambda=4/h**2*Math.sin(Math.PI*h/2)**2,value=Math.exp(-steps*Math.log1p(lambda*dt))+bias;return {N,h,dt,steps,value,truth,error:Math.abs(value-truth)};});return rows;}
function rungeTriplet(rows,i=0,pAssumed=2){const [a,b,c]=rows.slice(i,i+3),d1=a.value-b.value,d2=b.value-c.value,p=Math.abs(d1)>1e-15&&Math.abs(d2)>1e-15?Math.log(Math.abs(d1/d2))/Math.log(2):NaN;
 const correction=(c.value-b.value)/(2**pAssumed-1),estimate=c.value+correction;return {p,correction,estimate,errorEstimate:Math.abs(correction),actual:c.error,sameSign:d1*d2>0};}
function manufactured(x,t,rich=false){return Math.exp(-t)*((rich?1+.2*x:0)+Math.sin(TAU*x));}
function manufacturedSource(x,t,rich=false,bug='none'){const sh=(rich?1+.2*x:0)+Math.sin(TAU*x),grad=(rich?.2:0)+(bug==='coefficient'?1:TAU)*Math.cos(TAU*x),f=Math.exp(-t)*(-sh+grad);return bug==='source-off'?0:bug==='source-sign'?-f:f;}
function mmsSolve(N,c,T,rich=false,bug='none'){const h=1/N,xs=range(N+1,i=>i*h);let t=0,u=xs.map(x=>manufactured(x,0,rich)),steps=0;
 while(t<T-1e-13){const dt=Math.min(c*h,T-t),v=u.slice();v[0]=manufactured(0,bug==='boundary'?0:t+dt,rich);for(let i=1;i<=N;i++)v[i]=u[i]-dt/h*(u[i]-u[i-1])+dt*manufacturedSource(xs[i],t,rich,bug);u=v;t+=dt;steps++;}
 const exact=xs.map(x=>manufactured(x,T,rich)),error=u.map((v,i)=>v-exact[i]),weights=xs.map((_,i)=>h*(i===0||i===N?.5:1));return {N,h,steps,xs,u,exact,error,L1:sum(error.map((v,i)=>weights[i]*Math.abs(v))),L2:Math.sqrt(sum(error.map((v,i)=>weights[i]*v*v))),Linf:normInf(error)};}
/** Marching squares: grid values sampled once, returned line segments at one level.
 * Ambiguous saddle cells use the average to choose their topology. */
function contours(fn,xmin,xmax,ymin,ymax,nx=64,ny=64,level=0){const dx=(xmax-xmin)/nx,dy=(ymax-ymin)/ny,vals=range(ny+1,j=>range(nx+1,i=>fn(xmin+i*dx,ymin+j*dy))),out=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const ps=[[xmin+i*dx,ymin+j*dy],[xmin+(i+1)*dx,ymin+j*dy],[xmin+(i+1)*dx,ymin+(j+1)*dy],[xmin+i*dx,ymin+(j+1)*dy]],vs=[vals[j][i],vals[j][i+1],vals[j+1][i+1],vals[j+1][i]],edges=[];
  for(let k=0;k<4;k++){const l=(k+1)%4,a=vs[k]-level,b=vs[l]-level;if(Number.isFinite(a)&&Number.isFinite(b)&&((a<=0&&b>0)||(a>0&&b<=0))){const q=a/(a-b);edges.push([ps[k][0]+q*(ps[l][0]-ps[k][0]),ps[k][1]+q*(ps[l][1]-ps[k][1])]);}}
  if(edges.length===2)out.push(edges);else if(edges.length===4){if(sum(vs)/4>level)out.push([edges[0],edges[1]],[edges[2],edges[3]]);else out.push([edges[0],edges[3]],[edges[1],edges[2]]);}}
 return out;}

return {TAU,range,sum,clamp,Cx,add,sub,mul,scale,abs,div,expi,cpow,norm2,normInf,gain,mixedGain,stability,modalSpectrum,dft,idft,foldedEnergy,ellipticError,consistencyStudy,errorHistory,leapfrogRoots,leapfrogSequence,matMul2,matPow2,normMat2,resolventNorm,sbp,mv,satRhs,satEnergy,rk4step,boundaryMode,boundaryStep,modifiedRate,dispersion,packet,rungeStudy,rungeTriplet,manufactured,manufacturedSource,mmsSolve,contours};
})();
export default moduleValue;
