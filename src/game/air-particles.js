import * as THREE from 'three';

// 每个风区或喷口只画一批粒子。各粒子用同一个游玩时钟计算位置，续关时可直接重建这一帧。
const motion = {
  wind: `
    float life=max(.8,min(extent.x/max(abs(flow.x),.1),extent.y/max(abs(flow.y),.1)));
    float t=fract(clock/life+r.x);
    vec2 travel=flow*life;
    vec2 start=(r.yz-.5)*(extent-abs(travel));
    point=start+(t-.5)*travel + side*(.22*sin(t*9.+r.y*11.)+.12*sin(t*17.+r.z*9.));
    angle=atan(flow.y,flow.x)+.45*sin(t*8.+r.y*8.);
    shape=vec2(.27+.24*r.y,.075+.10*r.z)*(.65+.35*cos(t*12.+r.z));
    opacity=smoothstep(.0,.13,t)*(1.-smoothstep(.8,1.,t));
  `,
  spray: `
    float life=.7+.25*r.z;
    float t=fract(clock/life+r.x);
    vec2 vel=vec2((r.y-.5)*3.1,life*8.);
    float age=t*life;
    point=vec2((r.x-.5)*.36,0.) + vel*age-vec2(0.,8.*age*age);
    angle=atan(vel.y-16.*age,vel.x);
    shape=vec2(.14+.10*abs(1.-2.*t),.08+.06*r.z);
    opacity=smoothstep(0.,.1,t)*(1.-smoothstep(.86,1.,t));
  `,
  vapor: `
    float t=fract(clock*(.42+.2*r.z)+r.x);
    point=vec2((r.y-.5)*(.28+t*.82)+.21*t*sin(5.*t+r.z*8.),t*(2.1+.8*r.z));
    angle=r.z*5.+t*.7;
    shape=vec2(.62,.44)*(.22+t*1.75);
    opacity=.48*smoothstep(0.,.18,t)*(1.-smoothstep(.54,1.,t));
  `,
  ember: `
    float t=fract(clock*(.78+.32*r.z)+r.x);
    point=vec2((r.y-.5)*(.55+t*.9)+.14*sin(8.*t+r.z*7.)*t,t*(1.35+.75*r.z));
    angle=t*3.+r.y*6.;
    shape=vec2(.11,.19)*(1.-t*.65);
    opacity=smoothstep(0.,.12,t)*(1.-smoothstep(.57,1.,t));
  `,
};
const paints = {
  wind:['#639c68','#c4d38e'],spray:['#4597bc','#d6f5f7'],vapor:['#a5babc','#f9f3dc'],ember:['#ed8036','#ffe189'],
};

export function airParticles(engine, kind, x, y, z, {width=1,height=1,dx=0,dy=1,count=18}={}) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index=engine.planeGeometry.index;
  geometry.setAttribute('position',engine.planeGeometry.attributes.position);
  geometry.setAttribute('uv',engine.planeGeometry.attributes.uv);
  const seeds=new Float32Array(count*3);
  for(let i=0;i<count;i++) seeds.set([(i+.5)/count,(.19+i*.618034)%1,(.07+i*.754878)%1],i*3);
  geometry.setAttribute('randoms',new THREE.InstancedBufferAttribute(seeds,3));
  geometry.instanceCount=count;
  engine.resources.push(geometry);
  const [dark,light]=paints[kind];
  const material=engine.material(new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{clock:{value:0},extent:{value:new THREE.Vector2(width,height)},flow:{value:new THREE.Vector2(dx,dy)},
      darkInk:{value:new THREE.Color(dark)},lightInk:{value:new THREE.Color(light)}},
    vertexShader:`
      attribute vec3 randoms;
      uniform float clock;
      uniform vec2 extent,flow;
      varying vec2 local;
      varying float strength;
      void main(){
        vec3 r=randoms; vec2 point,shape,side=normalize(vec2(-flow.y,flow.x));
        float angle,opacity;
        ${motion[kind]}
        vec2 quad=position.xy*shape;
        quad=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*quad;
        local=uv*2.-1.;strength=opacity;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(point+quad,0.,1.);
      }`,
    fragmentShader:`
      uniform vec3 darkInk,lightInk;
      varying vec2 local;
      varying float strength;
      void main(){
        float edge=length(local);
        float alpha=1.-smoothstep(${kind==='vapor'?'0.15':'0.75'},1.,edge);
        float light=1.-smoothstep(.04,.32,abs(local.y+.18+sin(local.x*3.)*.1));
        gl_FragColor=vec4(mix(darkInk,lightInk,light+.15*(1.-edge)),strength*alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);mesh.visible=false;mesh.name='particles-'+kind;
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),Math.hypot(width,height)/2+4);
  engine.scene.add(mesh);
  return mesh;
}
