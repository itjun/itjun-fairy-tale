import * as THREE from 'three';

async function textureFor(element) {
  let image=element;
  if (element instanceof SVGElement) {
    const svg=element.cloneNode(true);
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('color',getComputedStyle(element).color);
    image=new Image();
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
  }
  if (!image.complete || !image.naturalWidth) await image.decode();
  const texture=new THREE.Texture(image);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

// 页面仍用原来的按钮处理点击、拖放和手柄。动起来的纸片在同一张正交画布上画，停稳后交还原画。
export class PaperView {
  constructor(canvas) {
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0,0);
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(0,1,1,0,.1,100);
    this.camera.position.z=10;
    this.quad=new THREE.PlaneGeometry();
    this.dot=new THREE.CircleGeometry(1,12);
    this.items=new Set();
    this.lastTime=null;
    this.draw=this.draw.bind(this);
    this.wake=this.wake.bind(this);
    document.addEventListener('visibilitychange',this.wake);
  }
  wake() {
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      this.frame=0;this.lastTime=null;
    } else if (!this.frame && this.items.size) this.frame=requestAnimationFrame(this.draw);
  }
  remove(item) {
    this.items.delete(item);
    if(item.element) item.element.removeAttribute('data-paper-painted');
    for(const obj of item.group.children) {obj.material.map?.dispose();obj.material.dispose();}
    this.scene.remove(item.group);
  }
  play(kind,anchor,element,particles,point) {
    if (!anchor && !point) return;
    for (const old of this.items) if (element && old.element===element) this.remove(old);
    const item={kind,anchor,element,particles,point,age:0,group:new THREE.Group()};
    item.src=element?.getAttribute('src');
    this.items.add(item);this.scene.add(item.group);
    if(element) textureFor(element).then(map=>{
      if (!this.items.has(item) || !element.isConnected) {map.dispose();return;}
      const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});
      if (anchor?.classList.contains('rainbow-crop')) {
        const style=getComputedStyle(anchor), pieces=Number(style.getPropertyValue('--pieces'));
        map.repeat.x=1/pieces;map.offset.x=Number(style.getPropertyValue('--piece'))/pieces;
        item.isCropped=true;
      }
      item.art=new THREE.Mesh(this.quad,material);
      item.group.add(item.art);
      this.wake();
    }).catch(()=>{ /* 原画加载期间仍可操作。 */ });
    if(particles) {
      const color={water:0x459dd2,sun:0xe9ad37,pollen:0xc59635,spark:0xe6a641,soil:0xa77642}[particles];
      for(let i=0;i<12;i++){
        const material=new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false});
        const dot=new THREE.Mesh(this.dot,material);
        item.group.add(dot);
      }
    }
    this.wake();
    return item;
  }
  draw(now) {
    this.frame=0;
    const dt=this.lastTime==null?0:Math.min(.06,(now-this.lastTime)/1000);
    this.lastTime=now;
    const box=this.canvas.getBoundingClientRect(), w=Math.round(box.width), h=Math.round(box.height);
    if (w && h) {
      if(w!==this.width || h!==this.height) {
        this.width=w;this.height=h;this.renderer.setSize(w,h,false);
        this.camera.right=w;this.camera.top=h;this.camera.updateProjectionMatrix();
      }
      for(const item of this.items) {
        item.age+=dt;
        if ((item.anchor && !item.anchor.isConnected) || (item.element && item.src!==item.element.getAttribute('src')) || (item.kind!=='dance' && item.kind!=='drag' && item.age>=.82)) {this.remove(item);continue;}
        const rect=(item.isCropped ? item.anchor : item.element || item.anchor)?.getBoundingClientRect();
        const x=item.point?item.point.x*w:rect.left-box.left+rect.width/2;
        const y=item.point?(1-item.point.y)*h:box.bottom-rect.top-rect.height/2;
        item.group.position.set(x,y,0);
        if(item.art) {
          if(item.kind==='drag') {
            const inside=x>0 && x<w && y>0 && y<h;
            item.art.visible=inside;
            item.element.toggleAttribute('data-paper-painted',inside);
          } else item.element.setAttribute('data-paper-painted','');
          this.pose(item,rect);
        }
        if(item.particles) this.scatter(item);
      }
      this.renderer.render(this.scene,this.camera);
    }
    if(this.items.size) this.wake(); else this.lastTime=null;
  }
  pose(item,rect) {
    const {art,age,kind}=item;
    const image=art.material.map.image;
    const aspect=image.naturalWidth/image.naturalHeight;
    const bounds=kind==='stamp' ? {width:item.element.clientWidth,height:item.element.clientHeight} : rect;
    const width=item.isCropped?rect.width:Math.min(bounds.width,bounds.height*aspect);
    const height=item.isCropped?rect.height:width/aspect;
    let scale=1,dy=0,angle=0;
    if(kind==='dance') {dy=5*Math.abs(Math.sin(age*2.6));angle=.031*Math.sin(age*2.6);}
    else if(kind==='grow') {scale=1-.32*Math.exp(-age*7)*Math.cos(age*10);dy=height*(scale-1)/2;}
    else if(kind==='stamp') {scale=1+.32*Math.exp(-age*8)*Math.cos(age*14);angle=.14;}
    else if(kind==='drop') {
      // 先自由落下，触到叠层后轻轻反弹一次。
      const t=Math.min(1,age/.27);
      dy=32*(1-t*t);
      if(t===1 && age<.51) {const u=(age-.27)/.24;dy=20*u*(1-u);}
    }
    art.scale.set(width*scale,height*scale,1);art.position.y=dy;art.rotation.z=angle;
  }
  scatter(item) {
    for(let i=0;i<12;i++) {
      const dot=item.group.children[i];
      const t=(item.age-i*.014)/.60, side=((i*.618+.14)%1)*2-1;
      dot.visible=t>=0 && t<=1;
      if(!dot.visible) continue;
      const radius=1.8+(i%3)*.62;
      if(item.particles==='water') {
        const u=Math.min(1,t/.66);
        dot.position.set(-20+22*u+side*14,40*(1-u*u),.3);
        if(t>.66){const v=(t-.66)/.34;dot.position.x+=side*18*v;dot.position.y=26*v*(1-v);}
        dot.scale.set(radius*.68,radius*(1.55-t),1);
      } else {
        const angle=i*2.4, drift=item.particles==='pollen'?Math.sin(i+t*7)*5:0;
        dot.position.set(Math.cos(angle)*(5+34*t)+drift,Math.sin(angle)*(6+21*t)+t*(24-37*t),.3);
        dot.scale.setScalar(radius*(1-t*.45));
      }
      dot.material.opacity=.85*(1-t*t);
    }
  }
  clear() {
    for(const item of this.items) this.remove(item);
    this.renderer.clear();
  }
  stopKind(kind) {
    for (const item of this.items) if (item.kind===kind) this.remove(item);
    if (!this.items.size) this.renderer.clear();
  }
  stopTransient() {
    for (const item of this.items) if (item.kind!=='dance' && item.kind!=='drag') this.remove(item);
    if (!this.items.size) this.renderer.clear();
  }
  dispose() {
    document.removeEventListener('visibilitychange',this.wake);
    cancelAnimationFrame(this.frame);this.clear();
    this.dot.dispose();this.quad.dispose();this.renderer.dispose();
    if (!this.canvas.isConnected) this.renderer.forceContextLoss();
  }
}
