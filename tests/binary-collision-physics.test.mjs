import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../demos/binary-collision/physics.js';
const close=(actual,expected,tol=1e-10)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}; tolerance ${tol}`);

test('potential definitions and analytic Lennard–Jones minimum',()=>{
  close(P.potential(1,'lj'),0);close(P.potential(2**(1/6),'lj'),-1);
  close(P.radialForce(2**(1/6),'lj'),0,2e-14);
  assert.equal(P.potential(.9,'hs'),Infinity);close(P.potential(1.1,'hs'),0);
  close(P.potential(1,'sutherland'),-1);close(P.potential(2,'coulomb'),.5);
  assert.throws(()=>P.potential(1,'invalid'),RangeError);
});
test('all smooth forces equal minus the numerical potential derivative',()=>{
  for(const m of ['ipl','sutherland','lj','coulomb'])for(const r of [.95,1.2,2,4]){
    const h=1e-6*r,der=-(P.potential(r+h,m)-P.potential(r-h,m))/(2*h);
    close(P.radialForce(r,m),der,Math.max(1e-8,Math.abs(der)*2e-8));
  }
});
test('hard sphere limits, contact normal, energy and angular momentum',()=>{
  close(P.hsAngle(0),Math.PI);close(P.hsAngle(1),0);close(P.hsAngle(1.5),0);
  for(const b of [0,.2,.65,.99,1.05]){
    const a=P.hardSphereTrajectory(b,1.7),g=Math.sqrt(3.4);
    if(b<1){const [nx,ny]=a.contact,vx=g-2*g*nx*nx,vy=-2*g*nx*ny;close(vx,g*Math.cos(a.chi));close(vy,g*Math.sin(a.chi));}
    for(const q of a.samples){close((q.vx*q.vx+q.vy*q.vy)/2,1.7,1e-12);close(q.x*q.vy-q.y*q.vx,-b*g,1e-12);}
    close(P.hsDcs(),.25);
  }
});
test('hard-sphere sampled velocity jumps rather than interpolating across the impulse',()=>{
  const q=P.hardSphereTrajectory(.6,1),hit=q.samples[100].t,T=q.samples.at(-1).t;
  const before=P.trajectoryAt(q,(hit-1e-7)/T),after=P.trajectoryAt(q,(hit+1e-7)/T);
  close(before.vx,Math.sqrt(2));close(before.vy,0);
  close(after.vx,Math.sqrt(2)*Math.cos(q.chi));close(after.vy,Math.sqrt(2)*Math.sin(q.chi));
});
test('relative-to-lab transformation preserves CM, momentum and kinetic energy split',()=>{
  for(const m1 of [.25,1,4]){
    const m2=1,r=[1.2,-.3],v=[1.5,.7],R=[.8,-.1],V=[.4,.2],M=m1+m2,q=P.labFromRelative(r,v,m1,m2,R,V);
    for(let i=0;i<2;i++){close(q.r1[i]-q.r2[i],r[i]);close(q.v1[i]-q.v2[i],v[i]);close((m1*q.r1[i]+m2*q.r2[i])/M,R[i]);close(m1*q.v1[i]+m2*q.v2[i],M*V[i]);}
    const sq=v=>v.reduce((s,x)=>s+x*x,0);
    close((m1*sq(q.v1)+m2*sq(q.v2))/2,(M*sq(V)+q.mu*sq(v))/2);
  }
  assert.throws(()=>P.labFromRelative([0,0],[1,0],0,1));
});
test('finite annulus-to-band Jacobian is exactly d²/4 for HS',()=>{
  for(const lo of [.01,.2,.6,.9]){const hi=Math.min(1,lo+.05),area=Math.PI*(hi*hi-lo*lo),omega=2*Math.PI*(Math.cos(P.hsAngle(hi))-Math.cos(P.hsAngle(lo)));close(area/omega,.25,1e-12);}
});
test('seeded area-uniform sampling has the correct second moment',()=>{
  assert.deepEqual(P.sampleDisk(20,2,123),P.sampleDisk(20,2,123));
  const q=P.sampleDisk(40000,2,123);close(q.reduce((s,x)=>s+x.b*x.b,0)/q.length,2,.02);
  assert.ok(q.every(x=>x.b>=0&&x.b<=2&&x.phi>=0&&x.phi<2*Math.PI));
});
test('HS and VSS scattering, normalization and angular moments',()=>{
  for(const a of [1,1.5,2,3]){
    for(const b of [0,.1,.6,1]){const angle=P.vssAngle(b,1,a);close(Math.cos(angle),2*b**(2/a)-1);if(a===1)close(angle,P.hsAngle(b));}
    const integral=P.integrateSimpson(chi=>2*Math.PI*Math.sin(chi)*P.vssDcs(chi,1,a),0,Math.PI,4000);
    close(integral,Math.PI,2e-7);
    const ens=P.scatterEnsemble(24000,{alpha:a,seed:827});
    close(ens.hits.reduce((s,p)=>s+p.mu,0)/ens.hits.length,(a-1)/(a+1),.012);
    assert.equal(ens.histogram.reduce((a,b)=>a+b,0),24000);
    for(const p of ens.hits.slice(0,50))close(p.dir.reduce((s,x)=>s+x*x,0),1);
  }
});
test('VHS reference normalization, speed exponent and HS limit',()=>{
  for(const w of [.5,.75,1])close(P.vhsDiameter(Math.sqrt(2),w),1);
  close(P.vhsDiameter(.1,.5),1);close(P.vhsDiameter(10,.5),1);
  close(P.vhsDiameter(4,.8)/P.vhsDiameter(1,.8),4**(-.3));
  assert.throws(()=>P.vhsDiameter(0,.75));assert.throws(()=>P.vssAngle(.5,1,0));
});

for(const model of ['ipl','sutherland','lj','coulomb'])test(`${model}: trajectories agree with independent radial quadrature on a parameter grid`,()=>{
  for(const E of [.1,.3,1,5])for(const b of [0,.35,.8,1.4,2.7]){
    const q=P.solveTrajectory({model,E,b}),r=P.deflectionByQuadrature({model,E,b,panels:2400});
    assert.equal(q.status,'ok',JSON.stringify({model,E,b,status:q.status}));
    close(q.chi,r.chi,3e-5);assert.ok(q.errorE<2e-6,`${model} E error ${q.errorE}`);assert.ok(q.errorL<2e-7);
    assert.ok(q.samples.every(x=>Object.values(x).every(Number.isFinite)));
    if(model==='sutherland')assert.ok(q.rmin>=1-1e-12);
  }
});
test('Rutherford formula is recovered independently by the trajectory solver',()=>{
  for(const E of [.08,.7,8])for(const b of [.1,.7,2.5]){const q=P.solveTrajectory({model:'coulomb',E,b});close(q.chi,2*Math.atan(1/(2*E*b)),5e-7);}
});
test('LJ orbiting threshold satisfies the barrier conditions',()=>{
  for(const E of [.1,.3,.7]){
    const c=P.criticalOrbit(E),pars={model:'lj',E,b:c.b};close(P.effectivePotential(c.r,pars),E,1e-12);
    close(-P.radialForce(c.r,'lj')-2*E*c.b*c.b/c.r**3,0,1e-12);
    const h=1e-4,second=(P.effectivePotential(c.r+h,pars)-2*E+P.effectivePotential(c.r-h,pars))/(h*h);assert.ok(second<0);
    assert.equal(P.deflectionByQuadrature(pars).status,'critical');
  }
  assert.equal(P.criticalOrbit(.9),null);
});
test('near-critical LJ trajectories resolve multiple turns and conserve energy',()=>{
  const E=.3,c=P.criticalOrbit(E);
  for(const f of [.999,.9999,1.001]){
    const b=c.b*f,q=P.solveTrajectory({model:'lj',E,b}),r=P.deflectionByQuadrature({model:'lj',E,b,panels:16000});
    assert.equal(q.status,'ok');close(q.chi,r.chi,8e-5);assert.ok(q.errorE<2e-6);
    if(f<1)assert.ok(q.turns>1.5);
  }
});
test('finite-beam angular binning conserves area and reports omissions',()=>{
  const q=P.deflectionCurve({model:'hs',bmax:1,count:101}),h=P.areaBinnedDcs(q,20);
  close(h.dcs.reduce((a,b)=>a+b,0)*h.domega,Math.PI,1e-12);close(h.omitted,0);
  q[50].chi=NaN;const bad=P.areaBinnedDcs(q,20);
  close(bad.area.reduce((a,b)=>a+b,0)+bad.omitted,Math.PI,1e-12);assert.ok(bad.omitted>0);
});
test('integration failures are explicit, not silently marked as successful',()=>{
  assert.equal(P.solveTrajectory({model:'lj',maxSteps:1}).status,'step-limit');
  assert.throws(()=>P.solveTrajectory({E:0}));assert.throws(()=>P.solveTrajectory({b:-1}));assert.throws(()=>P.turningPoint({E:-1}));
});
