import * as THREE from 'three';
import { currentSkill } from './skills.js';

// 仅使用已有彩笔素材组合动效；所有几何和材质复用，不逐帧创建 GPU 资源。
export class SkillEffects {
  constructor(scene, geometry, materials, rewards, isReducedMotion) {
    this.scene = scene; this.geometry = geometry; this.materials = materials;
    this.isReducedMotion = isReducedMotion;
    this.magicViews = new Map(); this.shots = new Map(); this.bursts = []; this.halos = [];
    this.rewards = rewards.map(reward => {
      const group = this.group();
      this.add(group, 'bubble', 2.5, 2.5);
      this.add(group, reward.kind === 'stars' ? 'stars' : 'bubble', 1.35, 1.35);
      for (let i = 0; i < 3; i++) this.add(group, 'stars', 0.4, 0.4);
      group.position.set(reward.x, reward.y, 1);
      return { reward, group };
    });
  }
  group() { const group = new THREE.Group(); this.scene.add(group); return group; }
  add(group, kind, width, height) {
    const mesh = new THREE.Mesh(this.geometry, this.materials[kind]);
    mesh.scale.set(width, height, 1); group.add(mesh); return mesh;
  }
  burst(x, y, at, isReward = false, isCompact = false) {
    if (this.bursts.length >= 24) this.scene.remove(this.bursts.shift().group);
    const group = this.group(); group.position.set(x, y, 1.4);
    this.add(group, 'bubble', 1, 1);
    for (let i = 0; i < (this.isReducedMotion || isCompact ? 4 : 10); i++) this.add(group, 'stars', 0.6, 0.6);
    this.bursts.push({ group, at, isReward, isCompact });
  }
  updateMagic(effects) {
    for(const [id,group] of this.magicViews)if(!effects.some(e=>e.id===id)){this.scene.remove(group);this.magicViews.delete(id);}
    for(const effect of effects){
      let group=this.magicViews.get(effect.id);
      if(!group){group=this.group();this.magicViews.set(effect.id,group);for(let i=0;i<8;i++)this.add(group,effect.id,effect.id==='thunder'?1.6:effect.id==='rain'?.35:.7,effect.id==='thunder'?.3:.7);if(effect.id==='rain')this.add(group,'cloud',6,1.5).position.set(0,6.5,0);}
      group.position.set(effect.x,effect.y,.75);
      group.children.forEach((mesh,i)=>{
        if(i>=8)return;
        const age=this.isReducedMotion?0:effect.age;
        if(effect.id==='fire'){const angle=i*Math.PI/4+age;mesh.position.set(Math.cos(angle)*3.2,Math.sin(angle)*2.3,0);}
        if(effect.id==='snow')mesh.position.set((age%1.5)/1.5*28-14,(i-3.5)*1.1,0);
        if(effect.id==='rain')mesh.position.set((i-3.5)*2.8,6-(age*5+i)%8,0);
        if(effect.id==='thunder')mesh.position.set((i-3.5)*.55,Math.sin(i*2+age*15)*.35,0);
      });
    }
  }
  update(waves, state, players, elapsed, cameraX, halfWidth, playerKinds) {
    const kind = currentSkill(state, elapsed);
    for (const { reward, group } of this.rewards) {
      group.visible = !state.collectedIds.includes(reward.id) && Math.abs(reward.x - cameraX) < halfWidth + 3;
      if (!group.visible) continue;
      group.position.y = reward.y + (this.isReducedMotion ? 0 : Math.sin(elapsed * 2.5 + reward.id) * 0.2);
      group.children.slice(2).forEach((mesh, i) => {
        const angle = i * Math.PI * 2 / 3 + (this.isReducedMotion ? 0 : elapsed);
        mesh.position.set(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, 0.1);
      });
    }
    // 高叠加只简化绘制，全部弹道仍由战斗层结算；按武器均分可见预算。
    const byKind = new Map();
    for (const wave of waves) if (wave.isActive && (wave.kind !== 'pulse' || wave.source==='flame' && wave.delay>.8) && Math.abs(wave.x-cameraX)<=halfWidth+5) {
      if (!byKind.has(wave.kind)) byKind.set(wave.kind,[]);
      byKind.get(wave.kind).push(wave);
    }
    const visible = new Set(), budget = Math.max(1,Math.floor(120 / (byKind.size || 1)));
    for (const shots of byKind.values()) {
      const stride = Math.max(1,Math.ceil(shots.length/budget));
      for (let i=0;i<shots.length;i+=stride) visible.add(shots[i]);
    }
    for (const [wave, group] of this.shots) if (!visible.has(wave)) { this.scene.remove(group); this.shots.delete(wave); }
    for (const wave of visible) {
      let group = this.shots.get(wave);
      if (!group) {
        group = this.group(); this.shots.set(wave, group);
        if (wave.kind === 'pulse' && wave.source==='flame') {
          this.add(group,'dragon',2.8,2.3);
          this.add(group,'flame',3.2,1.2).position.x=2;
        } else if (wave.kind === 'blade') {
          this.add(group, 'blade', 3.8, 1.5);
          this.add(group, 'blade', 2.6, 0.95).position.x = -1.6;
          this.add(group, 'blade', 1.5, 0.55).position.x = -2.9;
        } else if(wave.kind==='flame'){
          this.add(group,'flame',3.5,1.25);
        } else if (wave.kind==='moonblade') {
          this.add(group,'moonblade',1.6,1.6);
          for(let i=0;i<2;i++)this.add(group,'stars',.24-i*.07,.24-i*.07).position.set(-.65-i*.4,0,0);
        } else {
          this.add(group, wave.kind, wave.kind === 'bubble' ? 2.1 : 1.1, wave.kind === 'bubble' ? 2.1 : 1.1);
          for (let i = 0; i < 3; i++) {
            const mesh = this.add(group, 'stars', 0.45 - i * 0.1, 0.45 - i * 0.1);
            mesh.position.set(-0.8 - i * 0.55, -wave.slope * (0.8 + i * 0.55), 0);
          }
        }
      }
      group.position.set(wave.x, wave.y, 1.1); group.scale.x = wave.direction;
      if (wave.kind === 'stars' && !this.isReducedMotion) group.children[0].rotation.z = elapsed * 6;
      if (wave.kind === 'moonblade') {
        group.scale.x=1;group.rotation.z=Math.atan2(wave.headingY,wave.headingX);
        if(!this.isReducedMotion)group.children[0].rotation.z=-wave.age*10;
      }
    }
    players.forEach((player, i) => {
      if (!this.halos[i]) {
        const group = this.group(); this.add(group, 'bubble', 3, 3);
        this.add(group, 'stars', 0.6, 0.6).position.set(1.2, 1, 0);
        this.halos[i] = group;
      }
      const playerKind = playerKinds?.[i] || kind;
      const halo = this.halos[i]; halo.visible = playerKind !== 'blade';
      halo.position.set(player.x, player.y + 1.1, 0.4);
      halo.rotation.z = this.isReducedMotion ? 0 : Math.sin(elapsed * 2) * 0.12;
      halo.children[1].visible = playerKind === 'stars';
    });
    this.bursts = this.bursts.filter(burst => {
      const age = elapsed - burst.at;
      if (age >= (burst.isCompact ? .4 : 1.1)) { this.scene.remove(burst.group); return false; }
      const radius = burst.isCompact ? .5+age*1.5 : this.isReducedMotion ? 2 : 0.7 + age * (burst.isReward ? 4.5 : 3.4);
      burst.group.children[0].scale.setScalar(radius * 2);
      burst.group.children.slice(1).forEach((mesh, i, all) => {
        const angle = i / all.length * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.1);
        mesh.scale.setScalar(Math.max(0.08, 0.65 * (1 - age / 1.1)));
        mesh.rotation.z = this.isReducedMotion ? 0 : age * 3;
      });
      return true;
    });
  }
}
