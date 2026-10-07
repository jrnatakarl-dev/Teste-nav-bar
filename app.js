const $ = id => document.getElementById(id);
const state = { formula:'x^2 + y^2', range:5, resolution:65, x:1, y:1, plane:false, gradient:false, point:true, mapNavigation:true };
const defaultCamera = { position:new THREE.Vector3(9,8,9), target:new THREE.Vector3(0,0,0) };
const presets = { paraboloid:'x^2 + y^2', saddle:'x^2 - y^2', sinusoid:'sin(x)*cos(y)', gaussian:'exp(-(x^2+y^2))', monkey:'sin(x*y)/(1+x^2+y^2)' };
let scene,camera,renderer,controls,surface,grid,pointMesh,planeMesh,arrows=[];
let fn, dfx, dfy, dxx, dxy, dyy;

function format(n){ if(!Number.isFinite(n)) return '—'; return Math.abs(n)<1e-9?'0':n.toFixed(4); }
function compileFunction(){
  try{
    const node=math.parse(state.formula);
    fn=x=>Number(node.evaluate({x,y:x===undefined?0:arguments}));
  }catch(e){ throw e; }
}
function buildExpressions(){
  const node=math.parse(state.formula);
  fn=(x,y)=>Number(node.evaluate({x,y}));
  const fx=math.derivative(node,'x'); const fy=math.derivative(node,'y');
  dfx=(x,y)=>Number(fx.evaluate({x,y})); dfy=(x,y)=>Number(fy.evaluate({x,y}));
  try{dxx=math.derivative(fx,'x');dxy=math.derivative(fx,'y');dyy=math.derivative(fy,'y');}catch{dxx=dxy=dyy=null;}
  $('symbolicFx').textContent='∂f/∂x = '+fx.toString(); $('symbolicFy').textContent='∂f/∂y = '+fy.toString();
  $('symbolicFxx').textContent='fₓₓ = '+(dxx?dxx.toString():'—'); $('symbolicFxy').textContent='fₓᵧ = '+(dxy?dxy.toString():'—'); $('symbolicFyy').textContent='fᵧᵧ = '+(dyy?dyy.toString():'—');
}
function init3D(){
  const el=$('viewport'); scene=new THREE.Scene(); scene.background=new THREE.Color(0x05080c);
  camera=new THREE.PerspectiveCamera(45,el.clientWidth/el.clientHeight,.1,1000); camera.position.set(9,8,9);
  renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(el.clientWidth,el.clientHeight); el.appendChild(renderer.domElement);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  controls.dampingFactor=0.085;
  controls.enablePan=true;
  controls.screenSpacePanning=true;
  controls.panSpeed=1.35;
  controls.zoomSpeed=1.05;
  controls.rotateSpeed=0.55;
  // No celular, a prioridade é navegação tipo mapa: um dedo move o
  // plano e dois dedos fazem zoom + deslocamento. A rotação fica
  // reservada ao mouse/botão direito no desktop.
  controls.enableRotate = true;
  controls.minDistance=2.2;
  controls.maxDistance=80;
  controls.target.copy(defaultCamera.target);
  // Navegação híbrida inspirada em mapas: arraste esquerdo move o mapa;
  // botão direito gira a câmera; roda/pinça controla o zoom.
  controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
  controls.touches.ONE=THREE.TOUCH.PAN;
  controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  renderer.domElement.addEventListener('dblclick',()=>zoomBy(1/1.35));
  renderer.domElement.style.touchAction='none';
  scene.add(new THREE.HemisphereLight(0xbfd7ff,0x14202a,1.8)); const dl=new THREE.DirectionalLight(0xffffff,2); dl.position.set(5,8,6); scene.add(dl);
  grid=new THREE.GridHelper(200,200,0x2d3947,0x18212c); grid.position.y=-0.01; scene.add(grid);
  window.addEventListener('resize',resize); animate();
}
function resize(){const el=$('viewport');camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight)}
function zoomBy(factor){
  const offset=camera.position.clone().sub(controls.target);
  const next=offset.multiplyScalar(factor);
  const dist=Math.max(controls.minDistance,Math.min(controls.maxDistance,next.length()));
  next.setLength(dist);
  camera.position.copy(controls.target).add(next);
  controls.update();
}
function resetView(){
  camera.position.copy(defaultCamera.position);
  controls.target.copy(defaultCamera.target);
  camera.lookAt(controls.target);
  controls.update();
}
function colorFor(t){const c=new THREE.Color(); const h=(0.66*(1-t)); c.setHSL(h,0.78,0.54); return c;}
function rebuildSurface(){
  $('loading').classList.add('show');
  requestAnimationFrame(()=>{
    if(surface){scene.remove(surface);surface.geometry.dispose();surface.material.dispose();}
    const n=state.resolution,r=state.range; const pos=[],colors=[],idx=[]; let min=Infinity,max=-Infinity; const vals=[];
    for(let j=0;j<n;j++){const y=-r+2*r*j/(n-1);for(let i=0;i<n;i++){const x=-r+2*r*i/(n-1);let z;try{z=fn(x,y)}catch{z=NaN} if(!Number.isFinite(z))z=0; vals.push(z);min=Math.min(min,z);max=Math.max(max,z);}}
    const scale=Math.max(1,(max-min));
    for(let j=0;j<n;j++){for(let i=0;i<n;i++){const x=-r+2*r*i/(n-1),y=-r+2*r*j/(n-1),z=vals[j*n+i];pos.push(x,z,y);const c=colorFor((z-min)/scale);colors.push(c.r,c.g,c.b);}}
    for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;idx.push(a,c,b,b,c,d)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
    surface=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.72,metalness:.05}));scene.add(surface); updateOverlays(); drawContours(); $('loading').classList.remove('show');
  });
}
function clearObj(o){if(o){scene.remove(o);o.traverse?.(x=>{x.geometry?.dispose();x.material?.dispose()})}}
function updateOverlays(){
  clearObj(pointMesh); clearObj(planeMesh); arrows.forEach(a=>clearObj(a)); arrows=[];
  const x=state.x,y=state.y,z=fn(x,y); $('metricF').textContent=format(z); const gx=dfx(x,y),gy=dfy(x,y); const norm=Math.hypot(gx,gy);
  $('metricFx').textContent=format(gx);$('metricFy').textContent=format(gy);$('metricGrad').textContent=format(norm);$('pointText').textContent=`(${x.toFixed(2)}, ${y.toFixed(2)})`;$('gradientText').textContent=`(${format(gx)}, ${format(gy)})`;
  $('planeText').textContent=`z = ${format(z)} + ${format(gx)}(x−${x.toFixed(2)}) + ${format(gy)}(y−${y.toFixed(2)})`;
  let classification='ponto regular'; const H=(dxx&&dxy&&dyy)?Number(dxx.evaluate({x,y}))*Number(dyy.evaluate({x,y}))-Number(dxy.evaluate({x,y}))**2:null;
  if(norm<.03 && H!==null) classification=H<0?'ponto de sela':H>0?(Number(dxx.evaluate({x,y}))>0?'mínimo local':'máximo local'):'inconclusivo'; $('criticalText').textContent=classification;
  if(state.point){const g=new THREE.SphereGeometry(.11,20,20);pointMesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff}));pointMesh.position.set(x,z+.1,y);scene.add(pointMesh)}
  if(state.plane) addPlane(x,y,z,gx,gy); if(state.gradient) addGradient(x,y,z,gx,gy);
}
function addPlane(x,y,z,gx,gy){const s=Math.min(3,state.range*.55),verts=[];for(const yy of [-s,s])for(const xx of [-s,s])verts.push(xx, z+gx*(xx)+gy*(yy), yy);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex([0,1,2,2,1,3]);planeMesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.23,side:THREE.DoubleSide}));planeMesh.position.set(x,0,y);scene.add(planeMesh)}
function addGradient(x,y,z,gx,gy){const L=Math.min(2.2,Math.hypot(gx,gy)*.7+.4);const dir=new THREE.Vector3(gx,0,gy).normalize();const origin=new THREE.Vector3(x,z+.18,y);const arrow=new THREE.ArrowHelper(dir,origin,L,0xffffff,.16,.09);scene.add(arrow);arrows.push(arrow)}
function drawContours(){const canvas=$('contourCanvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080c12';ctx.fillRect(0,0,w,h);const r=state.range,N=90;let vals=[],min=Infinity,max=-Infinity;for(let j=0;j<N;j++){const y=-r+2*r*j/(N-1);for(let i=0;i<N;i++){const x=-r+2*r*i/(N-1),z=fn(x,y);vals.push(Number.isFinite(z)?z:0);min=Math.min(min,z);max=Math.max(max,z)}}const levels=14;ctx.lineWidth=1;for(let l=1;l<levels;l++){const level=min+(max-min)*l/levels;ctx.strokeStyle=`hsl(${240-200*l/levels},70%,65%)`;ctx.beginPath();for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){const a=vals[j*N+i],b=vals[j*N+i+1],c=vals[(j+1)*N+i],d=vals[(j+1)*N+i+1];const x=-r+2*r*i/(N-1),y=-r+2*r*j/(N-1),dx=2*r/(N-1),dy=dx;const pts=[];function edge(v1,v2,p1,p2){if((v1<level&&v2>=level)||(v2<level&&v1>=level)){const t=(level-v1)/(v2-v1);pts.push([p1[0]+t*(p2[0]-p1[0]),p1[1]+t*(p2[1]-p1[1])])}}edge(a,b,[x,y],[x+dx,y]);edge(b,d,[x+dx,y],[x+dx,y+dy]);edge(c,d,[x,y+dy],[x+dx,y+dy]);edge(a,c,[x,y],[x,y+dy]);if(pts.length===2){const px=p=>[(p[0]+r)/(2*r)*w,h-(p[1]+r)/(2*r)*h];const p1=px(pts[0]),p2=px(pts[1]);ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1])}}ctx.stroke()}ctx.fillStyle='#8f9aaa';ctx.font='12px system-ui';ctx.fillText(`f(x,y) = ${state.formula}`,16,24)}
function apply(){try{state.formula=$('formula').value.trim();buildExpressions();rebuildSurface();$('error').classList.add('hidden')}catch(e){$('error').textContent='Expressão inválida. Use, por exemplo, x^2+y^2 ou sin(x)*cos(y).';$('error').classList.remove('hidden')}}
function updatePoint(){state.x=Number($('xPoint').value);state.y=Number($('yPoint').value);$('xVal').textContent=state.x.toFixed(2);$('yVal').textContent=state.y.toFixed(2);updateOverlays()}
function integrate(){const xmin=+$('xmin').value,xmax=+$('xmax').value,ymin=+$('ymin').value,ymax=+$('ymax').value;const n=100;let sum=0;const dx=(xmax-xmin)/n,dy=(ymax-ymin)/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=xmin+(i+.5)*dx,y=ymin+(j+.5)*dy;const z=fn(x,y);if(Number.isFinite(z))sum+=z} $('integralValue').textContent=format(sum*dx*dy)}
function animate(){requestAnimationFrame(animate);controls.update();if(grid){grid.position.x=controls.target.x;grid.position.z=controls.target.z;}renderer.render(scene,camera)}
function bind(){
  $('applyBtn').onclick=apply;$('preset').onchange=e=>{$('formula').value=presets[e.target.value];apply()};document.querySelectorAll('[data-formula]').forEach(b=>b.onclick=()=>{$('formula').value=b.dataset.formula;apply()});
  $('range').oninput=e=>{state.range=+e.target.value;$('rangeVal').textContent=`[-${state.range}, ${state.range}]`;['xPoint','yPoint'].forEach(id=>$(id).max=state.range);rebuildSurface()};
  $('resolution').oninput=e=>{state.resolution=+e.target.value;$('resVal').textContent=`${state.resolution}×${state.resolution}`;rebuildSurface()};$('xPoint').oninput=updatePoint;$('yPoint').oninput=updatePoint;
  $('gridToggle').onchange=e=>grid.visible=e.target.checked;$('planeToggle').onchange=e=>{state.plane=e.target.checked;updateOverlays()};$('gradientToggle').onchange=e=>{state.gradient=e.target.checked;updateOverlays()};$('pointToggle').onchange=e=>{state.point=e.target.checked;updateOverlays()};
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.tab-content').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active');if(b.dataset.tab==='contours')drawContours()});
  $('integrateBtn').onclick=integrate;
  $('themeBtn').onclick=()=>document.body.classList.toggle('light');
  $('resetBtn').onclick=()=>location.reload();
  $('zoomInBtn').onclick=()=>zoomBy(.72);
  $('zoomOutBtn').onclick=()=>zoomBy(1.38);
  $('zoomResetBtn').onclick=resetView;$('demoBtn').onclick=async()=>{state.formula='x^2-y^2';$('formula').value=state.formula;apply();$('planeToggle').checked=true;state.plane=true;$('gradientToggle').checked=true;state.gradient=true;state.x=1;state.y=1;$('xPoint').value=1;$('yPoint').value=1;updatePoint();updateOverlays()};
}
init3D();bind();buildExpressions();rebuildSurface();
