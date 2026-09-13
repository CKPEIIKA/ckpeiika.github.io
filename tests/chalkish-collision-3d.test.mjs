import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3 as V,Camera3D,Scene3D,basisFor,circlePoints} from '../lib/chalkish/src/collision-3d.js';
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const closeV=(a,b,tol)=>a.forEach((x,i)=>close(x,b[i],tol));
test('3D vector identities and orthonormal plane bases',()=>{
  closeV(V.cross([1,0,0],[0,1,0]),[0,0,1]);closeV(V.unit([0,0,0]),[0,0,0]);
  for(const n of [[1,0,0],[0,1,0],[0,0,1],[1,2,3]]){const [u,v]=basisFor(n);close(V.dot(n,u),0);close(V.dot(n,v),0);close(V.dot(u,v),0);close(V.length(u),1);close(V.length(v),1);}
  assert.throws(()=>basisFor([0,0,0]));
});
test('3D circles lie in their plane at the requested radius',()=>{
  const c=[2,-3,1],n=[1,2,3],points=circlePoints(c,n,2.4,64);assert.equal(points.length,65);
  for(const p of points){close(V.length(V.sub(p,c)),2.4);close(V.dot(V.sub(p,c),n),0);}
  closeV(points[0],points.at(-1));
});
for(const projection of ['orthographic','perspective'])test(`${projection} projection and picking round-trip`,()=>{
  const camera=new Camera3D({projection,yaw:-.4,pitch:.3,zoom:1.2});
  const center=camera.project([0,0,0],1000,700);close(center.x,500);close(center.y,350);
  for(const p of [[1,1,0],[-2,1,0],[.1,-2,0]]){const s=camera.project(p,1000,700),q=camera.pickPlane(s.x,s.y,1000,700,[0,0,0],[0,0,1]);closeV(q,p,1e-9);}
});
test('near-plane segments are clipped or rejected without exploding projection',()=>{
  const c=new Camera3D({yaw:0,pitch:0,distance:10,projection:'perspective'});
  assert.equal(c.project([0,0,11],800,600),null);assert.equal(c.clipSegment([0,0,11],[1,0,12]),null);
  const ab=c.clipSegment([0,0,11],[1,0,0]);assert.ok(ab);assert.ok(c.project(ab[0],800,600));assert.ok(c.coordinates(ab[0])[2]>=c.near);
});
test('camera clamps singular pitch and unreasonable zoom',()=>{
  const c=new Camera3D({pitch:10,zoom:100,distance:.01});assert.ok(c.pitch<Math.PI/2);assert.equal(c.zoom,3.4);assert.equal(c.distance,.5);assert.ok(c.forward.every(Number.isFinite));
});
test('compound primitives create finite retained 3D geometry',()=>{
  const s=new Scene3D();s.cylinder([-2,0,0],[2,0,0],1).cone([0,0,0],[1,0,0],2,1).sphericalBand([0,0,0],2,.3,.5).annulus([0,0,0],[1,0,0],.3,.6).arc([0,0,0],[1,0,0],[0,1,0],1,0,2);
  assert.ok(s.items.length>200);
  for(const i of s.items)for(const p of i.points??[])assert.ok(p.length===3&&p.every(Number.isFinite));
  s.clear();assert.equal(s.items.length,0);
});
