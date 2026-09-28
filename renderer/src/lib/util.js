const U={};
U.h=React.createElement;
U.cx=(...a)=>a.filter(Boolean).join(" ");
U.uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
U.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const rand=(n)=>{const a=new Uint32Array(1);const lim=Math.floor(4294967296/n)*n;let x;do{crypto.getRandomValues(a);x=a[0];}while(x>=lim);return x%n;};
U.rand=rand;

const SETS={upper:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",lower:"abcdefghijklmnopqrstuvwxyz",digits:"0123456789",symbols:"!@#$%^&*()-_=+[]{};:,.?/~"};
const AMBIG=/[Il1O0o|`'"]/g;

const WORDS=("acid acorn actor adobe agent alarm album alder alley alpha amber anchor angle ankle apple april apron arbor arena argon armor arrow aspen atlas attic audio aunt autumn avenue award axis bacon badge bagel baker balmy bamboo banjo barley barn basil basin beach beacon beard beaver bench berry bison blade blank blaze bloom blues boat bolt bonus boost border bottle bounce brass bread brick bridge brisk broom brush bubble buddy bugle bunny butter cabin cable cactus camel candle canoe canyon carbon cargo carpet castle cedar cello chalk charm cherry chess chili chorus cider cinema circle citrus clay clever cliff clock cloud clover coast cobalt cocoa comet copper coral cotton cougar crane crater crisp crown cumin curtain cycle dahlia daisy dance delta denim desert dial diary disco dolphin donut dragon drift drum dune eagle easel echo eclipse elbow elder ember engine epoch equal fabric falcon fancy fern fiber fiddle field fig flame flask fleet flint flora flute foam focus forest fossil fox frost fudge galaxy garden garnet gecko ginger glacier glass globe glove goose grain granite grape gravel grove guitar gulf habit hammer harbor harvest hazel helium heron hickory honey hood horizon hotel humble igloo indigo iris island ivory jacket jade jaguar jasmine jelly jewel jungle kayak kelp kettle kiwi koala ladder lagoon lamp lantern laser lava lemon lilac lily linen lobster lotus lunar lyric magnet mango maple marble market meadow melon mercury meteor mint mirror mocha monsoon mosaic moss motor mural mustard nectar needle neon nickel noble nomad north nutmeg oasis ocean olive onyx opal orbit orchid otter oxide paddle palm panda paper parade pastel peach pearl pebble pepper piano pilot pine pixel plaza plum polar pony poppy portal prairie prism pulse quartz quill quiver radar radish rain raven reef ribbon ridge river robin rocket rose ruby saddle saffron sage salmon sand satin scarf shadow shell sierra silk silver slate sonic spark spice spruce squid stamp star stone storm sugar summit sunset swan tango teal tempo thunder tiger timber toast topaz torch tulip tundra turtle twig umber unity valley velvet vessel violet vivid walnut water wave willow winter wren yarrow yodel zebra zenith zephyr zinc").split(" ");
U.WORDS=WORDS;

U.generate=(o)=>{
  const opt=Object.assign({mode:"random",length:24,upper:true,lower:true,digits:true,symbols:true,avoidAmbiguous:false,words:5,separator:"-",capitalize:true,number:true,pinLength:6},o||{});
  if(opt.mode==="pin"){let s="";for(let i=0;i<opt.pinLength;i++)s+=SETS.digits[rand(10)];return s;}
  if(opt.mode==="passphrase"){
    const w=[];for(let i=0;i<opt.words;i++){let x=WORDS[rand(WORDS.length)];if(opt.capitalize)x=x[0].toUpperCase()+x.slice(1);w.push(x);}
    if(opt.number){const i=rand(w.length);w[i]=w[i]+String(rand(10));}
    return w.join(opt.separator);
  }
  const pools=[];
  ["upper","lower","digits","symbols"].forEach(k=>{if(opt[k]){let p=SETS[k];if(opt.avoidAmbiguous)p=p.replace(AMBIG,"");pools.push(p);}});
  if(!pools.length)pools.push(SETS.lower);
  const all=pools.join("");
  const out=pools.map(p=>p[rand(p.length)]);
  while(out.length<opt.length)out.push(all[rand(all.length)]);
  for(let i=out.length-1;i>0;i--){const j=rand(i+1);[out[i],out[j]]=[out[j],out[i]];}
  return out.slice(0,opt.length).join("");
};

const COMMON=["password","123456","qwerty","letmein","welcome","admin","iloveyou","monkey","dragon","sunset","football","baseball","master","shadow","login","abc123","passw0rd","trustno1"];
U.entropy=(pw)=>{
  if(!pw)return 0;
  const s=String(pw);
  if(/^[A-Za-z]+(-[A-Za-z]+[0-9]?)+$/.test(s)&&s.split("-").length>=3){const n=s.split("-").length;return Math.round(n*Math.log2(WORDS.length)+(/[0-9]/.test(s)?3.3:0));}
  let pool=0;
  if(/[a-z]/.test(s))pool+=26;
  if(/[A-Z]/.test(s))pool+=26;
  if(/[0-9]/.test(s))pool+=10;
  if(/[^A-Za-z0-9]/.test(s))pool+=24;
  let bits=s.length*Math.log2(Math.max(pool,1));
  const low=s.toLowerCase();
  if(COMMON.some(c=>low.includes(c)))bits*=0.35;
  if(/(.)\1{2,}/.test(s))bits*=0.8;
  if(/(19|20)\d\d/.test(s))bits-=6;
  if(/^[A-Z][a-z]+\d+[!@#$%]?$/.test(s))bits*=0.55;
  if(/^\d+$/.test(s))bits=Math.min(bits,s.length*3.32);
  return Math.max(0,Math.round(bits));
};
U.score=(bits)=>bits<28?0:bits<40?1:bits<60?2:bits<80?3:4;
U.strength=(pw)=>{const b=U.entropy(pw);return{bits:b,score:U.score(b)};};
U.crackTime=(bits)=>{
  const s=Math.pow(2,bits)/2/1e10;
  if(s<1)return "instantly";
  if(s>4.35e17)return "longer than the universe has existed";
  const units=[["second",60],["minute",60],["hour",24],["day",365],["year",1000],["thousand years",1000],["million years",1000],["billion years",Infinity]];
  let v=s,i=0;while(i<units.length-1&&v>=units[i][1]){v/=units[i][1];i++;}
  const n=Math.floor(v);
  if(i>=5)return n+" "+units[i][0];
  return n+" "+units[i][0]+(n===1?"":"s");
};

U.crackPhrase=(bits)=>{const t=U.crackTime(bits);return t==="instantly"?"cracked instantly offline":t.startsWith("longer")?"outlasts the universe offline":"cracked in "+t+" offline";};
U.ago=(ts,now)=>{
  if(!ts)return "";
  const d=((now||Date.now())-ts)/1000;
  if(d<45)return "now";
  if(d<3600)return Math.round(d/60)+"m";
  if(d<86400)return Math.round(d/3600)+"h";
  const dt=new Date(ts);
  if(d<86400*6)return dt.toLocaleDateString("en-US",{weekday:"short"});
  if(d<86400*300)return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  return dt.toLocaleDateString("en-US",{month:"short",year:"numeric"});
};
U.agoLong=(ts,now)=>{
  if(!ts)return "never";
  const d=((now||Date.now())-ts)/1000;
  if(d<45)return "just now";
  if(d<3600){const m=Math.round(d/60);return m+" minute"+(m===1?"":"s")+" ago";}
  if(d<86400){const x=Math.round(d/3600);return x+" hour"+(x===1?"":"s")+" ago";}
  const days=Math.round(d/86400);
  if(days<30)return days+" day"+(days===1?"":"s")+" ago";
  return U.date(ts);
};
U.date=(ts)=>!ts?"":new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
U.dateTime=(ts)=>!ts?"":new Date(ts).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
U.group=(ts,now)=>{
  const n=new Date(now||Date.now());const start=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime();
  if(ts>=start)return "Today";
  if(ts>=start-86400000*6)return "This week";
  if(ts>=start-86400000*30)return "This month";
  return "Earlier";
};
U.n=(c,w,pl)=>c+" "+(c===1?w:(pl||w+"s"));
U.bytes=(n)=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB";
U.mask=(s,keep)=>{const v=String(s||"");return "•••• "+v.slice(-(keep||4));};
U.isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
U.mod=U.isMac?"⌘":"Ctrl";

export default U;
