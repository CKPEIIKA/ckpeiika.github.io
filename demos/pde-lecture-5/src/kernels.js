const moduleValue = (() => {
/** Lecture 5 numerical kernels, Float64 throughout.
 * Uniform-grid finite volumes unless a function explicitly says otherwise.
 * No clipping, filtering, or replacement by reference solutions is used.
 * Mathematical conventions and references: SOURCES.md.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mod=(i,n)=>((i%n)+n)%n;
const linspace=(a,b,n)=>Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));
function sum(a){let s=0,c=0;for(const v of a){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return s;}
const maxabs=a=>a.reduce((m,x)=>Math.max(m,Math.abs(x)),0);
const norm1=a=>sum(a.map(Math.abs))/a.length;
const tv=(a,periodic=true)=>sum(a.map((v,i)=>i||periodic?Math.abs(v-a[mod(i-1,a.length)]):0));
const metrics=a=>({min:Math.min(...a),max:Math.max(...a),mean:sum(a)/a.length,tv:tv(a)});
function linearCoefficients(nu,scheme='lw',q=nu*nu){
 if(scheme==='upwind')return [[-1,nu],[0,1-nu]];
 if(scheme==='lf')q=1;
 if(scheme==='bw')return [[-2,.5*nu*(nu-1)],[-1,nu*(2-nu)],[0,1-1.5*nu+.5*nu*nu]];
 if(scheme==='fromm'){
  const d=new Map();for(const [j,b] of [...linearCoefficients(nu,'lw'),...linearCoefficients(nu,'bw')])d.set(j,(d.get(j)||0)+b/2);
  return [...d].sort((a,b)=>a[0]-b[0]);
 }
 return [[-1,(q+nu)/2],[0,1-q],[1,(q-nu)/2]];
}
function linearStep(u,nu,scheme='lw',q){const c=linearCoefficients(nu,scheme,q);return u.map((_,i)=>sum(c.map(([j,b])=>b*u[mod(i+j,u.length)])));}
function predictorCorrector(u,lambda,type='maccormack',nonlinear=false){
 const f=nonlinear?(x=>.5*x*x):(x=>x),get=i=>u[mod(i,u.length)];
 let pred,after;
 if(type==='richtmyer'){
  pred=u.map((v,i)=>.5*(v+get(i+1))-.5*lambda*(f(get(i+1))-f(v)));
  after=u.map((v,i)=>v-lambda*(f(pred[i])-f(pred[mod(i-1,u.length)])));
 }else{
  pred=u.map((v,i)=>v-lambda*(f(get(i+1))-f(v)));
  after=u.map((v,i)=>.5*(v+pred[i]-lambda*(f(pred[i])-f(pred[mod(i-1,u.length)]))));
 }
 return {pred,after};
}
function minmod(...a){if(a.every(v=>v>0))return Math.min(...a);if(a.every(v=>v<0))return Math.max(...a);return 0;}
function slope(dm,dp,kind='minmod'){
 if(kind==='zero'||kind==='upwind')return 0;
 if(kind==='central'||kind==='fromm')return .5*(dm+dp);
 if(kind==='lw')return dp;
 if(kind==='bw')return dm;
 if(dm*dp<=0)return 0;
 if(kind==='minmod')return minmod(dm,dp);
 if(kind==='mc')return minmod(2*dm,.5*(dm+dp),2*dp);
 if(kind==='superbee')return Math.sign(dm)*Math.max(Math.min(2*Math.abs(dm),Math.abs(dp)),Math.min(Math.abs(dm),2*Math.abs(dp)));
 if(kind==='vanleer')return 2*dm*dp/(dm+dp);
 throw new Error('Unknown limiter '+kind);
}
function limiter(r,kind){if(kind==='lw')return 1;if(kind==='bw')return r;if(kind==='central'||kind==='fromm')return .5*(1+r);return slope(r,1,kind);}
/** Fully discrete flux-limited Lax-Wendroff correction, a=1, 0<=nu<=1. */
function limitedFluxes(u,nu,kind){return u.map((v,i)=>v+.5*(1-nu)*slope(v-u[mod(i-1,u.length)],u[mod(i+1,u.length)]-v,kind));}
function fluxLimitedStep(u,nu,kind){const f=limitedFluxes(u,nu,kind);return u.map((v,i)=>v-nu*(f[i]-f[mod(i-1,u.length)]));}
function solve(A,b){
 const n=b.length,m=A.map((r,i)=>[...r,b[i]]);
 for(let k=0;k<n;k++){
  let p=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[p][k]))p=i;
  if(Math.abs(m[p][k])<1e-15)throw new Error('Singular reconstruction matrix');[m[p],m[k]]=[m[k],m[p]];
  const d=m[k][k];for(let j=k;j<=n;j++)m[k][j]/=d;
  for(let i=0;i<n;i++)if(i!==k){const z=m[i][k];for(let j=k;j<=n;j++)m[i][j]-=z*m[k][j];}
 }
 return m.map(r=>r[n]);
}
function polynomialAverage(c,l,r){return sum(c.map((v,k)=>v*(r**(k+1)-l**(k+1))/(k+1)))/(r-l);}
function poly(c,x){let y=0;for(let k=c.length-1;k>=0;k--)y=y*x+c[k];return y;}
const avgMatrices=new Map(),faceWeights=new Map();
function averageMatrix(offsets){const key=offsets.join(',');if(!avgMatrices.has(key))avgMatrices.set(key,offsets.map(j=>offsets.map((_,k)=>((j+.5)**(k+1)-(j-.5)**(k+1))/(k+1))));return avgMatrices.get(key);}
function polynomialFromAverages(values,offsets){return solve(averageMatrix(offsets),values);}
function reconstructionWeights(offsets,x=.5){
 const key=offsets.join(',')+'@'+x;
 if(!faceWeights.has(key)){const A=averageMatrix(offsets),n=offsets.length;faceWeights.set(key,solve(Array.from({length:n},(_,k)=>A.map(row=>row[k])),Array.from({length:n},(_,k)=>x**k)));}
 return faceWeights.get(key);
}
function undivided(get,left,degree){let d=Array.from({length:degree+1},(_,j)=>get(left+j));for(let k=0;k<degree;k++)d=d.slice(1).map((v,j)=>v-d[j]);return d[0];}
/** True recursive ENO stencil choice (not argmin beta). Ties choose right as in Shu 1997. */
function eno(get,i=0,order=3){
 let left=i;const decisions=[];
 for(let degree=1;degree<order;degree++){
  const dl=undivided(get,left-1,degree),dr=undivided(get,left,degree),chooseLeft=Math.abs(dl)<Math.abs(dr);
  decisions.push({degree,left,dl,dr,chooseLeft,chosen:chooseLeft?left-1:left});if(chooseLeft)left--;
 }
 const offsets=Array.from({length:order},(_,j)=>left+j-i),values=offsets.map(j=>get(i+j));
 const value=sum(reconstructionWeights(offsets).map((w,j)=>w*values[j]));
 return {left,offsets,values,value,decisions};
}
function weno5(values,kind='js',epsilon=1e-6){
 if(values.length!==5||!(epsilon>0))throw new Error('WENO5 needs five values and epsilon>0');
 const [a,b,c,d,e]=values;
 const q=[a/3-7*b/6+11*c/6,-b/6+5*c/6+d/3,c/3+5*d/6-e/6];
 const beta=[13/12*(a-2*b+c)**2+.25*(a-4*b+3*c)**2,13/12*(b-2*c+d)**2+.25*(b-d)**2,13/12*(c-2*d+e)**2+.25*(3*c-4*d+e)**2];
 const optimal=[.1,.6,.3],tau=Math.abs(beta[0]-beta[2]);
 const alpha=optimal.map((d,k)=>kind==='linear'?d:kind==='z'?d*(1+(tau/(epsilon+beta[k]))**2):d/(epsilon+beta[k])**2);
 const total=sum(alpha),weights=alpha.map(v=>v/total),value=sum(weights.map((w,k)=>w*q[k]));
 return {q,beta,optimal,tau,alpha,weights,value};
}
function wenoPolynomials(values){return [[-2,-1,0],[-1,0,1],[0,1,2]].map((s,k)=>polynomialFromAverages(values.slice(k,k+3),s));}
function godunovBurgers(l,r){if(l<=r){if(l>=0)return .5*l*l;if(r<=0)return .5*r*r;return 0;}return l+r>=0?.5*l*l:.5*r*r;}
function numericalFlux(l,r,equation='advection',kind='godunov'){
 if(equation==='advection')return l;
 if(kind==='rusanov')return .25*(l*l+r*r)-.5*Math.max(Math.abs(l),Math.abs(r))*(r-l);
 return godunovBurgers(l,r);
}
function reconstruct(get,i,method,epsilon){
 if(method==='upwind')return get(i);
 if(['minmod','mc','superbee','vanleer','central'].includes(method))return get(i)+.5*slope(get(i)-get(i-1),get(i+1)-get(i),method);
 if(method==='eno3')return eno(get,i,3).value;
 return weno5([-2,-1,0,1,2].map(j=>get(i+j)),(method==='weno-z'||method==='wenoz')?'z':method==='linear5'?'linear':'js',epsilon).value;
}
function faceStates(get,i,method,epsilon=1e-6){return [reconstruct(get,i,method,epsilon),reconstruct(j=>get(i+1-j),0,method,epsilon)];}
function rhs(u,h,{method='minmod',epsilon=1e-6,equation='advection',flux='godunov',boundary='periodic',left=1,right=0}={}){
 const n=u.length,get=i=>boundary==='periodic'?u[mod(i,n)]:i<0?left:i>=n?right:u[i];
 const faces=Array.from({length:n+1},(_,k)=>{const [l,r]=faceStates(get,k-1,method,epsilon);return numericalFlux(l,r,equation,flux);});
 return {du:u.map((_,i)=>-(faces[i+1]-faces[i])/h),faces};
}
function rkStep(u,dt,h,options={},integrator='ssp3'){
 const f0=rhs(u,h,options),add=(v,f,t)=>v.map((x,i)=>x+t*f.du[i]);
 if(integrator==='midpoint'){
  const half=add(u,f0,dt/2),fh=rhs(half,h,options),out=add(u,fh,dt);
  return {out,stages:[u,half,out],boundaryChange:dt*(fh.faces[0]-fh.faces.at(-1))};
 }
 const u1=add(u,f0,dt),f1=rhs(u1,h,options),fe2=add(u1,f1,dt);
 if(integrator==='ssp2'){
  const out=u.map((v,i)=>.5*v+.5*fe2[i]);
  return {out,stages:[u,u1,fe2,out],boundaryChange:dt*.5*(f0.faces[0]-f0.faces.at(-1)+f1.faces[0]-f1.faces.at(-1))};
 }
 const u2=u.map((v,i)=>.75*v+.25*fe2[i]),f2=rhs(u2,h,options),fe3=add(u2,f2,dt),out=u.map((v,i)=>v/3+2*fe3[i]/3);
 return {out,stages:[u,u1,u2,out],boundaryChange:dt*((f0.faces[0]-f0.faces.at(-1))/6+(f1.faces[0]-f1.faces.at(-1))/6+2*(f2.faces[0]-f2.faces.at(-1))/3)};
}
const GX=[-.9602898564975363,-.7966664774136267,-.5255324099163290,-.1834346424956498,.1834346424956498,.5255324099163290,.7966664774136267,.9602898564975363];
const GW=[.1012285362903763,.2223810344533745,.3137066458778873,.3626837833783620,.3626837833783620,.3137066458778873,.2223810344533745,.1012285362903763];
function gaussAverage(f,l,r){return sum(GX.map((x,i)=>.5*GW[i]*f(.5*(l+r)+.5*(r-l)*x)));}
function hatIntegral(x,l,r){return clamp(x-l,0,r-l);}
function triangleIntegral(x,c,w){if(x<=c-w)return 0;if(x<c)return (x-c+w)**2/(2*w);if(x<c+w)return w/2+(x-c)-(x-c)**2/(2*w);return w;}
function bumpIntegral(x,l,r){const z=clamp(x-l,0,r-l),w=r-l;return .5*z-w/(4*Math.PI)*Math.sin(2*Math.PI*z/w);}
function primitive(kind,x){
 if(kind==='square')return hatIntegral(x,.22,.47);
 if(kind==='triangle')return triangleIntegral(x,.45,.18);
 if(kind==='bump')return 3*x/8-Math.sin(2*Math.PI*x)/(4*Math.PI)+Math.sin(4*Math.PI*x)/(32*Math.PI);
 if(kind==='composite')return bumpIntegral(x,.04,.24)+hatIntegral(x,.32,.47)+triangleIntegral(x,.66,.11)+.6*bumpIntegral(x,.83,.96);
 return .5*x+.45*(1-Math.cos(2*Math.PI*x))/(2*Math.PI);
}
function profile(kind,x){x=mod(x,1);if(kind==='square')return x>=.22&&x<.47?1:0;if(kind==='triangle')return Math.max(0,1-Math.abs(x-.45)/.18);if(kind==='bump')return Math.sin(Math.PI*x)**4;
 if(kind==='composite')return (x>=.04&&x<.24?.5-.5*Math.cos(2*Math.PI*(x-.04)/.2):0)+(x>=.32&&x<.47?1:0)+Math.max(0,1-Math.abs(x-.66)/.11)+(x>=.83&&x<.96?.3-.3*Math.cos(2*Math.PI*(x-.83)/.13):0);
 return .5+.45*Math.sin(2*Math.PI*x);
}
function averageProfile(kind,l,r,shift=0){const F=x=>{const k=Math.floor(x);return k*primitive(kind,1)+primitive(kind,x-k);};return (F(r-shift)-F(l-shift))/(r-l);}
function initialAverages(n,kind='square',shift=0){return Array.from({length:n},(_,i)=>averageProfile(kind,i/n,(i+1)/n,shift));}
/** Local cell averages in dimensionless xi=(x-x_i)/h, including subcell jumps. */
function localData(kind='jump',position=.75,amplitude=1,noise=0){
 const f=x=>kind==='jump'?(x<position?1:.1):kind==='corner'?Math.abs(x-position)/3:kind==='parabola'?1-.075*(x-position)**2:.6+.25*Math.sin(.8*(x-position));
 const get=j=>amplitude*(kind==='jump'?(.1+.9*clamp(position-(j-.5),0,1)):gaussAverage(f,j-.5,j+.5))+noise*Math.sin(7.31*j+1.7);
 return {f:x=>amplitude*f(x),get,values:linspace(-4,4,9).map(get)};
}
function reconstructionStudy(kind='critical',epsilon=1e-12,scaling='fixed',offset=0,amplitude=1){
 const f=x=>amplitude*(kind==='regular'?Math.exp(x):kind==='flat'?Math.sin(x)-.5*Math.sin(2*x):Math.cos(x)+Math.sin(x)**3/6);
 const rows=[];
 for(let j=0;j<9;j++){
  const h=.5/2**j,center=offset*h,target=center+h/2,values=[-2,-1,0,1,2].map(k=>gaussAverage(f,center+(k-.5)*h,center+(k+.5)*h));
  const eps=epsilon*(scaling==='h2'?h*h:1),js=weno5(values,'js',eps),z=weno5(values,'z',eps),optimal=weno5(values,'linear',eps),exact=f(target);
  rows.push({h,N:1/h,exact,linear_error:Math.abs(optimal.value-exact),js_error:Math.abs(js.value-exact),z_error:Math.abs(z.value-exact),js_weight_error:maxabs(js.weights.map((v,k)=>v-js.optimal[k])),z_weight_error:maxabs(z.weights.map((v,k)=>v-z.optimal[k])),epsilon:eps});
 }
 return rows;
}
function burgersAverage(l,r,t,ul,ur){
 if(t<=0)return ((Math.min(r,0)-Math.min(l,0))*ul+(Math.max(r,0)-Math.max(l,0))*ur)/(r-l);
 if(ul>ur){const s=.5*(ul+ur)*t,c=clamp(s,l,r);return (ul*(c-l)+ur*(r-c))/(r-l);}
 if(ul===ur)return ul;
 const a=ul*t,b=ur*t;const F=x=>x<a?ul*(x-a):x<=b?(x*x-a*a)/(2*t):(b*b-a*a)/(2*t)+ur*(x-b);
 return (F(r)-F(l))/(r-l);
}
function convergenceRate(rows,key,index=4){const a=rows[index],b=rows[index+1];if(a[key]<=1e-14||b[key]<=1e-14)return null;return Math.log(a[key]/b[key])/Math.log(a.h/b.h);}

return {clamp,mod,linspace,sum,maxabs,norm1,tv,metrics,linearCoefficients,linearStep,predictorCorrector,minmod,slope,limiter,limitedFluxes,fluxLimitedStep,solve,polynomialAverage,poly,polynomialFromAverages,reconstructionWeights,eno,weno5,wenoPolynomials,godunovBurgers,numericalFlux,faceStates,rhs,rkStep,gaussAverage,profile,averageProfile,initialAverages,localData,reconstructionStudy,burgersAverage,convergenceRate};
})();
export default moduleValue;
