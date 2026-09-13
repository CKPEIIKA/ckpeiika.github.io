import {solveTrajectory,deflectionByQuadrature,criticalOrbit} from '../demos/binary-collision/physics.js';
const records=[];
for(const model of ['ipl','sutherland','lj','coulomb']){
  const rows=[];
  for(const E of [.1,.3,1,5])for(const b of [0,.35,.8,1.4,2.7]){
    const q=solveTrajectory({model,E,b}),r=deflectionByQuadrature({model,E,b,panels:2400});
    rows.push({E,b,status:q.status,relativeEnergyDrift:q.errorE,normalizedAngularMomentumDrift:q.errorL,angleDifferenceRadians:Math.abs(q.chi-r.chi)});
  }
  records.push({model,cases:rows.length,maxEnergyDrift:Math.max(...rows.map(x=>x.relativeEnergyDrift)),maxAngularMomentumDrift:Math.max(...rows.map(x=>x.normalizedAngularMomentumDrift)),maxAngleDifferenceRadians:Math.max(...rows.map(x=>x.angleDifferenceRadians)),allSuccessful:rows.every(x=>x.status==='ok')});
}
const E=.3,b=criticalOrbit(E).b*.9999,orbit=solveTrajectory({model:'lj',E,b});
console.log(JSON.stringify({grid:records,nearCriticalLJ:{E,b,chiDegrees:orbit.chi*180/Math.PI,unwrappedThetaDegrees:orbit.theta*180/Math.PI,turns:orbit.turns,relativeEnergyDrift:orbit.errorE,normalizedAngularMomentumDrift:orbit.errorL,status:orbit.status}},null,2));
