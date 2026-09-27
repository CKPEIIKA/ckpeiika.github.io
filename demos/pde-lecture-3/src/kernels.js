const moduleValue = (() => {
/** Numerical kernels. No DOM, plotting code or external dependencies.
 * All spatial/time quantities in these teaching problems are nondimensional.
 * No hidden clipping, smoothing, adaptive timesteps or viscosity are used.
 */
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (i, n) => ((i % n) + n) % n;
const sum = a => a.reduce((s, x) => s + x, 0);
const factorial = n => { let f=1; for(let i=2;i<=n;i++) f*=i; return f; };
const normInf = a => a.reduce((s,x)=>Math.max(s,Math.abs(x)),0);
const l2Error = (a,b) => Math.sqrt(sum(a.map((v,i)=>(v-b[i])**2))/a.length);
const l1Error = (a,b) => sum(a.map((v,i)=>Math.abs(v-b[i])))/a.length;
function solveDense(A, rhs) {
  const n=rhs.length, a=A.map((r,i)=>[...r,rhs[i]]);
  if(!n || a.some(r=>r.length!==n+1)) throw new RangeError('Square system required');
  for(let k=0;k<n;k++) {
    let p=k; for(let i=k+1;i<n;i++) if(Math.abs(a[i][k])>Math.abs(a[p][k])) p=i;
    if(Math.abs(a[p][k])<1e-14) throw new RangeError('Singular or nearly singular system');
    [a[k],a[p]]=[a[p],a[k]];
    for(let i=k+1;i<n;i++) {const f=a[i][k]/a[k][k]; a[i][k]=0;
      for(let j=k+1;j<=n;j++) a[i][j]-=f*a[k][j];}
  }
  const x=new Array(n).fill(0);
  for(let i=n-1;i>=0;i--) {let s=a[i][n];for(let j=i+1;j<n;j++)s-=a[i][j]*x[j];x[i]=s/a[i][i];}
  return x;
}
/** a[0] and c[n-1] are unused. The input arrays are not modified. */
function thomas(a,b,c,rhs) {
  const n=b.length, d=[...b], r=[...rhs], out=new Array(n);
  for(let i=1;i<n;i++) {if(Math.abs(d[i-1])<1e-14)throw new RangeError('Zero Thomas pivot');
    const m=a[i]/d[i-1];d[i]-=m*c[i-1];r[i]-=m*r[i-1];}
  if(Math.abs(d[n-1])<1e-14)throw new RangeError('Zero Thomas pivot');
  out[n-1]=r[n-1]/d[n-1];
  for(let i=n-2;i>=0;i--)out[i]=(r[i]-c[i]*out[i+1])/d[i];
  return out;
}
/** Constant symmetric cyclic tridiagonal solve by Sherman-Morrison. n>=3. */
function cyclicSolve(rhs, diagonal=1, off=.25) {
  const n=rhs.length;
  if(n<3)throw new RangeError('At least three points required');
  if(!off)return rhs.map(v=>v/diagonal);
  const gamma=-diagonal, a=new Array(n).fill(off),c=[...a],b=new Array(n).fill(diagonal);
  b[0]-=gamma; b[n-1]-=off*off/gamma;
  const u=new Array(n).fill(0);u[0]=gamma;u[n-1]=off;
  const x=thomas(a,b,c,rhs), z=thomas(a,b,c,u);
  const f=(x[0]+off*x[n-1]/gamma)/(1+z[0]+off*z[n-1]/gamma);
  return x.map((v,i)=>v-f*z[i]);
}
/** Coefficients w for sum_j w_j f(x+s_j*h) / h^m. */
function fdWeights(offsets,m=1) {
  const n=offsets.length;
  if(!Number.isInteger(m)||m<0||m>=n)throw new RangeError('Need more nodes than derivative order');
  if(new Set(offsets).size!==n)throw new RangeError('Stencil nodes must be distinct');
  const A=Array.from({length:n},(_,k)=>offsets.map(s=>s**k/factorial(k)));
  return solveDense(A,Array.from({length:n},(_,k)=>k===m?1:0));
}
function moments(offsets,weights,count=9) {
  return Array.from({length:count},(_,k)=>sum(offsets.map((s,j)=>weights[j]*s**k))/factorial(k));
}
function formalOrder(offsets, weights, m=1) {
  const M=moments(offsets,weights,14);
  for(let k=0;k<=m;k++)if(Math.abs(M[k]-(k===m?1:0))>1e-8)return 0;
  for(let k=m+1;k<M.length;k++)if(Math.abs(M[k])>1e-9)return k-m;
  return 14-m;
}
const STENCILS={forward:[0,1],backward:[-1,0],central:[-1,0,1],fourth:[-2,-1,0,1,2],onesided:[0,1,2],asymmetric:[-1,0,2]};
const FUNCTIONS={
  sin:{f:x=>Math.sin(x),d:x=>Math.cos(x),dd:x=>-Math.sin(x)},
  exp:{f:x=>Math.exp(x),d:x=>Math.exp(x),dd:x=>Math.exp(x)},
  gaussian:{f:x=>Math.exp(-x*x),d:x=>-2*x*Math.exp(-x*x),dd:x=>(4*x*x-2)*Math.exp(-x*x)},
  cubic:{f:x=>x*x*x,d:x=>3*x*x,dd:x=>6*x}
};
function derivative(f,x,h,offsets,m=1) {
  const w=fdWeights(offsets,m);return sum(w.map((v,j)=>v*f(x+offsets[j]*h)))/h**m;
}
/** Actual rounded arithmetic, not a fabricated U-shaped error curve.
 * f32 uses Math.fround for arguments, function values, subtraction and division.
 * It is a binary32 arithmetic demonstration; Math.exp itself is the JS library.
 */
function roundedDerivative(x,h,method='central',precision='f64') {
  const R=precision==='f32'?Math.fround:v=>v, H=R(h),X=R(x);
  const F=z=>R(Math.exp(z));
  if(method==='forward')return R(R(F(R(X+H))-F(X))/H);
  return R(R(F(R(X+H))-F(R(X-H)))/R(2*H));
}
function sampleGrid(n,stretch=0) {
  return Array.from({length:n+1},(_,i)=>{const s=i/n;return Math.abs(stretch)<1e-9?s:Math.expm1(stretch*s)/Math.expm1(stretch);});
}
function profile(kind,x,frequency=2,phase=0) {
  const z=wrap(x-phase,1);
  if(kind==='sine')return .5+.4*Math.sin(TAU*frequency*z);
  if(kind==='step')return z>.2&&z<.45?1:0;
  if(kind==='triangle')return Math.max(0,1-Math.abs(z-.35)/.15);
  return Math.exp(-(((z-.35)/.075)**2));
}
function cellAverage(fn,a,b) {
  // Composite Simpson quadrature, fixed 32 subintervals; adequate for bounded presets.
  const m=32,h=(b-a)/m;let q=fn(a)+fn(b);
  for(let i=1;i<m;i++)q+=(i%2?4:2)*fn(a+i*h);
  return q/(3*m);
}
function advectionWeights(scheme,C) {
  if(scheme==='upwind')return C>=0?[C,1-C,0]:[0,1+C,-C];
  if(scheme==='lf')return [.5*(1+C),0,.5*(1-C)];
  if(scheme==='ftcs')return [.5*C,1,-.5*C];
  if(scheme==='downwind')return C>=0?[0,1+C,-C]:[C,1-C,0];
  // Lax-Wendroff; for constant linear advection MacCormack is algebraically equal.
  return [.5*(C+C*C),1-C*C,.5*(C*C-C)];
}
function advectionStep(u,C,scheme) {
  const n=u.length;
  if(scheme==='maccormack') {
    const p=u.map((v,i)=>v-C*(u[wrap(i+1,n)]-v));
    return u.map((v,i)=>.5*(v+p[i]-C*(p[i]-p[wrap(i-1,n)])));
  }
  const [l,c,r]=advectionWeights(scheme,C);
  return u.map((v,i)=>l*u[wrap(i-1,n)]+c*v+r*u[wrap(i+1,n)]);
}
function amplification(scheme,C,xi) {
  const [l,c,r]=advectionWeights(scheme,C);
  return {re:c+(l+r)*Math.cos(xi),im:(r-l)*Math.sin(xi)};
}
function maxAmplification(scheme,C) {
  let v=0;for(let j=0;j<=256;j++){const z=amplification(scheme,C,Math.PI*j/256);v=Math.max(v,Math.hypot(z.re,z.im));}return v;
}
function compactDerivative(u,h,kind='compact4') {
  const n=u.length;
  if(kind==='central')return u.map((_,i)=>(u[wrap(i+1,n)]-u[wrap(i-1,n)])/(2*h));
  if(kind==='fourth')return u.map((_,i)=>(u[wrap(i-2,n)]-8*u[wrap(i-1,n)]+8*u[wrap(i+1,n)]-u[wrap(i+2,n)])/(12*h));
  const alpha=kind==='compact6'?1/3:1/4,a=kind==='compact6'?14/9:3/2,b=kind==='compact6'?1/9:0;
  const rhs=u.map((_,i)=>a*(u[wrap(i+1,n)]-u[wrap(i-1,n)])/(2*h)+b*(u[wrap(i+2,n)]-u[wrap(i-2,n)])/(4*h));
  return cyclicSolve(rhs,1,alpha);
}
function modifiedWave(kind,xi) {
  if(kind==='central')return Math.sin(xi);
  if(kind==='fourth')return (8*Math.sin(xi)-Math.sin(2*xi))/6;
  if(kind==='compact6')return ((14/9)*Math.sin(xi)+(1/18)*Math.sin(2*xi))/(1+(2/3)*Math.cos(xi));
  return 1.5*Math.sin(xi)/(1+.5*Math.cos(xi));
}
/** theta method, homogeneous Dirichlet boundaries; endpoints included. */
function heatStep(u,r,theta=0) {
  const m=u.length-2;
  const rhs=Array.from({length:m},(_,j)=>{const i=j+1;return u[i]+(1-theta)*r*(u[i-1]-2*u[i]+u[i+1]);});
  const v=theta===0?rhs:thomas(new Array(m).fill(-theta*r),new Array(m).fill(1+2*theta*r),new Array(m).fill(-theta*r),rhs);
  return [0,...v,0];
}
function heatAmplification(r,theta,xi) {const z=4*r*Math.sin(xi/2)**2;return (1-(1-theta)*z)/(1+theta*z);}
function laplaceMatrix(n) {
  const N=n*n,A=Array.from({length:N},()=>new Array(N).fill(0));
  for(let j=0;j<n;j++)for(let i=0;i<n;i++) {const k=j*n+i;A[k][k]=4;
    if(i>0)A[k][k-1]=-1;if(i<n-1)A[k][k+1]=-1;if(j>0)A[k][k-n]=-1;if(j<n-1)A[k][k+n]=-1;}
  return A;
}
function laplaceSolve(n,left=1,right=0) {
  const A=laplaceMatrix(n),b=new Array(n*n).fill(0);
  // Vertical sides fixed; top/bottom zero. Corner values are unused by interior stencil.
  for(let j=0;j<n;j++){b[j*n]+=left;b[j*n+n-1]+=right;}return {A,b,u:solveDense(A,b)};
}
function balanceStep(u,F,dt,h,defect=0,face=3) {
  // defect: amount added to the inflow seen only by the cell to the right of face.
  return u.map((v,i)=>v+dt/h*(F[i]+(i===face?defect:0)-F[i+1]));
}
function burgersFlux(a,b) {return .25*(a*a+b*b)-.5*Math.max(Math.abs(a),Math.abs(b))*(b-a);}
function burgersStep(u,dt,h,left,right,conservative=true) {
  const n=u.length,v=new Array(n);
  if(conservative){const F=Array.from({length:n+1},(_,i)=>burgersFlux(i?u[i-1]:left,i<n?u[i]:right));
    for(let i=0;i<n;i++)v[i]=u[i]-dt/h*(F[i+1]-F[i]);
  }else{for(let i=0;i<n;i++)v[i]=u[i]-dt/h*u[i]*(u[i]-(i?u[i-1]:left));}
  return v;
}
function shockPosition(u,left,right,length=2) {
  // Mass-equivalent position: equals the front location for an exact single step.
  return length*(sum(u)/u.length-right)/(left-right);
}
function costEstimate({n=32,dim=2,mode='advection',variables=5,buffers=3,iterations=1,work=12}) {
  const dof=variables*n**dim,steps=mode==='diffusion'?2*dim*n*n:2*n;
  return {dof,steps,operations:dof*steps*iterations*work,memory:8*dof*buffers,exponent:dim+(mode==='diffusion'?2:1)};
}
function convolve(a,b) {const out={};for(const [i,x] of Object.entries(a))for(const [j,y] of Object.entries(b))out[+i+(+j)]=(out[+i+(+j)]||0)+x*y;return out;}
function applyShiftOperator(u,coeffs) {return u.map((_,i)=>sum(Object.entries(coeffs).map(([k,v])=>v*u[wrap(i+(+k),u.length)])));}

return { TAU, clamp, wrap, sum, factorial, normInf, l2Error, l1Error, solveDense, thomas, cyclicSolve, fdWeights, moments, formalOrder, STENCILS, FUNCTIONS, derivative, roundedDerivative, sampleGrid, profile, cellAverage, advectionWeights, advectionStep, amplification, maxAmplification, compactDerivative, modifiedWave, heatStep, heatAmplification, laplaceMatrix, laplaceSolve, balanceStep, burgersFlux, burgersStep, shockPosition, costEstimate, convolve, applyShiftOperator };
})();
export default moduleValue;
