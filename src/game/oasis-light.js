import * as THREE from 'three';

// 光桥的上沿就是脚下的斜面，彩笔纹和亮点都画在同一条带子里。
function sunlightStrip(engine, length, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(length * 40);
  canvas.height = 36;
  const pen = canvas.getContext('2d'), width = canvas.width;
  const band = pen.createLinearGradient(0, 4, 0, 32);
  band.addColorStop(0, '#fff7b0');
  band.addColorStop(.35, '#ffdf69');
  band.addColorStop(1, '#edab45');
  pen.fillStyle = band;
  pen.beginPath();
  pen.moveTo(0, 4);
  pen.lineTo(width, 4);
  for (let x = width; x >= 0; x -= 4) pen.lineTo(x, 28 + 1.8 * Math.sin(x * .09));
  pen.lineTo(0, 28);
  pen.closePath();
  pen.fill();
  for (let x = 0; x < width; x += 12) {
    pen.strokeStyle = '#bb752f66';
    pen.lineWidth = 1.6;
    pen.beginPath();
    pen.moveTo(x, 26 + Math.sin(x));
    pen.lineTo(x + 9, 15 + Math.cos(x));
    pen.stroke();
  }
  pen.fillStyle = '#b77b29';
  pen.fillRect(0, 2, width, 2);
  pen.fillStyle = '#fff9c2';
  pen.fillRect(0, 4, width, 3);
  for (let x = 22; x < width; x += 64) {
    pen.beginPath();
    pen.moveTo(x, 8); pen.lineTo(x + 3, 13); pen.lineTo(x + 9, 15);
    pen.lineTo(x + 3, 17); pen.lineTo(x, 22); pen.lineTo(x - 3, 17);
    pen.lineTo(x - 9, 15); pen.lineTo(x - 3, 13); pen.closePath(); pen.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  engine.textures.push(tex);
  const mat = engine.material(new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false}));
  const mesh = new THREE.Mesh(engine.planeGeometry, mat);
  mesh.scale.set(length, height, 1);
  mesh.position.y = -height * (1 / 2 - 2 / canvas.height);
  return mesh;
}

export function addSunlightDeck(engine, group, platform) {
  const length = Math.hypot(platform.width, platform.width * platform.slope);
  group.add(sunlightStrip(engine, length, .9));

  // 平台上这一截也亮起来，从镜子脚下一直接到斜坡。
  const high = engine.platforms[platform.lightTopId];
  const towardTop = Math.sign(platform.slope);
  const lip = new THREE.Group();
  lip.position.x = towardTop * length / 2;
  lip.rotation.z = -Math.atan(platform.slope);
  const strip = sunlightStrip(engine, high.width / 2, .28);
  strip.position.x = towardTop * high.width / 4;
  lip.add(strip);
  group.add(lip);
}
