import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {resolvePageContact} from './elastic-contact.mjs';


const timeline=__TIMELINE__;
export function mountNexoElastic(host,options={}) {
if(!(host instanceof HTMLElement))throw new TypeError('A host HTMLElement is required');
const {onStatus=()=>{},onProgress=()=>{},maxPixelRatio=2,autoPlay=true,introDuration=2,viewRollDegrees=0}=options;
const duration=Number.isFinite(introDuration)?Math.max(.5,introDuration):2;
const viewRoll=Number.isFinite(viewRollDegrees)?viewRollDegrees:0;
let resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});

const media=matchMedia('(prefers-reduced-motion: reduce)');
const state={loaded:false,mode:'loading',dragging:null,selected:0,reduced:media.matches,elapsed:0,frames:0,contactCount:0,lastContact:null};
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
host.append(renderer.domElement);
const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','可拖拽的 NexoFolio Logo，按 1、2 选择左右片，方向键拉动，空格松手');
canvas.style.touchAction='none';
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,4.5,-4.5,.1,80);
camera.position.set(1.4,1.05,16);camera.lookAt(0,0,0);camera.rotateZ(THREE.MathUtils.degToRad(viewRoll));camera.zoom=1;
const matcap=new THREE.TextureLoader().load('data:image/png;base64,'+__MATCAP__,()=>wake());matcap.colorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight('#ffffff','#9caaa2',2));
const key=new THREE.DirectionalLight('#fff9ef',3.2);key.position.set(-3,7,8);scene.add(key);
const rim=new THREE.DirectionalLight('#e1ecff',2.4);rim.position.set(5,3,-4);scene.add(rim);
const rig=new THREE.Group();scene.add(rig);
const shadows=[];
for(let i=0;i<2;i++){
 const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,62);
 g.addColorStop(0,'rgba(27,40,34,.20)');g.addColorStop(.4,'rgba(27,40,34,.09)');g.addColorStop(1,'rgba(27,40,34,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(i===0?-1.05:1.5,-2.85,0);shadow.visible=false;scene.add(shadow);shadows.push(shadow);
}
let model,parts=[],raf=0,last=0,visible=true,disposed=false,drag=null;
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let previousStatus='';function setStatus(text){if(text!==previousStatus){previousStatus=text;onStatus(text);}}
function setRay(e){const b=canvas.getBoundingClientRect();ndc.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(ndc,camera);}
function rayPoint(){return ray.ray.intersectPlane(plane,new THREE.Vector3());}
function pick(e){setRay(e);scene.updateMatrixWorld(true);return ray.intersectObjects(parts.map(p=>p.mesh),false)[0];}
function resting(){return parts.every(p=>Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.c)+Math.abs(p.cv)<.002);}
function resetPart(p){Object.assign(p,{x:0,y:0,vx:0,vy:0,c:0,cv:0,tx:0,ty:0});p.mesh.morphTargetInfluences[p.jellyIndex]=0;p.hinge.position.set(p.rest,0,0);p.hinge.rotation.set(0,0,0);}
function settle(){if(!state.loaded)return;endDrag(true);parts.forEach(resetPart);rig.position.y=0;state.mode='ready';setStatus('动画完成 · 拖住左片或右片，松手看它弹回');onProgress(1);wake();}
function replay(){if(!state.loaded)return;endDrag(true);parts.forEach(resetPart);state.elapsed=0;last=0;state.mode=state.reduced?'ready':'intro';if(state.reduced)settle();else introPose();wake();}
function introPose(){const v=clamp(state.elapsed/duration*120,0,119),i=Math.floor(v),a=timeline[i],b=timeline[Math.min(i+1,119)],f=v-i;
 rig.position.y=THREE.MathUtils.lerp(a.rootY,b.rootY,f);
 parts.forEach((p,j)=>{const x=a.parts[j],y=b.parts[j];p.hinge.position.set(THREE.MathUtils.lerp(x.x,y.x,f),THREE.MathUtils.lerp(x.y,y.y,f),0);p.hinge.rotation.z=THREE.MathUtils.lerp(x.roll,y.roll,f);p.mesh.morphTargetInfluences[p.jellyIndex]=THREE.MathUtils.lerp(x.jelly,y.jelly,f);});
 onProgress(Math.min(1,state.elapsed/duration));
 setStatus(state.elapsed/duration<.325?'两片被吸引，正在靠拢…':state.elapsed/duration<.775?'挤压、回弹，逐渐稳定…':'即将就绪，可以拉扯左右两片');
}
function advancePart(p,dt){
 const held=drag?.index===p.index;
 if(held){const k=1-Math.exp(-dt*30);p.x+=(p.tx-p.x)*k;p.y+=(p.ty-p.y)*k;p.vx=0;p.vy=0;}
 else{
  const damping=state.reduced?23:8.5;
  p.vx+=(-105*p.x-damping*p.vx)*dt;p.vy+=(-105*p.y-damping*p.vy)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
 }
 const target=held&&!state.reduced?(!drag.moved?p.c:clamp(Math.abs(p.y)*.2-Math.abs(p.x)*.25,-.62,.38)):0;
 p.cv+=(160*(target-p.c)-(state.reduced?28:10)*p.cv)*dt;p.c+=p.cv*dt;
 p.c=clamp(p.c,-.75,1.1);
 if(!held&&Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.c)+Math.abs(p.cv)<.002)resetPart(p);
}
function applyPartPose(p){
 p.hinge.position.set(p.rest+p.x,p.y+Math.max(0,p.c)*.42,0);
 p.hinge.rotation.z=state.reduced?0:p.y*.045+p.x*.025;
 p.mesh.morphTargetInfluences[p.jellyIndex]=state.reduced?0:p.c;
}
function render(time){raf=0;if(disposed||document.hidden||!visible||!state.loaded)return;const rawDt=last?(time-last)/1000:1/60;const dt=Math.min(rawDt,.25);last=time;
 if(state.mode==='intro'){state.elapsed+=rawDt;if(state.elapsed>=duration)settle();else introPose();}
 else{rig.position.y=0;const steps=Math.max(1,Math.ceil(dt/(1/120)));for(let i=0;i<steps;i++){
  parts.forEach(p=>advancePart(p,dt/steps));
  const contact=resolvePageContact(parts,drag?.index??null,state.reduced);
  if(contact&&contact.closingSpeed>.15){state.contactCount++;state.lastContact=contact;}
 }parts.forEach(applyPartPose);if(!drag&&resting()){state.mode='ready';setStatus('拖住任意一片，松手后两片一起弹性收稳');}}
 parts.forEach((p,i)=>{shadows[i].position.x=(i===0?-1.05:1.5)+(p.hinge.position.x-p.rest);shadows[i].material.opacity=clamp(1-Math.abs(p.y)*.25,.4,1);});
 renderer.render(scene,camera);state.frames++;
 if(state.mode==='intro'||drag||!resting())wake();
}
function wake(){if(!raf&&!disposed&&!document.hidden&&visible&&state.loaded)raf=requestAnimationFrame(render);}
function begin(e){if(e.button!==0||state.mode==='intro'||!state.loaded||drag)return;const hit=pick(e);if(!hit)return;const index=parts.findIndex(p=>p.mesh===hit.object);const point=rayPoint();if(!point)return;const p=parts[index];state.selected=index;p.tx=p.x;p.ty=p.y;p.vx=0;p.vy=0;p.cv=0;
 drag={index,id:e.pointerId,start:point.clone(),clientX:e.clientX,clientY:e.clientY,moved:false,baseX:p.x,baseY:p.y,previousX:p.x,previousY:p.y,last:performance.now(),vx:0,vy:0};state.dragging=index;state.mode='dragging';canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';setStatus(`正在拉扯${index===0?'左':'右'}片 · 松手回弹`);wake();e.preventDefault();
}
function move(e){if(drag&&e.pointerId===drag.id){if(!drag.moved&&Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)<4)return;drag.moved=true;setRay(e);const pos=rayPoint();if(!pos)return;const p=parts[drag.index],dx=pos.x-drag.start.x,dy=pos.y-drag.start.y;
 const x=drag.baseX+dx,y=drag.baseY+dy;
 p.tx=clamp(x,drag.index===0?-2.25:-.16,drag.index===0?.16:2.25);p.ty=clamp(y,-.18,1.15);p.x=p.tx;p.y=p.ty;
 const now=performance.now(),dt=Math.max(.008,(now-drag.last)/1000);drag.vx=clamp((p.tx-drag.previousX)/dt,-8,8);drag.vy=clamp((p.ty-drag.previousY)/dt,-6,6);drag.previousX=p.tx;drag.previousY=p.ty;drag.last=now;wake();e.preventDefault();
 }else if(state.mode!=='intro'&&state.loaded){canvas.style.cursor=pick(e)?'grab':'default';}}
function endDrag(cancelled=false){if(!drag)return;const d=drag,p=parts[d.index];drag=null;state.dragging=null;
 if(d.id!==null&&canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);
 const recent=d.id===null||performance.now()-d.last<100;p.vx=cancelled||state.reduced||!recent?0:d.vx*.28;p.vy=cancelled||state.reduced||!recent?0:d.vy*.28;state.mode='returning';canvas.style.cursor='grab';setStatus('松手了，弹性归位…');wake();}
canvas.addEventListener('pointerdown',begin);canvas.addEventListener('pointermove',move);
canvas.addEventListener('pointerup',e=>{if(e.pointerId===drag?.id)endDrag();});canvas.addEventListener('pointercancel',e=>{if(e.pointerId===drag?.id)endDrag(true);});canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===drag?.id)endDrag(true);});
canvas.addEventListener('keydown',e=>{if(!state.loaded||state.mode==='intro')return;
 if(e.key==='1'||e.key==='2'){state.selected=Number(e.key)-1;setStatus(`已选择${state.selected===0?'左':'右'}片 · 方向键拉动，空格松手`);return;}
 if(e.key===' '||e.key==='Escape'){endDrag();e.preventDefault();return;}
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 if(!drag){const p=parts[state.selected];drag={index:state.selected,id:null,moved:true,vx:0,vy:0};p.tx=p.x;p.ty=p.y;state.dragging=state.selected;state.mode='dragging';}
 const p=parts[drag.index];p.tx=clamp(p.tx+(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0),p.index===0?-2.25:-.16,p.index===0?.16:2.25);p.ty=clamp(p.ty+(e.key==='ArrowUp'?.15:e.key==='ArrowDown'?-.15:0),-.18,1.15);wake();e.preventDefault();
});canvas.addEventListener('blur',()=>endDrag(true));

const resize=()=>{const b=host.getBoundingClientRect();if(b.width<1||b.height<1)return;const aspect=b.width/b.height,h=Math.max(8.4,11.4/aspect);camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,maxPixelRatio));renderer.setSize(Math.round(b.width),Math.round(b.height),false);wake();};
const observer=new ResizeObserver(resize);observer.observe(host);window.addEventListener('resize',resize);resize();
const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(visible)wake();else{endDrag(true);cancelAnimationFrame(raf);raf=0;}});intersection.observe(host);
const visibility=()=>{last=0;if(document.hidden){endDrag(true);cancelAnimationFrame(raf);raf=0;}else wake();};document.addEventListener('visibilitychange',visibility);
const preference=()=>{state.reduced=media.matches;if(state.reduced)settle();wake();};media.addEventListener('change',preference);
new GLTFLoader().parseAsync(Uint8Array.from(atob(__MODEL_BASE64__),c=>c.charCodeAt(0)).buffer,'').then(gltf=>{
 if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});resolveReady({ok:false,cancelled:true});return;}
 model=gltf.scene;rig.add(model);
 parts=['Left_Obsidian','Right_Prismatic'].map((name,index)=>{const mesh=model.getObjectByName(name);const jellyIndex=mesh?.morphTargetDictionary?.Jelly_Compression;if(!mesh?.morphTargetInfluences||jellyIndex===undefined)throw new Error('Missing jelly morph target');return {index,mesh,jellyIndex,hinge:mesh.parent,rest:index===0?.35:.53,x:0,y:0,vx:0,vy:0,c:0,cv:0,tx:0,ty:0};});
 const original=parts[0].mesh.material;const material=new THREE.MeshMatcapMaterial({matcap,color:0xffffff,toneMapped:false});parts.forEach(p=>{p.mesh.material=material;});original.dispose();
 state.loaded=true;host.dataset.ready='true';autoPlay?replay():settle();resolveReady({ok:true});
}).catch(e=>{state.mode='error';setStatus('无法加载 3D：'+e.message);console.error(e);resolveReady({ok:false,error:e});});
const api={ready,replay,reset:settle,destroy,state,camera,renderer,scene,parts:()=>parts,info:()=>({mode:state.mode,frames:state.frames,camera:camera.position.toArray(),zoom:camera.zoom,parts:parts.map(p=>({side:p.index===0?'left':'right',x:p.x,y:p.y,jelly:p.c,vx:p.vx}))}),project(index){const p=parts[index];scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(p.mesh);const center=box.getCenter(new THREE.Vector3());center.x+=index===0?-.45:.2;const v=center.project(camera),b=canvas.getBoundingClientRect();return {x:b.left+(v.x+1)*b.width/2,y:b.top+(1-v.y)*b.height/2};}};
function destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);endDrag(true);observer.disconnect();intersection.disconnect();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}});matcap.dispose();renderer.dispose();canvas.remove();delete host.dataset.ready;window.removeEventListener('pagehide',destroy);}
window.addEventListener('pagehide',destroy,{once:true});return api;
}
