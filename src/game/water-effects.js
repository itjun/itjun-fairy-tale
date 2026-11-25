import * as THREE from 'three';

const fragmentEnd = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// u 是水离开这一段起点的时间。高光沿着同一批水往下走，越接近落点速度越快。
const ribbonVertex = `
  uniform vec2 velocity;
  uniform float gravity, duration, radius, clock, front;
  varying vec2 along;
  void main() {
    float t = uv.x * min(duration, front);
    vec2 speed = velocity - vec2(0., gravity*t);
    vec2 normal = normalize(vec2(-speed.y, speed.x));
    float side = (uv.y * 2. - 1.)*1.55;
    float wave = sin((t-clock)*18.)*.08 + sin((t-clock)*33.+1.4)*.047;
    float width = radius * sqrt(length(velocity)/max(.1,length(speed)));
    vec2 point = velocity*t - vec2(0., .5*gravity*t*t);
    point += normal * width * (side+wave*(.3+min(t*2.,1.)));
    along = vec2(t-clock, side);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point,0.,1.);
  }`;
const ribbonFragment = `
  uniform float gravity;
  varying vec2 along;
  void main() {
    float t=along.x, v=along.y;
    float pulse = sin(t*19.+v*2.4)*.07+sin(t*37.-v)*.035;
    float width = .93+pulse;
    float aa = max(fwidth(v),.025);
    float body = 1.-smoothstep(width-aa,width,abs(v));
    float rim = smoothstep(.48,width,abs(v));
    float bend = .19*sin(11.*t)+.09*sin(25.*t+.5);
    float strand = 1.-smoothstep(.035,.16,abs(v-.34-bend));
    float glint = strand * (.22+.78*smoothstep(-.65,.8,sin(17.*t+v)));
    float flicker = .5+.5*sin(30.*t+.8*sin(15.*t));
    float feather = (1.-smoothstep(.025,.11,abs(v+.44+.13*sin(23.*t))))*flicker;
    vec3 color=mix(vec3(.12,.61,.75),vec3(.023,.28,.51),rim);
    color=mix(color,vec3(.81,.98,1.),glint+feather*.77);
    float alpha=body*(.46+.24*rim+.32*glint+.13*flicker);
    if(gravity>0.) {
      float beads=sin(31.*t+v*3.)*.5+.5;
      float spray=(1.-smoothstep(.035,.14,abs(abs(v)-1.19-.13*sin(33.*t))))*smoothstep(.68,.97,beads);
      color=mix(color,vec3(.52,.86,.93),spray);
      alpha=max(alpha,spray*.85);
    }
    gl_FragColor=vec4(color,alpha);
    ${fragmentEnd}
  }`;

const splashVertex = `
  varying vec2 spot;
  void main() {
    spot = (uv-.5)*vec2(3.4,2.1) + vec2(0.,.78);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }`;
// 同一落点的水珠有不同的初速度，环纹由内向外消散。初次碰撞前不生成旧水花。
const splashFragment = `
  uniform float clock, pool;
  varying vec2 spot;
  void main() {
    float foam=0., ring=0., outline=0.;
    for(int i=0;i<12;i++){
      float n=float(i);
      float lifetime=.32+.34*fract(n*.618+.32);
      float age=mod(clock-n*.043,lifetime+.17);
      float side=mod(n,2.)*2.-1.;
      vec2 vel=vec2(side*(.95+1.68*fract(n*.73+.4))+.25,lifetime*7.6);
      vec2 pos=vel*age-vec2(0.,7.6*age*age);
      vec2 delta=spot-pos;
      vec2 axis=normalize(vel-vec2(0.,15.2*age));
      float d=length(vec2(dot(delta,axis)*.68,dot(delta,vec2(-axis.y,axis.x))));
      float radius=.024+.032*fract(n*.378+.6);
      if(clock>=n*.043 && age<lifetime) {
        foam=max(foam,1.-smoothstep(radius*.55,radius+fwidth(d),d));
        outline=max(outline,1.-smoothstep(radius,radius+.015+fwidth(d),d));
      }
    }
    for(int i=0;i<2;i++){
      float born=float(i)*.45;
      float t=fract((clock-born)/.91);
      float d=length(spot*vec2(1.,mix(6.,4.3,pool)));
      float r=.09+t*mix(.83,1.58,pool);
      if(clock>=born) ring=max(ring,(1.-smoothstep(.016,.016+fwidth(d),abs(d-r)))*(1.-t));
    }
    float plume=1.-smoothstep(.04,.23,length(spot*vec2(.88,2.)));
    float alpha=max(outline,max(ring*.88,plume*.85));
    gl_FragColor=vec4(mix(vec3(.035,.37,.55),vec3(.85,.98,1.),max(foam,ring)),alpha);
    ${fragmentEnd}
  }`;

function mesh(g, geometry, vertexShader, fragmentShader, uniforms) {
  const material = g.material(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    vertexShader, fragmentShader, uniforms,
  }));
  const obj = new THREE.Mesh(geometry, material);
  obj.visible = false;
  g.scene.add(obj);
  return obj;
}

// 池面保留原画的蜡笔颗粒，按世界距离铺开。水纹在落点附近由水花继续向外推。
export function channelPool(g, left, right, surface, depth) {
  const geometry = new THREE.PlaneGeometry(right-left,depth);
  g.resources.push(geometry);
  const uniforms = {paper:{value:g.textureFor('water-pond')}, clock:{value:0},
    size:{value:new THREE.Vector2(right-left,depth)}};
  const vertex = `
    varying vec2 poolUv;
    void main(){
      poolUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`;
  const fragment = `
    varying vec2 poolUv;
    uniform sampler2D paper;
    uniform float clock;
    uniform vec2 size;
    void main(){
      float x=poolUv.x*size.x;
      float shore=clamp(min(x,size.x-x)/min(1.6,size.x*.12),0.,1.);
      float top=(.045+.028*sin(3.*x-clock*2.3)+.013*sin(7.7*x+clock))/size.y;
      float under=(1.-poolUv.y-top)*size.y;
      float depth=size.y*sqrt(shore);
      float aa=max(fwidth(under),.007);
      float edge=smoothstep(-aa,aa,under)*(1.-smoothstep(depth-aa,depth,under));
      float u=.18+.64*abs(fract((x+.07*sin(under*3.+clock))/8.)*2.-1.);
      float v=.15+.65*poolUv.y+.012*sin(x*2.6-clock*1.3);
      vec3 wax=texture2D(paper,vec2(u,v)).rgb;
      float pencil=dot(wax,vec3(.21,.72,.07));
      float light=exp(-max(under,0.)*2.);
      vec3 color=mix(vec3(.045,.34,.54),vec3(.22,.69,.77),light);
      color+=.16*pencil;
      float wave=sin(under*26.+1.3*sin(x*1.6-clock*2.)+.6*sin(x*3.1+clock));
      color+=.11*smoothstep(.77,1.,wave)*(.35+.65*light);
      color=mix(color,vec3(.69,.94,.96),1.-smoothstep(0.,.045,under));
      gl_FragColor=vec4(color,edge*(.74+.12*pencil));
      ${fragmentEnd}
    }`;
  const pool = mesh(g,geometry,vertex,fragment,uniforms);
  pool.material.name='water-pond';
  pool.position.set((left+right)/2,surface-depth/2,-.32);
  return pool;
}

function impactView(g) {
  const uniforms = {clock:{value:0}, pool:{value:0}};
  const splash = mesh(g, g.planeGeometry, splashVertex, splashFragment, uniforms);
  splash.name = 'water-impact';
  splash.scale.set(3.4,2.1,1);
  return splash;
}

// 花谷的引水槽已有沿途的弯道和花根落点。沿槽取样，按落差算速度，保持原来的浇水方向。
export function guidedWater(g, points, radius, isRain) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)));
  const samples = curve.getSpacedPoints(48);
  const geometry = new THREE.PlaneGeometry(1,1,samples.length-1);
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  let travel = 0;
  for (let i=0; i<samples.length; i++) {
    const p = samples[i], speed = Math.sqrt(16+32*Math.max(0,samples[0].y-p.y));
    if (i) travel += p.distanceTo(samples[i-1])/speed;
    const tangent = curve.getTangentAt(i/(samples.length-1));
    const width = radius*Math.sqrt(4/speed)*1.55;
    for (const [row, side] of [[0,1],[samples.length,-1]]) {
      positions.setXYZ(i+row,p.x-side*tangent.y*width,p.y+side*tangent.x*width,0);
      uv.setXY(i+row,travel,side*1.55);
    }
  }
  const uniforms = {clock:{value:0}, gravity:{value:16}};
  const vertex = `
    uniform float clock;
    varying vec2 along;
    void main() {
      along=vec2(uv.x-clock,uv.y);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`;
  const rain = `
    varying vec2 along;
    void main(){
      float cell=fract(along.x*9.2);
      float lane=sin(floor(along.x*9.2)*12.39)*.68;
      float d=length(vec2((cell-.48)*4.8,(along.y-lane)*2.9));
      float alpha=1.-smoothstep(.69,1.,d);
      gl_FragColor=vec4(mix(vec3(.05,.42,.64),vec3(.73,.95,1.),1.-smoothstep(.1,1.,d)),alpha*.83);
      ${fragmentEnd}
    }`;
  g.resources.push(geometry);
  const ribbon = mesh(g,geometry,vertex,isRain ? rain : ribbonFragment,uniforms);
  ribbon.position.z = .40;
  const splash = impactView(g), end = samples.at(-1);
  splash.position.set(end.x,end.y+.78,.42);
  if (isRain) {
    splash.scale.multiplyScalar(.45);
    splash.position.y=end.y+.78*.45;
  }
  return (here,start) => {
    ribbon.visible = here && start != null;
    splash.visible = false;
    if (!ribbon.visible) return;
    const age = g.isReducedMotion ? travel+1 : Math.max(0,g.elapsed-start);
    uniforms.clock.value = age;
    const index = age>=travel ? -1 : samples.findIndex((_,i)=>uv.getX(i)>age);
    geometry.setDrawRange(0,6*(index<0 ? samples.length-1 : Math.max(0,index-1)));
    splash.visible = age>=travel;
    splash.material.uniforms.clock.value = Math.max(0,age-travel);
  };
}

export function waterEffects(g) {
  const strip = new THREE.PlaneGeometry(1, 1, 36, 1);
  g.resources.push(strip);
  return function createPart() {
    const u = { velocity: {value: new THREE.Vector2()}, gravity:{value:0}, duration:{value:0},
      radius:{value:0}, front:{value:0}, clock:{value:0} };
    const ribbon = mesh(g, strip, ribbonVertex, ribbonFragment, u);
    ribbon.name = 'water-stream';
    // 顶点着色器把单位平面弯成水柱，原平面的包围球不适用于长瀑布。
    ribbon.frustumCulled = false;
    const splash = impactView(g);
    const impact = splash.material.uniforms;
    return { ribbon, splash, update(part, age, isPool, strength) {
      const t = age - part.start;
      ribbon.visible = t > 0;
      splash.visible = !part.isSheet && t > part.duration;
      if (!ribbon.visible) return;
      ribbon.position.set(part.x, part.y, .40);
      u.velocity.value.set(part.vx, part.vy);
      u.gravity.value = part.gravity;
      u.duration.value = part.duration;
      u.radius.value = (part.isSheet ? .052 : .147)*strength;
      u.front.value = t;
      u.clock.value = age - part.start;
      if (!splash.visible) return;
      const end = part.duration;
      splash.position.set(part.x + part.vx*end, part.y + part.vy*end - part.gravity*end*end/2 + .78, .42);
      impact.clock.value = Math.max(0, age - part.start - end);
      impact.pool.value = isPool ? 1 : 0;
    }};
  };
}
