import * as THREE from 'three';
import { SkillEffects, SKILL_ART } from './skill-effects.js';

export class PracticeView {
  constructor(canvas, person) {
    this.renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
    this.renderer.setClearColor(0,0);
    this.renderer.setSize(1060,530,false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0,28,12,-2,.1,50);
    this.camera.position.z = 12;
    this.geometry = new THREE.PlaneGeometry();
    this.materials = new Map();
    this.person = person;
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  async load() {
    const loader = new THREE.TextureLoader();
    const names = new Set([this.person.image,this.person.attack,'enemy-leaf','collectible-rainbow','flower',...Object.values(SKILL_ART)]);
    await Promise.all([...names].map(async name=>{
      const texture=await loader.loadAsync('./assets/'+name+'.png');
      if (this.isDisposed) {texture.dispose(); return;}
      texture.colorSpace=THREE.SRGBColorSpace;
      this.materials.set(name,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
    }));
    if (this.isDisposed) return;
    this.actor=this.picture(this.person.image);
    this.target=this.picture('enemy-leaf');
    this.talent=this.picture('collectible-rainbow');
    this.skill=new SkillEffects(this.scene,this.geometry,
      Object.fromEntries(Object.entries(SKILL_ART).map(([key,name])=>[key,this.materials.get(name)])),this.motion.matches);
  }
  picture(name) {
    const mesh=new THREE.Mesh(this.geometry,this.materials.get(name));
    this.scene.add(mesh);
    return mesh;
  }
  draw(player, enemy, waves, elapsed, effect, weapon, isMelee) {
    const width=isMelee?10:28, height=width/2, left=isMelee?player.x-8.5/2.8:0;
    Object.assign(this.camera,{left,right:left+width,top:height*.86,bottom:-height*.14});
    this.camera.updateProjectionMatrix();
    const size=this.person.height*(isMelee?1:2.8), targetSize=isMelee?enemy.height:4;
    this.actor.material=this.materials.get(elapsed<(player.attackUntil||0)?this.person.attack:this.person.image);
    this.actor.position.set(player.x,player.y+size/2,.7);
    this.actor.scale.set(size*player.facing,size,1);
    this.target.position.set(enemy.x,enemy.y+targetSize/2,.5);
    this.target.scale.set(targetSize,targetSize,1);
    if(effect && effect!==this.lastEffect && !effect.isShield) {
      this.skill.burst(effect.x,effect.y,effect.at,false,false,effect.spark?'stars':'flower');
    }
    this.lastEffect=effect;
    this.talent.visible=!!effect?.isShield && elapsed-effect.at<1.7;
    this.talent.scale.set(5,3,1); this.talent.position.set(player.x,player.y+3.8,.9);
    this.skill.isReducedMotion=this.motion.matches;
    this.skill.update(waves,[player],elapsed,left+width/2,width/2,[weapon]);
    this.renderer.render(this.scene,this.camera);
  }
  dispose() {
    this.isDisposed=true;
    for(const material of this.materials.values()) {material.map.dispose();material.dispose();}
    this.geometry.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
