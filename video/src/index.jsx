import React from 'react';
import {AbsoluteFill, Composition, Img, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import {GameplayPreview} from './gameplay-preview';
import {CharacterSheet} from './character-sheet';

const C={bg:'#101329',panel:'#1b2142',ink:'#f5f4ee',muted:'#b4bed8',cyan:'#32d6f5',pink:'#ff55ae',yellow:'#ffe15b',navy:'#090d24'};
const colors=[C.cyan,C.pink,C.yellow,'#ff9b5c','#a58bff','#77d8b6'];
const ease=(f,a,b)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

// Video-only choreography illustrates the prototype. It does not replay live players.
function Avatar({x,y,id=0,scale=3,jump=0}){
 const skin=['#f1ccac','#d8a27b','#af7657','#7c5141'][id%4];
 const hair=['#564237','#a77042','#33333c','#d7b37d'][id%4];
 return <div style={{position:'absolute',left:x,top:y,width:24*scale,height:32*scale,transform:`translate(-50%,-100%) translateY(${-jump}px)`}}>
  <svg width={24*scale} height={32*scale} viewBox="0 0 24 32" style={{imageRendering:'pixelated',shapeRendering:'crispEdges'}}>
   <rect x="5" y="5" width="14" height="23" fill={C.navy}/><rect x="3" y="8" width="18" height="15" fill={C.navy}/>
   <rect x="5" y="16" width="14" height="11" fill={colors[id%6]}/><rect x="5" y="7" width="14" height="12" fill={skin}/>
   <rect x="3" y="18" width="3" height="6" fill={skin}/><rect x="18" y="18" width="3" height="6" fill={skin}/>
   <rect x="5" y="5" width="14" height="4" fill={hair}/><rect x="8" y="12" width="2" height="3" fill={C.navy}/><rect x="15" y="12" width="2" height="3" fill={C.navy}/>
   <rect x="6" y="27" width="5" height="3" fill={C.navy}/><rect x="14" y="27" width="5" height="3" fill={C.navy}/>
  </svg>
 </div>;
}
function Hero({x=1000,y=600,size=290,frame=0}){
 const col=Math.floor(frame/7)%3;
 return <div style={{position:'absolute',left:x-size/2,top:y-size,width:size,height:size,overflow:'hidden'}}>
  <Img src={staticFile('cyan-hoodie-poses.png')} style={{position:'absolute',width:size*3,height:size*4,maxWidth:'none',left:-col*size,top:0,imageRendering:'pixelated'}}/>
 </div>;
}
function Eyebrow({children}){return <div style={{fontSize:17,color:C.cyan,marginBottom:20}}>{children}</div>}
function Title({children,size=64,width=1050}){return <div style={{fontSize:size,fontWeight:700,lineHeight:1.12,maxWidth:width,letterSpacing:-2}}>{children}</div>}
function Copy({children,width=900}){return <div style={{fontSize:27,lineHeight:1.5,color:C.muted,marginTop:24,maxWidth:width}}>{children}</div>}
function Label({children}){return <div style={{position:'absolute',bottom:24,left:48,fontSize:15,color:C.muted}}>{children}</div>}
function Dpad({frame=0}){
 const key=Math.floor(frame/24)%5;
 return <div style={{display:'grid',gridTemplateColumns:'repeat(3,70px)',gridTemplateRows:'repeat(3,70px)',gap:9}}>
  {[null,'▲',null,'◀','JUMP','▶',null,'▼',null].map((v,i)=>v?<div key={i} style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:v==='JUMP'?15:30,color:C.navy,background:(key===1&&i===5)||(key===2&&i===7)||(key===3&&i===4)?C.pink:C.cyan,boxShadow:`5px 5px 0 ${C.navy}`,transform:key===3&&i===4?'translateY(3px)':'none'}}>{v}</div>:<div key={i}/>)}
 </div>;
}
function Phone({frame=0,nickname=false}){
 return <div style={{width:300,height:505,background:C.panel,border:`6px solid ${C.ink}`,padding:22,position:'relative',boxSizing:'border-box'}}>
  <div style={{fontSize:17,color:C.cyan,marginBottom:20}}>SIDEQUEST LIVE</div>
  {nickname?<><Avatar x={150} y={190} id={0} scale={4}/><div style={{position:'absolute',top:230,left:22,right:22,padding:15,border:`2px solid ${C.muted}`,fontSize:21}}>Your nickname</div><div style={{position:'absolute',top:304,left:22,right:22,display:'flex',gap:12}}>{colors.map(c=><div key={c} style={{width:30,height:30,background:c}}/>)}</div><div style={{position:'absolute',bottom:46,left:22,right:22,padding:14,textAlign:'center',color:C.navy,background:C.cyan,fontSize:22}}>PLAY</div></>:<><Dpad frame={frame}/><div style={{borderTop:`2px solid ${C.muted}`,marginTop:32,paddingTop:21,fontSize:20,color:C.muted}}>Your message...</div><div style={{position:'absolute',bottom:30,right:22,fontSize:24,color:C.cyan}}>SEND</div></>}
 </div>;
}
function Arena({frame=0,mode='choice'}){
 const p=ease(frame,30,170);
 const q=mode==='choice'?'What are you building tonight?':'Would you trust AI to judge this hackathon?';
 const labels=mode==='choice'?['AI TOOLS','GAMES','SOMETHING WEIRD']:['YES, ABSOLUTELY','ABSOLUTELY NOT'];
 const n=labels.length;
 return <div style={{position:'absolute',left:50,right:50,top:130,bottom:85,background:C.panel,border:`4px solid #343c67`,overflow:'hidden'}}>
  <div style={{height:70,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,color:C.ink,background:C.navy,padding:'0 30px',textAlign:'center'}}>{q}</div>
  {labels.map((label,i)=><div key={label} style={{position:'absolute',left:20+i*(1130/n),top:100,width:1090/n,height:290,background:colors[i]+'22',border:`3px solid ${colors[i]}`,opacity:ease(frame,0,20),boxSizing:'border-box'}}><div style={{fontSize:19,color:colors[i],textAlign:'center',padding:18}}>{label}</div></div>)}
  {Array.from({length:18},(_,i)=>{
   const group=i%n, gx=70+group*(1130/n)+(i%n===0?0:0),tx=gx+40+(Math.floor(i/n)%3)*70,ty=235+Math.floor(Math.floor(i/n)/3)*95;
   const sx=260+(i%6)*120,sy=340+Math.floor(i/6)*35;
   const x=sx+(tx-sx)*p,y=sy+(ty-sy)*p;
   const moving=p>0&&p<1?Math.abs(Math.sin(frame/5+i))*5:0;
   const jump=i===3&&frame>190&&frame<220?Math.sin((frame-190)/30*Math.PI)*34:0;
   return <Avatar key={i} x={x} y={y-moving} id={i} scale={2.4} jump={jump}/>;
  })}
  {frame>235&&<div style={{position:'absolute',bottom:12,left:0,right:0,textAlign:'center',fontSize:23,color:C.yellow}}>Final positions become the answers.</div>}
 </div>;
}
const scenes=[
 {from:0,to:180,id:'intro'},
 {from:180,to:420,id:'problem'},
 {from:420,to:720,id:'join'},
 {from:720,to:1020,id:'control'},
 {from:1020,to:1440,id:'vote'},
 {from:1440,to:1710,id:'fun'},
 {from:1710,to:1950,id:'future'},
 {from:1950,to:2250,id:'end'},
];
function Film(){
 const frame=useCurrentFrame();const scene=scenes.find(s=>frame>=s.from&&frame<s.to)||scenes.at(-1);const f=frame-scene.from;
 const opacity=Math.min(ease(f,0,10),1-ease(f,scene.to-scene.from-10,scene.to-scene.from));
 return <AbsoluteFill style={{background:C.bg,color:C.ink,fontFamily:'Arial, sans-serif',overflow:'hidden'}}>
  <AbsoluteFill style={{opacity}}>
   {scene.id==='intro'&&<><div style={{position:'absolute',left:70,top:150}}><Eyebrow>GROK BOT COMMUNITY ENGINEERING HACKATHON · LONDON</Eyebrow><Title size={91}>SIDEQUEST<br/><span style={{color:C.cyan}}>LIVE</span></Title><Copy width={650}>Turn the audience into players.</Copy></div><Hero x={1000} y={610} size={330} frame={f}/><Label>Hackathon prototype · October 22, 2026</Label></>}
   {scene.id==='problem'&&<><div style={{position:'absolute',left:70,top:110}}><Eyebrow>FOR COMMUNITY ORGANISERS</Eyebrow><Title>Your room is full.<br/>Get everyone involved.</Title><Copy>Give the room a question.<br/>Let people answer together.</Copy></div>{Array.from({length:12},(_,i)=><Avatar key={i} x={120+i*91} y={620-Math.abs(Math.sin(f/24+i))*12} id={i} scale={2.6}/>)}<Label>A shared icebreaker for hackathons and community events.</Label></>}
   {scene.id==='join'&&<><div style={{position:'absolute',left:70,top:140,width:720}}><Eyebrow>JOIN IN SECONDS</Eyebrow><Title>Scan. Choose.<br/>You are in.</Title><Copy width={620}>Scan the room QR code.<br/>Enter a nickname. Pick your look.<br/>No player account required.</Copy><div style={{marginTop:44,color:C.cyan,fontSize:23}}>Your phone becomes the controller.</div></div><div style={{position:'absolute',right:85,top:100}}><Phone nickname/></div><Label>Illustrated prototype flow · current avatar artwork is temporary</Label></>}
   {scene.id==='control'&&<><div style={{position:'absolute',left:80,top:120}}><Phone frame={f}/></div><div style={{position:'absolute',left:480,top:155}}><Eyebrow>LOOK UP AT THE SHARED SCREEN</Eyebrow><Title width={720}>Move. Jump.<br/>Cause a little chaos.</Title><Copy width={640}>Four arrows. One jump button.<br/>Short messages appear above your character.</Copy></div><Avatar x={700+Math.sin(f/30)*100} y={600} id={0} scale={4} jump={Math.floor(f/24)%5===3?Math.abs(Math.sin(f/8))*55:0}/><Avatar x={940} y={600} id={1} scale={4}/><Label>Gameplay animation · prototype mechanics</Label></>}
   {scene.id==='vote'&&<><div style={{position:'absolute',left:55,top:40}}><Eyebrow>ANSWER BY MOVING</Eyebrow></div><Arena frame={f}/><Label>Illustrative round · positions and counts shown are examples</Label></>}
   {scene.id==='fun'&&<><div style={{position:'absolute',left:55,top:40}}><Eyebrow>USEFUL QUESTIONS. RIDICULOUS QUESTIONS.</Eyebrow></div><Arena frame={f} mode="scale"/><Label>Illustrative opinion poll · no answer is marked correct</Label></>}
   {scene.id==='future'&&<><Img src={staticFile('arcade-concept.png')} style={{position:'absolute',width:1280,height:720,objectFit:'cover',opacity:.30}}/><div style={{position:'absolute',inset:0,background:'rgba(8,12,32,0.60)'}}/><div style={{position:'absolute',left:70,top:90}}><Eyebrow>WHERE WE ARE TAKING IT</Eyebrow><Title>A Grok host.<br/>A room with memory.</Title><Copy width={1050}>Planned: Grok presents and follows up.<br/>Cognee recalls event context and past rounds.<br/>Supabase stores the results.</Copy><div style={{fontSize:20,color:C.yellow,marginTop:32}}>These integrations and the final arcade artwork are in progress.</div></div><Label>Visual concept · not a recording of the running application</Label></>}
   {scene.id==='end'&&<><div style={{position:'absolute',left:70,top:100}}><Eyebrow>BUILT IN THE OPEN</Eyebrow><Title size={76}>Make the room<br/><span style={{color:C.cyan}}>part of the game.</span></Title><Copy>Browser-based multiplayer prototype.<br/>React · Phaser · Colyseus · TypeScript</Copy><div style={{marginTop:35,fontSize:23,color:C.cyan}}>github.com/AxENSRennes/grok-hackathon</div><div style={{marginTop:15,fontSize:23}}>play.colvenalabs.com</div><div style={{marginTop:22,fontSize:18,color:C.muted}}>MIT licensed · early hackathon prototype</div></div><Hero x={1100} y={625} size={220} frame={f}/><Label>Sidequest Live · Grok Bot Community Engineering London Hackathon</Label></>}
  </AbsoluteFill>
  <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${100*frame/2250}%`,background:C.cyan}}/>
 </AbsoluteFill>;
}
registerRoot(()=> <><Composition id="SidequestPitch" component={Film} width={1280} height={720} fps={30} durationInFrames={2250}/><Composition id="GameplayPreview" component={GameplayPreview} width={1280} height={800} fps={30} durationInFrames={900}/><Composition id="CharacterSheet" component={CharacterSheet} width={1280} height={800} fps={30} durationInFrames={1}/></>);
