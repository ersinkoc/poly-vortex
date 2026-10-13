/** Bounded volume integration inside instanced camera-facing quads. WebGL2 safe. */
export const explosionVertex = `
attribute vec4 aFx;
attribute vec4 aEvolution;
varying vec2 vUv;
varying vec4 vFx;
varying vec4 vEvolution;
void main(){
  vUv=uv; vFx=aFx; vEvolution=aEvolution;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
}`;

const noise = `
uniform sampler2D uNoise;
float volumeNoise(vec3 p){
  vec2 q=p.xy*.17+p.z*vec2(.113,.071);
  float a=texture2D(uNoise,q).r;
  float b=texture2D(uNoise,p.yz*.23+p.x*vec2(.091,.137)+.37).g;
  return a*.6+b*.4;
}
float turbulence(vec3 p){return volumeNoise(p)*.48+volumeNoise(p*2.13+4.7)*.32+volumeNoise(p*5.31+8.2)*.2;}
`;

export const explosionFireFragment = `
uniform sampler2D uMap;
uniform float uSamples;
varying vec2 vUv;
varying vec4 vFx;
varying vec4 vEvolution;
${noise}
void main(){
  vec2 uv=clamp(vUv,0.,1.); vec2 q=uv*2.-1.;
  float age=max(0.,vEvolution.x), seed=vEvolution.y, mode=vEvolution.z;
  if(mode>1.5){
    float alpha=texture2D(uMap,uv).a*vFx.a;
    if(alpha<.004)discard;
    gl_FragColor=vec4(vFx.rgb,alpha);
  }else{
    float sphere=1.-dot(q,q); if(sphere<=0.)discard;
    float depth=sqrt(max(0.,sphere));
    vec3 sum=vec3(0.); float opacity=0.;
    float stepSize=2.*depth/uSamples;
    for(int i=0;i<12;i++){
      if(float(i)>=uSamples)break;
      vec3 p=vec3(q,depth-(float(i)+.5)*stepSize);
      vec3 flow=p*2.4+vec3(seed*.71,-age*(mode>.5?2.8:1.3),seed*.29);
      flow.x+=sin(p.y*4.+age*3.+seed)*.25;
      float n=clamp((turbulence(flow)-.5)*2.2+.5,0.,1.);
      float shape=1.-length(p);
      if(mode>.5)shape=min(shape,(1.-p.y)*.36-abs(p.x)*.42);
      float density=smoothstep(.04,.3,shape+(n-.5)*.46)*(.35+n*.95);
      float cooling=mode>.5?.24:smoothstep(.1,.85,age);
      float heat=clamp(shape*.65+n*1.4-.25-cooling*.6-(mode>.5?(p.y+.5)*.42:0.),0.,1.);
      vec3 soot=vec3(.035,.025,.019);
      vec3 hot=mix(vec3(1.4,.1,.008),vec3(2.5,.65,.035),smoothstep(.25,.72,heat));
      hot=mix(hot,vec3(2.8,1.15,.16),smoothstep(.72,1.,heat));
      vec3 emission=mix(soot,hot,smoothstep(.22,.57,heat));
      float alpha=(1.-exp(-density*stepSize*3.7))*(1.-opacity);
      sum+=emission*alpha; opacity+=alpha;
    }
    if(opacity*vFx.a<.004)discard;
    gl_FragColor=vec4(sum/max(opacity,.001),opacity*vFx.a);
  }
  #include <colorspace_fragment>
}`;

export const explosionSmokeFragment = `
varying vec2 vUv;
varying vec4 vFx;
varying vec4 vEvolution;
${noise}
void main(){
  vec2 q=clamp(vUv,0.,1.)*2.-1.; float r=dot(q,q);
  if(r>=1.)discard;
  float age=max(0.,vEvolution.x), seed=vEvolution.y;
  vec3 p=vec3(q,sqrt(max(0.,1.-r)));
  vec3 flow=p*2.6+vec3(seed*.43,-age*.5,seed*.17);
  flow.x+=sin(q.y*3.+age*.8+seed)*.28;
  float n=turbulence(flow);
  float edge=smoothstep(0.,.26,1.-sqrt(r)+(n-.5)*.48);
  float density=edge*smoothstep(.22,.75,n)*sqrt(max(0.,1.-r));
  float nx=volumeNoise(flow+vec3(.17,0.,0.));
  float ny=volumeNoise(flow+vec3(0.,.17,0.));
  vec3 normal=normalize(vec3(q*.8+vec2(n-nx,n-ny)*3.5,sqrt(max(.01,1.-r))));
  float light=.35+.65*max(0.,dot(normal,normalize(vec3(-.6,.8,.7))));
  vec3 soot=vEvolution.z>.5?mix(vec3(.12,.087,.055),vec3(.3,.24,.16),light):mix(vec3(.018,.016,.014),vec3(.105,.115,.12),light)*(.6+n*.6);
  vec3 fireLight=vec3(.4,.075,.009)*exp(-age*1.8)*(1.-r);
  float alpha=(1.-exp(-density*3.5))*vFx.a;
  if(alpha<.004)discard;
  gl_FragColor=vec4(soot+fireLight,alpha);
  #include <colorspace_fragment>
}`;
